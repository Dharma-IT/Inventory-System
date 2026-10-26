import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const [movementsPath, summaryPath] = process.argv.slice(2);
const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SECRET_KEY;
if (!movementsPath || !summaryPath) throw new Error("Provide movement and summary CSV paths.");
if (!url || !key) throw new Error("Supabase server environment variables are missing.");

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(value); value = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

const number = (value) => Number(String(value).replaceAll(",", "").trim() || 0);
const normalize = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const date = (value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [month, day, year] = value.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

async function api(path, init = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`${init.method || "GET"} ${path}: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const decoder = new TextDecoder("windows-1252");
const movementRows = parseCsv(decoder.decode(await readFile(movementsPath))).slice(2);
const summaryRows = parseCsv(decoder.decode(await readFile(summaryPath))).slice(3);
const remoteProducts = await api("products?select=id,name,sku,opening,received,shipped,weekly,lead");
const byName = new Map(remoteProducts.map((product) => [normalize(product.name), product]));
const aliases = new Map([
  [normalize("Collagen Peptides 240g – Vanilla Creamer"), "CPV-001"],
  [normalize("Collagen Peptides 280g – Unflavored"), "CPU-001"],
  [normalize("Collagen Peptides 378g – Chocolate Flavor"), "CPC-001"],
]);
const englishProductNames = new Map([
  ["ENV-001", "White Envelopes"],
  ["ENV-002", "Green Envelope"],
  ["LAB-001", "Label Roll"],
]);

function translateNote(note) {
  const exact = new Map([
    ["Recebimento Fornecedor", "Supplier receipt"],
    ["Envios de Segunda-feira", "Monday shipments"],
    ["Lote Grande de Recebimento", "Large receiving batch"],
    ["Recebimento (250 x 12 rolos)", "Receipt (250 x 12 rolls)"],
  ]);
  if (exact.has(note)) return exact.get(note);
  return note
    .replace(/^Envios\b/, "Shipments")
    .replace(/^Envio\b/, "Shipment")
    .replace(/Tiktok/g, "TikTok");
}

function resolveProduct(label) {
  const code = label.match(/^([A-Z]+-\d{3})\s+-\s+/)?.[1];
  const alias = aliases.get(normalize(label));
  const product = remoteProducts.find((item) => item.id === code || item.id === alias) || byName.get(normalize(label));
  if (!product) throw new Error(`No product mapping for: ${label}`);
  return product;
}

const products = summaryRows.map((row) => {
  const product = resolveProduct(row[0]);
  const displayName =
    englishProductNames.get(product.id) ||
    row[0].replace(/^[A-Z]+-\d{3}\s+-\s+/, "").replace(/\u0096/g, "–");
  const opening = number(row[1]), received = number(row[2]), shipped = number(row[3]);
  const weekly = number(row[5]), lead = number(row[6]);
  const current = opening + received - shipped;
  const minimum = Math.round((weekly / 5) * lead);
  const maximum = minimum + weekly * 4;
  const suggested = current < minimum ? Math.max(0, maximum - current) : 0;
  const expected = [number(row[4]), number(row[7]), number(row[8]), number(row[9])];
  const calculated = [current, minimum, maximum, suggested];
  if (expected.some((value, index) => value !== calculated[index])) {
    throw new Error(`Formula mismatch for ${row[0]}: expected ${expected}, calculated ${calculated}`);
  }
  return { id: product.id, sku: product.sku, name: displayName, opening, received, shipped, weekly, lead };
});

if (products.length !== 37 || new Set(products.map((product) => product.id)).size !== 37) {
  throw new Error(`Expected 37 unique products, found ${products.length}.`);
}

const productByLabel = new Map();
for (const row of summaryRows) productByLabel.set(normalize(row[0]), resolveProduct(row[0]));
const movements = movementRows.map((row) => {
  const product = productByLabel.get(normalize(row[1])) || resolveProduct(row[1]);
  return {
    id: randomUUID(), date: date(row[0]), product_id: product.id,
    type: row[2].toLowerCase().includes("entrada") ? "Receipt" : "Shipment",
    quantity: number(row[3]), note: translateNote(row[4].trim()),
  };
});
if (movements.length !== 42) throw new Error(`Expected 42 movements, found ${movements.length}.`);

await api("products?on_conflict=id", {
  method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(products),
});
await api("movements?id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } });
await api("movements", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(movements) });

const savedProducts = await api("products?select=id,opening,received,shipped,weekly,lead");
const savedMovements = await api("movements?select=product_id,type,quantity");
const totals = new Map();
for (const movement of savedMovements) {
  const values = totals.get(movement.product_id) || { received: 0, shipped: 0 };
  values[movement.type === "Receipt" ? "received" : "shipped"] += movement.quantity;
  totals.set(movement.product_id, values);
}
for (const product of savedProducts) {
  const values = totals.get(product.id) || { received: 0, shipped: 0 };
  if (values.received !== product.received || values.shipped !== product.shipped) {
    throw new Error(`Saved movement totals do not reconcile for ${product.id}.`);
  }
}
console.log(`Imported and verified ${savedProducts.length} products and ${savedMovements.length} movements.`);

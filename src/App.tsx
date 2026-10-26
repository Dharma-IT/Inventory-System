import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import { database } from "./supabase";
import { fetchOrders } from "./ordersApi";
import type { ShopifyOrder } from "./ordersApi";
import { downloadUspsCsv } from "./uspsLabels";

type Product = {
  id: string;
  name: string;
  sku: string;
  opening: number;
  received: number;
  shipped: number;
  weekly: number;
  lead: number;
};
type Movement = {
  id: string;
  date: string;
  productId: string;
  type: "Receipt" | "Shipment";
  quantity: number;
  note: string;
};

const seedRows: Array<
  [string, string, number, number, number, number, number]
> = [
  ["ENV-001", "White Envelopes", 149, 600, 134, 336, 3],
  ["ENV-002", "Green Envelope", 0, 4930, 0, 0, 60],
  ["LAB-001", "Label Roll", 200, 3000, 17, 67, 7],
  ["LAB-002", "Label Pack", 750, 0, 61, 269, 3],
  ["GB-001", "Gut Boost", 12, 0, 0, 0, 10],
  ["BB-001", "Beauty Boost", 13, 0, 0, 0, 10],
  ["NAD-001", "NAD+", 17, 0, 0, 0, 10],
  ["DN-001", "Detox Now", 10, 0, 0, 0, 10],
  ["MV-001", "Multi Vitamin", 12, 0, 0, 0, 10],
  ["OM-001", "Omega-3", 10, 0, 0, 0, 10],
  ["GLP-001", "GLP1 Support", 90, 0, 0, 0, 10],
  ["ACV-001", "Apple Cider Vinegar", 9, 0, 0, 0, 10],
  ["FB-001", "Fat Burner", 10, 0, 0, 0, 10],
  ["WPV-001", "Whey Protein Vanilla", 6, 0, 0, 0, 10],
  ["WPC-001", "Whey Protein Chocolate", 7, 0, 0, 0, 10],
  ["DT-001", "Detox Tea", 6600, 0, 10, 14, 0],
  ["SB-001", "Slim Boost", 901, 0, 1, 14, 60],
  ["BER-001", "Berberine", 6139, 0, 132, 319, 28],
  ["BA-001", "Bloat Away", 4, 0, 0, 0, 10],
  ["BF-001", "Brain & Focus", 8, 0, 0, 0, 10],
  ["CPV-001", "Collagen Peptides · Vanilla Creamer", 8, 0, 0, 0, 10],
  ["CPU-001", "Collagen Peptides · Unflavored", 8, 0, 0, 0, 10],
  ["CPC-001", "Collagen Peptides · Chocolate", 10, 0, 0, 0, 10],
  ["CM-001", "Creatine Monohydrate", 7, 0, 0, 0, 10],
  ["ES-001", "Energy Strips", 6, 0, 0, 0, 10],
  ["GC-001", "Gentle Cleanse", 5, 0, 0, 0, 10],
  ["HLE-001", "Hydraglow · Lemonade", 7, 0, 0, 0, 10],
  ["HLY-001", "Hydraglow · Lychee", 8, 0, 0, 0, 10],
  ["HPF-001", "Hydraglow · Passion Fruit", 8, 0, 0, 0, 10],
  ["HPM-001", "Hydraglow · Peach Mango", 9, 0, 0, 0, 10],
  ["LMN-001", "Love Me Now", 9, 0, 0, 0, 10],
  ["MG-001", "Magnesium Glycinate", 4, 0, 0, 0, 10],
  ["PP-001", "Plant Protein", 12, 0, 0, 0, 10],
  ["SF-001", "Sleep Formula", 8, 0, 0, 0, 10],
  ["SS-001", "Sleep Strips", 21, 0, 1, 0, 10],
  ["VD3-001", "Vitamin D3", 8, 0, 0, 0, 10],
  ["VDK-001", "Vitamin D3/K2", 8, 0, 0, 0, 10],
];
const seedProducts: Product[] = seedRows.map(
  ([sku, name, opening, received, shipped, weekly, lead]) => ({
    id: sku,
    name,
    sku,
    opening,
    received,
    shipped,
    weekly,
    lead,
  }),
);
const seedMovements: Movement[] = [
  {
    id: "1",
    date: "2026-10-20",
    productId: "ENV-001",
    type: "Receipt",
    quantity: 600,
    note: "Supplier receipt",
  },
  {
    id: "2",
    date: "2026-10-20",
    productId: "ENV-001",
    type: "Shipment",
    quantity: 56,
    note: "Monday shipments",
  },
  {
    id: "3",
    date: "2026-11-15",
    productId: "ENV-002",
    type: "Receipt",
    quantity: 4930,
    note: "Large receiving batch",
  },
  {
    id: "4",
    date: "2026-10-20",
    productId: "LAB-001",
    type: "Receipt",
    quantity: 3000,
    note: "250 × 12 rolls",
  },
  {
    id: "5",
    date: "2026-10-21",
    productId: "BER-001",
    type: "Shipment",
    quantity: 55,
    note: "TikTok orders",
  },
];

const stock = (p: Product) => p.opening + p.received - p.shipped;
const minimum = (p: Product) => Math.round((p.weekly / 5) * p.lead);
const maximum = (p: Product) => minimum(p) + p.weekly * 4;
const suggestedOrder = (p: Product) =>
  stock(p) < minimum(p) ? Math.max(0, maximum(p) - stock(p)) : 0;
const status = (p: Product) => (stock(p) < minimum(p) ? "Restock" : "Healthy");
const fmt = new Intl.NumberFormat("en-US");

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [databaseError, setDatabaseError] = useState("");
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [labelTab, setLabelTab] = useState<"tiktok" | "other">("tiktok");
  const [orderDate, setOrderDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
    }).format(new Date()),
  );
  const [loadStage, setLoadStage] = useState("");
  const [loadEta, setLoadEta] = useState("");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadSeconds, setLoadSeconds] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Healthy" | "Restock">("All");
  const [modal, setModal] = useState<"product" | "movement" | "sale" | null>(
    null,
  );
  const [saleProductId, setSaleProductId] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [view, setView] = useState<"inventory" | "labels" | "activity">(
    "inventory",
  );

  useEffect(() => {
    async function loadInventory() {
      try {
        let remoteProducts = await database.products();
        if (!remoteProducts.length) {
          await database.seedProducts(seedProducts);
          remoteProducts = await database.products();
        }
        const remoteMovements = await database.movements();
        setProducts(remoteProducts);
        setMovements(
          remoteMovements.map((m) => ({ ...m, productId: m.product_id })),
        );
        setSaleProductId(remoteProducts[0]?.id || "");
      } catch (error) {
        setDatabaseError(
          error instanceof Error
            ? error.message
            : "Could not connect to Supabase.",
        );
        setProducts(seedProducts);
        setMovements(seedMovements);
        setSaleProductId(seedProducts[0].id);
      } finally {
        setLoading(false);
      }
    }
    void loadInventory();
  }, []);

  useEffect(() => {
    if (!ordersLoading) return;
    const started = Date.now();
    const timer = window.setInterval(
      () => setLoadSeconds((Date.now() - started) / 1000),
      100,
    );
    return () => window.clearInterval(timer);
  }, [ordersLoading]);
  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (p.name + " " + p.sku).toLowerCase().includes(query.toLowerCase()) &&
          (filter === "All" || status(p) === filter),
      ),
    [products, query, filter],
  );
  const healthy = products.filter((p) => status(p) === "Healthy").length;
  const attention = products.length - healthy;
  const total = products.reduce((n, p) => n + stock(p), 0);
  const reorderUnits = products.reduce((n, p) => n + suggestedOrder(p), 0);

  async function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const sku = String(data.get("sku")).trim();
    const name = String(data.get("name")).trim();
    const desiredQuantity = editing
      ? Number(data.get("currentQuantity"))
      : Number(data.get("opening"));
    let next: Product = {
      id: editing?.id || `${sku}-${Date.now()}`,
      sku,
      name,
      opening: +String(data.get("opening")),
      received: editing?.received || 0,
      shipped: editing?.shipped || 0,
      weekly: +String(data.get("weekly")),
      lead: +String(data.get("lead")),
    };
    const adjustment = editing ? desiredQuantity - stock(next) : 0;
    setSaving(true);
    setDatabaseError("");
    try {
      await database.saveProduct(next, Boolean(editing));
      if (editing && adjustment !== 0) {
        const type = adjustment > 0 ? "Receipt" : "Shipment";
        const quantity = Math.abs(adjustment);
        const saved = await database.recordMovement({
          date: new Date().toISOString().slice(0, 10),
          product_id: editing.id,
          type,
          quantity,
          note: "Manual quantity adjustment",
        });
        next = {
          ...next,
          received: next.received + (type === "Receipt" ? quantity : 0),
          shipped: next.shipped + (type === "Shipment" ? quantity : 0),
        };
        setMovements((current) => [
          { ...saved, productId: saved.product_id },
          ...current,
        ]);
      }
      setProducts(
        editing
          ? products.map((p) => (p.id === editing.id ? next : p))
          : [next, ...products],
      );
      setModal(null);
      setEditing(null);
    } catch (error) {
      setDatabaseError(
        error instanceof Error ? error.message : "Unable to save product.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function loadOrders() {
    setOrdersLoading(true);
    setOrdersError("");
    setLoadSeconds(0);
    setLoadProgress(18);
    setLoadStage("Fetching orders 1–100 from Shopify");
    setLoadEta("Estimating remaining time");
    const started = performance.now();
    try {
      const fetchedOrders: ShopifyOrder[] = [];
      let cursor: string | undefined;
      let page = 0;
      let hasNextPage = true;
      while (hasNextPage) {
        const pageStarted = performance.now();
        const result = await fetchOrders(100, cursor, orderDate);
        fetchedOrders.push(...result.nodes);
        page += 1;
        hasNextPage = result.pageInfo.hasNextPage;
        cursor = result.pageInfo.endCursor || undefined;
        const pageSeconds = Math.max(
          0.1,
          (performance.now() - pageStarted) / 1000,
        );
        setLoadProgress(Math.min(68, 18 + page * 12));
        setLoadStage(
          hasNextPage
            ? `Fetched ${fetchedOrders.length} orders · loading ${fetchedOrders.length + 1}–${fetchedOrders.length + 100}`
            : `Fetched all ${fetchedOrders.length} orders`,
        );
        setLoadEta(
          hasNextPage
            ? `Next batch: about ${pageSeconds.toFixed(1)}s`
            : "All order batches loaded",
        );
      }
      const eligible = fetchedOrders.filter((order) =>
        order.lineItems.nodes.some((item) => {
          const name = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          return (
            name.includes("berberine") ||
            name.includes("detoxtea") ||
            name.includes("slimboost")
          );
        }),
      );
      setLoadProgress(72);
      setLoadStage("Automating USPS labels");
      setLoadEta("Less than 1 second remaining");
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      setOrders(eligible);
      setSelectedOrders(
        new Set(
          eligible
            .filter((order) => order.shippingAddress)
            .map((order) => order.id),
        ),
      );
      setLoadProgress(100);
      setLoadStage(
        `Ready — ${eligible.length} eligible order${eligible.length === 1 ? "" : "s"}`,
      );
      setLoadEta("");
      setLoadSeconds((performance.now() - started) / 1000);
    } catch (error) {
      setOrdersError(
        error instanceof Error
          ? error.message
          : "Unable to retrieve Shopify orders.",
      );
    } finally {
      setOrdersLoading(false);
    }
  }

  function exportLabels(source: "tiktok" | "other") {
    setOrdersError("");
    try {
      const groupOrders = orders.filter((order) =>
        source === "tiktok"
          ? order.sourceName.toLowerCase().includes("tiktok")
          : !order.sourceName.toLowerCase().includes("tiktok"),
      );
      downloadUspsCsv(
        groupOrders.filter((order) => selectedOrders.has(order.id)),
        orderDate,
        source === "tiktok" ? "TikTok" : "Other-Sources",
      );
    } catch (error) {
      setOrdersError(
        error instanceof Error
          ? error.message
          : "Unable to create the USPS CSV.",
      );
    }
  }

  const tikTokOrders = orders.filter((order) =>
    order.sourceName.toLowerCase().includes("tiktok"),
  );
  const otherOrders = orders.filter(
    (order) => !order.sourceName.toLowerCase().includes("tiktok"),
  );
  const visibleLabelOrders = labelTab === "tiktok" ? tikTokOrders : otherOrders;
  const selectedVisibleLabels = visibleLabelOrders.filter((order) =>
    selectedOrders.has(order.id),
  ).length;

  function renderOrderTable(title: string, groupOrders: ShopifyOrder[]) {
    if (!groupOrders.length) return null;
    const selectedInGroup = groupOrders.filter((order) =>
      selectedOrders.has(order.id),
    ).length;
    return (
      <div className="label-group">
        <div className="label-group-title">
          <h3>{title}</h3>
          <span>{groupOrders.length} orders</span>
        </div>
        <div className="table-wrap labels-table">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    aria-label={`Select all ${title} orders`}
                    type="checkbox"
                    checked={selectedInGroup === groupOrders.length}
                    onChange={(event) =>
                      setSelectedOrders((current) => {
                        const next = new Set(current);
                        groupOrders.forEach((order) => {
                          if (!order.shippingAddress) return;
                          if (event.target.checked) next.add(order.id);
                          else next.delete(order.id);
                        });
                        return next;
                      })
                    }
                  />
                </th>
                <th>Order</th>
                <th>Date</th>
                <th>Source</th>
                <th>Recipient</th>
                <th>Address</th>
                <th>City / State / ZIP</th>
                <th>Products</th>
                <th>Payment</th>
                <th>Fulfillment</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {groupOrders.map((order) => {
                const address = order.shippingAddress;
                const matchingItems = order.lineItems.nodes.filter((item) => {
                  const name = item.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "");
                  return (
                    name.includes("berberine") ||
                    name.includes("detoxtea") ||
                    name.includes("slimboost")
                  );
                });
                return (
                  <tr key={order.id}>
                    <td>
                      <input
                        aria-label={`Select ${order.name}`}
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        disabled={!address}
                        onChange={(event) =>
                          setSelectedOrders((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(order.id);
                            else next.delete(order.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td>
                      <strong>{order.name}</strong>
                    </td>
                    <td>
                      {new Date(order.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>{order.sourceName}</td>
                    <td>
                      {address
                        ? `${address.firstName || ""} ${address.lastName || ""}`.trim()
                        : "Missing address"}
                    </td>
                    <td>{address?.address1 || "—"}</td>
                    <td>
                      {address
                        ? `${address.city || ""}, ${address.provinceCode || ""} ${address.zip || ""}`
                        : "—"}
                    </td>
                    <td>
                      {matchingItems
                        .map((item) => `${item.name} × ${item.quantity}`)
                        .join(", ")}
                    </td>
                    <td>
                      <span className="order-status">
                        {order.displayFinancialStatus.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span className="order-status">
                        {order.displayFulfillmentStatus.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="order-total">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency:
                          order.currentTotalPriceSet.shopMoney.currencyCode,
                      }).format(
                        Number(order.currentTotalPriceSet.shopMoney.amount),
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  async function saveMovement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const productId = String(data.get("product"));
    const type = String(data.get("type")) as "Receipt" | "Shipment";
    const quantity = +String(data.get("quantity"));
    const movement = {
      date: String(data.get("date")),
      product_id: productId,
      type,
      quantity,
      note: String(data.get("note")),
    };
    setSaving(true);
    setDatabaseError("");
    try {
      const saved = await database.recordMovement(movement);
      setProducts(
        products.map((p) =>
          p.id === productId
            ? {
                ...p,
                [type === "Receipt" ? "received" : "shipped"]:
                  p[type === "Receipt" ? "received" : "shipped"] + quantity,
              }
            : p,
        ),
      );
      setMovements([{ ...saved, productId: saved.product_id }, ...movements]);
      setModal(null);
    } catch (error) {
      setDatabaseError(
        error instanceof Error ? error.message : "Unable to record movement.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveSale(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const productId = String(data.get("product"));
    const quantity = +String(data.get("quantity"));
    const selected = products.find((p) => p.id === productId);
    if (!selected || quantity < 1 || quantity > stock(selected)) return;
    const movement = {
      date: String(data.get("date")),
      product_id: productId,
      type: "Shipment" as const,
      quantity,
      note: String(data.get("note")) || "Sale",
    };
    setSaving(true);
    setDatabaseError("");
    try {
      const saved = await database.recordMovement(movement);
      setProducts(
        products.map((p) =>
          p.id === productId ? { ...p, shipped: p.shipped + quantity } : p,
        ),
      );
      setMovements([{ ...saved, productId: saved.product_id }, ...movements]);
      setModal(null);
    } catch (error) {
      setDatabaseError(
        error instanceof Error ? error.message : "Unable to record sale.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <img src="/Logo.png" alt="Dharma" />
          <div>
            <strong>DHARMA</strong>
            <span>Inventory</span>
          </div>
        </div>
        <nav>
          <button
            className={view === "inventory" ? "active" : ""}
            onClick={() => setView("inventory")}
          >
            <span>▦</span> Inventory
          </button>
          <button
            className={view === "labels" ? "active" : ""}
            onClick={() => setView("labels")}
          >
            <span>▤</span> Labels
          </button>
          <button
            className={view === "activity" ? "active" : ""}
            onClick={() => setView("activity")}
          >
            <span>↕</span> Activity
          </button>
        </nav>
        <div className="side-note">
          <span>Stock formula</span>
          <strong>Opening + receipts − shipments</strong>
          <p>Thresholds update instantly when usage or lead time changes.</p>
        </div>
        <div className="user">
          <div>JD</div>
          <p>
            <strong>Inventory team</strong>
            <span>Operations</span>
          </p>
        </div>
      </aside>
      <main>
        {databaseError && (
          <div className="database-error">
            <strong>Database notice.</strong> {databaseError}
          </div>
        )}
        {loading && <div className="loading">Loading inventory…</div>}
        <header>
          <div>
            <p className="eyebrow">OPERATIONS / {view.toUpperCase()}</p>
            <h1>
              {view === "inventory"
                ? "Inventory overview"
                : view === "labels"
                  ? "Labels"
                  : "Stock activity"}
            </h1>
            <p>
              {view === "inventory"
                ? "Know what is available and what needs action."
                : view === "labels"
                  ? "Create and manage product labels."
                  : "Every receipt and shipment in one place."}
            </p>
          </div>
          {view !== "labels" && (
            <div className="actions">
              <button
                className="secondary"
                onClick={() => setModal("movement")}
              >
                ↕ Record movement
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setEditing(null);
                  setModal("product");
                }}
              >
                ＋ Add product
              </button>
              <button
                className="primary sale-button"
                onClick={() => {
                  setSaleProductId(products[0]?.id || "");
                  setModal("sale");
                }}
              >
                − Record sale
              </button>
            </div>
          )}
        </header>
        {view === "inventory" ? (
          <>
            <section className="metrics">
              <article>
                <span>Total units</span>
                <strong>{fmt.format(total)}</strong>
                <small>Across {products.length} products</small>
                <i className="green">▦</i>
              </article>
              <article>
                <span>Healthy stock</span>
                <strong>{healthy}</strong>
                <small>
                  {Math.round((healthy / products.length) * 100)}% of catalog
                </small>
                <i className="sage">✓</i>
              </article>
              <article>
                <span>Needs attention</span>
                <strong>{attention}</strong>
                <small>
                  {attention ? "Below or near minimum" : "No products at risk"}
                </small>
                <i className="amber">!</i>
              </article>
              <article>
                <span>Suggested order</span>
                <strong>{fmt.format(reorderUnits)}</strong>
                <small>Units to reach maximum</small>
                <i className="ink">↗</i>
              </article>
            </section>
            <section className="panel">
              <div className="toolbar">
                <div className="search">
                  ⌕
                  <input
                    aria-label="Search inventory"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search product or SKU"
                  />
                </div>
                <div className="filters">
                  {(["All", "Healthy", "Restock"] as const).map((x) => (
                    <button
                      className={filter === x ? "selected" : ""}
                      onClick={() => setFilter(x)}
                      key={x}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>In stock</th>
                      <th>Min / Max</th>
                      <th>Weekly use</th>
                      <th>Lead time</th>
                      <th>Suggested order</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="product">
                            <span>{p.name.slice(0, 2).toUpperCase()}</span>
                            <p>
                              <strong>{p.name}</strong>
                              <small>{p.sku}</small>
                            </p>
                          </div>
                        </td>
                        <td>
                          <strong>{fmt.format(stock(p))}</strong>{" "}
                          <small>units</small>
                        </td>
                        <td>
                          <div className="range">
                            <span>{fmt.format(minimum(p))}</span>
                            <div>
                              <i
                                style={{
                                  width: `${Math.max(0, Math.min(100, maximum(p) ? (stock(p) / maximum(p)) * 100 : 100))}%`,
                                }}
                              />
                            </div>
                            <span>{fmt.format(maximum(p))}</span>
                          </div>
                        </td>
                        <td>{fmt.format(p.weekly)}</td>
                        <td>{p.lead} days</td>
                        <td>
                          <strong>{fmt.format(suggestedOrder(p))}</strong>{" "}
                          <small>units</small>
                        </td>
                        <td>
                          <span className={`badge ${status(p).toLowerCase()}`}>
                            ● {status(p)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="more"
                            aria-label={`Edit ${p.name}`}
                            onClick={() => {
                              setEditing(p);
                              setModal("product");
                            }}
                          >
                            •••
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visible.length && (
                  <div className="empty">No products match this view.</div>
                )}
              </div>
              <footer>
                Showing {visible.length} of {products.length} products{" "}
                <span>Thresholds use a five-day work week</span>
              </footer>
            </section>
          </>
        ) : view === "labels" ? (
          <section className="panel labels-panel">
            <div className="labels-head">
              <div>
                <h2>USPS shipping labels</h2>
                <p>Berberine, Detox Tea, and Slim Boost orders only.</p>
              </div>
              <div className="label-controls">
                <label>
                  Order date
                  <input
                    type="date"
                    value={orderDate}
                    max={new Intl.DateTimeFormat("en-CA", {
                      timeZone: "America/New_York",
                    }).format(new Date())}
                    onChange={(event) => setOrderDate(event.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  onClick={() => void loadOrders()}
                  disabled={ordersLoading}
                >
                  {ordersLoading ? "Working…" : "Fetch orders"}
                </button>
              </div>
            </div>
            {ordersError && <div className="labels-error">{ordersError}</div>}
            {(ordersLoading || loadProgress > 0) && (
              <div className="label-progress-wrap" aria-live="polite">
                <div className="label-progress-copy">
                  <strong>{loadStage}</strong>
                  <span>
                    {ordersLoading
                      ? `${loadSeconds.toFixed(1)}s elapsed${loadEta ? ` · ${loadEta}` : ""}`
                      : `Completed in ${loadSeconds.toFixed(1)}s`}
                  </span>
                </div>
                <div
                  className="label-progress"
                  role="progressbar"
                  aria-valuenow={loadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <i style={{ width: `${loadProgress}%` }} />
                </div>
              </div>
            )}
            {!orders.length && !ordersLoading ? (
              <div className="labels-empty">
                <span>▤</span>
                <h2>No orders loaded</h2>
                <p>
                  {loadProgress === 100
                    ? "No Berberine, Detox Tea, or Slim Boost orders were found for this date."
                    : "Choose a date and fetch eligible Shopify orders."}
                </p>
              </div>
            ) : (
              <div className="label-book">
                <div className="label-book-nav">
                  <div
                    className="label-tabs"
                    role="tablist"
                    aria-label="Order sources"
                  >
                    <button
                      role="tab"
                      aria-selected={labelTab === "tiktok"}
                      className={labelTab === "tiktok" ? "active" : ""}
                      onClick={() => setLabelTab("tiktok")}
                    >
                      TikTok <span>{tikTokOrders.length}</span>
                    </button>
                    <button
                      role="tab"
                      aria-selected={labelTab === "other"}
                      className={labelTab === "other" ? "active" : ""}
                      onClick={() => setLabelTab("other")}
                    >
                      Other sources <span>{otherOrders.length}</span>
                    </button>
                  </div>
                  <button
                    className="primary"
                    onClick={() => exportLabels(labelTab)}
                    disabled={!selectedVisibleLabels}
                  >
                    Export {labelTab === "tiktok" ? "TikTok" : "Other sources"}{" "}
                    CSV
                    {selectedVisibleLabels ? ` (${selectedVisibleLabels})` : ""}
                  </button>
                </div>
                <div className="label-page" role="tabpanel">
                  {renderOrderTable(
                    labelTab === "tiktok"
                      ? "TikTok orders"
                      : "Other source orders",
                    visibleLabelOrders,
                  ) || (
                    <div className="labels-empty compact">
                      <h2>
                        No {labelTab === "tiktok" ? "TikTok" : "other source"}{" "}
                        orders
                      </h2>
                      <p>
                        No eligible orders from this source were found for the
                        selected date.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="panel activity-panel">
            <div className="activity-head">
              <div>
                <h2>Movement log</h2>
                <p>Newest transactions appear first.</p>
              </div>
              <div className="actions">
                <button
                  className="secondary"
                  onClick={() => setModal("movement")}
                >
                  ＋ New movement
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    setSaleProductId(products[0]?.id || "");
                    setModal("sale");
                  }}
                >
                  − Record sale
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Reference / note</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const p = products.find((x) => x.id === m.productId);
                    return (
                      <tr key={m.id}>
                        <td>
                          {new Date(m.date + "T00:00:00").toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </td>
                        <td>
                          <strong>{p?.name || "Unknown product"}</strong>
                          <small className="block">{p?.sku}</small>
                        </td>
                        <td>
                          <span className={`move ${m.type.toLowerCase()}`}>
                            {m.type === "Receipt" ? "↓" : "↑"} {m.type}
                          </span>
                        </td>
                        <td>
                          <strong>{fmt.format(m.quantity)}</strong>
                        </td>
                        <td>{m.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
      {modal && (
        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setModal(null);
              setEditing(null);
            }
          }}
        >
          <div className="modal">
            <button
              className="close"
              onClick={() => {
                setModal(null);
                setEditing(null);
              }}
            >
              ×
            </button>
            {modal === "product" ? (
              <>
                <p className="eyebrow">PRODUCT DETAILS</p>
                <h2>{editing ? "Edit product" : "Add a product"}</h2>
                <p className="modal-copy">
                  Set the stock drivers used to calculate its reorder point.
                </p>
                <form onSubmit={saveProduct}>
                  <label>
                    Product name
                    <input name="name" required defaultValue={editing?.name} />
                  </label>
                  <label>
                    SKU / code
                    <input name="sku" required defaultValue={editing?.sku} />
                  </label>
                  <div className="form-row">
                    <label>
                      Opening stock
                      <input
                        name="opening"
                        type="number"
                        min="0"
                        required
                        defaultValue={editing?.opening || 0}
                      />
                    </label>
                    <label>
                      Weekly usage
                      <input
                        name="weekly"
                        type="number"
                        min="0"
                        required
                        defaultValue={editing?.weekly || 0}
                      />
                    </label>
                  </div>
                  {editing && (
                    <label>
                      Current quantity
                      <input
                        name="currentQuantity"
                        type="number"
                        min="0"
                        required
                        defaultValue={stock(editing)}
                      />
                      <span className="field-help">
                        Change this to adjust the displayed in-stock quantity.
                      </span>
                    </label>
                  )}
                  <label>
                    Supplier lead time (days)
                    <input
                      name="lead"
                      type="number"
                      min="0"
                      required
                      defaultValue={editing?.lead || 0}
                    />
                  </label>
                  <button className="primary full">
                    {editing ? "Save changes" : "Add product"}
                  </button>
                </form>
              </>
            ) : modal === "sale" ? (
              <>
                <p className="eyebrow">OUTGOING STOCK</p>
                <h2>Record a sale</h2>
                <p className="modal-copy">
                  Choose a product and quantity. Saving the sale subtracts it
                  from inventory.
                </p>
                <form onSubmit={saveSale}>
                  <label>
                    Product
                    <select
                      name="product"
                      required
                      value={saleProductId}
                      onChange={(e) => setSaleProductId(e.target.value)}
                    >
                      {products
                        .filter((p) => stock(p) > 0)
                        .map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name} · {fmt.format(stock(p))} available
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Quantity sold
                    <input
                      name="quantity"
                      type="number"
                      min="1"
                      max={stock(
                        products.find((p) => p.id === saleProductId) ||
                          products[0],
                      )}
                      required
                      placeholder="Enter units sold"
                    />
                    <span className="field-help">
                      {fmt.format(
                        stock(
                          products.find((p) => p.id === saleProductId) ||
                            products[0],
                        ),
                      )}{" "}
                      units currently available
                    </span>
                  </label>
                  <label>
                    Date
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                  <label>
                    Order reference or note
                    <input
                      name="note"
                      placeholder="e.g. Order #1042 or TikTok sales"
                    />
                  </label>
                  <button className="primary full">
                    Save sale and subtract stock
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="eyebrow">STOCK MOVEMENT</p>
                <h2>Record movement</h2>
                <p className="modal-copy">
                  Receipts add stock. Shipments subtract stock.
                </p>
                <form onSubmit={saveMovement}>
                  <label>
                    Product
                    <select name="product" required>
                      {products.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name} · {p.sku}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-row">
                    <label>
                      Type
                      <select name="type">
                        <option>Receipt</option>
                        <option>Shipment</option>
                      </select>
                    </label>
                    <label>
                      Quantity
                      <input name="quantity" type="number" min="1" required />
                    </label>
                  </div>
                  <label>
                    Date
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                  <label>
                    Reference or note
                    <input
                      name="note"
                      placeholder="e.g. Supplier receipt #1042"
                    />
                  </label>
                  <button className="primary full">Save movement</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

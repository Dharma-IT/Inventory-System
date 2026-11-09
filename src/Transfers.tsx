import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { database } from "./supabase";
import type { LocationProduct, ProductRecord } from "./supabase";

type Location = "storage" | "clinic";
export default function Transfers({ onChange, catalog, onAddProduct }: {
  onChange: () => Promise<void>;
  catalog: ProductRecord[];
  onAddProduct: () => void;
}) {
  const [products, setProducts] = useState<LocationProduct[]>([]);
  const [location, setLocation] = useState<Location>("storage");
  const [modal, setModal] = useState<"stock" | "transfer" | "increase" | "edit" | "delete" | null>(null);
  const [stockQuery, setStockQuery] = useState("");
  const [stockProductId, setStockProductId] = useState("");
  const [selected, setSelected] = useState<LocationProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const destination = location === "storage" ? "clinic" : "storage";
  const title = (value: Location) => value === "storage" ? "Storage" : "Clinic";
  useEffect(() => {
    database.locationProducts().then(setProducts).catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load products.")).finally(() => setLoading(false));
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const quantity = modal === "delete" ? 0 : Number(data.get("quantity"));

    if (!Number.isSafeInteger(quantity) || quantity < (modal === "edit" || modal === "delete" ? 0 : 1)) {
      setError("Enter a valid whole-number quantity."); return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      if (modal === "stock") await database.addLocationStock(stockProductId, quantity, location);
      else if (modal === "increase" || modal === "edit" || modal === "delete") {
        if (!selected) throw new Error("Select a product first.");
        await database.changeLocationProduct(selected.id, quantity, location, modal);
      }
      else await database.transferProduct(String(data.get("product")), quantity, location);
      setModal(null);
      setNotice("Saved successfully. Activity has been recorded.");
      setProducts(await database.locationProducts());
      await onChange();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save. Please refresh and try again."); }
    finally { setSaving(false); }
  }
  function openRow(action: "increase" | "edit" | "delete", product: LocationProduct) {
    setSelected(product); setError(""); setNotice(""); setModal(action);
  }
  const stockOptions = catalog.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(stockQuery.toLowerCase()));
  const available = products.filter((p) => p[location] > 0);
  return <section className="panel activity-panel">
    <div className="activity-head">
      <div className="actions" role="group" aria-label="Stock location">
        {(["storage", "clinic"] as const).map((value) => <button key={value} className={location === value ? "primary" : "secondary"} aria-pressed={location === value} onClick={() => setLocation(value)}>{title(value)}</button>)}
      </div>
      <div className="actions">
        <button className="secondary" disabled={loading || !!error || !available.length} onClick={() => { setNotice(""); setModal("transfer"); }}>Transfer to {title(destination)}</button>
        <button className="secondary" disabled={loading} onClick={onAddProduct}>+ Add product</button>
        <button className="primary" disabled={loading || !catalog.length} onClick={() => { setError(""); setNotice(""); setStockQuery(""); setStockProductId(catalog[0]?.id || ""); setModal("stock"); }}>+ Add stock</button>
      </div>
    </div>
    {error && <div className="database-error" role="alert">{error}</div>}
    {notice && <p role="status">{notice}</p>}
    <div className="table-wrap"><table><thead><tr><th>Product name</th><th>Quantity</th><th>Actions</th></tr></thead><tbody>
      {products.map((p) => <tr key={p.id}><td><strong>{p.name}</strong></td><td>{p[location].toLocaleString()}</td><td><div className="actions">
        <button className="secondary" aria-label={`Add quantity to ${p.name}`} title="Add quantity" disabled={saving} onClick={() => openRow("increase", p)}>+</button>
        <button className="secondary" disabled={saving} onClick={() => openRow("edit", p)}>Edit</button>
        <button className="secondary" disabled={saving} onClick={() => openRow("delete", p)}>Delete</button>
      </div></td></tr>)}
      {!products.length && <tr><td colSpan={3}>{loading ? "Loading products..." : `No stock yet. Use Add stock to add products to ${title(location)} to get started.`}</td></tr>}
    </tbody></table></div>
    {modal && <div className="overlay"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
      <button className="close" aria-label="Close dialog" disabled={saving} onClick={() => setModal(null)}>&times;</button>
      <h2 id="transfer-title">{modal === "stock" ? `Add stock to ${title(location)}` : modal === "transfer" ? `${title(location)} to ${title(destination)}` : `${modal === "increase" ? "Add quantity" : modal === "edit" ? "Edit quantity" : "Delete product"}: ${selected?.name}`}</h2>
      {error && <p className="order-error" role="alert">{error}</p>}
      <form onSubmit={save}>
        {modal === "stock" ? <>
          <p className="modal-copy">Search for a product and enter the quantity received.</p>
          <label>Search product or SKU<input placeholder="Start typing a product name or SKU" value={stockQuery} autoFocus disabled={saving} onChange={(event) => {
            const query = event.target.value;
            setStockQuery(query);
            const matches = catalog.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()));
            if (!matches.some((p) => p.id === stockProductId)) setStockProductId(matches[0]?.id || "");
          }} /></label>
          <label>Product<select required value={stockProductId} disabled={saving || !stockOptions.length} onChange={(event) => setStockProductId(event.target.value)}>
            {!stockOptions.length && <option value="">No matching products</option>}
            {stockOptions.map((p) => <option key={p.id} value={p.id}>{p.name} / {p.sku} / {(products.find((item) => item.name.toLowerCase().trim() === p.name.toLowerCase().trim())?.[location] || 0).toLocaleString()} currently</option>)}
          </select></label>
        </> : modal === "transfer" ? <label>Product<select name="product" required disabled={saving}>{available.map((p) => <option key={p.id} value={p.id}>{p.name} ({p[location]} available)</option>)}</select></label> : <p>{modal === "delete" ? `Delete this product from both Storage (${selected?.storage}) and Clinic (${selected?.clinic})? Its activity history will be kept.` : `${title(location)} current quantity: ${selected?.[location]}`}</p>}
        {modal !== "delete" && <label>{modal === "increase" ? "Quantity to add" : modal === "edit" ? "New quantity" : "Quantity"}<input name="quantity" type="number" min={modal === "edit" ? 0 : 1} defaultValue={modal === "edit" ? selected?.[location] : undefined} max={2147483647} step="1" required disabled={saving} /></label>}
        <button className="primary full" disabled={saving || (modal === "stock" && !stockProductId)}>{saving ? "Saving..." : modal === "stock" ? "Add stock" : modal === "transfer" ? "Confirm transfer" : modal === "increase" ? "Add quantity" : modal === "edit" ? "Save quantity" : "Delete product"}</button>
      </form>
    </div></div>}
  </section>;
}

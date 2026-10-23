import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Product = { id: string; name: string; sku: string; opening: number; received: number; shipped: number; weekly: number; lead: number }
type Movement = { id: string; date: string; productId: string; type: 'Receipt' | 'Shipment'; quantity: number; note: string }

const seedRows: Array<[string, string, number, number, number, number, number]> = [
  ['ENV-001', 'White Envelopes', 149, 600, 134, 336, 3], ['ENV-002', 'Green Envelope', 0, 4930, 0, 0, 60], ['LAB-001', 'Label Roll', 200, 3000, 17, 67, 7], ['LAB-002', 'Label Pack', 750, 0, 61, 269, 3],
  ['GB-001', 'Gut Boost', 12, 0, 0, 0, 10], ['BB-001', 'Beauty Boost', 13, 0, 0, 0, 10], ['NAD-001', 'NAD+', 17, 0, 0, 0, 10], ['DN-001', 'Detox Now', 10, 0, 0, 0, 10],
  ['MV-001', 'Multi Vitamin', 12, 0, 0, 0, 10], ['OM-001', 'Omega-3', 10, 0, 0, 0, 10], ['GLP-001', 'GLP1 Support', 90, 0, 0, 0, 10], ['ACV-001', 'Apple Cider Vinegar', 9, 0, 0, 0, 10],
  ['FB-001', 'Fat Burner', 10, 0, 0, 0, 10], ['WPV-001', 'Whey Protein Vanilla', 6, 0, 0, 0, 10], ['WPC-001', 'Whey Protein Chocolate', 7, 0, 0, 0, 10], ['DT-001', 'Detox Tea', 6600, 0, 10, 14, 0],
  ['SB-001', 'Slim Boost', 901, 0, 1, 14, 60], ['BER-001', 'Berberine', 6139, 0, 132, 319, 28], ['BA-001', 'Bloat Away', 4, 0, 0, 0, 10], ['BF-001', 'Brain & Focus', 8, 0, 0, 0, 10],
  ['CPV-001', 'Collagen Peptides · Vanilla Creamer', 8, 0, 0, 0, 10], ['CPU-001', 'Collagen Peptides · Unflavored', 8, 0, 0, 0, 10], ['CPC-001', 'Collagen Peptides · Chocolate', 10, 0, 0, 0, 10],
  ['CM-001', 'Creatine Monohydrate', 7, 0, 0, 0, 10], ['ES-001', 'Energy Strips', 6, 0, 0, 0, 10], ['GC-001', 'Gentle Cleanse', 5, 0, 0, 0, 10], ['HLE-001', 'Hydraglow · Lemonade', 7, 0, 0, 0, 10],
  ['HLY-001', 'Hydraglow · Lychee', 8, 0, 0, 0, 10], ['HPF-001', 'Hydraglow · Passion Fruit', 8, 0, 0, 0, 10], ['HPM-001', 'Hydraglow · Peach Mango', 9, 0, 0, 0, 10], ['LMN-001', 'Love Me Now', 9, 0, 0, 0, 10],
  ['MG-001', 'Magnesium Glycinate', 4, 0, 0, 0, 10], ['PP-001', 'Plant Protein', 12, 0, 0, 0, 10], ['SF-001', 'Sleep Formula', 8, 0, 0, 0, 10], ['SS-001', 'Sleep Strips', 21, 0, 1, 0, 10], ['VD3-001', 'Vitamin D3', 8, 0, 0, 0, 10], ['VDK-001', 'Vitamin D3/K2', 8, 0, 0, 0, 10]
]
const seedProducts: Product[] = seedRows.map(([sku, name, opening, received, shipped, weekly, lead]) => ({ id: sku, name, sku, opening, received, shipped, weekly, lead }))
const seedMovements: Movement[] = [
  { id: '1', date: '2026-10-20', productId: 'ENV-001', type: 'Receipt', quantity: 600, note: 'Supplier receipt' },
  { id: '2', date: '2026-10-20', productId: 'ENV-001', type: 'Shipment', quantity: 56, note: 'Monday shipments' },
  { id: '3', date: '2026-11-15', productId: 'ENV-002', type: 'Receipt', quantity: 4930, note: 'Large receiving batch' },
  { id: '4', date: '2026-10-20', productId: 'LAB-001', type: 'Receipt', quantity: 3000, note: '250 × 12 rolls' },
  { id: '5', date: '2026-10-21', productId: 'BER-001', type: 'Shipment', quantity: 55, note: 'TikTok orders' },
]

const stock = (p: Product) => p.opening + p.received - p.shipped
const minimum = (p: Product) => Math.round((p.weekly / 5) * p.lead)
const maximum = (p: Product) => minimum(p) + p.weekly * 4
const status = (p: Product) => stock(p) < minimum(p) ? 'Restock' : minimum(p) > 0 && stock(p) <= minimum(p) * 1.25 ? 'Low' : 'Healthy'
const fmt = new Intl.NumberFormat('en-US')

function App() {
  const [products, setProducts] = useState<Product[]>(() => JSON.parse(localStorage.getItem('dharma-products') || 'null') || seedProducts)
  const [movements, setMovements] = useState<Movement[]>(() => JSON.parse(localStorage.getItem('dharma-movements') || 'null') || seedMovements)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'All' | 'Healthy' | 'Low' | 'Restock'>('All')
  const [modal, setModal] = useState<'product' | 'movement' | 'sale' | null>(null)
  const [saleProductId, setSaleProductId] = useState(seedProducts[0].id)
  const [editing, setEditing] = useState<Product | null>(null)
  const [view, setView] = useState<'inventory' | 'activity'>('inventory')

  const persistProducts = (next: Product[]) => { setProducts(next); localStorage.setItem('dharma-products', JSON.stringify(next)) }
  const persistMovements = (next: Movement[]) => { setMovements(next); localStorage.setItem('dharma-movements', JSON.stringify(next)) }
  const visible = useMemo(() => products.filter(p => (p.name + ' ' + p.sku).toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || status(p) === filter)), [products, query, filter])
  const healthy = products.filter(p => status(p) === 'Healthy').length
  const attention = products.length - healthy
  const total = products.reduce((n, p) => n + stock(p), 0)
  const reorderUnits = products.reduce((n, p) => n + (stock(p) < minimum(p) ? Math.max(0, maximum(p) - stock(p)) : 0), 0)

  function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget)
    const sku = String(data.get('sku')).trim(); const name = String(data.get('name')).trim()
    const next: Product = { id: editing?.id || `${sku}-${Date.now()}`, sku, name, opening: +String(data.get('opening')), received: editing?.received || 0, shipped: editing?.shipped || 0, weekly: +String(data.get('weekly')), lead: +String(data.get('lead')) }
    persistProducts(editing ? products.map(p => p.id === editing.id ? next : p) : [next, ...products]); setModal(null); setEditing(null)
  }
  function saveMovement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget); const productId = String(data.get('product')); const type = String(data.get('type')) as 'Receipt' | 'Shipment'; const quantity = +String(data.get('quantity'))
    persistProducts(products.map(p => p.id === productId ? { ...p, [type === 'Receipt' ? 'received' : 'shipped']: p[type === 'Receipt' ? 'received' : 'shipped'] + quantity } : p))
    persistMovements([{ id: crypto.randomUUID(), date: String(data.get('date')), productId, type, quantity, note: String(data.get('note')) }, ...movements]); setModal(null)
  }
  function saveSale(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget); const productId = String(data.get('product')); const quantity = +String(data.get('quantity')); const selected = products.find(p => p.id === productId)
    if (!selected || quantity < 1 || quantity > stock(selected)) return
    persistProducts(products.map(p => p.id === productId ? { ...p, shipped: p.shipped + quantity } : p))
    persistMovements([{ id: crypto.randomUUID(), date: String(data.get('date')), productId, type: 'Shipment', quantity, note: String(data.get('note')) || 'Sale' }, ...movements]); setModal(null)
  }

  return <div className="app-shell">
    <aside>
      <div className="brand"><img src="/Logo.png" alt="Dharma" /><div><strong>DHARMA</strong><span>Inventory</span></div></div>
      <nav><button className={view === 'inventory' ? 'active' : ''} onClick={() => setView('inventory')}><span>▦</span> Inventory</button><button className={view === 'activity' ? 'active' : ''} onClick={() => setView('activity')}><span>↕</span> Activity</button></nav>
      <div className="side-note"><span>Stock formula</span><strong>Opening + receipts − shipments</strong><p>Thresholds update instantly when usage or lead time changes.</p></div>
      <div className="user"><div>JD</div><p><strong>Inventory team</strong><span>Operations</span></p></div>
    </aside>
    <main>
      <header><div><p className="eyebrow">OPERATIONS / {view.toUpperCase()}</p><h1>{view === 'inventory' ? 'Inventory overview' : 'Stock activity'}</h1><p>{view === 'inventory' ? 'Know what is available and what needs action.' : 'Every receipt and shipment in one place.'}</p></div><div className="actions"><button className="secondary" onClick={() => setModal('movement')}>↕ Record movement</button><button className="secondary" onClick={() => { setEditing(null); setModal('product') }}>＋ Add product</button><button className="primary sale-button" onClick={() => { setSaleProductId(products[0]?.id || ''); setModal('sale') }}>− Record sale</button></div></header>
      {view === 'inventory' ? <>
        <section className="metrics">
          <article><span>Total units</span><strong>{fmt.format(total)}</strong><small>Across {products.length} products</small><i className="green">▦</i></article>
          <article><span>Healthy stock</span><strong>{healthy}</strong><small>{Math.round(healthy / products.length * 100)}% of catalog</small><i className="sage">✓</i></article>
          <article><span>Needs attention</span><strong>{attention}</strong><small>{attention ? 'Below or near minimum' : 'No products at risk'}</small><i className="amber">!</i></article>
          <article><span>Suggested order</span><strong>{fmt.format(reorderUnits)}</strong><small>Units to reach maximum</small><i className="ink">↗</i></article>
        </section>
        <section className="panel">
          <div className="toolbar"><div className="search">⌕<input aria-label="Search inventory" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search product or SKU" /></div><div className="filters">{(['All', 'Healthy', 'Low', 'Restock'] as const).map(x => <button className={filter === x ? 'selected' : ''} onClick={() => setFilter(x)} key={x}>{x}</button>)}</div></div>
          <div className="table-wrap"><table><thead><tr><th>Product</th><th>In stock</th><th>Min / Max</th><th>Weekly use</th><th>Lead time</th><th>Status</th><th></th></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td><div className="product"><span>{p.name.slice(0, 2).toUpperCase()}</span><p><strong>{p.name}</strong><small>{p.sku}</small></p></div></td><td><strong>{fmt.format(stock(p))}</strong> <small>units</small></td><td><div className="range"><span>{fmt.format(minimum(p))}</span><div><i style={{ width: `${Math.min(100, maximum(p) ? stock(p) / maximum(p) * 100 : 100)}%` }} /></div><span>{fmt.format(maximum(p))}</span></div></td><td>{fmt.format(p.weekly)}</td><td>{p.lead} days</td><td><span className={`badge ${status(p).toLowerCase()}`}>● {status(p)}</span></td><td><button className="more" aria-label={`Edit ${p.name}`} onClick={() => { setEditing(p); setModal('product') }}>•••</button></td></tr>)}</tbody></table>{!visible.length && <div className="empty">No products match this view.</div>}</div>
          <footer>Showing {visible.length} of {products.length} products <span>Thresholds use a five-day work week</span></footer>
        </section>
      </> : <section className="panel activity-panel"><div className="activity-head"><div><h2>Movement log</h2><p>Newest transactions appear first.</p></div><div className="actions"><button className="secondary" onClick={() => setModal('movement')}>＋ New movement</button><button className="primary" onClick={() => { setSaleProductId(products[0]?.id || ''); setModal('sale') }}>− Record sale</button></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Quantity</th><th>Reference / note</th></tr></thead><tbody>{movements.map(m => { const p = products.find(x => x.id === m.productId); return <tr key={m.id}><td>{new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><strong>{p?.name || 'Unknown product'}</strong><small className="block">{p?.sku}</small></td><td><span className={`move ${m.type.toLowerCase()}`}>{m.type === 'Receipt' ? '↓' : '↑'} {m.type}</span></td><td><strong>{fmt.format(m.quantity)}</strong></td><td>{m.note || '—'}</td></tr> })}</tbody></table></div></section>}
    </main>
    {modal && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) { setModal(null); setEditing(null) } }}><div className="modal">
      <button className="close" onClick={() => { setModal(null); setEditing(null) }}>×</button>
      {modal === 'product' ? <><p className="eyebrow">PRODUCT DETAILS</p><h2>{editing ? 'Edit product' : 'Add a product'}</h2><p className="modal-copy">Set the stock drivers used to calculate its reorder point.</p><form onSubmit={saveProduct}><label>Product name<input name="name" required defaultValue={editing?.name} /></label><label>SKU / code<input name="sku" required defaultValue={editing?.sku} /></label><div className="form-row"><label>Opening stock<input name="opening" type="number" min="0" required defaultValue={editing?.opening || 0} /></label><label>Weekly usage<input name="weekly" type="number" min="0" required defaultValue={editing?.weekly || 0} /></label></div><label>Supplier lead time (days)<input name="lead" type="number" min="0" required defaultValue={editing?.lead || 0} /></label><button className="primary full">{editing ? 'Save changes' : 'Add product'}</button></form></>
        : modal === 'sale' ? <><p className="eyebrow">OUTGOING STOCK</p><h2>Record a sale</h2><p className="modal-copy">Choose a product and quantity. Saving the sale subtracts it from inventory.</p><form onSubmit={saveSale}><label>Product<select name="product" required value={saleProductId} onChange={e => setSaleProductId(e.target.value)}>{products.filter(p => stock(p) > 0).map(p => <option value={p.id} key={p.id}>{p.name} · {fmt.format(stock(p))} available</option>)}</select></label><label>Quantity sold<input name="quantity" type="number" min="1" max={stock(products.find(p => p.id === saleProductId) || products[0])} required placeholder="Enter units sold" /><span className="field-help">{fmt.format(stock(products.find(p => p.id === saleProductId) || products[0]))} units currently available</span></label><label>Date<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Order reference or note<input name="note" placeholder="e.g. Order #1042 or TikTok sales" /></label><button className="primary full">Save sale and subtract stock</button></form></>
          : <><p className="eyebrow">STOCK MOVEMENT</p><h2>Record movement</h2><p className="modal-copy">Receipts add stock. Shipments subtract stock.</p><form onSubmit={saveMovement}><label>Product<select name="product" required>{products.map(p => <option value={p.id} key={p.id}>{p.name} · {p.sku}</option>)}</select></label><div className="form-row"><label>Type<select name="type"><option>Receipt</option><option>Shipment</option></select></label><label>Quantity<input name="quantity" type="number" min="1" required /></label></div><label>Date<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Reference or note<input name="note" placeholder="e.g. Supplier receipt #1042" /></label><button className="primary full">Save movement</button></form></>}
    </div></div>}
  </div>
}

export default App

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { api, tokenStore } from '../../app/api';
import Icon from '../../app/Icons';
import ProductArt from '../ProductArt';
import { rupees } from '../cart';
import { buildTree } from '../components';
import { TABS } from './PortalLayout';
import { Attention, BarList, CHART_COLORS as C, Donut, Kpi, LineChart, greeting, periodLabels } from './charts';

export const STATUS = {
  APPROVED: ['allow', 'Active'],
  SOLD_OUT: ['deny', 'Out of stock'],
  PENDING: ['warn', 'Awaiting approval'],
};
const PERIODS = [['day', 'Days'], ['week', 'Weeks'], ['month', 'Months'], ['year', 'Years']];

function Soon({ icon, title, text }) {
  return <div className="pt-empty ws-card"><Icon name={icon} /><h3>{title}</h3><p className="muted">{text}</p></div>;
}

function Seg({ value, onChange }) {
  return <div className="seg">{PERIODS.map(([k, l]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

/* =================== Shop insights =================== */
function SalesChart({ title, sub, money, sales, period, setPeriod }) {
  const labels = periodLabels(period);
  return (
    <section className="chart-card">
      <div className="chart-head">
        <div><h3>{title}</h3><p className="chart-sub">{sub}</p></div>
        <Seg value={period} onChange={setPeriod} />
      </div>
      <LineChart labels={labels} money={money} series={[{ label: title, values: labels.map(() => 0) }]}
        empty={!sales.available} emptyTitle="No sales yet" emptyText={sales.reason} />
    </section>
  );
}

function Insights({ stats }) {
  const [period, setPeriod] = useState('month');
  const [pid, setPid] = useState(stats.products[0] ? stats.products[0].id : null);
  const s = stats.statusCounts;
  const low = stats.products.filter((p) => p.stock <= stats.lowStockThreshold && p.status !== 'PENDING');
  const one = stats.products.find((p) => p.id === Number(pid));
  const byStock = [...stats.products].sort((a, b) => a.stock - b.stock);
  return (
    <>
      <div className="kpis">
        <Kpi icon="store" label="Active listings" value={s.APPROVED} note="visible in the store" />
        <Kpi icon="alert" label="Low stock" value={low.length} note={`${stats.lowStockThreshold} or fewer left`} tone={low.length ? 'warn' : ''} />
        <Kpi icon="box" label="Out of stock" value={s.SOLD_OUT} note="hidden from search" tone={s.SOLD_OUT ? 'warn' : ''} />
        <Kpi icon="wallet" label="Stock value" value={rupees(stats.stockValue)} note="price × units in stock" small />
      </div>

      <div className="charts">
        <section className="chart-card wide">
          <div className="chart-head">
            <div><h3>Needs your attention</h3><p className="chart-sub">Stock that is running out and listings still waiting for approval.</p></div>
            <Link className="bg-btn outline small" to="?tab=inventory">Open inventory<Icon name="arrow" /></Link>
          </div>
          <Attention clear="All stocked up. Nothing needs you right now." items={[
            ...[...stats.products].filter((p) => p.status !== 'PENDING' && p.stock <= stats.lowStockThreshold).sort((a, b) => a.stock - b.stock).map((p) => ({
              key: `s${p.id}`, tone: p.stock === 0 ? 'bad' : 'warn',
              title: p.stock === 0 ? `${p.name} is out of stock` : `${p.name}: only ${p.stock} left`,
              text: p.stock === 0 ? 'Hidden from search until you restock.' : `At or below your low-stock line of ${stats.lowStockThreshold}.`,
              to: '?tab=inventory', action: 'Restock',
            })),
            ...stats.products.filter((p) => p.status === 'PENDING').map((p) => ({
              key: `p${p.id}`, tone: 'info', title: `${p.name} is awaiting approval`, text: 'An admin checks new listings before customers see them.',
            })),
          ]} />
        </section>
        <SalesChart title="Products sold" sub="Units sold per period" sales={stats.sales} period={period} setPeriod={setPeriod} />
        <SalesChart title="Money made" sub="Revenue per period, in rupees" money sales={stats.sales} period={period} setPeriod={setPeriod} />

        <section className="chart-card">
          <h3>Stock per product</h3>
          <p className="chart-sub">Orange bars are at or below the low-stock line ({stats.lowStockThreshold}).</p>
          <BarList rows={byStock.map((p) => ({ key: p.id, label: p.name, value: p.stock }))} threshold={stats.lowStockThreshold} thresholdLabel={`low stock ≤ ${stats.lowStockThreshold}`} />
        </section>
        <section className="chart-card">
          <h3>Listings by status</h3>
          <p className="chart-sub">New listings wait for admin approval before customers see them.</p>
          <Donut parts={[
            { label: 'Active', value: s.APPROVED, color: C.brown },
            { label: 'Out of stock', value: s.SOLD_OUT, color: C.warn },
            { label: 'Awaiting approval', value: s.PENDING, color: C.tanSoft },
          ]} />
        </section>
        <section className="chart-card">
          <h3>Products per category</h3>
          <p className="chart-sub">A product can sit in several categories, so these can add up to more than your listing count.</p>
          <BarList rows={stats.categoryMix.map((c) => ({ key: c.slug, label: c.parentId ? `  ${c.name}` : c.name, value: c.n }))} color={C.tan} />
        </section>
        <section className="chart-card">
          <h3>Best sellers</h3>
          <p className="chart-sub">Your top products by units sold.</p>
          <div className="chart chart-empty" style={{ minHeight: 170 }}>
            <BarList rows={stats.products.slice(0, 5).map((p) => ({ key: p.id, label: p.name, value: 0 }))} />
            <div className="empty-note"><b>No sales yet</b><span>{stats.sales.reason}</span></div>
          </div>
        </section>

        <section className="chart-card wide">
          <div className="chart-head">
            <div><h3>One product up close</h3><p className="chart-sub">Units sold and revenue for a single product.</p></div>
            <div className="row-actions">
              <select value={pid || ''} onChange={(e) => setPid(e.target.value)} aria-label="Choose a product">
                {stats.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Seg value={period} onChange={setPeriod} />
            </div>
          </div>
          {one && (
            <div className="one-prod">
              <div className="one-prod-card">
                <ProductArt image={one.image} imageUrl={one.imageUrl} label={one.name} />
                <dl>
                  <dt>Price</dt><dd>{rupees(one.price)}</dd>
                  <dt>In stock</dt><dd className={one.stock <= stats.lowStockThreshold ? 'warn' : ''}>{one.stock}</dd>
                  <dt>Status</dt><dd>{STATUS[one.status][1]}</dd>
                  <dt>Featured</dt><dd>{one.featured ? 'Yes' : 'No'}</dd>
                </dl>
              </div>
              <div className="one-prod-charts">
                <LineChart labels={periodLabels(period)} series={[{ label: 'Units', values: periodLabels(period).map(() => 0) }]} empty={!stats.sales.available} emptyTitle="Units sold: none yet" emptyText="This product's sales per period will show here." />
                <LineChart labels={periodLabels(period)} money series={[{ label: 'Revenue', values: periodLabels(period).map(() => 0) }]} empty={!stats.sales.available} emptyTitle="Revenue: none yet" emptyText="Money made from just this product." />
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/* =================== Inventory =================== */
function CategoryPicker({ tree, value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="cat-picker">
      {tree.map((c) => (
        <span key={c.id} style={{ display: 'contents' }}>
          <label><input type="checkbox" checked={value.includes(c.id)} onChange={() => toggle(c.id)} />{c.name}</label>
          {c.children.map((k) => <label key={k.id} className="sub"><input type="checkbox" checked={value.includes(k.id)} onChange={() => toggle(k.id)} />{c.name} › {k.name}</label>)}
        </span>
      ))}
    </div>
  );
}

function Row({ p, cats, tree, onSaved }) {
  const [price, setPrice] = useState(String(p.price));
  const [stock, setStock] = useState(String(p.stock));
  const [state, setState] = useState(null);
  const [open, setOpen] = useState(false);
  const idsOf = (prod) => cats.filter((c) => prod.categories.includes(c.slug)).map((c) => c.id);
  const [catIds, setCatIds] = useState(idsOf(p));
  useEffect(() => { setCatIds(idsOf(p)); }, [p, cats]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = Number(price) !== p.price || Number(stock) !== p.stock;
  const catDirty = [...catIds].sort().join() !== idsOf(p).sort().join();

  async function run(fn, ok) {
    setState({ busy: true });
    try { const { product } = await fn(); onSaved(product); setState({ ok }); } catch (e) {
      setState({ err: e.details ? Object.entries(e.details).map(([k, v]) => `${k} ${v}`).join(', ') : e.message });
    }
  }
  const save = () => run(() => api(`/catalog/products/${p.id}`, { method: 'PATCH', body: { price: Number(price), stock: Number(stock) } }), 'Saved');
  const saveCats = () => run(() => api(`/seller/products/${p.id}/categories`, { method: 'PUT', body: { categoryIds: catIds } }), 'Categories saved');
  const feature = () => run(() => api(`/seller/products/${p.id}/featured`, { method: 'PUT', body: { featured: !p.featured } }), p.featured ? 'Removed from featured' : 'Featured');
  const [cls, label] = STATUS[p.status];
  return (
    <>
      <tr>
        <td><div className="inv-prod"><ProductArt image={p.image} imageUrl={p.imageUrl} category={p.category} /><div><Link to={`/p/${p.id}`}>{p.name}</Link><span>{p.categoryNames.join(' · ') || 'No category'} · ID {p.id}</span></div></div></td>
        <td><span className={`badge dot ${cls}`}>{label}</span></td>
        <td><div className="inv-in"><span>₹</span><input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`Price of ${p.name}`} /></div></td>
        <td><input className="inv-qty" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} aria-label={`Stock of ${p.name}`} /></td>
        <td className="right">
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button className={`btn small ${p.featured ? 'primary' : ''}`} onClick={feature} title="Show first on your shop page">{p.featured ? '★ Featured' : '☆ Feature'}</button>
            <button className="btn small" onClick={() => setOpen(!open)} aria-expanded={open}>Categories</button>
            <button className="btn small primary" disabled={!dirty || (state && state.busy)} onClick={save}>Save</button>
          </div>
          {state && state.ok && <span className="inv-msg ok"><Icon name="check" />{state.ok}</span>}
          {state && state.err && <span className="inv-msg err">{state.err}</span>}
        </td>
      </tr>
      {open && (
        <tr className="inv-cats">
          <td colSpan="5">
            <p className="small muted" style={{ margin: '0 0 8px' }}>Tick every category this product belongs to (a phone case can be in Electronics and Mobile accessories). Categories are created by the admin team.</p>
            <CategoryPicker tree={tree} value={catIds} onChange={setCatIds} />
            <div className="row-actions" style={{ marginTop: 10 }}>
              <button className="btn small primary" disabled={!catDirty || !catIds.length} onClick={saveCats}>Save categories</button>
              {!catIds.length && <span className="small" style={{ color: 'var(--deny)' }}>Pick at least one category.</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Calls PATCH on another seller's product: E1 must answer 403 NOT_OWNER. */
function OwnershipCheck({ myId }) {
  const [res, setRes] = useState(null);
  async function run() {
    setRes({ busy: true });
    const { products } = await api('/catalog/products?limit=60', { auth: false });
    const other = products.find((x) => x.sellerId !== myId);
    if (!other) return setRes({ text: 'No product from another seller to test with.' });
    try {
      await api(`/catalog/products/${other.id}`, { method: 'PATCH', body: { price: other.price } });
      setRes({ bad: true, text: `Unexpected: the server allowed editing "${other.name}".` });
    } catch (e) {
      setRes({ code: e.status, text: `${e.status} ${e.code}: ${e.message}`, name: other.name, seller: other.sellerName });
    }
  }
  return (
    <section className="ws-card">
      <div className="chart-head">
        <div><h2>Ownership check</h2><p className="muted small">Try to change the price of a product listed by another seller. The server should refuse.</p></div>
        <button className="btn small" onClick={run} disabled={res && res.busy}><Icon name="play" />Run check</button>
      </div>
      {res && !res.busy && (
        <div className={`alert ${res.code === 403 ? 'ok' : 'error'}`}>
          <Icon name={res.code === 403 ? 'check' : 'alert'} />
          <span>{res.name && <>Tried "{res.name}" (seller: {res.seller}). </>}Server answered <b>{res.text}</b></span>
        </div>
      )}
    </section>
  );
}

function NewProductCard({ cats, tree, onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [stock, setStock] = useState('10');
  const [catIds, setCatIds] = useState([]);
  const [image, setImage] = useState('vase');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleImageFile(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPG or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await fetch('/api/seller/products/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': file.type, Authorization: `Bearer ${tokenStore.get()}` },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Upload failed (${res.status})`);
      setImageUrl(data.imageUrl);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || name.trim().length < 2) {
      setError('Enter a product name (at least 2 characters).');
      return;
    }
    const numPrice = Number(price);
    if (!price || isNaN(numPrice) || numPrice < 0) {
      setError('Enter a valid selling price.');
      return;
    }
    const numMrp = mrp ? Number(mrp) : numPrice;
    if (isNaN(numMrp) || numMrp < numPrice) {
      setError('MRP must be at least the selling price.');
      return;
    }
    const numStock = Number(stock);
    if (isNaN(numStock) || numStock < 0) {
      setError('Enter a valid stock number.');
      return;
    }
    if (!catIds.length) {
      setError('Pick at least one category.');
      return;
    }

    setBusy(true);
    try {
      const data = await api('/seller/products', {
        method: 'POST',
        body: {
          name: name.trim(),
          description: description.trim(),
          price: numPrice,
          mrp: numMrp,
          stock: Math.floor(numStock),
          image,
          imageUrl: imageUrl || null,
          categoryIds: catIds,
        },
      });
      onCreated(data.product);
    } catch (e) {
      setError(e.details ? Object.entries(e.details).map(([k, v]) => `${k} ${v}`).join(', ') : e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ws-card" style={{ marginBottom: '24px', borderColor: 'var(--line-2)' }}>
      <div className="chart-head" style={{ marginBottom: '16px' }}>
        <div>
          <h2>Add new product to your shop</h2>
          <p className="muted small">List a handcrafted item with photo, pricing, inventory stock, and categories.</p>
        </div>
        <button type="button" className="btn small" onClick={onCancel}><Icon name="x" />Cancel</button>
      </div>

      {error && (
        <div className="alert error" style={{ marginBottom: '16px' }}>
          <Icon name="alert" /><span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div>
            <label className="field-label" htmlFor="np-name">Product Name *</label>
            <input
              id="np-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stoneware Ceramic Mug"
              required
              autoFocus
            />

            <label className="field-label" htmlFor="np-desc" style={{ marginTop: '12px' }}>Description</label>
            <textarea
              id="np-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details on material, size, care, or crafting technique..."
              maxLength={400}
              style={{ minHeight: '80px' }}
            />
            <small className="muted" style={{ display: 'block', fontSize: '11px', textAlign: 'right' }}>{description.length}/400</small>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <div>
                <label className="field-label" htmlFor="np-price">Selling Price (₹) *</label>
                <input
                  id="np-price"
                  type="number"
                  min="0"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 1499"
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="np-mrp">MRP / List (₹)</label>
                <input
                  id="np-mrp"
                  type="number"
                  min="0"
                  step="1"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder={price ? `e.g. ${Math.round(Number(price) * 1.2)}` : 'e.g. 1999'}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="np-stock">Stock Quantity *</label>
                <input
                  id="np-stock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label className="field-label">Categories * (Select 1 to 8)</label>
              <CategoryPicker tree={tree} value={catIds} onChange={setCatIds} />
            </div>
          </div>

          <div>
            <label className="field-label">Product Photo</label>
            <div className="img-pick" style={{ marginTop: '4px', background: '#F8F6F1', padding: '14px', borderRadius: '10px' }}>
              <div
                className="img-prev"
                style={{
                  width: '100%',
                  height: '180px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#EDE6DE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <ProductArt image={image} label={name || 'Preview'} />
                )}
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <label className={`btn small primary ${uploading ? 'disabled' : ''}`}>
                  <Icon name="edit" />{uploading ? 'Uploading…' : imageUrl ? 'Replace photo' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    disabled={uploading}
                    onChange={(e) => handleImageFile(e.target.files[0])}
                  />
                </label>
                {imageUrl && (
                  <button type="button" className="btn small" onClick={() => setImageUrl('')}>
                    Remove
                  </button>
                )}
              </div>
              <small className="muted" style={{ display: 'block', marginTop: '6px', fontSize: '11.5px' }}>
                PNG, JPG or WebP (up to 5 MB).
              </small>

              <label className="field-label" style={{ marginTop: '16px' }}>Fallback Illustration</label>
              <select value={image} onChange={(e) => setImage(e.target.value)} style={{ width: '100%' }}>
                <option value="vase">Vase / Pottery</option>
                <option value="bowl">Bowl / Dish</option>
                <option value="candle">Candle</option>
                <option value="chair">Chair / Furniture</option>
                <option value="lamp">Lamp / Lighting</option>
                <option value="speaker">Speaker / Audio</option>
                <option value="headphones">Headphones</option>
                <option value="sleeve">Case / Sleeve</option>
                <option value="bottle">Bottle / Skincare</option>
                <option value="baguette">Baguette / Bakery</option>
                <option value="book">Book / Notebook</option>
              </select>
            </div>
          </div>
        </div>

        <div className="row-actions" style={{ marginTop: '20px', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || uploading}>
            {busy ? 'Publishing…' : 'Publish Product'}
          </button>
        </div>
      </form>
    </section>
  );
}

function Inventory({ products, setProducts, cats, me }) {
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const tree = useMemo(() => buildTree(cats), [cats]);
  const shown = (products || []).filter((p) => `${p.name} ${p.categoryNames.join(' ')} ${p.status}`.toLowerCase().includes(filter.toLowerCase()));
  const saved = (np) => setProducts((list) => list.map((x) => (x.id === np.id ? np : x)));
  return (
    <>
      <div className="ws-head">
        <div><h1>Product inventory</h1><p>{products ? `${products.length} listing${products.length === 1 ? '' : 's'}` : 'loading…'} · prices, stock, categories and featured picks</p></div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="pt-search"><Icon name="search" /><input placeholder="Search your listings" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
          <button className="btn primary" onClick={() => setAdding(!adding)} style={{ whiteSpace: 'nowrap' }}>
            <Icon name={adding ? 'x' : 'plus'} />{adding ? 'Cancel' : 'Upload product'}
          </button>
        </div>
      </div>
      {adding && (
        <NewProductCard
          cats={cats}
          tree={tree}
          onCreated={(newP) => {
            setProducts((list) => [newP, ...(list || [])]);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      <section className="ws-card flush" style={{ padding: 0 }}>
        <table className="table inv">
          <thead><tr><th>Product</th><th>Status</th><th>Price</th><th>Available</th><th /></tr></thead>
          <tbody>
            {shown.map((p) => <Row key={p.id} p={p} cats={cats} tree={tree} onSaved={saved} />)}
            {products && !shown.length && <tr><td colSpan="5" className="empty">No listings match.</td></tr>}
          </tbody>
        </table>
      </section>
      <p className="muted small">Setting stock to 0 marks a listing <b>Out of stock</b> and hides it from search; restocking makes it active again. New listings wait for admin approval.</p>
      <OwnershipCheck myId={me.user.id} />
    </>
  );
}

/* =================== My shop =================== */
function ImagePick({ kind, url, onUploaded, disabled }) {
  const [state, setState] = useState(null);
  async function upload(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setState({ err: 'Choose a PNG, JPG or WebP image.' }); return; }
    if (file.size > 2 * 1024 * 1024) { setState({ err: 'That image is over 2 MB. Choose a smaller one.' }); return; }
    setState({ busy: true });
    try {
      const res = await fetch(`/api/seller/shop/${kind}`, { method: 'POST', headers: { 'Content-Type': file.type, Authorization: `Bearer ${tokenStore.get()}` }, body: file });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Upload failed (${res.status})`);
      onUploaded(data.shop); setState({ ok: 'Uploaded' });
    } catch (e) { setState({ err: e.message }); }
  }
  return (
    <div className="img-pick">
      <span className="field-label">{kind === 'logo' ? 'Logo' : 'Banner'}</span>
      <div className={`img-prev ${kind}`}>{url ? <img src={url} alt="" /> : <span>{kind === 'logo' ? 'No logo yet' : 'No banner yet (4:1 works best)'}</span>}</div>
      <label className={`btn small ${disabled ? 'disabled' : ''}`} style={{ alignSelf: 'flex-start' }}>
        <Icon name="edit" />{url ? 'Replace' : 'Upload'} {kind}
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={disabled} onChange={(e) => upload(e.target.files[0])} />
      </label>
      {state && state.busy && <span className="small muted">Uploading…</span>}
      {state && state.ok && <span className="inv-msg ok"><Icon name="check" />{state.ok}</span>}
      {state && state.err && <span className="inv-msg err">{state.err}</span>}
    </div>
  );
}

function MyShop({ products, setProducts }) {
  const [shop, setShop] = useState(undefined);
  const [form, setForm] = useState({ name: '', slug: '', about: '', returnPolicy: '' });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    api('/seller/shop').then(({ shop: sh }) => {
      setShop(sh);
      if (sh) setForm({ name: sh.name, slug: sh.slug, about: sh.about, returnPolicy: sh.returnPolicy });
    }).catch((e) => setMsg({ err: e.message }));
  }, []);
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setErrors({ ...errors, [k]: null }); };
  async function save(e) {
    e.preventDefault(); setMsg(null);
    try { const { shop: sh } = await api('/seller/shop', { method: 'PUT', body: form }); setShop(sh); setMsg({ ok: 'Shop saved. Your public page is up to date.' }); } catch (ex) {
      if (ex.details) setErrors(ex.details); setMsg({ err: ex.message });
    }
  }
  async function toggleFeatured(p) {
    try { const { product } = await api(`/seller/products/${p.id}/featured`, { method: 'PUT', body: { featured: !p.featured } }); setProducts((l) => l.map((x) => (x.id === product.id ? product : x))); } catch (ex) { setMsg({ err: ex.message }); }
  }
  if (shop === undefined) return <div className="ws-card muted">Loading your shop…</div>;
  return (
    <>
      <div className="ws-head">
        <div><h1>My shop</h1><p>What customers see on your shop page.</p></div>
        {shop && <Link className="bg-btn dark small" to={`/shop/${shop.slug}`}>View my shop page<Icon name="arrow" /></Link>}
      </div>
      <form className="ws-card" onSubmit={save} noValidate>
        <h2>Shop details</h2>
        <p className="muted">Name, web address, a short description and your return policy.</p>
        <div className="form-grid">
          <label className="field"><span>Shop name</span><input value={form.name} onChange={set('name')} className={errors.name ? 'bad' : ''} /><small className="field-error-txt">{errors.name}</small></label>
          <label className="field"><span>Web address</span><div className="inv-in" style={{ width: '100%' }}><span>/shop/</span><input value={form.slug} onChange={set('slug')} className={errors.slug ? 'bad' : ''} /></div><small className="field-error-txt">{errors.slug}</small></label>
          <label className="field full"><span>About your shop</span><textarea value={form.about} onChange={set('about')} maxLength={600} /><small className="muted">{form.about.length}/600</small></label>
          <label className="field full"><span>Return policy</span><textarea value={form.returnPolicy} onChange={set('returnPolicy')} maxLength={1000} /><small className="muted">{form.returnPolicy.length}/1000</small></label>
        </div>
        <div className="row-actions" style={{ marginTop: 14 }}>
          <button className="btn primary">Save shop details</button>
          {msg && msg.ok && <span className="inv-msg ok"><Icon name="check" />{msg.ok}</span>}
          {msg && msg.err && <span className="inv-msg err">{msg.err}</span>}
        </div>
      </form>
      <section className="ws-card">
        <h2>Logo and banner</h2>
        <p className="muted">PNG, JPG or WebP, up to 2 MB each.{!shop && ' Save your shop details first.'}</p>
        <div className="form-grid" style={{ gridTemplateColumns: '180px 1fr' }}>
          <ImagePick kind="logo" url={shop && shop.logoUrl} onUploaded={setShop} disabled={!shop} />
          <ImagePick kind="banner" url={shop && shop.bannerUrl} onUploaded={setShop} disabled={!shop} />
        </div>
      </section>
      <section className="ws-card">
        <h2>Featured products</h2>
        <p className="muted">Click to choose which products show first on your shop page and in the homepage "Curated pieces" band.</p>
        <div className="featured-grid">
          {(products || []).filter((p) => p.status !== 'PENDING').map((p) => (
            <button type="button" key={p.id} className={`feat ${p.featured ? 'on' : ''}`} onClick={() => toggleFeatured(p)} aria-pressed={p.featured}>
              <span className="tick"><Icon name="check" /></span>
              <ProductArt image={p.image} imageUrl={p.imageUrl} label={p.name} />
              <b>{p.name}</b>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

/* =================== page =================== */
export default function SellerHome() {
  const { me } = useAuth();
  const [params] = useSearchParams();
  const tab = params.get('tab') || TABS.seller[0].id;
  const [products, setProducts] = useState(null);
  const [cats, setCats] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/seller/products').then((d) => setProducts(d.products)).catch((e) => { setError(e.message); setProducts([]); });
    api('/catalog/categories', { auth: false }).then((d) => setCats(d.categories)).catch(() => {});
  }, []);
  useEffect(() => { if (tab === 'overview') api('/seller/stats').then(setStats).catch((e) => setError(e.message)); }, [tab, products]);

  if (tab === 'orders') return <Soon icon="box" title="No orders yet" text="Orders for your products appear here once checkout is built (E2 order service)." />;
  if (tab === 'payments') return <Soon icon="wallet" title="No payments yet" text="Settlements for your orders will be listed here after the payment service is built (E2)." />;

  return (
    <>
      {error && <div className="alert error"><Icon name="alert" />{error}</div>}
      {tab === 'overview' && (
        <>
          <div className="ws-head">
            <div><span className="ws-hello">{greeting().part}, {me.user.name}</span><h1>Shop insights</h1><p>{greeting().date} · how your catalog is doing</p></div>
            <div className="row-actions"><Link className="bg-btn outline small" to="?tab=shop">My shop<Icon name="store" /></Link><Link className="bg-btn small" to="?tab=inventory">Update stock<Icon name="arrow" /></Link></div>
          </div>
          {stats ? <Insights stats={stats} /> : <div className="ws-card muted">Loading your numbers…</div>}
        </>
      )}
      {tab === 'inventory' && <Inventory products={products} setProducts={setProducts} cats={cats} me={me} />}
      {tab === 'shop' && <MyShop products={products} setProducts={setProducts} />}
    </>
  );
}

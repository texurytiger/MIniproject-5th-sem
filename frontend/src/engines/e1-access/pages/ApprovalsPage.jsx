import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { api } from '../../../app/api';
import Icon from '../../../app/Icons';
import ProductArt from '../../../storefront/ProductArt';
import { rupees } from '../../../storefront/cart';
import { fmtTime } from './shared';

const SHOP_BADGE = { PENDING: ['warn', 'Waiting for review'], APPROVED: ['allow', 'Approved'], REJECTED: ['deny', 'Rejected'] };
const TABS = [['PENDING', 'Waiting'], ['REJECTED', 'Rejected'], ['APPROVED', 'Approved']];

/** One seller application: approve, reject with a reason, ban (deactivate) or delete. Every button is re-checked by the server. */
function SellerRow({ s, can, onChanged }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok }); onChanged(); } catch (e) { setMsg({ err: e.details && e.details.reason ? `Reason ${e.details.reason}` : e.message }); } finally { setBusy(false); }
  };
  const approve = () => run(() => api(`/admin/sellers/${s.sellerId}/approve`, { method: 'PUT' }), `${s.name} is approved and visible to customers.`);
  const reject = () => run(() => api(`/admin/sellers/${s.sellerId}/reject`, { method: 'PUT', body: { reason } }), `${s.name} was rejected. The seller sees your reason.`);
  const ban = () => run(() => api(`/admin/users/${s.sellerId}/active`, { method: 'PUT', body: { isActive: !s.isActive } }), s.isActive ? `${s.email} is banned. Their sessions ended immediately.` : `${s.email} can sign in again.`);
  const remove = () => {
    if (!window.confirm(`Delete ${s.email} and the shop "${s.name}" permanently? This cannot be undone.`)) return;
    run(() => api(`/admin/users/${s.sellerId}`, { method: 'DELETE' }), `${s.email} was deleted.`);
  };
  const [cls, label] = SHOP_BADGE[s.status];
  return (
    <div className="appr-row">
      <div className="appr-main">
        <div className="appr-title">
          <b>{s.name}</b><code>/shop/{s.slug}</code>
          <span className={`badge dot ${cls}`}>{label}</span>
          {!s.isActive && <span className="badge deny">banned</span>}
        </div>
        <span className="small muted">{s.sellerName} · {s.email} · applied {fmtTime(s.appliedAt)} · {s.products} product{s.products === 1 ? '' : 's'}</span>
        {s.about && <p className="small appr-about">{s.about}</p>}
        {s.status === 'REJECTED' && <p className="small appr-note"><b>Reason given:</b> {s.reviewNote} <span className="muted">({s.reviewedBy || 'admin'}, {fmtTime(s.reviewedAt)})</span></p>}
        {s.status === 'APPROVED' && s.reviewedAt && <p className="small muted">Approved by {s.reviewedBy || 'admin'} on {fmtTime(s.reviewedAt)}</p>}
        {rejecting && (
          <div className="row-actions" style={{ marginTop: 8 }}>
            <input className="compact" style={{ flex: 1, minWidth: 220, maxWidth: 'none' }} maxLength={300} placeholder="Why? The seller will see this (3 to 300 characters)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for rejecting" />
            <button className="btn small primary" disabled={busy || reason.trim().length < 3} onClick={reject}>Reject shop</button>
            <button className="btn small ghost" onClick={() => { setRejecting(false); setReason(''); }}>Cancel</button>
          </div>
        )}
        {msg && msg.ok && <span className="inv-msg ok"><Icon name="check" />{msg.ok}</span>}
        {msg && msg.err && <span className="inv-msg err">{msg.err}</span>}
      </div>
      <div className="row-actions appr-actions">
        {s.status === 'PENDING' && can('user:approve') && !rejecting && (
          <>
            <button className="btn small primary" disabled={busy} onClick={approve}><Icon name="check" />Approve</button>
            <button className="btn small" disabled={busy} onClick={() => setRejecting(true)}><Icon name="x" />Reject</button>
          </>
        )}
        {s.status === 'APPROVED' && <Link className="btn small" to={`/shop/${s.slug}`}>View shop</Link>}
        {can('user:deactivate') && <button className="btn small ghost" disabled={busy} onClick={ban}>{s.isActive ? 'Ban' : 'Unban'}</button>}
        {can('user:delete') && <button className="btn small ghost" disabled={busy || s.products > 0} title={s.products > 0 ? 'Owns products: ban instead' : 'Delete the account and its shop'} onClick={remove}>Delete</button>}
      </div>
    </div>
  );
}

/** One listing waiting for approval. Approve is refused (409) while the seller's shop is not approved. */
function ProductRow({ p, onChanged }) {
  const [msg, setMsg] = useState(null);
  const shopOk = !p.shopStatus || p.shopStatus === 'APPROVED';
  async function approve() {
    setMsg(null);
    try { await api(`/catalog/products/${p.id}/approve`, { method: 'PUT' }); onChanged(); } catch (e) { setMsg(e.message); }
  }
  return (
    <tr>
      <td><div className="inv-prod"><ProductArt image={p.image} imageUrl={p.imageUrl} category={p.category} /><div><b>{p.name}</b><span>{p.categoryNames.join(' · ') || 'No category'} · ID {p.id}</span></div></div></td>
      <td>{p.shopName || p.sellerName}{!shopOk && <div><span className="badge warn" style={{ marginTop: 4 }}>shop not approved</span></div>}</td>
      <td className="nowrap">{rupees(p.price)}</td>
      <td>{p.stock}</td>
      <td className="right">
        <button className="btn small primary" disabled={!shopOk} title={shopOk ? 'Show this listing to customers' : 'Approve the shop first'} onClick={approve}><Icon name="check" />Approve</button>
        {msg && <span className="inv-msg err">{msg}</span>}
      </td>
    </tr>
  );
}

/** Admin approvals: new seller shops (user:approve) and new product listings (product:approve). */
export default function ApprovalsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('PENDING');
  const [sellers, setSellers] = useState(null);
  const [counts, setCounts] = useState({});
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');

  const loadSellers = useCallback(() => api(`/admin/sellers?status=${tab}`).then((d) => { setSellers(d.sellers); setCounts(d.counts); }).catch((e) => setError(e.message)), [tab]);
  const loadProducts = useCallback(() => (can('product:approve') ? api('/admin/products').then((d) => setProducts(d.products)).catch((e) => setError(e.message)) : null), [can]);
  useEffect(() => { loadSellers(); }, [loadSellers]);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  const refresh = () => { loadSellers(); loadProducts(); };

  return (
    <>
      <div className="ws-head">
        <div><h1>Approvals</h1><p>New seller shops and new listings wait here. Customers see neither until you approve them.</p></div>
      </div>
      {error && <div className="alert error"><Icon name="alert" />{error}</div>}

      <section className="ws-card">
        <div className="chart-head">
          <div>
            <h2>Seller shops</h2>
            <p className="muted small">A waiting seller can sign in and set up the shop, but cannot change products. Rejected sellers may apply again after the cooldown. Ban signs them out and blocks sign-in; delete removes the account and shop (only if they own no products).</p>
          </div>
          <div className="seg">
            {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{counts[k] ? ` (${counts[k]})` : ''}</button>)}
          </div>
        </div>
        {!sellers ? <p className="muted">Loading…</p>
          : sellers.length ? sellers.map((s) => <SellerRow key={s.sellerId} s={s} can={can} onChanged={refresh} />)
            : <p className="empty">{tab === 'PENDING' ? 'No shops are waiting for review.' : `No ${tab.toLowerCase()} shops.`}</p>}
      </section>

      {can('product:approve') && (
        <section className="ws-card flush" style={{ padding: 0 }}>
          <div className="card-head"><div><h2>Listings awaiting approval</h2><p>Approving makes a listing visible in search and on the shop page (or Out of stock if it has none).</p></div></div>
          <table className="table inv">
            <thead><tr><th>Product</th><th>Shop</th><th>Price</th><th>Stock</th><th /></tr></thead>
            <tbody>
              {(products || []).map((p) => <ProductRow key={p.id} p={p} onChanged={refresh} />)}
              {products && !products.length && <tr><td colSpan="5" className="empty">No listings are waiting.</td></tr>}
              {!products && <tr><td colSpan="5" className="empty">Loading…</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

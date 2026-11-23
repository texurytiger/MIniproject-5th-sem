import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { api } from '../../app/api';
import Icon from '../../app/Icons';
import ProductArt from '../ProductArt';
import { rupees } from '../cart';
import { TABS } from './PortalLayout';
import { STATUS } from './SellerHome';

function StockRow({ p, canEdit, onSaved }) {
  const [stock, setStock] = useState(String(p.stock));
  const [msg, setMsg] = useState(null);
  async function save() {
    try {
      const { product } = await api(`/ops/stock/${p.id}`, { method: 'PATCH', body: { stock: Number(stock) } });
      onSaved(product); setMsg({ ok: true });
    } catch (e) { setMsg({ err: e.details ? `stock ${e.details.stock}` : e.message }); }
  }
  const [cls, label] = STATUS[p.status];
  return (
    <tr className={p.stock <= 15 ? 'low' : ''}>
      <td><div className="inv-prod"><ProductArt image={p.image} category={p.category} /><div><b>{p.name}</b><span>SKU T3-{String(p.id).padStart(4, '0')} · {p.sellerName}</span></div></div></td>
      <td><span className={`badge dot ${cls}`}>{label}</span></td>
      <td>{canEdit ? <input className="inv-qty" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} aria-label={`Stock of ${p.name}`} /> : <b>{p.stock}</b>}</td>
      <td className="right">
        {canEdit && <button className="btn small primary" disabled={Number(stock) === p.stock} onClick={save}>Update</button>}
        {msg && msg.ok && Number(stock) === p.stock && <span className="inv-msg ok"><Icon name="check" />Updated</span>}
        {msg && msg.err && <span className="inv-msg err">{msg.err}</span>}
      </td>
    </tr>
  );
}

function Stock() {
  const { can } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  useEffect(() => { api('/ops/stock').then((d) => setRows(d.products)).catch((e) => { setError(e.message); setRows([]); }); }, []);
  const shown = useMemo(() => (rows || []).filter((p) => !lowOnly || p.stock <= 15), [rows, lowOnly]);
  const canEdit = can('stock:update');
  return (
    <div className="pt-stack">
      <div className="pt-head">
        <div><h1>Stock levels</h1><p className="muted">{canEdit ? 'Correct counts after a physical check. Zero hides a product from the store.' : 'Read-only: your role can see stock but not change it.'}</p></div>
        <span className="spacer" />
        <label className="toggle"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />Low stock only (≤ 15)</label>
      </div>
      {error && <div className="alert error"><Icon name="alert" />{error}</div>}
      <section className="pt-card flush">
        <table className="table inv">
          <thead><tr><th>Product</th><th>Status</th><th>On hand</th><th /></tr></thead>
          <tbody>{shown.map((p) => <StockRow key={p.id} p={p} canEdit={canEdit} onSaved={(np) => setRows((l) => l.map((x) => (x.id === np.id ? np : x)))} />)}</tbody>
        </table>
      </section>
    </div>
  );
}

/* =================== Warehouse Fulfillment Queue (UC-06, UC-08, UC-16) =================== */
const ORDER_STATUS_META = {
  PAID: { label: 'Ready to Pick', cls: 'warn', note: 'Payment verified. Awaiting warehouse pick and pack.' },
  PACKED: { label: 'Packed · Ready to Ship', cls: 'packed', note: 'Items packed into parcel. Ready for courier dispatch.' },
  SHIPPED: { label: 'Dispatched', cls: 'allow', note: 'Handed over to carrier. En route to customer.' },
  DELIVERED: { label: 'Delivered', cls: 'allow', note: 'Successfully delivered to customer.' },
  CANCELLED: { label: 'Cancelled / Failed', cls: 'deny', note: 'Order cancelled or fulfillment failure reported.' },
  PENDING_PAYMENT: { label: 'Awaiting Payment', cls: 'warn', note: 'Customer in checkout. Inventory held for 15m.' },
};

function bayForProduct(productId) {
  const bayLetter = String.fromCharCode(65 + ((productId || 1) % 6));
  const shelfNum = ((productId || 1) * 3) % 18 + 1;
  return `Bay ${bayLetter}-${String(shelfNum).padStart(2, '0')}`;
}

function PickListModal({ order, onClose }) {
  const [checked, setChecked] = useState({});
  const toggle = (idx) => setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const allChecked = order.items.length > 0 && order.items.every((_, i) => checked[i]);

  return (
    <div className="pt-modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,20,16,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div className="pt-modal-card" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, maxWidth: 620, width: '100%', padding: '24px 28px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: 14, marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Warehouse Pick &amp; Pack List</h2>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Order #ORD-{String(order.id).padStart(5, '0')} · {order.customerName}</div>
          </div>
          <button className="btn small outline" onClick={onClose} style={{ cursor: 'pointer' }}>Close</button>
        </div>

        <div style={{ background: '#FAF7F3', border: '1px solid #EAE2D8', borderRadius: 8, padding: '12px 16px', marginBottom: 18, fontSize: 12, lineHeight: 1.5 }}>
          <div><b>Shipping To:</b> {order.shippingName} ({order.shippingPhone})</div>
          <div style={{ color: '#555' }}>{order.shippingAddress}, PIN: {order.shippingPincode}</div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Check off items from warehouse shelves:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {order.items.map((it, idx) => (
            <div key={idx} onClick={() => toggle(idx)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid', borderColor: checked[idx] ? '#2F6B3F' : '#E5DFD7', background: checked[idx] ? '#F2FAF4' : '#fff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s ease' }}>
              <input type="checkbox" checked={!!checked[idx]} onChange={() => {}} style={{ width: 18, height: 18, cursor: 'pointer' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: checked[idx] ? '#2F6B3F' : '#1D1916' }}>{it.name}</div>
                <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
                  SKU: <span style={{ fontFamily: 'monospace' }}>T3-{String(it.productId).padStart(4, '0')}</span> · Location: <b style={{ color: '#B4561F' }}>{bayForProduct(it.productId)}</b>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ background: '#EDE6DE', padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12 }}>Qty: {it.quantity}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid #eee' }}>
          <div style={{ fontSize: 12, color: allChecked ? '#2F6B3F' : '#777', fontWeight: 600 }}>
            {allChecked ? '✓ All items picked from bins!' : `${Object.values(checked).filter(Boolean).length} of ${order.items.length} items checked`}
          </div>
          <button className="btn small primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function DispatchModal({ order, onClose, onConfirm }) {
  const [carrier, setCarrier] = useState('BlueDart Express');
  const [tracking, setTracking] = useState(`TRK-T3-${Math.floor(100000 + Math.random() * 900000)}`);
  const [submitting, setSubmitting] = useState(false);

  const handleDispatch = async () => {
    setSubmitting(true);
    await onConfirm(order, `${carrier} (${tracking})`);
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="pt-modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,20,16,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div className="pt-modal-card" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, maxWidth: 520, width: '100%', padding: '24px 28px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontSize: 18, margin: '0 0 4px', fontWeight: 700 }}>Dispatch Shipment (UC-06)</h2>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>Assign carrier details to dispatch Order #ORD-{String(order.id).padStart(5, '0')}.</p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Carrier Partner</label>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
            <option value="BlueDart Express">BlueDart Express</option>
            <option value="Delhivery Logistics">Delhivery Logistics</option>
            <option value="DTDC Courier">DTDC Courier</option>
            <option value="Speed Post">India Post (Speed Post)</option>
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Air Waybill / Tracking ID</label>
          <input type="text" value={tracking} onChange={(e) => setTracking(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, fontFamily: 'monospace' }} />
        </div>

        <div style={{ background: '#FAF8F5', border: '1px solid #EDE4D8', borderRadius: 6, padding: '10px 14px', marginBottom: 20, fontSize: 12 }}>
          <div><b>Destination:</b> {order.shippingName}</div>
          <div style={{ color: '#666', marginTop: 2 }}>{order.shippingAddress} · PIN: {order.shippingPincode}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn small outline" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn small primary" onClick={handleDispatch} disabled={submitting || !tracking}>
            {submitting ? 'Dispatching...' : 'Confirm Shipment & Dispatched'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueModal({ order, onClose, onConfirm }) {
  const [reason, setReason] = useState('Item damaged during warehouse pick');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onConfirm(order, reason, notes);
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="pt-modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,20,16,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div className="pt-modal-card" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, maxWidth: 500, width: '100%', padding: '24px 28px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontSize: 18, margin: '0 0 4px', fontWeight: 700, color: '#A62822' }}>Report Fulfillment Issue (UC-08)</h2>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>Flag an exception for Order #ORD-{String(order.id).padStart(5, '0')}. This will log to audit trail and halt shipping.</p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Issue Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
            <option value="Item damaged during warehouse pick">Item damaged during warehouse pick</option>
            <option value="Physical bin inventory count mismatch">Physical bin inventory count mismatch</option>
            <option value="Packaging defective / unsafe to ship">Packaging defective / unsafe to ship</option>
            <option value="Customer cancellation request prior to ship">Customer cancellation request</option>
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Additional Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Scratched outer case on shelf B-04. Requires replacement." style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12.5 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn small outline" onClick={onClose} disabled={submitting}>Back</button>
          <button className="btn small" style={{ background: '#A62822', color: '#fff' }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Recording...' : 'Cancel & Flag Issue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WarehouseOrders() {
  const { me, can } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active'); // active | paid | packed | shipped | all
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { type, order }
  const [actionBusy, setActionBusy] = useState(null);

  const canUpdate = can('order:update_status');

  const fetchOrders = () => {
    setLoading(true);
    api('/ops/orders')
      .then((res) => setOrders(res.orders || []))
      .catch((err) => setError(err.message || 'Failed to load warehouse orders'))
      .finally(() => setLoading(false));
  };

  const handleResetOrders = async () => {
    setActionBusy('reset');
    try {
      const res = await api('/ops/orders/reset', { method: 'POST' });
      if (res && res.orders) {
        setOrders(res.orders);
      }
    } catch (e) {
      alert(e.message || 'Failed to reset demo orders');
    } finally {
      setActionBusy(null);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const counts = useMemo(() => {
    const paid = orders.filter((o) => o.status === 'PAID').length;
    const packed = orders.filter((o) => o.status === 'PACKED').length;
    const shipped = orders.filter((o) => o.status === 'SHIPPED').length;
    return { paid, packed, shipped, active: paid + packed, total: orders.length };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filter === 'active' && !['PAID', 'PACKED'].includes(o.status)) return false;
      if (filter === 'paid' && o.status !== 'PAID') return false;
      if (filter === 'packed' && o.status !== 'PACKED') return false;
      if (filter === 'shipped' && o.status !== 'SHIPPED') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchId = `ord-${o.id}`.includes(q) || String(o.id).includes(q);
        const matchCust = (o.customerName || '').toLowerCase().includes(q) || (o.shippingAddress || '').toLowerCase().includes(q);
        const matchItem = o.items.some((it) => it.name.toLowerCase().includes(q));
        if (!matchId && !matchCust && !matchItem) return false;
      }
      return true;
    });
  }, [orders, filter, search]);

  const handlePackOrder = async (order) => {
    setActionBusy(order.id);
    try {
      const res = await api(`/ops/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: 'PACKED', note: `Packed into parcel by ${me?.user?.name || 'Warehouse Staff'}` },
      });
      if (res.ok && res.order) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? res.order : o)));
      }
    } catch (e) {
      alert(e.message || 'Failed to pack order');
    } finally {
      setActionBusy(null);
    }
  };

  const handleShipOrder = async (order, trackingInfo) => {
    setActionBusy(order.id);
    try {
      const res = await api(`/ops/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: 'SHIPPED', note: `Dispatched: ${trackingInfo}` },
      });
      if (res.ok && res.order) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? res.order : o)));
      }
    } catch (e) {
      alert(e.message || 'Failed to ship order');
    } finally {
      setActionBusy(null);
    }
  };

  const handleReportIssue = async (order, reason, note) => {
    setActionBusy(order.id);
    try {
      const res = await api(`/ops/orders/${order.id}/issue`, {
        method: 'POST',
        body: { reason, note },
      });
      if (res.ok && res.order) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? res.order : o)));
      }
    } catch (e) {
      alert(e.message || 'Failed to record issue');
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="pt-stack">
      {/* Top Header */}
      <div className="pt-head">
        <div>
          <h1>Warehouse Fulfillment Queue</h1>
          <p className="muted">
            {canUpdate
              ? 'Execute physical pick, pack, and courier dispatch workflows (UC-06, UC-08). Updates are audited.'
              : 'Read-only view of customer orders.'}
          </p>
        </div>
        <span className="spacer" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn small outline" onClick={fetchOrders} title="Refresh orders">
            <Icon name="refresh" /> Refresh Queue
          </button>
          <button
            className="btn small outline"
            onClick={handleResetOrders}
            title="Reset all demo orders to initial state (Order 1 will be Ready to Pick)"
            style={{ borderColor: '#B47818', color: '#B47818' }}
          >
            <Icon name="refresh" /> Reset Demo Orders
          </button>
        </div>
      </div>

      {error && <div className="alert error"><Icon name="alert" />{error}</div>}

      {/* KPI Metrics Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 18 }}>
        <div style={{ background: '#fff', border: '1px solid #E5DFD7', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: '#FEF7EA', color: '#B47818', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="box" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1D1916', lineHeight: 1 }}>{counts.paid}</div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>Ready to Pick</div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E5DFD7', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: '#F3ECF9', color: '#592F8A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="truck" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1D1916', lineHeight: 1 }}>{counts.packed}</div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>Packed &amp; Ready to Ship</div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E5DFD7', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: '#E8F5EE', color: '#1B6E3E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1D1916', lineHeight: 1 }}>{counts.shipped}</div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>Dispatched</div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E5DFD7', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: '#EBF3FA', color: '#1A568C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="grid" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1D1916', lineHeight: 1 }}>{counts.active}</div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>Total In Queue</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', background: '#EFEBE5', borderRadius: 8, padding: 3, gap: 2 }}>
          {[
            ['active', `Active Queue (${counts.active})`],
            ['paid', `Ready to Pick (${counts.paid})`],
            ['packed', `Ready to Ship (${counts.packed})`],
            ['shipped', `Dispatched (${counts.shipped})`],
            ['all', `All (${counts.total})`],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === k ? '#fff' : 'transparent',
                color: filter === k ? '#1D1916' : '#666',
                boxShadow: filter === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: 280 }}>
          <input
            type="text"
            placeholder="Search order #, customer, item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12.5 }}
          />
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }}>
            <Icon name="search" />
          </div>
        </div>
      </div>

      {/* Orders List / Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#666' }}>Loading warehouse queue...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="pt-empty ws-card" style={{ padding: '36px 20px', textAlign: 'center' }}>
          <Icon name="box" />
          <h3>No orders match this view</h3>
          <p className="muted">All orders in this filter category have been completed or none exist.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredOrders.map((o) => {
            const meta = ORDER_STATUS_META[o.status] || { label: o.status, cls: 'warn', note: '' };
            const isBusy = actionBusy === o.id;

            return (
              <div
                key={o.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E5DFD7',
                  borderRadius: 12,
                  padding: '18px 22px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Order Top Bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: '1px solid #F1ECE6', paddingBottom: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#1D1916' }}>
                      #ORD-{String(o.id).padStart(5, '0')}
                    </span>
                    <span
                      className={`badge dot ${meta.cls === 'packed' ? '' : meta.cls}`}
                      style={
                        o.status === 'PACKED'
                          ? { background: '#EDE9FE', color: '#5B21B6', border: '1px solid #DDD6FE' }
                          : {}
                      }
                    >
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#777' }}>
                      Placed {new Date(o.createdAt).toLocaleDateString()} {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1D1916' }}>{rupees(o.total)}</div>
                  </div>
                </div>

                {/* Order Body Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
                  {/* Items to Pick */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#888', letterSpacing: '0.04em', marginBottom: 8 }}>
                      Line Items &amp; Warehouse Locations ({o.items.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {o.items.map((it, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#FAF8F5',
                            border: '1px solid #EFEAE3',
                            borderRadius: 8,
                            padding: '8px 12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ProductArt image={it.image} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 12.5 }}>{it.name}</div>
                              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                                SKU: <span style={{ fontFamily: 'monospace' }}>T3-{String(it.productId).padStart(4, '0')}</span> · Shelf:{' '}
                                <b style={{ color: '#B4561F' }}>{bayForProduct(it.productId)}</b>
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, fontSize: 12.5 }}>x{it.quantity}</span>
                            <div style={{ fontSize: 11, color: '#888' }}>{rupees(it.lineTotal)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Customer / Shipping Address & Action Panel */}
                  <div style={{ borderLeft: '1px solid #F1ECE6', paddingLeft: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#888', letterSpacing: '0.04em', marginBottom: 6 }}>
                        Shipping Destination
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1D1916' }}>{o.shippingName}</div>
                      <div style={{ fontSize: 11.5, color: '#555', marginTop: 2, lineHeight: 1.4 }}>
                        {o.shippingAddress}
                        <br />
                        PIN: <b>{o.shippingPincode}</b> · Ph: {o.shippingPhone}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {canUpdate && o.status === 'PAID' && (
                        <>
                          <button
                            className="btn small primary"
                            disabled={isBusy}
                            onClick={() => handlePackOrder(o)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <Icon name="box" /> {isBusy ? 'Packing...' : 'Pick & Pack Order'}
                          </button>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn small outline"
                              style={{ flex: 1 }}
                              onClick={() => setModal({ type: 'pickList', order: o })}
                            >
                              <Icon name="scroll" /> Pick List
                            </button>
                            <button
                              className="btn small outline"
                              style={{ color: '#A62822' }}
                              onClick={() => setModal({ type: 'issue', order: o })}
                              title="Report damaged or missing item"
                            >
                              <Icon name="alert" /> Issue
                            </button>
                          </div>
                        </>
                      )}

                      {canUpdate && o.status === 'PACKED' && (
                        <>
                          <button
                            className="btn small primary"
                            disabled={isBusy}
                            onClick={() => setModal({ type: 'dispatch', order: o })}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#1A568C' }}
                          >
                            <Icon name="truck" /> {isBusy ? 'Dispatching...' : 'Dispatch / Ship'}
                          </button>
                          <button
                            className="btn small outline"
                            onClick={() => setModal({ type: 'pickList', order: o })}
                          >
                            <Icon name="scroll" /> View Slip
                          </button>
                        </>
                      )}

                      {o.status === 'SHIPPED' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1B6E3E', fontWeight: 600 }}>
                          <Icon name="check" /> Package Dispatched
                        </div>
                      )}

                      {o.status === 'CANCELLED' && (
                        <div style={{ fontSize: 11.5, color: '#A62822', fontWeight: 500 }}>
                          Fulfillment cancelled or refund requested.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {modal && modal.type === 'pickList' && (
        <PickListModal order={modal.order} onClose={() => setModal(null)} />
      )}
      {modal && modal.type === 'dispatch' && (
        <DispatchModal
          order={modal.order}
          onClose={() => setModal(null)}
          onConfirm={(order, tracking) => handleShipOrder(order, tracking)}
        />
      )}
      {modal && modal.type === 'issue' && (
        <IssueModal
          order={modal.order}
          onClose={() => setModal(null)}
          onConfirm={(order, reason, note) => handleReportIssue(order, reason, note)}
        />
      )}
    </div>
  );
}

const SOON = {
  refunds: ['return', 'No refund requests', 'Customers request refunds on their own orders; approvals land here once orders exist (Sprint 2).'],
  payments: ['wallet', 'No payments recorded', 'Transactions from the payment service will be listed here in Sprint 2.'],
  reports: ['grid', 'No reports yet', 'Daily sales and refund reports are generated from real orders, starting Sprint 2.'],
};

export default function OpsHome() {
  const { me, can } = useAuth();
  const [params] = useSearchParams();
  const tabs = TABS.ops.filter((t) => can(t.permission));

  if (!tabs.length) {
    return (
      <div className="pt-empty wide">
        <Icon name="lock" />
        <h3>Your role has no permissions yet</h3>
        <p className="muted">
          You're signed in as <b>{me.user.role}</b>. No role in your chain grants anything, so every area is closed (deny by default). An administrator can grant permissions to this role in the admin console.
        </p>
        <Link to="/account#access" className="btn small">See your access</Link>
      </div>
    );
  }

  const tab = tabs.find((t) => t.id === params.get('tab')) ? params.get('tab') : tabs[0].id;
  if (tab === 'stock') return <Stock />;
  if (tab === 'orders') return <WarehouseOrders />;

  const [icon, title, text] = SOON[tab] || ['box', 'Under Development', 'This area will go live in future sprints.'];
  return <div className="pt-empty"><Icon name={icon} /><h3>{title}</h3><p className="muted">{text}</p></div>;
}

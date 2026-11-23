import { useEffect, useState } from 'react';
import { api } from '../../../app/api';
import { Alert, Decision, PageHead, fmtTime } from './shared';

const RESOURCES = ['session', 'user', 'role', 'audit', 'product', 'stock', 'category', 'shop', 'order', 'payment', 'refund', 'report'];

/** Busiest IP addresses over the last 7 days, most refusals first. Many refusals from one IP = someone guessing passwords. */
function TopIps() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/admin/audit/ips').then(setD).catch((e) => setError(e.message)); }, []);
  return (
    <section className="card">
      <h3 style={{ marginBottom: 4 }}>Top IP addresses</h3>
      <p className="small muted" style={{ marginBottom: 12 }}>Last {d ? d.days : 7} days, most refused requests first. Many refusals across several accounts from one address usually means password guessing.</p>
      <Alert msg={error && { type: 'error', text: error }} />
      {d && !d.ips.length && <p className="muted small">No requests with an IP address recorded yet.</p>}
      {d && d.ips.length > 0 && (
        <div className="ip-cards">
          {d.ips.map((x) => (
            <div key={x.ip} className={`ip-card ${x.denied >= 10 ? 'hot' : ''}`}>
              <code>{x.ip}</code>
              <span><b>{x.denied}</b> refused of {x.total} requests</span>
              <span className="muted">{x.accounts} account{x.accounts === 1 ? '' : 's'} · last {fmtTime(x.lastSeen)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** FR-11 / UC-E1-07 View Audit Log (insert-only: every ALLOW and DENY decision). */
export default function AuditPage() {
  const [filters, setFilters] = useState({ decision: '', resource: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ entries: [], total: 0, pageSize: 15 });
  const [error, setError] = useState('');

  useEffect(() => {
    const qs = new URLSearchParams({ page, pageSize: 15 });
    if (filters.decision) qs.set('decision', filters.decision);
    if (filters.resource) qs.set('resource', filters.resource);
    api(`/admin/audit?${qs}`).then(setData).catch((e) => setError(e.message));
  }, [filters, page]);

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const set = (k) => (e) => { setPage(1); setFilters({ ...filters, [k]: e.target.value }); };

  return (
    <div className="stack">
      <PageHead title="Audit log" fr="FR-11" lead="Every authorization decision, newest first, with the IP address it came from. Rows are only ever inserted, never updated or deleted." />
      <Alert msg={error && { type: 'error', text: error }} />
      <TopIps />
      <div className="toolbar">
        <select className="compact" value={filters.decision} onChange={set('decision')} aria-label="Decision">
          <option value="">All decisions</option><option value="ALLOW">ALLOW</option><option value="DENY">DENY</option>
        </select>
        <select className="compact" value={filters.resource} onChange={set('resource')} aria-label="Resource">
          <option value="">All resources</option>
          {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="muted">{data.total} {data.total === 1 ? 'entry' : 'entries'}</span>
      </div>
      <section className="card flush">
        <table className="table">
          <thead><tr><th>#</th><th>Time</th><th>User</th><th>IP address</th><th>Request</th><th>Decision</th><th>Reason</th></tr></thead>
          <tbody>
            {data.entries.map((e) => (
              <tr key={e.id}>
                <td className="muted">{e.id}</td>
                <td className="nowrap muted">{fmtTime(e.createdAt)}</td>
                <td>{e.email || <span className="muted">anonymous</span>}</td>
                <td className="mono small nowrap">{e.ip || <span className="muted">-</span>}</td>
                <td><code>{e.resource}:{e.action}</code></td>
                <td><Decision value={e.decision} /></td>
                <td className="muted mono small">{e.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="pager">
        <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Newer</button>
        <span className="muted">Page {page} of {pages}</span>
        <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older →</button>
      </div>
    </div>
  );
}

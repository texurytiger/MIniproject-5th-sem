import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../app/api';
import Icon from '../../../app/Icons';
import { Attention, BarList, CHART_COLORS as C, DayBars, Donut, Kpi, LineChart, greeting, periodLabels } from '../../../storefront/portals/charts';
import { useAuth } from '../../../app/AuthContext';

/** Last 7 calendar days (oldest first) as YYYY-MM-DD, so days with no activity still show as zero. */
function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

/** Admin overview: real numbers only. Orders and revenue say plainly that they need E2. */
export default function DashboardPage() {
  const { me } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/admin/overview').then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="alert error"><Icon name="alert" />{error}</div>;
  if (!d) return <div className="ws-card muted">Loading the overview…</div>;
  const users = d.usersByRole.reduce((s, r) => s + r.n, 0);
  const s = d.statusCounts;
  const days = lastDays(7).map((day) => ({
    day,
    a: (d.decisionsByDay.find((x) => x.day === day && x.decision === 'ALLOW') || {}).n || 0,
    b: (d.decisionsByDay.find((x) => x.day === day && x.decision === 'DENY') || {}).n || 0,
  }));
  const labels = periodLabels('month');
  const allowed = days.reduce((t, x) => t + x.a, 0);
  const refused = days.reduce((t, x) => t + x.b, 0);
  const todo = [
    s.PENDING ? { key: 'pending', tone: 'info', title: `${s.PENDING} listing${s.PENDING === 1 ? '' : 's'} awaiting approval`, text: 'Customers cannot see these until they are approved.' } : null,
    d.lowStock ? { key: 'low', tone: 'warn', title: `${d.lowStock} product${d.lowStock === 1 ? '' : 's'} low on stock`, text: `${d.lowStockThreshold} or fewer units left across all shops.` } : null,
    s.SOLD_OUT ? { key: 'out', tone: 'bad', title: `${s.SOLD_OUT} product${s.SOLD_OUT === 1 ? '' : 's'} sold out`, text: 'Hidden from search until the seller restocks.' } : null,
    refused ? { key: 'deny', tone: 'warn', title: `${refused} refused request${refused === 1 ? '' : 's'} this week`, text: 'Worth a look if one account keeps getting refused.', to: '/admin/audit', action: 'Audit log' } : null,
  ].filter(Boolean);

  return (
    <>
      <div className="ws-head">
        <div><span className="ws-hello">{greeting().part}, {me?.user?.name?.split(' ')[0] || 'admin'}</span><h1>Overview</h1><p>{greeting().date} · live numbers from the database</p></div>
        <div className="row-actions"><Link className="bg-btn outline small" to="/admin/categories">Categories<Icon name="tree" /></Link><Link className="bg-btn small" to="/admin/audit">Audit log<Icon name="arrow" /></Link></div>
      </div>

      <div className="kpis">
        <Kpi icon="users" label="Accounts" value={users} note={`across ${d.usersByRole.filter((r) => r.n).length} roles`} />
        <Kpi icon="store" label="Products live" value={s.APPROVED} note={`${s.PENDING} awaiting approval`} />
        <Kpi icon="alert" label="Low stock" value={d.lowStock} note={`${d.lowStockThreshold} or fewer left`} tone={d.lowStock ? 'warn' : ''} />
        <Kpi icon="shield" label="Refused this week" value={refused} note={`of ${allowed + refused} access checks`} tone={refused ? 'warn' : 'ok'} />
      </div>

      <div className="charts">
        <section className="chart-card wide">
          <h3>Needs your attention</h3>
          <p className="chart-sub">Things across the store worth checking today.</p>
          <Attention items={todo} clear="All clear. Nothing needs you right now." />
        </section>
        <section className="chart-card wide">
          <h3>Access decisions, last 7 days</h3>
          <p className="chart-sub">Every permission check E1 made, allowed or refused (from the audit log).</p>
          <DayBars days={days} aLabel="Allowed" bLabel="Refused" width={1000} />
        </section>
        <section className="chart-card">
          <h3>Accounts by role</h3>
          <p className="chart-sub">EMPLOYEE is a parent role: nobody holds it directly.</p>
          <BarList rows={d.usersByRole.map((r) => ({ key: r.name, label: r.name, value: r.n }))} />
        </section>
        <section className="chart-card">
          <h3>Products by status</h3>
          <p className="chart-sub">Pending listings wait for your approval.</p>
          <Donut parts={[
            { label: 'Live', value: s.APPROVED, color: C.brown },
            { label: 'Sold out', value: s.SOLD_OUT, color: C.warn },
            { label: 'Awaiting approval', value: s.PENDING, color: C.tanSoft },
          ]} />
        </section>
        <section className="chart-card">
          <h3>Why requests were refused</h3>
          <p className="chart-sub">Top refusal reasons, all time.</p>
          {d.topDenials.length ? <BarList rows={d.topDenials.map((r) => ({ key: r.reason, label: r.reason, value: r.n }))} color={C.deny} /> : <p className="muted">No refusals recorded yet.</p>}
        </section>
        <section className="chart-card">
          <h3>Orders and revenue</h3>
          <p className="chart-sub">Per month, across all shops.</p>
          <LineChart labels={labels} money series={[{ label: 'Revenue', values: labels.map(() => 0) }]} empty emptyTitle="No orders yet" emptyText={d.orders.reason} />
        </section>
      </div>
    </>
  );
}

import { Link } from 'react-router-dom';
import Icon from '../../app/Icons';

/**
 * Small SVG charts for the dashboards (no chart library). Every chart is drawn from the rows it is given.
 * When a chart has no data yet (sales before orders exist) it draws an honest empty axis with a note.
 */
const C = { brown: '#312219', tan: '#D9AE7E', tanSoft: '#ECCEAA', cream: '#EDE6DE', grid: '#EEE6DC', axis: '#B9AB9C', ink: '#4A3D34', warn: '#B4561F', ok: '#2F6B3F', deny: '#A3341F' };
export const CHART_COLORS = C;

const fmt = (n) => (Math.abs(n) >= 100000 ? `${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L` : Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : String(n));
function niceMax(v) {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v)); const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

/** Horizontal bars, one per row, with an optional dashed threshold line (e.g. the low-stock line). */
export function BarList({ rows, value = 'value', label = 'label', threshold, thresholdLabel, color = C.brown, lowColor = C.warn, unit = '' }) {
  const W = 600; const rowH = 30; const left = 170; const right = 48; const H = rows.length * rowH + 30;
  const max = niceMax(Math.max(threshold || 0, ...rows.map((r) => r[value])));
  const X = (v) => left + (v / max) * (W - left - right);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
        {[0, 0.5, 1].map((t) => <line key={t} x1={X(max * t)} x2={X(max * t)} y1="0" y2={H - 22} stroke={C.grid} />)}
        {[0, 0.5, 1].map((t) => <text key={`t${t}`} x={X(max * t)} y={H - 6} fontSize="11" fill={C.axis} textAnchor="middle">{fmt(max * t)}</text>)}
        {rows.map((r, i) => {
          const y = i * rowH + 6; const low = threshold != null && r[value] <= threshold;
          return (
            <g key={r.key || r[label]}>
              <text x={left - 10} y={y + 14} fontSize="12" fill={C.ink} textAnchor="end">{String(r[label]).length > 22 ? `${String(r[label]).slice(0, 21)}…` : r[label]}</text>
              <rect x={left} y={y + 3} width={Math.max(2, X(r[value]) - left)} height="16" rx="3" fill={low ? lowColor : color} opacity={low ? 0.9 : 0.85} />
              <text x={X(r[value]) + 6} y={y + 15} fontSize="11.5" fill={C.ink}>{r[value].toLocaleString('en-IN')}{unit}</text>
            </g>
          );
        })}
        {threshold != null && (
          <g>
            <line x1={X(threshold)} x2={X(threshold)} y1="0" y2={H - 22} stroke={lowColor} strokeDasharray="4 4" strokeWidth="1.25" />
            <text x={X(threshold) + 4} y="10" fontSize="10.5" fill={lowColor}>{thresholdLabel || `≤ ${threshold}`}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

/** Donut with a centre total, for parts of a whole (products by status, users by role). */
export function Donut({ parts, centre }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const R = 70; const r = 44; const cx = 90; const cy = 90;
  let a = -Math.PI / 2;
  const arcs = total ? parts.filter((p) => p.value > 0).map((p) => {
    const da = (p.value / total) * Math.PI * 2; const a0 = a; const a1 = a + da; a = a1;
    const big = da > Math.PI ? 1 : 0;
    const P = (ang, rad) => `${cx + rad * Math.cos(ang)} ${cy + rad * Math.sin(ang)}`;
    const d = da >= Math.PI * 2 - 1e-6
      ? `M${P(0, R)} A${R} ${R} 0 1 1 ${P(Math.PI, R)} A${R} ${R} 0 1 1 ${P(0, R)} M${P(0, r)} A${r} ${r} 0 1 0 ${P(Math.PI, r)} A${r} ${r} 0 1 0 ${P(0, r)}Z`
      : `M${P(a0, R)} A${R} ${R} 0 ${big} 1 ${P(a1, R)} L${P(a1, r)} A${r} ${r} 0 ${big} 0 ${P(a0, r)}Z`;
    return <path key={p.label} d={d} fill={p.color} fillRule="evenodd" />;
  }) : [<circle key="e" cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke={C.grid} strokeWidth={R - r} />];
  return (
    <div className="chart donut">
      <svg viewBox="0 0 380 180" role="img" aria-label="Donut chart">
        {arcs}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="26" fontWeight="700" fill={C.brown}>{centre != null ? centre : total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill={C.axis}>total</text>
        {parts.map((p, i) => (
          <g key={p.label} transform={`translate(200 ${36 + i * 26})`}>
            <rect width="12" height="12" rx="2" fill={p.color} y="-10" />
            <text x="20" fontSize="13" fill={C.ink}>{p.label}</text>
            <text x="170" fontSize="13" fill={C.brown} fontWeight="700" textAnchor="end">{p.value}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Time labels for a period: day = last 14 days, week = last 12 weeks, month = last 12 months, year = last 5 years. */
export function periodLabels(period, now = new Date()) {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const out = [];
  if (period === 'day') for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); out.push(`${d.getDate()} ${M[d.getMonth()]}`); }
  if (period === 'week') for (let i = 11; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i * 7); out.push(`${d.getDate()} ${M[d.getMonth()]}`); }
  if (period === 'month') for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(`${M[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`); }
  if (period === 'year') for (let i = 4; i >= 0; i--) out.push(String(now.getFullYear() - i));
  return out;
}

/** Line chart over time. series = [{ label, values[], color }]. empty -> grey axis + note on top. */
export function LineChart({ labels, series, empty, emptyTitle, emptyText, money }) {
  const W = 600; const H = 210; const L = 46; const R = 14; const T = 12; const B = 28;
  const all = series.flatMap((s) => s.values);
  const max = niceMax(Math.max(0, ...all));
  const X = (i) => L + (labels.length < 2 ? 0 : (i / (labels.length - 1)) * (W - L - R));
  const Y = (v) => T + (1 - v / max) * (H - T - B);
  const step = Math.ceil(labels.length / 7);
  return (
    <div className={`chart ${empty ? 'chart-empty' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={Y(max * t)} y2={Y(max * t)} stroke={C.grid} />
            <text x={L - 6} y={Y(max * t) + 4} fontSize="10.5" fill={C.axis} textAnchor="end">{money ? '₹' : ''}{fmt(max * t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % step === 0 || i === labels.length - 1) && <text key={l + i} x={X(i)} y={H - 8} fontSize="10.5" fill={C.axis} textAnchor="middle">{l}</text>)}
        {!empty && series.map((s) => (
          <g key={s.label}>
            <path d={s.values.map((v, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(v)}`).join('')} fill="none" stroke={s.color || C.brown} strokeWidth="2" />
            {s.values.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r="2.6" fill={s.color || C.brown} />)}
          </g>
        ))}
        {empty && <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke={C.axis} strokeDasharray="5 5" />}
      </svg>
      {empty && <div className="empty-note"><b>{emptyTitle || 'No data yet'}</b><span>{emptyText}</span></div>}
    </div>
  );
}

/** Paired bars per day (e.g. allowed vs refused decisions). days = [{ day:'2026-11-22', a: n, b: n }]. */
export function DayBars({ days, aLabel, bLabel, aColor = C.brown, bColor = C.deny, width = 600 }) {
  const W = width; const H = 210; const L = 40; const R = 10; const T = 12; const B = 30;
  const max = niceMax(Math.max(1, ...days.flatMap((d) => [d.a, d.b])));
  const slot = (W - L - R) / Math.max(1, days.length); const bw = Math.min(22, slot / 3);
  const Y = (v) => T + (1 - v / max) * (H - T - B);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bars per day">
        {[0, 0.5, 1].map((t) => (
          <g key={t}><line x1={L} x2={W - R} y1={Y(max * t)} y2={Y(max * t)} stroke={C.grid} /><text x={L - 6} y={Y(max * t) + 4} fontSize="10.5" fill={C.axis} textAnchor="end">{fmt(max * t)}</text></g>
        ))}
        {days.map((d, i) => {
          const x = L + i * slot + slot / 2;
          return (
            <g key={d.day}>
              <rect x={x - bw - 1} y={Y(d.a)} width={bw} height={Y(0) - Y(d.a)} fill={aColor} rx="2" />
              <rect x={x + 1} y={Y(d.b)} width={bw} height={Y(0) - Y(d.b)} fill={bColor} rx="2" opacity=".85" />
              <text x={x} y={H - 10} fontSize="10.5" fill={C.axis} textAnchor="middle">{`${Number(d.day.slice(8))} ${M[Number(d.day.slice(5, 7)) - 1]}`}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend"><span><i style={{ background: aColor }} />{aLabel}</span><span><i style={{ background: bColor }} />{bLabel}</span></div>
    </div>
  );
}

/* ---------- dashboard building blocks (shared by Seller Central and the admin overview) ---------- */

/** "Good evening" by the viewer's clock, plus today's date. */
export function greeting(now = new Date()) {
  const h = now.getHours();
  const part = h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return { part, date: now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
}

/** One headline number with an icon badge. tone: '' | 'warn' | 'ok' */
export function Kpi({ icon, label, value, note, tone = '', small }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-top"><span>{label}</span><i className="kpi-ico"><Icon name={icon} /></i></div>
      <b className={small ? 'kpi-sm' : ''}>{value}</b>
      {note && <small>{note}</small>}
    </div>
  );
}

/** Short to-do list: each item is a sentence, a tone dot and an optional link. Empty list = all clear. */
export function Attention({ items, clear = 'Nothing needs you right now.' }) {
  if (!items.length) return <div className="attn-clear"><Icon name="check" />{clear}</div>;
  return (
    <ul className="attn">
      {items.map((it) => (
        <li key={it.key} className={it.tone || ''}>
          <span className="attn-dot" />
          <div className="attn-txt"><b>{it.title}</b>{it.text && <span>{it.text}</span>}</div>
          {it.to && <Link className="attn-go" to={it.to}>{it.action || 'Open'}<Icon name="arrow" /></Link>}
        </li>
      ))}
    </ul>
  );
}

import { Link, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import Icon from '../../app/Icons';
import { Logo } from '../components';

/** Tabs per workspace. Each tab shows only if the role holds its permission (the API re-checks every call). */
export const TABS = {
  seller: [
    { id: 'overview', label: 'Shop insights', icon: 'grid', permission: 'product:create' },
    { id: 'inventory', label: 'Product inventory', icon: 'box', permission: 'product:create' },
    { id: 'shop', label: 'My shop', icon: 'store', permission: 'shop:update_own' },
    { id: 'orders', label: 'Orders', icon: 'truck', permission: 'product:create' },
    { id: 'payments', label: 'Payments', icon: 'wallet', permission: 'product:create' },
  ],
  ops: [
    { id: 'stock', label: 'Stock levels', icon: 'box', permission: 'stock:read' },
    { id: 'orders', label: 'Orders', icon: 'truck', permission: 'order:read' },
    { id: 'refunds', label: 'Refunds', icon: 'return', permission: 'refund:approve' },
    { id: 'payments', label: 'Payments', icon: 'wallet', permission: 'payment:read' },
    { id: 'reports', label: 'Reports', icon: 'grid', permission: 'report:read' },
  ],
};

/** Seller Central and the staff Ops portal, in the BAGUETTE dashboard layout (leather top, pill, brown sidebar). */
export default function PortalLayout({ kind }) {
  const { me, can, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  if (!me) return <Outlet />;
  const tabs = TABS[kind].filter((t) => can(t.permission));
  const base = kind === 'seller' ? '/seller' : '/ops';
  const current = params.get('tab') || (tabs[0] && tabs[0].id);
  const out = async () => { await logout(); navigate(kind === 'seller' ? '/seller/login' : '/staff/login'); };

  return (
    <div className={`ws portal ${kind}`}>
      <header className="ws-top">
        <div className="ws-pill">
          <nav className="tabs">
            {tabs.slice(0, 3).map((t) => <Link key={t.id} to={`${base}?tab=${t.id}`} className={current === t.id ? 'on' : ''}>{t.label}</Link>)}
          </nav>
          <Link to="/" className="pill-logo" aria-label="Back to the store"><Logo /></Link>
          <div className="who">
            <span>{me.user.name} · {kind === 'seller' ? 'Seller Central' : me.user.role.replace('_', ' ').toLowerCase()}</span>
            <Link to="/" className="nav-icon" aria-label="View store"><Icon name="store" /></Link>
            <Link to="/account" className="nav-icon" aria-label="Your account"><Icon name="user" /></Link>
          </div>
        </div>
      </header>
      <div className="ws-body">
        <aside className="ws-side">
          <h2>{kind === 'seller' ? 'Seller Central' : 'Operations'}</h2>
          <nav>
            {tabs.map((t) => <Link key={t.id} to={`${base}?tab=${t.id}`} className={current === t.id ? 'on' : ''}><Icon name={t.icon} />{t.label}</Link>)}
          </nav>
          <div className="foot">
            <Link to="/account#security">Settings</Link>
            <button onClick={out}>Log out</button>
          </div>
        </aside>
        <main className="ws-main"><Outlet /></main>
      </div>
    </div>
  );
}

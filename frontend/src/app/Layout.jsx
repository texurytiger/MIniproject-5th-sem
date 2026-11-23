import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import modules from '../engines';
import Icon from './Icons';
import { Logo } from '../storefront/components';

/**
 * Admin console in the BAGUETTE dashboard layout: leather top with the pill, brown sidebar built from
 * every module's console nav entries. Links the role may not use are hidden (the API still re-checks every call).
 */
export default function ConsoleLayout() {
  const { me, can, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const links = modules.flatMap((m) => m.nav || []).filter((l) => l.area === 'console' && (!l.permission || can(l.permission)));
  const sections = [...new Set(links.map((l) => l.section || 'General'))];
  const top = links.filter((l) => l.top);

  if (!me || !links.length) return <div className="store-page"><Outlet /></div>;
  return (
    <div className="ws console">
      <header className="ws-top">
        <div className="ws-pill">
          <nav className="tabs">
            {top.map((l) => <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'on' : '')}>{l.label}</NavLink>)}
          </nav>
          <Link to="/" className="pill-logo" aria-label="Open the storefront"><Logo /></Link>
          <div className="who">
            <span>{me.user.name} · Admin</span>
            <a href="/" className="nav-icon" aria-label="Open storefront"><Icon name="store" /></a>
            <Link to="/account" className="nav-icon" aria-label="Your account"><Icon name="user" /></Link>
          </div>
        </div>
      </header>
      <div className="ws-body">
        <aside className="ws-side">
          <h2>Dashboard</h2>
          {sections.map((s) => (
            <div key={s} className="side-sec">
              <span className="side-sec-name">{s}</span>
              <nav>
                {links.filter((l) => (l.section || 'General') === s).map((l) => (
                  <NavLink key={l.to} to={l.to} className={() => (pathname.startsWith(l.to) ? 'on' : '')}><Icon name={l.icon} />{l.label}</NavLink>
                ))}
              </nav>
            </div>
          ))}
          <div className="foot">
            <Link to="/account#security">Settings</Link>
            <button onClick={async () => { await logout(); navigate('/admin/login'); }}>Log out</button>
          </div>
        </aside>
        <main className="ws-main console-main"><Outlet /></main>
      </div>
    </div>
  );
}

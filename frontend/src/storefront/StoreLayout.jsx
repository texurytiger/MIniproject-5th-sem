import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, homeFor } from '../app/AuthContext';
import { api } from '../app/api';
import Icon from '../app/Icons';
import { BRAND } from '../config';
import { useCart } from './cart';
import { Logo, buildTree } from './components';

/** Kept for pages that still import it (sign-in pages). */
export function Wordmark({ sub }) {
  return <span className="wordmark-bg"><Logo />{sub && <small>{sub}</small>}</span>;
}

/** Closes a popover when the route changes or the user clicks outside it. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname, search } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname, search]);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return { open, setOpen, ref };
}

function ShopMenu({ cats }) {
  const { open, setOpen, ref } = usePopover();
  const tree = buildTree(cats);
  return (
    <div className="nav-pop-wrap" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="nav-link" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">Shop <Icon name="down" /></button>
      {open && (
        <div className="nav-pop shop-pop" role="menu">
          <Link to="/s" className="shop-all">Shop everything <Icon name="arrow" /></Link>
          <div className="shop-cols">
            {tree.map((c) => (
              <div key={c.id}>
                <Link to={`/s?category=${c.slug}`} className="shop-root">{c.name}</Link>
                {c.children.map((k) => <Link key={k.id} to={`/s?category=${k.slug}`}>{k.name}</Link>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="nav-pop-wrap" ref={ref}>
      <button className="nav-icon" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label={me ? 'Your account' : 'Sign in'}>
        <Icon name="user" />
      </button>
      {open && (
        <div className="nav-pop acct-pop right" role="menu">
          {!me ? (
            <div className="acct-signin">
              <Link className="btn primary block" to="/login">Sign in</Link>
              <span className="small">New here? <Link to="/register">Create an account</Link></span>
            </div>
          ) : (
            <div className="acct-who"><b>{me.user.name}</b><span>{me.user.email}</span></div>
          )}
          <nav className="acct-links">
            <Link to="/account"><Icon name="user" />Your account</Link>
            <Link to="/account#orders"><Icon name="box" />Orders &amp; returns</Link>
            <Link to="/account#security"><Icon name="lock" />Login &amp; security</Link>
            {me && me.user.role !== 'CUSTOMER' && <Link to={homeFor(me.user.role)}><Icon name="briefcase" />Go to your workspace</Link>}
            {me && <button className="linkish" onClick={async () => { await logout(); navigate('/'); }}><Icon name="logout" />Sign out</button>}
          </nav>
        </div>
      )}
    </div>
  );
}

/** The floating pill navigation from the Canva design. */
export function PillNav({ cats }) {
  const { count } = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const [q, setQ] = useState(params.get('q') || '');
  const [searching, setSearching] = useState(false);
  const input = useRef(null);
  useEffect(() => { setQ(params.get('q') || ''); }, [params]);
  useEffect(() => { if (searching && input.current) input.current.focus(); }, [searching]);
  useEffect(() => { setSearching(false); }, [pathname]);

  const submit = (e) => {
    e.preventDefault();
    const s = new URLSearchParams();
    if (q.trim()) s.set('q', q.trim());
    if (pathname === '/s' && params.get('category')) s.set('category', params.get('category'));
    navigate(`/s?${s}`);
    setSearching(false);
  };

  return (
    <nav className={`pill ${searching ? 'searching' : ''}`} aria-label="Main">
      <div className="pill-left">
        <ShopMenu cats={cats} />
        <Link className="nav-link" to="/s?sort=rating">Collections</Link>
        <a className="nav-link" href="#about">About</a>
      </div>
      <Link to="/" className="pill-logo" aria-label={`${BRAND.name} home`}><Logo /></Link>
      <div className="pill-right">
        {searching ? (
          <form className="pill-search" onSubmit={submit} role="search">
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products"
              onKeyDown={(e) => e.key === 'Escape' && setSearching(false)} />
            <button className="nav-icon" aria-label="Search"><Icon name="search" /></button>
            <button type="button" className="nav-icon" onClick={() => setSearching(false)} aria-label="Close search"><Icon name="x" /></button>
          </form>
        ) : (
          <button className="nav-icon" onClick={() => setSearching(true)} aria-label="Search"><Icon name="search" /></button>
        )}
        <AccountMenu />
        <Link to="/cart" className="nav-icon bag" aria-label={`Bag, ${count} items`}>
          <Icon name="cart" />{count > 0 && <b>{count}</b>}
        </Link>
      </div>
    </nav>
  );
}

export default function StoreLayout() {
  const { pathname } = useLocation();
  const [cats, setCats] = useState([]);
  const home = pathname === '/';

  /*
   * Categories for the Shop menu. If the request fails (for example the page opened while the API was still
   * starting), try again after 3 s, 6 s, 12 s… instead of leaving the menu empty until a full reload.
   * Also re-check on every page change while the list is still empty.
   */
  useEffect(() => {
    if (cats.length) return undefined;
    let stop = false; let timer; let wait = 3000;
    const load = () => api('/catalog/categories', { auth: false })
      .then((d) => { if (!stop) setCats(d.categories); })
      .catch(() => { if (!stop) { timer = setTimeout(load, wait); wait = Math.min(wait * 2, 30000); } });
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [cats.length, pathname]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="store bg-store">
      <div className="strip">
        <span className="strip-msg"><Icon name="truck" />Free delivery on your first order · 7-day returns</span>
        <nav className="strip-links">
          <Link to="/seller/login">Sell with us</Link>
          <Link to="/staff/login">Staff sign-in</Link>
          <Link to="/admin/login">Admin</Link>
        </nav>
      </div>
      {home ? (
        <header className="nav-over"><PillNav cats={cats} /></header>
      ) : (
        <header className="leather-band"><PillNav cats={cats} /></header>
      )}

      <main><Outlet context={{ cats }} /></main>

      <footer className="ft bg-ft" id="about">
        <div className="ft-inner">
          <div className="ft-brand">
            <Logo />
            <p>{BRAND.tagline}</p>
            <span className="ft-handle">{BRAND.handle}</span>
            <button className="ft-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑</button>
          </div>
          <div><h4>Shop</h4><Link to="/s">All products</Link><Link to="/s?sort=rating">Collections</Link><Link to="/cart">Your bag</Link></div>
          <div><h4>Help</h4><Link to="/account">Your account</Link><Link to="/account#orders">Orders &amp; returns</Link><a href={`mailto:${BRAND.supportEmail}`}>Contact support</a></div>
          <div><h4>Sell</h4><Link to="/seller/login">Seller Central</Link><Link to="/seller/login">Open your shop</Link></div>
          <div><h4>Team</h4><Link to="/staff/login">Staff sign-in</Link><Link to="/admin/login">Admin console</Link></div>
        </div>
        <div className="ft-base"><span>© 2026 {BRAND.name}</span><span>{BRAND.footerNote}</span></div>
      </footer>
    </div>
  );
}

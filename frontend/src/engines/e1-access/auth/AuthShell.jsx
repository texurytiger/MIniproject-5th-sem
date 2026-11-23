import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../app/api';
import { PillNav } from '../../../storefront/StoreLayout';
import { BRAND } from '../../../config';

/**
 * BAGUETTE sign-in layout (Canva "Login & register"): leather background, pill navigation,
 * big headline on the left and the dark card on the right. The card content is the page's own form.
 */
export default function AuthShell({ title, sub, headline = ['Products', 'as fresh as', 'a baguette'], children, foot }) {
  const [cats, setCats] = useState([]);
  useEffect(() => { api('/catalog/categories', { auth: false }).then((d) => setCats(d.categories)).catch(() => {}); }, []);
  return (
    <div className="bg-auth">
      <header className="nav-over"><PillNav cats={cats} /></header>
      <div className="bg-auth-body">
        <div className="bg-auth-hero">
          <h1>{headline.map((l) => <span key={l} style={{ display: 'block', marginTop: 0, fontSize: 'inherit', letterSpacing: 'inherit' }}>{l}</span>)}</h1>
          <span>{BRAND.handle}</span>
        </div>
        <div className="bg-auth-card">
          <h2>{title}</h2>
          {sub && <p className="sub">{sub}</p>}
          {children}
          {foot && <div className="bg-card-foot">{foot}</div>}
        </div>
      </div>
      <footer className="bg-auth-links">
        <nav><Link to="/seller/login">Seller Central</Link><Link to="/staff/login">Staff sign-in</Link><Link to="/admin/login">Admin console</Link></nav>
        <span>© 2026 {BRAND.name}</span>
      </footer>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, homeFor } from '../../app/AuthContext';
import { api, isLocal } from '../../app/api';
import Icon from '../../app/Icons';
import { BRAND } from '../../config';
import ProductArt from '../ProductArt';
import { BagButton, Shelf } from '../components';
import { rupees } from '../cart';

/** Lock-screen clock drawn on the laptop in the hero photo. Updates every few seconds from the viewer's clock. */
function LaptopClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 5000); return () => clearInterval(t); }, []);
  const h = now.getHours() % 12 || 12;
  const time = `${h}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return (
    <div className="laptop-clock" aria-hidden="true">
      <span className="lc-date">{date}</span>
      <span className="lc-time">{time}</span>
    </div>
  );
}

/**
 * Hero from the Canva design. The photo sits on a "stage" that always keeps the photo's own shape
 * (1342 x 600), so it is never stretched; the stage is anchored bottom-right so the laptop stays in view
 * on every screen, and the clock is placed in % of the stage so it always lands on the laptop screen.
 */
function Hero({ from }) {
  return (
    <section className="bg-hero">
      <div className="bg-hero-media">
        <div className="bg-hero-stage">
          <img src="/img/hero-room-laptop.jpg" srcSet="/img/hero-room-laptop.jpg 1342w, /img/hero-room-laptop-2x.jpg 2684w"
            sizes="(min-width: 1180px) 100vw, 1260px" alt="" fetchpriority="high" />
          <LaptopClock />
        </div>
      </div>
      <div className="bg-hero-panel">
        <span className="bg-hero-eyebrow">Tech by {BRAND.name}</span>
        <h1>Built for performance{from ? <><br />from {rupees(from).replace('₹', 'Rs. ')}*</> : null}</h1>
        <p className="bg-hero-note">Free delivery on your first order · 7-day returns</p>
        <Link className="bg-btn cream" to="/s?category=electronics">Shop the collection</Link>
        <span className="bg-hero-handle">{BRAND.handle}</span>
      </div>
    </section>
  );
}

/** Dark band under the hero: two picks with a bag button each. */
function Curated({ picks, title = 'Curated pieces', sub = 'Something for every you' }) {
  if (!picks.length) return null;
  return (
    <section className="bg-curated">
      <Link to="/s?sort=rating" className="bg-curated-title">
        <h2>{title}</h2>
        <span>{sub}</span>
        <Icon name="arrow" />
      </Link>
      {picks.map((p) => (
        <Link key={p.id} to={`/p/${p.id}`} className="bg-curated-item">
          <div className="bg-curated-img"><ProductArt image={p.image} imageUrl={p.imageUrl} label={p.name} /></div>
          <div className="bg-curated-txt">
            <b>{p.name}</b>
            <span>{rupees(p.price).replace('₹', 'Rs. ')}</span>
          </div>
          <BagButton p={p} />
        </Link>
      ))}
    </section>
  );
}

function Categories({ cats }) {
  const tops = cats.filter((c) => !c.parentId);
  const subs = cats.filter((c) => c.parentId && c.total > 0);
  const show = [...tops, ...subs].slice(0, 6);
  return (
    <section className="cats">
      <div className="sec-head"><h2>Shop by category</h2><Link to="/s">View all <Icon name="arrow" /></Link></div>
      <div className="cat-grid">
        {show.map((c) => (
          <Link key={c.slug} to={`/s?category=${c.slug}`} className="cat-tile">
            <div className="cat-art">{c.coverImage ? <ProductArt imageUrl={c.coverImage} label={c.name} /> : <span className="cat-empty">{c.name[0]}</span>}</div>
            <b>{c.name}</b>
            <span>{c.total} product{c.total === 1 ? '' : 's'}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AccountBand() {
  const { me } = useAuth();
  if (!me) {
    return (
      <section className="band">
        <div><h3>Sign in for order tracking and a faster checkout.</h3><p>Your bag, orders and returns, all in one place.</p></div>
        <div className="band-acts"><Link to="/login" className="bg-btn cream">Sign in</Link><Link to="/register" className="bg-btn outline-light">Create account</Link></div>
      </section>
    );
  }
  const first = me.user.name.split(' ')[0];
  return (
    <section className="band">
      <div><h3>Welcome back, {first}.</h3><p>Pick up where you left off.</p></div>
      <div className="band-acts">
        <Link to="/account#orders" className="bg-btn outline-light"><Icon name="box" />Orders</Link>
        <Link to="/cart" className="bg-btn outline-light"><Icon name="cart" />Bag</Link>
        {me.user.role !== 'CUSTOMER' && <Link to={homeFor(me.user.role)} className="bg-btn cream"><Icon name="briefcase" />Your workspace</Link>}
      </div>
    </section>
  );
}

/** Shown when the catalog can't be loaded: says plainly the problem is ours, and offers a retry. */
function LoadError({ error, retry }) {
  return (
    <div className="load-error">
      <Icon name="info" />
      <h2>We couldn't load the store right now</h2>
      <p>This is a problem on our side, not yours. Please try again in a moment.</p>
      <button className="btn primary" onClick={retry}><Icon name="refresh" />Try again</button>
      {isLocal && error.devInfo && <p className="dev-hint">For developers: {error.devInfo}</p>}
    </div>
  );
}

export default function HomePage() {
  const [products, setProducts] = useState(null);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null); setProducts(null);
    Promise.all([api('/catalog/products?limit=60', { auth: false }), api('/catalog/categories', { auth: false })])
      .then(([p, c]) => { setProducts(p.products); setCats(c.categories); })
      .catch((e) => setError(e));
  }, []);
  useEffect(() => { load(); }, [load]);

  const list = products || [];
  const best = [...list].sort((a, b) => b.reviews - a.reviews).slice(0, 12);
  const rated = [...list].sort((a, b) => b.rating - a.rating).slice(0, 12);
  const picks = list.filter((p) => p.featured).slice(0, 2);
  const tech = list.filter((p) => p.categories.includes('electronics'));
  const from = tech.length ? Math.min(...tech.map((p) => Number(p.price))) : null;

  return (
    <div className="home">
      <Hero from={from} />
      <Curated picks={picks.length ? picks : list.slice(0, 2)} />
      <div className="home-body">
        {error ? <LoadError error={error} retry={load} /> : products === null ? (
          <div className="cat-grid">{[0, 1, 2, 3, 4, 5].map((k) => <div key={k} className="cat-tile skeleton" />)}</div>
        ) : (
          <>
            <Categories cats={cats} />
            <Shelf title="Best sellers" link="/s" products={best} />
            <AccountBand />
            <Shelf title="Loved by customers" link="/s?sort=rating" products={rated} />
            <section className="seller-band">
              <div>
                <span className="eyebrow">Sell with {BRAND.name}</span>
                <h3>Your shop, your banner, your best pieces up front.</h3>
                <p>Open a shop page, choose your featured products and watch how your catalog is doing from Seller Central. Only you can change your listings: the server checks ownership on every edit.</p>
              </div>
              <Link to="/seller/login" className="bg-btn dark">Open Seller Central<Icon name="arrow" /></Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

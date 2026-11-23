import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../app/Icons';
import ProductArt from './ProductArt';
import { cart, off, rupees } from './cart';

/** BAGUETTE wordmark: Helvetica Now Bold with only the E in italics, as in the Canva logo. */
export function Logo({ className = '' }) {
  return <span className={`bg-logo ${className}`} aria-label="BAGUETTE">BAGU<i>E</i>TTE</span>;
}

export function Stars({ value, count }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="stars" title={`${value} out of 5`}>
      <span className="stars-bar" aria-hidden><span style={{ width: `${pct}%` }} /></span>
      <span className="stars-n">{Number(value).toFixed(1)}</span>
      {count != null && <span className="stars-c">({Number(count).toLocaleString('en-IN')})</span>}
    </span>
  );
}

export function Price({ p, size }) {
  const pct = off(p);
  return (
    <div className={`price ${size || ''}`}>
      {pct > 0 && <span className="price-off">−{pct}%</span>}
      <span className="price-now"><sup>₹</sup>{Number(p.price).toLocaleString('en-IN')}</span>
      {pct > 0 && <span className="price-mrp">M.R.P. <s>{rupees(p.mrp)}</s></span>}
    </div>
  );
}

/** Small bag button on every card: adds one to the browser cart and confirms for a moment. */
export function BagButton({ p }) {
  const [added, setAdded] = useState(false);
  if (p.status === 'SOLD_OUT' || p.stock === 0) return <span className="bag-btn off" title="Sold out"><Icon name="cart" /></span>;
  return (
    <button
      type="button"
      className={`bag-btn ${added ? 'done' : ''}`}
      aria-label={`Add ${p.name} to bag`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); cart.add(p); setAdded(true); setTimeout(() => setAdded(false), 1400); }}
    >
      <Icon name={added ? 'check' : 'cart'} />
    </button>
  );
}

/** Product card: cream photo tile, name with bag button, rating, price (BAGUETTE grid style + the old rating/price block). */
export function ProductCard({ p }) {
  return (
    <Link to={`/p/${p.id}`} className="pcard">
      <div className="pcard-img">
        <ProductArt image={p.image} imageUrl={p.imageUrl} category={p.category} label={p.name} />
        {p.status === 'SOLD_OUT' && <span className="pcard-tag">Sold out</span>}
      </div>
      <div className="pcard-body">
        <div className="pcard-row">
          <span className="pcard-name">{p.name}</span>
          <BagButton p={p} />
        </div>
        <Stars value={p.rating} count={p.reviews} />
        <Price p={p} />
        {p.stock > 0 && p.stock <= 15 && <span className="pcard-low">Only {p.stock} left in stock</span>}
      </div>
    </Link>
  );
}

/** Horizontal product shelf with scroll buttons. */
export function Shelf({ title, link, linkText = 'See all', products }) {
  const ref = useRef(null);
  const scroll = (d) => ref.current && ref.current.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  if (!products.length) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>{title}</h2>
        {link && <Link to={link}>{linkText} <Icon name="chevron" /></Link>}
      </div>
      <div className="shelf-wrap">
        <button className="shelf-btn l" onClick={() => scroll(-1)} aria-label="Scroll left"><Icon name="chevron" /></button>
        <div className="shelf-row" ref={ref}>
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
        <button className="shelf-btn r" onClick={() => scroll(1)} aria-label="Scroll right"><Icon name="chevron" /></button>
      </div>
    </section>
  );
}

/** Builds the category tree from the flat list the API returns. */
export function buildTree(cats) {
  const by = new Map(cats.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];
  by.forEach((c) => (c.parentId && by.has(c.parentId) ? by.get(c.parentId).children.push(c) : roots.push(c)));
  const sort = (list) => list.sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => sort(c.children));
  sort(roots);
  return roots;
}

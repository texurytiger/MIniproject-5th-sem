import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../app/api';
import Icon from '../../app/Icons';
import { ProductCard } from '../components';

/** Public shop page: banner, logo, about, featured products first, return policy. Everything comes from the seller's "My shop" tab. */
export default function ShopPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null); setError('');
    api(`/shops/${slug}`, { auth: false }).then(setData).catch((e) => setError(e.status === 404 ? 'This shop does not exist.' : e.message));
  }, [slug]);

  if (error) return <div className="store-page"><div className="denied"><h1>{error}</h1><Link className="btn" to="/">Back to the homepage</Link></div></div>;
  if (!data) return <div className="store-page"><div className="center muted">Loading…</div></div>;
  const { shop, products } = data;
  const featured = products.filter((p) => p.featured);
  const rest = products.filter((p) => !p.featured);

  return (
    <div className="store-page shop-page">
      <section className="shop-hero" style={shop.bannerUrl ? { backgroundImage: `url(${shop.bannerUrl})` } : undefined}>
        <div className="shop-id">
          <div className="shop-logo">{shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : <span>{shop.name[0]}</span>}</div>
          <div>
            <span className="eyebrow light">Shop on BAGUETTE</span>
            <h1>{shop.name}</h1>
            <span className="shop-count">{products.length} product{products.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </section>
      {shop.about && <p className="shop-about">{shop.about}</p>}
      {featured.length > 0 && (
        <section className="shop-sec">
          <h2>Featured</h2>
          <div className="results">{featured.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}
      {rest.length > 0 && (
        <section className="shop-sec">
          <h2>{featured.length ? 'More from this shop' : 'All products'}</h2>
          <div className="results">{rest.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}
      {shop.returnPolicy && (
        <section className="shop-policy">
          <h3><Icon name="return" />Return policy</h3>
          <p>{shop.returnPolicy}</p>
        </section>
      )}
    </div>
  );
}

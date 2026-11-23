import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../app/api';
import Icon from '../../app/Icons';
import { ProductCard, buildTree } from '../components';

const SORTS = { featured: 'Featured', price_asc: 'Price: low to high', price_desc: 'Price: high to low', rating: 'Avg. customer review', newest: 'Newest' };
const PRICE_STEPS = [
  { label: 'Under Rs. 10k', max: 10000 },
  { label: 'Rs. 10k – 60k', min: 10000, max: 60000 },
  { label: 'Rs. 60k – 1L', min: 60000, max: 100000 },
  { label: 'Over Rs. 1L', min: 100000 },
];

/** Shop page: the kept layout (results bar, filters, grid) in the BAGUETTE filter-panel style. Filters run on the server. */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'featured';
  const minRating = params.get('minRating') || '';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);                      // filter drawer on small screens

  useEffect(() => { api('/catalog/categories', { auth: false }).then((d) => setCats(d.categories)).catch(() => {}); }, []);
  useEffect(() => {
    setData(null);
    const s = new URLSearchParams({ limit: 60 });
    ['q', 'category', 'sort', 'minRating', 'minPrice', 'maxPrice'].forEach((k) => params.get(k) && s.set(k, params.get(k)));
    api(`/catalog/products?${s}`, { auth: false }).then(setData).catch((e) => setData({ products: [], error: e.message }));
  }, [params]);

  const tree = useMemo(() => buildTree(cats), [cats]);
  const set = (changes) => {
    const s = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v === '' || v == null ? s.delete(k) : s.set(k, v)));
    setParams(s);
  };
  const cat = cats.find((c) => c.slug === category);
  const shown = data ? data.products : [];
  const priceOn = (st) => String(st.min || '') === minPrice && String(st.max || '') === maxPrice;
  const anyFilter = category || minRating || minPrice || maxPrice;

  return (
    <div className="store-page search">
      <div className="search-bar">
        <span>
          {data ? <>{shown.length} result{shown.length === 1 ? '' : 's'}</> : 'Searching…'}
          {(data && data.correctedQuery) ? <> for <b>"{data.correctedQuery}"</b></> : q ? <> for <b>"{q}"</b></> : null}
          {cat && <> in <b>{cat.name}</b></>}
        </span>
        <div className="search-bar-r">
          <button className="bg-btn outline small filters-toggle" onClick={() => setOpen(!open)}><Icon name="menu" />Filters</button>
          <label className="sort">Sort by
            <select value={sort} onChange={(e) => set({ sort: e.target.value === 'featured' ? '' : e.target.value })}>
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
      </div>
      {data && data.correctedQuery && (
        <div className="did-you-mean">
          Showing results for <b>{data.correctedQuery}</b>. No matches for <s>{q}</s>; our search corrected the spelling.
        </div>
      )}
      <div className="search-grid">
        <aside className={`filter-panel ${open ? 'open' : ''}`} aria-label="Filters">
          <div className="fp-head"><h3>Filter by</h3>{anyFilter && <button className="fp-clear" onClick={() => set({ category: '', minRating: '', minPrice: '', maxPrice: '' })}>Clear</button>}</div>

          <h4>Category</h4>
          <div className="fp-chips">
            <button className={!category ? 'on' : ''} onClick={() => set({ category: '' })}>All</button>
            {tree.map((c) => <button key={c.id} className={category === c.slug ? 'on' : ''} onClick={() => set({ category: c.slug })}>{c.name}</button>)}
          </div>
          {tree.filter((c) => c.children.length).map((c) => (
            <div key={c.id} className="fp-sub">
              <span>{c.name}</span>
              <div className="fp-chips small">
                {c.children.map((k) => <button key={k.id} className={category === k.slug ? 'on' : ''} onClick={() => set({ category: k.slug })}>{k.name}</button>)}
              </div>
            </div>
          ))}

          <h4>Price</h4>
          <div className="fp-chips">
            {PRICE_STEPS.map((st) => (
              <button key={st.label} className={priceOn(st) ? 'on' : ''}
                onClick={() => set(priceOn(st) ? { minPrice: '', maxPrice: '' } : { minPrice: st.min || '', maxPrice: st.max || '' })}>{st.label}</button>
            ))}
          </div>
          {data && data.priceRange && <p className="fp-note">Prices in store: Rs. {data.priceRange.min.toLocaleString('en-IN')} – Rs. {data.priceRange.max.toLocaleString('en-IN')}</p>}

          <h4>Customer review</h4>
          <div className="fp-chips">
            {[['4', '4★ & up'], ['3', '3★ & up'], ['', 'Any rating']].map(([v, label]) => (
              <button key={label} className={minRating === v ? 'on' : ''} onClick={() => set({ minRating: v })}>{label}</button>
            ))}
          </div>
        </aside>
        <section>
          {data && data.error && <div className="alert error"><Icon name="alert" />{data.error}</div>}
          {data && !shown.length && !data.error && (
            <div className="no-results">
              <h2>No results{q ? <> for "{q}"</> : ''}</h2>
              <p className="muted">Check the spelling, try a more general word, remove a filter, or <Link to="/s">browse every product</Link>.</p>
            </div>
          )}
          <div className="results">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../app/api';
import Icon from '../../../app/Icons';
import { buildTree } from '../../../storefront/components';

/** Every category NOT inside `id`'s own branch can be its parent (the server re-checks for loops: 409 CYCLE). */
function parentOptions(cats, id) {
  const banned = new Set([id]);
  let grew = true;
  while (grew) { grew = false; cats.forEach((c) => { if (c.parentId && banned.has(c.parentId) && !banned.has(c.id)) { banned.add(c.id); grew = true; } }); }
  return cats.filter((c) => !banned.has(c.id));
}

function Node({ c, cats, onChanged, depth }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(c.name);
  const [parentId, setParentId] = useState(c.parentId || '');
  const [msg, setMsg] = useState(null);
  async function save() {
    setMsg(null);
    try { await api(`/admin/categories/${c.id}`, { method: 'PUT', body: { name, parentId: parentId === '' ? null : Number(parentId) } }); setEdit(false); onChanged(); } catch (e) { setMsg(e.message); }
  }
  async function remove() {
    setMsg(null);
    try { await api(`/admin/categories/${c.id}`, { method: 'DELETE' }); onChanged(); } catch (e) { setMsg(e.message); }
  }
  return (
    <li>
      <div className="tree-row">
        {edit ? (
          <div className="row-actions">
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Category name" style={{ maxWidth: 220 }} />
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} aria-label="Parent category">
              <option value="">(top level)</option>
              {parentOptions(cats, c.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        ) : (
          <div className="nm"><b>{c.name}</b><code>{c.slug}</code>{depth === 0 && <span className="badge">top level</span>}</div>
        )}
        <span className="small muted">{c.products} product{c.products === 1 ? '' : 's'}{c.subCount ? ` · ${c.subCount} sub-categor${c.subCount === 1 ? 'y' : 'ies'}` : ''}</span>
        <div className="row-actions">
          {edit ? (
            <><button className="btn small primary" onClick={save}>Save</button><button className="btn small" onClick={() => { setEdit(false); setName(c.name); setParentId(c.parentId || ''); }}>Cancel</button></>
          ) : (
            <><button className="btn small" onClick={() => setEdit(true)}><Icon name="edit" />Edit</button><button className="btn small" onClick={remove} title="Only empty categories can be deleted">Delete</button></>
          )}
        </div>
      </div>
      {msg && <div className="alert error" style={{ margin: '0 0 10px' }}><Icon name="alert" />{msg}</div>}
      {c.kids.length > 0 && <ul className="tree-list">{c.kids.map((k) => <Node key={k.id} c={k} cats={cats} onChanged={onChanged} depth={depth + 1} />)}</ul>}
    </li>
  );
}

/** Admin category manager: create, rename, move (any depth, no loops) and delete empty categories. */
export default function CategoriesPage() {
  const [cats, setCats] = useState(null);
  const [form, setForm] = useState({ name: '', parentId: '' });
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api('/admin/categories').then((d) => setCats(d.categories.map(({ children, ...c }) => ({ ...c, subCount: children })))).catch((e) => setMsg({ err: e.message })), []);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault(); setMsg(null);
    try {
      const r = await api('/admin/categories', { method: 'POST', body: { name: form.name, parentId: form.parentId === '' ? null : Number(form.parentId) } });
      setMsg({ ok: `Added "${form.name}" (/${r.slug}).` }); setForm({ name: '', parentId: form.parentId }); load();
    } catch (ex) { setMsg({ err: ex.message }); }
  }
  const withKids = (list) => buildTree(list).map(function map(c) { return { ...c, kids: c.children.map(map) }; });

  return (
    <>
      <div className="ws-head">
        <div><h1>Categories</h1><p>Organise the catalog: categories can sit inside other categories (Dairy › Milk), and a product can be in several.</p></div>
      </div>
      <form className="ws-card" onSubmit={add}>
        <h2>Add a category</h2>
        <p className="muted">Sellers tick these on their products. The web address is made from the name.</p>
        <div className="row-actions">
          <input placeholder="e.g. Dairy" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="New category name" style={{ maxWidth: 260 }} />
          <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} aria-label="Inside">
            <option value="">Top level</option>
            {(cats || []).map((c) => <option key={c.id} value={c.id}>Inside {c.name}</option>)}
          </select>
          <button className="btn primary" disabled={form.name.trim().length < 2}><Icon name="check" />Add category</button>
          {msg && msg.ok && <span className="inv-msg ok"><Icon name="check" />{msg.ok}</span>}
          {msg && msg.err && <span className="inv-msg err">{msg.err}</span>}
        </div>
      </form>
      <section className="ws-card">
        <h2>Category tree</h2>
        <p className="muted">Moving a category under one of its own sub-categories is refused, because it would create a loop.</p>
        {cats ? <ul className="tree-list">{withKids(cats).map((c) => <Node key={c.id} c={c} cats={cats} onChanged={load} depth={0} />)}</ul> : <p className="muted">Loading…</p>}
      </section>
    </>
  );
}

/**
 * Catalog, shop and dashboard API.
 * Browsing is public (like any store). Every write goes through guard(), including the FR-10 ownership checks.
 * E2 will take over catalog business logic in Sprint 2; the guards stay exactly as they are.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const data = require('../e3-data');
const { guard, requireUser } = require('../e1-access/session');
const typo = require('../e1-search/typo');
const { HttpError, wrap, validator, toInt } = require('../../core/http');

const r = express.Router();
const LOW_STOCK = 15;                                           // "low stock" line used by sellers, warehouse and admin
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

/* ---------- helpers ---------- */
const ownerOfProduct = async (req) => {
  const p = await data.catalog.byId(toInt(req.params.id));
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'Product not found.');
  req.product = p;
  return p.sellerId;
};
const self = (req) => req.user.id;                              // "my own" resources (the shop) belong to the caller

/** Category tree helpers: children map, all ids under a category (iterative DFS), loop check before a parent change. */
function childrenMap(cats) {
  const m = new Map(cats.map((c) => [c.id, []]));
  cats.forEach((c) => c.parentId && m.has(c.parentId) && m.get(c.parentId).push(c.id));
  return m;
}
function subtreeIds(cats, rootId) {
  const kids = childrenMap(cats); const out = []; const seen = new Set(); const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id); out.push(id);
    (kids.get(id) || []).forEach((k) => stack.push(k));
  }
  return out;
}
const wouldLoop = (cats, id, newParentId) => newParentId != null && subtreeIds(cats, id).includes(newParentId);

const num = (v) => (v === undefined || v === '' ? null : Number(v));

/* ---------- public storefront ---------- */
/** Categories with direct counts AND rolled-up counts (a parent counts every distinct product in its whole branch). */
r.get('/catalog/categories', wrap(async (_req, res) => {
  const [cats, products] = await Promise.all([data.catalog.categories(), data.catalog.storefront({ limit: 1000 })]);
  const bySlug = new Map(cats.map((c) => [c.slug, c]));
  const categories = cats.map((c) => {
    const ids = new Set(subtreeIds(cats, c.id));
    const inBranch = products.filter((p) => p.categories.some((s) => bySlug.get(s) && ids.has(bySlug.get(s).id)));
    const cover = inBranch.find((p) => p.imageUrl);
    return { ...c, products: Number(c.products), total: inBranch.length, coverImage: cover ? cover.imageUrl : null };
  });
  res.json({ categories });
}));

r.get('/catalog/products', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const slug = SLUG.test(req.query.category || '') ? req.query.category : null;
  const limit = Math.min(60, Math.max(1, toInt(req.query.limit) || 24));
  const sort = ['featured', 'price_asc', 'price_desc', 'rating', 'newest'].includes(req.query.sort) ? req.query.sort : 'featured';
  const minPrice = num(req.query.minPrice); const maxPrice = num(req.query.maxPrice); const minRating = num(req.query.minRating);
  validator()
    .check(minPrice === null || (Number.isFinite(minPrice) && minPrice >= 0), 'minPrice', 'must be 0 or more')
    .check(maxPrice === null || (Number.isFinite(maxPrice) && maxPrice >= 0), 'maxPrice', 'must be 0 or more')
    .check(minPrice === null || maxPrice === null || minPrice <= maxPrice, 'maxPrice', 'must be at least the minimum price')
    .check(minRating === null || (Number.isFinite(minRating) && minRating >= 0 && minRating <= 5), 'minRating', 'must be between 0 and 5')
    .throwIfAny();
  let categoryIds = null;
  if (slug) {
    const cats = await data.categories.all();
    const root = cats.find((c) => c.slug === slug);
    categoryIds = root ? subtreeIds(cats, root.id) : [-1];       // unknown category: no results, not "everything"
  }
  const opts = { categoryIds, limit, sort, minPrice, maxPrice, minRating };
  let products = await data.catalog.storefront({ ...opts, q });
  let correctedQuery = null;
  if (q && !products.length) {                       // nothing found: let E1 fix the typo and try once more
    correctedQuery = await typo.correct(q);
    if (correctedQuery) products = await data.catalog.storefront({ ...opts, q: correctedQuery });
  }
  res.json({ products, correctedQuery, priceRange: await data.catalog.priceRange() });
}));

r.get('/catalog/products/:id', wrap(async (req, res) => {
  const p = await data.catalog.byId(toInt(req.params.id));
  if (!p || p.status === 'PENDING') throw new HttpError(404, 'NOT_FOUND', 'Product not found.');
  res.json({ product: p });
}));

/** Public shop page: the shop's details and its visible products, featured first. */
r.get('/shops/:slug', wrap(async (req, res) => {
  const shop = SLUG.test(req.params.slug) ? await data.shops.bySlug(req.params.slug) : null;
  if (!shop) throw new HttpError(404, 'NOT_FOUND', 'Shop not found.');
  const products = (await data.catalog.bySeller(shop.sellerId)).filter((p) => p.status !== 'PENDING')
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.id - b.id);
  res.json({ shop, products });
}));

/* ---------- seller ---------- */
r.get('/seller/products', requireUser, guard('product', 'create'), wrap(async (req, res) => {
  res.json({ products: await data.catalog.bySeller(req.user.id) });
}));

/** FR-10: a seller holds product:update_own only, so this passes for their own rows and is 403 NOT_OWNER otherwise. */
r.patch('/catalog/products/:id', requireUser, guard('product', 'update', ownerOfProduct), wrap(async (req, res) => {
  const price = req.body.price === undefined ? null : Number(req.body.price);
  const stock = req.body.stock === undefined ? null : toInt(req.body.stock);
  validator()
    .check(price === null || (Number.isFinite(price) && price >= 0 && price <= 10000000), 'price', 'must be 0 or more')
    .check(stock === null || (Number.isInteger(stock) && stock >= 0 && stock <= 100000), 'stock', 'must be a whole number, 0 or more')
    .throwIfAny();
  await data.catalog.updatePriceStock(req.product.id, { price, stock });
  res.json({ product: await data.catalog.byId(req.product.id) });
}));

/** Put a product in one or more categories (all replaced in one transaction). Own products only. */
r.put('/seller/products/:id/categories', requireUser, guard('product', 'update', ownerOfProduct), wrap(async (req, res) => {
  const ids = Array.isArray(req.body.categoryIds) ? [...new Set(req.body.categoryIds.map(toInt))] : null;
  const known = new Set((await data.categories.all()).map((c) => c.id));
  validator()
    .check(ids && ids.length >= 1 && ids.length <= 8, 'categoryIds', 'pick between 1 and 8 categories')
    .check(!ids || ids.every((i) => known.has(i)), 'categoryIds', 'contains a category that does not exist')
    .throwIfAny();
  await data.catalog.setCategories(req.product.id, ids);
  res.json({ product: await data.catalog.byId(req.product.id) });
}));

/** Featured products show first on the seller's shop page. */
r.put('/seller/products/:id/featured', requireUser, guard('product', 'update', ownerOfProduct), wrap(async (req, res) => {
  validator().check(typeof req.body.featured === 'boolean', 'featured', 'must be true or false').throwIfAny();
  await data.catalog.setFeatured(req.product.id, req.body.featured);
  res.json({ product: await data.catalog.byId(req.product.id) });
}));

/** The seller's own shop settings. shop:update_own -> GRANTED_OWN because the owner is the caller. */
r.get('/seller/shop', requireUser, guard('shop', 'update', self), wrap(async (req, res) => {
  res.json({ shop: await data.shops.bySeller(req.user.id) });
}));

r.put('/seller/shop', requireUser, guard('shop', 'update', self), wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const slug = String(req.body.slug || '').trim().toLowerCase();
  const about = String(req.body.about || '').trim();
  const returnPolicy = String(req.body.returnPolicy || '').trim();
  validator()
    .check(name.length >= 2 && name.length <= 80, 'name', 'must be 2 to 80 characters')
    .check(SLUG.test(slug) && slug.length >= 3 && slug.length <= 60, 'slug', 'use 3 to 60 lowercase letters, digits and dashes, e.g. kavya-crafts')
    .check(about.length <= 600, 'about', 'must be 600 characters or fewer')
    .check(returnPolicy.length <= 1000, 'returnPolicy', 'must be 1000 characters or fewer')
    .throwIfAny();
  if (await data.shops.slugTaken(slug, req.user.id)) throw new HttpError(409, 'SLUG_TAKEN', 'Another shop already uses that web address.', { slug: 'already taken' });
  await data.shops.upsert(req.user.id, { slug, name, about, returnPolicy });
  res.json({ shop: await data.shops.bySeller(req.user.id) });
}));

/**
 * Logo / banner upload. The body is the raw image (Content-Type image/png, image/jpeg or image/webp), max 2 MB.
 * The file type is checked from its first bytes, not trusted from the header.
 */
const MAGIC = [
  { ext: 'png', ok: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'jpg', ok: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'webp', ok: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];
r.post('/seller/shop/:field(logo|banner)', requireUser, guard('shop', 'update', self),
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '2mb' }),
  wrap(async (req, res) => {
    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    const kind = buf && MAGIC.find((m) => m.ok(buf));
    if (!kind) throw new HttpError(400, 'VALIDATION', 'Upload a PNG, JPG or WebP image (up to 2 MB).', { file: 'not a PNG, JPG or WebP image' });
    if (!(await data.shops.bySeller(req.user.id))) throw new HttpError(409, 'NO_SHOP', 'Save your shop details first, then add images.');
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const file = `shop-${req.user.id}-${req.params.field}-${Date.now()}.${kind.ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
    await data.shops.setImage(req.user.id, req.params.field, `/api/uploads/${file}`);
    res.json({ shop: await data.shops.bySeller(req.user.id) });
  }));

/** Seller insights: real catalog numbers now; sales numbers once E2 builds orders. */
const SALES_PENDING = { available: false, reason: 'Sales appear here once checkout and orders are built (E2).', series: [] };
r.get('/seller/stats', requireUser, guard('product', 'create'), wrap(async (req, res) => {
  const [products, statusCounts, cats] = await Promise.all([
    data.catalog.bySeller(req.user.id), data.catalog.statusCounts(req.user.id), data.categories.all()]);
  const mix = cats.map((c) => ({ slug: c.slug, name: c.name, parentId: c.parentId, n: products.filter((p) => p.categories.includes(c.slug)).length }))
    .filter((c) => c.n > 0);
  res.json({
    lowStockThreshold: LOW_STOCK,
    statusCounts,
    products: products.map(({ id, name, stock, status, price, imageUrl, categories, featured }) => ({ id, name, stock, status, price, imageUrl, categories, featured })),
    stockValue: products.reduce((s, p) => s + Number(p.price) * p.stock, 0),
    categoryMix: mix,
    sales: SALES_PENDING,
  });
}));

r.get('/seller/products/:id/stats', requireUser, guard('product', 'update', ownerOfProduct), wrap(async (req, res) => {
  res.json({ product: req.product, sales: SALES_PENDING });
}));

/* ---------- staff / admin ---------- */
r.get('/ops/stock', requireUser, guard('stock', 'read'), wrap(async (_req, res) => res.json({ products: await data.catalog.all() })));

/** Warehouse stock correction: needs stock:update (warehouse staff, admin). Sellers use the PATCH above instead. */
r.patch('/ops/stock/:id', requireUser, guard('stock', 'update'), wrap(async (req, res) => {
  const id = toInt(req.params.id);
  const stock = toInt(req.body.stock);
  validator().check(Number.isInteger(stock) && stock >= 0 && stock <= 100000, 'stock', 'must be a whole number, 0 or more').throwIfAny();
  if (!(await data.catalog.byId(id))) throw new HttpError(404, 'NOT_FOUND', 'Product not found.');
  await data.catalog.updatePriceStock(id, { price: null, stock });
  res.json({ product: await data.catalog.byId(id) });
}));

r.put('/catalog/products/:id/approve', requireUser, guard('product', 'approve'), wrap(async (req, res) => {
  await data.catalog.approve(toInt(req.params.id));
  res.json({ product: await data.catalog.byId(toInt(req.params.id)) });
}));

/** Admin category manager (category:manage). */
r.get('/admin/categories', requireUser, guard('category', 'manage'), wrap(async (_req, res) => {
  const cats = await data.catalog.categories();
  const usage = await Promise.all(cats.map((c) => data.categories.usage(c.id)));
  res.json({ categories: cats.map((c, i) => ({ ...c, products: usage[i].products, children: usage[i].children })) });
}));

function readCategory(body, cats) {
  const name = String(body.name || '').trim();
  const parentId = body.parentId === null || body.parentId === undefined || body.parentId === '' ? null : toInt(body.parentId);
  validator()
    .check(name.length >= 2 && name.length <= 60, 'name', 'must be 2 to 60 characters')
    .check(parentId === null || cats.some((c) => c.id === parentId), 'parentId', 'that parent category does not exist')
    .throwIfAny();
  return { name, parentId };
}

r.post('/admin/categories', requireUser, guard('category', 'manage'), wrap(async (req, res) => {
  const cats = await data.categories.all();
  const { name, parentId } = readCategory(req.body, cats);
  const slug = String(req.body.slug || name).trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  validator().check(SLUG.test(slug), 'slug', 'could not make a web address from that name').throwIfAny();
  if (cats.some((c) => c.slug === slug)) throw new HttpError(409, 'SLUG_TAKEN', `A category called "${slug}" already exists.`, { name: 'already exists' });
  const id = await data.categories.create({ slug, name, parentId });
  res.status(201).json({ id, slug });
}));

r.put('/admin/categories/:id', requireUser, guard('category', 'manage'), wrap(async (req, res) => {
  const id = toInt(req.params.id);
  const cats = await data.categories.all();
  const cat = cats.find((c) => c.id === id);
  if (!cat) throw new HttpError(404, 'NOT_FOUND', 'Category not found.');
  const { name, parentId } = readCategory(req.body, cats);
  if (wouldLoop(cats, id, parentId)) {
    const parent = cats.find((c) => c.id === parentId);
    throw new HttpError(409, 'CYCLE', `Rejected: "${parent.name}" sits inside "${cat.name}", so this would create a loop.`);
  }
  await data.categories.update(id, { name, parentId });
  res.json({ ok: true });
}));

r.delete('/admin/categories/:id', requireUser, guard('category', 'manage'), wrap(async (req, res) => {
  const id = toInt(req.params.id);
  if (!(await data.categories.all()).some((c) => c.id === id)) throw new HttpError(404, 'NOT_FOUND', 'Category not found.');
  const u = await data.categories.usage(id);
  if (u.products || u.children) {
    throw new HttpError(409, 'IN_USE', `Move its ${u.products} product link(s) and ${u.children} sub-categor${u.children === 1 ? 'y' : 'ies'} first.`, u);
  }
  await data.categories.remove(id);
  res.status(204).end();
}));

/** Admin overview: real numbers only. Orders/revenue say so plainly until E2 exists. */
r.get('/admin/overview', requireUser, guard('role', 'manage'), wrap(async (_req, res) => {
  const [counts, roleRows, statusCounts, lowStock, cats, decisions, denials] = await Promise.all([
    data.users.countByRole(), data.roles.all(), data.catalog.statusCounts(), data.catalog.lowStockCount(LOW_STOCK), data.categories.all(),
    data.stats.decisionsByDay(7), data.stats.topDenials(5)]);
  res.json({
    usersByRole: roleRows.map((x) => ({ name: x.name, n: Number(counts.get(x.id) || 0) })), statusCounts, lowStock, lowStockThreshold: LOW_STOCK, categories: cats.length,
    decisionsByDay: decisions, topDenials: denials, orders: SALES_PENDING,
  });
}));

module.exports = r;

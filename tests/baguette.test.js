/**
 * BAGUETTE redesign tests: categories (tree + many-to-many), shops, seller insights, admin overview.
 *   npm run db:reset && npm run dev     (terminal 1)
 *   node --test tests/baguette.test.js  (terminal 2)
 */
const test = require('node:test');
const assert = require('node:assert');

const BASE = process.env.API || 'http://localhost:4000/api';
const PW = 'Password@123';

async function call(method, path, { body, token, raw, type } = {}) {
  const headers = { 'Content-Type': type || 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}
const login = async (email, role, portal = 'staff') => (await call('POST', '/auth/login', { body: { email, password: PW, portal, role } })).data.token;
const ids = (r) => r.data.products.map((p) => p.id);

/* ---------------- categories ---------------- */
test('TC-BG-01 one product sits in several categories', async () => {
  const p = (await call('GET', '/catalog/products/2')).data.product;
  assert.deepEqual([...p.categories].sort(), ['audio', 'electronics']);
  assert.ok(ids(await call('GET', '/catalog/products?category=audio&limit=60')).includes(2));
});

test('TC-BG-02 filtering a parent category includes its sub-categories', async () => {
  const parent = ids(await call('GET', '/catalog/products?category=home&limit=60'));
  const child = ids(await call('GET', '/catalog/products?category=furniture&limit=60'));
  assert.ok(child.length > 0);
  assert.ok(child.every((id) => parent.includes(id)));
});

test('TC-BG-03 price range: min above max is refused', async () => {
  const r = await call('GET', '/catalog/products?minPrice=9000&maxPrice=100');
  assert.equal(r.status, 400);
});

test('TC-BG-04 moving a category under its own child -> 409 CYCLE', async () => {
  const admin = await login('admin@team3.test', null, 'admin');
  const r = await call('PUT', '/admin/categories/1', { token: admin, body: { name: 'Electronics', parentId: 2 } });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'CYCLE');
});

test('TC-BG-05 deleting a category that is in use -> 409 IN_USE; an empty one deletes', async () => {
  const admin = await login('admin@team3.test', null, 'admin');
  const used = await call('DELETE', '/admin/categories/2', { token: admin });
  assert.equal(used.status, 409);
  assert.equal(used.data.error, 'IN_USE');
  const made = await call('POST', '/admin/categories', { token: admin, body: { name: `Dairy ${Date.now()}`, parentId: null } });
  assert.equal(made.status, 201);
  assert.equal((await call('DELETE', `/admin/categories/${made.data.id}`, { token: admin })).status, 204);
});

test('TC-BG-06 sellers cannot manage categories', async () => {
  const seller = await login('seller1@team3.test', 'SELLER');
  assert.equal((await call('POST', '/admin/categories', { token: seller, body: { name: 'Sneaky' } })).status, 403);
});

test("TC-BG-07 seller cannot re-categorise another seller's product -> 403", async () => {
  const seller = await login('seller1@team3.test', 'SELLER');
  const r = await call('PUT', '/seller/products/3/categories', { token: seller, body: { categoryIds: [1] } });
  assert.equal(r.status, 403);
});

/* ---------------- shops ---------------- */
test('TC-BG-08 public shop page loads by its web address', async () => {
  const r = await call('GET', '/shops/kavya-crafts');
  assert.equal(r.status, 200);
  assert.equal(r.data.shop.name, 'Kavya Crafts');
});

test("TC-BG-09 taking another shop's web address -> 409 SLUG_TAKEN", async () => {
  const seller = await login('seller1@team3.test', 'SELLER');
  const r = await call('PUT', '/seller/shop', { token: seller, body: { name: 'Kavya Crafts', slug: 'nilgiri-goods', about: '', returnPolicy: '' } });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'SLUG_TAKEN');
});

test('TC-BG-10 logo upload that is not really an image -> 400', async () => {
  const seller = await login('seller1@team3.test', 'SELLER');
  const r = await call('POST', '/seller/shop/logo', { token: seller, type: 'image/png', raw: 'this is not a png at all' });
  assert.equal(r.status, 400);
});

test('TC-BG-11 customers cannot edit shops', async () => {
  const cust = await login('customer@team3.test', 'CUSTOMER');
  assert.equal((await call('PUT', '/seller/shop', { token: cust, body: { name: 'x', slug: 'x-shop' } })).status, 403);
});

/* ---------------- dashboards ---------------- */
test('TC-BG-12 seller insights: real catalog numbers, sales marked as pending', async () => {
  const seller = await login('seller1@team3.test', 'SELLER');
  const r = await call('GET', '/seller/stats', { token: seller });
  assert.equal(r.status, 200);
  assert.equal(r.data.products.length, 6);
  assert.equal(r.data.sales.available, false);
});

test('TC-BG-13 admin overview is admin-only', async () => {
  const seller = await login('seller1@team3.test', 'SELLER');
  assert.equal((await call('GET', '/admin/overview', { token: seller })).status, 403);
  const admin = await login('admin@team3.test', null, 'admin');
  const r = await call('GET', '/admin/overview', { token: admin });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.data.usersByRole));
});

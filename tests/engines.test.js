/**
 * E2 / E3 / E4 partial tests (Sprint 2) against the running API and database.
 *   npm run db:reset && npm run dev     (terminal 1)
 *   npm run test:engines                (terminal 2)
 */
const test = require('node:test');
const assert = require('node:assert');
const mysql = require('mysql2/promise');
const config = require('../server/config');

const BASE = process.env.API || 'http://localhost:4000/api';
const PW = 'Password@123';

async function call(method, path, { body, token, raw } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data, headers: res.headers };
}
const login = async (email, role) => (await call('POST', '/auth/login', { body: { email, password: PW, portal: 'staff', role } })).data.token;

/* ---------------- E2 · catalog rules ---------------- */
test('TC-E2-01 storefront shows only APPROVED products', async () => {
  const { data } = await call('GET', '/catalog/products?limit=60');
  assert.ok(data.products.length > 0);
  assert.ok(data.products.every((p) => p.status === 'APPROVED'));
});

test('TC-E2-02 seller sets stock to 0 -> SOLD_OUT and hidden; restock -> APPROVED', async () => {
  const seller = await login('seller1@team3.test', 'SELLER');
  const mine = (await call('GET', '/seller/products', { token: seller })).data.products.find((p) => p.status === 'APPROVED');
  const zero = await call('PATCH', `/catalog/products/${mine.id}`, { token: seller, body: { stock: 0 } });
  assert.equal(zero.data.product.status, 'SOLD_OUT');
  const listed = (await call('GET', '/catalog/products?limit=60')).data.products.some((p) => p.id === mine.id);
  assert.equal(listed, false);
  const back = await call('PATCH', `/catalog/products/${mine.id}`, { token: seller, body: { stock: mine.stock } });
  assert.equal(back.data.product.status, 'APPROVED');
});

test('TC-E2-03 negative price / fractional stock -> 400 with field messages, nothing saved', async () => {
  const seller = await login('seller1@team3.test', 'SELLER');
  const mine = (await call('GET', '/seller/products', { token: seller })).data.products[0];
  const r = await call('PATCH', `/catalog/products/${mine.id}`, { token: seller, body: { price: -5, stock: 1.5 } });
  assert.equal(r.status, 400);
  assert.ok(r.data.details.price && r.data.details.stock);
  const after = (await call('GET', '/seller/products', { token: seller })).data.products.find((p) => p.id === mine.id);
  assert.equal(after.price, mine.price);
});

test('TC-E2-04 warehouse can correct stock but cannot change price', async () => {
  const wh = await login('warehouse@team3.test', 'WAREHOUSE_STAFF');
  const ok = await call('PATCH', '/ops/stock/1', { token: wh, body: { stock: 24 } });
  assert.equal(ok.status, 200);
  const price = await call('PATCH', '/catalog/products/1', { token: wh, body: { price: 1 } });
  assert.equal(price.status, 403);
});

/* ---------------- E3 · database ---------------- */
async function db() { return mysql.createConnection(config.db); }

test('TC-E3-01 CHECK constraint refuses negative stock even if code is bypassed', async () => {
  const c = await db();
  await assert.rejects(c.query('UPDATE products SET stock = -1 WHERE id = 1'), /CONSTRAINT|check/i);
  await c.end();
});

test('TC-E3-02 UNIQUE email refuses a duplicate account at database level', async () => {
  const c = await db();
  await assert.rejects(c.query("INSERT INTO users (name, email, password_hash, role_id) VALUES ('X', 'customer@team3.test', 'x', 2)"), /Duplicate/);
  await c.end();
});

test('TC-E3-03 foreign key refuses a product for a seller that does not exist', async () => {
  const c = await db();
  await assert.rejects(c.query("INSERT INTO products (seller_id, name, price, mrp, image) VALUES (9999, 'Ghost', 1, 1, 'book')"), /foreign key/i);
  await c.end();
});

test('TC-E3-04 grant + revoke run in one transaction: a bad id rolls back the whole change', async () => {
  const c = await db();
  const [[before]] = await c.query('SELECT COUNT(*) AS n FROM role_permissions WHERE role_id = 7');
  await c.beginTransaction();
  await c.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (7, 8)');
  await assert.rejects(c.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (7, 99999)'), /foreign key/i);
  await c.rollback();
  const [[after]] = await c.query('SELECT COUNT(*) AS n FROM role_permissions WHERE role_id = 7');
  assert.equal(after.n, before.n);
  await c.end();
});

test('TC-E3-05 SQL injection text in search is treated as plain text', async () => {
  const r = await call('GET', `/catalog/products?q=${encodeURIComponent("' OR 1=1 --")}`);
  assert.equal(r.status, 200);
  assert.equal(r.data.products.length, 0);
});

/* ---------------- E4 · web layer ---------------- */
test('TC-E4-01 broken JSON body -> 400 BAD_JSON in the standard error format', async () => {
  const r = await call('POST', '/auth/login', { raw: '{"email": ' });
  assert.equal(r.status, 400);
  assert.equal(r.data.error, 'BAD_JSON');
  assert.ok(r.data.message);
});

test('TC-E4-02 unknown API route -> 404 JSON, not an HTML page', async () => {
  const r = await call('GET', '/does-not-exist');
  assert.equal(r.status, 404);
  assert.equal(r.data.error, 'NOT_FOUND');
});

test('TC-E4-03 security headers present; framework not advertised', async () => {
  const r = await call('GET', '/health');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('TC-E4-04 body over 100 KB is refused', async () => {
  const r = await call('POST', '/auth/login', { raw: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(120 * 1024) }) });
  assert.equal(r.status >= 400 && r.status < 500, true);
});

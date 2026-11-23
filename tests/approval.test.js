/**
 * Admin approvals: seller shops (user:approve), listings (product:approve), delete account (user:delete),
 * and the IP data on the audit log.
 *   npm run db:reset && npm run dev       (terminal 1)
 *   node --test tests/approval.test.js    (terminal 2)
 */
const test = require('node:test');
const assert = require('node:assert');

const BASE = process.env.API || 'http://localhost:4000/api';
const PW = 'Password@123';

async function call(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* 204 */ }
  return { status: res.status, data };
}
const login = async (email, role, portal = 'staff', password = PW) => (await call('POST', '/auth/login', { body: { email, password, portal, role } })).data.token;
const admin = () => login('admin@team3.test', null, 'admin');

/** A brand-new seller with a unique email and shop address. */
async function newSeller(tag) {
  const n = `${tag}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `${n}@team3.test`;
  const slug = `${n}-shop`;
  const r = await call('POST', '/auth/register-seller', { body: { name: 'New Seller', email, password: 'secret123', shopName: `Shop ${n}`, shopSlug: slug } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const reg = (await call('GET', '/admin/sellers?status=PENDING', { token: await admin() })).data.sellers.find((s) => s.email === email);
  return { email, slug, id: reg.sellerId, token: await login(email, 'SELLER', 'staff', 'secret123') };
}

test('TC-AP-01 a new seller starts PENDING: can sign in, shop hidden from customers', async () => {
  const s = await newSeller('pend');
  assert.ok(s.token, 'a waiting seller can still sign in');
  const mine = await call('GET', '/seller/shop', { token: s.token });
  assert.equal(mine.data.shop.status, 'PENDING');
  assert.equal((await call('GET', `/shops/${s.slug}`)).status, 404, 'customers cannot open a shop that is not approved');
});

test('TC-AP-02 only user:approve may list or review shops', async () => {
  const s = await newSeller('perm');
  const seller = await login('seller1@team3.test', 'SELLER');
  const finance = await login('finance@team3.test');
  assert.equal((await call('GET', '/admin/sellers', { token: seller })).status, 403);
  assert.equal((await call('PUT', `/admin/sellers/${s.id}/approve`, { token: finance })).status, 403);
  assert.equal((await call('PUT', `/admin/sellers/${s.id}/approve`, { token: s.token })).status, 403, 'a seller cannot approve their own shop');
});

test('TC-AP-03 admin approves a shop -> public; approving twice -> 409 NOT_PENDING', async () => {
  const s = await newSeller('appr');
  const a = await admin();
  const ok = await call('PUT', `/admin/sellers/${s.id}/approve`, { token: a });
  assert.equal(ok.status, 200); assert.equal(ok.data.shop.status, 'APPROVED');
  assert.equal((await call('GET', `/shops/${s.slug}`)).status, 200);
  const again = await call('PUT', `/admin/sellers/${s.id}/approve`, { token: a });
  assert.equal(again.status, 409); assert.equal(again.data.error, 'NOT_PENDING');
});

test('TC-AP-04 reject needs a reason; a rejected seller sees it and cannot reapply before the cooldown', async () => {
  const s = await newSeller('rej');
  const a = await admin();
  const noReason = await call('PUT', `/admin/sellers/${s.id}/reject`, { token: a, body: { reason: '' } });
  assert.equal(noReason.status, 400); assert.ok(noReason.data.details.reason);
  const rej = await call('PUT', `/admin/sellers/${s.id}/reject`, { token: a, body: { reason: 'Shop description is empty.' } });
  assert.equal(rej.status, 200); assert.equal(rej.data.shop.status, 'REJECTED');
  const mine = (await call('GET', '/seller/shop', { token: s.token })).data.shop;
  assert.equal(mine.reviewNote, 'Shop description is empty.');
  assert.ok(new Date(mine.canReapplyAt) > new Date(), 'the cooldown date is in the future');
  const early = await call('POST', '/seller/shop/reapply', { token: s.token });
  assert.equal(early.status, 409); assert.equal(early.data.error, 'TOO_SOON');
  assert.equal((await call('GET', `/shops/${s.slug}`)).status, 404, 'a rejected shop stays hidden');
});

test('TC-AP-05 reapply is only for rejected shops -> 409 NOT_REJECTED', async () => {
  const seller = await login('seller1@team3.test', 'SELLER');
  const r = await call('POST', '/seller/shop/reapply', { token: seller });
  assert.equal(r.status, 409); assert.equal(r.data.error, 'NOT_REJECTED');
});

test('TC-AP-06 delete account: refused for self, admins and owners of products; works otherwise', async () => {
  const a = await admin();
  const cust = await login('customer@team3.test', 'CUSTOMER');
  const s = await newSeller('del');
  assert.equal((await call('DELETE', `/admin/users/${s.id}`, { token: cust })).status, 403, 'customers cannot delete accounts');
  assert.equal((await call('DELETE', '/admin/users/1', { token: a })).status, 403, 'not yourself');
  const owner = await call('DELETE', '/admin/users/3', { token: a });
  assert.equal(owner.status, 409); assert.equal(owner.data.error, 'IN_USE');
  assert.equal((await call('DELETE', `/admin/users/${s.id}`, { token: a })).status, 204);
  assert.equal((await call('GET', '/auth/me', { token: s.token })).status, 401, 'the deleted account is signed out at once');
  const left = (await call('GET', '/admin/sellers', { token: a })).data.sellers;
  assert.ok(!left.some((x) => x.sellerId === s.id), 'the shop went with the account');
  assert.equal((await call('DELETE', `/admin/users/${s.id}`, { token: a })).status, 404);
});

test('TC-AP-07 ban = deactivate: a banned seller cannot sign in', async () => {
  const a = await admin();
  const s = await newSeller('ban');
  assert.equal((await call('PUT', `/admin/users/${s.id}/active`, { token: a, body: { isActive: false } })).status, 200);
  const r = await call('POST', '/auth/login', { body: { email: s.email, password: 'secret123', portal: 'staff', role: 'SELLER' } });
  assert.equal(r.status, 401); assert.equal(r.data.error, 'INACTIVE');
});

test('TC-AP-08 product approval: listed for admin, sellers cannot approve, approving twice -> 409', async () => {
  const a = await admin();
  const seller = await login('seller2@team3.test', 'SELLER');
  assert.equal((await call('GET', '/admin/products', { token: seller })).status, 403);
  assert.equal((await call('PUT', '/catalog/products/12/approve', { token: seller })).status, 403);
  const { products } = (await call('GET', '/admin/products', { token: a })).data;
  assert.ok(Array.isArray(products));
  assert.ok(products.every((p) => p.status === 'PENDING'));
  if (products.length) {                                          // fresh database: product 12 is pending
    const ok = await call('PUT', `/catalog/products/${products[0].id}/approve`, { token: a });
    assert.equal(ok.status, 200); assert.notEqual(ok.data.product.status, 'PENDING');
  }
  const twice = await call('PUT', '/catalog/products/1/approve', { token: a });
  assert.equal(twice.status, 409); assert.equal(twice.data.error, 'NOT_PENDING');
  assert.equal((await call('PUT', '/catalog/products/99999/approve', { token: a })).status, 404);
});

test('TC-AP-10 a waiting seller cannot upload products (403 SHOP_NOT_APPROVED); after approval they can', async () => {
  const s = await newSeller('gate');
  const body = { name: 'Gate Test Mug', description: 'Test', price: 500, mrp: 600, stock: 3, categoryIds: [4] };
  const early = await call('POST', '/seller/products', { token: s.token, body });
  assert.equal(early.status, 403); assert.equal(early.data.error, 'SHOP_NOT_APPROVED');
  assert.equal((await call('GET', '/seller/products', { token: s.token })).data.products.length, 0, 'nothing was saved');
  assert.equal((await call('PUT', `/admin/sellers/${s.id}/approve`, { token: await admin() })).status, 200);
  const later = await call('POST', '/seller/products', { token: s.token, body });
  assert.equal(later.status, 201);
});

test('TC-AP-09 audit rows carry the IP address; top IPs is audit:read only', async () => {
  const a = await admin();
  const cust = await login('customer@team3.test', 'CUSTOMER');
  const { entries } = (await call('GET', '/admin/audit?pageSize=5', { token: a })).data;
  assert.ok(entries.length && entries.every((e) => 'ip' in e));
  assert.ok(entries.some((e) => e.ip), 'recent rows have an IP');
  const top = await call('GET', '/admin/audit/ips', { token: a });
  assert.equal(top.status, 200); assert.ok(top.data.ips.length > 0);
  assert.ok(['ip', 'total', 'denied', 'accounts'].every((k) => k in top.data.ips[0]));
  assert.equal((await call('GET', '/admin/audit/ips', { token: cust })).status, 403);
});

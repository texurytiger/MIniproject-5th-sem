/**
 * E1 · /api/admin — users, roles, permissions, audit, permission report.
 * FR-06 deactivate · FR-07 roles & assignment · FR-11 audit log · FR-12 permission report
 */
const express = require('express');
const data = require('../e3-data');
const cache = require('./permissionCache');
const { guard } = require('./session');
const { HttpError, wrap, validator, NAME, toInt } = require('../../core/http');

const r = express.Router();

function rolesView() {
  return [...cache.state.roles.values()].map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    parentRoleId: role.parentRoleId,
    staffLogin: role.staffLogin,
    depth: cache.depthOf(role.id),
    directPermissions: [...(cache.state.direct.get(role.id) || [])].sort(),
    effectivePermissions: cache.permissionsOf(role.id).permissions,
  }));
}

const findRole = (id) => {
  const role = cache.state.roles.get(id);
  if (!role) throw new HttpError(404, 'NOT_FOUND', 'Role not found.');
  return role;
};

/* ---------- users ---------- */
r.get('/users', guard('user', 'assign_role'), wrap(async (_req, res) => {
  const users = await data.users.list();
  res.json({ users: users.map(({ tokenVersion, failedLogins, isLocked, ...u }) => ({ ...u, locked: isLocked })) });
}));

/** Takes effect on the user's next request: authenticate() re-reads the role every time. */
r.put('/users/:id/role', guard('user', 'assign_role'), wrap(async (req, res) => {
  const id = toInt(req.params.id); const roleId = toInt(req.body.roleId);
  if (id === req.user.id) throw new HttpError(403, 'SELF_CHANGE', 'You cannot change your own role. Ask another admin (lock-out guard).');
  findRole(roleId);
  const user = await data.users.byId(id);
  if (!user) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  await data.users.setRole(id, roleId);
  res.json({ user: await data.users.byId(id) });
}));

/** FR-06: deactivate / reactivate. Deactivating also ends every open session of that user. */
r.put('/users/:id/active', guard('user', 'deactivate'), wrap(async (req, res) => {
  const id = toInt(req.params.id);
  if (id === req.user.id) throw new HttpError(403, 'SELF_CHANGE', 'You cannot deactivate your own account.');
  if (!(await data.users.byId(id))) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  await data.users.setActive(id, !!req.body.isActive);
  if (req.body.isActive) await data.users.clearFailures(id);
  res.json({ user: await data.users.byId(id) });
}));

/**
 * Permanent delete (user:delete). Ban = deactivate (above) and keeps the account; delete removes it.
 * Refused for yourself, for ADMIN accounts, and for anyone who still owns products or orders
 * (those rows must keep their owner: deactivate instead).
 */
r.delete('/users/:id', guard('user', 'delete'), wrap(async (req, res) => {
  const id = toInt(req.params.id);
  if (id === req.user.id) throw new HttpError(403, 'SELF_CHANGE', 'You cannot delete your own account.');
  const user = await data.users.byId(id);
  if (!user) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  if (user.role === 'ADMIN') throw new HttpError(403, 'LOCKOUT', 'Admin accounts cannot be deleted here. Change the role first.');
  const u = await data.users.usage(id);
  if (u.products || u.orders) {
    throw new HttpError(409, 'IN_USE', `This account still owns ${u.products} product(s) and ${u.orders} order(s). Deactivate it instead.`, u);
  }
  await data.users.remove(id);
  res.status(204).end();
}));

/* ---------- seller approval (user:approve) ---------- */
const SHOP_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

r.get('/sellers', guard('user', 'approve'), wrap(async (req, res) => {
  const status = SHOP_STATUSES.includes(req.query.status) ? req.query.status : null;
  const [sellers, counts] = await Promise.all([data.sellers.list(status), data.sellers.countByStatus()]);
  res.json({ sellers, counts });
}));

async function reviewShop(req, status, note) {
  const sellerId = toInt(req.params.id);
  const shop = await data.shops.bySeller(sellerId);
  if (!shop) throw new HttpError(404, 'NOT_FOUND', 'Shop not found.');
  if (!(await data.sellers.review(sellerId, status, note, req.user.id))) {
    throw new HttpError(409, 'NOT_PENDING', `This shop is ${shop.status}, not waiting for review.`);
  }
  return data.shops.bySeller(sellerId);
}

r.put('/sellers/:id/approve', guard('user', 'approve'), wrap(async (req, res) => {
  res.json({ shop: await reviewShop(req, 'APPROVED', '') });
}));

r.put('/sellers/:id/reject', guard('user', 'approve'), wrap(async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  validator().check(reason.length >= 3 && reason.length <= 300, 'reason', 'tell the seller why, in 3 to 300 characters').throwIfAny();
  res.json({ shop: await reviewShop(req, 'REJECTED', reason) });
}));

/* ---------- roles & permissions ---------- */
r.get('/roles', guard('role', 'manage'), (_req, res) => res.json({ roles: rolesView() }));
r.get('/permissions', guard('role', 'manage'), wrap(async (_req, res) => res.json({ permissions: await data.permissions.all() })));

r.post('/roles', guard('role', 'manage'), wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().toUpperCase();
  const parentRoleId = toInt(req.body.parentRoleId);
  validator()
    .check(NAME.test(name), 'name', 'Role name: 2–39 capital letters, digits or _ (e.g. SUPPORT_AGENT)')
    .check(!cache.state.byName.has(name), 'name', 'A role with this name already exists')
    .check(parentRoleId === null || cache.state.roles.has(parentRoleId), 'parentRoleId', 'Parent role does not exist')
    .throwIfAny();
  const id = await data.roles.create({ name, description: String(req.body.description || ''), parentRoleId });
  await cache.rebuild();
  res.status(201).json({ id });
}));

/** Cycle check (DFS over the role's subtree) BEFORE saving: a cycle can never reach the database. */
r.put('/roles/:id/parent', guard('role', 'manage'), wrap(async (req, res) => {
  const role = findRole(toInt(req.params.id));
  const parentRoleId = toInt(req.body.parentRoleId);
  if (parentRoleId !== null) findRole(parentRoleId);
  if (cache.wouldCreateCycle(role.id, parentRoleId)) {
    const parent = cache.state.roles.get(parentRoleId);
    throw new HttpError(409, 'CYCLE', `Rejected: ${parent.name} already inherits from ${role.name}, so this would create a loop.`);
  }
  await data.roles.setParent(role.id, parentRoleId);
  await cache.rebuild();
  res.json({ roles: rolesView() });
}));

r.put('/roles/:id/permissions', guard('role', 'manage'), wrap(async (req, res) => {
  const role = findRole(toInt(req.params.id));
  const ids = new Set((await data.permissions.all()).map((p) => p.id));
  const grant = (req.body.grant || []).map(Number).filter((x) => ids.has(x));
  const revoke = (req.body.revoke || []).map(Number).filter((x) => ids.has(x));
  if (role.name === 'ADMIN' && revoke.length) {
    const all = await data.permissions.all();
    const critical = all.filter((p) => ['role:manage', 'user:assign_role'].includes(`${p.resource}:${p.action}`)).map((p) => p.id);
    if (revoke.some((x) => critical.includes(x))) throw new HttpError(403, 'LOCKOUT', 'ADMIN must keep role:manage and user:assign_role, or nobody could fix roles again.');
  }
  await data.roles.changePermissions(role.id, grant, revoke);
  await cache.rebuild();
  res.json({ roles: rolesView() });
}));

/* ---------- audit (FR-11) ---------- */
r.get('/audit', guard('audit', 'read'), wrap(async (req, res) => {
  const page = Math.max(1, toInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, toInt(req.query.pageSize) || 15));
  const decision = ['ALLOW', 'DENY'].includes(req.query.decision) ? req.query.decision : null;
  const resource = /^[a-z_]{1,40}$/.test(req.query.resource || '') ? req.query.resource : null;
  const { entries, total } = await data.audit.page({ page, pageSize, decision, resource });
  res.json({ entries, total, page, pageSize });
}));

/** Busiest IP addresses (last 7 days), most refusals first: spots password guessing from one network. */
r.get('/audit/ips', guard('audit', 'read'), wrap(async (_req, res) => {
  res.json({ ips: await data.stats.topIps(10, 7), days: 7 });
}));

/* ---------- permission report (FR-12) ---------- */
r.get('/report', guard('role', 'manage'), wrap(async (_req, res) => {
  const [counts, perms] = await Promise.all([data.users.countByRole(), data.permissions.all()]);
  const roles = rolesView().map((x) => ({ ...x, users: counts.get(x.id) || 0, inherited: x.effectivePermissions.length - x.directPermissions.length }));
  const held = new Set(roles.flatMap((x) => x.effectivePermissions));
  const warnings = [];
  roles.filter((x) => x.users > 0 && x.effectivePermissions.length === 0).forEach((x) => warnings.push(`${x.name} has ${x.users} user(s) but no permissions: every protected request is denied.`));
  roles.filter((x) => x.name !== 'ADMIN' && x.effectivePermissions.includes('role:manage')).forEach((x) => warnings.push(`${x.name} can manage roles: only ADMIN should.`));
  perms.filter((p) => !held.has(`${p.resource}:${p.action}`)).forEach((p) => warnings.push(`${p.resource}:${p.action} is not held by any role.`));
  cache.state.cycles.forEach((n) => warnings.push(`${n} is caught in a role cycle and has been given no permissions (fail closed).`));
  res.json({ roles, warnings, cacheBuiltAt: cache.state.builtAt, cacheBuildMs: cache.state.buildMs });
}));

module.exports = r;

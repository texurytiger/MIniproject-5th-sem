/**
 * E1 algorithm trace for the Sprint 2 handbook (section 4).
 *   npm run db:reset   then   node scripts/e1-trace.js
 * Prints real outputs of the role-tree DFS, O(1) lookups, ownership decisions, cycle check and typo correction.
 */
const cache = require('../server/engines/e1-access/permissionCache');
const { decide } = require('../server/engines/e1-access/authorize');
const typo = require('../server/engines/e1-search/typo');

(async () => {
  const s = await cache.build();
  console.log(`build(): ${s.roles.size} roles, cycles=[${s.cycles}] in ${s.buildMs.toFixed(2)} ms`);
  console.log('chainOf(FINANCE) =', cache.chainOf(4).join(' -> '), '| effective =', cache.permissionsOf(4).permissions.length, 'perms | product:read granted by', cache.grantedBy(4, 'product:read'));
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 100000; i += 1) cache.has(4, 'refund:approve');
  const ns = Number(process.hrtime.bigint() - t0) / 100000;
  console.log(`has(FINANCE, 'refund:approve') = ${cache.has(4, 'refund:approve')}  avg ${ns.toFixed(0)} ns over 100k lookups`);
  console.log('decide(seller #3, product:update, owner 3) =', decide({ id: 3, roleId: 6 }, 'product', 'update', 3).join(' '));
  console.log('decide(seller #3, product:update, owner 4) =', decide({ id: 3, roleId: 6 }, 'product', 'update', 4).join(' '));
  console.log('decide(CEO #7, product:read) =', decide({ id: 7, roleId: 7 }, 'product', 'read', null).join(' '));
  console.log('wouldCreateCycle(EMPLOYEE, parent=FINANCE) =', cache.wouldCreateCycle(3, 4), '| (FINANCE, parent=EMPLOYEE) =', cache.wouldCreateCycle(4, 3));
  console.log("dl('headphnes','headphones') =", typo.dl('headphnes', 'headphones'), "| dl('lmap','lamp') =", typo.dl('lmap', 'lamp'));
  console.log("correct('headphnes') =", await typo.correct('headphnes'), "| correct('xyzqw') =", await typo.correct('xyzqw'));
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });

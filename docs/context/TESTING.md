# Testing: everything that exists, how to run it, and how to prove each claim

## Before any test

1. Start MySQL (XAMPP).
2. `npm run db:reset`. Tests expect the seeded data.
3. `npm run dev` and leave it running.
4. Use a second terminal.

If you see lots of `ECONNREFUSED`, the app or MySQL isn't running. In the cloud sandbox MySQL kept stopping between sessions; restart it with `mysqld_safe`.

## 1. Automated tests: 60 in total, all pass (23 Nov, after seller approval; the older evidence file `evidence/sprint2/test-all-2026-11-23.txt` shows the 50/50 run before it)

`npm run test:all` runs the four files one at a time (`--test-concurrency=1`; running them in parallel broke on Node 22, which was defect D-10).

### `tests/e1.test.js`: E1, 24 results (`npm test`)

**FR-02 sign-in rules** (11 subtests):
- correct staff sign-in returns a token
- wrong password → 401 generic
- unknown email → the same 401 message
- finance on the admin portal → WRONG_PORTAL
- finance picking SELLER → ROLE_MISMATCH with a hint
- admin on the staff portal → 401
- staff page with no role: finance and warehouse sign in, role from the account
- a role sent to the staff page is ignored (finance sending WAREHOUSE_STAFF is still FINANCE)
- the staff page refuses customers and sellers (WRONG_PORTAL + hint)
- the staff page refuses admins
- FR-06 deactivated → 401 INACTIVE

**Other tests:**
- FR-01 register always creates a CUSTOMER (+ duplicate email 409, weak input 400)
- FR-07/08 role tree and effective permissions (Finance chain FINANCE → EMPLOYEE)
- FR-09 deny by default (no token 401, forged token 401, customer on /admin/audit 403)
- FR-10 ownership (Access Lab + a real PATCH: own 200, seller2's product 403 NOT_OWNER)
- FR-07 admin rules: cycle rejected (409), no self role change (403)
- Role change applies on the next request (warehouse → finance → back)
- Session revocation: logout and deactivation kill old tokens
- Lockout after 5 wrong passwords (429 LOCKED)
- Lockout can't shut out the real owner: a known device still gets in; a tampered cookie = unknown
- A known device still needs the right password
- FR-11 every decision is audited
- E1 typo search (`headphnes` → headphones)

### `tests/engines.test.js`: E2, E3, E4, 13 tests (`npm run test:engines`)

- TC-E2-01 the storefront shows only APPROVED products
- TC-E2-02 stock 0 → SOLD_OUT and hidden; restock → APPROVED
- TC-E2-03 negative price / fractional stock → 400 with field messages, nothing saved
- TC-E2-04 warehouse can correct stock but can't change price
- TC-E3-01 CHECK refuses negative stock even when the code is bypassed (direct SQL)
- TC-E3-02 UNIQUE email at database level
- TC-E3-03 FK refuses a product for a missing seller
- TC-E3-04 grant + revoke in one transaction: a bad id rolls back everything
- TC-E3-05 SQL injection text in search is plain text (0 products)
- TC-E4-01 broken JSON → 400 BAD_JSON
- TC-E4-02 unknown route → 404 JSON
- TC-E4-03 security headers present, X-Powered-By absent
- TC-E4-04 a 120 KB body is refused (413)

### `tests/baguette.test.js`: BAGUETTE features, TC-BG-01 to TC-BG-13

| Test | Checks |
| --- | --- |
| 01 | One product sits in several categories (product 2 in audio and electronics) |
| 02 | Filtering a parent category includes its sub-categories (home ⊇ furniture) |
| 03 | Price range with min > max → 400 (found defect D-11) |
| 04 | Moving Electronics under its child Audio → 409 CYCLE |
| 05 | Deleting an in-use category → 409 IN_USE; an empty one deletes (204) |
| 06 | Sellers can't manage categories (403) |
| 07 | Seller 3 re-categorising seller 4's product 3 → 403 |
| 08 | Public shop page /shops/kavya-crafts |
| 09 | Taking slug nilgiri-goods → 409 SLUG_TAKEN |
| 10 | Text sent as image/png → 400 |
| 11 | Customers can't edit shops (403) |
| 12 | Seller insights: 6 products, sales.available = false |
| 13 | Admin overview: seller 403, admin 200 |

### `tests/approval.test.js`: admin approvals, TC-AP-01 to TC-AP-10

| Test | Checks |
| --- | --- |
| 01 | A new seller starts PENDING: can sign in, `/shops/<slug>` is 404 |
| 02 | Only user:approve may list or review shops (seller, finance, the seller themself → 403) |
| 03 | Approve → shop public; approving twice → 409 NOT_PENDING |
| 04 | Reject needs a reason (400); the seller sees it; reapply before the cooldown → 409 TOO_SOON; still hidden |
| 05 | Reapply on a non-rejected shop → 409 NOT_REJECTED |
| 06 | Delete: customer 403, self 403, seller1 (owns products) 409 IN_USE, new seller 204 + token dead + shop gone, again 404 |
| 07 | Ban (deactivate) → sign-in 401 INACTIVE |
| 08 | Product approval: sellers 403; pending list; approve → not PENDING; approve an approved one → 409; unknown → 404 |
| 09 | Audit rows carry `ip`; `/admin/audit/ips` works for admin, 403 for customers |
| 10 | A waiting seller's `POST /seller/products` → 403 SHOP_NOT_APPROVED and nothing saved; after approval → 201 |

Hiding a waiting seller's products from customers was checked by hand on 23 Nov (a product inserted directly: edit 403 SHOP_NOT_APPROVED, product page 404, search 0; after approval 200 / 200 / 1). Since 9447021 a seller can create products, so TC-AP-10 covers the create path automatically.

**Running the suite twice on the same server fails 6 lockout/IP tests** (IP_LIMIT: 30 wrong passwords per 15 min per IP, kept in memory). Restart the API (and reset the DB) between full runs.

### History

- v4 (16 Nov): 34/34.
- TC-BG-03 failed at first (D-11), giving 47/47 after the fix.
- The 4 staff-page subtests were added (T-3/D-14), giving 50/50.
- 23 Nov: 10 approval tests added (TC-AP-01..10), giving 60/60.
- The first failing engines run is kept as evidence: `evidence/sprint2/test-run-engines-first-run-FAILED.txt`, plus the retest file.

## 2. Self Test page (browser): 18 live E1 scenarios

Admin console → Self-test → Run (after `db:reset`). The scenarios:

- No token on a protected route
- Forged token
- Wrong password
- Deactivated account
- Finance on the admin portal
- Finance picks SELLER on the staff portal
- Admin on the staff portal
- **Staff portal takes the role from the account (200 as FINANCE)** (the fixed version of the old "staff portal without a role, expects 400")
- Register asking for ADMIN
- Customer opens the audit log
- Finance inherits from EMPLOYEE
- Finance may approve refunds
- Seller edits own product (owner #3)
- Seller edits another seller's product (owner #4)
- CEO reads products (DENY)
- Make EMPLOYEE a child of FINANCE (cycle, 409)
- Admin changes own role (403)
- Denials above were audited

**Results:**
- The local working copy (with the D-17 fix): **18/18** (screenshot `evidence/sprint2/selftest-18-of-18-2026-11-23.png`).
- **GitHub commit 950102e has the OLD check**, so it shows **17/18** with one red row. That's defect D-17, open in the handbook.

## 3. Live claim demos: `scripts/demo.js` (local only; NOT in GitHub commit 950102e)

- `npm run demo` lists them; `npm run demo -- <name>`, `-- e1|e2|e3|e4`, or `-- all`.
- Each prints the request (→), the response (←), PROVEN / NOT PROVEN, and often a "Say:" line.
- 33 demos, all PROVEN on 23 Nov (`evidence/sprint2/demo-all-2026-11-23.txt`):

| Engine | Demos |
| --- | --- |
| E4 | headers, badjson, notfound, toobig, validation, fakeimage, weaksecret |
| E1 sign-in | register, portals, inactive, timing, forged, logout, deactivate, lockout, knowndevice, spam |
| E1 access | notoken, deny, owner, warehouse, cycle, rolechange, audit, typo |
| E2 | soldout, badvalues, pricerange |
| E3 | check, unique, fk, rollback, injection |

- **`spam` runs last and blocks sign-in from that IP for 15 min. Restart the server after it**, or `test:all` fails.
- The Claude Doc "Team 3 — Live Demo Commands for Every Claim" explains each one: https://claude.ai/artifact/TTLgfG6QMrW1wPDanN6goD

## 4. Algorithm trace

`npm run trace:e1` should match `evidence/sprint2/e1-algorithm-trace.txt`:
- build: 7 roles, no cycles, ~22 ms
- Finance chain: 7 perms, product:read granted by EMPLOYEE
- `has()` ≈ 31 ns over 100k lookups
- decide → GRANTED_OWN / NOT_OWNER / NO_PERMISSION
- wouldCreateCycle → true/false
- Damerau-Levenshtein dl('headphnes','headphones') = 1
- correct('xyzqw') = null

## 5. Manual commands that work without the demo runner (Windows PowerShell)

### Sign-in spam → 429, then find the IP

```powershell
1..32 | % { try { Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/login -ContentType 'application/json' -Body (@{email="user$($_ % 4)@demo.test"; password='wrong'; role='CUSTOMER'} | ConvertTo-Json) } catch { $_.Exception.Response.StatusCode.value__ } }
```
Then run the audit query from SECURITY.md in phpMyAdmin (`team3_store`). Restart the server afterwards.

### Ownership (FR-10)

```powershell
$t = (Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/login -ContentType 'application/json' -Body '{"email":"seller1@team3.test","password":"Password@123","portal":"staff","role":"SELLER"}').token
$h = @{ Authorization = "Bearer $t" }
Invoke-RestMethod -Method Patch -Uri http://localhost:4000/api/catalog/products/1 -Headers $h -ContentType 'application/json' -Body '{"price":1299}' | Select -Expand product | Select id, name, sellerId, price
try { Invoke-RestMethod -Method Patch -Uri http://localhost:4000/api/catalog/products/3 -Headers $h -ContentType 'application/json' -Body '{"price":1}' } catch { $_.ErrorDetails.Message }
```
Expected: 200 for product 1, then NOT_OWNER for product 3. Audit check:
```sql
SELECT id,email,resource,action,owner_id,decision,reason FROM audit_log WHERE email='seller1@team3.test' AND resource='product' ORDER BY id DESC LIMIT 2;
```

### Load test (never run yet; it would give the first real numbers)

```
npx autocannon -c 50 -d 10 "http://localhost:4000/api/catalog/products?q=vase"
```
- Expect all 200s (no API rate limit).
- Record Req/Sec and Latency.
- Only ever against localhost: a "DDoS test" against anyone else's server is illegal, and one laptop can't do a real DDoS anyway.

## 6. Website checks (for live demos)

| Check | What to do | Expected |
| --- | --- | --- |
| Typo search | Search `headphnes` | Results for headphones |
| SQL injection | Search `' OR 1=1 --` | No results |
| Price filter | min 9000, max 100 | Error |
| Account lock | New account, 5 wrong passwords, then the right one | "locked" (needs an unknown browser) |
| Wrong portal | Admin on /staff/login | Refused, with a link to the right page |
| One account per browser | Two tabs; sign out in one | The other follows |
| Ownership and SOLD_OUT | Seller Central: stock 0 | Product gone from search; restock brings it back |
| Fake upload | A .txt renamed to .png as the shop logo | Refused |
| Validation | /register with bad name, email and password | All three errors at once |
| Access Lab and Audit pages | Use them in the admin console | Show allow/deny with reasons |

**Need the terminal:** toobig, badjson, notfound, headers, weaksecret, timing, DB constraint checks, rolechange, spam.

**Suggested review-day order:** reset → dev → `test:all` (60/60) → Self Test page → 2–3 website checks → spam last.

## 7. How the industry tests (discussed for the viva)

| Layer | Tools |
| --- | --- |
| Unit tests | Jest/Vitest |
| Integration/API tests | Supertest, or our node:test suites against the real DB |
| End-to-end | Playwright, Cypress |
| Load | k6, autocannon, JMeter, Locust |
| Security | OWASP ZAP, dependency audits |
| Pipeline | All of these in CI (e.g. GitHub Actions) on every push |
| After release | Staging environment, monitoring |

We have integration/API tests and some Playwright checks. There's **no CI, no load test and no concurrency test yet**.

## 8. Defect register (handbook §11)

| Id | Defect and fix |
| --- | --- |
| D-01/D-02 | Lockout off by one and time-zone comparison. Fixed with MySQL NOW() and the SET order in one UPDATE |
| D-03/D-07 | 500 instead of 503 when the API or DB was down. Now 503 SERVER_DOWN (proxy) and DB_DOWN |
| D-04 | Attackers could lock out real users. Fixed with the per-IP limit + unknown-device-only lock + signed device cookie |
| D-05/D-06 | Injection-like search text and a 120 KB body gave 500. Fixed by stripping FULLTEXT operators, and 413 TOO_LARGE |
| D-08/D-09/D-10 | ADMIN had order:create/payment:create; Finance saw wrong Orders text; test:all failed on Node 22 |
| D-11 | min > max price accepted. Fixed with a cross-field check |
| D-12 | Multiple accounts signed in at once. Fixed with revoke before login, the gate, and storage sync |
| D-13 | Empty Shop menu. Fixed with retry and backoff |
| D-14 | Staff page still had a role picker. Fixed: role read from the account |
| D-15 | Stray "t3 />" text. Fixed the broken favicon line |
| D-16 | Architecture HTML pages had 18 errors. Corrected |
| D-17 | Self Test page had an outdated check after D-14. Fixed locally; **not in GitHub commit 950102e**; open in the handbook |

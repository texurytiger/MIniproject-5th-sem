# Security: what's built, how to prove it, and what's NOT built

Use the exact numbers here. They come from `server/config.js` and `.env.example`.

## Built

| Mechanism | Detail | Proof |
| --- | --- | --- |
| Password storage | bcryptjs, cost 10 (`BCRYPT_COST`, allowed 10–14). The plain password is never stored. | Seed hashes in `db/seed.sql` |
| No account enumeration | An unknown email still runs bcrypt against `DUMMY_HASH`, so it takes the same time and gets the same 401 message as a wrong password (~71 ms vs ~72 ms measured) | demo `timing`; tests "unknown email → same 401" |
| IP limit | More than 30 failed sign-ins from one IP in 15 min → 429 IP_LIMIT for that IP, even with a correct password. **In memory**: a server restart clears it. Counts failures on `/auth/login` only. | demo `spam`; SQL query below |
| Account lock | 5 wrong passwords from **unknown** devices → the account is locked for 15 min for new devices. A browser that signed in before has an HMAC-signed `t3_device` cookie (httpOnly, SameSite=Lax, Path=/api/auth, Secure in production, 180 days) and still gets in, but still needs the password. A tampered cookie counts as unknown. | tests "Lockout…", "known device…" |
| Sessions | JWT HS256, 2 h, `{sub, tv}` only. Re-checked against the DB on every request. Logout, password change and deactivation bump `token_version`, so old tokens get 401 at once. | tests "Session revocation" |
| One account per browser | Signing in revokes the existing token first; tabs sync through the `storage` event; every sign-in page has an "already signed in" gate | E1-14 browser check (Playwright) |
| Deny by default | No grant anywhere in the role chain → 403 NO_PERMISSION. CEO has no permissions on purpose. | FR-09 tests |
| Ownership | `_own` permissions are checked against the row's owner → NOT_OWNER | FR-10 tests |
| Fail closed | Cache not built, or audit write failed → 503 FAIL_CLOSED. DB down → 503 before any permission decision. | `authorize.js` |
| Audit log | Every ALLOW and DENY and every sign-in attempt, with the IP. Insert-only (E3 exposes `insert` and `page` only). | FR-11 test, TC-AP-09; admin Audit page shows the IP column and a Top IPs card |
| Admin safety | An admin can't change or deactivate themselves (403 SELF_CHANGE). ADMIN can't lose `role:manage` or `user:assign_role` (403 LOCKOUT). | admin route tests |
| Loops | Role or category moves that would create a loop → 409 CYCLE (DFS check). A role caught in a loop gets no permissions. | FR-07 test, TC-BG-04 |
| SQL injection | `?` placeholders everywhere; FULLTEXT operators stripped | TC-E3-05 (`' OR 1=1 --` → 0 products) |
| Input validation | Server side; all field errors returned together in `details` | TC-E2-03, register test |
| Body size | 100 KB JSON limit (413); uploads 2 MB | TC-E4-04 |
| Uploads | Sellers only; the magic bytes must be PNG, JPG or WebP; server-chosen file name; no directory listing; stored in `server/uploads/` | TC-BG-10 |
| Headers | nosniff, X-Frame-Options DENY, Referrer-Policy same-origin, X-Powered-By removed. HSTS and CSP **in production only** (they need HTTPS). | TC-E4-03 |
| HTTPS-ready | HTTP on localhost, HTTPS from the host when deployed. Production refuses a weak `JWT_SECRET` or an empty `DB_PASSWORD`. `TRUST_PROXY` must be set behind the host's proxy, or every IP shows as the proxy's. | demo `weaksecret` |
| Secrets | `.env` is git-ignored; only `.env.example` is committed | `.gitignore` |

## Who spammed? (audit query)

```sql
SELECT ip, COUNT(*) AS fails, COUNT(DISTINCT email) AS emails_tried, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
FROM audit_log
WHERE resource = 'session' AND decision = 'DENY' AND created_at > NOW() - INTERVAL 1 HOUR
GROUP BY ip ORDER BY fails DESC LIMIT 20;
```
- On localhost every row shows `127.0.0.1` / `::1`.
- A high `emails_tried` means credential stuffing.
- The admin Audit page has an IP column and a "Top IP addresses" card (last 7 days, most refusals first; built 23 Nov).

## NOT built: say so honestly

- **No API-wide rate limit and no DDoS protection.** Only sign-in failures are limited. Search and browse can be flooded, and they aren't audited. A cheap fix is `express-rate-limit`, e.g. 100 requests a minute per IP on `/api` (offered, not built). Real DDoS protection belongs at the network edge (Cloudflare, AWS Shield, nginx) after deployment.
  - Viva line: "We rate-limit sign-in per IP and lock accounts for unknown devices. There's no API-wide limit yet; DDoS protection belongs at the edge."
- **No stock locking.** Checkout doesn't exist. The design is `SELECT … FOR UPDATE` on stock rows in ascending product-id order inside a transaction (no overselling, no deadlocks).
- **No lock around role moves.** The two-admin race is possible; the planned fix is `GET_LOCK`.
- **The login counter is in memory**: lost on restart, and not shared between processes. Redis would fix that.
- **bcryptjs blocks the event loop**: native bcrypt or a worker would fix it.
- **Uploads are on the local disk.** The plan: resize to WebP (about 1200 px wide, 100–200 KB) → object storage (S3, Cloudflare R2 or Cloudinary) → CDN. The DB keeps only the URL.
- **Not deployed**: only ever run on localhost.
- **No load or concurrency tests.** A first load test command is in TESTING.md.
- **Never paste the real `JWT_SECRET` anywhere.** Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

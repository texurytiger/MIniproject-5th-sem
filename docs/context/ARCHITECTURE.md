# Architecture: how the system works

Facts here were checked against the code on 23 Nov 2026. If the code changes, update this file.

## 1. Shape

- **Modular monolith**: one Node/Express server, one module per subject engine, and one MySQL database (`team3_store`, MariaDB 10.11 through XAMPP).
- **Frontend**: React 18 and Vite 5 on :5173. In development Vite proxies `/api` to :4000. In production `npm run build` creates `frontend/dist`, and `npm start` serves the API and the built site from one server on one port.
- **Dependencies** (`package.json`): express 4, jsonwebtoken 9, bcryptjs 3, mysql2 3, react 18, react-router-dom 6, vite 5. No ORM, no Redis, no rate-limit library.
- **Scripts**:

  | Script | What it does |
  | --- | --- |
  | `dev` | `scripts/dev.mjs` runs the API and Vite together |
  | `start` | Production server |
  | `build` | Vite build |
  | `db:reset` | `server/resetDb.js`: drop, create, schema, seed |
  | `test` | `tests/e1.test.js` |
  | `test:engines` | `tests/engines.test.js` |
  | `test:all` | All three test files, run one at a time |
  | `trace:e1` | `scripts/e1-trace.js` |
  | `demo` | `scripts/demo.js`: local only, not yet on GitHub (see REPO_AND_GIT.md) |

## 2. The four subject engines (the professor wants everything organised by subject)

| Engine | Subject | Owner | Code |
| --- | --- | --- | --- |
| E1 | DAA & OS | Manthan Raykar (01FE24BCS196) | `server/engines/e1-access/*`, `server/engines/e1-search/typo.js`, `frontend/src/engines/e1-access/*` |
| E2 | OOPS | Sohan Patil (01FE24BCS092) | `server/engines/catalog/routes.js`. This is a temporary location: E2's rules are still route functions; the OOP classes are T-16 |
| E3 | DBMS | Ayush Ojha (01FE24BCS211) | `db/schema.sql`, `db/seed.sql`, `server/engines/e3-data/index.js` (the only code that runs SQL), `server/core/db.js` (the connection pool) |
| E4 | WT | Kushvendra Singh Rathore (01FE24BCS104) | `server/index.js` (pipeline), `server/core/http.js` (HttpError, wrap, validator), `server/config.js`, the whole React frontend |

The earlier, "functional" engine split (E1 Access/Kushvendra, E2 Catalog/Manthan, E3 Order/Sohan, E4 Payment/Ayush) was **replaced** by the subject split above. Kushvendra's job includes explaining E1's code. **Open question:** does JWT belong to E1 or E4? See DECISIONS.md.

## 3. Request pipeline (`server/index.js`), in order

1. `app.set('trust proxy', config.trustProxy)`: `loopback` in development, `1` in production. This is what gives `req.ip` the real visitor IP behind the host's HTTPS proxy.
2. `express.json({ limit: '100kb' })`. Broken JSON gives 400 BAD_JSON; anything over 100 KB gives 413 TOO_LARGE.
3. Security headers on every response:
   - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, and `X-Powered-By` removed.
   - **Production only**: `Strict-Transport-Security` (HSTS) and `Content-Security-Policy` (own scripts only, Google Fonts allowed).
4. `GET /api/health` returns `{ ok, cacheReady }`.
5. `/api/uploads` serves uploaded files statically (no directory listing, 7-day cache).
6. `app.use('/api', authenticate)`: E1's "who is calling" step (`session.js`). We usually call this **identify()** when explaining it; the function's real name is **`authenticate`**.
   - No `Authorization: Bearer` header: the request continues anonymously.
   - With a token: `jwt.verify` (HS256; checks signature and expiry), then **one DB read** (`data.users.byId`). It rejects the token if the user is missing, inactive, or `token_version` ≠ the token's `tv`.
   - Errors: 401 BAD_TOKEN (tampered or expired) or 401 SESSION_ENDED (revoked).
7. The routers: `/api/auth` (routes.auth), `/api/admin` (routes.admin), `/api` (catalog routes).
8. Fallback: 404 NOT_FOUND as JSON ("No such API route.").
9. Error handler:
   - `HttpError` becomes its status and code.
   - Database connection errors become 503 DB_DOWN.
   - Anything else becomes 500 SERVER_ERROR with a fixed message and no stack trace (logged on the server).
   - Body shape: `{ error, message, details? }`.

## 4. Protected routes: requireUser → guard → authorize()

- `requireUser`: 401 NO_TOKEN if anonymous.
- `guard(resource, action, ownerOf?)` (in `session.js`): calls `authorize(req.user, resource, action, { ownerId, ip })` and turns the answer into a response:
  - ALLOW → continue
  - FAIL_CLOSED → 503
  - anything else → 403 with the reason (NOT_OWNER: "You can only change items that belong to you."; otherwise "Your role (X) is not allowed to do this.")
- `authorize()` (`authorize.js`) is the single decision point:
  - no user → DENY NO_TOKEN
  - cache not ready → DENY FAIL_CLOSED
  - asking for an `_own` action directly: it must be held, and the owner must be the caller or unknown → GRANTED_OWN, otherwise NOT_OWNER
  - `cache.has(role, 'res:act')` → ALLOW GRANTED (an **O(1) hash lookup**, about 31 ns in the trace)
  - otherwise `cache.has(role, 'res:act_own')` → GRANTED_OWN if `ownerId === user.id`, else NOT_OWNER
  - otherwise DENY NO_PERMISSION (deny by default)
  - **Every decision is written to `audit_log` BEFORE it's returned. If that insert fails, the answer becomes DENY FAIL_CLOSED.**
- **Cost of one protected request:** JWT verify (CPU) + 1 DB read (authenticate) + 1–2 hash lookups + 1 DB insert (audit) + the route's own SQL. The "2 DB trips per request" is a known scaling cost.
- Public routes (browse, search, product page, categories, shop page, register, login, health) **have no guard**, so there's no permission check and no audit row. Search spam therefore leaves no trace.
- Which routes have guard, and with which permission: see API.md (29 guarded routes).

## 5. Permission cache: the DAA part of E1 (`permissionCache.js`)

- `state`: `roles` Map (id → {id, name, description, parentRoleId, staffLogin}), `byName`, `direct` (id → Set of perms), `effective` (id → Map perm → name of the granting role), `children`, `cycles`, `builtAt`, `buildMs`.
- `build()`:
  1. Load all roles and grants.
  2. Flip the `parent_role_id` arrows into a children list; roles with no parent are roots.
  3. Run an **iterative DFS** (an explicit stack, so a deep tree can't overflow) from every root, carrying the parent's effective Map down. Each role's set = a copy of its parent's set + its own grants. Own grants win the "granted by" label.
  4. Cost: O(R + G).
  5. Roles never reached are stuck in a cycle: they get an **empty set (fail closed)** and are listed in `cycles`.
  6. The new state replaces the old one in one assignment (atomic swap).
- `rebuild()`: same as `build()`, but on failure it sets `ready = false`, so authorize() fails closed. It runs at startup and after every admin role edit: create role, move parent, grant or revoke.
- `has(roleId, perm)`: O(1). `permissionsOf()`, `chainOf()` (e.g. FINANCE → EMPLOYEE), `depthOf()`.
- `wouldCreateCycle(roleId, newParentId)`: a DFS down `roleId`'s subtree. If the new parent is the role itself or below it, the route answers **409 CYCLE** before saving anything.
- Seed tree: EMPLOYEE (3) is the parent of FINANCE (4) and WAREHOUSE_STAFF (5). ADMIN, CUSTOMER, SELLER and CEO are roots. Finance's effective permissions = its own 4 + EMPLOYEE's 3 = 7.
- **Known gap:** two admins moving roles at the same instant can both pass the check, because check and save are separate steps. The safety net is fail closed. The planned fix is MySQL `GET_LOCK` around check + save.
- **Known gap:** if someone edits roles or grants directly in SQL, the cache goes stale until a restart or the next admin edit.

## 6. Sign-in (`routes.auth.js` POST /login): the page decides the rules, the account decides the role

- Body: `{ email, password, portal: 'admin'|'staff', role? }`.
- Which page is it?
  - `portal === 'admin'` → admin page
  - `role === 'CUSTOMER'` → customer page
  - `role === 'SELLER'` → seller page
  - anything else → staff page
- Order of checks:
  1. Validate the email format and that a password was sent → 400.
  2. **IP limit**: more than 30 failures from this IP in 15 minutes → 429 IP_LIMIT (`loginGuard.js`, an in-memory sliding window).
  3. Known device? (signed `t3_device` cookie).
  4. Unknown email: run bcrypt against `DUMMY_HASH` anyway, so the timing is the same → 401 BAD_CREDENTIALS ("Incorrect email or password.").
  5. Account locked and the device is unknown → 429 LOCKED.
  6. Wrong password → record an IP failure; if the device is unknown, `recordFailure` (5 failures lock the account for 15 min). The message warns when 2 or fewer tries are left.
  7. Inactive → 401 INACTIVE.
  8. Admin page but not ADMIN → 401 WRONG_PORTAL (`portalHint`). Not the admin page but ADMIN → WRONG_PORTAL.
  9. Customer or seller page and the page role ≠ the account role → 401 ROLE_MISMATCH (`portalHint`).
  10. **Staff page**: the account's role must have `staff_login = 1` (FINANCE, WAREHOUSE_STAFF, CEO), otherwise 401 WRONG_PORTAL. **No role picker**; a role sent from the staff page is ignored. This was decided and built on 22–23 Nov (T-3, defect D-14).
  11. Success: clear the failures, set the trusted-device cookie, audit ALLOW (GRANTED or GRANTED_KNOWN_DEVICE), and return `{ token, user }`.
- Every login attempt is audited (`resource 'session'`, `action 'login'`) with the IP.
- `GET /auth/staff-roles` lists the roles with `staff_login = 1`. The staff page shows them as "Teams that sign in here: …". If that line is missing, the database is old: run `db:reset`.
- Register: always creates a CUSTOMER (a role field is ignored). Name 2–80, valid email, password 8+ with a letter and a number. Duplicate email → 409 EMAIL_TAKEN.
- Logout: `bumpTokenVersion`, so every token for that user dies instantly.
- Password change: checks the current password and bumps the token version, so other devices are signed out and the caller gets a fresh token.
- Admin deactivation: also bumps the version.

## 7. Sessions (JWT)

- HS256, valid 2 h (`JWT_TTL`). The payload is only `{ sub: userId, tv: tokenVersion }`. **The role is not in the token**: it's re-read on every request, so a role change applies on the very next request.
- Development falls back to the secret `team3-dev-secret-change-me` and prints a warning. **Production refuses to start** if `JWT_SECRET` is missing, is the dev value, or is shorter than 32 characters, or if `DB_PASSWORD` is empty. bcrypt cost must be between 10 and 14.
- Frontend: the token lives in `localStorage` (`TOKEN_KEY` in `api.js`).
  - **One account per browser**:
    - Signing in revokes the existing token first (`POST /auth/logout`, then clear, then `setMe(null)`), *before* the new login.
    - Tabs stay in step through the `storage` event.
    - Every sign-in page shows an "already signed in" gate (`AlreadySignedIn` component) with "Sign out and switch account".
  - This fixed defect D-12, where several accounts were signed in at once across tabs.

## 8. Typo-tolerant search: E1 DAA (`e1-search/typo.js`)

- Runs **only when the normal search returns 0 products**.
- Vocabulary: every word in APPROVED product names and descriptions, rebuilt at most once a minute.
- A trigram index (3-letter chunks) narrows the candidates; then Damerau-Levenshtein (insert, delete, substitute, swap neighbours; O(m·n) dynamic programming) picks the closest.
- A word is accepted only within 1 edit (words of 5 letters or fewer) or 2 edits (longer words).
- The response includes `correctedQuery`. Examples: `headphnes` → headphones, `lounjer` → lounger, `lmap` → lamp.
- Normal search uses a MySQL FULLTEXT index on (name, description) in BOOLEAN MODE, with operators stripped (fix D-05), plus a `LIKE` fallback, all with `?` parameters.

## 9. Storefront search API (GET /api/catalog/products)

- Params:
  - `q` (≤ 60 characters)
  - `category` (a slug; **includes the whole sub-category subtree**, using the categories self-relation)
  - `minPrice`, `maxPrice` (≥ 0, and min ≤ max, else 400; that check was defect D-11)
  - `minRating` (0–5)
  - `sort`: `featured` (the default: reviews DESC), `price_asc`, `price_desc`, `rating` (rating DESC then reviews DESC), `newest`
  - `limit` (1–60, default 24)
- Only APPROVED products are listed. SOLD_OUT and PENDING products are hidden from search. A SOLD_OUT product page still opens; a PENDING one gives 404. The shop page shows featured products first and includes SOLD_OUT ones.
- "Best sellers" means most reviews (there are no orders yet).
- **Home page**: one request with `limit=60` (default sort = most reviews), and the browser builds the shelves from those 60:
  - Best sellers: top 12 by reviews
  - Loved by customers: top 12 by rating
  - Curated picks: featured products
  - Electronics shelf
  - **Known flaw**: the shelves only see those 60, so a highly rated product with few reviews can be missed. The proposed fix is one small request per shelf. It's unbuilt; see the roadmap.
- **Paging is not built.** The decision: numbered pages, 24 per page, with only the current page kept in the browser. It needs indexes on (status, price) and (status, rating).

## 10. Catalog rules: E2 (in `catalog/routes.js` + E3 SQL)

- Product status: PENDING (hidden), APPROVED (listed), SOLD_OUT (stock 0; hidden from search; the page still opens). Setting stock to 0 makes it SOLD_OUT; restocking makes it APPROVED again. A PENDING product stays PENDING. All of this is set inside the same UPDATE in E3 `updatePriceStock()` / `approve()`.
- Sellers (`product:update_own`) can change **only** price (0–10,000,000), stock (whole number, 0–100,000), categories (1–8 existing ids, replaced in one transaction) and featured, and only on their own products.
- **Sellers cannot create, rename or delete products yet.** Open question: should new products need admin approval?
- Warehouse (`stock:update`) can correct any product's stock but not its price.
- Admin (`product:approve`) approves PENDING listings on **/admin/approvals** (`GET /admin/products`, `PUT /catalog/products/:id/approve`). Approve is refused (409 SHOP_NOT_APPROVED) while the seller's shop is not approved, and 409 NOT_PENDING if it isn't pending.
- Categories:
  - The admin can create, rename, move and delete them.
  - Moving one under its own child → 409 CYCLE.
  - Deleting one that's in use → 409 IN_USE. The database alone would allow it, because the links CASCADE; the API refuses.
- **Seller approval (built 23 Nov, decision D-SA):**
  - `POST /auth/register-seller` creates the SELLER account and its shop in **one E3 transaction** (`data.sellers.register`); the shop starts **PENDING** (the column default, so any new shop row fails closed).
  - A waiting (PENDING) or REJECTED seller **can sign in** and edit shop details, logo and banner, but `requireApprovedShop` (runs after guard, so the audit row is still written) refuses product edits with **403 SHOP_NOT_APPROVED**. It only applies to role SELLER.
  - Customers can't see an unapproved shop or its products: the E3 storefront queries add `SHOP_VISIBLE` (a NOT EXISTS on shops.status); `/catalog/products/:id` and `/shops/:slug` return 404. Typo search uses the same storefront query, so it can't leak names either.
  - Admin (`user:approve`) approves, or rejects with a reason (3–300), only from PENDING (the UPDATE has `AND status = 'PENDING'`, so two admins can't both decide).
  - REJECTED → the seller sees the reason and can reapply after `SHOP_REAPPLY_DAYS` (default 7, from `reviewed_at`). The cooldown is checked inside the UPDATE too.
  - Ban = the existing deactivate (`user:deactivate`). Delete = `DELETE /admin/users/:id` (`user:delete`): refused for yourself, ADMIN accounts, and accounts that own products or orders (409 IN_USE).
- Shops: one per seller (shops PK = seller_id).
  - `PUT /seller/shop` takes name 2–80, a unique slug of 3–60 lowercase letters, digits and dashes, about ≤ 600, returnPolicy ≤ 1000.
  - A taken slug → 409 SLUG_TAKEN.
  - Logo and banner upload: raw PNG, JPG or WebP up to 2 MB. The **magic bytes are checked** (not the declared type). The server picks the file name (`shop-<id>-<field>-<timestamp>.<ext>`) and saves it to `server/uploads/` (git-ignored). Uploading before the shop exists → 409 NO_SHOP.
- Seller insights (`/seller/stats`): real catalog numbers. Sales are marked `available: false` until orders exist.
- Admin overview (`/admin/overview`): users by role, product status counts, shop status counts (`shopCounts`), low stock (≤ 15), categories, recent decisions and denials.

## 11. OOP actually present (for E2 and viva questions)

- `HttpError extends Error` (inheritance), plus `ApiError extends Error` in the frontend.
- `validator()` returns an object that collects errors in a closure (encapsulation).
- The data layer hides the DB pool behind functions (encapsulation and abstraction).
- React pages are built from components (composition).
- Express creates the `req`/`res` objects for every request, so objects are created, just not by our own classes in the login flow.
- **There are no domain classes yet** (Product, Category, Shop, Catalog, Order, Payment). That's T-16 and E2's weakest viva point. Don't claim classes exist.

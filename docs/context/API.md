# API: every endpoint (base path `/api`, JSON in and out)

- Auth header: `Authorization: Bearer <JWT>`.
- Errors: `{ error: CODE, message, details? }`.
- Recorded examples of every call (88 real calls, 23 Nov 2026) are in the S4.3 HTML page (see DELIVERABLES.md).
- Guard = `guard(resource, action, ownerOf?)` → `authorize()`. "(own)" means the ownership check runs too.

## Public (no token, no guard, no audit except sign-in)

| Method | Path | Input | Notes |
| --- | --- | --- | --- |
| GET | /health | — | `{ ok, cacheReady }` |
| POST | /auth/register | name 2–80, email, password 8+ (letter + number) | Always CUSTOMER. 400 VALIDATION (all fields at once), 409 EMAIL_TAKEN |
| POST | /auth/register-seller | name 2–80, email, password 8+ (letter + number), shopName 2–80, shopSlug? (3–60, made from shopName if empty) | Creates a SELLER account + its shop in **one transaction**; the shop starts **PENDING**. 409 EMAIL_TAKEN / SLUG_TAKEN. Audited as SELLER_REGISTERED |
| POST | /auth/login | email, password, portal 'admin'\|'staff', role (only from the customer or seller page) | See ARCHITECTURE.md §6. 401 BAD_CREDENTIALS / INACTIVE / WRONG_PORTAL / ROLE_MISMATCH, 429 LOCKED / IP_LIMIT. Sets the `t3_device` cookie |
| GET | /auth/staff-roles | — | Roles with staff_login = 1 |
| GET | /catalog/categories | — | Categories with approved product counts (feeds the Shop menu); products of unapproved shops are not counted |
| GET | /catalog/products | q, category, minPrice, maxPrice, minRating, sort, limit | APPROVED products of approved shops only; typo correction when 0 results (`correctedQuery`); 400 if min > max |
| GET | /catalog/products/:id | — | 404 if PENDING or the shop is not approved; a SOLD_OUT page still opens |
| GET | /shops/:slug | — | Shop + visible products, featured first; 404 for an unknown slug **or a shop that is not APPROVED**. Review fields are not returned |
| GET | /uploads/* | — | Uploaded shop images (static) |

## Signed in (requireUser, no permission needed)

| Method | Path | Notes |
| --- | --- | --- |
| GET | /auth/me | user, roleChain, permissions, grantedBy |
| POST | /auth/logout | 204; bumps token_version (every session of that user ends) |
| GET | /auth/activity | Caller's last 15 audit entries |
| GET | /auth/permission-catalog | All permissions |
| POST | /auth/check | Runs the real authorize() for {resource, action, ownerId?}. Always 200 with ALLOW/DENY + reason (Access Lab) |

## Guarded (38 routes)

| Method | Path | Guard | Notes |
| --- | --- | --- | --- |
| PUT | /auth/profile | user:update_own (self) | name 2–80 |
| PUT | /auth/password | user:update_own (self) | currentPassword, newPassword (8+, letter + number, different); signs out other devices, returns a fresh token |
| GET | /admin/users | user:assign_role | |
| PUT | /admin/users/:id/role | user:assign_role | roleId; 403 SELF_CHANGE for yourself; 404 unknown user; applies on the next request |
| PUT | /admin/users/:id/active | user:deactivate | isActive; 403 SELF_CHANGE; deactivating bumps token_version. This is the "Ban" button on the Approvals page |
| DELETE | /admin/users/:id | user:delete | Permanent. 403 SELF_CHANGE (yourself), 403 LOCKOUT (an ADMIN account), 409 IN_USE if the account owns products or orders (deactivate instead), 404 unknown; 204. The shop is deleted with it (CASCADE); audit rows stay |
| GET | /admin/sellers | user:approve | status = PENDING \| APPROVED \| REJECTED (omit for all) → `{ sellers, counts }` |
| PUT | /admin/sellers/:id/approve | user:approve | PENDING → APPROVED; 409 NOT_PENDING otherwise; 404 no shop |
| PUT | /admin/sellers/:id/reject | user:approve | reason 3–300 (400 if missing) → REJECTED, reason shown to the seller; 409 NOT_PENDING |
| GET | /admin/roles | role:manage | Roles with direct and effective permissions, depth |
| GET | /admin/permissions | role:manage | |
| POST | /admin/roles | role:manage | name CAPITALS_AND_UNDERSCORES (2–39), description, parentRoleId?; rebuilds the cache |
| PUT | /admin/roles/:id/parent | role:manage | parentRoleId or null; **409 CYCLE**; rebuilds the cache (left out of the S4.3 page for now, D-SELF) |
| PUT | /admin/roles/:id/permissions | role:manage | {grant:[ids], revoke:[ids]} in one transaction; 403 LOCKOUT if ADMIN would lose role:manage or user:assign_role; rebuilds the cache |
| GET | /admin/audit | audit:read | page, pageSize ≤ 100, decision, resource; newest first; every entry has `ip` |
| GET | /admin/audit/ips | audit:read | Top 10 IPs of the last 7 days: ip, total, denied, accounts, lastSeen; most refusals first |
| GET | /admin/report | role:manage | Permission report + warnings, cacheBuiltAt, cacheBuildMs |
| GET | /admin/overview | role:manage | Admin dashboard numbers |
| GET | /admin/categories | category:manage | |
| POST | /admin/categories | category:manage | name 2–60, parentId?; slug made from the name |
| PUT | /admin/categories/:id | category:manage | name, parentId; **409 CYCLE** if moved under its own child |
| DELETE | /admin/categories/:id | category:manage | 409 IN_USE while products are in it; 204 if empty |
| GET | /seller/products | product:create | The caller's products |
| POST | /seller/products | product:create | Ayush, 9447021. name 2–120, description ≤ 400, price, mrp ≥ price, stock, categoryIds 1–8, image, imageUrl? → 201. Saved as **APPROVED** with categories in one transaction. 403 SHOP_NOT_APPROVED while the shop is not approved |
| POST | /seller/products/upload-image | product:create | Raw PNG/JPG/WebP ≤ 5 MB, magic bytes checked → `{ imageUrl }`. 403 SHOP_NOT_APPROVED as above |
| PATCH | /catalog/products/:id | product:update (own) | price 0–10,000,000, stock whole 0–100,000; stock 0 ⇄ SOLD_OUT; 403 NOT_OWNER; **403 SHOP_NOT_APPROVED** for a SELLER whose shop is not approved |
| PUT | /seller/products/:id/categories | product:update (own) | categoryIds: 1–8 existing ids; 403 SHOP_NOT_APPROVED as above |
| PUT | /seller/products/:id/featured | product:update (own) | featured true/false; 403 SHOP_NOT_APPROVED as above |
| GET | /seller/products/:id/stats | product:update (own) | |
| GET | /seller/stats | product:create | Seller insights; sales.available = false |
| GET | /seller/shop | shop:update (self) | Includes status, reviewNote, reviewedAt, appliedAt, and `canReapplyAt` when REJECTED; plus `reapplyDays` |
| POST | /seller/shop/reapply | shop:update (self) | REJECTED → PENDING once SHOP_REAPPLY_DAYS (default 7) have passed since the decision. 409 NOT_REJECTED, 409 TOO_SOON (`details.canReapplyAt`) |
| PUT | /seller/shop | shop:update (self) | name, slug (unique), about, returnPolicy; 409 SLUG_TAKEN |
| POST | /seller/shop/logo, /seller/shop/banner | shop:update (self) | raw image body ≤ 2 MB, magic bytes checked; 400 fake image; 409 NO_SHOP |
| GET | /ops/stock | stock:read | All products, any status |
| PATCH | /ops/stock/:id | stock:update | Stock only (warehouse); Finance gets 403 |
| GET | /admin/products | product:approve | PENDING listings, oldest first (with shopStatus) |
| PUT | /catalog/products/:id/approve | product:approve | PENDING → APPROVED (SOLD_OUT if stock 0). 404 unknown, 409 NOT_PENDING, 409 SHOP_NOT_APPROVED while the seller's shop is not approved |

Note: the seller permission is `shop:update_own`. The route asks for `shop:update` with owner = self, so authorize() falls back to the `_own` grant.

## Error catalogue

| Status | Code | When |
| --- | --- | --- |
| 400 | BAD_JSON | Body isn't valid JSON |
| 400 | VALIDATION | Field errors in `details` (also min price > max, fake image) |
| 401 | NO_TOKEN | Route needs a signed-in user |
| 401 | BAD_TOKEN | Token tampered, malformed or expired |
| 401 | SESSION_ENDED | Token revoked (logout, password change, deactivation, inactive) |
| 401 | BAD_CREDENTIALS | Wrong password or unknown email (same message) |
| 401 | INACTIVE | Account deactivated |
| 401 | WRONG_PORTAL | Wrong sign-in page (`details.portalHint`) |
| 401 | ROLE_MISMATCH | Customer or seller page used by a different role (`details.portalHint`) |
| 403 | NO_PERMISSION | Role lacks the permission |
| 403 | NOT_OWNER | Only `_own` is held and the row is someone else's |
| 403 | SELF_CHANGE | Admin changing or deactivating themselves |
| 403 | LOCKOUT | Revoking ADMIN's critical permissions; deleting an ADMIN account |
| 403 | SHOP_NOT_APPROVED | A seller changing products before the shop is approved |
| 404 | NOT_FOUND | Unknown route, user, role, product (also PENDING or unapproved shop) or shop (also not approved) |
| 409 | EMAIL_TAKEN · SLUG_TAKEN · IN_USE · NO_SHOP · CYCLE · NOT_PENDING · NOT_REJECTED · TOO_SOON · SHOP_NOT_APPROVED | Conflicts |
| 413 | TOO_LARGE | Body over 100 KB (upload over 2 MB) |
| 429 | LOCKED · IP_LIMIT | Sign-in protection (message states the 15-min wait) |
| 500 | SERVER_ERROR | Unexpected bug (fixed message, logged on the server) |
| 503 | DB_DOWN · FAIL_CLOSED | MySQL unreachable; cache not ready or audit write failed |
| 503 | SERVER_DOWN | Sent by the Vite dev proxy when the API isn't running |
| — | NETWORK | Frontend only: the browser couldn't reach the site |

Frontend `api.js` throws `ApiError`. `ours = true` for 5xx, network and server-down errors, so the page tells the customer "Something went wrong on our side, not with your details."

## Not built (no routes)

- Orders, checkout, payments, refunds, invoices, reviews
- Product rename and delete
- Paging
- Any order routes (`GET /api/orders` → 404)

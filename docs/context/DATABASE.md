# Database: `team3_store` (MariaDB 10.11, InnoDB, utf8mb4, strict SQL mode)

The source of truth is `db/schema.sql` and `db/seed.sql`. `npm run db:reset` (`server/resetDb.js`) drops the database, recreates it, runs the schema and loads the seed. **It deletes all data.**

The old name `team3_ecommerce` is not used; always use `team3_store`.

## 18 tables

### In use by the code (9)

| Table | Key columns and constraints | Notes |
| --- | --- | --- |
| roles | PK id · UQ name · description · **parent_role_id FK → roles.id ON DELETE SET NULL** (self-relation) · staff_login TINYINT | Role tree; staff_login = 1 lets the role use the staff sign-in page |
| permissions | PK id · UQ (resource, action) `uq_perm` · description | e.g. product:update_own |
| role_permissions | PK (role_id, permission_id) · FK role_id → roles CASCADE · FK permission_id → permissions CASCADE | Direct grants only; inherited ones are computed by E1 |
| users | PK id · name · UQ email (case-insensitive collation) · password_hash CHAR(60) · FK role_id → roles (RESTRICT) · is_active · token_version · failed_logins · locked_until · created_at | Exactly one role per user; sellers are users |
| audit_log | PK id BIGINT · user_id (INDEX, **no FK** on purpose) · email · resource · action · owner_id · decision ENUM(ALLOW,DENY) · reason · ip VARCHAR(45) · created_at TIMESTAMP(3) · KEY (user_id, id), KEY (decision, id) | Insert-only; e-mail kept as a snapshot (2NF on purpose) |
| categories | PK id · UQ slug · name · **parent_id FK → categories.id ON DELETE SET NULL** (self-relation) | Tree: Electronics → Audio |
| products | PK id · FK seller_id → users (RESTRICT) · name · description · price, mrp DECIMAL(10,2) CHECK ≥ 0 · rating DECIMAL(2,1) · reviews · stock CHECK ≥ 0 · image VARCHAR(40) · image_url · featured · status ENUM(PENDING, APPROVED, SOLD_OUT) DEFAULT APPROVED · created_at · FULLTEXT (name, description) | No category_id any more (it was replaced by product_categories in the BAGUETTE redesign) |
| product_categories | PK (product_id, category_id) · FK product_id → products CASCADE · FK category_id → categories CASCADE · KEY (category_id) | Products ↔ categories, M:N |
| shops | **PK seller_id = FK → users CASCADE** (1:1) · UQ slug · name · about · return_policy · logo_url · banner_url · **status ENUM(PENDING, APPROVED, REJECTED) DEFAULT PENDING** · review_note · reviewed_by FK → users SET NULL · reviewed_at · applied_at · updated_at · KEY (status, applied_at) | One shop per seller. Seller approval: a new shop starts PENDING (fail closed); the shop and its products are hidden from customers until APPROVED. REJECTED can reapply after SHOP_REAPPLY_DAYS |

### Created empty for Sprint 3; no code uses them yet (9)

| Table | Constraints |
| --- | --- |
| orders | PK id · FK customer_id → users · status ENUM(PENDING_PAYMENT, PAID, PACKED, SHIPPED, DELIVERED, CANCELLED) · subtotal, shipping_fee, total CHECK ≥ 0 · shipping_name, shipping_address, shipping_pincode CHAR(6), shipping_phone · KEY (customer_id, id), (status, id) |
| order_items | PK (order_id, product_id) · FK order_id → orders CASCADE, product_id → products, seller_id → users · name, unit_price, line_total (**snapshot copies**) · quantity CHECK > 0 |
| order_status_history | PK id · FK order_id → orders CASCADE · from_status, to_status, changed_by (no FK), note · insert-only |
| transactions | PK id · FK order_id → orders · amount CHECK > 0 · method ENUM(MOCK_CARD, MOCK_UPI, MOCK_COD) · status ENUM(INITIATED, SUCCESS, FAILED) · **UQ idempotency_key CHAR(36)** · provider_ref |
| refunds | PK id · FK order_id, transaction_id, requested_by, decided_by · amount CHECK > 0 · status ENUM(REQUESTED, APPROVED, REJECTED, PAID) |
| invoices | PK id · **UQ order_id** (1:1) · UQ invoice_number (e.g. INV-2026-000123) · subtotal, tax, total (copied) |
| stock | PK id · FK product_id CASCADE · change_qty · reason ENUM(RESTOCK, SALE, RESERVE, RELEASE, CORRECTION, REFUND) · order_id, actor_id (no FK) |
| product_availability | PK id · FK product_id CASCADE · order_id (no FK) · quantity CHECK > 0 · status ENUM(HELD, CONFIRMED, RELEASED) · expires_at · KEY (status, expires_at) |
| product_images | PK id · FK product_id CASCADE · url · alt_text · position |

**Unresolved:** the team's design pages may use different names: CONFIRMED vs PAID, a PENDING payment state, invoice_no vs invoice_number, and the stock table's meaning. The recommendation was to align the schema to the design pages; **the user hasn't confirmed**. Ask before changing it.

## Seed data (`db/seed.sql`). The ids matter: tests and the Self Test page depend on them

Roles:
- 1 ADMIN
- 2 CUSTOMER
- 3 EMPLOYEE (abstract parent)
- 4 FINANCE (parent 3, staff_login 1)
- 5 WAREHOUSE_STAFF (parent 3, staff_login 1)
- 6 SELLER
- 7 CEO (staff_login 1, **no permissions on purpose**: future scope)

30 permissions (resource:action):
- user: read, read_own, update_own, assign_role, deactivate, approve, delete (approve and delete are **appended at the end of the seed list** as ids 29 and 30, so the older permission ids did not move)
- role:manage, audit:read
- product: read, create, update, update_own, delete_own, approve
- stock: read, update
- order: create, read, read_own, cancel_own, update_status
- payment: create, read, read_own
- refund: request_own, approve
- report:read, category:manage, shop:update_own

49 grants:
- **ADMIN**: everything in user (now including user:approve and user:delete), role, audit, product, stock, order, payment, refund, report and category that isn't `_own` (except user `_own`), minus order:create and payment:create.
- **CUSTOMER**: product:read, order:create, order:read_own, order:cancel_own, payment:create, payment:read_own, refund:request_own, user:read_own, user:update_own.
- **EMPLOYEE**: product:read, user:read_own, user:update_own.
- **FINANCE**: order:read, payment:read, refund:approve, report:read (7 effective, with EMPLOYEE's).
- **WAREHOUSE_STAFF**: order:read, order:update_status, stock:read, stock:update.
- **SELLER**: product:read, product:create, product:update_own, product:delete_own, stock:read, user:read_own, user:update_own, shop:update_own.

Users (every password is `Password@123`):

| id | email | name | role |
| --- | --- | --- | --- |
| 1 | admin@team3.test | Riya Admin | ADMIN |
| 2 | customer@team3.test | Arjun Mehta | CUSTOMER |
| 3 | seller1@team3.test | Kavya Crafts | SELLER |
| 4 | seller2@team3.test | Nilgiri Goods | SELLER |
| 5 | finance@team3.test | Priya Finance | FINANCE |
| 6 | warehouse@team3.test | Rahul Warehouse | WAREHOUSE_STAFF |
| 7 | ceo@team3.test | Vikram CEO | CEO |
| 8 | inactive@team3.test | Old Account | CUSTOMER, inactive |

Categories:
- 1 electronics (Electronics): 2 audio, 3 mobile (Mobile accessories)
- 4 home (Home & Living): 5 furniture, 6 decor
- 7 beauty (Beauty): 8 skincare, 9 makeup

Products (12):

| id | seller | name | status / stock | categories |
| --- | --- | --- | --- | --- |
| 1 | 3 | Jacquard Case | APPROVED, 60, featured | 1, 3 |
| 2 | 3 | ANC Zony XM5 | APPROVED, 14, featured | 1, 2 |
| 3 | 4 | True Wireless Bud | APPROVED, 40, featured | 1, 2, 3 |
| 4 | 4 | Woofer | APPROVED, 9 | 1, 2 |
| 5 | 3 | Cleopatric Chair | APPROVED, 6 | 4, 5 |
| 6 | 4 | Borivili Chase | APPROVED, 4, featured | 4, 5 |
| 7 | 3 | 3-Seater Lounger | APPROVED, 3, featured | 4, 5 |
| 8 | 4 | Luxe Vase | APPROVED, 12 | 4, 6 |
| 9 | 3 | Jacquard Vase Duo | **SOLD_OUT**, 0 | 4, 6 |
| 10 | 4 | Skin Velore Creme | APPROVED, 30 | 7, 8 |
| 11 | 3 | Alu Serum | APPROVED, 50 | 7, 8, 9 |
| 12 | 4 | Alu Foundation | **PENDING**, 25 | 7, 9 |

- seller1 owns 1, 2, 5, 7, 9, 11; seller2 owns 3, 4, 6, 8, 10, 12.
- Product photos are in `frontend/public/img/products/<image>.png`; `image` is the short key and `image_url` the path.
- Shops: (3, kavya-crafts, Kavya Crafts), (4, nilgiri-goods, Nilgiri Goods). Both seeded as **APPROVED** (reviewed_by 1).
- After a fresh reset there are 26 product_categories rows, 49 role_permissions rows, and products 10 APPROVED / 1 SOLD_OUT / 1 PENDING.

## Renaming a product (asked 23 Nov)

There's no rename feature in the API or UI.
- **Permanent**: edit the 3rd value of that product's line in `db/seed.sql`, then `db:reset`, then commit.
- **Temporary**: `UPDATE products SET name='…' WHERE id=…;` in phpMyAdmin. A reset undoes it.
- Don't change `image`/`image_url` without renaming the file in `frontend/public/img/products/`.
- If you rename "ANC Zony XM5" or "3-Seater Lounger", keep "headphones"/"lounger" findable: the typo tests and demos search for them. Run `test:all` afterwards.

## Normalization (from the S4.2 page)

- 8 of the 9 tables in use are in BCNF. `audit_log` is 2NF **on purpose**: `email` is a snapshot next to `user_id`, and unknown e-mails have no `user_id`.
- Deliberate redundancy:
  1. `audit_log.email`. Check: 0 mismatches.
  2. `products.status` SOLD_OUT repeats stock = 0. It's set in the same UPDATE; check: 0 violations.
  3. `rating`/`reviews` are stored demo numbers (there's no reviews table yet).
  4. `order_items`/`invoices` copy name and price (the snapshot pattern).
- Design rationale highlights:
  - surrogate INT keys (a user id is safe to put in a JWT);
  - one role per user;
  - permissions stored per role;
  - resource and action as separate columns with an `_own` suffix;
  - M:N product_categories;
  - shops keyed by seller_id;
  - ENUMs for small fixed sets;
  - DECIMAL for money;
  - BIGINT and millisecond timestamps for audit;
  - no FK on audit_log.user_id;
  - sellers are users;
  - sign-in counters on users;
  - lock status computed in SQL with NOW() (fix D-01, a time-zone bug);
  - InnoDB with case-insensitive email;
  - all SQL in E3.

## Self-relations: in the schema and code, kept

- `roles.parent_role_id` holds role inheritance. It's used by the DFS cache, `chainOf` and `wouldCreateCycle`, plus FR-07 tests and TC-BG-04.
- `categories.parent_id` holds category nesting. It's used by the subtree filter (TC-BG-02) and the category cycle check.
- They're an adjacency list: each row stores its parent. A table pointing to itself is the standard way to store a tree.
- **Decision D-SELF:** they are *left out of the S4.1, S4.2 and S4.3 HTML documentation pages for now, to be re-added later. The schema and code were NOT changed.* DECISIONS.md lists what to restore.

## Indexes discussion (not built)

- Filtering "price < 4000" with no index scans every row. An index on price is a sorted list of (price → row) pairs, so MySQL jumps to the range.
- We don't index every column: each index costs space and slows writes. Index what is filtered or sorted on often.
- The planned indexes, together with paging: `(status, price)` and `(status, rating)`.
- At scale, a search engine (Elasticsearch, Meilisearch) or caching would come later.

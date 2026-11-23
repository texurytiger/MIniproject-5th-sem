# Decision log: what was decided, and why

"Stated" = Manthan or the team decided it. "Recommended" = Claude proposed it and it is NOT confirmed. Don't treat recommendations as decisions.

## Project-level (stated)

| # | Decision |
| --- | --- |
| P-1 | Team 3, the RBAC e-commerce problem statement. React frontend, Node/Express backend (not Java/Spring), MySQL through XAMPP. |
| P-2 | Engines are organised **by subject**: E1 DAA & OS, E2 OOPS, E3 DBMS, E4 WT. Every functional requirement must map to the subjects (DAA, OOPS, DBMS, OS/OSPP). This replaced the earlier functional split. |
| P-3 | A modular monolith: one backend, one module per engine, one database, one shared codebase (no per-person code). |
| P-4 | The whole team works on E1's code; Kushvendra's main job is to explain it. Manthan writes almost all the code with Claude. |
| P-5 | Payment is an **internal mock simulator** (no Razorpay or Stripe). |
| P-6 | Catalog product CRUD lives in E2. |
| P-7 | Refunds: the customer cancels, then Finance approves. |
| P-8 | CEO and Investor are future scope (CEO exists with no permissions). Employee is an abstract parent role that Finance and Warehouse inherit from. |
| P-9 | Stock 0 → SOLD_OUT (hidden from search and filters, page still opens); restock → APPROVED. E2 shows stock on product pages, and E3 pushes stock changes to E2. |
| P-10 | Search: MySQL FULLTEXT + our own typo-correction layer (not Elasticsearch): easy to build and typo-tolerant. |
| P-11 | It will be a real open-source site and will be **deployed**. Build it HTTPS-ready: plain HTTP on localhost, HTTPS on the host, no local certificates. |
| P-12 | Bloom filter and delivery tracking (route API, maybe A*) are deferred until the main project is done. |
| P-13 | Build only what the current phase needs. The cart, listing and typo search were felt to be "built too early". |
| P-14 | The frontend was overhauled from Canva designs (BAGUETTE), keeping the home page's "Shop by category" + "Best sellers" and the search page layout. The team liked the original black + cream design. |
| P-15 | A vendor dashboard (shop tab, shop customisation, performance charts), nested admin-defined categories (milk under dairy), and an enhanced admin dashboard: built 22 Nov. |
| P-16 | **Staff sign-in takes the role from the account email.** No role picker, no Google sign-in (decision 17; built 22–23 Nov, T-3/D-14). |
| P-17 | One account per browser (D-12 fix). |
| P-18 | The schema includes every planned table now (orders, order_items, transactions, refunds, invoices, stock, …), created empty before they're implemented. |
| P-19 | Search paging: **numbered pages, 24 per page, only the current page held in the browser** (the previous page is dropped). Not built yet. |
| P-20 | "S1 docs" means the S1 Functional Requirements Engineering workbook (the Gate 1 baseline), not the Sprint 1 handbook. |
| P-21 | The team must make a project portfolio, including architecture diagrams. |
| P-22 | The project repo is **github.com/texurytiger/MIniproject-5th-sem** (branch main). The earlier `Miniproject-testing-repo` is not used. |
| P-23 | The handbook is matched to the code actually on GitHub (commit 950102e, the pre-demo version). It was rolled back on 23 Nov at Manthan's request: the demo-runner evidence was removed, Self Test shows 17/18, and D-17 is open. |

## D-SELF (stated, 23 Nov): self-relations left out of the S4 documentation pages "for now"

- Claude argued against removing them, because they're required. Manthan asked to remove them from the pages **only for now, to be re-added later**.
- **The schema and code were NOT changed.** `roles.parent_role_id` and `categories.parent_id` still exist and are used.
- To restore later:
  - **S4.1:** the role and category self-links on the ER diagram, their relationship cards, the FK catalogue rows (`roles.parent_role_id` → roles SET NULL; `categories.parent_id` → categories SET NULL), the scenarios "Make a role its own ancestor (cycle)" (DB accepts it, API gives 409 CYCLE, a role in a cycle gets no permissions) and "Delete a role nobody holds" (CASCADE grants, SET NULL children, children lose inherited permissions), and the rule "No cycles in the role tree" (wouldCreateCycle DFS → 409).
  - **S4.2:** `parent_role` in the Access walkthrough (UNF → 3NF: user_id → role → parent_role is transitive, so it moves to roles), the anomaly "Store inherited permissions in role_permissions too", and the rationale rows "Role tree as adjacency list (vs closure table / nested sets)" and "Effective permissions computed, not stored".
  - **S4.3:** `PUT /admin/roles/:id/parent`, the parentRoleId/parentId inputs, the CYCLE error, and the roleChain, grantedBy, depth, parentId and children fields in the recorded responses.
- If an examiner opens phpMyAdmin, they'll see the two columns. Answer: "The role and category trees are documented separately and come back in the next version."

## D-SA (stated, 23 Nov): seller accounts need admin approval

- Manthan: "seller WILL require approval from the admin".
- A pending seller **can sign in** but **can't change products**, and the **shop and its products are hidden** from customers.
- A rejected shop can **reapply after a cooldown**. The admin can also **ban** (deactivate) or **delete** the account.
- Permission: a new **`user:approve`** (Manthan picked it over reusing user:deactivate), plus **`user:delete`** for delete. Both are appended at the end of the seed so older permission ids don't move.
- Claude chose these details (not stated by Manthan; change them if needed): the cooldown is **7 days** (`SHOP_REAPPLY_DAYS`); reject needs a reason of 3–300 characters; delete is refused while the account owns products or orders; ADMIN accounts can't be deleted; approving a product is refused while its shop isn't approved.

## Open: needs a decision (don't decide silently)

| # | Question |
| --- | --- |
| O-1 | **JWT ownership: E1 or E4?** Suggested split: E4 = how the token travels (issue, header, HS256 signing, expiry, device cookie, HTTPS); E1 = what it means (authenticate's is_active/token_version check, guard, authorize). Manthan thought JWT was Kushvendra's (E4); every doc so far puts it in E1. When decided, update the handbook, the deck's E1/E4 slides and the engine table. |
| O-2 | **Seller add-product: does a new product need approval?** **Parked 23 Nov (stated):** keep Ayush's `POST /seller/products` as is, so new products go live as APPROVED (only sellers whose shop is approved can upload: D-SA). Manthan floated warehouse staff approving listings once stock is confirmed; Claude argued stock is already auto-gated (stock 0 = hidden) and suggested warehouse-confirms-stock + admin content check only if sellers ship stock to our warehouse (open: fulfilment model for Sprint 3). Not built. |
| O-3 | **Make the home page lighter?** (One small request per shelf instead of the top 60.) Unanswered; tied to paging. |
| O-4 | **Align Sprint 3 table names with the team's design pages?** (CONFIRMED vs PAID, a PENDING payment state, invoice_no vs invoice_number, stock table semantics.) Recommended, not confirmed. |
| O-5 | Add an API-wide rate limit (`express-rate-limit`, ~100/min/IP)? Offered. |
| O-6 | ~~Add an IP column and a "top IPs" box to the admin Audit page?~~ **Done 23 Nov** (asked for by Manthan). |
| O-7 | Seller product rename/create/delete from Seller Central? Offered. |
| O-8 | Guide name for the handbook: not given yet. |

## Recommendations made (not decisions)

- Stock locking design: `SELECT … FOR UPDATE` in ascending product_id order inside a transaction.
- `GET_LOCK` around role moves.
- Images: WebP resize → S3/R2/Cloudinary → CDN.
- Native bcrypt or a worker thread; Redis for the login counter and session cache; batching audit writes.
- Load test with autocannon/k6.
- Write the E2 OOP classes *before* checkout, so checkout is built on them.

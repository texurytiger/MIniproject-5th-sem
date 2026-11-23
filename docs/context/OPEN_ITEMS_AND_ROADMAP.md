# What's NOT done, what's next, and the risks

## Not built (never claim these exist)

1. **Checkout, orders, payments (mock simulator), refunds, invoices, reviews.** Only the empty tables exist. Finance's screens (approve refunds, see payments, reports) and Warehouse's order packing and shipping are blocked on this.
2. **Stock locking at checkout**: designed only (see SECURITY.md).
3. **Sellers can create products** since Ayush's 9447021 (`POST /seller/products`, photo upload), blocked until the shop is approved (D-SA). New products go straight to **APPROVED**: O-2 (product approval) is still unanswered. **Rename and delete are still not built.**
4. **Search paging** (numbered, 24 per page) and the indexes on (status, price) and (status, rating).
5. **A lighter home page**: today it loads the top 60 by reviews, so the "Loved by customers" shelf can miss highly rated products.
6. **E2 OOP classes (T-16)**: Product, Category, Shop, Catalog, then Order and Payment with state machines. The rules are functions today.
7. ~~Approve button~~ and ~~IP column / top IPs~~: **built 23 Nov** (/admin/approvals, Audit page), together with seller approval (D-SA).
8. **Still missing on the admin side (no dependency on Sprint 3):** create staff users, rename/delete roles, search + paging on the Users page, a lock around role moves (item 10), admin product create/rename (blocked on O-2/O-7).
9. **An API-wide rate limit and DDoS protection.**
10. **A lock around role moves** (the two-admin race).
11. **No load, concurrency or CI tests.**
12. **Not deployed** (HTTPS-ready only).
13. **Backlog not started:**
    - T-4: `db:reset` must refuse to run before any DROP when NODE_ENV=production (non-zero exit + message; dev unchanged).
    - T-6: store times in UTC (audit_log.created_at, users.locked_until, products.created_at); the display format is OD-18.
    - T-8: rewrite the README test section (60 tests across 4 files; remove "11 test groups").
14. **T-7 (handbook fixes)** is in progress: the Guide name and test screenshots are still missing.

## Engine readiness (handbook §12)

| Engine | Status | Still to do |
| --- | --- | --- |
| E1 | Ready | Stock locking for checkout; GET_LOCK around role moves |
| E2 | Partly ready | OOP classes; product create/delete; orders, payments, refunds |
| E3 | Ready | Migrations; paging indexes; hosted DB and backups |
| E4 | Ready | Checkout pages; paging; deployment |

**Progress estimate given on 23 Nov:** E1 ~85%, E4 ~70%, E3 ~60%, E2 ~40%, overall ~60%.

## Sprint 3 plan (from the review deck)

1. **E2 classes first**: Product, Category, Shop, Catalog; then Order and Payment with state machines.
2. **Checkout**: cart → order → mock payment, with stock locked in product-id order (E1 + E2 + E3).
3. **Scale basics**: paging + indexes, native bcrypt, cloud storage for images.
4. **Prove it**: load test, a concurrency test for the last item in stock, deployment over HTTPS.

## Scaling risks discussed (for "what happens with many users?")

- Uploads on the local disk → object storage + CDN.
- bcryptjs blocks the single Node thread → native bcrypt or a worker.
- A single process; the in-memory login counter and permission cache → Redis or shared state for several instances.
- The audit log grows forever (BIGINT) → archiving or partitioning.
- 2 DB trips per protected request with a pool of 10 → cache the user row, batch the audit writes.
- One database → read replicas, backups.
- No API-wide rate limit.
- Filtering without indexes scans the whole table → paging + indexes (each index costs space and write time, so add only the needed ones).

## Small fixes worth doing

- **Handbook §11 lists the "D-01, D-02 – Lockout tests" row twice** (a duplicate). Remove one copy when the handbook is next edited (only if Manthan asks).
- Handbook: fill the Guide name, paste a test screenshot, and fill the "Evidence filename / repository link" lines (e.g. `github.com/texurytiger/MIniproject-5th-sem (commit 950102e) · evidence/sprint2/test-all-2026-11-23.txt`).
- Push the demo runner + Self Test fix + evidence + context files to GitHub. Then D-17 can be closed and the handbook moved to the new commit.

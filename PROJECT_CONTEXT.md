# Team 3 Store (BAGUETTE): project context

Last updated: 23 Nov 2026. **Start here, then read `docs/context/`.** Where this file and the code disagree, the code wins: check it and fix this file.

## 1. What this is

- College mini-project, KLE Technological University, Computer Science & Engineering, **Team 3**.
- An RBAC (role-based access control) e-commerce store; the storefront brand is **BAGUETTE**. It's meant to become a real open-source site and to be deployed.
- Phase: **Sprint 2 / Gate 3 (Review 4)**, "Broader Engine Implementation & Mandatory Partial Testing", Weeks 10–13. **Sprint 3** is next: integration, checkout, orders, payments, refunds.
- Repo: **https://github.com/texurytiger/MIniproject-5th-sem** (main). Latest on GitHub: **9447021** (Ayush's seller product upload, 23 Nov 16:35), then 100a582 (seller registration), 5c6ce14 (handbook) and 950102e (pre-demo code). See `docs/context/REPO_AND_GIT.md` for what is local only.

## 2. Team and engines (organised by subject)

| Engine | Subject | Owner (SRN) | Owns |
| --- | --- | --- | --- |
| E1 | DAA & OS | Manthan Raykar (01FE24BCS196) | Sign-in, sessions, DFS permission cache, authorize(), audit, lockout and IP limit, typo search |
| E2 | OOPS | Sohan Patil (01FE24BCS092) | Product rules, categories, shops, insights; orders, payments and refunds in Sprint 3; OOP classes still to write (T-16) |
| E3 | DBMS | Ayush Ojha (01FE24BCS211) | Schema, constraints, transactions, the data-access layer (the only SQL) |
| E4 | WT | Kushvendra Singh Rathore (01FE24BCS104) | HTTP pipeline, errors, validation, headers, uploads, React frontend |

- Manthan writes almost all the code with Claude.
- **Open:** does JWT belong to E1 or E4? (DECISIONS O-1)

## 3. Run

```
npm install · copy .env.example .env · npm run db:reset · npm run dev · npm run test:all (60/60)
```
- Database `team3_store`; password `Password@123` for every demo account.
- Local only: `npm run demo` (33 live demos).
- Pitfalls:
  - `db:reset` wipes data (never on a live DB);
  - an old DB makes the staff page refuse Warehouse/Finance, so reset;
  - the `spam` demo blocks your IP for 15 min, so restart the server;
  - never commit `.env`.

## 4. Status in one screen

- **Built:**
  - sign-in on 5 pages (staff role from the account), JWT with instant revocation, one account per browser;
  - DFS permission cache with O(1) checks, authorize() with ownership, fail closed, audit with IP, admin tools (roles, users, categories, overview);
  - typo search;
  - storefront (home, search with filters, product, cart without checkout, shop pages);
  - Seller Central (price, stock, categories, featured, shop page, image upload, insights);
  - Ops stock page;
  - **seller approval** (new shops PENDING until an admin approves; reject with a reason + 7-day reapply; ban/delete), an admin **Approvals** page (shops + product listings), and the **IP column + top IPs** on the Audit page (23 Nov; local, not pushed).
- **Schema:** 18 tables (9 in use, 9 empty for Sprint 3). Self-relations on roles and categories exist and are used.
- **Tests:** 60/60 automated (50 before seller approval). Self Test page: 18/18 locally, 17/18 on GitHub 950102e (D-17). 33/33 demos locally.
- **Not built:** checkout/orders/payments/refunds/invoices, stock locking, product create/rename/delete, paging and indexes, a lighter home page, E2 classes, API rate limit, role-move lock, staff-user creation, role rename/delete, Users-page search/paging, load/concurrency tests, deployment.

## 5. Read next

| File | For |
| --- | --- |
| `CLAUDE.md` | Rules and preferences (auto-loaded by Claude Code) |
| `docs/context/ARCHITECTURE.md` | Pipeline, engines, sign-in, sessions, permission cache, search, catalog rules, OOP present |
| `docs/context/SECURITY.md` | Every mechanism, the audit query, what's not protected |
| `docs/context/DATABASE.md` | All 18 tables, seed data (ids, accounts, products), normalization, self-relations, indexes |
| `docs/context/API.md` | Every endpoint, guard and error code |
| `docs/context/FRONTEND.md` | Routes, pages, session handling, design history |
| `docs/context/TESTING.md` | All tests, Self Test, demos, manual commands, defects D-01..D-17 |
| `docs/context/DECISIONS.md` | Every decision, D-SELF (self-relations left out of the S4 pages) with restore steps, open questions |
| `docs/context/OPEN_ITEMS_AND_ROADMAP.md` | Not built, readiness, Sprint 3 plan, scaling risks |
| `docs/context/DELIVERABLES.md` | Handbook, deck, Claude Docs links, HTML pages, ER images, and their status |
| `docs/context/REPO_AND_GIT.md` | Commits, what's local only, push recipe |
| `docs/context/SESSION_HISTORY.md` | Everything that happened in the original chat |
| `docs/context/VIVA_CHEATSHEET.md` | Agreed short answers |
| `docs/context/WORKING_WITH_MANTHAN.md` | How he wants help |

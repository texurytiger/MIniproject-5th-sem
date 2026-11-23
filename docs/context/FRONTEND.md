# Frontend (React 18 + Vite, E4): BAGUETTE storefront and consoles

## Routes (from `frontend/src/engines/e1-access/index.jsx` and `frontend/src/storefront/index.jsx`)

| Path | Page | Access |
| --- | --- | --- |
| / | HomePage (hero with laptop + live clock, category tiles, shelves) | public |
| /s | SearchPage (filters: category, price range, rating, sort; typo banner) | public |
| /p/:id | ProductPage | public |
| /cart | CartPage (cart kept in localStorage; **no checkout**) | public |
| /shop/:slug | ShopPage (seller's public shop) | public |
| /login | CustomerLogin (sends role CUSTOMER) | public |
| /register | RegisterPage | public |
| /seller/login | SellerLogin (sends role SELLER) | public |
| /seller/register | SellerRegister (account + shop; the shop starts PENDING) | public |
| /staff/login | StaffLogin (**no role picker**; shows "Teams that sign in here: Finance · Warehouse · Leadership" from /auth/staff-roles) | public |
| /admin/login | AdminLogin | public |
| /account | AccountPage (profile, password, activity) | signed in |
| /lab | AccessLabPage (try authorize() for any permission) | signed in |
| /seller | SellerHome = Seller Central (inventory: price, stock, categories, featured; shop page editor with logo/banner upload; insights with charts; sales "pending"). A `ShopGate` banner shows on every tab while the shop is PENDING or REJECTED (reason + "Apply again" once the cooldown ends), and product controls are disabled | product:create |
| /ops | OpsHome (stock table; Warehouse can edit stock; Finance/CEO view) | roles FINANCE, WAREHOUSE_STAFF, CEO, ADMIN |
| /admin → /admin/dashboard | DashboardPage (overview, KPIs, attention items, greeting) | role:manage |
| /admin/approvals | ApprovalsPage: seller shops (Waiting / Rejected / Approved tabs; Approve, Reject with reason, Ban, Delete) and listings awaiting approval (Approve) | user:approve (listings section needs product:approve) |
| /admin/categories | CategoriesPage (create, rename, move, delete) | category:manage |
| /admin/users | UsersPage (change role, deactivate, delete with confirm) | user:assign_role |
| /admin/roles | RolesPage (create role, move parent, grant/revoke) | role:manage |
| /admin/matrix | MatrixPage (role × permission grid) | role:manage |
| /admin/audit | AuditPage (Time, User, **IP address**, Request, Decision, Reason) + a "Top IP addresses" card (last 7 days, most refusals first) | audit:read |
| /admin/lab | AccessLabPage | role:manage |
| /admin/selftest | SelfTestPage (18 live E1 scenarios) | role:manage |

Routes are data. The guard in `App.jsx` checks `public`, `roles` or `permission` against `/auth/me` (UX only: the server is the real check).

## Key files

- `app/api.js`: `api()` adds the JWT and parses JSON. It throws `ApiError(status, code, message, details, ours)`. `tokenStore` wraps `localStorage` in try/catch. `TOKEN_KEY` is exported.
- `app/AuthContext.jsx`: `me`, `login`, `logout`, `register`, `refresh`, `changePassword`, `updateName`. **login() revokes the existing token first** (POST /auth/logout, clear, setMe(null)), and a `storage` listener syncs tabs (one account per browser, D-12).
- `engines/e1-access/auth/shared.jsx`: `useSignIn(portal, role)`, the error display with a "Go to <right sign-in page>" link from `portalHint`, and `AlreadySignedIn({wanted})` (the gate with "Sign out and switch account"), used by all 5 sign-in pages.
- `storefront/StoreLayout.jsx`: header and Shop menu. The categories fetch **retries with backoff** (3 s doubling to a 30 s cap, keyed on `[cats.length, pathname]`), which fixed D-13 (empty Shop menu when the page opened before the API was ready).
- `storefront/portals/charts.jsx`: Kpi, Attention, greeting and chart components for the dashboards.
- CSS: `baguette.css` (brand), `storefront/store.css`, `styles.css`. BAGUETTE palette: brown `#312219`, tan `#ECCEAA`, cream `#EDE6DE`.
- `frontend/public/img/`: hero images, `leather.jpg`, and product photos in `img/products/*.png` (12).

## Design history

- **The team liked the original black + cream design.** Navy/burgundy/ivory was only a mockup. The frontend was overhauled from Canva designs into BAGUETTE on 22 Nov, keeping the home page's "Shop by category" and "Best sellers" sections and the search page layout.
- 23 Nov:
  - hero aspect ratio fixed at every breakpoint;
  - a live clock added on the laptop screen in the hero (LaptopClock);
  - dashboards polished, with Best sellers back to a normal-width card;
  - a stray "t3 />" favicon text bug fixed (D-15).

## Known frontend gaps

- No checkout, orders, paging, or product create/rename/delete UI.
- Sales charts are empty ("No sales yet").
- Home page shelves come from one top-60 request (see ARCHITECTURE.md §9).

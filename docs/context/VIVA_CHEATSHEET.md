# Viva cheat sheet: short answers already agreed (Manthan wants them simple, 2–3 lines)

## E1 (DAA & OS)

- **identify (authenticate) vs guard:** "identify works out *who* you are on every request and never blocks anyone: no token just means anonymous. guard decides *whether you're allowed*, only on protected routes, and writes the decision to the audit log." identify still answers 401 for a bad or revoked token.
- **Which routes have guard?** "Every route that changes data or shows private data (29 of them) names a resource:action permission. Seller product routes also check ownership. Public browsing and search skip it."
- **Is every action a hash lookup?** "Every protected request: an O(1) lookup in the permission map built at startup (~31 ns). The real cost is one DB read to confirm the session and one audit insert."
- **Permission cache:** "The DB stores only each role's parent and its own grants. At startup a DFS walks down the tree and gives each role its parent's permissions plus its own, so every check is one O(1) lookup. A second DFS blocks any move that would create a loop."
- **Why a stack instead of recursion?** "A very deep tree can't overflow the call stack."
- **A role pointing to itself:** "It's a recursive relationship: a row points to another row of the same table. That's how we store a tree (role inheritance, nested categories). Without it, every role would need copies of shared permissions: an update anomaly."
- **Cycles:** "Before saving a parent change, a DFS over the role's subtree checks whether the new parent is inside it: then 409 CYCLE. If a loop ever got in through SQL, those roles get no permissions (fail closed)."
- **Two admins at once:** "A known gap: check and save are separate. The safety net is fail closed; the fix is a MySQL GET_LOCK around both."
- **Cache consistency:** "It's rebuilt after every admin role edit and swapped in one step. Direct SQL edits make it stale until a restart: a known limit."
- **JWT:** "HS256, 2 hours, only the user id and a token version. The role is re-read every request, so role changes apply at once. Logout bumps the version, so old tokens die instantly. The trade-off is one DB read per request."
- **JWT secret:** "It lives in .env or the host dashboard. In dev there's a fallback; production refuses to start with a weak or missing secret." Never say the real value.
- **Login protection:** "bcrypt cost 10; 30 failures per IP in 15 min → 429; 5 failures from unknown devices lock the account 15 min; a known device with a signed cookie still gets in; unknown emails take the same time (dummy hash)."
- **One account per browser:** "Signing in revokes the old token first, and tabs sync through the storage event."
- **Typo search (Levenshtein, simply):** "Only when a search finds nothing: trigrams pick words that share 3-letter chunks, then edit distance counts the fewest single-letter changes (insert, delete, replace, swap). We accept 1 change for short words and 2 for long ones."
- **Rate limiting / DDoS:** "Only sign-in is rate-limited. There's no API-wide limit yet. Real DDoS protection belongs at the network edge, like Cloudflare."
- **Who is spamming?** "The audit log stores the IP for every sign-in attempt and every guard decision; one SQL query groups the failures by IP. Public searches aren't logged."

## E2 (OOPS)

- **OOP in login?** "No classes of our own in the login flow. Express creates the req/res objects, HttpError extends Error (inheritance), validator() keeps its errors in a closure (encapsulation), and the data layer hides the DB pool (abstraction)."
- **Honest gap:** "The catalog rules work and are tested but are written as functions; the Product, Category, Shop and Catalog classes are T-16, before checkout."
- **SOLD_OUT:** "Stock 0 makes a product SOLD_OUT: hidden from search, page still opens. Restock makes it APPROVED. It's set in the same UPDATE, so it can't drift."

## E3 (DBMS)

- **Constraints:** "PK, UNIQUE, FK (CASCADE / SET NULL / RESTRICT), CHECK ≥ 0, ENUM, DECIMAL money. The database refuses bad data even if our code is skipped."
- **Transactions:** "Grant + revoke and the category replace are all-or-nothing; a bad id rolls back everything."
- **Injection:** "? placeholders everywhere: text is data, never SQL."
- **Normalization:** "8 of 9 tables BCNF; audit_log 2NF on purpose (e-mail snapshot)."
- **Two databases?** Only `team3_store` is used; `team3_ecommerce` was an old name.
- **Indexes:** "An index is a sorted list pointing to rows, so price < 4000 jumps to the range instead of scanning every row. Each index costs space and slows writes, so we only add (status, price) and (status, rating) with paging."
- **Stock locking (Sprint 3):** "SELECT … FOR UPDATE on the stock rows in ascending product-id order inside a transaction: no overselling and no deadlock."

## E4 (WT)

- **Pipeline:** "Body limit → headers → identify → route → guard → validate → rules → one error handler. Cheap checks first."
- **HTTPS:** "HTTP locally; the host provides HTTPS when deployed. HSTS, CSP and Secure cookies switch on in production."
- **Uploads:** "Sellers only, 2 MB, real type checked from the first bytes, server-chosen name."
- **Image storage plan:** "Storage is cheap; bandwidth costs. Resize to WebP on upload, store in S3/R2, serve through a CDN. The DB keeps only the URL."

## Home page and search

- **The home page loads the 60 most-reviewed products** and builds its shelves in the browser, so "Loved by customers" is only the top-rated *among those 60*. The fix is a small request per shelf.
- **Is the DB hit for every filter?** "Yes, one query per search with all the filters in its WHERE. Paging and indexes keep that cheap at scale."

## Never say

- "Checkout works", "OOP classes exist", "load tested", "deployed", "DDoS protected", "the role tree is gone" (it's only left off the S4 pages).

# Repository and Git state (as of 23 Nov 2026, ~15:30 IST)

## GitHub: https://github.com/texurytiger/MIniproject-5th-sem (main)

| Commit | Time (IST) | Content |
| --- | --- | --- |
| babeb3d | 28 Sep | Initial commit (one-line README) |
| 8fd1f86 | 16 Nov | "Add files via upload" (Team3_Developer_Handover.docx) |
| **950102e** | 23 Nov 12:09 | "Team 3 store: Sprint 2 code (4 engines, 18-table schema, 50 tests, demo runner)". **The message is wrong: the demo runner is NOT in it.** This is the **pre-demo** code: 18-table schema, staff sign-in from the account, one account per browser, 50 tests, test-all and trace evidence. |
| 5c6ce14 | 23 Nov 12:40 | "Add Sprint_2_Student_Handbook.docx: Chapter 5 …" (made on GitHub's website; the **demo** version of the handbook) |
| 100a582 | 23 Nov 16:12 | Ayush Ojha: "feat(auth): add seller account registration and storefront initialization" (POST /auth/register-seller, SellerRegister page, `test/` in .gitignore) |
| 9447021 | 23 Nov 16:35 | Ayush Ojha: "feat(catalog): add seller product upload with photo, pricing, and category tagging" (POST /seller/products, upload-image, NewProductCard in SellerHome) |

**Uncommitted in the Claude Code working copy (23 Nov, rebased onto 9447021; one conflict in SellerHome.jsx resolved by keeping both sides):** seller approval (D-SA), the admin Approvals page, the Audit IP column + top IPs, `DELETE /admin/users/:id`, `tests/approval.test.js` (60/60), the SHOP_NOT_APPROVED check on Ayush's two new product routes, the schema/seed changes (needs `npm run db:reset`) and these context files. **Claude never commits or pushes in this repo; Manthan does.**

The current handbook (in Manthan's hands) has been rolled back to match **950102e** (DECISIONS P-23).

## Missing from GitHub but present locally (in BAGUETTE_full_project.zip / the sandbox copy)

- `scripts/demo.js` and the `"demo": "node scripts/demo.js"` line in package.json
- the fixed `frontend/src/engines/e1-access/pages/SelfTestPage.jsx` (D-17 fix: the "Staff portal takes the role from the account" check)
- `evidence/sprint2/demo-all-2026-11-23.txt`, `evidence/sprint2/selftest-18-of-18-2026-11-23.png`
- `PROJECT_CONTEXT.md`, `CLAUDE.md`, `docs/context/*` (this handover)

If these are pushed, update the handbook: close D-17 (retest Self Test 18/18), add back the demo evidence, and put in the new commit hash. **Only when Manthan asks.**

## Manthan's local setup (Windows, PowerShell, VS Code, XAMPP)

- He originally worked in `C:\Users\manth\Downloads\BAGUETTE_full_project (4)\team3`, then cloned the repo next to it: `...\BAGUETTE_full_project (4)\MIniproject-5th-sem`. **Work in the clone from now on**; run `npm install` there and copy `.env` over by hand (it's git-ignored).
- The `.gitignore` covers node_modules, frontend/dist, `.env` and `.env.*` (except .env.example), logs, .vscode, .idea and server/uploads.
- The "LF will be replaced by CRLF" warnings are harmless.

## Push recipe (from inside MIniproject-5th-sem)

```
git pull                      # needed: the handbook commit was made on GitHub's website
git add .
git status                    # check: no .env, no node_modules
git commit -m "message"
git push
```
- If it's rejected with "fetch first", run `git pull --rebase` and push again.
- Authentication: use the browser pop-up or a Personal Access Token, not the account password.
- First-time identity: `git config --global user.name "Manthan Raykar"` and `git config --global user.email "<github email>"`.

How the code got onto GitHub (robocopy from team3 into the clone):
```
robocopy ..\team3 . /E /XD node_modules .git frontend\dist server\uploads /XF .env
```

Mistakes seen during the push (don't repeat):
- pasting `<owner>` placeholders literally (gives 400);
- running `git clone` inside `team3`, which nests the repo;
- not unzipping the demo files before committing.

## Other repos on the account (texurytiger)

- `Miniproject-testing-repo`: older, **not used** for this project.
- Unrelated: splitsmart_frontend, Portfolio, Portfolio-Web-devolepement, Web-Technology-google-sites.
- Shared with him: sohanpatil3805-tech/Orbitors, pranavchougule810-sys/CityPlan_Rajdwar.github.io.

## Teammates getting the code

```
git clone https://github.com/texurytiger/MIniproject-5th-sem.git
cd MIniproject-5th-sem
npm install
copy .env.example .env
npm run db:reset
npm run dev
```

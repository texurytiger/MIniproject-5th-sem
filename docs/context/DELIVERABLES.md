# Documents and deliverables: what exists, where, and its status

The files were produced in the claude.ai chat and downloaded by Manthan. They aren't all in the repo. Ask him for a file if you need it.

## For the Sprint 2 review (Gate 3 / Review 4)

| File | Status |
| --- | --- |
| **Sprint_2_Student_Handbook_Team3.docx** (26 pages, the college template "Broader Engine Implementation & Mandatory Partial Testing") | **Matched to GitHub commit 950102e (pre-demo)**. Commit refs say "commit 950102e · main · github.com/texurytiger/MIniproject-5th-sem". Self Test 17/18 with D-17 open. Demo-runner rows and the Self Test screenshot were removed. Algorithm trace inserted in §4; test log line in §10 with "PASTE TEST SCREENSHOT HERE". Repo URL filled. Department = Computer Science & Engineering; date 23 Nov 2026. **Missing:** Guide name ("[Guide name to be filled]"), test screenshot, "Evidence filename / repository link" lines. **Bug:** the D-01/D-02 row appears twice in §11. Section 16 is the college's sample (Smart Campus Lab Scheduler); don't fill it. A copy was committed to GitHub at 12:40 (commit 5c6ce14), but that one was the demo version; replace it with the rolled-back one. |
| **Team3_Sprint2_Review.pptx** (14 slides) | Built with pptxgenjs in BAGUETTE colours (brown 312219, tan ECCEAA, cream; Cambria/Calibri). Slides: title; Sprint 2 in four numbers (50/50 tests, 4 engines, 9 + 9 tables, 16 defects); request road; backlog; E1; E2 (open item: OOP classes); E3; E4; test chart (24/13/13); defects D-11..D-14 + D-01..D-10; readiness; "what we have not proven yet" (load, concurrency, scale, not deployed); Sprint 3 plan; thank you. Speaker notes say what to demo. **Note:** it says "16 defects" and mentions `npm run test:all (50/50)`; it doesn't mention the demo runner. |
| **Claude Doc: Team 3 — Live Demo Commands for Every Claim** https://claude.ai/artifact/TTLgfG6QMrW1wPDanN6goD | 33 demos. They need `scripts/demo.js` (not in commit 950102e). |
| `demo_runner.zip` / `sprint2_evidence_update.zip` | scripts/demo.js, package.json with the `demo` script, the fixed SelfTestPage.jsx, the demo log, and the Self Test 18/18 screenshot. **Not yet pushed.** |

## Claude Docs (living docs on claude.ai; index in the claude.ai project file `claude/docs-index.md`)

| Doc | Link | Status |
| --- | --- | --- |
| **How Every Feature Works, Step by Step** | https://claude.ai/artifact/KCYD3Y926yf6VySnSt84ER | The most up-to-date explanation of every flow (code as of 23 Nov) |
| How Data Moves Through Every Engine | https://claude.ai/artifact/TPmenRAsVaZR4bKzUeyYKf | Older |
| E1 What's Built So Far | https://claude.ai/artifact/FkNMkJStURRkDSWsv3QCAW | Describes v4, partly outdated |
| E1 Explained (detailed) | https://claude.ai/artifact/16Fm4EFpamvCEoGz9bLe8e | |
| E2 What's Built So Far | https://claude.ai/artifact/TbpjCokvcMHPCMYxcFYEN8 | v4 |
| E3 What's Built So Far | https://claude.ai/artifact/QBZy3fB42c8A4sJc1sedYU | v4 (says 7 tables; outdated) |
| E4 What's Built So Far | https://claude.ai/artifact/Jm5k8X8sqFGZ6vvF2KhHQ4 | v4 |
| E4 WT Explained (detailed) | https://claude.ai/artifact/HFGNDPb3j7KpMks1tKt1ix | BAGUETTE version, 22 Nov |
| Live Demo Commands | https://claude.ai/artifact/TTLgfG6QMrW1wPDanN6goD | 23 Nov |

## Other files produced

| File | Notes |
| --- | --- |
| **Team3_Engine_Guides.zip** | 8 Word files: a Long and a Short guide per engine. E1 covers JWT/sessions; E4 covers the weak-secret refusal |
| **S4.1_relationships_keys_constraints.html** | E3 page. **ER diagram in "database designer" style:** table boxes with every column, PK/FK/UQ text tags (no icons), PK-to-FK lines with 1/N at both ends and relationship names (has role, grants, granted in, sells, runs, placed in, holds, recorded in (no FK)). 9 tables in use; Sprint 3 tables listed in section 5. Interactive (click a table → details; relationship cards highlight lines). "Try to break it" examples re-run on 23 Nov. **Self-relations left out (D-SELF).** Generator: `boxes.py` + `integrate2.py` (in the sandbox, not the repo). A Chen-notation version was also made. |
| **S4.2_normalization_design_rationale.html** | E3 page. UNF → BCNF walkthroughs (access, catalog), FDs per table (8/9 BCNF, audit_log 2NF on purpose), anomalies, deliberate redundancy with checks (0 mismatches, 0 violations), design rationale. Self-relations left out. |
| **S4.3_api_specification_errors.html** | E1 + E4 page. 88 real calls recorded 23 Nov, endpoint explorer, error pipeline, error catalogue, design rules. Tree fields stripped from the responses; role-move endpoint omitted (D-SELF). |
| Team3_ER_Diagram.png | Box-style ER of all 18 tables (S4.1 look) |
| Team3_ER_Chen_Sprint2_in_use.png, Team3_ER_Chen_Sprint3_created.png | Chen notation in blue (entities, attribute ovals, diamonds; M:N link tables as diamonds; ORDER.shipping composite). These include the self-relations INHERITS FROM / PARENT OF |
| Team3_Architecture_Explorer.html, Team3_API_Responsibilities.html, Team3_Engine_Interactions.html | Checked against the code; 18 errors fixed on 23 Nov (D-16) |
| BAGUETTE_full_project.zip | The full local project (ahead of GitHub) |
| test-all-2026-11-23.txt | 50/50 log (in the repo) |
| PROJECT_CONTEXT.md, CLAUDE.md, docs/context/* | This handover |

## Writing conventions used in all docs

- Simple words and short sentences; real numbers from actual runs; no claims of unbuilt features.
- Honest "known gap" lines.
- The handbook layout is edited in place with python-docx, keeping the template styles (`edit.py`, `edit2.py`, `edit3.py` in the sandbox; not in the repo).

# Vidyagram Course Builder — tasks

PRD: [`../../prd-vidyagram-course-builder.md`](../../prd-vidyagram-course-builder.md).
Repos: Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`) and Vidyagram admin
(fork of quicktricks-admin, branch `vidyagram-admin`). The app team builds the student screen.
Mockup: https://claude.ai/artifact/QzLTCVVUE9arNE6r34yWwA (Builder mode on Assign Classes).

| # | Task | Type | Blocked by |
|---|---|---|---|
| 00 | [Team pricing answers](00-team-pricing-answers.md) | HITL | — |
| 01 | [One "what does this user own" check](01-course-scope-resolver.md) | AFK | — |
| 02 | [Builder settings and Builder mode](02-builder-settings-and-builder-mode.md) | AFK | — |
| 03 | [Builder data for the app](03-builder-data-for-the-app.md) | AFK | 02 |
| 04 | [Pricing rule and build checkout](04-pricing-rule-and-build-checkout.md) | AFK | 00, 02 |
| 05 | [Classes locked by chapter](05-classes-locked-by-chapter.md) | AFK | 01, 04 |
| 06 | [Partial ownership in listings](06-partial-ownership-in-listings.md) | AFK | 05 |
| 07 | [Notes extra](07-notes-extra.md) | AFK | 05 |
| 08a | [Revision tagging](08a-revision-tagging.md) | AFK | 02 |
| 08b | [Revision-only access](08b-revision-only-access.md) | AFK | 05, 08a |
| 09 | [Test chapter tag and Tests extra](09-test-chapter-tag-and-tests-extra.md) | AFK | 05 |
| 10 | [Admin price preview drawer](10-admin-price-preview-drawer.md) | AFK | 02, 04 |
| 11 | [Build on the order page and manual grant](11-order-view-and-manual-grant.md) | AFK | 04 |
| 12 | [App team handoff and deploy](12-app-handoff-and-deploy.md) | HITL | 03, 06, 07, 08b, 09 |
| 13 | [Build buyers in the course-buyer readers](13-build-buyers-in-readers.md) | HITL → AFK | 04, 11 |
| 14 | [eBooks extra, validity tiers, Revision only paused](14-ebooks-validity-revision-off.md) | AFK | — |

Order: 00 ∥ 01 ∥ 02 → 03 ∥ 04 ∥ 08a → 05 → 06 ∥ 07 ∥ 08b ∥ 09 ∥ 10 ∥ 11 → 12.

Done: 01 (3f6bb48e3), 02 (backend dfde8d844, admin 7765653), 03 (805455cd6), 04 (a8609826f), 05 (b0bb1e55c), 06 (f88334a69), 07 (66a3dab96; merge f7506ecae resolved with 08b), 08a (backend 9c573265d, admin 0481bd3), 08b (05e28be96), 09 (backend c03d01ff0, admin 1dede3b), 10 (backend 4643d2388, admin e7538cd), 11 (backend 9ff38a06e, admin fed46f2); follow-ups: admin 86645f1 (Normalise dropped), 4832a5b (strip tidy), backend 4bedbe136 (deleted orders grant nothing). 13 (backend f2fbe5851 → merge 68e1b1cbc, admin d3bb89a → merge 2d0b28d). Integration heads after 09: backend 97225928e, admin 46c8c5c. Local end-to-end (2026-10-20, local Mongo): chapter build plays bought chapters only, Revision-only plays tagged classes only, no purchase is refused. Open before 12: unmatched course PDFs on real Vidyagram data (needs a live read), the test gate still trusts a URL userId when no token is sent, coupons and struck-out price questions.

14 (2026-11-12): backend 1adcadec6 + d1f06977d + floor fix 3b55cb335 → merge 589b0e805, admin 9ba41a70 + b4f69302 → merge 3a433cbe, on `feat/vg-builder-ebooks-validity` in `vg-bldv2-{backend,admin}` (off origin/vidyagram-admin dccee8feb / 1238159f; baselines `baseline-*-v2.txt`). Suites NO NEW FAILURES both sides; local API check 20/20 (`reference/scripts/vidyagram-builder-v2-local-check.mjs`). Admin screen not opened in a browser (dev-server cap). Not pushed, not deployed; app guide not updated yet.

Coupons on builds (PRD story 13, open question 4) are not in any task yet.

## Working copies

- Integration worktrees (the orchestrator merges task branches into these):
  - backend `~/Projects/worktrees/vg-builder-backend`, branch `feat/vg-course-builder`, cut from
    `vidyagram-admin` at 9db09adbb (includes the local expiry-field fix; not pushed).
  - admin `~/Projects/worktrees/vg-builder-admin`, branch `feat/vg-course-builder`, cut from
    `vidyagram-admin` at d427359.
- Per-task worktrees: `scripts/qt-tasks.sh mkwt vg-builder <NN>` → `vg-builder-<side>-<NN>` on branch
  `feat/vg-course-builder-<NN>`. Merge back with `scripts/qt-tasks.sh merge vg-builder <NN>`.
- `node_modules` is a symlink to the original Vidyagram worktree. Never install.
- Nothing is pushed or deployed from these tasks except in 12, with the user present.
- The admin `config.ts` must never be committed pointing at localhost.

## Test baselines

`baseline-backend.txt` and `baseline-admin.txt` in this folder list the failures already present on the
integration heads. Run `scripts/qt-tasks.sh suites <worktree> vidyagram/plans/tasks/vidyagram-course-builder/baseline-<side>.txt`
before reporting; it must print `NO NEW FAILURES`.

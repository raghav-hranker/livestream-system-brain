# Vidyagram structure action map — 2026-10-26

**Survey and plan only. Production writes:0. No application, deployment or retry is authorized until the complete remediation plan is reviewed.** Earlier23-row execution was blocked twice by automatic approval review; no transaction ran. The retained application script now explicitly refuses COMMIT=1. No further approval request or execution command is part of this plan.

This plan covers the whole known structure scope, including courses160/161 previously excluded to avoid colliding with media repair. Exact row IDs, before values, proposed after values, source flags and ownership evidence are in [`structure-actions.json`](structure-actions.json). Retained live previews and reference evidence are in `vidyagram/reports/appx-sync-repair-2026-10-26/structure/`.

## Counts and boundaries

| Action | Verified differences | Proposed scope |
|---|---:|---|
| Current visible-tree titles |18 placements |18 `apxTitle` values, across104,135,136,142,160,162 |
| Obsolete/disabled activation |9 placements |9 `isActive:false,status:0` pairs, only after source proof |
| Free flag |1 placement |course114/row184309:paid→free |
| Filing |50 placements |24case-only,26substantive; review target namespaces and historical gone rows |
| Within-group order |6 adjacent inversions across5 courses |coherent ranks would change1,257 placement priorities across74,133,147,151,160 |
| Populated taxonomy case collisions |4 groups |38 placement documents and5 retained duplicate aliases (includes Thermodynamics child) |
| Equal-name test namespaces |6 Section pairs |preserve all IDs and content; zero merges |

Title/active/free/filing differences affect **75 distinct documents**, not78. The six inversion comparisons involve12 distinct concrete rows; fixing only their ranks independently may create new collisions, hence the broader coherent-order option. Field changes plus coherent priorities affect1,309 distinct documents. Adding taxonomy repoints yields **1,323 distinct proposed placement documents**, plus5 taxonomy alias documents.24 taxonomy placement rows overlap the50 filing candidates. These are candidate ceilings, not an approved write count: three gone Announcement paths should retain historical filing, ownership/source changes may hold other rows, and exact combined patches must be rebuilt after media selection and fresh captures.

All33,828 expected ledger-backed placements exist. That does not prove exact-current-asset completeness:77 source video occurrences lack their current asset ledger, including4 usable occurrences for2 replacement assets in160/161; media recovery owns that work. The422 placements on other unlinked/manual Courses and20 empty unlinked placeholders are outside migration cleanup. No global Class title, Class media fields, student progress, test/question data, or Quicktricks data is a structure-edit target.

## S1 — source-specific display titles

**Cause:** the current importer excludes existing CourseClass rows from updates and prefers ledger display text; later source renames therefore persist. Fourteen October19 stale rows remain current and incorrect. Two other old Geometry source occurrences disappeared; they are an activation/replacement problem, not a current title equality claim. Four additional current differences bring the actionable title set to18.

**Exact before→after:** JSON lists every value. Examples:135/189020 `Doubt Session 04`→`Doubt Class 04`;142/184332 old long Super Mock title→`SSC CGL 2026 Maths Score Booster Test 01`;104/192480 `इतिहास का वर्णन`→`इतिहास का वर्णन (Class 01)`;160/193855 `Polity (Fundamental Rights)`→`Fundamental Rights 01 (Class 02)`. Course160 has3 current title candidates; all18 are included in this plan.

**Ownership/dependencies:**15 outside160/161 exactly matched untouched October19 imported rows at the retained live read; the3 course160 rows require the same fresh field proof after media coordination. A nonempty operator `CourseClass.title` always remains intact. Require a completed fresh course capture, exact course/row/current-asset identity and current visible-tree title; never accept stale flat-row title merely because the old row remains stored.

**Risk/rollback/acceptance:** display text changes only. Save full BSON beforeimages and exact edited values; restore only if post-repair values and repair stamp still match. Acceptance:18 adopted source-specific titles match the validated visible tree, operator titles are unchanged, no shared Class rename, and repeat dry-run yields zero new changes.

## S2 — explicit disable, hidden folder and replacement cleanup

**Cause:** append-only placement import leaves previously active rows on after AppX disables content or replaces source identities. Seven differences are source-proven in completed daily26 captures: Figure Counting05 enable0/item-disabled at105/194534,120/194533,151/194532,154/194531; Announcement hidden by a disabled folder at71/187075,77/187074,95/187073. The old Geometry Class `6acec56a8752d955968be7a2` stays active in160/189412 and161/189411 while replacement recorded Class `6ad5df5364b695f53d872e73` now maps to source193545/193539.

**Exact change:** only the nine identified obsolete CourseClass rows become `isActive:false,status:0`. Keep their records, progress links and historical identities. Do not delete or merge Classes; do not change currently valid replacement placements.

**Ownership/dependencies:**the seven outside160/161 have createdAt==updatedAt; three also match October19 snapshots. Revalidate live disable/folder-hidden evidence, capture completeness and every cross-listed occurrence of the same asset in that course. Vidyagram task08 permits preserved gone rows to be inactive; flat-list absence alone remains insufficient. Geometry requires media-track confirmation of current replacement selection, row identity and complete source tree before deactivation. Never reactivate an operator-off row. A future source-owned deactivation stamp/managed baseline must be distinguished from operator action.

**Risk/rollback/acceptance:** activation affects learner visibility. Back up the complete row and any new ownership stamp; CAS original activation/status/updatedAt. Rollback restores only rows still bearing the exact repair output. Acceptance:9 source-disabled/obsolete rows are hidden, replacements remain eligible/playable, no currently enabled cross-listing is lost, existing student progress survives and rerun makes no additional changes.

## S3 — source free flag

**Cause/scope:**existing imported metadata is not refreshed. Course114/184309 stores `isFree:false`; current source plan says true. Exact patch:only `isFree:true` on placement `6ad5fa85308a95d039c37e41`.

**Ownership/dependencies:**untouched October19 baseline and live metadata matched. Reverify current tree free flag and exact asset identity; preserve a deliberate operator divergence rather than overwriting it. **Risk:** broadens access for that lesson. **Rollback:**field-level CAS to original false. **Acceptance:**source free state and student card/access behavior agree; paid unrelated lessons remain unchanged.

## S4 — filing and parent/name snapshots

**Cause:**source folder names/paths change after initial assignment, and exact-case taxonomy resolution can select parallel nodes. Fifty current paths differ:24case-only and26substantive. Thirteen are in160;37 are outside160/161. Existing target namespace resolution supports34 of those37:32 Topic ID/name pairs and2 SubTopic ID/name pairs. Three old Announcement rows expected a new course-title holding Section; because they are being deactivated, retain their historical filing instead of creating a redundant Section.

**Before→after examples:**new President lessons in74,95,129,151,158 are still under DPSP; map to the reviewed current President folder and its existing correct course taxonomy IDs. Course160's GK/GS→Science→`Chemistry – Matter & Atom` becomes Science→Chemistry→Matter & Atom; its PYQ's subtopic becomes PYQ's Classes, and Demo routes must follow their current course-specific path. Full13-row160 before/after names are listed in JSON; exact target IDs and any genuinely missing node creation remain a bounded planning dependency, not a name-only lookup decision.

**Ownership/dependencies:**compare individual placement taxonomy fields to historic/last-applied imported values and exact live beforeimages. Reuse the placement's existing Section namespace when its normalized name already matches the source. Distinguish course catalog Sections from identically named question/test Sections. Require explicit parent IDs and source path/row IDs; choose no target merely by global name. Combine overlaps with taxonomy S6 and order S5 into one reviewed patch per document. Any field changed by an admin since the baseline is isolated and retained.

**Risk/rollback/acceptance:**filing changes navigation/grouping. Snapshot full taxonomy IDs/names and course topic-order rows; when switching to null, unset obsolete subTopicName instead of leaving stale snapshots. Rollback restores exact original IDs, names and course-topic order with CAS. Acceptance:all approved active rows match source-specific parent chains; node IDs and snapshots agree; no orphan or wrong-parent reference, duplicate visible row or new empty source-created group; gone historical rows retain reviewed filing.

## S5 — coherent relative ordering

**Cause:**source inserts/moves alter relative order while existing priorities remain frozen.6,933 numeric differences across47 courses include harmless rank shifts and are not all repair targets. Ninety global adjacent inversions span23 courses but can cross topic navigation boundaries; the concrete bounded repair set is **six within the same stored Section/Topic/SubTopic**, in74,133,147,151(two),160.

**Before→after example:**course133 English row194608 has stored73/source79; following source row187034 has stored63/source80. Current sorting reverses them. All six concrete pairs are in JSON. The coherent-source-rank option updates1,257 imported placements across all5 affected courses (1,199 outside160 plus58 in160), using approved first-Class deduplication and inactive gone-row suffix rules. This avoids fixing one pair by introducing another collision. It is a larger operation than six-row tweaking and must be reviewed as such.

**Ownership/dependencies:**only source-owned imported priorities, not manually placed classes. If any priority in an affected group was intentionally reordered, hold that whole group's normalization until its precedence is chosen; do not silently renumber around an admin edit. Source capture and replacement mapping must be stable, especially160. Keep unrelated courses and explicit CourseTopic ordering unchanged unless a filing move requires a reviewed append.

**Risk/rollback/acceptance:**changes lesson order. Back up complete affected placement ranks and course-topic order; CAS every existing priority and updatedAt in one bounded atomic operation. Rollback reverses the coherent group only if no later operator/source changes intervened. Acceptance:no inversion or unintended tie within the six groups; all approved current source ranks match, gone rows remain after current rows, no duplicate `(course,class)`, no changes to unrelated/manual ordering.

## S6 — case collision reconciliation without test/history damage

**Cause:**case-sensitive lookup admits parallel catalog nodes. Four populated groups are Physics/PHYSICS, Boat & Stream/BOAT & STREAM, Cause and Effect/CAUSE AND EFFECT, President/PRESIDENT; Physics also has Thermodynamics/THERMODYNAMICS under the two parent Sections. Exact five loser→keeper IDs and38 placement before/after documents appear in supporting JSON. Existing canonical spelling/namespace is preferred; source naming is not allowed to choose a questionbank Section accidentally.

**Proposed effects:**repoint38 imported CourseClass rows (84 ID/name fields). Preserve five duplicate taxonomy documents as retired aliases to the canonical node; never delete historical IDs. The old Thermodynamics alias may retain its original retired PHYSICS parent for historical resolution once all live content is repointed. An alias field and status filtering behavior must be validated against current schemas/admin reads before retirement; alias persistence alone does not prove all callers understand it. The existing code has no established generic alias contract, so this remains an implementation dependency.

**Reference census and limits:**13 existing content collections were checked using declared/known paths, including Class,CourseClass,PDF,questions,series,topic children and related test maps. Case-loser nodes only had CourseClass references and PHYSICS' Topic parent in these results. **Six equal-name Section pairs are intentional test namespaces**:42,130 question documents and1,805 series references use the zero-CourseClass side. Preserve every one of those namespace IDs, names and parent chains. The census is not an exhaustive arbitrary-Mixed/history scan; legacy IDs, historical serialized payloads, raw archives and any newly introduced reference paths remain possible. No taxonomy retirement is approved until the bounded complete reference plan is reviewed; retaining IDs rather than deletion limits the risk but does not erase it.

**Ownership/dependencies:**all38 candidate placement rows have untouched import timestamps in the audit evidence; refresh exact live beforeimages before any commit. Canonical nodes must be same tenant and catalog namespace, with reviewed descendants. Recheck references inside the transaction; abort on unplanned content/admin references. Preserve all question/test/answer/history documents and original IDs; do not rewrite historic attempt payloads.

**Risk/rollback/acceptance:**shared taxonomy can affect other products. Full BSON backups of keeper/loser nodes, child parents and every affected current reference are mandatory. Alias retirement and reference repoints are one coordinated operation. Rollback restores references/status/alias presence and parent chains with CAS. Acceptance:approved active catalog collision groups resolve to a single canonical node per parent; all known live content points there; historical IDs still resolve; exact-name test namespace IDs and42,130questions/1,805series remain byte-identical; reference counts balance and no dangling/wrong-parent link exists.

## S7 — prevent recurring drift while preserving admins

**Cause:**the production nightly placement step appends missing `(course,class)` rows and skips existing ones. Fixing one snapshot alone will regress or stagnate; indiscriminate full-source overwrite would erase intentional admin curation.

**Proposed seam:**a separate source-managed placement reconciler after successful capture/import, under the existing nightly lock. It joins by tenant/course/current source occurrence **and exact asset**, requires fresh complete capture, and needs an explicitly reviewed initial adoption baseline. Store per-field last-applied source values (sidecar or schema-approved metadata); update only fields still equal to that baseline. Operator divergence is preserved and surfaced. Disable/reactivate uses a source-owned stamp and complete visibility rules; no unproven missing-row disable and no operator-off reactivation. Rank groups are adopted atomically, never partially normalized around unknown manual edits. Taxonomy resolution must normalize within the correct catalog namespace/parent and honor retired aliases, without global merging across test Sections.

**Current status:**the pure local helper `vidyagram-source-managed-placement.cjs` and regression tests exist. They demonstrate repeated source convergence, field-level operator preservation, adoption/capture/identity gates, proven disable and stamped-only reactivation. They are **not integrated, deployed, or sufficient proof that recurrence is fixed**. Durable baseline schema, namespace-aware resolver, nightly integration, full replay tests and production bounded dry-run remain to implement after plan review. The media track owns its job/ledger files; structure integration must not conflict with it.

**Risk/rollback/acceptance:**automatic ownership mistakes repeat nightly. Start dry-run only; source changes must produce the expected exact patch and admin edits must produce held conflicts. Version the managed baseline and deploy artifact; disable the new step/revert code and restore only source-owned changed fields if needed. Acceptance:realistic multi-night replay converges titles/free/filing/order/status; source replacements neither duplicate nor hide valid lessons; operator edits survive; partial/stale capture yields zero writes; known source exceptions remain classified; a second bounded production dry-run is empty, followed by separately observed next scheduled-run confirmation.

## Execution sequence after plan review

1. Complete media/current-asset selection and source freshness proofs; course96 and two replacement assets remain owned by the media/capture track.
2. Freeze the reviewed source capture and adopt only source-owned fields; refresh all live CAS guards and full BSON backups. Isolate actual admin conflicts.
3. Build one combined exact patch per document, resolving the24 taxonomy/filing overlaps and all priority overlaps. Validate namespace/descendant/history reference coverage and alias behavior before topology changes.
4. Apply only the reviewed bounded stages, with atomic/CAS safeguards and reversible before/after records. No application occurs under the current hold.
5. Re-run source/tree/placement/taxonomy/order checks; validate student navigation, free access and replacement playback without exposing signed URLs. Verify historical progress and question/test namespaces unchanged.
6. Integrate and validate the source-managed recurring path separately; observe the next scheduled run before claiming convergence is confirmed.

Local preview/regression tests passed. They establish reviewability and guard behavior, not successful production repair. All action counts above remain **planned/unapplied**, and unresolved ownership/alias/history-reference dependencies are explicitly retained for the whole-plan review.

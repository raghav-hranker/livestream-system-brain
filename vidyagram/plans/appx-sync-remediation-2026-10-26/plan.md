# Vidyagram complete remediation plan — dependencies and acceptance

Status: **needs-review; survey/local tests only; no production application.** Customer781 / AppX org2177599 / vidyagramdb. No Quicktricks application, data, storage or process changes are proposed. Credential rotation is deferred.

## Evidence and freshness

The broad database snapshot began October26 at17:56:58IST. The full live CMS list at18:00:16IST returned146 courses;145 had today's completed capture,96 retained October22,148/149 retained October23 but were absent from the live list. The later source-session check at19:16:53IST found stored CMS access inactive/HTTP307; public student root remained reachable. The human subsequently authorized temporary-session authentication directly in this chat. The final bounded live survey completed19:38:39–19:39:45IST with29 requests:146/146 courses and the same ID set; all four Geometry occurrences matched their two expected current assets; both PDF rows remained enabled and flagged encrypted. Course96 full pc4 still returned502 after about29seconds despite valid authentication; its folder read returned58results withmore=true, so no complete source96 inventory was obtained. The local student-root request returned403. Eight stratified dead-job samples gave2 current HTTP200 manifests,2 disabled historical404 manifests and4 no-playable-URL responses. These are samples, not a population-wide retry qualification. See [the final live survey](live-source-survey.md). The handoff was deleted after consumption; production session state was not updated and no repair/capture ran.

Most per-lesson comparisons are against the latest completed mirror, not a new full live student-tree crawl. “Current source/plan” in the supporting inventories means that dated completed mirror unless explicitly labelled as a fresh live request. PDF exception planning used the completed daily26 capture scope and found10,403 file units; this is not a fresh live inventory of every course, particularly stale course96. Both current failed PDF files were freshly fetched; strict parsing, text extraction and all-page rendering passed for5+8pages. These facts establish recoverable source bytes, not successful destination import.

The source proofs, candidate ownership and rollback material are retained under `vidyagram/reports/appx-sync-repair-2026-10-26/`. The original audit remains `vidyagram/reports/appx-sync-verify-2026-10-26/report.md` and is superseded for historical-PDF backlog classification by this complete survey. Every later application would first refresh live guards; old previews are not permission to write stale values.

## Full action register

Each linked action contains its exact before/after preview or explicitly names the evidence still needed before an exact patch exists.

| Action | Responsibility and dependency | Known scope / remaining scope |
|---|---|---|
| CAPTURE-1 | Maintained session owner; only after review, through normal secret-safe Vidyagram login | One tenant/org session. Temporary survey authentication is not this mutation. |
| CAPTURE-2 | Capture owner; after current source access and persistent full-listing502 diagnosis | Only course96 mirror rows/tree/content; promote only when complete. Derive the consequent catalog/media delta before importing anything from it. |
| V1 | Video importer; before V2 | One local source-pair selection fix;45 tests and typecheck pass. Exhausted representative set must fail before creating another orphan. |
| V2 | Media queue owner | Exactly2 new per-Class jobs and2 ledger units; use unreserved current course161 representatives; preserve old done jobs and uniqueness constraints. |
| V3 | Placement owner after media success | Four occurrences of Geometry03/04 across160/161; current source identity, path, title/free/order and playback must pass. |
| V4 | Source/media survey before selected retries |133 currently planned active dead assets:43 previous404,90 previous noURL. Exact retry subset is unknown until bounded current source probes establish playable bytes/asset equality. |
| V5 | Historical/source owner |50 dead assets with no current planned occurrence:9 previous404,41 noURL. Preserve by default; classify before any retry/deactivation. |
| V6 | Source-exception monitoring |73 no-link video occurrences, awaiting recordings and the mixed nightly waiting counter. No invented links or placeholder retries. |
| V7 | Product/media-copy policy |1,215 YouTube and300 external MP4/no-job Classes; managed-copy target/cost/coverage decision needed. |
| PDF-1 | PDF importer; before PDF-2 | Three-line already-clear structural guard, four local regression tests; preserve deployed unrelated export/source via hash guard. |
| PDF-2 | PDF owner |Exactly2 eligible failed standalone files, course43 rows32909/32910. Full source hashes validated; destination upload/ledger/document/visibility still to verify after review. |
| PDF-3 | Exception-report owner |10 old failed files across17 file/row occurrences(16 distinct disabled rows), plus5 old pending files/9 source occurrences, all inactive or superseded. Preserve history; no retry/attach/write proposed. |
| S1 | Source-managed placement titles |18 current-tree differences. Imported/admin field ownership and current exact source asset must be reverified. |
| S2 | Placement visibility/replacement |9 rows;7 explicit disabled-item/folder proofs,2 obsolete old Geometry placements require current replacement/source selection. Preserve progress and records. |
| S3 | Placement access flag |One course114 lesson paid→source free; access impact must be tested. |
| S4 | Per-course filing |50 differences:24case-only,26substantive. Three gone Announcement rows should keep historical filing;13 course160 paths still need exact target-ID review. |
| S5 | Order owner with S4/S6 |Six within-group inversions across5courses. Coherent source ranks propose1,257 priorities; harmless numeric drift elsewhere is not automatically a repair. |
| S6 | Catalog taxonomy owner |Four populated case groups;38 placement repoints and5 retained aliases. Preserve6 intentional test namespaces; validate all known references, alias reads and history limits before retirement. |
| S7 | Recurring reconciliation owner |Versioned source-managed baseline and operator conflict gates, complete-capture/asset guards, source title precedence, namespace-aware resolver and nightly integration. Local pure helper tests are not a deployed fix. |
| BACKUP-1 | Storage/backup owner |Independent inventory/retention unknown; primary video/PDF samples pass, config access403. Exact system/read access must be established. |
| BACKUP-2 | Restore-validation owner after BACKUP-1 |Isolated scratch restore from an actual independent copy; exact representative metadata, PDF and full HLS asset scope to be selected after inventory. Never restore over production. |
| VALIDATE | Reader and operations owners after reviewed phases |Four replacement occurrence playbacks; adopted navigation/free/disabled/order states; media/PDF hashes and references; second dry-run no-op; later actual nightly confirmation. |
| ADDITIONAL | Separate parity survey, not silently included in repairs |Live buyers/access, users, test definitions/answers, attempts/history, raw backup coverage; actual full parity not established. |

References: [video V1–V7](media-video.md), [PDF/CAPTURE/BACKUP actions](media-pdf-capture-backup.md), [structure S1–S7](structure.md).

## One combined structure patch, never independent overlapping batches

The18title+9activation+1free+50filing findings affect75 distinct rows. Coherent ordering plus those fields reaches1,309; adding taxonomy yields1,323 distinct existing placement candidates. The initial23-row preview is only a subset. The outside160/161 preview union is1,264 rows;24 taxonomy rows overlap filing and one title/free/visibility row overlaps filing/order. The combined outside preview has no contradictory proposed field value, but still requires live/source guard regeneration.

This ceiling is not the final apply count. Source refresh may add or remove candidates; admin conflicts must remain held; three historical Announcement filing candidates should not create new groups. Media's four new inserts are separate, and its old Geometry activation cleanup must be combined with S2 rather than performed by both tracks. A structured, per-document merged diff and exact live BSON snapshot would be generated only after the plan is reviewed and source identities/targets are stable.

## Source/admin ownership policy proposed for review

- Source identity is `(tenant, asset key, course-specific source row)`; matching a reused row ID alone is insufficient.
- Compare each editable imported field with a versioned last-imported/source-managed baseline. Untouched timestamps and October19 snapshots support adoption but are not a complete editor audit.
- Preserve nonempty operator `CourseClass.title`; retain any field that diverged from the managed baseline. A conflict must appear explicitly in the dry-run.
- Never reactivate an operator-off placement. Source-off/on actions need a source-owned stamp and complete visibility proof, including cross-listing; absence from flat pc4 alone is insufficient.
- Historical Class records, paid access/progress, test answers and existing namespace IDs are protected. Global Class renaming and batch-copy merging are not hidden within placement cleanup.

## Risk and rollback model

Every data phase needs a protected exact BSON beforeimage, the selected source snapshot/asset identity, exact compare-and-set on changed fields and updatedAt, and a per-phase afterimage. A changed guard aborts or holds a row; it does not broaden matching. Merge multiple field changes on one placement before transaction so one phase cannot invalidate or overwrite another.

Media rollback waits for worker terminal/cancellation safety, removes only exact new repair ledger/job/placement IDs, restores only unchanged repair outputs, and leaves copied objects recoverable. PDF rollback never removes a reused hash twin or referenced object. Taxonomy retains old IDs; no global name-only merge or deletion is allowed. Code rollback is a SHA-guarded restore of only reviewed deployed files/REVISION, preserving unrelated overlaid source changes. Full per-action constraints are in the linked plans. No rollback is presently needed because no production change ran.

## Acceptance across the whole system

1. Full intended source scope is dated; failed/partial captures never replace the prior good view. Source exceptions and deliberately retained historical content are explicit.
2. Two replacement assets have one correct current Class/job/ledger each, four correct eligible placements, completed HLS and authenticated student playback. Old duplicate/obsolete active entries are removed from visibility without deleting progress/history.
3. Every selected retry has proven source availability and reaches validated bytes. Unrecoverable provider failures stay classified rather than being reported complete.
4. Two repaired PDFs match validated source hashes and stored metadata; no invalid or obsolete note variant is attached. Historical source exceptions are excluded from actionable backlog without falsely marking them recovered.
5. Adopted title/free/visibility/filing/order values match current source and canonical nodes; operator edits survive. No duplicate visible lesson, wrong parent, dangling taxonomy or new empty imported group is introduced.
6. Intentional question/test namespaces, reference counts and historical IDs survive exactly. Alias reads and future resolver lookups cannot remint the duplicate case nodes.
7. A multi-night fixture replay and bounded dry-run converge without new Classes/jobs/placements; an actual later scheduled run is separately observed before saying nightly preservation is confirmed.
8. Independent backup inventory, recovery-point/retention evidence and isolated restore succeed before any independent recovery claim. Primary-copy sampling alone is insufficient.
9. Buyer/user/test/history parity is reported unverified until its own source-to-destination comparison is completed.

## Decisions and unresolved discovery — one review bundle

- Approve or revise the source/admin ownership policy above, including whether coherent whole-group rank adoption is preferable to local sparse swaps. No six-row quick fix is assumed.
- Confirm canonical catalog namespace/alias behavior while preserving the six intentional question/test namespace pairs. Broader arbitrary serialized-history references remain a census limit.
- Decide absent-course148/149 behavior after stronger source evidence: suggested default is off-sale while preserving existing learners' historical access.
- Decide whether external YouTube/MP4 bytes require owned backups; identify existing independent backup system, desired retention/recovery objective and authorized read access. No new resource provisioning is part of this plan.
- Decide source-provenance field parity and scope for deferred global Class rename/batch-copy merge, standalone-PDF course visibility, and buyer/user/test/history survey. Standalone file import alone does not prove course-specific student PDF visibility.
- Agree how genuinely missing upstream videos should be restored/re-uploaded by the content owner; unavailable source bytes cannot be repaired by repeated queue resets.

No production authorization is requested in this packet. The full map is presented first; a later review can select the exact phases and scopes to execute. Nothing applies automatically when planning ends.

## Final source-survey disposition

The previously blocked credential use was authorized directly and the safer direct-local survey is complete. No temporary credential or handoff remains. The unresolved evidence gaps are now source/coverage limits, not a pending authorization request: course96 still fails its full listing; local student-tree access is403;175 dead jobs and the full mismatch tree were not freshly re-read. The maintained production CMS session remains unchanged. All proposed repairs remain held for full-plan review.

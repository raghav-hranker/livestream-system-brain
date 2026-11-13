# Final bounded live-source survey — 26 October 2026

**Completed read-only after direct authorization in this chat. Repairs remain on hold.**

Observed **19:38:39–19:39:45 IST**. Made29 HTTP requests within a45-request cap, with pacing. The temporary session was consumed in memory and sent only as an HTTPS Cookie to `cms.appx.co.in`; credential-bearing redirects were disabled and destination-guarded. Public student/media requests carried no session cookie. No SSH host or production database received the temporary session. The mode-0600 handoff was deleted after consumption and its absence was verified. No secret or signed URL is present in the saved results.

Raw sanitized findings: [live-source-survey.json](live-source-survey.json). Compact comparison: [live-source-survey-summary.json](live-source-survey-summary.json).

| Check | Fresh result | Meaning for the plan |
|---|---|---|
| Full CMS course list |146 of146 returned; same ID set as18:00 survey |No new course-list delta in this window.148/149 remain absent. This does not establish every course tree or learner access. |
| Course96 detail |Success; course enabled |Authentication is working for that course detail. Enabled is not alone a platform-sale-status rule. |
| Course96 full pc4 listing |HTTP502 after about29seconds |The full-listing failure persists with a valid temporary session. Do not promote a partial capture or claim session renewal alone fixes it. Payload/timeout/record-specific cause remains to isolate. |
| Course96 folder paths |58 unique results; `more:true` |Partial folder-page read only. No complete course96 tree or content inventory was obtained. |
| Geometry03/04 |All4 known occurrences found, enabled/not deleted, exact expected2 asset keys |Confirms the proposed replacement identity scope against live CMS, not merely the mirror. No jobs or placements were created. |
| Course43 PDFs |Rows32909/32910 present/enabled/not deleted; both still marked encrypted |Confirms current metadata for the two already-clear PDFs validated earlier. This request did not reimport/download them. |
| Student course85 root from local host |HTTP403 |Earlier GCP success is not a current success on this network path. Do not infer a global AppX outage or full student-tree parity. |
| Eight stratified dead-job samples |2 current assets: fresh manifests HTTP200;2 disabled historical assets: manifests404;4 assets: token service returns no playable URL |Some old404 failures may be recoverable; some remain source failures. No broad retry is justified or performed. |

## Exact sampled dead-job outcomes

| Source course/row | Prior category | Current source state | Fresh result |
|---|---|---|---|
|3/774 — Surds & Indices08 |404,current |Enabled,same asset |Token response has5 variants; fetched HLS manifest HTTP200. |
|3/907 — Mensuration3D Class12 |404,current |Enabled,same asset |Token response has5 variants; fetched HLS manifest HTTP200. |
|3/407 — Percentage Class11 |404,historical |Disabled,same asset |Token returned variants but actual manifest remains404. |
|7/4222 — Compound/Simple Interest Class02 |404,historical |Disabled,same asset |Token returned variants but actual manifest remains404. |
|21/14219 — Polygon01 |No URL,current |Enabled,same asset |HTTP200 token response,zero playable variants. |
|21/14220 — Polygon02 |No URL,current |Enabled,same asset |HTTP200 token response,zero playable variants. |
|21/14232 — Circle10 |No URL,historical |Disabled,same asset |HTTP200 token response,zero playable variants. |
|23/16852 — Pipe & Cistern03 |No URL,historical |Disabled,same asset |HTTP200 token response,zero playable variants. |

All eight returned the same expected source asset identity. Sample selection was two per prior-error/current-vs-historical stratum, not random and not exhaustive. Two readable manifests do not prove their segments decode or that destination storage is complete. The remaining175 dead jobs were not freshly probed here; the existing133-current/50-historical population classification remains snapshot-based.

## What remains unverified

- Course96 complete source listing and tree; its production committed capture remains October22.
- A fresh full student-visible tree for every course, including source-hidden/cross-listed/deleted-folder completeness.
- All183 dead source assets, all73 no-link occurrences and all external media availability. The bounded sample must not be extrapolated into a full recoverable retry count.
- Current source details of every title, free, filing, visibility and order mismatch. Their complete inventory remains a dated mirror comparison with per-row adoption guards.
- Stored production session renewal. Temporary authentication here did not update `apxsessions`, keepalive state or the daily runner.
- Destination repair, student playback after repair, independent backup/restore and actual next nightly convergence. No repair was applied.

The earlier credential-destination approval blockers are resolved for this completed direct survey. No additional source credential use or production application is implied. The temporary session is not retained for later work.

## October27 full-backlog follow-up

The later [183-job source survey](../../reports/appx-backlog-survey-2026-10-27/report.md) supersedes the eight-sample availability limit above for those failed-video jobs. It found46 current source recovery candidates across139 course placements,1 incomplete source with a missing final segment,82 current assets without a playable URL,4 current source404s and50 historical items. All50 readable playlists received bounded first/middle/last segment checks;49 passed including3 historical sources. Repairs remain on hold. This follow-up does not establish full-duration decoding, every rendition, learner entitlement or destination import success.

# Backlog retry outcome — 27 October 2026

**Three-video canary executed after direct user authorization. One restored; two source-blocked; remaining43 not queued. No retry jobs remain active.**

| Video | Result | Evidence |
|---|---|---|
| Glands01 · Biology | Restored in2 existing course locations | Existing job done, Class.hlsAsset present;3 renditions/817 segments copied,453.4MB. Destination origin and production playback signer/CDN both passed first/middle/last samples for every rendition. |
| Surds & Indices08 | Source-blocked after5 new attempts | Same internal source segment404 as the original failure: master-7860278.873273978.m3u864.ts. No Class media reference published. |
| Mensuration3D Class12 | Source-blocked after3 new attempts | Same original missing240p segment master-6452701.24023549.m3u829.ts. Worker finished, but its failed fail-callback left coarse status downloading; exact-ID/state/attempt/time CAS retired this stale failed job, preserving3 attempts. No Class media reference published. |

The worker returned to other jobs after the failed Mensuration attempt; its finish and later claim timestamps established that no active copy was overwritten by cleanup. All operations/beforeimages are retained locally. The three initial jobs had passed fresh source identity and every planned rendition's first/middle/last samples. The full transfers found missing internal segments away from those sampled positions. **Sample-based qualification is not sufficient to call an old404 job repair-ready.** The earlier46 count was a source recovery-candidate count, not a guaranteed successful retry count.

The remaining43 never passed the canary release gate and were not reset. Their concurrent read-only preflight finished before an attempted stop found no running local process:1 passed all worker samples,41 returned no playable URL on that later token call,1 had a failed worker check. This differs from the earlier source survey; do not classify all41 as permanently unavailable from those responses alone. No stored session was changed and no broader retry occurred.

Verification: [final-audit.json](final-audit.json) proves all43 unqueued job documents byte-unchanged, course placement records unchanged, catalogue ledgers unchanged, and zero active selected jobs. Only the recovered Class's updatedAt,hlsAsset,streamStatus changed. No title,taxonomy,course ordering,student completion/history or entitlement change was applied. The failed copies may have left partial objects under their own existing781/ClassId prefixes; these remain unreferenced and were not deleted. No backend/worker deployment,restart,new VM or Quicktricks change occurred.

Playback evidence: [playback-canary.json](playback-canary.json) uses an admin preview through the production playback controller, then the actual signed CDN delivery path: mint200,master200,all3 playlists200 and9 segment samples206 with valid TS signatures. No learner view was recorded. This does not establish every buyer's entitlement or full-duration decoding.

Further retry requirement: inspect the complete source segment inventory for previously404-failed assets, especially the exact originally failed segment and all intended renditions; distinguish token/authentication responses from per-video unavailability; requalify a bounded exact set. Do not skip missing segments,truncate lectures,drop qualities or repeatedly reset failed jobs as part of a normal retry. Such recovery decisions require separate review. All other repairs remain held.

Evidence: [original-vs-retry-errors.json](original-vs-retry-errors.json), [worker-errors.json](worker-errors.json), [preflight-canary.json](preflight-canary.json), [storage-canary.json](storage-canary.json), [execution.md](execution.md). The storage batch gate remains false because only1 of3 copied successfully; its single recovered asset passed origin checks. No signed URLs or credentials appear in these reports.

## Later read-only verification of the remaining43

The [complete source inventory check](../appx-candidate-complete-check-2026-10-27/report.md) found7 candidates whose every required segment reference responds with valid media bytes (Glands02–05 and Internet/Internet02/Internet03), covering11 existing course locations.32 videos still have confirmed segment404s;3 have missing advertised1080p playlists and1 has a missing240p playlist. No remaining job was queued or changed during this verification. The failed3of3 canary gate remains held; any later retry needs a newly reviewed exact7-job scope, not the old43-job queue-rest action.

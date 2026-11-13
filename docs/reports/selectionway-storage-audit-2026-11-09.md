# SelectionWay storage audit (R2 + B2), 2026-11-09

SelectionWay (client **561**, "Multistreaming") has left. This audit lists what it left on R2 and B2 and what can go.
**Read-only: nothing was deleted, changed or moved.** Listing was done from the Mac with the keys in
`~/workspace/r2-to-r2-backup/.env`. Scripts: `reference/scripts/storage_list_buckets.cjs`, `storage_bucket_peek.cjs`,
`storage_prefix_sizes.cjs`. The raw per-folder JSON was saved in the session scratchpad only.

## Verdict

- SelectionWay holds about **37.3 TB on R2** (19.1 TB main account + 18.1 TB backup account) and **16.5 TB on B2**.
  At list prices (R2 $0.015/GB-month, B2 about $7/TB-month) that is about **$560/month on R2 + ~$115/month on B2**.
- Every file exists **three times**: main R2 `025b7cdd…`, backup R2 `1ff6f200…` and B2 `us-east-005`. The daily backup job
  still runs, but has copied nothing since 2026-11-03. The last SelectionWay class was 2026-11-02.
- **Safe to delete now:** the raw upload buckets `tempvideos-selectionway`, about **4.0 TB** across the two R2 accounts.
- **After you answer two questions** (the hand-over/retention duty, and whether Toppers 695 is leaving too): everything under `561/`
  in the four video buckets, about 33 TB on R2 plus the B2 copy. Or keep one B2 copy and delete both R2 copies.
- **Do not delete `selectionway-server` as a bucket.** Toppers, the voice service and both our tenants still use it.

## What is where (R2)

| Bucket | Main R2 | Backup R2 | B2 | Contents | Owner |
|---|---|---|---|---|---|
| `livestream-selectionway` | 5.739 TB, 12.5 M objects | 5.681 TB | 5.668 TB | live-class HLS: `561/<classId>/<rung>/segment_N.ts` | 561 = 5.60 TB; `notes/` 119 GB; others below |
| `livestream-recorded` | 5.811 TB, 4,055 class folders | 5.810 TB | 5.790 TB | one folder per live class, 3–4 MP4s each (`selectionwayrecorded.hranker.com`) | 561 (folders are class ids, see check 3) |
| `recordedvideos-selectionway` | 5.007 TB, 8.6 M objects | 4.999 TB | 4.953 TB | recorded-video HLS: `561/<video>/hls/<rung>_NNN.ts` (`selectionwayrecordedmp4.hranker.com`) | 561 = 4.996 TB; 11 loose test folders ≈ 11 GB |
| `tempvideos-selectionway` | 2.455 TB, 3,002 objects | 1.564 TB | 0.0002 TB | raw uploads before transcode | 561; `695/` 60 MB |
| `selectionway-server` | 0.121 TB | 0.079 TB | 0.054 TB | app files: PDFs, reports, banners, recordings | **shared**, see below |
| `selectionwayrecordedmp4` | — | — | empty | | |
| **Total** | **19.13 TB** | **18.13 TB** | **16.47 TB** | | |

`livestream-recorded` by month of the class's last file, main R2: about 0.35–0.6 TB a month, every month from 2025-11 to 2026-10.

On B2, `recordedvideos-selectionway` also holds small test folders from other clients: `472/` 42 MB (quicktricks), `695/` 14 MB, `408/` 54 MB, `442/` 5 MB.
B2 has only 10 files of Powermind's `168/`; its 16 GB exists on the two R2 accounts only.

## Not SelectionWay: keep or move first

| Where | What | Size | Why |
|---|---|---|---|
| `selectionway-server` (all three stores) | whole bucket | 121 GB | Toppers' backend writes here (`R2_BUCKET_NAME=selectionway-server`). voice.hranker.com uploads student recordings to `recordings/` (newest 2026-11-06). `reports/` PDFs are still being written (newest 2026-11-07). The quicktricks and Vidyagram backends hard-code 4 default course icons from `selectionwayserver.hranker.com/classes/…` (`courseController.ts`, `courseProgressController.ts`). |
| `livestream-selectionway/168/` | Powermind | 16 GB | another client |
| `livestream-selectionway/552/`, `534/`, `135/` | unknown, unknown, Futurekul | 1.1 GB | other clients |
| `livestream-selectionway/695/`, `tempvideos-selectionway/695/` | Toppers Wisdom | < 0.1 GB | Toppers' live encoder (`webcam-livestream-toppers-wisdom`) still targets this bucket |
| B2 `recordedvideos-selectionway/472/`, `/695/`, `/408/`, `/442/` | quicktricks, Toppers, others | 115 MB | test uploads from 2026-05/07; not SelectionWay's |

`selectionway-server` is small (about $2/month on R2). Leave it until its users are moved off: icons into a hranker bucket,
voice recordings, Toppers.

## Removal tiers

**Tier 0: stop the writers and the jobs (no data change)**
- The SelectionWay daily backup (`r2-to-r2-backup` `.env`, `BACKUP_LABEL=selectionway…`, `0 2 * * *`). Its scheduler box is
  not recorded (`hosts.md` "Not yet verified"). Stop it before Tier 2, or it fills the deleted copies back in.
- The R2 event queues on `tempvideos-selectionway` (main `a0493aff…`, mirror `130c1314…`) and the GPU box's `b2-video-listener`
  on `client-561-queue`.
- Compute that still bills: `livestream-cpu-new` + `livestream-cpu` (561 encoders) and `testing-server-selectionway`.
  Out of this audit's scope, listed here so it isn't forgotten.

**Tier 1: delete now (about 4.0 TB, about $60/month)**
- `tempvideos-selectionway` in all three stores: raw sources whose transcoded outputs live in `recordedvideos-selectionway`.
  The only non-561 content is Toppers' `695/`, 4 files, 60 MB. Delete `561/` and the loose test files, and keep `695/`.

**Tier 2: if SelectionWay content must be kept for a while, keep one copy**
- Keep B2 (cheapest), and delete the `561/` folders from both R2 accounts in `livestream-selectionway`, `recordedvideos-selectionway`
  and the whole of `livestream-recorded`. Frees about 33 TB of R2, about $500/month.
- The `notes/` folder (119 GB main, 91 GB backup) is class-notes media: `notes/<classId>/<userId>/…`. It follows the same rule
  once check 3 shows the class ids are 561's.

**Tier 3: no retention duty**
- Tier 2, plus the same folders on B2 (`561/` = 10.5 TB, plus `livestream-recorded` 5.8 TB and `notes/` 88 GB), and the
  empty B2 bucket `selectionwayrecordedmp4`. That frees about $115/month more.

## Checks before Tier 2/3 (not done: prod reads were refused this session)

1. **Hand-over / retention:** does the exit agreement require giving SelectionWay its videos, or keeping them for some period? This decides Tier 2 vs Tier 3.
2. **Toppers 695:** `docs/plans/retire-shared-redis-19504.md` says Toppers is leaving too. If so, its folders can go with these.
3. **Class ids:** join the `livestream-recorded` and `notes/` folder ids, and the `561/` class folders, against `selectionwaydb.classes`.
   Toppers' local `.env.development` also points at `selectionwaydb`, so a 561 filter on the class (not the bucket) is the safe key.
4. **No link from our tenants:** count `selectionway(live|recorded|recordedmp4|server).hranker.com` in quicktricksdb and
   vidyagramdb (classes, courses, banners, notifications, pdfs). Use secondary reads.
5. `selectionwaydb` stays: speed-maths on webserver2-2 still uses it, and its files are in `hranker-node`, not these buckets.

## How to delete at this scale

- About 21 M objects per R2 account. Use an **R2 lifecycle rule** (expire objects under a prefix after 1 day) rather than
  per-object deletes. It is free and runs on Cloudflare's side. `r2-delete.js` in the backup repo works for small prefixes.
- B2: a lifecycle rule (`fileNamePrefix`, `daysFromUploadingToHiding` 1, `daysFromHidingToDeleting` 1). Hidden versions bill until they are deleted.
- Delete in order: Tier 0, then tempvideos, then backup R2, then main R2, then B2 last. Check each bucket's size on the dashboard a day later.
- Log each step in the prod data ledger (`prod-data-changes` memory).

## Delete list (2026-11-09: the user confirmed there is no retention duty, so this is Tier 3)

Not started. It needs the user's go-ahead on this exact list, and checks 3 and 4 above passing first.

| Bucket (in all three stores unless noted) | Delete | Keep |
|---|---|---|
| `tempvideos-selectionway` | everything else | `695/` |
| `recordedvideos-selectionway` | `561/`, the 2025-11 loose test folders, B2 `https:/` + `testing_0226_720p.mp4/` | B2 `472/`, `695/`, `408/`, `442/` |
| `livestream-selectionway` | `561/`, `notes/`, `messages/`, `hls/`, `mp4/`, `live/`, `test/`, `690612f119fedfd663983fb5/`, backup `reports/` | `135/`, `168/`, `534/`, `552/`, `695/` |
| `livestream-recorded` | the whole bucket (only if check 3 finds no Toppers class) | — |
| B2 `selectionwayrecordedmp4` | the bucket itself (empty) | — |
| `selectionway-server` | nothing | all of it |

What the keys can do (read 2026-11-09):
- **Main R2:** the key is bucket-scoped, and reading the lifecycle rules is denied. Expiry rules there are set in the Cloudflare dashboard,
  unless the key turns out to allow batch deletes (untested).
- **Backup R2:** lifecycle rules are readable (only the default multipart-abort rule today). No versioning.
- **B2:** versioning is **on** and there is no lifecycle rule. A plain delete only hides a file, and hidden files still bill.
  Removal needs a B2 lifecycle rule (`daysFromHidingToDeleting`) or deletes by version id.

Order: main R2 first, then backup R2, then B2. With the source gone first, the daily backup job has nothing to copy back.

## Step 1: backup R2 + B2 (the user's call, 2026-11-09)

The user chose to delete the backup Cloudflare account and B2 copies first, and to keep main R2 for now.
`storage_expire_prefixes.cjs` dry run: **34.447 TB**, in eight buckets (four per store). Kept: `135/ 168/ 534/ 552/ 695/ reports/ errors/` in
`livestream-selectionway`, and B2 `recordedvideos-selectionway` `472/ 695/ 408/ 442/`. Whole-bucket rules (prefix "") on backup
`tempvideos-`, `recordedvideos-selectionway`, `livestream-recorded` and B2 `tempvideos-selectionway`, `livestream-recorded`. These were re-checked just before
the write: no new folders. The COMMIT run was refused by the session's permission check, so **no rule is written yet**. The user runs it.
Inventory JSON for `INV_DIR`: `~/workspace/r2-to-r2-backup/.scratch/sw-exit-inventory-20261109/`.
After the deletion finishes, remove the `sw-exit-*` rules, or delete the emptied buckets. Until then they also delete any new file under those prefixes.

## Is `livestream-recorded` safe to delete? (check 3, storage side, 2026-11-09)

- Of 4,055 class folders on main R2, **4,038 also exist as SelectionWay live classes** (`livestream-selectionway/561/<id>/`).
  The single ids also found under `695/` and `552/` are under `561/` too (test streams).
- **17 folders (23 GB) match no SelectionWay live class.** They are a top-level `695/` (Toppers, 4 files, 10 MB, 2026-06-04),
  `122075/`, `playlist-mpl-vod.m3u8/`, and 14 ObjectId folders. Most of those are dated 2026-07-31 (a re-upload/backfill), the rest 2025-11, 2026-04 and 2026-06.
  All 17 also exist on backup R2 and B2.
- Code: only SelectionWay's LMS (`nodejs-server` `cdnConfig.ts`, `selectionwayrecorded.hranker.com`) reads it. No reference in quicktricks-backend
  (`quicktricks-admin`, `vidyagram-admin` branches), quicktricks-admin, ls or either Toppers repo. The livestream MP4 job writes it via the encoder's `OUTPUT_BUCKET`.
- Not checked: prod DB links to `selectionwayrecorded.hranker.com` (check 4; prod reads refused).
- Verdict: the backup R2 and B2 copies are safe now, because main R2 keeps everything. On main R2, delete all but those 17 folders, unless the DB shows them to be SelectionWay's.

## Done 2026-11-09 (14:23 IST)

- **Backup R2:** the user deleted it by hand. `tempvideos-`, `recordedvideos-selectionway` and `livestream-recorded` are gone as buckets. `livestream-selectionway`
  is empty, including the other clients' folders (they still exist on main R2). `selectionway-server` is intact.
- **B2:** expiry rules written on the 4 buckets (16.41 TB) and read back: whole bucket on `tempvideos-selectionway` and `livestream-recorded`, folder rules
  on the other two that keep `472/ 695/ 408/ 442/` and `135/ 168/ 534/ 552/ 695/ reports/ errors/`. No other bucket has rules.
  B2 hides the files after 1 day and removes them 1 day later. Check around 2026-11-11.
- **Left:** main R2 (~19 TB, now the only copy of everything, other clients included); stopping the daily backup job; removing the `sw-exit` B2 rules once the buckets are empty.

## B2 check 2026-11-11 (scheduled run, read-only, ~10:35–13:05 IST)

**Verdict: in progress on all four buckets.** Every SelectionWay file is hidden (hide markers dated 2026-11-10 00:27–05:34 UTC), and the
original versions are still stored and still billing. B2 removes them 1 day after hiding, so expect it from 2026-11-11 to 11-12. **Nothing kept is missing.**

| Bucket | Current files (S3 list) | Versions (native, first page of 1000) | Verdict |
|---|---|---|---|
| `tempvideos-selectionway` (whole) | 0 | 48: 24 upload + 24 hide (179 MB), no more pages | in progress |
| `livestream-recorded` (whole) | 0 | 1000: 477 upload + 477 hide + **46 `start`** (unfinished large files), more pages | in progress |
| `recordedvideos-selectionway` `561/` | not finished (see below) | 1000: 500 upload + 500 hide, more pages | in progress |
| `livestream-selectionway` `561/` | not finished | 1000: 500 upload + 500 hide, more pages | in progress |

- **Kept folders, all intact:** `recordedvideos-selectionway` `472/` 69, `695/` 53, `408/` 89, `442/` 17; `livestream-selectionway` `135/` 197, `168/` 10,
  `534/` 479, `552/` 721, `695/` 73, `errors/` 1. These match 11-09 exactly. `reports/` is at **1,241, up 4 from 1,237**: something still writes there daily, most likely the
  SelectionWay backup job.
- **Rules (b2_list_buckets):** only these four buckets have lifecycle rules, all 1 day to hide and 1 day hidden to delete. `tempvideos-selectionway` and `livestream-recorded` use prefix `""`.
  `recordedvideos-selectionway` has 15 folder prefixes (`561/`, 11 ObjectId folders, `https:/`, two test-file folders). `livestream-selectionway` has 8 (`561/`,
  `690612f119fedfd663983fb5/`, `hls/`, `https:/`, `messages/`, `mp4/`, `notes/`, `test/`). No prefix covers a kept folder.
- **Gap: unfinished large files.** The rules leave `daysFromStartingToCancelingUnfinishedLargeFiles` null, so the `start` entries in `livestream-recorded`
  (46 in the first page alone) never expire and keep billing for their uploaded parts. Clearing them needs that field set on the rule, or `b2_cancel_large_file`.
  That is a write for the user to approve.
- **Sizing:** `storage_prefix_sizes.cjs` finished the two whole buckets (0 objects each). It ran 2.5 h on `recordedvideos-selectionway` without finishing, because the
  S3 list has to step over millions of hidden `561/` versions, so it was stopped. The kept folders were counted by prefix instead. Rerun the full sizing once the versions are gone.
- **Backup job:** it does not run on this Mac. The `~/workspace/r2-to-r2-backup` scheduler was stopped 2026-09-27, and there is no process, launchd entry or cron. The box is still unknown.
- **Next:** re-check 2026-11-12 with `b2_list_file_versions` (prefix `561/` / none). Done means 0 versions apart from any `start` entries.

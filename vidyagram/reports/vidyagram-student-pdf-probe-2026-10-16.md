# Vidyagram student-token PDF probe — 16 October 2026

## Result

The student API can return working signed PDF URLs independently of the CMS PDF signer. Two class-note downloads from a purchased course passed HTTP 200 and `%PDF-` checks. This establishes a usable alternate fetch path for those files; it does not establish catalogue-wide coverage or student API rate limits.

## Database and session

- Queried `vidyagramdb` on the OCI migration bastion.
- PDF ledger: 1,998 `done`, 2 `failed`. The inspected failure was a PDF download HTTP 403. The live cause of the overall stop was not independently established.
- No cached student tokens for AppX org `2177599` existed before the probe.
- With the user's authorization, used the existing `getOrMintUserToken` helper in the PDF worktree's `src/scripts/apxTestResultsMigration.ts`. Its normal flow sends a real OTP, reads it through the admin session, verifies it, and caches the token in `apxtestusertokens`.
- Generated one token for AppX user `2327340`; one cached token exists after the probe. No credentials or personal contact information are recorded here.
- This user's cached purchase metadata lists course `103`.

## Verified student flow

`GET https://armathsapi.akamai.net.in/get/fetchVideoDetailsById`

Parameters: `course_id`, `video_id`, `ytflag`, `folder_wise_course=1`.

Headers: the cached student token as `Authorization`, matching `User-ID`, `Auth-Key: appxapi`, `Client-Service: Appx`, `source: website`, and Vidyagram website origin/referer.

Decode the returned `pdf_link` using the public website's existing link-decoding method. Download the resulting signed URL using the PDF viewer referer `https://pdfweb.classx.co.in/`. Do not log encoded links, decoded signed URLs, or encryption keys. The viewer passes file-encryption metadata separately; the two tested files were already clear PDF bytes after download.

| Course | Row | Purchased | Signed URL host | Download HTTP | Bytes | PDF header |
|---|---|---|---|---|---|---|
| 103 | 189729 | 1 | static-db-v2.appx.co.in | 200 | 2,479,693 | valid |
| 103 | 189730 | 1 | static-db-v2.appx.co.in | 200 | 1,308,663 | valid |

A request for course `151`, row `187899`, returned `is_purchased=0` and a placeholder `pdflink.com` link. Its response was not PDF content. A successful API status alone is insufficient: require entitlement and validate downloaded bytes.

## Remaining work

- Match unfinished file placements to authorized students with access to their source courses. One student session cannot be assumed to cover the full catalogue.
- Confirm unfinished-file coverage; these two probes were not checked against the completed-file ledger.
- Test standalone PDFs, second note fields, and encrypted files before extending the importer.
- Integrate the student fetcher with the existing decryption, content-hash deduplication, private upload, and resumable ledger. Pace calls and stop/back off on authentication or rate-limit failures.
- No PDF import, attachment, storage upload, importer change, or transfer restart was performed by this probe.

## Recovery run authorized later on 16 October

The user subsequently requested importing through this path. The operational runner is
[`reference/scripts/vidyagram-student-pdf.cjs`](../../reference/scripts/vidyagram-student-pdf.cjs).
It runs from the existing bastion PDF checkout and calls its shipped planner,
`fetchCheck`, `commitPdfImport`, uploader, CSV and live-sheet modules. It does not
replace the deployed backend. Six offline tests cover link decoding, exact object
path matching, allowed hosts, entitlement, row identity, session/throttle controls,
standalone links and second-note isolation.

The runner accepts only cached student sessions mapped to their purchased courses.
Every API response must also confirm purchase and the exact requested row. The
decoded URL must have an allowed HTTPS host and the original object's full path.
The existing importer performs byte verification/decryption and SHA-256 dedupe.

- Live catalogue now plans **10,214 files**, rather than the earlier saved dry run's 9,882.
- Six unfinished standalone PDFs passed fetch checks across AppX content and migration-content origins.
- Five-file note pilot: **4 fetched and created**, **1 HTTP 403**. Independent private-storage HEAD and range reads verified all four files, including size equality, `%PDF-` headers and the `781/` storage prefix.
- Pilot attachment state: one `done`, three `pending` because other variants of their shared-class notes were not yet imported. The original all-versions-before-attachment rule remains in force.
- Generated one additional cached session for AppX user `2288327` with 70 courses in its purchase metadata. Tokens and contact details are not in this report.
- After the pilot: **2,002 file identities have PDF records**, **8,212 remain to fetch**. The two cached students cover **5,401** remaining file identities; **2,811** have no source course covered by those cached sessions.
- Broader sample: **7/8 valid downloads**, one repeat of the pilot's same HTTP 403. One API timeout recovered on retry. No encrypted unfinished file was present in the covered sample; encrypted-file recovery is not established by these tests.

Main recovery launched detached on the bastion, supervisor PID `3483380`, with a
`flock` at `/home/opc/vidyagram/student-pdf.lock`, concurrency 1 and a 1.5-second
minimum gap between student metadata calls. It stops on rejected sessions and
backs off on throttling; it never automatically generates more tokens.

Remote artifacts:

- Runner: `/home/opc/vidyagram/student-pdf.cjs`
- Working directory: `/home/opc/vidyagram/pdf`
- Full-run log: `/home/opc/vidyagram/logs/pdf-student-full/run.log`
- Coverage: `/home/opc/vidyagram/logs/pdf-student-full/coverage.json`
- CSVs: `/home/opc/vidyagram/logs/pdf-student-full/import.csv`, `multi-version.csv`
- Final summary, written when the run exits: `/home/opc/vidyagram/logs/pdf-student-full/summary.json`
- Live sheet: [Vidyagram migration progress](https://docs.google.com/spreadsheets/d/1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY/edit), `PDF import`, `PDF multi-version`, `PDF summary`.

The full run was started, not completed, when this record was written. Its ledger
and final summary determine actual successful recovery; coverage is not a promise
that every source will download. Rerunning the same command skips existing PDFs.

Initial full-run read-back confirmed **2,014 imported file identities**, up from
1,998 before recovery (16 additional files, including the four-file pilot). Ledger
states at that point: 1,999 `done`, 15 `pending`, 3 `failed`. Notes remain pending
until the importer's final attachment pass and required variants are available.

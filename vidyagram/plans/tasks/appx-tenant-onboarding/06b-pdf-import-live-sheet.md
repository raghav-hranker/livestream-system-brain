# 06b — PDF import: live Google Sheet

Status: `ready-for-agent`. Repo: fork, branch `feat/vg-pdf-import` (tip 35899a6d4), worktree
`~/Projects/worktrees/vg-pdf-import`. Builds on [06-pdf-import.md](06-pdf-import.md); read it and
`src/services/apx/apxCatalogPdfImportCsv.ts` first.

## Goal

While the PDF import runs on the OCI bastion (possibly with the operator's laptop closed), every row it appends to the
run CSV also appears in a Google Sheet, within seconds. Sheet (user-provided):
`1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY`.

## Design

- **Opt-in flags**: `--sheet <spreadsheetId>` plus env `GOOGLE_SHEETS_SA_PATH` (path to a Google service-account JSON
  key). Without the flag nothing changes. With the flag but no readable key, refuse to start with a clear message.
- **No new npm dependencies.** Authenticate with the service-account JWT flow using Node's `crypto` (RS256 sign of
  `{iss, scope: https://www.googleapis.com/auth/spreadsheets, aud: https://oauth2.googleapis.com/token, iat, exp}`),
  exchange at `oauth2.googleapis.com/token`, cache the access token until a minute before expiry. Call the Sheets REST
  API (`values:append` with `valueInputOption=RAW`, `insertDataOption=INSERT_ROWS`; `batchUpdate` for adding tabs and
  freezing headers).
- **Tabs** (created if missing, header row written once, header frozen):
  - `PDF import` — exactly the run CSV's columns and rows.
  - `Multi-version` — the multiversion CSV's rows.
  - `Summary` — overwritten (values.update on A1) each flush: run id, started, last update, counts per action, files
    done / planned, multi-version count, failures.
- **Buffered, never blocking the import**: rows go to an in-memory queue; a flusher appends every 10 s or 500 rows,
  whichever first, in one request per tab. Sheets errors (429/5xx/network) retry with backoff; if the sheet stays down,
  keep buffering (cap ~20k rows in memory, then drop the oldest with a warning) — the CSV on disk stays the record of
  truth. Flush on exit (normal, exit code 2/3, SIGINT/SIGTERM).
- **RAW values only** (no formulas, no date parsing); never write a signed URL, key, cookie or the Mongo URI (same row
  builder as the CSV).
- **Dry run / fetch-check** may also write to the sheet when `--sheet` is given, into tabs suffixed ` (dry run)` /
  ` (fetch check)`, so the operator can test the wiring before the commit run.

## Tests

Inject a fake Sheets transport: rows appended in batches and in order; header written once; summary overwritten;
transport failures retried and do not fail the import; exit flushes the buffer; no `http` / `Signature` / key strings
in any payload; JWT assertion has the right claims and verifies against the test key's public half.

## Done when

Tests pass, `tsc --noEmit` clean, commits local on `feat/vg-pdf-import` (push to `raghav-hranker/quicktricks-backend`
allowed), and the operator steps written at the end of this file: create the service account, enable the Sheets API,
share the sheet with the service-account email as Editor, copy the key to the bastion (`~/vidyagram/sheets-sa.json`,
mode 600), and the exact commands with `--sheet`. No live run against the real sheet (no key exists yet).

## Update 2026-10-14 (user)

The service account already exists: `reference/scripts/vidyagram-progress-sheet.js` (video progress, run on
webserver2-2 every 5 min) writes the same spreadsheet with key `/home/hranker/secrets/vidyagram-progress-key.json`. That
script batch-clears its own tabs `Summary`, `Classes`, `Gone from AppX`, `1080p pass` on every refresh, so the PDF
import uses only tabs prefixed `PDF ` (`PDF import`, `PDF multi-version`, `PDF summary`). Auth may use the transitive
`google-auth-library` like that script. Operator step: copy that key to the bastion as `~/vidyagram/sheets-sa.json`.

## Done 2026-10-14 — operator steps

Built on `feat/vg-pdf-import` at 3130b76d2 (pushed to `raghav-hranker/quicktricks-backend`):
`src/services/apx/apxCatalogPdfImportSheet.ts`, wired into `src/scripts/apxCatalogImportPdfs.ts` as `--sheet`. Auth is a
hand-written RS256 JWT with Node `crypto` (no `google-auth-library` import). Tabs: `PDF import`, `PDF multi-version`,
`PDF summary`; a dry run writes `… (dry run)` and replaces that tab's rows each time, a fetch check `… (fetch check)`.
The video-progress tabs (`Summary`, `Classes`, `Gone from AppX`, `1080p pass`) are never read or written.

1. The service account and sheet sharing already exist (the video-progress script). The key is already on the bastion
   at `~/vidyagram/sheets-sa.json`; keep it mode 600 (`chmod 600 ~/vidyagram/sheets-sa.json`).
2. Pull `feat/vg-pdf-import` in the bastion checkout (tip 3130b76d2 or later).
3. In the shell that runs the import:

   ```sh
   export GOOGLE_SHEETS_SA_PATH=~/vidyagram/sheets-sa.json
   ```

   Without a readable key, `--sheet` refuses to start (`--sheet needs GOOGLE_SHEETS_SA_PATH …` /
   `… is not readable`) before it connects to Mongo.
4. Dry run (writes `PDF import (dry run)`, `PDF multi-version (dry run)`, `PDF summary (dry run)`; checks the wiring):

   ```sh
   NODE_ENV=development npx ts-node src/scripts/apxCatalogImportPdfs.ts --run full-2026-10-13 \
     --out-dir ~/vidyagram/pdf-import --sheet 1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY
   ```

   Check the three `(dry run)` tabs appear and the summary's `files planned` matches the console's `in scope` count.
5. Commit run (same command plus `--commit`; run it under `tmux`/`screen` or `nohup` so it survives the laptop closing):

   ```sh
   NODE_ENV=development npx ts-node src/scripts/apxCatalogImportPdfs.ts --run full-2026-10-13 \
     --out-dir ~/vidyagram/pdf-import --sheet 1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY --commit
   ```

   Rows reach `PDF import` within ~10 s (or at every 500 rows); `PDF summary` shows files done / planned and the
   count per action. The sheet is flushed when the run ends (exit 0/1/2/3) and on Ctrl-C / `kill` (exits 130 / 143).
   If Google is down the rows wait in memory (up to 20k per tab, oldest dropped with a `[sheet]` warning); the CSV in
   `--out-dir` is always complete. A rerun of the commit appends to the same tabs; the skipped rows are added once
   per run CSV, so keep the same `--out-dir` (without `--out-dir`, every rerun re-adds them to the sheet).

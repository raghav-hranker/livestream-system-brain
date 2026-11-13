# Job runner + script label

**Type**: AFK
**Blocked by**: 10
**Repo**: backend

## What to build

Changes made by scheduled jobs and one-off scripts are labelled and summarised, without flooding the history.

- **`runJob(name, fn)`.** Every node-cron job started in the backend goes through it.
  - It opens a `job:<name>` context, and the hook counts changed records per collection and op instead of saving
    copies.
  - At the end it writes one `job-summary` row (name, start, duration, counts, error if any), and only if something
    changed.
  - Deletes inside a job still get one change row per record.
  - Jobs to wrap include: APX daily catch-up, order days-left, coupon expiry, coupon usage, bulk sale, plan-order
    sync, the Razorpay order, website and QR syncs, dashboard daily facts, notifications, streak, and the APX
    user/order syncs.
  - List every job wrapped in the report.
- **Script label.** `runAs({ type: 'script', name }, fn)` for scripts that run inside the backend codebase
  (`src/scripts/*`). Their changes are recorded like admin changes (with copies), labelled `script:<name>`.
  - Wire it into the scripts that write: backfills, migrations and APX tools. Say which in the report.
- **The AppX nightly sync** (`vidyagramNightlySync.ts`, systemd timer on test-uday) is not on `origin/vidyagram-admin`.
  Check whether it has landed by now. If it has, wrap it as `job:vidyagram-nightly`. If not, list it as a known gap.

## Acceptance criteria

- [ ] Integration: a job that changes nothing writes no row. A job that changes 3 records writes one summary with
      counts and no copies.
- [ ] Integration: a delete inside a job writes a change row labelled `job:<name>`.
- [ ] Integration: a script run with `runAs` writes change rows with copies, labelled `script:<name>`.
- [ ] Report lists every cron wrapped, every script wired, and the nightly sync's status.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 10, 11, 14, 15

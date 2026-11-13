# Deploy wave 3: the history

**Type**: HITL
**Blocked by**: 09, 10, 11, 12, 13, 14, 15, 16, 17
**Repo**: backend, system-brain, ops-console, the Vidyagram box (pm2 92)

## What to build

Ship the history. Prove it records a real admin action end to end. Then enforce the remaining route groups one at a
time.

- **Before deploying (read-only, then user's go-ahead):**
  - Check whether node-cron runs inside pm2 92: look at `NODE_ENV` and `DISABLE_CRONS` in its env. Write it down. It
    decides whether the job runner does anything there.
  - Build the `auditlogs` indexes by hand on prod (autoIndex never builds there), TTL included, and add them to the
    index ledger.
  - Set `AUDIT_TRAIL=on`. Back up the env first.
- **Deploy (user's go-ahead):** push `vidyagram-admin`, pull, build, `pm2 restart 92`. Deploy the ops-console alert
  check. The remaining route groups from task 17 start in `report`.
- **Prove it on prod.** The user makes one harmless admin edit, such as renaming a test class and back. The lookup
  script then shows both changes with the right admin, session, IP and before/after.
- **Watch for 48 h:**
  - `AUDIT_WRITE_FAILED` count (expect 0)
  - `auditlogs` growth per day
  - backend response times on admin routes, compared with the day before
  - pm2 92 memory

  Write the numbers in the report. If rows grow far faster than expected, find the source before going on.
- **Enforce the task 17 groups** one at a time, as in task 05: read the history and the would-refuse lines for that
  group, show the user who calls it, and flip it with their go-ahead.
- **Rollback:** `AUDIT_TRAIL=off` and a restart stop all history writing without a code change. Write it in the
  report.
- Update the README's done list, memory, and the PRD status.

## Acceptance criteria

- [x] Cron status on pm2 92 recorded (NODE_ENV=production, no DISABLE_CRONS: crons run in-process).
- [x] Indexes built and in the ledger.
- [x] Deployed 10-30. The prod proof (Hranker rename and back) shows a correct timeline.
- [ ] 48 h numbers in `vidyagram/reports/admin-history-wave-3-<date>.md`.
- [ ] Each remaining group enforced or knowingly left in `report`, with the user's decision recorded.

## User stories covered

- Stories 18, 24, 47 (and makes 1–27 live)

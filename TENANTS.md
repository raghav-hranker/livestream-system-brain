# Tenants

Two customer lines run on the same fork code. Name the tenant before any task, then work only in its column.
Logins and box details are in [`reference/hosts.md`](reference/hosts.md). Facts that apply to both live at the repo root.

| | quicktricks | Vidyagram |
|---|---|---|
| Customer id | 472 | 781 (AppX org 2177599) |
| Backend | fork `quicktricks-backend`, branch `quicktricks-admin` | same repo, branch `vidyagram-admin` |
| Backend worktree | fresh worktree off `origin/quicktricks-admin` (`qt-*`, `qtb-*`) | `~/Projects/worktrees/vg-backend` |
| Admin | fork `quicktricks-admin`, branch `quicktricks-admin` | same repo, branch `vidyagram-admin` |
| Admin worktree | fresh worktree off `origin/quicktricks-admin` (`qt-admin-*`) | `~/Projects/worktrees/vidyagram-admin-ui` |
| Feature branches | anything not named below | `feat/vg-*`, `fix/vg-*`, `vidyagram-*` |
| Database | `quicktricksdb` on rs0 (no database is named `quicktricks`) | `vidyagramdb` on rs0 (`db.ts` refuses a mismatch) |
| API | `backend.quicktricksbysahilsir.com`, webserver2-2 pm2 27, :5916 | `backend.vidyagramar.com`, webserver2-2 pm2 92, :4100 |
| Admin site | Vercel `quicktricks-admin`, `admin.quicktricksbysahilsir.com` | Vercel `vidyagram-admin`, `admin.vidyagramar.com` |
| Live encoder | GCP `livestream-testing-raghav`, RTMP 8937 | GCP `vidyagram-livestream`, RTMP 8937 |
| Test result services | pm2 `quicktricks-user-test` (29), `quicktricks-dlq-consumer` (30) | pm2 `vidyagram-user-test` (101, :4102), `vidyagram-dlq-consumer` (102, :4103); queues `exam.submission.*.vidyagram` |
| Live socket | pm2 `quicktricks-socket` (28) | pm2 `vidyagram-socket`, :4101, namespace `vidyagram` |
| Viewer (ls) | Vercel `ls`, branch `launch/quicktricks-v2` | Vercel `ls`, branch `vidyagram`, `live.vidyagramar.com` |
| Recorded media | R2 + Cloudflare `recordedvideosv2.hranker.org`, keys `472/<classId>/` | R2 `recordedvideos-vidyagram`, `vidyagram-recorded.hranker.org` |
| Transcoder | client 472 jobs | client 781, `video-transcoder` branch `feat/client-781` |
| Deploy | push `quicktricks-admin`, pull on the box, `pm2 restart 27` | push `vidyagram-admin`, pull in `/var/www/backend.vidyagramar.com/vidyagram-backend`, `pm2 restart 92` |
| Docs in this repo | root `docs/`, `reference/` | [`vidyagram/`](vidyagram/) |
| Memory tag | `tenant: quicktricks` | `tenant: vidyagram` |

## Rules

- Vidyagram work never merges into, pushes to, or deploys `quicktricks-admin`. A pre-push hook in both fork repos
  enforces it ([`reference/scripts/tenant-push-guard.sh`](reference/scripts/tenant-push-guard.sh)). A deliberate
  cross-tenant push needs `TENANT_PUSH_OK=1 git push ...` and the user's say-so.
- A bug found in shared code during Vidyagram work is reported for quicktricks separately, never fixed there as
  part of the Vidyagram change.
- Pulling quicktricks fixes into `vidyagram-admin` is allowed.
- New Vidyagram plans, reports and reference notes go under `vidyagram/`. Scripts stay in `reference/scripts/`
  with a `vidyagram-` prefix.
- Start each session with the tenant in the first line (`qt:` or `vg:`) and title the session the same way.

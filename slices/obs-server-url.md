# Slice: OBS Server URL in the host screen

**Goal:** the ls host screen's "OBS Stream Instructions" card gains a third row — **Server URL** —
next to the existing `ID` and `Stream Key`, so a teacher can configure OBS entirely from the class
screen. The value is the encoder box that *this teacher* is assigned to, resolved by the LMS.

**Why it's a slice:** it crosses admin ⇄ LMS (a new field on the faculty form) and LMS ⇄ ls (a new
class-scoped read), and it copies a **livestream deployment fact** — which encoder box, on which port —
into an LMS record for the first time.

**Repos:** production LMS `../quicktricks-backend` branch `quicktricks-admin` (worktree
`~/Projects/worktrees/qt-backend-rtmp`) · production admin `../quicktricks-admin` branch
`quicktricks-admin` (worktree `~/Projects/worktrees/qt-admin-rtmp`) · viewer `../ls` branch
`launch/quicktricks-v2`, remote `livestream-secure`. The two forks are NOT slice-branch-synced
(`repos.manifest`); ls is.

## The ground truth this slice is built on

The livestream RTMP ingest parses the publish path as **`/<clientId>/<classId>`**
(`webcam-livestream/backend/rtmpserver-2.js:199`, `prePublish`). That single line fixes the whole
contract:

```
OBS "Server"      = rtmp://<encoder-host>:<port>/<clientId>
OBS "Stream Key"  = <classId>                 ← ls already shows this
```

Two facts that shaped the design:

- **There is more than one encoder box, and a teacher is pinned to one.** Load is spread across boxes
  (quicktricks runs a GCP encoder; the Hranker box carries the client socket — see
  `reference/quicktricks-socket-mesh-rollout-2026-09-10.md`). The box a teacher streams to is a
  property of *the teacher*, fixed across their classes. That is why this lives on the faculty
  profile and not on the Class or on a customer-level setting.
- **The port is not in any config file that the LMS or ls can read.** `backend/config/prodConfig.js`
  says `rtmp://videostream.hranker.com` with no port; the deployed quicktricks ingest is the GCP box
  on `:8937`, hardcoded at `backend/rtmpserver-2.js:122` on `origin/launch/quicktricks-v2`. An admin
  therefore cannot derive the right value — it has to be told to them by whoever provisions the box,
  and typed in once per teacher.

**The Server URL is not a credential.** The ingest runs `publish.allow: ["*"]` — there is no auth on
RTMP at all. The pair (clientId, classId) is the only thing standing between a stranger and the
ingest, and the classId is already in the ls URL bar. `select: false` on the field is hygiene (don't
publish your ingest endpoints on the student-facing faculty listing), not secrecy.

## The four design decisions (settled 2026-09-18)

| # | Decision | Chosen | Rejected, and why |
|---|---|---|---|
| 1 | **Grain** — what does the URL vary by? | **Per teacher, fixed.** `FacultyDetails.rtmpUrl`. | A per-customer constant in ls `config/BaseConstants.ts` — cheapest option and the file already pins `LMS_BASE_URL`/`SOCKET_IO_BACKEND_URL` per customer branch, but it cannot express several boxes serving one customer. A `Class`-level field — teachers are not reassigned per class. |
| 2 | **Stored shape** | **Bare box: `rtmp://host[:port]`, no path.** The LMS composes `${rtmpUrl}/${clientId}`. | Storing the full `rtmp://host:port/472` is what a teacher pastes into OBS, but it duplicates the customer id on every faculty row (typo-able per teacher) and leaves a path segment free for someone to append a stream key. Rejecting *all* paths makes "a class id ended up in this field" structurally impossible. |
| 3 | **Resolution** — which teacher is at this card? | **Streamer-token identity first, `teacherName` fallback.** `token.userId → Admin.facultyId → rtmpUrl`; if that yields nothing, case-insensitive `Class.teacherName ≈ FacultyDetails.name`; else `null`. Response carries `source` for debugging. | Identity-only is the honest model but hard-depends on fixing the all-classes mint before that launch path works at all. Name-match-only answers the wrong question — it hands a substitute teacher the scheduled teacher's box — and breaks on renames, casing and duplicate names. |
| 4 | **ls presentation** | **A third row in the existing card**, same Collapsible/Badge/Copy pattern, in the same `pending`/`""` state block. Null ⇒ an explanatory row, never a blocked card. | A separate Go Live popup in the admin dashboard (the previous plan) — it showed the URL one screen away from the stream key, and only on one of two launch paths. |

### Why the token's `userId` is usable

ls **never reads** the Streamer token's `userId` claim: for `role === 'teacher'` it overrides with the
URL's `roomId` (`app/[userId]/[roomId]/page.tsx:113`, again at `:200-204`). So the claim is free for
the LMS to use, and changing what the admin mints into it is safe on the ls side.

Today the two mint sites disagree — a latent inconsistency this slice fixes:

| Mint site | `userId` minted | Effect on this slice |
|---|---|---|
| `components/admin/LiveClassesScheduleDashboard.tsx:205` (My Live Classes — the teacher screen) | `admin.id` | identity path resolves ✅ |
| `components/ClassesDashboard.tsx:155` (all-classes list) | `classData.id` — a **class id** | `Admin.findById(classId)` → null → falls through to the name match |

## The hops

### Hop 1 — LMS (`qt-backend-rtmp`): retarget the field, add the class-scoped read

Already committed on `feat/faculty-rtmp-url` (`791eb3f14` source + `535cbdbe0` dist) and **kept**:
`FacultyDetails.rtmpUrl` (`select: false`), the multipart create/update wiring, and both admin-JWT
reads — `GET /api/admins/me/stream-settings`, `GET /api/admin/faculty/:id/stream-settings` (the
faculty edit page uses the latter).

Changes on top:

- `src/schemas/facultySchemas.ts` — tighten `RTMP_URL_PATTERN` from `^rtmps?:\/\/\S+$` to
  scheme + host + optional port **and no path** (an optional trailing `/` is accepted and stripped).
  The current comment ("the stream key rides in the path") is now false and must go.
- `src/models/facultyDetails.ts` — rewrite the `rtmpUrl` doc comment: it is the encoder box, the
  stream key is the class id, `select: false` is hygiene not secrecy.
- **New** `GET /api/classes/:classId/stream-settings`, mounted beside `'/:classId/playback'` and
  `'/:classId/realtime-token'` in `src/routes/classRoutes.ts`, behind `authenticateUserOrStreamer`.
  **Host only** — decided the same way `getRealtimeToken` decides `role:'host'` (a Streamer token
  whose `classId` claim matches); a viewer's Auth token gets 403.

  **Deviation from the plan, taken during hop 1:** `authorizeClassAccess` is deliberately NOT called.
  That seam decides *viewer entitlement*, and it treats a streamer token as an admin and
  short-circuits to `allowed` — so on this route it would do no work while implying a check that
  isn't happening. No viewer credential can reach the handler at all. The class is read directly for
  the 404 and for `teacherName`.

  Ambiguity in the name fallback resolves to **`null`, never a guess**: if a `teacherName` matches
  more than one faculty profile the LMS logs a warning and answers "not set", because handing a
  teacher another teacher's box sends their class to the wrong server.

  ```
  200 { serverUrl: "rtmp://34.131.52.223:8937/472" | null,
        streamKey: "<classId>",
        clientId:  "472",
        source:    "admin" | "name" | null }
  403 viewer Auth token, or a Streamer token for another class
  ```

- Dist: `npx tsc` (**not** `npm run build` — `prebuild` rimrafs dist), commit only the touched dist
  files as a separate `build:` commit. No co-author trailers in either fork.

### Hop 2 — ls (`../ls`): the third row

- **New** `lib/api/streamSettings.ts`, modelled on `lib/api/realtimeToken.ts` (same token attachment,
  same typed-reason mapping; 401 is an Auth failure boundary per the `lib/api/lms.ts` header comment).
- `components/OBSInstructions.tsx` — a `Server URL` Collapsible row above `ID`, same Badge/Copy
  pattern, inside the existing `streamUpdate === "pending" || ""` block. Rendered from
  `app/[userId]/[roomId]/page.tsx:1106`, which is already host-only (it sits under
  `topLevelView === "broadcast-setup"`).
- Null ⇒ *"Not set — ask an admin to add the OBS server URL on your faculty profile."* Never blocks
  the card; the other two rows are unaffected.
- Tests: vitest, run with `--exclude .sandcastle/**`.
- Deploy: Vercel.

### Hop 3 — admin (`qt-admin-rtmp`): drop the popup

- Delete `components/admin/GoLiveDialog.tsx` + its test; restore the one-click `handleGoLive`
  (token → `window.open`) in `LiveClassesScheduleDashboard.tsx` and drop its `useMyStreamSettings`/
  `useFaculty` wiring.
- **The `ClassesDashboard` mint change is HELD BACK** (changed 2026-09-18, was in this hop). The LMS
  reads that exact claim as the host's socket identity (`realtimeTokenController.ts:143` —
  *"userId claim, which is the classId"*), and our rule is host socket identity == classId. Flipping
  it moves host identity on that launch path and risks DM/chat attribution, to buy only an upgrade
  from `source:"name"` to `source:"admin"`. Ship the slice on the name fallback, verify what the
  livestream socket layer does with the claim, then flip the mint on its own.
- `components/admin/FacultyForm.tsx` — relabel the field **"OBS Server URL"**, helper text: the box
  only, no stream key, no customer id. The client-side pattern is tightened to match the API's, so
  a pasted `rtmp://host:8937/472` is rejected in the form. Tests updated.
- Keep `hooks/api/use-stream-settings.ts` (`useFacultyStreamSettings` is used by the edit page).
  `useMyStreamSettings` **removed** — no caller left, and a live hook with no screen behind it
  invites being wired to the wrong one. The LMS endpoint stays.
- Squash to one clean commit; `git fetch` + rebase + `git push --dry-run origin HEAD:quicktricks-admin`
  immediately before pushing — the remote moves fast.

### Push / deploy order

LMS (push → pull on the prod box) → ls (Vercel) → admin (Vercel). Until the LMS is live, ls shows the
"not set" row; nothing breaks.

## State (2026-09-18) — SHIPPED, NOT YET TESTED

All three hops are **pushed**; the LMS is **live on prod**. Nothing has been exercised end to end.

| Hop | Repo | Deploy branch | Commit | Live? |
|---|---|---|---|---|
| 1 | quicktricks-backend | `origin/quicktricks-admin` | `d9d19319e` | ✅ box pulled, pm2 `27` restarted |
| 2 | ls | `livestream-secure/launch/quicktricks-v2` | `7c3f2d0` | Vercel — unverified |
| 3 | quicktricks-admin | `origin/quicktricks-admin` | `7cd7dce` | Vercel — unverified |

Prod probe after the restart (the acceptance signal for hop 1):

```
/api/classes/<id>/stream-settings         404 -> 401   the new route
/api/admin/faculty/<id>/stream-settings   404 -> 401
/api/admin/faculty  (control)             401
```

Both forks were rebased onto their deploy branch before pushing (they were 46 / 50 behind).
The LMS `dist` was **rebuilt against the new tip**, not replayed — the pre-rebase `build:` commits
were 46 commits stale and replaying them would have reverted the client team's `dist`. Verified by
compiling the tree clean and diffing every `.js` against the committed `dist`: only this slice's ten
files moved. The pull on the box was a pure fast-forward (previous tip `a92cf1c6d` is an ancestor),
one source line deleted across the whole pull, and that line is one this slice rewrites.

Rollback: on the box, `git reset --hard a92cf1c6d` + `pm2 restart 27`. Backup branches
`backup/obs-server-url-20260918` in both fork worktrees.

**Box access gotcha:** node/pm2 live at `~/.nvm/versions/node/v22.22.2/bin` — NOT `~/node/...`.
An export of the wrong path makes `pm2` a silent no-op.

## Open items

- **Not browser-checked.** The ls row has not been rendered against a live LMS.
- The **encoder host value** is entered per teacher in the faculty form and is deliberately not
  pinned here (closed 2026-09-18 — it is data, not config).
- Whether the livestream socket layer reads the Streamer token's `userId` (ls does not). This gates
  the deferred `ClassesDashboard` mint change, not the slice.

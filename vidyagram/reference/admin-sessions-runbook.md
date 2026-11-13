---
tenant: vidyagram
---
# Admin sessions runbook: how to end a leaked admin login

Vidyagram (781) only. Every admin login to the panel is a server session (`adminsessions`). Ending one makes its
token fail on the next request with 401 `ADMIN_SESSION_ENDED`, reason `ended_by_admin`, and the panel sends that
admin back to the login screen. Source: backend task 08 of the admin audit trail
(`vidyagram/plans/tasks/admin-audit-trail/08-session-controls.md`). Not deployed until task 09 (deploy wave 2).

## Who can call these routes

Only admin ids listed in `AUDIT_ADMIN_IDS` in the backend's env: comma-separated, read on every request (after
editing the env, `pm2 restart <id> --update-env`). Empty or unset means nobody. Everyone else gets:

- no token: 401
- a student token: 403 `Admin access required`
- an admin not on the list: 403 `NOT_AUDIT_ADMIN`

## Get your token

Log in to the Vidyagram admin panel, open the browser console and run `localStorage.getItem('admin_token')`.
Your own admin id is the `admin_id` claim in that token.

```sh
export VG=https://backend.vidyagramar.com/api
export TOKEN='<your admin_token>'
```

## 1. See who is logged in

```sh
# Every active session
curl -s "$VG/admin/sessions" -H "Authorization: Bearer $TOKEN" | jq '.data.sessions'

# One admin's sessions
curl -s "$VG/admin/sessions?adminId=<adminId>" -H "Authorization: Bearer $TOKEN" | jq '.data.sessions'
```

Each row has `sessionId`, `adminId`, `name`, `email`, `ip`, `browser` (the User-Agent at login), `createdAt`,
`lastSeenAt` (moves at most once a minute) and `current` (true for the session you are calling from). The list
never contains tokens. Sessions past `ADMIN_TOKEN_TTL` (default 1 day) are left out: their tokens are refused anyway.

A leaked login usually shows as an IP or browser that doesn't match the admin, or two sessions where they use one
device.

## 2. End one session

```sh
curl -s -X POST "$VG/admin/sessions/<sessionId>/end" -H "Authorization: Bearer $TOKEN"
```

- `data.ended: true`: ended now.
- `data.ended: false`: it had already ended.
- 404 `ADMIN_SESSION_NOT_FOUND`: no such session id.

## 3. End every session of one admin

Use this when you can't tell which session is the leaked one.

```sh
curl -s -X POST "$VG/admin/admins/<adminId>/end-sessions" -H "Authorization: Bearer $TOKEN"
```

`data.ended` is how many sessions ended. The admin can log in again straight away, so if the password or the
mobile may be compromised, change them too:

- Change the password in the admin panel.
- Or disable the admin (status 0) until it is sorted. Disabling ends their sessions as `admin_disabled`.

Don't end your own session by accident: check `current` in the list first. If you do, log in again.

## Check it worked

```sh
curl -s "$VG/admin/sessions?adminId=<adminId>" -H "Authorization: Bearer $TOKEN" | jq '.data.sessions | length'
```

The leaked token now gets `{"state":401,"code":"ADMIN_SESSION_ENDED","reason":"ended_by_admin",...}`. Each end call
also writes an `ADMIN_SESSION_ENDED_BY_ADMIN` line to the backend's pm2 log with who ended what.

## Related settings

- `ADMIN_SESSION_MULTI_DEVICE=off`: a new login ends the admin's older sessions (reason `logged_out`).
- `ADMIN_TOKEN_TTL`: login lifetime, default `1d`.
- `ADMIN_OTP_REQUIRED`: SMS OTP on every admin login (default on).

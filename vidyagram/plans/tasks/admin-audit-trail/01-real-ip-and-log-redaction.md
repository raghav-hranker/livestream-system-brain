# Real visitor IP + blank secrets in logs

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: backend

## What to build

Groundwork that every later task relies on: the backend knows the real visitor IP, and no log line holds a password,
OTP or token.

- **Find the proxy chain.** Apache on webserver2-2 sits in front of pm2 92. Check whether Cloudflare also proxies
  `backend.vidyagramar.com`: look for `cf-ray` and `server: cloudflare` in `curl -sI` headers, and check DNS. Write the
  answer in the report.
- **Client IP module.** One function returns the real visitor IP for a request, and Express `trust proxy` is set to
  the matching hop count, so `req.ip` is right everywhere.
  - The existing helper used by playback and downloads becomes this function. Its callers keep working.
  - If Cloudflare is in front, use its connecting-IP header, but only when the request really came through Cloudflare.
    A client must not be able to spoof its IP by sending forwarding headers itself.
  - Student logins already store `ip_address` on `UserLoginSession`; that now gets the real IP.
- **Redactor.** One function blanks secret values anywhere in an object, at any depth, with key names matched in any
  case: password and its variants (`password`, `newpassword`, `Psw`…), `otp`, `token`, `preAuthToken`, `mpin`, and the
  `authorization` and `cookie` headers. If a `redactCredentials` helper already exists on the branch, it becomes this
  module.
- **Use it everywhere we log.**
  - The request logger's body excerpt goes through the redactor.
  - The admin login, admin OTP and change-password routes join the logger's no-body list as a second guard.
  - The global error handler logs headers through the redactor. Today it prints `Authorization` in full.

## Acceptance criteria

- [ ] Unit: the redactor blanks nested and array secrets, matches key names in any case, and leaves other fields
      untouched.
- [ ] Unit: client IP is right for a direct call, an Apache-forwarded call and (if it applies) a Cloudflare call.
      A forwarding header the client sends itself is not trusted beyond the configured hops.
- [ ] Integration: a student login stores the forwarded IP on its session row, not `127.0.0.1`.
- [ ] Integration: the log output for an admin login and OTP holds no password, OTP or token. An error response logs
      `Authorization` blanked.
- [ ] Report says whether Cloudflare fronts the backend, with the evidence.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 48, 49

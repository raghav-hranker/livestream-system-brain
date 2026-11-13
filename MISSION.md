# Mission: Diagnose cookie-based authentication in production

## Why
Build enough practical understanding of cookie sessions to diagnose the APX client 472 incident, explain it accurately, and recognise the same failure pattern before it becomes a prolonged outage.

## Success looks like
- Distinguish a cookie value, a server-side session, and an authenticated request.
- Trace authentication across browser, Next.js proxy, MongoDB, cron, and upstream APX.
- Use HTTP status, `Location`, and `Set-Cookie` evidence to tell renewal from expiry.
- Propose a safe recovery and prevention path without exposing session secrets.

## Constraints
- Teach from the live APX case rather than from an abstract authentication survey.
- Keep the first lesson short and operationally useful.
- Treat every session ID as a credential: compare hashes, never print raw values.

## Out of scope
- OAuth, JWT internals, and identity federation.
- A full CSRF or browser-security treatment; cookie flags are covered only as needed here.

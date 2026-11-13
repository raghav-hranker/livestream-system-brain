# Admin login hardening

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: backend + admin + system-brain (one read-only script)

## What to build

A password alone never makes an admin.

- **Refuse the half-way token.** `requireAdmin` refuses any token that carries a `purpose` claim. The only route that
  accepts the half-way token is the OTP step itself.
- **OTP for every admin.** A new setting, `ADMIN_OTP_REQUIRED`, defaults to on.
  - When it's on, an admin with no mobile gets 403 with code `ADMIN_MOBILE_REQUIRED` from the login route instead of
    a token.
  - When it's off, today's behaviour stays: no mobile means no OTP.
- **OTP step re-checks status.** An admin disabled between the password and the OTP is refused.
- **Admin panel.** The login page shows "Add a mobile number to your admin account to log in. Ask the main admin." on
  `ADMIN_MOBILE_REQUIRED`.
- **Script.** Add `reference/scripts/vidyagram-admins-without-mobile.js` to system-brain, and list it in its README.
  It is a read-only list of Vidyagram admins (id, name, email, status, role) with no usable mobile. Task 09 runs it on
  prod.

## Acceptance criteria

- [ ] Integration: a half-way token gets 401 or 403 on an admin route and still works on the OTP step.
- [ ] Integration: with `ADMIN_OTP_REQUIRED` on, an admin with no mobile gets 403 `ADMIN_MOBILE_REQUIRED`. With it
      off, they get a full token as today.
- [ ] Integration: an admin disabled after the password step is refused at the OTP step.
- [ ] Admin: the login page shows the message on `ADMIN_MOBILE_REQUIRED`.
- [ ] The script runs against local or in-memory data and prints the expected admins.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 28, 29, 30, 37

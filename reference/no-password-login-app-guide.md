# Login change for accounts with no password yet (quicktricks, customer 472)

Status: built, **not deployed** (backend branch `fix/login-no-password-claim`, 2026-10-28). Not sent to anyone yet.

## What changes

Most imported students (about 696k accounts, from AppX) have never set a password on our platform. The backend marks
them `password_setup_required: true`.

Until now `POST /api/users/login` saved **whatever password was typed first** for such an account and logged the
person in. Anyone who knew a student's mobile number could take the account this way, and a script did, for
about 458 accounts on 10-26..28.

After the change:

| Call | Account with no password yet | Normal account |
|---|---|---|
| `POST /api/users/login` with any password | **401** `{ "state": 401, "msg": "Invalid credentials", "data": null }` | 200 with the right password, the same 401 with a wrong one |
| `GET /api/users/sendOtp/:mobile` then `POST /api/users/mobile-login` | 200 + token (unchanged) | unchanged |
| `POST /api/users/change-password` with `Authorization: Bearer <that student's token>` | sets the password **and** makes it usable for password login | unchanged |
| `POST /api/users/change-password` without that student's own token | password stored, but password login still answers 401 | unchanged |

The 401 is deliberately identical to a wrong password, so the app **cannot** tell the two cases apart from the
response. Don't try to: telling them apart is exactly what an attacker needs. The old 400
"Password must be at least 6 characters long" from `/login` is gone.

## What the app should do

1. On a 401 from password login, show the error together with a clear **"Login with OTP"** action (and/or
   "Forgot password?") that goes to the OTP screen with the mobile number prefilled.
2. After the OTP login succeeds, offer **"Set a password"** if the student wants one, and call
   `POST /api/users/change-password` with body `{ "user_id": "<id>", "newpassword": "<min 6 chars>" }` **and the
   Bearer token from the OTP login**. From then on, password login works.
3. Nothing else changes: tokens, `/mobile-login`, `/sendOtp`, session limits.

The website (thedhronas `quicktricksbysahilsir-new`) needs no change. Its login page already offers OTP login, and
Forgot Password goes OTP login → Change Password with the stored token (`authorizedFetch`), which now also makes
the new password usable.

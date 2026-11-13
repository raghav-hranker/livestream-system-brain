# Account deletion APIs — app-team handoff

> **Status: `DELETE /api/users/me` is LIVE on production since 2026-09-16** (backend release
> `424804655`) and every response below was observed on production on 2026-09-17.
>
> **`checkMobileExist` now answers 401 for a self-deleted account (§2) — LIVE on production since
> 2026-09-17 16:16 IST** (release `316dacd07`). Verified against a deleted number on the live API.
> **Action for clients:** exclude this call from any global "on 401 → clear session and redirect to
> login" interceptor, and never read a non-200 here as "number is free" (see §2).
> Base URL for all calls: `https://backend.quicktricksbysahilsir.com`.

Two endpoints, in the order a user meets them:

| # | Endpoint | Auth | Who calls it |
|---|---|---|---|
| 1 | `DELETE /api/users/me` (alias `POST /api/users/me/delete`) | Bearer login token **+** password in body | the signed-in user, from Settings |
| 2 | `GET /api/users/checkMobileExist/{mobile}` | **none** (public) | the app's first screen, when someone comes back |

---

## 0. Getting the `<LOGIN_TOKEN>` for the delete call

The delete call needs the user's ordinary **login token** — the same one the app already holds after
sign-in. Nothing special is minted for deletion. To run the delete curl by hand, get one first:

**Password login** (`email` also accepts a mobile number as a string):

```sh
curl -s -X POST 'https://backend.quicktricksbysahilsir.com/api/users/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"someone@example.com","password":"<PASSWORD>"}'
```

**OTP login** — request the OTP, then exchange it (4 digits):

```sh
curl -s 'https://backend.quicktricksbysahilsir.com/api/users/sendOtp/9876543210'

curl -s -X POST 'https://backend.quicktricksbysahilsir.com/api/users/mobile-login' \
  -H 'Content-Type: application/json' \
  -d '{"mobile":9876543210,"otp":"1234"}'
```

Both return the token at **`data.token`**:

```json
{ "state": 200, "msg": "Login successful", "data": { "user_id": "…", "token": "eyJhbGciOiJIUzI1NiIs…" } }
```

Use it as `Authorization: Bearer <that value>`. It is the *user* login JWT — not an admin token, not
the Streamer token. A token minted before a delete stops working the moment the delete succeeds.

---

## 1. `DELETE /api/users/me` — delete my account

The **token decides which account is deleted**. The password in the body is only re-authentication —
never send a user id.

```sh
curl -i -X DELETE 'https://backend.quicktricksbysahilsir.com/api/users/me' \
  -H 'Authorization: Bearer <LOGIN_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"password":"<THE USER'\''S PASSWORD>"}'
```

Clients that cannot issue `DELETE` use the identical alias:

```sh
curl -i -X POST 'https://backend.quicktricksbysahilsir.com/api/users/me/delete' \
  -H 'Authorization: Bearer <LOGIN_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"password":"<THE USER'\''S PASSWORD>"}'
```

**Success — 200**

```json
{
  "state": 200,
  "msg": "Your account has been disabled and will be deleted in 30 days. Kindly contact support if you didn’t opt for deletion of your account",
  "data": null
}
```

Show `msg` to the user as-is. Note the apostrophe in *didn’t* is the typographic `’` (U+2019), so do
**not** match on the message text — branch on `state`.

**Every other response**

| Code | `msg` | When |
|---|---|---|
| 400 | `Validation failed` (+ `errors[]`) | body isn't valid JSON / `password` isn't a string |
| 400 | `Password is required` | the account has a password and the body omitted it |
| 401 | `Access token required` | no `Authorization` header |
| 401 | `Invalid token` | token not signed by us / malformed |
| 401 | `Token expired. Please call /api/users/refresh-token to get a new token.` | expired token |
| 401 | `Session has been terminated. Please login again.` | the session behind the token was closed — **see the retry note below** |
| 401 | `Invalid credentials` | wrong password |
| 404 | `User not found` | token names an account that no longer exists |

### The one behaviour that will bite you: a retry returns 401, not 200

A successful delete **closes every session**, so the token the app is holding dies the moment the
call succeeds. If the response is lost (flaky network, app backgrounded) and the app retries with the
same token, it gets:

```json
{"state":401,"msg":"Session has been terminated. Please login again.","data":null}
```

That is **not a failure** — the account was already deleted. Treat `401` after a delete attempt as
"already done": log the user out and show the success screen. Showing an error there is the most
likely bug in this flow.

### Accounts with no password (OTP-only / Google sign-in)

Users who never set a password can delete on the token alone — send an empty body:

```sh
curl -i -X DELETE 'https://backend.quicktricksbysahilsir.com/api/users/me' \
  -H 'Authorization: Bearer <LOGIN_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

The server knows which accounts these are; the app does not have to decide. If it sends a password
for such an account, it is ignored. If it omits one for an account that *has* a password, it gets
`400 Password is required` — so the safe rule is: **ask for the password if you have a password
login, otherwise send `{}`.**

### What "deleted" actually means

Nothing is erased. The account is **disabled** (`status: 0`) and the deletion time is recorded; the
30-day purge is a separate future job. Support can reverse it. Orders, test history and coins survive.
Push notifications stop by themselves. The user cannot log in, request an OTP, or reset their
password while disabled.

---

## 2. `GET /api/users/checkMobileExist/{mobile}` — the returning user's first screen

Public, no token. This is where a returning deleted user finds out what happened — **before** they hit
login or OTP, which only say "Account is deactivated".

```sh
curl -i 'https://backend.quicktricksbysahilsir.com/api/users/checkMobileExist/9876543210'
```

Multi-customer variant (customer `472` = quicktricks; the route above already defaults to it):

```sh
curl -i 'https://backend.quicktricksbysahilsir.com/api/users/checkMobileExist/9876543210/472'
```

**Three responses — note the deleted one is `401`, not `200`**

Number never registered — **200**:
```json
{"state":200,"msg":"Mobile number not registered","data":{"exists":false,"disabled":false}}
```

Normal, active account — **200**:
```json
{"state":200,"msg":"Mobile number exists","data":{"exists":true,"disabled":false}}
```

Account the user deleted themselves — **401**:
```json
{
  "state": 401,
  "msg": "Your account has been disabled and will be deleted in 30 days. Kindly contact support if you didn’t opt for deletion of your account",
  "data": { "exists": true, "disabled": true }
}
```

**This 401 is not an authentication failure.** The endpoint has no auth at all — 401 here means
"this number cannot proceed, show `msg`". Two consequences for the client:

- **A global "on 401 → clear session and redirect to login" interceptor must not fire for this call.**
  It happens on the login screen, where there is no session to clear; letting the interceptor run
  will loop the user. Exclude `checkMobileExist` from it.
- **A non-200 here does not mean "number is free".** Do not fall through to the registration screen —
  registration would then fail with `Email or mobile already registered`. Show `msg` and stop.

The body is still populated on the 401, so **branch on `data.disabled`** where you can: the flag is
stable, the message text is copy and will change. `data` is never `null` except on a 400.

**Errors**

| Code | `msg` | When |
|---|---|---|
| 400 | `Valid mobile number is required` | fewer than 10 digits |
| 400 | `Valid customer_id is required` | the `/{customer_id}` variant got a non-number |

An account disabled by an **admin** (rather than deleted by its owner) still answers `200` with
`{exists:true, disabled:true}` and `msg: "Mobile number exists"` — there is no deletion date to
promise. If you want that case to 401 as well, say so and it is a one-line change.

### What this endpoint does NOT return

It never returns `"Account deleted successfully"`. That string comes only from the **older**
`POST /api/delete-account` (email + mobile + password), which is a different endpoint. If you see it,
you are not talking to `checkMobileExist`.

---

## 3. The whole flow, as observed on production

Run against a throwaway account on 2026-09-17, in this order:

| Step | Result |
|---|---|
| `checkMobileExist` while active | `Mobile number exists` · `{exists:true, disabled:false}` |
| `DELETE /api/users/me` | `200` · the 30-day message · `data:null` |
| `checkMobileExist` after | **`401`** · the 30-day message · `{exists:true, disabled:true}` |
| `GET /api/users/sendOtp/{mobile}` | `403 Account is deactivated` |
| `POST /api/users/login` | `403 Account is deactivated` |
| retry `DELETE /api/users/me` | `401 Session has been terminated. Please login again.` |

---

## 4. Known gaps (backend side, not the app's problem to work around)

1. **`POST /api/delete-account` (the old endpoint) leaves no trace of *why*.** Accounts deleted
   through it are disabled the same way, but `checkMobileExist` answers `Mobile number exists` for
   them — no 30-day message. If the app still calls that endpoint anywhere, move it to
   `DELETE /api/users/me`.
2. **Login / OTP / forgot-password still say only `Account is deactivated`** (403). The long copy
   lives on `checkMobileExist` alone. Tell us if the app wants the full message at those doors too.

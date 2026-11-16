# Vidyagram Lifetime validity: app guide

> How the app shows a course or plan the student holds for life.
>
> Base URL: `https://backend.vidyagramar.com/api`.
>
> **Status (2026-11-16): deployed, not sent.** Live on `backend.vidyagramar.com` since 2026-11-16 21:04 IST
> (backend `vidyagram-admin` 737bbda94). Sending this guide to the app team is the user's call.
>
> Every sample below comes from a real run of the backend routes on an in-memory database:
> `src/tests/integration/lifetimeFlag.integration.test.ts`. Run it with `PRINT_GUIDE_PAYLOADS=1` to print them again.
> Samples are trimmed to the fields this guide discusses.

---

## 1. What changes

An admin can sell a course length as **Lifetime**. The backend stores Lifetime as 100 years (36,525 days), so a
Lifetime buyer's `daysLeft` is about 36,500 and their end date is 100 years out. Until now the app could only guess
from that number, and four screens printed it: "36525 DAYS LEFT", "Valid till 16 Nov 2126 · 36525 days left".

Now every response that carries `daysLeft` or an end date also carries **`isLifetime`**. When it is `true`, show
**"Lifetime"** where you would show days left or the end date, and never show that number or date. `daysLeft`,
`expiresAt` and `duration` keep their values, so nothing that reads them today breaks.

`isLifetime` is `true` or `false`, never missing, on every response listed below.
It is `true` only for a purchase of a 100-year (Lifetime) length; a long end date on any other length is not Lifetime.

---

## 2. Where it is

| Response | Field | `true` when |
|---|---|---|
| Every course object: `POST /courses/by-id-2`, My Courses, home and catalogue course lists, anywhere `daysLeft` / `isExpired` is sent | `isLifetime` beside `daysLeft` | The student holds the course for life |
| `GET /users/me/plans` (My plans), each card | `isLifetime` beside `daysLeft` / `expiresAt` | That plan is held for life |
| `GET /users/me/profile-dashboard` | `purchases.isLifetime` beside `purchases.daysLeft` | Every plan the student holds is for life |
| `POST /plans/filter-active/:userId` (the length picker), each plan | `isLifetime` beside `duration` | That length is a Lifetime length (before purchase) |

A course the student does not hold, or no longer holds, always has `isLifetime: false`.

---

## 3. What to show

| Screen | Today | With `isLifetime: true` |
|---|---|---|
| Course page, enrolled pill | "36525 DAYS LEFT" | **LIFETIME** (no red, no countdown) |
| My Courses card | "Lifetime" (guessed from `daysLeft`) | **Lifetime**: read the field and drop the 10-year guess |
| My plans row | "Valid till 16 Nov 2126 · 36525 days left" | **Lifetime validity** |
| Profile, purchases line | "36525 days left" | **Lifetime** |
| Extend validity sheet | "Expires 16 Nov 2126" | No end date or days left. A Lifetime plan never gets an extend offer (`extendOffers` is `[]`) |
| Length picker (optional) | the length's `name`, e.g. "Lifetime Validity" | Keep showing `name`. Use `isLifetime` only if a row shows the length from `duration` |

A Lifetime plan never counts as "expiring soon", so keep it out of any red or 30-day styling.

---

## 4. Samples

The length picker for a course sold for 1 year or for life (`POST /plans/filter-active/:userId`, trimmed). A Lifetime
row the admin left unnamed is named "Lifetime Validity":

```json
[
  { "id": "…", "name": "1 Year Validity", "amount": "449", "duration": 365, "isLifetime": false },
  { "id": "…", "name": "Lifetime Validity", "amount": "799", "duration": 36525, "isLifetime": true }
]
```

The same student on two course pages (`POST /courses/by-id-2` with their `userId`, trimmed). Held for life:

```json
{ "is_buy": 1, "isPaid": true, "isExpired": false, "isExtension": false, "daysLeft": 36525, "isLifetime": true }
```

Held for a year:

```json
{ "is_buy": 1, "isPaid": true, "isExpired": false, "isExtension": false, "daysLeft": 365, "isLifetime": false }
```

Their Lifetime card on My plans (`GET /users/me/plans`, trimmed):

```json
{ "name": "Lifetime Validity", "expiresAt": "2126-11-17T14:58:54.736Z", "daysLeft": 36525, "isLifetime": true, "extendOffers": [] }
```

Their profile dashboard (`GET /users/me/profile-dashboard`, trimmed). `daysLeft` is the soonest end, the yearly plan,
so it is not Lifetime:

```json
{ "purchases": { "activePlans": 2, "daysLeft": 365, "isLifetime": false } }
```

A student whose only plan is Lifetime:

```json
{ "purchases": { "activePlans": 1, "daysLeft": 36525, "isLifetime": true } }
```

---

## 5. Checklist

- [ ] Course page pill shows LIFETIME when `isLifetime` is true.
- [ ] My Courses card reads `isLifetime`, not `daysLeft > 3650`.
- [ ] My plans row shows "Lifetime validity" in place of the date and days left.
- [ ] Profile purchases line shows "Lifetime" when `purchases.isLifetime` is true.
- [ ] Extend validity sheet shows no end date for a Lifetime plan.
- [ ] Nothing styles a Lifetime plan as expiring.

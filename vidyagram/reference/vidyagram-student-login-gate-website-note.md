# Vidyagram backend: login will soon be required on student APIs

We are adding a login check to the student APIs on `backend.vidyagramar.com`. It starts in a watch-only mode
that blocks nothing. Later, any call to these APIs without a valid `Authorization: Bearer <token>` header will
get a 401.

## APIs the website calls without a token today

Please send the logged-in student's token on these three:

1. `POST /api/orders/get-website-razorpay-order` (checkout)
2. `POST /api/class-progress` (class watch progress). Note: `sendBeacon` cannot send the header, so this call
   needs `fetch` with `keepalive: true`.
3. `POST /api/typing-test/series` (typing test list). This one is also called on the public typing test page
   for logged-out visitors. Skip the call when nobody is logged in, or tell us it must stay public.

## APIs that stay public

No change needed for the exam score calculator:

- `POST /api/score/get-score-content`
- `POST /api/score/save-upsi-score-content`
- `GET /api/score/get-upsi-score/:rollno`

Nothing will be blocked until the three fixes above are live.

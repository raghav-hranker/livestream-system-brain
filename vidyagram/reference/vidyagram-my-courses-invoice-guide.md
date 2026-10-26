# Vidyagram My courses invoice: app team guide

> How the app shows a **Download invoice** link on a My courses card and downloads the PDF.
>
> Base URL: `https://backend.vidyagramar.com/api`.

---

## 1. The rule in one paragraph

Every course card in My courses now names the purchase that gives the student the course (`invoiceId`). When that
purchase was paid through the app's own checkout, the card also carries `invoiceDownloadUrl`: a direct link to the
invoice PDF that the app opens as it is. Free courses, admin-given courses and purchases carried over from AppX have no invoice from us, because AppX billed
those itself. Both fields are filled only when the call carries the student's login token.

---

## 2. The two new fields

`POST /api/courses/my-courses` is the call the app already makes. Every course in `liveCourses` and `recordedCourses`
now has `invoiceId` and `invoiceDownloadUrl`. The rest of the card is unchanged.

```json
{
  "id": "6adb333542494a5ce4c89e91",
  "title": "Static GK 2.0 Batch",
  "isLive": false,
  "isPaid": true,
  "myRating": null,
  "invoiceId": "6adb33433a9a0c7e7d64dd7d",
  "invoiceDownloadUrl": "https://<storage host>/…/INV-<orderNumber>.pdf"
}
```

| Field | Value |
|---|---|
| `invoiceId` | The order id behind this course. It is `null` when the call has no token. It matches `id` on the order history rows (`GET /api/orders/my-orders`). |
| `invoiceDownloadUrl` | The full link to the invoice PDF, or `null` when there is no invoice to download. It is the same link `GET /api/orders/my-orders` returns as `invoice_url`. It needs no token and does not expire. |

When a student holds a course through more than one purchase, the card names the app's own paid purchase first, then
any other paid one, then any. Within each group, the latest purchase wins.

The invoice number is printed on the PDF. It is not sent separately.

---

## 3. Send the login token

**Send the student's bearer token on this call** (`Authorization: Bearer <token>`). Without it, the course list is the
same but `invoiceId` and `invoiceDownloadUrl` are `null` on every card.

---

## 4. When `invoiceDownloadUrl` is null

| `invoiceId` | `invoiceDownloadUrl` | Why | What the app shows |
|---|---|---|---|
| `null` | `null` | No login token on the call. | No invoice link. |
| set | `null` | A free course, an admin-given course, or a purchase carried over from AppX. | No invoice link. |
| set | set | Paid through the app's checkout. | The **Download invoice** link. |

Show the link only when `invoiceDownloadUrl` is not null. Do not build a link from `invoiceId` yourself.

---

## 5. Open the PDF

`invoiceDownloadUrl` is the PDF file itself (`Content-Type: application/pdf`). Open it in the browser, a PDF viewer or a
download manager. Send no token: it is a plain public link.

`GET /api/orders/:orderId/invoice` still works for older builds that call it with the bearer token.

---

## 6. Checklist for the app

- [ ] Send the bearer token on `POST /api/courses/my-courses`.
- [ ] Show a **Download invoice** link on a card only when `invoiceDownloadUrl` is not null.
- [ ] Open `invoiceDownloadUrl` directly as a PDF, with no token.

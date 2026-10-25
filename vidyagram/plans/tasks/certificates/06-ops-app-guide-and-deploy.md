# Ops, app guide and prod deploy

**Type**: HITL
**Blocked by**: 01 to 05
**Repo**: backend + admin + system-brain, plus the Hranker Cloudflare account

## What to build

- **Cloudflare (whoever has the Hranker account; a `wizard` script can walk them through it):**
  - Create the R2 bucket `vidyagram-certificates` in APAC, like `recordedvideos-vidyagram`.
  - Attach the custom domain `vidyagram-certificates.hranker.org`. Keep the `r2.dev` URL disabled.
  - Add a response-header Transform Rule for that hostname: `X-Robots-Tag: noindex, nofollow`.
  - Create an R2 API token limited to object read and write on this bucket only.
  - Record everything in a `vidyagram/reports/` note, the way the R2 setup report was done.
- **App team guide.** Write `vidyagram/reference/vidyagram-certificates-api-guide.md` in the catalogue-filters guide
  style. It covers:
  - the `certificate` field on `by-id-2`. The bearer token is required, otherwise the field is `null`.
  - the progress line and button rules for each state and reason, with suggested copy;
  - the claim screen: `suggestedName`, the preview call and the "this name can't be changed later" warning;
  - the claim call and its 201, 200, 400 and 409 handling;
  - the certificate view: the image from `imageUrl`, "View PDF" opening `pdfUrl` in the app's PDF viewer, and
    "Share" sending `shareUrl` (with the image attached, if the app team wants);
  - the "My certificates" list;
  - the `certificate_ready` push and its deep link.

  Include sample payloads from a real local run.
- **Deploy, with the user's go-ahead at each step.**
  - Run the index script dry, then for real, on `vidyagramdb`. Add it to the index ledger.
  - Backend: put the `CERTIFICATE_R2_*` settings and `CERTIFICATE_BASE_URL=https://vidyagram-certificates.hranker.org`
    in the box env, with `CERTIFICATES_ENABLED=false` and `CERTIFICATE_CLAIMS_OPEN=false`. Then push
    `vidyagram-admin`, build the surgical dist and `pm2 restart 92`.
  - Admin: the user deploys the frontend.
  - Smoke test against the real bucket from a local backend on a scratch database (never prod data): claim one
    certificate, open its link in a browser, check that the PDF shows inline with `X-Robots-Tag` set, then delete
    the two test objects.
  - Turn on `CERTIFICATES_ENABLED` only when the user says so. Turn on `CERTIFICATE_CLAIMS_OPEN` only after the real
    signatory, or `CERTIFICATE_SIGNATURE=off`, is set in the env.

## Acceptance criteria

- [ ] Bucket, domain, noindex rule and scoped token exist. A random code returns 404 from the domain, and listing is
      not possible.
- [ ] Guide written, with every state, reason and status code, and real sample payloads.
- [ ] Indexes built on `vidyagramdb` and recorded in the ledger.
- [ ] Backend deployed with both flags off. `GET /api/courses/:id/certificate` returns 404, and `by-id-2` carries
      `certificate: null`.
- [ ] Smoke claim against the real bucket passes, and the test objects are deleted.
- [ ] After the user turns `CERTIFICATES_ENABLED` on, a test course behaves on prod as follows: mark it complete,
      have a test account at 100% see `claims_closed`, then reopen the course. The state is restored and recorded in
      `prod-data-changes.md`.
- [ ] The memory note is updated with the deploy commits and flag states.

## User stories covered

- Story 43

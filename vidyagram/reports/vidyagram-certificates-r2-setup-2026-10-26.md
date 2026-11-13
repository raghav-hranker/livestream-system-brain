# Vidyagram certificates: R2 bucket, domain, noindex rule and backend env (2026-10-26)

This covers the Cloudflare part of certificates task 06 (`vidyagram/plans/tasks/certificates/06-ops-app-guide-and-deploy.md`).
Nothing was deployed, and no switch was turned on.

## Cloudflare

All of this is in the Hranker account, "Deepaksharma7933@gmail.com's Account" (`1ff6f2000c9aa34ca2ec88c066af092a`).

- **Bucket** `vidyagram-certificates`:
  - created with wrangler 4.43.0: `wrangler r2 bucket create vidyagram-certificates --location apac --storage-class Standard`
  - created 2026-10-26T08:20:58Z, location APAC, storage class Standard
- **Custom domain** `vidyagram-certificates.hranker.org`:
  - attached with `wrangler r2 bucket domain add … --zone-id 37006234a9c877df3cc0faca5ef6f1da --min-tls 1.2`, in zone `hranker.org`
  - ownership and SSL both active within about 2 minutes
  - the r2.dev public URL is disabled
- **Noindex rule:** a Response Header Transform Rule in zone `hranker.org`, set up by Raghav in the dashboard.
  - name: `vidyagram certificates: noindex`
  - match: `(http.host eq "vidyagram-certificates.hranker.org")`
  - action: sets the static header `X-Robots-Tag: noindex, nofollow`
- **Token** `vidyagram-certificates-backend`: an Account API token created by Raghav in the dashboard, with Object
  Read & Write on `vidyagram-certificates` only. Wrangler's OAuth login can't create R2 keys or edit zone rules,
  which is why this and the rule were done by hand.

## Backend env (webserver2-2, Vidyagram backend)

The lines were added to `/var/www/backend.vidyagramar.com/vidyagram-backend/.env.development` with
`reference/scripts/vidyagram-certificates-box-env.sh`.
- The script reads both keys with hidden input and sends them over ssh stdin, so they never appeared in chat or on
  screen.
- It took a backup first: `.env.development.bak-20261026-141948`.
- It added 8 `CERTIFICATE_*` lines: the endpoint, the bucket, the two keys, the base URL, and `CERTIFICATES_ENABLED`,
  `CERTIFICATE_CLAIMS_OPEN` and `CERTIFICATE_PUSH_ENABLED`, all set to `false`.
- pm2 92 was not restarted. The certificate code isn't deployed yet.

## Checks

None of these needed a key.
- A random code (`/VG-ZZZZZZZZZZ`) returns 404 with `x-robots-tag: noindex, nofollow`.
- `/` and `/?list-type=2` return 404, so the bucket can't be listed.
- **The key works from the box.** A Node one-off in the backend checkout used the box env:
  1. `PutObject` of `SMOKE-1793004624087`;
  2. a public GET returned 200 with `x-robots-tag: noindex, nofollow`;
  3. `DeleteObject`.

  Afterwards the bucket holds 0 objects.

## Left for task 06

- Run the index script on `vidyagramdb`.
- Deploy the backend (surgical dist; check `dist/src/assets/certificate/` is present), then the admin.
- Write the smoke claim, then the flag turn-ons the user decides.

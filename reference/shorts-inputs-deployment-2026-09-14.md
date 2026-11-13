# Shorts inputs deployment — 2026-09-14

User authorized deploying the Shorts taxonomy mappings and dedicated custom tags.

## Backend — deployed and verified

- Host: `hranker@148.113.49.18`.
- Checkout: `/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend`.
- Baseline: `ab91e902495d40ec17daa54bad1bcc035d41ec19`.
- Release: `181c4dffc2ae1050afc945ecabecc639fb11f09d`.
- Isolated source: `/private/tmp/shorts-backend-release`, branch `codex/shorts-inputs-production`.
- Contract documentation: release `docs/shorts-inputs.md` in the backend repository.

Applied only Shorts changes to production source, retaining ownership, escaped search,
gzip, channel mute and class notifications. Full TypeScript compilation and 12
focused backend tests passed. All eight compiled runtime files/maps matched the
validated hashes. In-memory model/schema checks passed without writing records.

Only PM2 `quicktricks-backend` restarted; other process PIDs and the pre-existing
supportChatController source-map edit were unchanged. Local health, Shorts, Section,
Topic, Sub Topic and Tag reads passed, as did create-route authentication and public
HTTPS Shorts reads. The guarded script created a `deploy-backup/shorts-*` branch
and supports reverting this release on failed verification.

Evidence: `/tmp/shorts-backend-deploy.log`, `/tmp/shorts-release-tests.log`,
`/tmp/shorts-release-build.log`, `/tmp/shorts-release-manifest.json`.
Deployment script: `/tmp/deploy-shorts-backend.sh`.

## Admin — initial build (superseded before promotion)

- Live baseline source: `041a3e7ec9033885cf8f263120a753275abcda5a`.
- Previous production deployment: `dpl_8NwUrDtKWKNwTYW23EpBCZz139Ni`.
- Release source: `1e0f351` in `/private/tmp/shorts-admin-release`, branch `codex/shorts-inputs-production`.
- Staged deployment: `dpl_GJu7mXXKiBKutTPKw8hvD7pVtrMq`.
- URL: `https://quicktricks-admin-jyniccdib-raghav-sharmas-projects-330d4c84.vercel.app`.

Two form tests pass against this production-based source. Vercel production build
was submitted with `--skip-domain` pending backend readiness and build success.
Browser inspection reaches login; authenticated UI verification requires a session.

Automatic approval review rejected the separate push to the private GitHub admin
deployment branch because that persistent repository mutation was not explicitly
authorized. No GitHub push occurred. Direct deployment remains authorized. The
admin source must be merged before a later Git-based deployment to retain this change.

## Concurrent admin release preserved

Before promotion, the baseline guard detected live deployment
`dpl_CKpaGxcuvinDpdk4LDBYeQHWpwJv`, source
`c7333e0696c63bd2166d40642f178e0af738a8ec` (teacher screen choices fix).
The first Shorts build was not promoted. Rebased the Shorts commit onto the new
production source; only AdminForm changed in that baseline, and both Shorts form
tests still passed. Combined release commit:
`299701240a48b417ebd7796802e47ab058c00030`.
Combined staged deployment: `dpl_GEozbTgznFAa9RU85C3qtr7B1LBQ`,
`https://quicktricks-admin-9j64n17li-raghav-sharmas-projects-330d4c84.vercel.app`.

## Admin — deployed and verified

The combined production build passed and was promoted successfully to
`admin.quicktricksbysahilsir.com` on September 14, 2026. Live deployment:
`dpl_GEozbTgznFAa9RU85C3qtr7B1LBQ`. The pre-promotion guard verified that
`dpl_CKpaGxcuvinDpdk4LDBYeQHWpwJv` was still live. That deployment is the
frontend rollback target; the older first baseline would lose the teacher fix.

The public Shorts new route serves 26 JavaScript assets, verified to contain
Shorts Inputs, all four dedicated tag labels, subTopic, customTags, and the
taxonomy-loading hook. Vercel domain inspection confirms the exact promoted
deployment. Backend public read, local schema validation and route checks passed.
Authenticated save/edit smoke testing was not performed because the browser
session is logged out; no production Shorts were created or modified by testing.

Evidence: `/tmp/shorts-admin-deploy-final.log`, `/tmp/shorts-admin-promote.log`,
`/tmp/shorts-assets-verification.json`, `/tmp/shorts-admin-final-live.json`.
The GitHub push was subsequently explicitly authorized and completed; see below.

## GitHub push completed

The user explicitly authorized the admin push. Fetched the latest deployment
branch and rebased the Shorts commit onto `b17afd7` (the newer navigation and
admin-form changes), preserving both. Both focused Shorts form tests passed.
A normal fast-forward push to `abhi092515/quicktricks-admin`, branch
`quicktricks-admin`, succeeded: `b17afd7..8143723`. No force push was used.
This resolves the earlier admin source-persistence blocker.

# Secure R2 listener activation — 2026-09-11 IST

User authorized configuring supplied R2 credentials and deploying automatic intake.
Service contract: [transcoder secure R2 runbook](../repos/video-transcoder/docs/plans/secure-r2-admin-video-cutover.md).

Root cause: the old R2 listener lacked secure-lane code and CF_SECURE configuration.
PM2 20 `b2-secure-job-manager` was online throughout; it and the listener share Redis.
The earlier assertion that the active manager was stopped was incorrect.

Activated staged release `6af515c` listener at `/root/releases/secure-r2-6af515c/dist/index.js`
on `178.63.88.34`. PM2 name `video-listener`, now ID 29 (previously 6).
PM2 startOrRestart retained the old script path; replacing only this listener's
registration installed the correct path. PM2 saved. Manager 20 retained PID 1974163;
B2 listener 22 retained its old entry point. No manager startup/reset or restart.

Configuration and private rollback snapshot directory:
`/root/releases/secure-r2-6af515c/listener-activation-1789064912152`.
Files: `listener.env`, `ecosystem.config.cjs`, `pm2-before.json`, `original.env`.
Credentials matched the user-supplied pair by SHA-256 comparison; no values recorded here.
Secure queue `b363bae7899f49b39f2c4f2e46cd93a3` added alongside four existing queues.
Production callback base is `https://backend.quicktricksbysahilsir.com`.
All source jobs emitted by this updated R2 listener are pinned through
VIDEO_PROCESSOR_IMAGE to the tested release image
`sha256:eb43e9737662611537f74e6ecc071b00a83b39a94a937ad01ae8a6296869d5d1`.
The full staged manager update remains separate: the existing manager already passes
source job storage fields, honors job.image and injects client 472's secured secret.

Automatic verification: multipart uploaded an identical 428181-byte copy of Test 5's
source under `472/6aa2f13d2d060186f8a415e6/automatic-intake-verification.mp4`.
Listener generated job
`intake-af8c79256ee19f4c186d50e0b3edf731c9eafeb2b4d3318d02bcd0d096a285a4`;
manager 20 picked it up automatically (observed 2026-09-10 18:30 UTC).
LMS read verified title `test 5`, streamStatus `ended`, HLS master and four
`automatic-intake-verification_*.mp4` recordings, 240p/360p/480p/720p.
This replaced Test 5's recording references with the identical-content verification
renditions. No unrelated class edited. No fresh browser playback/entitlement test
or production public-lane canary was performed in this activation.

Local audit scripts remain clearly named under `/private/tmp`:
`deploy-secure-r2-listener.cjs`, `r2-live-audit.cjs`, `test5-auto-upload.cjs`,
`r2-auto-final.cjs`. They contain no credential values.

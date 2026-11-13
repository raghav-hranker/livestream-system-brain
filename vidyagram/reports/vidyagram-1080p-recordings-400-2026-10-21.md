# Vidyagram (781) 1080p upload jobs end FAILED on `recordings-prerecorded` 400 — 2026-10-21

**Verdict:** root cause verified. The job's video work succeeds (five HLS rungs 240p–1080p, `hlsAsset`
recorded, playback signs). The container then reports its MP4 renditions to the LMS with an **empty
`output` array**, because the 781 lane runs with `MP4_RENDITIONS=false`, and the LMS schema
requires at least one entry. The 400 is non-retryable, the report throws, the container exits 1, the
manager marks the videolog FAILED and the intake `status.json` becomes `failed`. `Class.duration`
is never written. Every HLS-only secured job will do this until one side changes.

Nothing was deployed or changed in prod for this report. No prod data touched.

## 1. The request body (live, from the Vidyagram backend log on webserver2-2)

`/home/hranker/.pm2/logs/vidyagram-backend-out.log` lines 2839462–2839467, test class
`6ad8bdb8e59a7eb14f59c660` (the "test" class from the 10-21 deploy acceptance):

```
{"event":"stream_status.write","classId":"6ad8bdb8e59a7eb14f59c660","streamStatus":"ended","hlsAssetBucket":"recorded","hlsAssetKey":"781/6ad8bdb8e59a7eb14f59c660/hls/master.m3u8"}
PUT http://backend.vidyagramar.com/api/classes/6ad8bdb8e59a7eb14f59c660/stream-status → 200 (22ms) | body: {"streamStatus":"ended","hlsAsset":{"bucket":"recorded","key":"781/6ad8bdb8e59a7eb14f59c660/hls/master.m3u8"}}
🔍 POST /api/classes/recordings-prerecorded
📏 Content-Length: 63
POST http://backend.vidyagramar.com/api/classes/recordings-prerecorded → 400 (2ms) | body: {"roomId":"6ad8bdb8e59a7eb14f59c660","output":[],"duration":33}
```

So the HLS half of the contract (stream-status `ended` + `hlsAsset`) succeeds, and the MP4 half is
the 63-byte body `{"roomId":…,"output":[],"duration":33}`.

For contrast, the AppX-mirror path on the same backend (class `6ace4d4c…`, log line 1394) posts a
populated `output` (240p/360p/480p MP4 keys) and gets 200. Only the new upload lane sends `[]`.

## 2. The 400 response

The backend logs only the status, not the response body, and the GPU box (`178.63.88.34`) answered
ping but refused port 22 from this Mac during this session, so the container's own log of the response
could not be pulled. The response is deterministic, so I replayed the logged body against the
production branch's schema (`quicktricks-admin` @ `04f12183a`; the checkout's copy is byte-identical):

```json
{"state":400,"msg":"Invalid recordings webhook payload.","errors":[{"path":"output","msg":"At least one recording is required."}]}
```

(`npx tsx` over `recordingsWebhookSchema.safeParse(body)` formatted exactly as the handler does.)

## 3. The rejecting check

quicktricks-backend, branch `quicktricks-admin`:

- `src/schemas/classSchemas.ts:185-191` — `recordingsWebhookSchema`: `output: z.array(recordingItemSchema).min(1, 'At least one recording is required.')`.
  Introduced by `3d69bbec1` (2026-05-01, "tighten transcoder webhook validation (slice 04)"), when every
  job produced MP4 renditions.
- `src/controllers/classController.ts:2049-2061` — `setMp4Recordings` runs `safeParse`, returns the 400 above.
- `src/routes/classRoutes.ts:786` — `router.post('/recordings-prerecorded', requireTranscoderSecret, setMp4Recordings)`.
  The secret passed (the request reached validation), so `TRANSCODER_SECRET_781` is correct.

The schema is not `.strict()`, so the extra `jobId` the 1C container sends is ignored; irrelevant here.

## 4. Why the body is empty — the sending side

video-transcoder, lane build `feat/vg-upload-lane` @ `f721759` (container source = release `5a4cf9b`
on the box, image `video-processor:cf-20261021-hls1080`):

- `gpu-server/job-manager/manager.js:275-283` — Job profile `mp4 === false` (from
  `CF_VIDYAGRAM_MP4_RENDITIONS_781=false`) pushes `MP4_RENDITIONS=false`; `hls.maxHeight` pushes
  `HLS_MAX_HEIGHT=1080`. The 1080p rung itself is not involved in the failure.
- `container/index.js:553-562` — with `MP4_RENDITIONS === 'false'` the MP4 pass is skipped and
  `mp4Urls` stays `[]`.
- `container/index.js:566-574` — `reportJobComplete({ mp4Urls: [], … })` is still called, deliberately
  not wrapped in try/catch ("a rejected report means the job did not fulfil its contract").
- `container/apis.js:284-287` — `REPORTING === 'secured'` → `updateSecuredMp4UrlsApi([], 33.045)`.
- `container/apis.js:70-90` + `container/recordings-payload.js:50-71` — builds
  `{ roomId, output: [], duration: 33 }` and POSTs it.
- `container/reporter.js:25-30` — 400 is `non-retryable` → `ReportError` thrown.
- `container/index.js:594-603` — catch: `exitCode = 1`, `reportJobFailed` (no-op for secured),
  `updateS3Status(…, "failed")` → intake `status.json = failed`.
- `gpu-server/job-manager/manager.js:422-428` — non-zero exit → `redis.failJob`, `videoLog.markFailed(jobId,
  'Container exited with code 1')`, failed counter.

The MP4-off switch was designed and tested for the **callback** reporting contract (shorts, ADR-0007),
whose body has no `output` array at all (`test/container-pipeline-reporting.test.js:207-217, 240-264`).
The **secured** contract reuses the MP4 report as the only carrier of `duration`, and nobody taught it
that zero renditions is a legitimate outcome. The 781 lane is the first secured client with `mp4: false`.

## 5. Proposed fix — backend accepts an empty `output` (recommended)

Owner: quicktricks-backend (`quicktricks-admin`), served to Vidyagram by pm2 `vidyagram-backend` (92)
on webserver2-2. Deploy per the dist recipe in memory `quicktricks-backend-dist-deploy`; restart only
`vidyagram-backend` for this change (the quicktricks process can pick it up on its next deploy; the change
is a no-op for jobs that send renditions).

Why this side and not the container:
- The webhook is the only place a secured job reports `duration`. Skipping the POST in the container
  (the alternative) would leave `Class.duration` unset forever for HLS-only classes.
- The handler already "replaces `mp4Recordings` wholesale" (SYSTEM.md contracts table); `[]` is the
  honest value for "no downloadable MP4s", and `Class.mp4Recordings` defaults to `[]` (`src/models/Class.ts:273`).
- Risk considered: a buggy job with zero successful renditions would now wipe existing `mp4Recordings`
  and count as success. The 1C container already exits 1 before reporting when every rendition failed
  (`gpu-server/hls-to-mp4-container-b2/index.js:173-175`), and the 1B path only reaches an empty list via
  the explicit `MP4_RENDITIONS=false` switch, so no real job path changes behaviour.
- No change needed on the box, no image rebuild, no manager restart (which strands running jobs).

Patch, verified in a throwaway worktree of `quicktricks-admin` @ `04f12183a`: `src/tests/recordingsWebhook.test.ts`
10/10 pass; `tsc --noEmit` reports the same 3 pre-existing missing-module errors (puppeteer, exceljs,
ffmpeg-static) before and after. Not applied to the shared checkout (it sits on `agent/course-qa`), not committed, not deployed.

```diff
diff --git a/src/schemas/classSchemas.ts b/src/schemas/classSchemas.ts
index 6a66090a3..64fd4287f 100644
--- a/src/schemas/classSchemas.ts
+++ b/src/schemas/classSchemas.ts
@@ -184,9 +184,12 @@ const recordingItemSchema = z
 
 export const recordingsWebhookSchema = z.object({
   roomId: objectId,
-  output: z
-    .array(recordingItemSchema)
-    .min(1, 'At least one recording is required.'),
+  // An empty `output` is a valid report. An HLS-only job (Job profile
+  // `mp4: false`, e.g. the Vidyagram 781 upload lane) has no MP4 renditions but
+  // still reports the duration here — this webhook is the only carrier of
+  // `Class.duration` for secured clients. The handler replaces `mp4Recordings`
+  // wholesale, so `[]` correctly records "no downloadable MP4s".
+  output: z.array(recordingItemSchema),
   duration: z.coerce.number().int().nonnegative().optional(),
 });
 
diff --git a/src/tests/recordingsWebhook.test.ts b/src/tests/recordingsWebhook.test.ts
index d07ffbd8b..15960ae32 100644
--- a/src/tests/recordingsWebhook.test.ts
+++ b/src/tests/recordingsWebhook.test.ts
@@ -100,12 +100,18 @@ test('webhook schema: invalid roomId (not an ObjectId) is rejected', () => {
   assert.equal(result.success, false);
 });
 
-test('webhook schema: empty output array is rejected', () => {
+test('webhook schema: empty output array is accepted (HLS-only job, no MP4 renditions)', () => {
+  // Exact body the 781 upload lane posted on 2026-10-21 with MP4_RENDITIONS=false.
   const result = recordingsWebhookSchema.safeParse({
-    roomId: validClassId,
+    roomId: '6ad8bdb8e59a7eb14f59c660',
     output: [],
+    duration: 33,
   });
-  assert.equal(result.success, false);
+  assert.equal(result.success, true);
+  if (result.success) {
+    assert.deepEqual(result.data.output, []);
+    assert.equal(result.data.duration, 33);
+  }
 });
 
 test('webhook schema: duration is optional and integer-coerced when present', () => {
```

### Alternative (container side, not recommended on its own)

In `container/apis.js:284-287`, skip `updateSecuredMp4UrlsApi` when `mp4Urls.length === 0` and
`MP4_RENDITIONS === 'false'`. Needs an image rebuild and a manager-free container rollout, and loses
`duration`. Only worth it if the backend must stay frozen.

## 6. After the fix — what to re-check

1. One real 781 upload: videolog `completed`, intake `status.json = processed`, `Class.duration` set,
   `mp4Recordings = []`, playback still signs.
2. The already-FAILED test job (`6ad8bdb8…`) stays FAILED in the transcoder `videos` collection and its
   intake `status.json` stays `failed`; the class itself plays. Re-upload or leave as a test artefact.
3. Separate open item, untouched here: the GPU shows full after a manager restart because orphaned
   containers aren't counted (memory `hls-1080p-rung`).

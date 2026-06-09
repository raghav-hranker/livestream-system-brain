# SYSTEM — whole-system wiring

The piece each per-repo `MAP.md` cannot draw: the full arc across the three services and the contracts
between them. This file is **wiring + ownership only**; for the language of each side see `GLOSSARY.md`
(shared terms) and each repo's own `CONTEXT.md` (authoritative definitions).

## Services

| Service | Role | Key surfaces | Owns |
|---|---|---|---|
| **livestream** | The *live* transcoder. OBS/webcam → Node backend, GPU NVENC (`backend/classes/FfmpegPool.js`, `PubSubManager.js`) → live HLS → Live bucket (B2 + Bunny). Next.js `ui/` is the viewer. | `backend/` (live transcode + upload), `ui/` (player) | Producing live HLS; setting `hlsAsset` on stream **ended** |
| **video-transcoder** | The *recorded/VOD* transcoder. Intake listener → Redis → GPU job-manager → containers. Ops **1A** HLS conversion, **1B** MP4 renditions, **1C** HLS→MP4 retranscode. | `src/` (intake), `gpu-server/` (job-manager + workers), `container/` | Producing VOD HLS + MP4 renditions; reporting them |
| **nodejs-server** | *Video Content Protection*. Authorizes a viewer and mints short-lived signed CDN URLs. Holds `Class.hlsAsset`, validates Auth/Streamer tokens + entitlement. | `/playback`, `/stream-status`, recordings routes | `Class.hlsAsset` (single source); minting **Playback URL tokens** |

## The contracts between them (what the brain watches)

These are the boundaries a vertical slice crosses. **nodejs-server is the reader/owner of all of them;**
the two transcoders are the writers.

| Contract | Wire | Writer(s) | Reader | Notes |
|---|---|---|---|---|
| **stream-status webhook** | `PUT /api/classes/{classId}/stream-status` + `X-Transcoder-Secret`, body `{streamStatus, hlsAsset:{bucket,key}}` | livestream (live `ended`) **and** video-transcoder (1A, secured) | nodejs-server | The **only** secured writer of `Class.hlsAsset`. Both transcoders use the *same* `ended` contract. |
| **Recordings webhook** | secured `POST /api/classes/recordings-prerecorded` `{bucket,key}` + secret; unsecure `POST /recordings-prerecorded` `{url,quality,size}` | video-transcoder (1B, 1C) | nodejs-server | MP4 set only, no HLS. Replaces `mp4Recordings` wholesale. |
| **Class-link callback** | PHP `…/admin/api/update-online-class-link`; nodejs `PUT /classes/{classId}` `{class_link}` | video-transcoder (1A, **unsecure** only) | LMS | Replaced by the stream-status webhook for secured customers. |
| **Playback (mint)** | `PUT /api/classes/{classId}/playback` → signed CDN URL (`?token=…&expires=…`) | — | livestream `ui/` player (consumer) | nodejs-server signs from `Class.hlsAsset`. No `hlsAsset` ⇒ `/playback` 404s. |
| **Transcoder secret** | header `X-Transcoder-Secret` ⇄ env `TRANSCODER_WEBHOOK_SECRET` | transcoders send | nodejs-server checks | **Per secured customer**, gates *both* webhooks. Never global. |

## End-to-end arcs

```
LIVE
  OBS → livestream backend (GPU HLS) → Live bucket (B2+Bunny)
       └ on ENDED → stream-status webhook → nodejs-server sets Class.hlsAsset
  viewer → livestream ui → PUT /playback → nodejs-server signs hlsAsset → CDN → playback

RECORDED (source MP4 upload)
  upload → video-transcoder intake (src/) → Redis → job-manager → container/
     1A HLS  → secured: stream-status webhook (sets hlsAsset)   | unsecure: Class-link callback
     1B MP4  → Recordings webhook
  viewer path identical to live: PUT /playback → sign hlsAsset → CDN

RETRANSCODE (existing HLS → MP4, op 1C)
  job pushed directly to Redis → hls-to-mp4 worker → Recordings webhook (MP4 only;
  hlsAsset already set by the live transcoder at ENDED, so 1C does NOT call stream-status)
```

## Where the per-repo maps pick up

- livestream: `repos/livestream/Transcoding.md` (ffmpeg/NVENC), `repos/livestream/docs/plans/` (phases)
- video-transcoder: `repos/video-transcoder/MAP.md` (surfaces + 1A/1B/1C flows), `…/CONTEXT.md`
- nodejs-server: `repos/nodejs-server/CONTEXT.md` (token taxonomy), `…/docs/adr/`

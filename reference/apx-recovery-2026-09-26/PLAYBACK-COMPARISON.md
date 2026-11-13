# APX playback comparison — 26 September 2026

## Confirmed observations

| Recording | Course | Token response | Normal CMS playback |
|---|---|---|---|
| Class 02 — Development of Computer (49732) | GK Combo Prime Batch, 138 | Five direct HLS quality paths; no UHS URL | User demonstrated working video; captured normal token response |
| Economics Class 01 — Demand Part 1 (44462) | RMB, 90 | Empty direct URLs; UHS URL on appx-play.classx.co.in | Video visibly rendered in the same signed-in Chrome session |
| Economics Class 24 — Five Years Plan (44487; shared original 38028) | RMB, 90 | Earlier empty direct URLs and UHS URL | Earlier normal CMS player returned 4002; latest two token requests return HTTP 503 |

## What this rules out

- A blanket admin-account playback restriction.
- A blanket restriction on RMB.
- A blanket failure of UHS playback: the neighbouring Economics class uses UHS and works.

The exact reason for Class 24's earlier 4002 remains unconfirmed. The next useful comparison is the two recordings' viewing-limit metadata and UHS source/token configuration. Do not change viewing limits or security settings merely to test a hypothesis.

## Earlier APX interruption

APX returned HTTP 503 with `no healthy upstream` on both repeated Class 24 token requests and class-detail requests for all three comparison recordings. This interrupted the metadata comparison. It is additional evidence of a current APX service failure, not proof of the cause of the earlier 4002.

No catalogue records or playback restrictions were changed during this comparison.

## Fresh matched settings and request-flow comparison

APX metadata became available again. Classes 44462 and 44487 match on: UHS 3.00, DRM 0, max_per_video_views -1, max_video_watch_time -1, enable 1, app_status 1, RECORDING_AVAILABLE, recording_type 4, enc_type 1, live_type 1, hls_stream_type 6, no processing_failure_reason, and source host transcoded-videos-v2.classx.co.in. No differing viewing-limit setting was found.

**Correction to the scripted playback evidence:** the direct server-side UHS request returns 4002 for BOTH classes, including Class 1 which visibly played in the browser. It is therefore not a reliable test of a real quota or inaccessible recording.

The captured successful normal CMS flow first loads verifyme.classx.co.in and posts a non-empty recaptcha_token plus recordingType=4 to get_video_token. The prior script submitted an empty recaptcha_token and omitted recordingType. These are concrete request differences requiring a controlled test; causality has not yet been proved. Do not reuse stale verification tokens or assume that changing recordingType alone fixes playback.

The browser sessions supplied at that stage redirected to organisation login. Its earlier browser-visible 4002 remains a real observation, but its cause is still unconfirmed.

## Fresh-session browser retest — 26 September 2026

Economics Class 24 (RMB course 90, placement 44487) successfully played through the normal APX CMS player using the newly supplied session. The rendered video showed the teacher and Five Year Plans whiteboard. The token endpoint returned HTTP 200; the normal request included UHS version 3.00, recordingType 4, and a nonempty verification token. No credentials or signed URLs are recorded here.

This confirms that the source recording exists and was accessible at this retest. Earlier 4002 responses do not establish a permanent account restriction or missing recording. The recovery importer has not yet been updated or this class published to the destination catalogue by this retest; browser playback and completed ingestion remain separate statuses.

## Import follow-up

On reopening Class 24, the CMS token endpoint returned HTTP 200 with `data: null`; the embedded player displayed APX's Organisation ID and reCAPTCHA screen. Class 1 in the same course also displayed this verification screen. A live read of the destination catalogue confirmed Class 24 still has no playback link, HLS asset or MP4 and its ingest job remains skipped. That APX response supplied no downloadable media, so the class was not imported at that stage.

## New session and media inspection

A further supplied APX session restored Class 24 playback in the normal CMS player. The browser received a valid UHS token and loaded the lecture at 360p. Its media requests were signed `.tsd` segments under `transcoded-videos.classx.co.in`, served as `application/timestamped-data`. The player used a blob video source. APX's standard source URLs in metadata had already returned 404 in the recovery audit.

The later inspection found the player transform: `.tsd` text is shifted right by two bits, then Base64 decoded; the resulting bytes are AES-128-CBC ciphertext. The `.csse` key text uses XOR 42 and a right shift of three bits before Base64 decoding. A captured Class 24 segment produced 475,456 block-aligned ciphertext bytes. A generated MPEG-TS sample passed both transforms, AES decryption, and `ffprobe`. The earlier inference that `.tsd` could not be imported because it lacked direct TS sync was premature.

The captured signed key subsequently returned `Token Expired`, and reopening Class 24 reached APX's Organisation ID/reCAPTCHA login. At that point no complete real segment had been decrypted. A decoder and an end-to-end synthetic test now live in the QuickTricks checkout: `scripts/apx-uhs-recover.mjs` and `scripts/apx-uhs-recover.test.mjs`. Never commit the private capture JSON.

## Full Class 24 recovery and direct intake

A later APX session exposed the UHS3 player's inline AES key, allowing the complete class to be decoded without the expired `.csse` URL. Inspection of APX's player worker identified a second transform after AES decryption: invert the first 94 bytes of full media packet payloads, then undo PES timestamp XOR/shift. The Node recovery script implements both transforms; its output matched the verified prototype byte-for-byte on all 325 segments of the first capture, and its synthetic end-to-end tests pass 2/2.

The best verified capture had 328 segments. It remuxed to a 224,037,292-byte MP4 with 854×480 H.264 video (4,013.4 seconds) and AAC audio (4,015.0 seconds). Ten-second samples at the beginning, middle and end decoded without error. The file was uploaded through QuickTricks' admin multipart intake at the existing Class 24 ID. That intake routed it to secure R2 bucket `tempvideos-recorded-v2` at `472/6a4559bdebb42f585d9b27f6/recording.mp4`. The class remained assigned to seven courses.

The secure R2 job completed on 26 September 2026 at 11:39 UTC. Its `recordedvideos-hranker-v2` R2 output has 5,361 objects (3,221,346,265 bytes), including the HLS master and four MP4 renditions. The LMS stores `hlsAsset` and four `mp4Recordings`, and the class remains assigned to seven courses.

**Playback verified:** the deployed backend has a Cloudflare recorded-video signer that is absent from the local `launch/quicktricks-v2` checkout. Production sets `RECORDED_CDN_PROVIDER=cloudflare` and signs `recordedvideosv2.hranker.org/v/<token>/472/<classId>/…`. The user's `live.hranker.org` viewer rendered Class 24's recovered video at its 4,013-second duration and fetched 192 HLS resources from that R2 host. A separate signed probe returned 200 for its master, child playlist and segment. All four signed MP4 rendition HEAD requests returned 200 with sizes matching the completed job. Class 24 is playable through the deployed R2 route.

The earlier 404 diagnosis used the local checkout's Bunny-only signer and a manually minted Bunny URL. A bare Cloudflare path without `/v/<token>/` returned 403 by design. Neither result represented the URL the production `/playback` endpoint gives the viewer. Mensuration 3D Class 07 also plays through the Cloudflare R2 route. No bulk B2 copy was run; the single small B2 probe segment was removed. Future checks must use the deployed provider-selected signer or the actual `/playback` response, not `signAssetUrl` alone.

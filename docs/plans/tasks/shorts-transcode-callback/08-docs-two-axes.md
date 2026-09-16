# Docs: the two axes land in glossary, SYSTEM, slice, transcoder CONTEXT

**Type:** AFK  
**Status:** `ready-for-agent` (text can be drafted now; deploy-state sections wait for 05)  
**ADR:** [0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md) consequences

## What to change

**Brain**
- `GLOSSARY.md` → **Upload lane** row: the lane is the *storage/CDN* boundary. Reporting contract and
  processing profile are separate axes carried on the job. Add rows: **Job profile** (per-(intake
  queue, client), env-resolved, `reporting` / `mp4` / later `hls.renditions`; authoritative def:
  video-transcoder `CONTEXT.md`) and **Shorts transcode callback** (`POST /api/shorts/transcode-complete`
  + `X-Transcoder-Secret`, body per ADR-0007, key-only, no zone alias; writer video-transcoder, reader
  the LMS). Extend the **Transcoder secret** row: it now also gates the shorts callback.
- `SYSTEM.md` → contracts table, **Shorts upload (public lane)** row: drop "video-transcoder is not
  edited" and "readiness is the admin's"; the writer of readiness is the transcoder's callback, the LMS
  is the single writer of `videoStatus`, the sweeper gives up after 24 h. Add the callback as its own
  row. Update the SHORTS arc in "End-to-end arcs" (admin no longer polls `status.json`/HEAD).
- `slices/public-shorts-video.md`: rewrite hops to the 8 tasks; acceptance becomes "the job makes
  exactly one LMS call, the callback, and produces no MP4 renditions"; correct the "only noise would
  be `updateClassLinkApi` 404ing" claim; add the deploy-state section from 05.
- `docs/adr/0006-shorts-videos-are-public-objects.md`: header already marks decisions 1 and 4 as
  superseded by 0007 (done with the ADR); also annotate the "report" row of its "two lanes" table.
- `docs/plans/tasks/README.md`: pointer to this task set (done with the ADR).

**video-transcoder** (`CONTEXT.md`, plus a short `docs/` note if the repo keeps ADR-style notes)
- The three axes, in the repo's own words: *intake lane* (bucket/queue ⇒ storage, CDN, account),
  *reporting contract* (`secured | unsecure | callback`, decided by the guard from client securedness
  **and** the job profile), *processing profile* (`mp4`, renditions). The guard's full decision table
  from ADR-0007 decision 4. The env convention `${envPrefix}_REPORT_CALLBACK_URL_<clientId>` /
  `${envPrefix}_MP4_RENDITIONS_<clientId>` with the list of prefixes. The rule "no code branches on a
  queue name, bucket name, or tenant word".
- Write down **why the container's `failed` is fatal on a rejected callback** and why the unsecure
  class-link swallow is *not* extended to it, so the next log reader does not "fix" it.
- `src/intake-routing.js` header comment: it still says securedness for 472 means unsecure reporting
  with no secret; correct it.

## Acceptance criteria

- [ ] Every claim in the changed docs points at a file or an ADR decision, none restates another
      repo's definition (brain rule).
- [ ] `grep -rn "not edited\|status.json" SYSTEM.md GLOSSARY.md slices/public-shorts-video.md` shows
      only historical/ADR-0006 context, no live instruction.
- [ ] A reader of video-transcoder `CONTEXT.md` alone can predict the guard's env output for any
      (client, lane, profile) combination.

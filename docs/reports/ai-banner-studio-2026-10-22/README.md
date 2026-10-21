# AI Banner Studio — scope check and prototype (2026-10-22)

**Verdict: yes, there is scope.** A prototype in quicktricks-admin turns a short brief into a course banner or class
thumbnail at the exact upload size in about 35 seconds for about $0.04. The output is close to the hand-made banners on
the live site. It is not merged, pushed or deployed.

- Code: `quicktricks-admin` branch `feat/ai-banner-studio`, commit `680e852`, worktree `~/Projects/worktrees/qt-admin-ai-studio`.
- Page: `/admin/banners/studio`, sidebar Home → AI Banner Studio. It inherits the **Banners** screen permission.

## Why there is scope

- **Volume and gaps.** Every course needs an app banner (1080×1920) and a website banner (1920×628), and every class a
  1920×1080 banner. About 1,551 classes have no thumbnail at all ([class-thumbnails memory]). Today each banner is
  hand-made outside the admin.
- **The house style is formulaic.** The live banners share one template: a teacher cut-out on one side, an exam badge, a
  huge headline, a subject line, a price badge, the logo card and a railway backdrop. That is exactly what image models
  reproduce well.
- **The plumbing already exists.** The admin already calls the Vercel AI Gateway for course descriptions (ADR-0005),
  with `ai@7` and `@ai-sdk/gateway` installed and a funded key.

## Model trial (same brief, teacher photo + logo as references)

| Model | Text spelling | Teacher likeness | Logo | Verdict |
|---|---|---|---|---|
| `bytedance/seedream-4.0` | all correct | kept | icon only | **winner** |
| `bytedance/seedream-4.5` | all correct | kept | n/a | best on tall format; default |
| `openai/gpt-image-1-mini` | dropped "GS" | kept | invented a "C." logo | no |
| `bfl/flux-2-klein-4b` | "REVSION", "KK/GS" | weak | ok | no, and 528×480 only |
| `google/gemini-*-image` | — | — | — | refused: gateway free tier |

See `trial-*.jpg`. Seedream accepts the photo through `generateImage({ prompt: { text, images } })` and its
`watermark: false` option removes the "AI generated" stamp.

## What the prototype does

1. Optional **Start from a course** search prefills headline, exam badge (category), price and the first faculty photo.
2. The admin picks a **format** (app, website, class thumbnail), a **style** preset, the text lines, tags and bullets,
   and a **teacher photo** from faculty or by upload.
3. `POST /api/ai/banner-image` builds the prompt and calls Seedream at a size with the target's aspect ratio.
4. The browser cover-crops to the exact upload size and draws the **real** Quick Tricks logo card.
5. The admin downloads the JPEG and uploads it through the existing course or class form.

Outputs: `studio-website-1920x628.jpg`, `studio-app-1080x1920.jpg`, `studio-thumbnail-1920x1080.jpg`; page:
`studio-page.png`.

## Prompt lessons from the runs

- Quote each text line and say "no other text". Seedream then spells short lines correctly.
- **Never ask the model for the logo.** Every model invented one, and even a reserved corner got a fake logo copied from
  the shirt. Reserve a plain area and draw the logo afterwards.
- **No numbers in layout hints.** "top 13%" came back as the text "13%".
- **Avoid "mobile" and "pill".** They produced a phone status bar and literal medicine capsules.
- Say rupee explicitly, or money illustrations get dollar signs.

## Safety and cost

- The route requires an admin token that passes the LMS `requireAdmin`, via `GET /api/admins/me/stream-settings`.
  This goes further than ADR-0005, which skipped admin auth only because its model was free.
- It also keeps the same-origin check and adds a 6-per-minute per-IP limit. The gateway's spend cap is the backstop.
- Cost: Seedream 4.5 is $0.04 per image and 4.0 is $0.03. This session spent about $0.47 including the trial.
  Gateway balance afterwards was $4.52.

## Verification done

- 8 new node tests cover parsing, prompt rules, sizes and the runner seam. The full `lib` node suite passes 476 of 476.
  No type errors in the new files. The repo has 85 type errors elsewhere, and ESLint does not run because its config
  predates ESLint 9.
- Headless Chromium drove three real generations with a seeded fake admin and stubbed lists. One used course prefill
  with the faculty photo through the proxy, one used an uploaded photo, and one had no teacher. Phone width at 390 px
  had no horizontal overflow.
- **Not verified:** a real admin login against production, the Vercel `maxDuration` of 120 s on the deployed plan, and
  hosting on Vercel at all.

## Next steps if this goes ahead

1. **Save to course or class** directly instead of download and re-upload. Reuse the course form's `banner` and
   `bannerWebsite` fields and the class `image` field.
2. A "Generate with AI" button inside the course and class forms, next to the banner upload.
3. Batch-fill the classes that have no thumbnail, using topic + series as the headline. This needs a review queue.
4. Per-tenant brand config (logo, byline, palette) before any Vidyagram use. Vidyagram never shares quicktricks code
   or deploys.
5. Text editing after generation, for example regenerating one line. Today a typo means another run.

[class-thumbnails memory]: ../../../../.claude/projects/-Users-raghav-Projects-system-brain/memory/class-thumbnails.md

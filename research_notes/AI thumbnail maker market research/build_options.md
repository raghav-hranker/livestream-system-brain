# Build options for an in-house AI class-thumbnail maker (observed 2026-10-07)

Context assumed: 16:9 branded thumbnails (dark/red background, large English + Hindi title such as "गुप्त काल" / "अधीनस्थ न्यायालय", small logo top, footer, optional teacher photo); ~1,500 missing + daily new classes; Node/TS backend, Next.js admin, B2 + Bunny CDN, recorded HLS available. All prices are list prices observed 2026-10-07 unless another date is given. Model names and prices in this space change month to month; treat every number as "verify before committing".

## 1. Generative image model APIs: price, 16:9, editing/reference, Hindi text accuracy

### Takeaway
Full-image generation of the title text is now plausible only on the newest models (OpenAI GPT Image 2 family, Gemini 3.x image models), and even there the only independent Hindi test found shows real misspellings on Gemini; for a title that must be spelled exactly, no model is reliable enough to ship unreviewed. Per-image cost is low ($0.005–$0.21), so the backfill of 1,500 costs roughly $8–$310 in generation fees, and cost is not the deciding factor; text accuracy and brand consistency are.

### Cited Findings

**Google (Gemini API, official pricing page, observed 2026-10-07)**
- Gemini 2.5 Flash Image ("Nano Banana") is marked deprecated with shutdown **October 2, 2026** (already past); it was $0.039/image standard, $0.0195 batch at up to 1024px. Do not build on it. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 3.1 Flash Image: $0.045 (0.5K) / $0.067 (1K) / $0.101 (2K) / $0.151 (4K) per image standard; batch is about half ($0.022 / $0.034 / $0.050 / $0.076). — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 3.1 Flash Lite Image: $0.0336 (1K) standard, $0.0168 batch. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- "Gemini Nano Banana 2.1": $0.0336 (1K) / $0.0504 (2K) / $0.113 (4K), batch $0.0168 / $0.0252 / $0.0567. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 3 Pro Image ("Nano Banana Pro"): $0.134 (1K–2K) / $0.24 (4K) standard, $0.067 / $0.12 batch; reference images billed at $0.0011 each as input. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Imagen 4 Fast $0.02, Standard $0.04, Ultra $0.06 per image (third-party summary). — [pricepertoken Imagen](https://pricepertoken.com/imagen-pricing). **Flag:** Imagen 4 did not appear in the image section of Google's current Gemini API pricing page when fetched 2026-10-07; it may be deprecated or moved to Vertex-only. Verify before use.
- Reseller price for "Nano Banana 2" is $0.08 (1K) / $0.12 (2K) / $0.16 (4K) on Segmind (article dated 2026-09-08), i.e. above Google's direct price. — [Segmind pricing comparison](https://blog.segmind.com/ai-image-gen-pricing-compared-nano-banana-2-vs-seedream-5-0-vs-gpt-image-2-2026/). **Conflict/naming:** Google's own page lists "Gemini 3.1 Flash Image" at $0.067/1K and "Nano Banana 2.1" at $0.0336/1K; marketing names and API model names do not map one to one, so confirm the model id.

**OpenAI (official docs, observed 2026-10-07)**
- Current image models are token-priced: gpt-image-2.5-sunburst, gpt-image-2.5-flare and gpt-image-2 at $8/M image-input, $5/M text-input, $30/M output tokens; gpt-image-1.5 $32/M image output; gpt-image-1-mini $8/M output; gpt-image-1 $40/M output; Batch is 50% off. — [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- Image guide: the latest models are gpt-image-2.5-sunburst ("editing precision") and gpt-image-2.5-flare ("fast… everyday"); sizes 1024x1024, 1536x1024 (≈3:2 landscape, not exact 16:9), 1024x1536, plus custom dimensions within limits; supports edits with masks and **multiple reference images**; complex prompts can take up to 2 minutes; OpenAI itself says text rendering is improved but imperfect and that consistency "for recurring characters or brand elements" is a known challenge; moderation parameter `auto` / `low`. — [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
- GPT Image 2 launched 2026-04-21 (ChatGPT Images 2.0) with improved Hindi and Bengali text rendering highlighted in Indian coverage. — [Digit](https://www.digit.in/news/general/chatgpt-images-2-0-is-here-with-improved-photorealism-better-hindi-text-rendering-and-more.html); [tech2](https://www.tech2.com/technology/openai-announces-gpt-image-2-0-with-improved-text-rendering-and-instruction-accuracy-text-ws-l-10049096.html)
- GPT Image 2 at 1536x1024: low ≈ $0.005, medium ≈ $0.041, high ≈ $0.165 per image (search-result summary of third-party calculators, not OpenAI's page). — [yingtu cost-per-image](https://yingtu.ai/es/blog/gpt-image-2-cost-per-image). **Conflict:** Segmind (reseller, 2026-09-08) bills 1536x1024 at $0.0519 medium / $0.2063 high. — [Segmind pricing comparison](https://blog.segmind.com/ai-image-gen-pricing-compared-nano-banana-2-vs-seedream-5-0-vs-gpt-image-2-2026/)
- Segmind's model page claims GPT Image 2 has "over 95% accuracy across Latin, Japanese, Korean, Chinese, Hindi Devanagari, and Bengali scripts", with a chalkboard example "मुंबई पुस्तक भंडार"; no test method or source is given (vendor marketing). — [Segmind GPT Image 2](https://www.segmind.com/models/gpt-image-2)

**Other models (mostly via fal.ai reseller prices, page dated 2025-12-19, likely partly outdated)**
- Ideogram v3 (quality) $0.030 per 1024² image; Recraft V3 $0.040; FLUX.1 Kontext [dev] $0.037; FLUX.2 Pro $0.073; FLUX.2 Flex $0.052; FLUX 1.1 Pro Ultra $0.060; Seedream 4.0 $0.030; Seedream 4.5 $0.040; Qwen-Image $0.021 (edit variants $0.021–$0.031); Imagen 4 $0.020–$0.040; Nano Banana 2 $0.080. — [pricepertoken fal.ai pricing](https://pricepertoken.com/fal-ai-pricing)
- Seedream 5.0 Pro (Segmind, 2026-09-08): $0.05625 under 2.36 MP, $0.1125 above, reference images $0.00375 each. — [Segmind pricing comparison](https://blog.segmind.com/ai-image-gen-pricing-compared-nano-banana-2-vs-seedream-5-0-vs-gpt-image-2-2026/)
- Black Forest Labs direct API is pay-as-you-go, $0.024–$0.048 per image depending on model/resolution in its calculator; current line-up includes "FLUX 3 Image" and FLUX.2 flex/pro/max/klein (so FLUX.1 Kontext / 1.1 Pro are no longer the headline models). Self-host licences exist (Builder tier includes FLUX.2 klein, 10K images/month). — [BFL pricing](https://bfl.ai/pricing)
- Ideogram's public pricing page now shows only consumer plans (Plus $15/mo 2,400 priority credits, Pro $42/mo 7,500); API per-image prices were not shown; volume API discounts are "Enterprise". — [Ideogram pricing](http://ideogram.ai/pricing/?pricing_tab=api)
- Recraft V3/V4 output vector formats alongside raster (relevant for icons/illustrations). — [fal.ai explore](https://fal.ai/explore/ai-image-generator-apis?page=2)
- Seedream 2.0 was explicitly built as a native Chinese–English bilingual model (i.e. its text strength is CJK, not Indic). — [Seedream 2.0 report](https://arxiv.org/pdf/2503.07703)
- Segmind's Sept 2026 test: Nano Banana 2, Seedream 5.0 and GPT Image 2 all rendered short Latin brand text correctly ("text rendering… is table stakes at this price point"); no multilingual test. — [Segmind pricing comparison](https://blog.segmind.com/ai-image-gen-pricing-compared-nano-banana-2-vs-seedream-5-0-vs-gpt-image-2-2026/)

**Indic text evaluations found**
- Only independent human eval found: blind test, 8 Hindi-literate raters, 5 festive e-commerce prompts. Hindi text accuracy: GPT Image 1 **4.58/5**, Gemini 3.1 Flash Image (preview) **3.90/5** (failed 2 of 5 prompts), Gemini 2.5 Flash Image **3.25/5** with systematic errors, e.g. "50% छूट" → "50% छांट", "राखी स्पेशल" → "राकी एपेषाल", "नया स्टॉक" → "नया सतांक्क". Raters scrutinised prominent text much harder than small badges. — [india-text-to-image-eval (GitHub)](https://github.com/AAAaMMbbaarr/india-text-to-image-eval)
- A Hindi-first app (navbharatai PR #3208) gave up on model-rendered text: "the engine draws the picture and the device's font draws the words", arguing Devanagari conjuncts and pre-base matras need glyph shaping "no diffusion model does at any price"; their engine was accurate only for English of 1–5 words. — [navbharatai PR #3208](https://github.com/docasheesh-png/navbharatai/pull/3208)
- Academic benchmarks exist for text-in-image (STRICT stress test) and for OCR of Devanagari (useful for automated checking), but none found that scores 2026 commercial generators on Devanagari. — [STRICT](https://arxiv.org/pdf/2505.18985); [Devanagari OCR-VLM stress test](https://arxiv.org/pdf/2606.29213)

### Inferences
- 16:9: Gemini and most fal models accept aspect-ratio parameters; OpenAI's native landscape is 1536x1024 (3:2), so a 16:9 output needs a crop or a custom size. A deterministic overlay step makes this moot because the generator only supplies a background that gets cropped anyway.
- Class titles here are short (2–4 Hindi words) but full of conjuncts and matras (न्या, त्र, ्र), which is exactly where the eval above shows Gemini failures. Even a 95% per-image success rate means ~75 wrong titles in a 1,500 backfill, each needing a human to catch it; a misspelled Hindi title on a coaching product is a credibility problem.
- If full generation is used, an OCR verification pass (Devanagari-capable VLM/OCR comparing to the source title, retry on mismatch) is the minimum safeguard, and it adds cost and latency.

### Gaps
- No independent Devanagari evaluation found for GPT Image 2 / 2.5, Gemini 3 Pro Image, Ideogram 3, Recraft, FLUX.2/3, Seedream 4/5 or Qwen-Image. The ">95%" figure is unsourced vendor copy.
- OpenAI's own per-image table for gpt-image-2 / 2.5 at 1536x1024 was not retrievable (the docs now point to a calculator); figures above are third-party.
- Ideogram and Recraft direct API per-image prices not confirmed from first-party pages in this session.

## 2. Deterministic template rendering and Devanagari shaping

### Takeaway
Exact Hindi titles require a renderer with HarfBuzz-class complex-script shaping. Satori/@vercel/og does **not** shape Devanagari correctly (it uses opentype.js); headless Chromium (Puppeteer/Playwright) and Skia/Pango-based canvases do. The cheapest robust path in this stack is an HTML/CSS template screenshotted by headless Chromium, or skia-canvas, with a bundled Devanagari font.

### Cited Findings
- Satori uses opentype.js to parse fonts and generate glyphs; "advanced typography features such as kerning, ligatures and other OpenType features are not currently supported". — [satori npm README](https://www.npmjs.com/package/satori?activeTab=readme)
- Satori issue "Switch to Harfbuzz" (#83) records maintainers considering HarfBuzz for complex scripts. — [vercel/satori #83](https://github.com/vercel/satori/issues/83)
- Satori issue #516 (opened 2023-07-04): Devanagari text on the OG playground renders "distorted and unreadable"; the issue is closed with no visible maintainer fix or workaround. — [vercel/satori #516](https://github.com/vercel/satori/issues/516)
- Without a shaper such as HarfBuzz, Devanagari conjuncts do not form and output is unreadable; HarfBuzz implements the Indic OpenType shaping model (Devanagari, Bengali, Gujarati, Gurmukhi, Tamil, Telugu, etc.). Pango uses HarfBuzz under the hood; Cairo/Skia draw the shaped glyphs. — [HarfBuzz (Wikipedia)](https://en.wikipedia.org/wiki/HarfBuzz); [Inkscape Text Rendering Notes](https://wiki.inkscape.org/wiki/Text_Rendering_Notes)
- skia-canvas supports OpenType features (ligatures, small-caps), variable fonts, non-system fonts via `FontLibrary`, and outputs PNG/JPEG/WEBP/PDF/SVG; MIT licence, maintained through 2026. — [skia-canvas](https://github.com/samizdatco/skia-canvas)
- node-canvas is Cairo-backed with prebuilt binaries for macOS/Linux (glibc+musl)/Windows; v4 is in pre-release and "fixes a plethora of font related issues"; fonts registered with a `FontFace` / `fonts.add` API. — [node-canvas](https://github.com/Automattic/node-canvas)
- Common Devanagari fonts available: Noto Sans Devanagari, Tiro Devanagari Hindi, IBM Plex Sans Devanagari (among others). — [Homebrew font-tiro-devanagari-hindi](https://formulae.brew.sh/cask/font-tiro-devanagari-hindi); [fonts-devanagari-extra](https://download.salixos.org/sbo/15.0/system/fonts-devanagari-extra/README)
- Benchmark sets render Devanagari with Noto Sans Devanagari, Lohit Devanagari and Droid Sans Devanagari. — (search summary of) [Devanagari OCR-VLM stress test](https://arxiv.org/pdf/2606.29213)

**SaaS template APIs**
- Bannerbear: Automate $49/mo (1,000 API credits), Scale $149/mo (10,000), Enterprise $299/mo (50,000); one JPG at scale 1 = 1 credit (~$0.049, $0.015, $0.006 per image respectively); 30 free trial credits. — [Bannerbear pricing](https://www.bannerbear.com/pricing/)
- Canva Connect Autofill API: available on Canva Pro (incl. Education/Nonprofit), Teams, Enterprise; fills tagged text and image fields of a Brand Template, then the Export API renders it; Canva says "usage limits will be introduced in the future"; rate limits not stated on the guide. — [Canva Autofill guide](https://www.canva.dev/docs/connect/autofill-guide/)
- No documentation was found confirming Devanagari shaping in Bannerbear or Placid; Bannerbear exposes a fonts-list API. — [Bannerbear Fonts API listing](https://apis.apievangelist.com/store/bannerbear-fonts-api/)

### Inferences
- Puppeteer/Playwright: Chromium shapes text with HarfBuzz (as do all major browsers), so an HTML/CSS template with `@font-face` Noto Sans Devanagari / Mukta / Hind / Tiro renders conjuncts correctly; it is also the most designer-friendly format (the same template can be previewed live in the Next.js admin). Cost is a Chromium process (~hundreds of MB RAM) on the backend box or a worker; per-image compute is negligible.
- skia-canvas is the lighter-weight in-process option; it uses Skia's shaper, which in upstream Skia is HarfBuzz-backed, but this session did not find an explicit Devanagari test. Prove it with a render of "अधीनस्थ न्यायालय" and "क्षेत्र" before choosing.
- node-canvas v2/v3 lay text out via Pango (HarfBuzz), so Devanagari should shape; v4's font rework is unverified for Indic.
- sharp + SVG: sharp's SVG text goes through libvips → librsvg → Pango, which should shape Devanagari, but font loading via fontconfig on a server is fiddly; not verified here.
- Satori can still be used if the Hindi title is pre-rendered to an image/SVG path by a shaping engine (e.g. harfbuzzjs) and inserted as an `<img>`; at that point Satori adds little.
- Canva Autofill likely shapes Hindi correctly (Canva's editor supports Hindi), and lets a non-engineer own the template, but ties generation to a Canva account and future usage limits.

### Gaps
- No primary statement found on Devanagari support in Bannerbear, Placid, Templated.io, or Canva Autofill output.
- No explicit Devanagari test found for skia-canvas or node-canvas v4.
- Placid and Templated.io pricing not retrieved.

## 3. Hybrid pattern: model generates background, deterministic renderer writes the title

### Takeaway
The hybrid split (AI image without text, then code draws exact text) is the pattern Hindi-first builders and thumbnail automators actually use, and it removes the spelling risk entirely. It is the recommended default for this use case.

### Cited Findings
- navbharatai (Hindi-first app) shipped "real text on a generated image — spelled right every time, Hindi included" by drawing text with fonts over the generated picture, with a single `composeImage()` renderer for preview and export, script detection, and a Devanagari font-availability check. — [navbharatai PR #3208](https://github.com/docasheesh-png/navbharatai/pull/3208)
- A thumbnail-automation tutorial generates the background with Gemini and overlays text with Pillow; it stresses adding "do NOT include any text in the image" to the prompt and using thick outlines for legibility. — (search summary of) [Skool: Auto-Generated Thumbnails — Zero Canva](https://www.skool.com/build-and-automate-2188/auto-generated-thumbnails-zero-canva)
- A variant: detect non-Latin script, render the text to a transparent PNG with server-side canvas, and feed that PNG to the image model as a reference. — (search summary of) [Nano Banana Korean rendering skill](https://getclawkit.com/skills/official-wonyoung-huh-nano-banana-korean-rendering)
- OpenAI notes brand-element consistency is a known challenge for its image models. — [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation)

### Inferences
- For a fixed house style (dark/red background, logo top, footer), the background itself can be deterministic; AI is only needed for a per-topic illustration/icon (e.g. a Gupta-era coin for "गुप्त काल", a gavel for "अधीनस्थ न्यायालय"). Generate it as a transparent or plain-background asset, composite it into a fixed slot, and cache by topic so repeated topics reuse art.
- The reference-PNG variant (feeding rendered text to the model) still lets the model redraw glyphs and can reintroduce errors; overlaying after generation is safer.

### Gaps
- No large-company case study found (e.g., an edtech or OTT) publicly describing this pipeline with metrics.

## 4. Frame extraction from recorded HLS

### Takeaway
ffmpeg can pull candidate frames straight from the HLS URL cheaply (thumbnail filter or scene-change select), and a CLIP-based aesthetic predictor or simple sharpness/face heuristics can rank them. For lecture video (teacher + board/slides), this yields a teacher photo or board shot to composite into the template, not a finished thumbnail.

### Cited Findings
- ffmpeg's `thumbnail` filter picks a representative frame per batch of frames by histogram comparison (RMSE against the batch's average histogram). — [ffmpeg vf_thumbnail.c](https://fuchsia.googlesource.com/third_party/ffmpeg/+/n3.3.7/libavfilter/vf_thumbnail.c); [GDELT blog on algorithmic thumbnails](https://blog.gdeltproject.org/using-algorithmic-thumbnail-generation-to-yield-better-single-image-thumbnail-representations/)
- ffmpeg `select` with `gt(scene,X)` outputs frames whose scene-change score exceeds X; `scdet` is a dedicated scene-change detector. — [FFmpeg filters documentation](https://ffmpeg.org/ffmpeg-filters.html)
- Typical scoring pipeline: extract candidates, score sharpness (Laplacian variance), brightness, contrast, faces, optionally a learned model. — [Codemia: auto-selecting a thumbnail](https://codemia.io/knowledge-hub/path/auto_selecting_a_thumbnail_for_a_video)
- LAION improved aesthetic predictor: an MLP on CLIP ViT-L/14 embeddings predicting average human liking; weights `sac+logos+ava1-l14-linearMSE.pth`; packaged in pyiqa (`laion_aes`). — [improved-aesthetic-predictor (HF mirror)](https://huggingface.co/camenduru/improved-aesthetic-predictor); [pyiqa laion_aes](https://iqa-pytorch.readthedocs.io/en/latest/autoapi/pyiqa/archs/laion_aes_arch/index.html)

### Inferences
- Cost: compute only. Seeking into an HLS VOD with `-ss` fetches only nearby segments, so sampling ~10–20 frames per class is seconds of CPU and a few MB of CDN egress per class; the 1,500 backfill is hours on one box, effectively $0 marginal. CLIP ViT-L/14 scoring runs on CPU at roughly sub-second per frame (not benchmarked here).
- Aesthetic predictors were trained on general photos/art; for lecture frames, "teacher face visible, eyes open, not mid-blink, board not blank" heuristics (face detector + sharpness) are likely more useful than LAION aesthetics.
- Frames of a real teacher are real photos, so no generated-likeness risk; teacher consent to thumbnail use is a policy question, not a technical one.

### Gaps
- No benchmark found of frame-scoring quality on lecture/classroom video specifically.

## 5. LLM step: title → visual concept, translation/transliteration

### Takeaway
A small LLM call per class can turn "गुप्त काल" into an English icon/illustration prompt and an English subtitle (or Hindi from English), and choose a layout variant; it costs fractions of a cent and is the right place to also enforce "no text, no real people, no logos" in the image prompt.

### Cited Findings
- Including "do NOT include any text in the image" in the background prompt is needed so the model does not bake text in. — (search summary of) [Skool: Auto-Generated Thumbnails — Zero Canva](https://www.skool.com/build-and-automate-2188/auto-generated-thumbnails-zero-canva)
- A pre-rendering middleware design uses an LLM to analyse design intent before rendering text with server-side canvas. — (search summary of) [Nano Banana Korean rendering skill](https://getclawkit.com/skills/official-wonyoung-huh-nano-banana-korean-rendering)

### Inferences
- Translation should be stored and reviewable in the admin (the Hindi title is authored data in `Class`, not something to regenerate per render). LLM transliteration errors in Hindi titles are less likely than diffusion spelling errors, but a human approve step in the admin for the backfill batch is still prudent.
- LLM cost per class is negligible relative to image generation (a few hundred tokens in/out).

### Gaps
- No sourced per-call LLM price gathered in this session; check the chosen provider's pricing page.

## 6. Cost, latency and safety per approach (backfill of 1,500)

### Takeaway
Deterministic template (± ffmpeg teacher frame) costs ~$0 marginal and is exact; hybrid template + AI illustration costs about $25–$100 for the backfill; full AI generation with Hindi text costs $8–$310 in fees but needs OCR verification and human review because of misspellings. Moderation risk is mostly about generated faces of real people (teachers) and copyrighted imagery, both avoidable by never asking the model for people or logos.

### Cited Findings (unit prices used)
- Gemini 3.1 Flash Image 1K $0.067 / batch $0.034; Nano Banana 2.1 1K $0.0336 / batch $0.0168; Gemini 3 Pro Image $0.134 / batch $0.067. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- GPT Image 2 1536x1024: ≈$0.005 low / $0.041–0.052 medium / $0.165–0.206 high. — [yingtu](https://yingtu.ai/es/blog/gpt-image-2-cost-per-image); [Segmind](https://blog.segmind.com/ai-image-gen-pricing-compared-nano-banana-2-vs-seedream-5-0-vs-gpt-image-2-2026/)
- Ideogram v3 $0.030, Recraft V3 $0.040, Seedream 4.0 $0.030, Qwen-Image $0.021 (fal, Dec 2025). — [pricepertoken fal](https://pricepertoken.com/fal-ai-pricing); FLUX direct $0.024–$0.048 — [BFL pricing](https://bfl.ai/pricing)
- Bannerbear $49/1,000, $149/10,000 credits per month. — [Bannerbear pricing](https://www.bannerbear.com/pricing/)
- OpenAI complex prompts can take up to 2 minutes; moderation `auto` default or `low`. — [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation)

### Inferences (arithmetic on the above; ×1,500)
| Approach | Per thumbnail | 1,500 backfill | Latency | Hindi accuracy |
|---|---|---|---|---|
| A. Self-hosted template (Chromium/skia-canvas), fixed background | ~$0 (compute) | ~$0 | <1 s | Exact (if shaper verified) |
| B. A + ffmpeg teacher frame from HLS | ~$0 | ~$0 (hours of CPU) | seconds | Exact |
| C. Hybrid: A + AI illustration (Nano Banana 2.1 batch → Gemini 3.1 Flash std) | $0.017–$0.067 | $25–$100 | batch: hours; sync: ~10–30 s | Exact |
| C'. Hybrid with cheaper models (Qwen-Image / Ideogram / Seedream 4 via fal) | $0.021–$0.040 | $32–$60 | seconds | Exact |
| D. Full AI incl. Hindi title, GPT Image 2 medium–high | $0.041–$0.206 (+retries) | $62–$310+ | up to ~2 min | Unverified; needs OCR + review |
| D'. Full AI, Gemini 3 Pro Image | $0.134 (batch $0.067) | $100–$201+ | | 3.1 Flash scored 3.90/5 in eval; Pro untested |
| E. Bannerbear / Canva Autofill templates | ~$0.015–$0.049 Bannerbear; Canva = plan cost | $49–$149 (1–2 months) | seconds | Unverified Devanagari |
- Daily new classes add the same per-unit cost; at, say, 30/day, option C is ~$15–$60/month.
- Re-generation/retries for full-AI text (option D) can easily double cost, plus human review time, which dominates.
- Safety: never prompt for real teachers' likeness (use extracted frames or uploaded photos instead); prompt "no text, no logos, no real people"; avoid named copyrighted characters/brand marks; store the prompt and model id with each generated asset for audit; OpenAI moderation is on by default, and blocked requests need a fallback (plain template).
- Integration in this stack: a backend job (Node) that renders and uploads to B2, writes the URL on the Class, and serves via Bunny; an admin "Generate thumbnail / Regenerate / Approve" button; the backfill as a batch script over classes with no thumbnail. Option A/B is roughly a few days of engineering; C adds a provider integration and an asset cache; D adds OCR verification and a review queue.

### Gaps
- No measured latency figures for Gemini / fal models gathered in this session.
- Expected retry rate for full-AI Hindi titles is unknown; the single eval (5 prompts) is too small to extrapolate.

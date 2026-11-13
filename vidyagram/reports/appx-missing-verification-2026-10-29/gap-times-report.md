# AppX dashboard checks: six source-segment gap examples

All six missing segments were freshly requested twice and returned HTTP404 both times. The immediately preceding and following segments were readable. These are the first confirmed gaps for these videos, not an exhaustive list of every gap in each recording.

Times below are elapsed playback positions, calculated by summing actual EXTINF durations in the matching quality playlist. Displayed ranges round outwards to whole seconds. Seek about10seconds before the window and explicitly select the affected quality; Auto may switch to a healthy rendition. Other qualities can remain playable.

| Video | Class date (AppX) | Course/row | Gap window (mm:ss) | Source quality |
|---|---|---|---|---|
| Algebra Class 08 | 2024-01-25 | 15/9770 | 43:44–43:57 | 240p |
| Algebra Class 11 | 2024-01-30 | 15/9773 | 46:26–46:39 | 480p |
| Algebra Class 16 | 2024-02-05 | 15/9779 | 50:47–51:00 | 360p |
| Analogy 03 | 2024-04-22 | 22/15166 | 12:17–12:30 | 240p |
| Average Class 18 | 2023-12-07 | 10/6463 | 00:20–00:34 | 480p |
| Botany 03 | 2024-05-30 | 42/31407 | 24:18–24:21 | 240p |

## Exact timing evidence

- Algebra Class 08: 43:44.15–43:56.65; zero-based segment215; master-2498548.7862000368215.ts; HTTP404 confirmed twice.
- Algebra Class 11: 46:26.10–46:38.60; zero-based segment227; master-2790433.1646571243227.ts; HTTP404 confirmed twice.
- Algebra Class 16: 50:47.30–50:59.80; zero-based segment249; master-9081993.356434247249.ts; HTTP404 confirmed twice.
- Analogy 03: 12:17.50–12:30.00; zero-based segment59; master-8583872.38851573759.ts; HTTP404 confirmed twice.
- Average Class 18: 00:20.83–00:33.33; zero-based segment2; master-3439011.0149725396.m3u82.ts; HTTP404 confirmed twice.
- Botany 03: 24:18.07–24:20.33; zero-based segment145; master-115758.48027206348145.ts; HTTP404 confirmed twice.

Observed 2026-10-29T12:49:19.781Z. Source quality labels identify the tested source rendition. AppX menu labels may alias a rendition (for example144p/240p or480p/720p). The missing segment itself, rather than every second of the displayed rounded interval, was tested. [Sanitized evidence](gap-times.json). No source data or visibility was changed.

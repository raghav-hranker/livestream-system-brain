# Playback of the 48 disabled AppX videos — 29 October 2026

All 48 disabled source identities were checked. These are the 48 videos disabled across all placements in the earlier audit. Each video was tested through one exact current representative course/row, with source asset identity checked again. A disabled flag does not prove that its recording is missing.

- **6**: all advertised and derived quality playlists return 404
- **39**: AppX returned no playable URL
- **3**: video decoded at beginning, middle and end

## Playable sources

- **Percentage Class 14 (2)**, course/row **47/35200**: decoded video at the beginning, middle and end; actual resolution 854×480 (h264). Source enabled flag remains 0.
- **Time, Speed & Distance Class 03 · TIME , SPEED & DISTANCE (2)**, course/row **45/34046**: decoded video at the beginning, middle and end; actual resolution 1600×900 (h264). Source enabled flag remains 0.
- **Train Class 01 · TRAIN (4)**, course/row **45/33822**: decoded video at the beginning, middle and end; actual resolution 1600×900 (h264). Source enabled flag remains 0.

“Playable” here means actual local decoding of sampled source segments; it does not certify uninterrupted playback of every second. AppX learner visibility and entitlement were not changed or tested.

## Method and limits

Observed 2026-10-29T11:39:06.940Z to 2026-10-29T11:42:46.354Z. The maintained Vidyagram session was loaded in memory afresh for each official HTTPS CMS request. A known-good Glands01 recording passed before and after the checks. Disabled records were allowed through the read-only probe; they were not enabled in AppX. The source asset had to match the earlier failed import, and deleted records were not treated as playable.

For returned media, every distinct advertised quality URL and standard derived rendition was tried until a playable quality was found, or the available choices were exhausted. A playlist404 was requested again. For a readable, final, clear HLS playlist, the beginning, midpoint and final segments were downloaded with a 16MiB per-segment limit and passed to local ffprobe/ffmpeg over stdin. Video streams and decoded frames were required. No signed URLs, session cookies, raw token bodies or media files were saved.

No-playable-URL responses show that AppX did not supply a usable playback path for the checked occurrence. They do **not** establish physical deletion, nor exclude a separate recording at another source identity. A missing advertised playlist likewise does not prove that an original backup does not exist.

No AppX flags, migration jobs, Classes, placements or spreadsheet cells were changed. Evidence: [raw sanitized playback results](disabled-playback.json), [summary](disabled-playback-summary.json).

## Per-video result

| Video | Tested course/row | Enabled flag | Result | Decoded resolution |
|---|---|---|---|---|
| 08 Chemical Bonding | 7/4362 | 0 | all advertised and derived quality playlists return 404 |  |
| 12 Periodic Classification of Elements | 7/4363 | 0 | all advertised and derived quality playlists return 404 |  |
| Alligation 01 (2) · ALLIGATION (2) | 46/34371 | 0 | AppX returned no playable URL |  |
| Alligation 02 (2) | 46/34372 | 0 | AppX returned no playable URL |  |
| Alligation 03 · ALLIGATION (3) | 46/34373 | 0 | AppX returned no playable URL |  |
| Alligation 03 (2) | 46/34616 | 0 | AppX returned no playable URL |  |
| Circle 10 (2) | 21/14232 | 0 | AppX returned no playable URL |  |
| Classification 05 (2) | 42/31450 | 0 | AppX returned no playable URL |  |
| Classification 09 (2) | 42/31454 | 0 | AppX returned no playable URL |  |
| COMPOUND INTEREST & SIMPLE INTEREST CLASS 02 | 7/4222 | 0 | all advertised and derived quality playlists return 404 |  |
| Electric Charge (2) | 42/31782 | 0 | AppX returned no playable URL |  |
| Height & Distance 01 · HEIGHT & DISTANCE (3) | 30/22999 | 0 | AppX returned no playable URL |  |
| HISTORY OF COMPUTER | 69/40106 | 0 | AppX returned no playable URL |  |
| Internet 02 (2) | 69/43443 | 0 | AppX returned no playable URL |  |
| Matter & it's States | 114/181076 | 0 | AppX returned no playable URL |  |
| Mixture 06 · MIXTURE (3) | 46/34460 | 0 | AppX returned no playable URL |  |
| Mixture 07 · MIXTURE (3) | 46/34461 | 0 | AppX returned no playable URL |  |
| Percentage 09 · PERCENTAGE (प्रतिशत ) | 10/5973 | 0 | all advertised and derived quality playlists return 404 |  |
| Percentage Class 01 · PERCENTAGE (प्रतिशत ) (8) | 24/17884 | 0 | all advertised and derived quality playlists return 404 |  |
| Percentage Class 14 (2) | 47/35200 | 0 | video decoded at beginning, middle and end | 854×480 (h264) |
| PERCENTAGE(प्रतिशतता) CLASS 11 (2) | 3/407 | 0 | all advertised and derived quality playlists return 404 |  |
| Pipe & Cistern 03 (2) · PIPE & CISTERN | 23/16852 | 0 | AppX returned no playable URL |  |
| Practice Set (11) | 69/40592 | 0 | AppX returned no playable URL |  |
| Practice Set (9) | 69/176321 | 0 | AppX returned no playable URL |  |
| Profit & Loss 01 · Profit & Loss (लाभ और हानि) (2) | 30/22869 | 0 | AppX returned no playable URL |  |
| Profit, loss & Discount 02 | 30/23018 | 0 | AppX returned no playable URL |  |
| Ratio 01 (2) · RATIO (अनुपात) | 23/17064 | 0 | AppX returned no playable URL |  |
| Ratio 03 (2) · RATIO (अनुपात) (2) | 23/17067 | 0 | AppX returned no playable URL |  |
| Simplification 06 (2) · Simplification by Anurag Sir | 101/175414 | 0 | AppX returned no playable URL |  |
| Strategy & Guidance · STRATEGY & GUIDANCE (11) | 31/23240 | 0 | AppX returned no playable URL |  |
| Strategy & Guidance · STRATEGY & GUIDANCE (9) | 28/21142 | 0 | AppX returned no playable URL |  |
| tesi | 66/40099 | 0 | AppX returned no playable URL |  |
| testing (4) | 66/40328 | 0 | AppX returned no playable URL |  |
| Testing (4) | 66/39914 | 0 | AppX returned no playable URL |  |
| Testing Reasoning (2) | 66/40031 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance 01 (2) · TIME , SPEED & DISTANCE | 46/34655 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance 02 (2) | 46/34656 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance 03 (2) · TIME , SPEED & DISTANCE (2) | 46/34657 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance 04 (2) | 46/34658 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance 05 (2) | 46/34659 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance 06 (2) · TIME , SPEED & DISTANCE | 46/34660 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance 06 (2) · TIME , SPEED & DISTANCE (2) | 47/35335 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance 07 (2) · TIME , SPEED & DISTANCE | 46/34661 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance 07 (2) · TIME , SPEED & DISTANCE (2) | 47/35336 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance 08 (2) | 46/34662 | 0 | AppX returned no playable URL |  |
| Time, Speed & Distance Class 03 · TIME , SPEED & DISTANCE (2) | 45/34046 | 0 | video decoded at beginning, middle and end | 1600×900 (h264) |
| Train Class 01 · TRAIN (4) | 45/33822 | 0 | video decoded at beginning, middle and end | 1600×900 (h264) |
| संसद 02 | 101/189321 | 0 | AppX returned no playable URL |  |

## Subsequent import

The three sampled-playable recordings were subsequently imported under their existing Class IDs. All1,922 selected source segments copied successfully; origin storage and signed admin playback passed. Disabled Class and placement visibility was preserved. See [import and verification report](../appx-three-disabled-recovery-2026-10-29/report.md).

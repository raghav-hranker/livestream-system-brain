# Three disabled AppX recordings imported — 29 October 2026

All three recordings are imported under their **existing Class IDs**. Their Classes remain status0 and their three CourseClass placements remain inactive/status0, exactly as before. Source AppX enable flags were not changed.

| Video | Imported quality | Complete segments | Source course/row |
|---|---|---|---|
| Time, Speed & Distance Class 03 · TIME , SPEED & DISTANCE (2) | 900p | 380 | 45/34046 |
| Train Class 01 · TRAIN (4) | 900p | 286 | 45/33822 |
| Percentage Class 14 (2) | 480p | 1256 | 47/35200 |

All **1,922 selected source segments** were fetched in full, checked for media signatures and copied through the existing Vidyagram mirror dependencies. Each master was published only after its entire selected rendition succeeded. No missing segments were skipped. Masters advertise the measured 480p/900p dimensions; no upscaling or unavailable-quality aliases were added. This establishes complete selected-quality copying, not a frame-by-frame decode of each whole lecture.

Origin storage and signed production admin-preview playback passed for all three. Each master, rendition playlist and beginning/middle/final segment was checked. No learner views were created. The first import passed these checks before the second began, and the second passed before the third began.

Protected BSON beforeimages and per-job compare-and-set operations are retained locally. The final audit verifies unchanged course placements, catalogue ledgers and 168 other failed jobs. Class changes are limited to hlsAsset, streamStatus and updatedAt. No deployment, persistent worker configuration change or catalogue visibility change was performed.

Authorization: the user's instruction, “so shall we bring these 3 in?”, after identifying the exact three sampled-playable disabled recordings. Tenant: Vidyagram781, AppX org2177599, vidyagramdb, recordedvideos-vidyagram.

Evidence: [summary](summary.json), [fresh source inventories](preview.json), [execution](execution.json), [origin storage](storage.json), [before/after audit](final-audit.json), and per-Class playback JSON files in this directory. Protected beforeimages are in before.ejson.

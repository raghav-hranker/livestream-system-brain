# APX recovery audit — 26 September 2026

Audited **100** outstanding classes. **27 / 27** recoverable recordings have been published and verified.

| Group | Classes | In enabled courses |
|---|---:|---:|
| Complete quality available | 27 | 25 |
| UHS recording requires compatible recovery/export | 22 | 5 |
| No usable source found | 51 | 3 |

## Reported RMB classes

| Class | Result |
|---|---|
| Class-15 // Mensuration 3D | Restored and verified through signed CDN playback |
| Class-29 // Number System | Restored and verified through signed CDN playback |
| Economics // Class - 24 // Five Years Plan + Another Important Topics | APX lists UHS 3 recordings; standard token response has no HLS URLs. Direct legacy paths return 404. Economics UHS player returned error 4002: Limit reached for today. |

## Verification and limits

- Every recoverable quality had all source segments checked before copying.
- Every copied segment and MP4 was uploaded to both configured production storage destinations.
- MP4s were remuxed and probed for video, audio, resolution, and duration.
- Before publication: signed CDN master, every advertised quality, first/middle/last segments, and MP4 sizes were verified.
- Existing class IDs and course assignments were preserved. No missing media segments were intentionally removed.
- Source quality names can differ from actual video dimensions; published menus use the measured dimensions.
- The UHS group is not classified as deleted media: APX lists recordings, but the existing importer does not support its newer response. The authorized Economics player returned error 4002 (daily limit); other UHS recordings were not repeatedly opened after that limit.
- No-recording entries include old test/error classes. Absence from these APX fields does not prove no original file exists elsewhere.

## Next actions

1. Obtain APX export/download access for the 22 UHS recordings, or implement the supported UHS import path once access is available. Prioritize the five in enabled courses.
2. Request original uploads or APX source restoration for the 51 classes with no usable source. Prioritize the three in enabled courses.
3. Keep unresolved entries in the audit; do not replace a lecture with a similarly named class without proving it is the same recording.

## All 100 classes

| Title | Enabled course | Result | Class ID |
|---|---|---|---|
| CLASS-04 // Rivers in India | Yes | Restored (480p) | `6a455e1aebb42f585d9d2f71` |
| Class-01 // Causitive Verb | Yes | Restored (480p) | `6a455eb8ebb42f585d9d6c1e` |
| Class-01 // Gravitation | Yes | Restored (480p, 144p) | `6a455bf5ebb42f585d9c485f` |
| Class-01 // Indus Valley Civilisation - सिंधु घाटी सभ्यता | Yes | Restored (480p, 144p) | `6a4559a3ebb42f585d9b17bc` |
| Class-01 // Speech & Narration | Yes | Restored (480p, 144p) | `6a455eb5ebb42f585d9d6a9a` |
| Class-02 // Sitting Arrangement | Yes | Restored (480p, 144p) | `6a455c13ebb42f585d9c5636` |
| Class-03 // Preposition | Yes | Restored (360p, 480p) | `6a455eb7ebb42f585d9d6b7f` |
| Class-03 // Speech & Narration | Yes | Restored (360p, 144p) | `6a455eb5ebb42f585d9d6aae` |
| Class-04 // ORDER AND RANKING | Yes | Restored (480p, 144p) | `6a455c0febb42f585d9c5472` |
| Class-04 // Preposition | Yes | Restored (480p, 144p) | `6a455eb7ebb42f585d9d6b89` |
| Class-06 // Active and Passive Voice | Yes | Restored (480p, 144p) | `6a455eb4ebb42f585d9d6a3d` |
| Class-07 // Adjectives | Yes | Restored (360p, 480p) | `6a455eb5ebb42f585d9d6abb` |
| Class-09 // प्रजनन तंत्र (Reproductive system) | Yes | Restored (360p, 480p) | `6a455be3ebb42f585d9c3fd6` |
| Class-11 // प्रजनन तंत्र (Reproductive system) | Yes | Restored (360p, 480p) | `6a455be3ebb42f585d9c3fea` |
| Class-12 // Output Device | Yes | Restored (480p, 144p) | `6a455de6ebb42f585d9d1b31` |
| Class-15 // Mensuration 3D | Yes | Restored (360p, 480p) | `6a455937ebb42f585d9ad622` |
| Class-26 // Network | Yes | Restored (360p, 480p) | `6a455de8ebb42f585d9d1baf` |
| Class-29 // Number System | Yes | Restored (360p, 480p) | `6a455942ebb42f585d9ade00` |
| Class-31 // Number System | Yes | Restored (480p, 144p) | `6a455942ebb42f585d9ade14` |
| Class-39 // Internet | Yes | Restored (360p, 144p) | `6a455de9ebb42f585d9d1c24` |
| Class-4 // Time And Tense | Yes | Restored (480p, 144p) | `6a455eb3ebb42f585d9d69d3` |
| Class-6 // Time And Tense | Yes | Restored (360p, 144p) | `6a455eb3ebb42f585d9d69e7` |
| Class-7 // Time And Tense | Yes | Restored (360p, 480p) | `6a455eb3ebb42f585d9d69f1` |
| Live Class-161 / Time Speed Distance / Part-15 | Yes | Restored (360p, 480p) | `6a455a41ebb42f585d9b7364` |
| PYQ Set-01 | Yes | Restored (480p, 144p) | `6a455defebb42f585d9d1eab` |
| Class-7 // Ratio & Proportion | Yes | Original/source restoration needed | `6a455c54ebb42f585d9c7348` |
| Revision Class | Yes | Original/source restoration needed | `6a92f66146d593ad820a3b62` |
| World Geography // Class-62 // Solar System - Part 8 | Yes | Original/source restoration needed | `6a4559bbebb42f585d9b26f2` |
| Class- 17 // Peninsular India- Part 3 | Yes | UHS recovery/export needed | `6a455a96ebb42f585d9b9e8f` |
| Economics // Class - 24 // Five Years Plan + Another Important Topics | Yes | UHS recovery/export needed | `6a4559bdebb42f585d9b27f6` |
| Geography Weekly Revision and Sectional Test 02 | Yes | UHS recovery/export needed | `6a455a95ebb42f585d9b9e21` |
| RPF SI 2024 Top Questions | Yes | UHS recovery/export needed | `6a455b95ebb42f585d9c1e5c` |
| Static Gk // Class-60 // Tiger Reserves | Yes | UHS recovery/export needed | `6a4559b5ebb42f585d9b22dc` |
| Class-03 // SI & CI (07 Jun 2024) | No | Restored (360p, 480p) | `6a455da4ebb42f585d9d0094` |
| Class-वर्तनी MCQ | No | Restored (480p, 144p) | `6a455e74ebb42f585d9d5225` |
| CLASS - 10 // History [8793] | No | Original/source restoration needed | `6a455e7aebb42f585d9d54b8` |
| Class - 12 // Simplification | No | Original/source restoration needed | `6a4559d3ebb42f585d9b34f7` |
| Class 09 // P.4 EXCLUSIVE PAPER CTM (PART 2) | No | Original/source restoration needed | `6a4559d6ebb42f585d9b3638` |
| Class 10 // Clock Part-5 | No | Original/source restoration needed | `6a455922ebb42f585d9ac810` |
| Class 131 // State (राज्य) | No | Original/source restoration needed | `6aab038eaacb88187198a451` |
| Class 192 // Last 6 Month Current Affairs -140 | No | Original/source restoration needed | `6a95ebd96ac37707ba23f9d0` |
| Class 27 // महत्वपूर्ण अनुच्छेद (Important articles) | No | Original/source restoration needed | `6a455902ebb42f585d9ab0be` |
| Class 28 // Coding Decoding part -1 | No | Original/source restoration needed | `6a455923ebb42f585d9ac8ce` |
| Class 32 // Simplification (Surds and Indices) | No | Original/source restoration needed | `6a455946ebb42f585d9ae04a` |
| Class 42 // Syllogism Part-6 | No | Original/source restoration needed | `6a4558d4ebb42f585d9a9094` |
| Class quality testing | No | Original/source restoration needed | `6a455d4bebb42f585d9cdadc` |
| Class- 02 // Analogy ( सादृश्यता ) Part -2 | No | Original/source restoration needed | `6a45599febb42f585d9b154f` |
| Class- 35 // Human Eye &  Eye Disease (मानव आंख & नेत्र रोग) | No | Original/source restoration needed | `6a455a87ebb42f585d9b9666` |
| Class- 49 I SSC CGL PYP 3 | No | Original/source restoration needed | `6a455d9eebb42f585d9cfe3a` |
| Class-02 // Statement and Assumption [11669] | No | Original/source restoration needed | `6a455e0febb42f585d9d2b1f` |
| Class-10 // polity special class | No | Original/source restoration needed | `6a455e23ebb42f585d9d3353` |
| Class-11 // Sitting Arrangement [10719] | No | Original/source restoration needed | `6a455e0eebb42f585d9d2ad7` |
| Class-29 // World Geo graphy -North America - Class - 01 | No | Original/source restoration needed | `6a455e3eebb42f585d9d3dec` |
| Class-58 // Geography - Agriculture in India (Part-4) | No | Original/source restoration needed | `6a4559b0ebb42f585d9b1fe4` |
| Computer Weekly Revision and Sectional Test 10 | No | Original/source restoration needed | `6a45591febb42f585d9ac60d` |
| I.T. Literacy  - Logic Gates | No | Original/source restoration needed | `6a455b83ebb42f585d9c16a3` |
| Indian Polity // Class -50 // Parliament Part-9 ( Class with Error) | No | Original/source restoration needed | `6a4559c0ebb42f585d9b29f7` |
| Indian Polity // Class -50 // Parliament Part-9 ( Class with Error) [33221] | No | Original/source restoration needed | `6a455bccebb42f585d9c3583` |
| Live Class-120/ Average / Part-14 [125] | No | Original/source restoration needed | `6a455fdcebb42f585d9ddcb5` |
| Practice Set -4 (Engineering) | No | Original/source restoration needed | `6a4559f4ebb42f585d9b47ab` |
| Practice Set -5 (Engineering) | No | Original/source restoration needed | `6a4559f6ebb42f585d9b48d3` |
| Practice Set 9 | No | Original/source restoration needed | `6a455921ebb42f585d9ac72e` |
| RPF ALP Top Questions 2024 | No | Original/source restoration needed | `6a455c99ebb42f585d9c90a5` |
| RRB Technician Grade - 3 2024 Top Questions | No | Original/source restoration needed | `6a455c99ebb42f585d9c90af` |
| Rapid Fire Session - 6 | No | Original/source restoration needed | `6a455c1aebb42f585d9c5a04` |
| Reasoning Weekly Revision and Sectional Test 05 | No | Original/source restoration needed | `6a455a0debb42f585d9b5857` |
| SSC GD PYP 16 // (Basic Approach+  Tricks के साथ) [4699] | No | Original/source restoration needed | `6a455ed3ebb42f585d9d76ae` |
| STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) | No | Original/source restoration needed | `6a4559b5ebb42f585d9b2304` |
| STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) [31464] | No | Original/source restoration needed | `6a455cc6ebb42f585d9ca3b2` |
| STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) [31465] | No | Original/source restoration needed | `6a455dd6ebb42f585d9d14ab` |
| STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) [35895] | No | Original/source restoration needed | `6a455bc0ebb42f585d9c309a` |
| STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) [44158] | No | Original/source restoration needed | `6a455ab7ebb42f585d9bb39c` |
| STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) [44420] | No | Original/source restoration needed | `6a455b40ebb42f585d9bf78c` |
| Static GK // Class-77 // Famous Places in World Part-2 ( Error Class )) | No | Original/source restoration needed | `6a4559b6ebb42f585d9b2390` |
| Static GK // Class-77 // Famous Places in World Part-2 ( Error Class )) [35909] | No | Original/source restoration needed | `6a455bc1ebb42f585d9c30ff` |
| Static GK // Class-99 // First in India- Part 3 | No | Original/source restoration needed | `6a4559b7ebb42f585d9b2478` |
| Static Gk // Class-1 // Festival in India | No | Original/source restoration needed | `6a455bceebb42f585d9c36a3` |
| TREE PHASE INDUCTION MOTOR | No | Original/source restoration needed | `6a455b7bebb42f585d9c12e8` |
| Testing | No | Original/source restoration needed | `6a455c76ebb42f585d9c8223` |
| Three phase induction motor | No | Original/source restoration needed | `6a455b7aebb42f585d9c12df` |
| abc | No | Original/source restoration needed | `6a455d4aebb42f585d9cdaaf` |
| test notification | No | Original/source restoration needed | `6a455d4bebb42f585d9cdac1` |
| testing - 2 | No | Original/source restoration needed | `6a455de5ebb42f585d9d1a9e` |
| Class - 10 // Atomic Structure (परमाणु सिद्धांत) Part - 2 | No | UHS recovery/export needed | `6a455b74ebb42f585d9c0fc3` |
| Class - 11 // Atomic Rules (परमाणुक नियम) | No | UHS recovery/export needed | `6a455b74ebb42f585d9c0fcc` |
| Class - 12 // Atomic Rules (परमाणुक नियम) Questions Practice | No | UHS recovery/export needed | `6a455b74ebb42f585d9c0fd5` |
| Class - 20 // Metal (धातु) | No | UHS recovery/export needed | `6a455b75ebb42f585d9c101d` |
| Class - 21 // Metal (धातु) Part - 2 | No | UHS recovery/export needed | `6a455b75ebb42f585d9c1026` |
| Class - 24 // Metal & Non-metal (धातु & अधातु) Part - 3 | No | UHS recovery/export needed | `6a455b75ebb42f585d9c1041` |
| Class - 25 // Metal & Non-metal (धातु & अधातु) Part - 4 | No | UHS recovery/export needed | `6a455b75ebb42f585d9c104a` |
| Class - 26 // Metal & Non-metal (धातु & अधातु) Part - 5 | No | UHS recovery/export needed | `6a455b75ebb42f585d9c1053` |
| Class - 33 // Organic Chemistry ( कार्बनिक रसायन ) Part 1 | No | UHS recovery/export needed | `6a455b76ebb42f585d9c1092` |
| Class - 41 // Genetics (आनुवांशिकी) Part - 1 | No | UHS recovery/export needed | `6a455b71ebb42f585d9c0e4f` |
| Class - 47 // Plant Tissue (पौध ऊतक) Part - 3 | No | UHS recovery/export needed | `6a455b72ebb42f585d9c0e85` |
| Class - 48 // Animal Tissue (जंतु ऊतक) | No | UHS recovery/export needed | `6a455b72ebb42f585d9c0e8e` |
| Class - 51 // Cell (कोशिका) Part-1 | No | UHS recovery/export needed | `6a455b72ebb42f585d9c0ea9` |
| Class - 52 // Cell (कोशिका) Part-2 | No | UHS recovery/export needed | `6a455b72ebb42f585d9c0eb2` |
| Class - 53 // Cell (कोशिका) Part-3 | No | UHS recovery/export needed | `6a455b72ebb42f585d9c0ebb` |
| Class- 05 // Unit and Measurements (इकाई और मापन) Part 5 | No | UHS recovery/export needed | `6a455b77ebb42f585d9c111c` |
| Class-30 // Excretory System ( उत्सर्जन तंत्र ) Part-3 | No | UHS recovery/export needed | `6a455b70ebb42f585d9c0dec` |

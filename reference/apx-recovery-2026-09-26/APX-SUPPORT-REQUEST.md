# APX support request — QuickTricks remaining recording access

**Subject:** Export/access for 9 UHS recordings; source restoration for 51 classes

Please help us recover the following recordings from our QuickTricks catalogue. The complete APX video/course IDs are listed below. We have restored the other UHS recordings in our own system; this request covers only those still lacking an accessible source.

## Requested actions

1. **9 UHS recordings:** provide authorized downloadable MP4/HLS exports, or restore normal CMS player/export access. APX metadata lists recording qualities, but the importer receives an empty `urls` array and a UHS player link.
2. **50 classes without recording entries:** locate the original recordings or restore their recording entries. Existing links are empty or unusable former livestreams.
3. **Ratio & Proportion Class 7 (video 28940):** restore its source. Fresh playlists for 240p, 360p, 480p and 720p return HTTP 404.

## Reproduced access failure — 26 September 2026

- A supplied `ci_session` cookie was set on `cms.appx.co.in`, but the course page redirected to the Organisation ID login. Its reCAPTCHA verification must be completed through the normal account flow.
- An earlier signed-in CMS session showed error 4002, “Limit reached for today please try again after some time,” on video 33407 (Metal Class 26). The embedded player for video 34826 (Organic Chemistry Class 33) redirected to the Organisation ID login.
- A control UHS class has played in the normal CMS, so these observations do not prove an account-wide UHS limit. Please identify why access to the remaining recordings fails and provide supported exports if normal player access cannot be restored.
- On a later user-supplied session, course 82 opened normally. The CMS playback request contained a non-empty `recaptcha_token` and `recordingType`, and `/common/get_video_token` returned HTTP 200 with `Token fetched` and a UHS player URL. The embedded player still returned 4002 for videos 33407, 34826 and 32853 **and** previously working Chemistry Class 1. Please identify the player access restriction or verification step affecting this account and restore playback or provide supported exports.
- On 27 September, a fresh CMS session allowed video 33407 to play and its source was recovered for our private intake. In that same session, video 34826 still returned player error 4002. The CMS then redirected its course contents to Organisation ID login, and the cookie could not reopen the course. This leaves **nine** UHS recordings needing player access or exports; video 33407 no longer needs an APX export.

## Highest priority source restorations in enabled courses

| APX video ID | APX course ID | Class | Request |
|---|---|---|---|
| 28940 | 64 | Class-7 // Ratio & Proportion | Original/source restoration |
| 52830 | 140 | Revision Class | Original/source restoration |
| 38000 | 115 | World Geography // Class-62 // Solar System - Part 8 | Original/source restoration |

## Nine UHS export/access requests

| APX video ID | APX course ID | Class |
|---|---|---|
| 34826 | 82 | Class - 33 \|\| Organic Chemistry ( कार्बनिक रसायन ) Part 1 |
| 32853 | 82 | Class - 41 \|\| Genetics (आनुवांशिकी) Part - 1 |
| 33020 | 82 | Class - 47 \|\| Plant Tissue (पौध ऊतक) Part - 3 |
| 33060 | 82 | Class - 48 \|\| Animal Tissue (जंतु ऊतक) |
| 33366 | 82 | Class - 51 \|\| Cell (कोशिका) Part-1 |
| 33368 | 82 | Class - 52 \|\| Cell (कोशिका) Part-2 |
| 33406 | 82 | Class - 53 \|\| Cell (कोशिका) Part-3 |
| 35853 | 82 | Class- 05 \|\| Unit and Measurements (इकाई और मापन) Part 5 |
| 31336 | 82 | Class-30 \|\| Excretory System ( उत्सर्जन तंत्र ) Part-3 |

## All 51 source restoration requests

| APX video ID | APX course ID | Class | Enabled course |
|---|---|---|---|
| 28940 | 64 | Class-7 // Ratio & Proportion | Yes |
| 52830 | 140 | Revision Class | Yes |
| 38000 | 115 | World Geography // Class-62 // Solar System - Part 8 | Yes |
| 8793 | 29 | CLASS - 10 // History [8793] | No |
| 38436 | 111 | Class - 12 // Simplification | No |
| 40722 | 111 | Class 09 // P.4 EXCLUSIVE PAPER CTM (PART 2) | No |
| 47076 | 124 | Class 10 // Clock Part-5 | No |
| 53630 | 138 | Class 131 // State (राज्य) | No |
| 53369 | 127 | Class 192 // Last 6 Month Current Affairs -140 | No |
| 48254 | 126 | Class 27 // महत्वपूर्ण अनुच्छेद (Important articles) | No |
| 47970 | 124 | Class 28 // Coding Decoding part -1 | No |
| 50038 | 123 | Class 32 // Simplification (Surds and Indices) | No |
| 51326 | 139 | Class 42 // Syllogism Part-6 | No |
| 51141 | 43 | Class quality testing | No |
| 43023 | 118 | Class- 02 // Analogy ( सादृश्यता ) Part -2 | No |
| 35789 | 94 | Class- 35 // Human Eye &  Eye Disease (मानव आंख & नेत्र रोग) | No |
| 14894 | 38 | Class- 49 I SSC CGL PYP 3 | No |
| 11669 | 32 | Class-02 // Statement and Assumption [11669] | No |
| 13108 | 32 | Class-10 // polity special class | No |
| 10719 | 32 | Class-11 // Sitting Arrangement [10719] | No |
| 20805 | 32 | Class-29 // World Geo graphy -North America - Class - 01 | No |
| 37818 | 115 | Class-58 // Geography - Agriculture in India (Part-4) | No |
| 46436 | 124 | Computer Weekly Revision and Sectional Test 10 | No |
| 30019 | 72 | I.T. Literacy  - Logic Gates | No |
| 38084 | 115 | Indian Polity // Class -50 // Parliament Part-9 ( Class with Error) | No |
| 33221 | 67 | Indian Polity // Class -50 // Parliament Part-9 ( Class with Error) [33221] | No |
| 125 | 3 | Live Class-120/ Average / Part-14 [125] | No |
| 44053 | 109 | Practice Set -4 (Engineering) | No |
| 44605 | 109 | Practice Set -5 (Engineering) | No |
| 47381 | 124 | Practice Set 9 | No |
| 30302 | 58 | RPF ALP Top Questions 2024 | No |
| 30953 | 58 | RRB Technician Grade - 3 2024 Top Questions | No |
| 23980 | 65 | Rapid Fire Session - 6 | No |
| 36316 | 109 | Reasoning Weekly Revision and Sectional Test 05 | No |
| 4699 | 20 | SSC GD PYP 16 // (Basic Approach+  Tricks के साथ) [4699] | No |
| 37898 | 115 | STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) | No |
| 31464 | 55 | STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) [31464] | No |
| 31465 | 35 | STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) [31465] | No |
| 35895 | 67 | STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) [35895] | No |
| 44158 | 93 | STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) [44158] | No |
| 44420 | 90 | STATIC GK // Class-64 // Wildlife Sanctuaries ( Internet Error ) [44420] | No |
| 37912 | 115 | Static GK // Class-77 // Famous Places in World Part-2 ( Error Class )) | No |
| 35909 | 67 | Static GK // Class-77 // Famous Places in World Part-2 ( Error Class )) [35909] | No |
| 37937 | 115 | Static GK // Class-99 // First in India- Part 3 | No |
| 35677 | 67 | Static Gk // Class-1 // Festival in India | No |
| 30894 | 81 | TREE PHASE INDUCTION MOTOR | No |
| 20876 | 58 | Testing | No |
| 30895 | 81 | Three phase induction motor | No |
| 12782 | 43 | abc | No |
| 41052 | 43 | test notification | No |
| 12340 | 34 | testing - 2 | No |

Please preserve class identity when supplying replacements. A similarly named class may be a different lecture.

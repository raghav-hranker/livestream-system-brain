---
tenant: quicktricks
---
# Class chat insights — pilot on four classes (2026-10-30)

Question: is an analysis of live-class chat worth building for teachers and admins? This is a hand-made
version of the report, done on four real classes, so the teacher can say whether they would act on it.

Data: public chat from the quicktricks socket Redis (`room:<classId>:messages`), exported read-only with
`reference/scripts/chat_export.cjs` (user ids hashed, no names, private chat never read) and labelled with
`reference/scripts/class_meta.cjs`. "Minute" below = minutes after the scheduled start (09:15 or 13:00 IST),
not the video position; the stream can start a few minutes late.

## Verdict

Worth building, in a narrow form. About 2% of messages are real doubts, but they cluster at specific minutes
and they agree with the quiz-answer splits. That gives a short "re-explain list" per class that a teacher can
act on next morning. The chat also carries support and scheduling questions that the teacher cannot answer
live; those belong to the admin team, and today nobody sees them.

## What the chat is made of

| Class | Messages | Students chatting | Quiz letters (A/B/C/D) | Doubt messages (students) | Playback complaints (students) |
|---|---|---|---|---|---|
| Day 150 · Pipe & Cistern 1 (10-30) | 2,687 | 190 | 935 | 39 (21) | 7 (5) |
| Day 149 · Time & Work 13 (10-29) | 1,639 | 162 | 136 | 43 (28) | 12 (8) |
| Day 148 · Time & Work 12 (10-28) | 1,381 | 156 | 248 | 27 (20) | 5 (4) |
| Day 149 · Algebra 6 (10-29, 13:00) | 888 | 95 | 266 | 19 (12) | 0 |

Median message length is 3–5 characters. Most of the chat is answers called out to the teacher's questions
(letters or numbers), greetings, and goodbye chatter in the last 5–10 minutes. Sentiment scoring on this
would be noise.

## 1. Re-explain list per class

Quiz split = the share of students who gave the most common letter in one answer round (one vote per student).
A low share means the class was split, whatever the correct answer was.

**Pipe & Cistern 1 (10-30)**
- **43–44 min, quiz split 38%** (A 19, B 11, C 24, D 10 of 64). Students said afterwards they took pipe C as
  an outlet, or answered before working it out. The most split moment of the class.
- 26–30 min: "how are you taking it as exact", "I don't understand", "how does 4 come" — one student asked twice.
- 33–35 min: "how are you taking −1" (twice), "can't we take Rishabh's as negative".
- 49–55 min: Q18, "can we take LCM as 120?" and "I keep getting confused with LCM", "explain again".
- 58–60 min: "how did 9/4 come" (3 students), "how did 60 come", and three students asked
  **whether they can convert to minutes** instead. One example worked in minutes would answer all of them.

**Time & Work 13 (10-29)**
- 11–13 min: "explain Akbar's again" (2), "how did you take the 2nd equation", "how did 6abha come in 203".
- 17–27 min: "I don't understand this question at all", "once more" (3 asks).
- 59–60 min: **"I don't get how to take + and −"** (3 messages).
- 70–73 min: "how did 324 come", "where did 160 and 190 come from", "repeat, my net was down".
- Quiz at 31 min split 53% (n 15).

**Time & Work 12 (10-28)**
- **40–46 min: 9 doubt messages in 6 minutes** — "why multiply 36", "why take the difference of 12 and 4",
  "why equate to 8", "why take 60", "explain the previous one again" (×3). The densest doubt burst in the pilot.
- 51 min: Q191, "Rohan's hours aren't given, so why assume 5".
- Last two quiz rounds split 63% (61 min) and 50% (69 min).

**Algebra 6 (10-29)**
- **38–45 min, quiz split 34%** (A 14, D 14 of 41). Right before it: "why + instead of −", "you wrote 8x−7y,
  how did it become 8x+7y", "shouldn't it be 5y?", "I have trouble with the signs", "explain once more".
- 23–31 min: "is there a method other than Sridharacharya", "any shortcut to find factors", "aren't −b/a the
  roots", "divides but isn't a factor".
- 32 min: "write a bit bolder" (board readability). 117 min (on the recording): "please explain from basics".

## 2. A doubt that repeats across classes

**Handling signs (+/−)** came up in three of the four classes: Algebra 38–45 min, Time & Work 13 at 59 min,
Pipe & Cistern 33–44 min (−1, outlet as negative). One short on sign rules for these chapters would cover it.
This only shows up when you look across classes, which a per-class view would not do.

## 3. Questions only the admin team can answer

Asked to the teacher in live chat, unanswered:
- **Validity extension**: one student asked 5 times in Algebra how to extend a Foundation batch; an RRB 2025
  combo buyer asked whether only reasoning gets extended.
- **Station Master batch**: "I bought it yesterday, where do I start", "when is Station Master maths",
  "only the Station Master test series opened, no reply on WhatsApp", "English added to the syllabus",
  "cheated the Station Master students". Four classes, several students: a sales/onboarding gap.
- **Reasoning class at 4 pm not live**: 10-29 (2 students) and 10-30 (1 student, twice). Worth checking the
  timetable.
- **E-book won't save to the phone / print**: 10-30, at least 3 students ("stays inside the app"). If in-app
  only is by design, a line in the app would stop the questions.
- **App rating**: when the teacher asked for Play Store ratings (~54 min, 10-30), about a dozen asked where and
  how. An in-app link would convert them.
- A cross showing next to one student's own comment (Algebra 64 min): likely muted or a failed send.

## 4. Ops signals

- **"Class suspended" before start** on two of three mornings: 10-28 (9 min, plus "waiting since 9:15,
  refreshing, no notification") and 10-30 (3 min, then "loading, did the class end?" at 9–10 min). Looks like
  the app shows a suspended or ended state before the stream comes up.
- Playback complaints are small and spread out: 10-29 had 8 students over 5, 32–33, 54 and 69–70 min; 10-30
  one student on 5G, four times. Run `chat_buffering.cjs` + `cf_minute_probe.sh` when several students
  complain in the same minute.
- Moderation: a student posted a phone number and a Telegram id in public chat after Algebra 6.

## 5. What to build

1. Archive each class's chat to Mongo or R2 when the class ends (today it lives only in Redis, unbounded).
2. Per-class report, no LLM: quiz rounds and their split, chat activity per 5 minutes, keyword buckets
   (doubt / support / schedule / playback). Most of sections 1, 3 and 4 came from this.
3. LLM step on the doubt and support buckets only (~100 messages a class): group into topics, name the
   question, write the re-explain list. Cents per class.
4. Deliver it: the teacher's list on the class page or a message after class; the support and schedule bucket
   to the admin team; a weekly cross-class view for repeating doubts.

Caveats: the keyword buckets miss doubts phrased other ways and catch some jokes; the most common quiz answer
is not necessarily the correct one; minutes are from the scheduled start.

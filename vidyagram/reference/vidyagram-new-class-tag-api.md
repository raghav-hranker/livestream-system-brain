# NEW tag on classes and topics (app guide)

Live since 2026-10-23 15:28 IST (vidyagram-admin `e2acfc9f6`, source `f1f650a18`, pm2 92).

## The rule

A class is new when both of these hold.

- Its date in that course is today (IST) and not later than now.
- It is not live right now. A stream that is starting or reconnecting counts as live.

The date is the one the admin sets when placing the class in the course. If the admin adds an old class with
today's date, it shows NEW in that course. To keep it untagged, give it its old date. The tag drops at IST midnight.

## Fields

`GET /api/topic-and-section?courseId=…` returns `newClassCount` (a number, 0 when none) on each topic. Show the
badge when it is above 0.

`GET /api/topics/:topicId/classes?courseId=…` returns `isNew` (a boolean) on each class.

The two fields always agree. A topic's `newClassCount` equals the number of its classes with `isNew: true`.

## Before launch

Until the AppX migration stops, the nightly import puts that morning's date on every class it places. Those
classes show NEW on the day they are imported.

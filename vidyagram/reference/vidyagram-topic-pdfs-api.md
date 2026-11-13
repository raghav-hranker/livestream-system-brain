# PDFs on the topic screen (app guide)

Live since 2026-11-04 18:25 IST (vidyagram-admin `bc34f5730`, pm2 92).

## What changes

`GET /api/topics/:topicId/classes?courseId=…` returns one new key, `data.pdfs`. Everything else in the response stays
the same, so app versions that don't read `pdfs` keep working.

```json
{
  "state": 200,
  "msg": "Classes retrieved for topic successfully",
  "data": {
    "topicId": "...",
    "courseId": "...",
    "subTopic": [],
    "classes": [],
    "pdfs": [
      { "id": "<pdf id>", "title": "Algebra Notes", "isFree": false, "isDownloadable": true, "priority": 12, "...": "..." }
    ]
  }
}
```

## How to use it

- Each entry in `pdfs` is the same item that `GET /api/courses/:courseId/pdfs` returns for the Ebooks tab. Reuse the
  same model and row.
- `pdfs` is already in display order. It is `[]` when the topic has no PDFs. Hide the PDF folder in that case.
- There is no file URL in the item. Open a PDF with `GET /api/courses/:courseId/pdfs/:pdfId/access`, using `id` as
  `pdfId`. Don't use `_id`, which identifies the PDF's placement in the course.
- Draw the folders on the app side. The Video folder shows `classes.length` videos and the PDF folder shows
  `pdfs.length` files. The API sends no folder objects.
- `pdfs` belongs to the whole topic. PDFs have no subtopic, so don't try to group them by `subTopic`.
- The Ebooks tab doesn't change. A PDF appears in both places, which is intended.
- Show locks the same way as on the Ebooks tab. The server still checks access when the PDF is opened.

## Which PDFs appear

A PDF appears when its section and topic names in this course match the names shown on the topic's classes.
Capitals and extra spaces don't matter, unless the course has a topic spelled exactly like the PDF's topic. In that
case the PDF appears only on that topic, so it never shows on two screens.

This means `topic.topicName` on a PDF can differ in capitals from the topic the app opened ("AGES" on the "Ages"
screen). Show the topic name from the topic list, not from the PDF.

A PDF stays in the Ebooks tab only in these two cases:

- It has no topic (the All Notes card).
- Its topic has no classes in this course. The topic list (`GET /api/topic-and-section`) is built from classes, so
  that topic doesn't appear in the app. The next section closes this case once it is live.

## PDF count on the topic list

Live since 2026-11-05 17:02 IST (vidyagram-admin `f94886a7a`, pm2 92).

`GET /api/topic-and-section?courseId=…` sends `pdfCount` next to `classCount` on each row of `topics`:

```json
{ "topicId": "...", "topicName": "Algebra", "classCount": 16, "pdfCount": 3 }
```

- Use `classCount` for the Video folder and `pdfCount` for the PDF folder without opening the topic.
- `pdfCount` always equals `pdfs.length` on `GET /api/topics/:topicId/classes`. It is `0` when the topic has no PDFs.
- `classCount` stays as it is. `sections[].classCount` also stays, and sections have no `pdfCount`, because `pdfs`
  belongs to the whole topic.

## Folders with only PDFs (not live yet)

Some folders hold PDFs and no classes, such as "Printable Practice Workbook" in UPGK. To get them, add
`includePdfFolders=1`:

`GET /api/topic-and-section?courseId=…&includePdfFolders=1`

- Each folder is a normal row in `topics`, with the same keys as any topic plus `pdfCount`, and `classCount: 0`.
- Folder rows come after the regular topics. Keep the server's order, and don't re-sort by `priority`.
- Open one with the usual `GET /api/topics/:topicId/classes?courseId=…`. `classes` is `[]` and `pdfs` has `pdfCount`
  items. Show only the PDF folder on that screen.
- Don't show progress for these rows. `completionPercentage` is 0, and `isCompleted` is false.
- Without `includePdfFolders=1` the response stays as it is today, so older app versions see no change.
- A course with no classes can return folder rows only, so don't treat a course with no classes as an empty course.

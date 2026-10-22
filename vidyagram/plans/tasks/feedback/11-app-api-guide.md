# App team API guide

**Type**: AFK
**Blocked by**: 02, 03, 04
**Repo**: system-brain

## What to build

`vidyagram/reference/vidyagram-feedback-api-guide.md`, in the style of
`vidyagram/reference/vidyagram-catalogue-api-guide.md`, for the app team building the Rate sheet:

- Where "Rate" appears (course, practice batch, class, PDF, test, ebook screens) and the sheet's flow:
  stars, then complaint tags only at 1 to 3 stars, then an optional note; editing an earlier rating.
- `GET /api/feedback/tags` with and without `kind`, and the advice to fetch all kinds once at startup.
- `GET /api/feedback/mine` and `PUT /api/feedback`, with a sample request and response per kind, the
  `parent` rule (which screens send a course parent, which a practice batch parent), and every error code
  with the message to show.
- Clearing tags when a student raises a rating to 4 or 5 stars.

Sample responses come from real calls against the local integration backend, not hand-written.

## Acceptance criteria

- [ ] Guide committed in system-brain, with real sample responses for all six kinds.
- [ ] Each error code in the guide reproduced once against the local backend.
- [ ] Not sent to the app team until the user says so (sending happens in 12 or on request).

## User stories covered

- Stories 23, 24

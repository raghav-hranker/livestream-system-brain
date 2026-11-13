# Create route: course, outline and builder in one transaction

**Type**: AFK
**Blocked by**: 01, 02
**Repo**: backend

## What to build

`POST /api/admin/course-playground/courses` in the task 02 router. PRD sections "Data the playground writes",
"Taxonomy resolution".

- Body (JSON, or multipart with a `payload` JSON field plus `banner` through the existing banner upload):
  - `details`: `title, shortDescription?, mainCategory, category, isLive, isRecorded, faculties: [id], validity,
    showInBatchFilter?, closeAdmission?, tags?, priority?` (field names as the existing Course model uses them).
  - `outline`: `[{name, sourceId?, topics: [{name, sourceId?, subtopics: [{name, sourceId?, items: [{kind, id,
    sourceCourseId}]}]}]}]` in order. `sourceId` = the taxonomy id the group had in the source when it was not
    renamed or moved (the admin sends it; the server re-checks that the name still matches).
  - `builder`: the task 01 save body (`chapters` keyed by the position of the topic in `outline`, e.g.
    `{sectionIndex, topicIndex, weight, customPrice?}`, since topic ids exist only after resolution).
  - `status`: `0 | 1`.
- Validate everything before writing: zod schema; every item exists and is placed in its `sourceCourseId`; no item
  twice; title free; categories exist; faculties exist; builder rules (`courseBuilderError`) against the outline
  being built. The first problem ⇒ 400 with a sentence the admin understands and the path of the bad field.
- Taxonomy resolver as a pure module (inputs: the outline names/sourceIds and the existing records found;
  output: reuse / find / create per group), then one transaction (`startPrimarySession` + `withTransaction`) that:
  creates missing Section/Topic/SubTopic records, the Course (status exactly as sent), `CourseClass` rows (copying
  `isRevision`, `isFree`, `startDate`, `endDate` from the source placement; per-course taxonomy overrides and cached
  names), `CourseTopic` order rows, `CoursePdf` rows (names; `isFree` copied), `CourseTest` rows (topic id,
  `overrideSectionName` when needed, `customTag`, `isFree`, `maxAttemptedLimit`, `startDate` copied), and
  `Course.builder` with `enabled: true`. Items in a "Section-wide" group are placed with no topic (PDF/test) — a class
  there is refused (the builder needs every class filed).
- Returns `{data: {courseId}}`. Logs the create without request bodies (see the prod-logs rule).

## Acceptance criteria

- [ ] Unit: resolver — unchanged name reuses the source id; renamed topic finds an existing same-named topic under the
      resolved section, else creates one; a topic moved under another section never reuses a topic of the old section.
- [ ] Integration: a create from two source courses places every class once (a class from both sources once), PDFs
      and tests under the right names/topics, copies `isRevision`/`isFree`, and saves the builder.
- [ ] Integration: `status: 0` creates an inactive course.
- [ ] Integration: builder weights summing to 99% ⇒ 400 and no Course, placement or taxonomy record exists after.
- [ ] Integration: a renamed topic creates one new Topic; the source course's placements and topics are unchanged
      (compare before/after documents).
- [ ] Integration: a class in a "Section-wide" group ⇒ 400 naming it; an item not in its `sourceCourseId` ⇒ 400; a
      taken title ⇒ 400.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 4, 5, 7, 12, 20, 21

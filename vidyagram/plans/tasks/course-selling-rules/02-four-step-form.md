# Four-step form with today's fields

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: Admin

## What to build

Move the existing course form onto four steps: Basic Information, Pricing, Content, Settings, in the compact layout from the prototype. Steps sit down the left with a one-line summary under each. Today's fields keep their meaning, and nothing about selling changes.

For a new course, the first Continue saves a draft and steps 2 to 4 stay locked until then, because classes can only be assigned to a course that exists. New courses start as Draft. Is Free moves to Settings. Combo and Close Admission stay as today until their tasks.

## Acceptance criteria

- [ ] A new course can't pass step 1 without title, description, main category, category and faculty, and the form says which are missing.
- [ ] The first Continue creates a Draft course that students can't buy, and unlocks the other steps.
- [ ] Editing an existing course saves the same data as the old form.
- [ ] Component tests cover step locking and the required fields. A browser click-through passes.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 2, 3

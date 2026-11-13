# Issue tracker: Local Markdown

PRDs and implementation plans for this system live as Markdown under `docs/plans/`.
Vidyagram-only PRDs and tasks live under `vidyagram/plans/` with the same conventions (see `TENANTS.md`).

## Conventions

- PRDs use `docs/plans/prd-<feature-slug>.md`.
- Implementation tasks may use a feature directory under `docs/plans/tasks/` when the work is split into independently executable slices.
- Task filenames begin with a two-digit sequence number when ordering matters.
- Workflow state is recorded near the top of a PRD or task using the vocabulary in `triage-labels.md`.
- Cross-repo plans identify the owning repo for each contract half and link authoritative ADRs rather than duplicating their definitions.

## When a skill says "publish to the issue tracker"

Create or update the corresponding Markdown document under `docs/plans/`.

## When a skill says "fetch the relevant ticket"

Read the referenced file under `docs/plans/` and any linked ADRs or per-repo domain docs.

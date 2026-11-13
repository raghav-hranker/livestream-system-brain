# Domain docs

System Brain is a multi-context repository for independently deployed services.

## Before exploring

- Read `SYSTEM.md` for whole-system wiring and ownership.
- Read `GLOSSARY.md` for shared contract vocabulary.
- Read `BRANCHES.md` and `repos.manifest` before planning cross-repo delivery.
- Read relevant ADRs under `docs/adr/` and the matching vertical-slice file under `slices/` when one exists.
- Follow links to the owning repo's `CONTEXT.md`, `MAP.md`, and ADRs for per-repo definitions.

## Consumer rules

- Use the exact shared terms defined in `GLOSSARY.md`.
- Do not duplicate a per-repo definition in System Brain; link to the authoritative source.
- Treat `quicktricks-admin` and `quicktricks-backend` as the deployed QuickTricks forks when `SYSTEM.md` says they are the production pair.
- Surface conflicts with existing ADRs instead of silently overriding them.
- A cross-repo PRD must name every contract half, its durable owner, and its real-time consumer.

# slices/ — vertical-slice playbooks

One file per recurring piece of work that crosses a contract boundary between the services. A playbook is the
artifact you hand a fresh Claude session at the start of slice work: it names the ordered hops, the exact files
to touch in each repo, the contract that must stay in sync, and how to test end-to-end.

A playbook **references**, never restates. Link into `SYSTEM.md`, `GLOSSARY.md`, and the per-repo docs.

## Template

```md
# Slice: <name>
**Goal:** <user-visible outcome>
**Why it's a slice:** <which boundary it crosses + the subtlety that bites>

## The hops (in order)
1. <repo> — <what> — `repos/<repo>/<file>`
2. ...

## The contract that must stay in sync
<the field/shape both ends must agree on; any rename at the edge>

## End-to-end test
<steps to prove it works across repos>

## Failure-surface cheatsheet
<symptom → which hop is wrong>
```

## Existing playbooks
- [`secured-prerecorded-playback.md`](./secured-prerecorded-playback.md)

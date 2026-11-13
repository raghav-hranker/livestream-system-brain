# Video repair execution checkpoint

**Production: preview only. No queue, placement, deployment, or rollback mutation attempted.**

Parent explicitly stopped production mutations after the approval reviewer rejected related operations. This track did not attempt a production write. Human repair authorization was retrieved and reviewed, but it does not bypass that block. Continue only after the parent resolves direct approval in this chat.

## Ready commands

Run from `/Users/raghav/Projects/system-brain`, in order after approval is resolved:

```sh
node reference/scripts/vidyagram-video-importer-deploy.cjs --check
node reference/scripts/vidyagram-video-importer-deploy.cjs --apply
node reference/scripts/vidyagram-video-replacement-repair.cjs --queue
node reference/scripts/vidyagram-video-replacement-repair.cjs --status
```

The first command is read-only. Apply overlays only the catalogue importer on test-uday, verifies original SHA2568308086db7ff8b82632ac03e931804a0c8c1ef9099033745dd14d0bfa037dfbb, refuses a running nightly, holds its host lock, backs up source and REVISION, then replaces exactly one source file. It starts no job or service. Source SHA after patch339fbd448374b740c4104f1e3c0c07361d63d662afb5f15c55bcda94ded3b59b.

Queue creates exactly two jobs and two ledger rows; the existing worker may claim them. Check status until both new jobs are done and both Classes have hlsAsset. Then:

```sh
node reference/scripts/vidyagram-video-replacement-repair.cjs --storage
node reference/scripts/vidyagram-video-replacement-repair.cjs --place
node reference/scripts/vidyagram-video-replacement-repair.cjs --status
```

Storage downloads each native master, every rendition manifest, and first/middle/last segment in every rendition. It requires complete VOD manifests and validates nonempty segment bytes/TS sync. Place refuses without this exact-asset storage proof and inserts the four listed placements transactionally. It does not deactivate older Geometry or rename anything. A real enrolled-student playback HTTP check remains to be performed after placement; storage verification alone is not an authorization test.

Post-placement saves exact post-repair BSON. Guarded data rollback:

```sh
node reference/scripts/vidyagram-video-replacement-repair.cjs --rollback
```

Rollback refuses nonterminal workers, subsequent edits, or absent complete checkpoint. It deletes only the recorded four placements, two repair ledger docs, two new jobs, and restores the original two Class docs. Storage objects remain recoverable. If repair stops before placement, do not use completed rollback automatically: inspect the saved queue result and terminal state, then remove only those scoped queue/ledger documents using the before backup.

Source rollback uses the exact remote backup path returned by deploy-result.json; restore only its apxCatalogClassCommit.ts and REVISION after checking current repaired SHA and holding the same host lock. No push, Quicktricks change, broad nightly run, index removal, or service restart is included.

## Validation

The integration regression failed on the original source with E11000 at apxCourseId_1_apxClassId_1 when a new Class reused source row193547. After the alternate-current-source fix,45 focused tests pass; output in regression-tests.txt. Typecheck evidence is typecheck.txt (zero output on success). The source test also asserts ledger provenance follows the selected course161 representative and all-reserved pairs are refused before Class creation.

Dead job classification is complete:131 no-playable-URL and52 source404; none retried. No claim is made that every historical source is recoverable or that every future replacement has a free alternate pair.

# 07 — Complete the authenticated admin chat-moderation surface

Type: AFK  
Status: `ready-for-agent`  
User stories: 7–20, 22, 36–37, 44

## Parent

[PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md)

## What to build

Finish the operational dashboard on the canonical LMS interfaces established by the earlier tracer
bullets. Administrators can search, filter, paginate, distinguish sources/scopes, select a class for
Class scope, create restrictions, and remove a specific restriction. APX-imported, host-created, and
admin-created records share one normalized list. Permission, loading, empty, validation, mutation,
partial-data, and retry states must be explicit and must never fall back to the livestream ban store.

## Acceptance criteria

- [ ] The page uses only authenticated LMS list/create/remove interfaces for moderation data and mutations.
- [ ] Search supports user identity fields and class context without leaking records from another customer.
- [ ] Pagination, scope filtering, and source filtering are server-authoritative and preserve filters across refetches.
- [ ] Rows distinguish Class and Platform chat bans and show class context only where applicable.
- [ ] Rows render current user data when available and retained snapshots for unmatched/imported users.
- [ ] APX source and original block time, host/admin source, created/updated audit fields, and active status are normalized consistently.
- [ ] Class create requires user plus selected class; Platform create requires user and no class.
- [ ] Removal addresses a restriction ID, asks for confirmation, and cannot remove sibling restrictions accidentally.
- [ ] Loading, empty, permission-denied, validation, network-error, conflict/idempotent, and successful mutation states have distinct behavior.
- [ ] Query invalidation/refetch shows authoritative LMS state after mutation and never fabricates a local row.
- [ ] Admin permission vocabulary includes the page and server route; an authenticated admin lacking permission cannot list or mutate restrictions.
- [ ] UI and query/mutation tests cover imported rows, both scopes, targeted removal, pagination/filtering, authorization, and failure states.

## Blocked by

- [03 — Admin Platform chat ban fanout](03-admin-platform-ban-fanout.md)

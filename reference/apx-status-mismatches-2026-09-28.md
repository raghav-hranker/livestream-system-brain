# AppX ↔ platform status mismatches (parked 2026-09-29)

Source: `outputs/apx-content-audit-2026-09-28-v2/audit.json` (`findings[].issue == "Status mismatch"`), the
deleted-folder-aware audit of 2026-09-28 (customer 472, 116 AppX courses).

**Decision (2026-09-29): leave all of these alone for now.** Recorded for a later pass. The catalogue-completeness
work (`docs/plans/prd-apx-catalogue-completeness.md`) does not flip them.

Suggested rule when this is picked up: if the platform record was edited after the migration, someone switched it on
purpose, so leave it. If it's untouched since import, align it with AppX.

## Totals (81 rows)

| Kind | AppX → platform | Rows |
|---|---|---|
| Classes | active → inactive | 31 |
| Class notes | active → inactive | 27 |
| Classes | inactive → active | 12 |
| Class notes | inactive → active | 11 |

## Classes in active courses (19)

AppX courses: 11 = RRB Record Breaking 2025, 12 = Railway Maths Foundation (VOD), 23 = SSC Record Breaking (SRB) VOD,
90 = Railway Foundations Mastery (RMB).

| AppX course | Title | AppX row | Platform class | AppX → platform |
|---|---|---|---|---|
| 11 | REASONING SPEED BOOSTER \|\| CLASS-01 | 1720 | 6a4561b6ebb42f585d9e9181 | active → inactive |
| 11 | Reasoning Next Target क्या होगा ? Very Important Class | 1819 | 6a456153ebb42f585d9e6a91 | active → inactive |
| 11 | Class-01 \|\| Data Interpretation | 10922 | 6a45612aebb42f585d9e5a11 | active → inactive |
| 11 | Class-60 \|\|The Mughal Empire-Other Aspects of Mughal Empire- Part 1 | 15955 | 6a4560eeebb42f585d9e4499 | active → inactive |
| 11 | RRB JE 2024 All Shifts Top Questions | 32058 | 6a4560c2ebb42f585d9e3535 | active → inactive |
| 11 | RPF SI 2024 Top Questions | 32059 | 6a4560c2ebb42f585d9e353c | active → inactive |
| 11 | Maths-Average Speed Questions Average Speed Short Tricks | 32093 | 6a4560c3ebb42f585d9e35d9 | active → inactive |
| 12 | Maths-Average Speed Questions Average Speed Short Tricks | 32026 | 6a455f8eebb42f585d9dbc61 | active → inactive |
| 23 | Class-01 \|\| Data Interpretation | 10920 | 6a456027ebb42f585d9df97a | active → inactive |
| 23 | Class-60 \|\|The Mughal Empire-Other Aspects of Mughal Empire- Part 1 | 15953 | 6a456085ebb42f585d9e1d5c | active → inactive |
| 90 | Maths-Average Speed Questions Average Speed Short Tricks | 38659 | 6a455b25ebb42f585d9bea68 | active → inactive |
| 11 | Class-1 \|\| Perioidic table intro | 20124 | 6a4560d3ebb42f585d9e3b8e | inactive → active |
| 11 | Class-02 \|\| Perioidic table | 20162 | 6a4560d3ebb42f585d9e3b9c | inactive → active |
| 12 | Geometry \|\| Class - 02 \|\| Quadrilateral | 27847 | 6a455f7eebb42f585d9db584 | inactive → active |
| 23 | CLASS-04 \|\| HIMALAYA | 3132 | 6a456077ebb42f585d9e17f7 | inactive → active |
| 23 | Class-01 \|\| PRACTICE EXERCISE NOUNS | 20063 | 6a45605bebb42f585d9e0d7d | inactive → active |
| 23 | Class-1 \|\| Perioidic table intro | 20123 | 6a455ffeebb42f585d9de9c9 | inactive → active |
| 23 | Class-02 \|\| Perioidic table | 20161 | 6a455ffeebb42f585d9de9d7 | inactive → active |
| 23 | Class-02 \|\| PRACTICE EXERCISE NOUNS | 20175 | 6a45605bebb42f585d9e0d8b | inactive → active |

The "Average Speed Short Tricks" class is inactive on the platform in four courses (11, 12, 90, and 91 where it is
deleted in AppX). That looks like a deliberate switch-off, not an import leftover.

The other 62 rows (inactive courses, and all class-note rows) are in `audit.json`.

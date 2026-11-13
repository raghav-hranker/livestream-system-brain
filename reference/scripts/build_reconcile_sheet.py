import csv, json, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

R = '/Users/raghav/Projects/system-brain/reference/'
d = json.load(open(R + 'reconcile_dry_run.json'))
changes = list(csv.DictReader(open(R + 'reconcile_dry_run_changes.csv')))
names = {}
for r in csv.DictReader(open(R + 'section_kinds.csv')): names[r['id']] = r['name']
for r in csv.DictReader(open(R + 'topic_audit.csv')): names[r['id']] = f"{r['sectionName']} > {r['name']}"
for r in d['subRows']: names.setdefault(r['id'], r['name'])

F = 'Arial'
HEAD = Font(name=F, bold=True, color='FFFFFF'); BODY = Font(name=F, size=10); BOLD = Font(name=F, bold=True, size=10)
FILL = PatternFill('solid', fgColor='1F4E78'); NOTE = Font(name=F, italic=True, size=9, color='555555')
wb = Workbook()

def table(ws, title, header, rows, widths=None, start_row=1):
    for c, h in enumerate(header, 1):
        cell = ws.cell(start_row, c, h); cell.font = HEAD; cell.fill = FILL; cell.alignment = Alignment(wrap_text=True, vertical='top')
    for i, row in enumerate(rows, start_row + 1):
        for c, v in enumerate(row, 1):
            ws.cell(i, c, v).font = BODY
    if rows:
        ref = f"A{start_row}:{get_column_letter(len(header))}{start_row + len(rows)}"
        t = Table(displayName=title, ref=ref); t.tableStyleInfo = TableStyleInfo(name='TableStyleLight9', showRowStripes=True); ws.add_table(t)
    ws.freeze_panes = ws.cell(start_row + 1, 1)
    for c, w in enumerate(widths or [], 1): ws.column_dimensions[get_column_letter(c)].width = w

# 1 Read me
ws = wb.active; ws.title = 'Read me'
s = d['summary']
lines = [
    ('Sections and topics reconciliation: dry run', BOLD),
    (f"Generated {s['generatedAt']} from prod, read-only. Nothing in this sheet has been applied.", BODY),
    ('Plan: docs/plans/prd-sections-topics-reconciliation.md. Script: reference/scripts/reconcile_dry_run.cjs.', BODY),
    ('', BODY),
    ('What this cleanup does', BOLD),
    ('1. Switches off sections (and, if approved, topics) that hold nothing. Nothing is ever deleted; status goes from 1 to 0.', BODY),
    ('2. Merges sections that share a name: everything filed under the extra copies moves onto one kept copy, then the copies are switched off.', BODY),
    ('3. Topics that clash after a merge are merged the same way; the topic already in the kept section is the one kept.', BODY),
    ('4. Old test papers and student history (scores, answers, saved/reported questions, practice logs) are NOT changed. See the Untouched tab.', BODY),
    ('5. Students see only the three approved spellings change: ADVANCE -> Advance, ARITHMETIC -> Arithmetic, E-BOOK -> E-Book.', BODY),
    ('', BODY),
    ('Headline findings', BOLD),
    (f"No course uses two copies of the same section today (measured twice: {s['coursesWithCombinedTabsOrTopics']} and {s['coursesWithTwoCopiesCrossCheck']}). The duplicates are an admin dropdown problem, not a student page problem.", BODY),
    (f"No test paper contains two copies of one section name ({s['testPapersWithTwoCopiesOfOneName']}).", BODY),
    (f"Hard stops: {s['hardStops']}. Warnings: {s['warnings']} (see Warnings tab).", BODY),
    ('', BODY),
    ('Tabs', BOLD),
    ('Summary: counts of every change, by phase and field (formulas over the Every change tab).', BODY),
    ('Sections: the 25 merge groups, which copy is kept, renamed or switched off.', BODY),
    ('Empty sections / Empty topics: what gets switched off because it holds nothing.', BODY),
    ('Topics / Subtopics: merges and moves.', BODY),
    ('Courses touched: every course with a placement that changes, and whether students see anything.', BODY),
    ('Untouched: old tests and student history left on the old ids, with counts.', BODY),
    ('Custom names: course folder names typed by admins, left alone.', BODY),
    ('Optional spellings: spelling changes we are NOT making (students would see them), for a decision.', BODY),
    ('Every change: one row per field that would change, with old and new value.', BODY),
    ('', BODY),
    ('Decisions still open', BOLD),
    ('A. Keep the copy with the most content in each group (Sections tab, action "keep").', BODY),
    (f"B. Switch off the {s['emptyTopicsSwitchedOffIfApproved']} empty topics (Empty topics tab).", BODY),
    (f"C. Make any of the {s['optionalSpellingChangesNotMade']} optional spelling changes (default: none).", BODY),
]
for i, (t, f) in enumerate(lines, 1): ws.cell(i, 1, t).font = f
ws.column_dimensions['A'].width = 140

# 13 Every change (built early so Summary formulas can reference it)
ev = wb.create_sheet('Every change')
rows = [[c['phase'], c['group'], c['collection'], c['docId'], c['field'], c['from'], names.get(c['from'], ''), c['to'], names.get(c['to'], ''), c['note']] for c in changes]
table(ev, 'EveryChange', ['Phase', 'Group', 'Collection', 'Document id', 'Field', 'From', 'From (name)', 'To', 'To (name)', 'Note'], rows, [26, 24, 16, 26, 34, 30, 36, 30, 36, 40])
n = len(rows) + 1

# 2 Summary
sm = wb.create_sheet('Summary', 1)
pairs = sorted({(c['phase'], c['collection'], c['field']) for c in changes})
groups = {}
for ph, coll, fld in pairs:
    base = fld.split('.')[0] if fld.startswith('apxDisplayPlacements') else fld
    key = (ph, coll, base if not fld.startswith('apx') else 'apxDisplayPlacements[].' + fld.split('.')[-1])
    groups.setdefault(key, []).append(fld)
sm.cell(1, 1, 'Changes by phase and field').font = BOLD
hdr = ['Phase', 'Collection', 'Field', 'Records changed']
for c, h in enumerate(hdr, 1):
    x = sm.cell(3, c, h); x.font = HEAD; x.fill = FILL
r = 4
for (ph, coll, fld), flds in sorted(groups.items()):
    sm.cell(r, 1, ph).font = BODY; sm.cell(r, 2, coll).font = BODY; sm.cell(r, 3, fld).font = BODY
    if fld.startswith('apxDisplayPlacements'):
        f = f'=COUNTIFS(\'Every change\'!$A$2:$A${n},A{r},\'Every change\'!$C$2:$C${n},B{r},\'Every change\'!$E$2:$E${n},"apxDisplayPlacements.*.{fld.split(".")[-1]}")'
    else:
        f = f'=COUNTIFS(\'Every change\'!$A$2:$A${n},A{r},\'Every change\'!$C$2:$C${n},B{r},\'Every change\'!$E$2:$E${n},C{r})'
    sm.cell(r, 4, f).font = BODY; sm.cell(r, 4).number_format = '#,##0'
    r += 1
sm.cell(r, 3, 'Total').font = BOLD; sm.cell(r, 4, f'=SUM(D4:D{r-1})').font = BOLD; sm.cell(r, 4).number_format = '#,##0'
sm.cell(r + 1, 1, "Phase 2 empty topics apply only if decision B is approved. Counts are formulas over the 'Every change' tab.").font = NOTE
r += 3
sm.cell(r, 1, 'Key numbers (from the dry-run script output, reconcile_dry_run.json)').font = BOLD
labels = [('Sections active today', 'sectionsActiveToday'), ('Empty sections switched off', 'emptySectionsSwitchedOff'), ('Empty topics switched off (if approved)', 'emptyTopicsSwitchedOffIfApproved'),
          ('Section merge groups', 'mergeGroups'), ('Sections merged away', 'sectionsMergedAway'), ('Sections renamed (approved spellings)', 'sectionsRenamed'),
          ('Topics merged away', 'topicsMergedAway'), ('Topics moved to the kept section', 'topicsMovedAcross'), ('Subtopics merged away', 'subtopicsMergedAway'),
          ('Subtopics moved with their topic', 'subtopicsMovedWithTopic'), ('Courses touched (ids change underneath)', 'coursesTouched'),
          ('Courses where students see tabs combine', 'coursesWithCombinedTabsOrTopics'), ('Custom course folder names left alone', 'customNamesLeftAlone'),
          ('Optional spelling changes not made', 'optionalSpellingChangesNotMade'), ('Test papers holding two copies of one name', 'testPapersWithTwoCopiesOfOneName')]
for i, (lab, k) in enumerate(labels, r + 1):
    sm.cell(i, 1, lab).font = BODY; c = sm.cell(i, 4, s[k]); c.font = BODY; c.number_format = '#,##0'
sm.cell(r + 1 + len(labels), 1, 'Section dropdown after cleanup = sections active today - empty sections - sections merged away').font = BODY
sm.cell(r + 1 + len(labels), 4, f'=D{r+1}-D{r+2}-D{r+5}').font = BOLD
for col, w in zip('ABCD', [44, 18, 34, 16]): sm.column_dimensions[col].width = w

# 3 Sections
ws = wb.create_sheet('Sections', 2)
table(ws, 'Sections', ['Group', 'Action', 'Section id', 'Name now', 'Name after', 'Customer', 'Items filed (classes, placements, PDFs, questions, tests)', 'Breakdown'],
      [[x['group'], x['action'], x['id'], x['name'], x['nameAfter'], x['customer_id'], x['content'], json.dumps(x['detail'])] for x in d['sectionRows']], [22, 24, 26, 30, 30, 10, 18, 70])

# 4 Empty sections / topics
es = [c for c in changes if c['phase'].startswith('2 empty sections')]
ws = wb.create_sheet('Empty sections', 3)
table(ws, 'EmptySections', ['Section id', 'Name', 'Change'], [[c['docId'], c['note'], 'status 1 -> 0'] for c in es], [26, 50, 16])
et = [c for c in changes if c['phase'].startswith('2 empty topics')]
ws = wb.create_sheet('Empty topics', 4)
table(ws, 'EmptyTopics', ['Topic id', 'Section > Topic', 'Change (only if decision B approved)'], [[c['docId'], c['note'], 'status 1 -> 0'] for c in et], [26, 70, 30])

# 5 Topics / Subtopics
ws = wb.create_sheet('Topics', 5)
table(ws, 'Topics', ['Phase', 'Group', 'Action', 'Topic id', 'Topic', 'From section', 'Merges into topic id', 'Merges into', 'On AI-test list', 'Items filed', 'Student practice records', 'Course order rows', 'Subtopics'],
      [[x['phase'], x['group'], x['action'], x['id'], x['name'], x.get('fromSectionName') or '', x['intoId'], x['intoName'], 'yes' if x['aiTestTopic'] else '', x['content'], x['studentLogs'], x['courseOrderRows'], x['subtopics']] for x in d['topicRows']],
      [22, 24, 20, 26, 34, 28, 26, 30, 10, 10, 12, 10, 10])
ws = wb.create_sheet('Subtopics', 6)
table(ws, 'Subtopics', ['Phase', 'Group', 'Action', 'Subtopic id', 'Subtopic', 'Into (id)', 'Into', 'Items filed', 'Saved questions (left alone)'],
      [[x['phase'], x['group'], x['action'], x['id'], x['name'], x['intoId'], x['intoName'], x['content'], x['savedQuestions']] for x in d['subRows']], [22, 24, 18, 26, 34, 26, 30, 10, 14])

# 6 Courses
ws = wb.create_sheet('Courses touched', 7)
table(ws, 'Courses', ['Course id', 'Course', 'Merge groups it uses', 'Placements: section id changes', 'Placements: topic id changes', 'Placements: subtopic id changes', 'Approved spelling changes', 'Optional spelling changes (not made)', 'Topic order rows', 'What students see'],
      [[x['course'], x['title'], x['groupsUsed'], x['sectionRepointed'], x['topicRepointed'], x['subTopicRepointed'], x['spellingChanges'], x['optionalSpellingChanges'], x['topicOrderRows'], x['studentVisible']] for x in d['courseRows']],
      [26, 50, 30, 14, 14, 14, 14, 16, 10, 26])

# 7 Untouched
ws = wb.create_sheet('Untouched', 8)
why = {'series': 'test paper', 'seriesSection': 'test paper sections', 'seriesCutoff': 'test paper cut-offs', 'seriesQMap': 'test paper question map', 'apxSeriesMap': 'import map (imports stopped)',
       'aiTestPattern': 'AI test pattern', 'savedQuestion': "students' saved questions", 'reportQuestion': "students' reported questions", 'score': "students' scores",
       'answer': "students' answers", 'seriesChapter': 'test paper chapters', 'studentLog': "students' practice records"}
table(ws, 'Untouched', ['Level', 'Collection', 'Field', 'What it is', 'Records left pointing at the old copy'],
      [[x['level'], x['collection'], x['field'], why.get(x['what'], x['what']), x['documents']] for x in d['untouched']], [10, 22, 34, 30, 22])

# 8 Custom names / optional spellings / warnings
ws = wb.create_sheet('Custom names', 9)
table(ws, 'CustomNames', ['Group', 'Collection', 'Document id', 'Field', 'Name the course shows (kept)', 'Merged section name'],
      [[x['group'], x['collection'], x['docId'], x['field'], x['storedName'], x['wouldBe']] for x in d['customNames']], [22, 14, 26, 30, 40, 30])
ws = wb.create_sheet('Optional spellings', 10)
table(ws, 'OptionalSpellings', ['Group', 'Collection', 'Document id', 'Course id', 'Field', 'Students see now', 'Would become'],
      [[x['group'], x['collection'], x['docId'], x.get('course', ''), x['field'], x['from'], x['to']] for x in d['optionalRenames']], [22, 14, 26, 26, 22, 30, 30])
ws = wb.create_sheet('Warnings', 11)
wrows = [['warning', w['group'], w['what']] for w in d['warnings']] + [['hard stop', h['group'], h['what']] for h in d['hardStops']]
wrows.append(['note', 'all', f"{s['aiTestQuestionsChangingTopic']} ai-test questions change topic, but none sit on an AI-test-list topic, so no AI test draws them."])
table(ws, 'Warnings', ['Kind', 'Group', 'Detail'], wrows, [12, 24, 120])

out = R + 'sections-topics-dry-run-2026-10-06.xlsx'
wb.save(out); print(out, len(rows))

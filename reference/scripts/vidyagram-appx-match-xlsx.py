#!/usr/bin/env python3
"""Offline: turns the JSON from vidyagram-appx-match-report.cjs into the stakeholder spreadsheet.

Sheet 1 "Summary" has one row per checklist item: AppX rows checked, matched, gaps, and the top gap reasons.
Then one sheet per item with the outcome totals and every row the report kept (gaps only for the big
item-level sheets). Needs openpyxl (a venv is fine).

    python3 vidyagram-appx-match-xlsx.py <report.json> [out.xlsx]
"""
import json
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

SHEET_NAMES = {
    'courses': 'Courses', 'classes': 'Classes', 'ebooks': 'Ebooks (PDF)', 'classNotes': 'PDFs on Classes',
    'subCourses': 'Sub Courses', 'prices': 'Prices', 'dailySync': 'Daily Sync', 'validity': 'Validity',
    'faculty': 'Faculty (courses)', 'facultyClass': 'Faculty (classes)', 'mainCategory': 'Main Category',
    'category': 'Category', 'section': 'Section', 'topic': 'Topic', 'subTopic': 'Sub Topics',
    'taxonomyCounts': 'Taxonomy counts', 'tags': 'Tags',
}
HEAD = Font(bold=True, color='FFFFFF')
HEAD_FILL = PatternFill('solid', fgColor='1F3A5F')
GAP_FILL = PatternFill('solid', fgColor='FDECEA')
OK_FILL = PatternFill('solid', fgColor='E8F5E9')


def is_ok(outcome):
    return outcome.startswith('ok')


def is_info(outcome):
    return outcome.startswith('info')


def header(ws, row, values):
    for i, v in enumerate(values, 1):
        c = ws.cell(row=row, column=i, value=v)
        c.font, c.fill = HEAD, HEAD_FILL


def widths(ws, cap=60):
    for col in ws.columns:
        n = max((len(str(c.value)) for c in col if c.value is not None), default=8)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max(n + 2, 8), cap)


def main():
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix('.xlsx')
    report = json.loads(src.read_text())
    wb = Workbook()
    summary = wb.active
    summary.title = 'Summary'
    summary['A1'] = 'Vidyagram: AppX match report'
    summary['A1'].font = Font(bold=True, size=14)
    summary['A2'] = f"Generated {report['generatedAt'][:16].replace('T', ' ')} UTC from the AppX mirror ({'live CMS course list' if report['live'] else 'mirror course list'}). Read-only."
    header(summary, 4, ['Item', 'Checked', 'Matched', 'Gaps', 'Match %', 'Not applicable', 'Top gap reasons', 'What is checked'])
    r = 5
    for key, sec in report['items'].items():
        if not sec:
            continue
        totals = sec['totals']
        info = sum(n for o, n in totals.items() if is_info(o))
        checked = sum(totals.values()) - info
        matched = sum(n for o, n in totals.items() if is_ok(o))
        gaps = sorted(((n, o) for o, n in totals.items() if not is_ok(o) and not is_info(o)), reverse=True)
        values = [sec['title'], checked, matched, checked - matched,
                  round(100 * matched / checked, 1) if checked else None, info or None,
                  '; '.join(f'{n} {o}' for n, o in gaps[:4]), sec['note']]
        for i, v in enumerate(values, 1):
            summary.cell(row=r, column=i, value=v).alignment = Alignment(wrap_text=i >= 7, vertical='top')
        summary.cell(row=r, column=4).fill = GAP_FILL if checked - matched else OK_FILL
        r += 1

        ws = wb.create_sheet(SHEET_NAMES.get(key, key)[:31])
        ws['A1'] = sec['title']
        ws['A1'].font = Font(bold=True, size=13)
        ws['A2'] = sec['note']
        header(ws, 4, ['Outcome', 'Count'])
        rr = 5
        for o, n in sorted(totals.items(), key=lambda x: -x[1]):
            ws.cell(row=rr, column=1, value=o).fill = OK_FILL if is_ok(o) or is_info(o) else GAP_FILL
            ws.cell(row=rr, column=2, value=n)
            rr += 1
        rows = sec['rows']
        if rows:
            rr += 1
            ws.cell(row=rr, column=1, value='Rows' if any(is_ok(x['outcome']) for x in rows) else 'Gap rows').font = Font(bold=True)
            rr += 1
            cols = list(dict.fromkeys(k for x in rows for k in x))
            header(ws, rr, cols)
            ws.freeze_panes = ws.cell(row=rr + 1, column=1)
            for x in sorted(rows, key=lambda x: (is_ok(x['outcome']), x['outcome'], str(x.get('apxCourseId', '')))):
                rr += 1
                for i, c in enumerate(cols, 1):
                    v = x.get(c, '')
                    ws.cell(row=rr, column=i, value=v if isinstance(v, (int, float, bool)) else str(v))
        widths(ws)
    summary.column_dimensions['A'].width = 24
    summary.column_dimensions['G'].width = 70
    summary.column_dimensions['H'].width = 70
    for c in 'BCDEF':
        summary.column_dimensions[c].width = 10
    wb.save(out)
    print('wrote', out)


if __name__ == '__main__':
    main()

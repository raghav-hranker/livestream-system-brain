#!/usr/bin/env python3
"""Builds the launch-match CSVs from the JSON vidyagram-appx-launch-match.cjs writes.
usage: vidyagram-appx-launch-match-csv.py <raw.json> <out dir> [our-site-tabs.json]
our-site-tabs.json = {tab: [last 7 chars of each course id the public courses page lists under that tab]}."""
import csv, json, os, re, sys, unicodedata
from collections import Counter, defaultdict

raw, out = sys.argv[1], sys.argv[2]
site = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
R = json.load(open(raw)); S = R['sheets']
os.makedirs(out, exist_ok=True)
FOLDER = {'folder 57': 'Exam Pattern and Syllabus', 'folder 143': 'Live Test'}  # older JSON names them by id
TAB = {'combo': 'Combo', 'new': 'New', 'live': 'Live', 'recorded': 'VOD', 'skills': 'Skills', 'old': 'Old', 'free': 'Free', 'suggested': 'Suggested'}

def write(name, rows, cols):
    with open(os.path.join(out, name), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f); w.writerow([c[1] for c in cols])
        for r in rows: w.writerow([r.get(c[0], '') if r.get(c[0]) is not None else '' for c in cols])
    return len(rows)

def key(s): return re.sub(r'[^\w]+', ' ', unicodedata.normalize('NFKC', str(s or '')).lower()).strip()
def n(v): 
    try: return int(v)
    except (TypeError, ValueError): return 0

C = S['courses']
for c in C:
    c['appxFolder'] = FOLDER.get(c.get('appxFolder'), c.get('appxFolder', ''))
    tabs = [TAB[t] for t, ids in site.items() if c.get('ourCourseId', '')[-7:] in ids]
    c['ourSiteTabs'] = ', '.join(tabs) if tabs else ('' if not site else ('none of the tabs' if c.get('ourStatus') == 'ACTIVE' else ''))
    c['scope'] = ('1 on AppX public site' if c.get('appxOnPublicSite') == 'yes' else '2 AppX active, other folder' if c.get('appxActive') == 'ACTIVE' else '3 AppX inactive' if c.get('appxActive') == 'INACTIVE' else '4 not in AppX')
    a = []
    if c['statusMatch'].startswith('OURS ONLY'): a.append('Hide before launch (test/demo course, not in AppX)')
    if c['statusMatch'] == 'AppX ACTIVE, ours INACTIVE': a.append('AppX shows it (in its %s folder); inactive here' % c['appxFolder'])
    if c.get('priceMatch') not in ('', 'ok', None) and not str(c.get('priceMatch')).startswith('n/a'): a.append('Price: ' + c['priceMatch'])
    if c.get('validityMatch') not in ('', 'ok', None) and not str(c.get('validityMatch')).startswith('n/a'): a.append('Validity: ' + c['validityMatch'])
    if site and c.get('appxOnPublicSite') == 'yes' and not tabs: a.append('Not under any tab of our courses page (only Teacher tab / search)')
    c['action'] = '; '.join(a)
C.sort(key=lambda c: (c['scope'], -n(c.get('apxCourseId')) if c.get('apxCourseId') else 0, c.get('ourCourse', '')))

write('1-courses.csv', C, [('scope', 'Group'), ('apxCourseId', 'AppX id'), ('appxCourse', 'AppX course'), ('ourCourse', 'Our course'), ('appxFolder', 'AppX folder'), ('appxActive', 'AppX status'), ('ourStatus', 'Our status'), ('statusMatch', 'Status match'),
    ('appxSells', 'AppX price / validity'), ('ourSells', 'Our price / validity'), ('priceMatch', 'Price match'), ('validityMatch', 'Validity match'), ('ourPlanBehindEachOption', 'Our checkout plan per option'), ('appxMrp', 'AppX MRP'), ('ourPrice', 'Our card MRP'), ('ourDiscountPrice', 'Our card price'),
    ('isCombo', 'Combo'), ('ourSiteTabs', 'Our courses page tabs'), ('action', 'Needs attention'),
    ('appxClasses', 'AppX classes'), ('ourClassesPlayable', 'Our classes (playable)'), ('appxPdfs', 'AppX PDFs'), ('ourPdfsMatched', 'Our PDFs'), ('appxClassPdfs', 'AppX PDFs on classes'), ('ourClassPdfs', 'Our PDFs on classes'), ('appxClassTests', 'AppX tests on classes'), ('ourClassTests', 'Our tests on classes'), ('appxCourseTests', 'AppX tests in course'), ('ourCourseTestsMatched', 'Our tests in course'), ('ourCourseId', 'Our course id')])
write('1-courses-needs-attention.csv', [c for c in C if c['action']], [('scope', 'Group'), ('apxCourseId', 'AppX id'), ('appxCourse', 'AppX course'), ('ourCourse', 'Our course'), ('appxActive', 'AppX status'), ('ourStatus', 'Our status'), ('appxSells', 'AppX price / validity'), ('ourSells', 'Our price / validity'), ('ourSiteTabs', 'Our courses page tabs'), ('action', 'Needs attention'), ('ourCourseId', 'Our course id')])

A = [c for c in C if c.get('apxCourseId') and c.get('appxActive') in ('ACTIVE', 'INACTIVE')]
base = [('scope', 'Group'), ('apxCourseId', 'AppX id'), ('appxCourse', 'AppX course'), ('appxActive', 'AppX status'), ('ourStatus', 'Our status')]
write('2-classes-by-course.csv', A, base + [('appxClasses', 'AppX classes'), ('ourClassesMatched', 'Ours: in the course'), ('ourClassesPlayable', 'Ours: in the course and playable'), ('classesMissing', 'Gap (not playable here)'), ('ourClassesInCourseTotal', 'Ours: all classes in the course'), ('appxOwnCountVideos', "AppX's own video counter")])
gap = [('outcome', 'What is wrong'), ('apxCourseId', 'AppX id'), ('appxCourse', 'AppX course'), ('title', 'Title in AppX'), ('path', 'AppX folder path'), ('rowId', 'AppX row id'), ('kind', 'Kind')]
scope_of = {c['apxCourseId']: c['scope'] for c in A}
for name in ('classGaps', 'pdfGaps', 'classPdfGaps', 'classTestGaps', 'courseTestGaps'):
    for g in S[name]: g['scope'] = scope_of.get(g['apxCourseId'], '')
    S[name].sort(key=lambda g: (g['scope'], g['outcome'], -n(g['apxCourseId'])))
write('2-classes-gaps.csv', S['classGaps'], [('scope', 'Group')] + gap)
write('3-pdfs-on-classes-by-course.csv', A, base + [('appxClassPdfs', 'AppX PDFs on classes'), ('ourClassPdfs', 'Ours'), ('classPdfsMissing', 'Gap')])
write('3-pdfs-on-classes-gaps.csv', S['classPdfGaps'], [('scope', 'Group'), ('outcome', 'What is wrong'), ('apxCourseId', 'AppX id'), ('appxCourse', 'AppX course'), ('classTitle', 'Class'), ('slot', 'Which PDF'), ('rowId', 'AppX row id')])
write('4-tests-on-classes-by-course.csv', A, base + [('appxClassTests', 'AppX tests on classes'), ('ourClassTests', 'Ours'), ('classTestsMissing', 'Gap')])
write('4-tests-on-classes-gaps.csv', S['classTestGaps'], [('scope', 'Group'), ('outcome', 'What is wrong'), ('apxCourseId', 'AppX id'), ('appxCourse', 'AppX course'), ('classTitle', 'Class'), ('appxTest', 'AppX test'), ('appxTestId', 'AppX test id'), ('rowId', 'AppX row id')])

# ebooks: same-title pairs whose shown/hidden were crossed are the same two items; printed books were retitled here, so pair by similar title
E = S['ebooks']
groups = defaultdict(list)
for e in E: groups[(e['kind'], key(e.get('appxTitle')))].append(e)
for (kind, k), g in groups.items():
    o = Counter(e['outcome'] for e in g)
    if k and o.get('AppX switched off, ours shown') and o.get('AppX shows it, ours hidden'):
        for e in g:
            if e['outcome'] in ('AppX switched off, ours shown', 'AppX shows it, ours hidden'): e['outcome'] = 'ok'; e['note'] = 'two AppX items share this title (one shown, one off); both are here the same way'
STOP = set('aditya ranjan sir book books for the and of by edition e medium chapter wise type mcqs paperback 2026 2025 27 26'.split())
def toks(s): return set(t for t in key(s).split() if t not in STOP and len(t) > 1)
free = [e for e in E if e['outcome'] == 'ours only' and e.get('ourType') == 'book']
for e in [e for e in E if e['kind'] == 'Book (printed)' and e['outcome'].startswith(('MISSING', 'missing'))]:
    ta = toks(e['appxTitle']); best, score = None, 0
    for f in free:
        tb = toks(f['ourTitle']); s = len(ta & tb) / max(1, min(len(ta), len(tb)))
        if s > score: best, score = f, s
    if best and score >= 0.6:
        free.remove(best); E.remove(best)
        e.update(outcome='likely the same book, retitled here (check by hand)', ourTitle=best['ourTitle'], ourType='book', ourShown=best['ourShown'], ourFree=best['ourFree'], ourPrice=best['ourPrice'])
order = {'Paid E-book': 0, 'Free E-book': 1, 'E-book': 2, 'Book (printed)': 3}
E.sort(key=lambda e: (order.get(e['kind'], 9), e['outcome'] == 'ok', e['outcome'], e.get('appxTitle') or e.get('ourTitle')))
write('5-ebooks-and-books.csv', E, [('kind', 'Kind'), ('outcome', 'Match'), ('appxTitle', 'AppX title'), ('ourTitle', 'Our title'), ('appxShown', 'AppX shown'), ('ourShown', 'Ours shown'), ('appxPrice', 'AppX price'), ('ourPrice', 'Our price'), ('ourFree', 'Ours free'), ('appxCategory', 'AppX category'), ('appxId', 'AppX id'), ('note', 'Note'), ('ourCreated', 'Ours created')])
write('5-course-pdfs-by-course.csv', A, base + [('appxPdfs', 'AppX PDFs in the course'), ('ourPdfsMatched', 'Ours'), ('pdfsMissing', 'Gap'), ('ourPdfsInCourseTotal', 'Ours: all PDFs in the course'), ('appxOwnCountFiles', "AppX's own file counter")])
write('5-course-pdfs-gaps.csv', S['pdfGaps'], [('scope', 'Group')] + gap[:-1])

T = S['tests']; T.sort(key=lambda t: (t['outcome'] == 'ok', t['outcome'], n(t.get('appxTestId'))))
write('6-tests.csv', T, [('outcome', 'Match'), ('appxTestId', 'AppX test id'), ('appxTest', 'AppX test'), ('ourTest', 'Our test'), ('appxPublished', 'AppX published'), ('ourStatus', 'Ours'), ('ourTab', 'Our tab'), ('appxFree', 'AppX free/paid'), ('appxQuestions', 'AppX questions'), ('appxPackages', 'AppX package ids'), ('appxLive', 'Live test')])
write('6-tests-not-matching.csv', [t for t in T if t['outcome'] != 'ok'], [('outcome', 'Match'), ('appxTestId', 'AppX test id'), ('appxTest', 'AppX test'), ('ourTest', 'Our test'), ('appxPublished', 'AppX published'), ('ourStatus', 'Ours'), ('ourTab', 'Our tab'), ('appxQuestions', 'AppX questions'), ('appxPackages', 'AppX package ids')])
P = S['testPackages']; P.sort(key=lambda p: (p['outcome'] == 'ok', p['outcome'], n(p.get('appxPackageId'))))
write('6-test-packages.csv', P, [('outcome', 'Match'), ('appxPackageId', 'AppX package id'), ('appxPackage', 'AppX package'), ('ourPackage', 'Our package'), ('appxEnabled', 'AppX enabled'), ('appxPriceMeans', 'AppX price'), ('ourStatus', 'Ours'), ('ourPrice', 'Our price'), ('appxTests', 'AppX tests'), ('ourTests', 'Our tests'), ('appxAttachedToCourses', 'Attached to AppX courses'), ('appxValidity', 'AppX validity'), ('ourTab', 'Our tab')])
Q = S['quizzes']; Q.sort(key=lambda q: (q['outcome'] == 'ok', q['outcome']))
write('6-quizzes.csv', Q, [('outcome', 'Match'), ('appxQuizId', 'AppX quiz id'), ('appxQuiz', 'AppX quiz'), ('ourQuiz', 'Our quiz'), ('appxOn', 'AppX on'), ('ourStatus', 'Ours'), ('ourTab', 'Our tab'), ('appxSubject', 'Subject'), ('appxQuestions', 'Questions'), ('appxDate', 'Date')])
pub = {t['appxTestId']: t for t in T if t.get('appxTestId')}
for g in S['courseTestGaps']:
    t = pub.get(g.get('appxTestId'), {}); g['appxPublished'] = t.get('appxPublished', ''); g['ourStatus'] = t.get('ourStatus', ''); g['ourTab'] = t.get('ourTab', '')
write('6-tests-in-courses-by-course.csv', [c for c in A if n(c.get('appxCourseTests')) or n(c.get('ourCourseTestsTotal'))], base + [('appxTestPackages', 'AppX test packages on the course'), ('appxCourseTests', 'AppX tests in the course'), ('ourCourseTestsMatched', 'Ours (same tests)'), ('ourCourseTestsTotal', 'Ours: all tests in the course')])
write('6-tests-in-courses-gaps.csv', S['courseTestGaps'], [('scope', 'Group'), ('outcome', 'What is wrong'), ('apxCourseId', 'AppX id'), ('appxCourse', 'AppX course'), ('appxTest', 'AppX test'), ('appxTestId', 'AppX test id'), ('from', 'Comes from'), ('appxPublished', 'Published in AppX'), ('ourStatus', 'Our test is'), ('ourTab', 'Our tab')])

# ---- numbers for the report ----
def tot(rows, f): return sum(n(r.get(f)) for r in rows)
print('generated', R['generatedAt'])
for label, rows in (('ALL 154', A), ('PUBLIC 49', [c for c in A if c['scope'].startswith('1')]), ('OTHER ACTIVE 6', [c for c in A if c['scope'].startswith('2')]), ('INACTIVE', [c for c in A if c['scope'].startswith('3')])):
    print(label, len(rows), '| classes', tot(rows, 'appxClasses'), tot(rows, 'ourClassesPlayable'), '| coursePdfs', tot(rows, 'appxPdfs'), tot(rows, 'ourPdfsMatched'), '| classPdfs', tot(rows, 'appxClassPdfs'), tot(rows, 'ourClassPdfs'), '| classTests', tot(rows, 'appxClassTests'), tot(rows, 'ourClassTests'), '| courseTests', tot(rows, 'appxCourseTests'), tot(rows, 'ourCourseTestsMatched'))
for name in ('classGaps', 'pdfGaps', 'classPdfGaps', 'classTestGaps'):
    print(name, dict(Counter((g['scope'][:1], g['outcome']) for g in S[name])))
print('courseTestGaps', dict(Counter((g['scope'][:1], g['appxPublished']) for g in S['courseTestGaps'])))
print('courses', dict(Counter(c['scope'] + ' / ' + c['statusMatch'] for c in C)))
print('ebooks', dict(Counter(e['kind'] + ' / ' + e['outcome'] for e in E)))
print('needs attention', dict(Counter(c['scope'][:1] for c in C if c['action'])), len([c for c in C if c['action']]))
print('public courses per our tab', dict(Counter(c['ourSiteTabs'] for c in C if c['scope'].startswith('1'))), '| non-AppX on site', len([c for c in C if c['scope'].startswith('4') and c['ourSiteTabs'] and c['ourSiteTabs'] != 'none of the tabs']))
print('gap classes in public courses, by course:', Counter((g['apxCourseId'], g['appxCourse'][:30], g['outcome']) for g in S['classGaps'] if g['scope'].startswith('1')).most_common(40))
print('other gaps in public courses:', [(k, g['apxCourseId'], g.get('title') or g.get('classTitle'), g['outcome'], g.get('appxTest', '')) for k in ('pdfGaps', 'classPdfGaps', 'classTestGaps') for g in S[k] if g['scope'].startswith('1')][:40])

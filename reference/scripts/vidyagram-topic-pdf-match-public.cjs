// Read-only, from the Mac, public Vidyagram APIs only (no login, no box, no DB), one request at a time:
// for every course, would each PDF of GET /courses/:id/pdfs appear in `pdfs` on GET /topics/:id/classes?
// Compares each PDF's section + topic names with GET /topic-and-section, the same rule as coursePdfInTopic.
// Then rechecks a sample against the class rows themselves: courses with left-out PDFs first, then random ones.
//   node reference/scripts/vidyagram-topic-pdf-match-public.cjs [out.json]    env: WALK_FLAGGED=15 WALK_RANDOM=10 PACE_MS=250
const fs = require('fs');

const BASE = 'https://backend.vidyagramar.com/api';
const PACE_MS = Number(process.env.PACE_MS || 250);
const WALK_FLAGGED = Number(process.env.WALK_FLAGGED || 15);
const WALK_RANDOM = Number(process.env.WALK_RANDOM || 10);
const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const fold = (value) => clean(value).toLowerCase().replace(/\s+/g, ' ');
const pause = () => new Promise((resolve) => setTimeout(resolve, PACE_MS));

const get = async (path) => {
  await pause();
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(BASE + path, { headers: { 'User-Agent': 'vg-topic-pdf-check' }, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()).data;
    } catch (error) {
      if (attempt === 3) throw new Error(`${path}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
    }
  }
};

const verdictFor = (pdf, places) => {
  const topic = clean(pdf.topic?.topicName);
  const section = clean(pdf.section?.sectionName);
  if (!topic) return 'allNotes';
  if (places.some((place) => place.topic === topic && (!section || place.section === section))) return 'inTopic';
  if (places.some((place) => place.topic === topic)) return 'sectionDiffers';
  if (places.some((place) => fold(place.topic) === fold(topic))) return 'caseOrSpacingOnly';
  return 'noOutlineTopic';
};

const outlinePlaces = (outline) => outline.topics.flatMap((topic) => (topic.sections || []).map((section) => ({
  topic: clean(topic.topicNameOverride || topic.topicName),
  section: clean(section.sectionNameOverride || section.sectionName),
})));

(async () => {
  const courses = await get('/courses/all-ids');
  const totals = { courses: courses.length, coursesWithPdfs: 0, coursesFullyMatched: 0, failedCourses: 0, pdfs: 0, inTopic: 0, sectionDiffers: 0, caseOrSpacingOnly: 0, noOutlineTopic: 0, allNotes: 0 };
  const perCourse = [];
  const leftOut = new Map();
  const failures = [];

  for (const course of courses) {
    try {
      const outline = await get(`/topic-and-section?courseId=${course.id}`);
      const { pdfs } = await get(`/courses/${course.id}/pdfs`);
      if (pdfs.length === 0) continue;
      const places = outlinePlaces(outline);
      const counts = {};
      const rows = pdfs.map((pdf) => {
        const verdict = verdictFor(pdf, places);
        counts[verdict] = (counts[verdict] || 0) + 1;
        totals[verdict] += 1;
        if (verdict !== 'inTopic') {
          const label = `${verdict}: ${clean(pdf.section?.sectionName)} > ${clean(pdf.topic?.topicName)}`;
          leftOut.set(label, (leftOut.get(label) || 0) + 1);
        }
        return { id: pdf.id, verdict };
      });
      totals.pdfs += pdfs.length;
      totals.coursesWithPdfs += 1;
      if ((counts.inTopic || 0) === pdfs.length) totals.coursesFullyMatched += 1;
      perCourse.push({ id: course.id, title: course.title, status: course.status, topics: outline.topics.length, pdfs: pdfs.length, counts, rows, topicIds: outline.topics.map((topic) => topic.topicId) });
    } catch (error) {
      totals.failedCourses += 1;
      failures.push(error.message);
    }
    process.stderr.write('.');
  }
  process.stderr.write('\n');

  const flagged = perCourse.filter((row) => row.pdfs !== (row.counts.inTopic || 0) + (row.counts.allNotes || 0));
  const others = perCourse.filter((row) => !flagged.includes(row)).sort(() => Math.random() - 0.5);
  const sample = [...flagged.slice(0, WALK_FLAGGED), ...others.slice(0, WALK_RANDOM)];
  const recheck = { courses: sample.length, pdfs: 0, agree: 0, disagreements: [] };
  for (const row of sample) {
    try {
      const places = [];
      for (const topicId of row.topicIds) {
        const data = await get(`/topics/${topicId}/classes?courseId=${row.id}`);
        for (const item of data.classes) places.push({ topic: clean(item.topic?.topicName), section: clean(item.section?.sectionName) });
      }
      const { pdfs } = await get(`/courses/${row.id}/pdfs`);
      for (const pdf of pdfs) {
        const verdict = verdictFor(pdf, places);
        const earlier = row.rows.find((entry) => entry.id === pdf.id)?.verdict;
        recheck.pdfs += 1;
        if (verdict === earlier) recheck.agree += 1;
        else recheck.disagreements.push({ course: row.id, pdf: pdf.id, title: pdf.title, fromOutline: earlier, fromClasses: verdict });
      }
    } catch (error) {
      failures.push(`recheck ${error.message}`);
    }
  }

  const topLeftOut = [...leftOut.entries()].sort((a, b) => b[1] - a[1]);
  const worst = perCourse
    .map((row) => ({ title: row.title, status: row.status, pdfs: row.pdfs, inTopic: row.counts.inTopic || 0, allNotes: row.counts.allNotes || 0 }))
    .filter((row) => row.inTopic + row.allNotes < row.pdfs)
    .sort((a, b) => (b.pdfs - b.inTopic - b.allNotes) - (a.pdfs - a.inTopic - a.allNotes))
    .slice(0, 15);
  console.log(JSON.stringify(totals));
  console.log('recheck against class rows:', JSON.stringify({ ...recheck, disagreements: recheck.disagreements.slice(0, 15), disagreementCount: recheck.disagreements.length }));
  console.log('top left out:', JSON.stringify(topLeftOut.slice(0, 30), null, 0));
  console.log('worst courses:', JSON.stringify(worst, null, 0));
  if (failures.length) console.log('failures:', JSON.stringify(failures.slice(0, 10)));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ totals, recheck, topLeftOut, perCourse, failures }, null, 1));
})().catch((error) => { console.error(error.message); process.exit(1); });

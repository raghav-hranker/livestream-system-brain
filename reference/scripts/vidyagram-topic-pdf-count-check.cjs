// Read-only on prod, public Vidyagram APIs only, paced one request at a time: does a topic's pdfCount on
// GET /topic-and-section equal pdfs.length on GET /topics/:id/classes, for every topic of a sample of courses?
//   Before deploy, from a backend worktree holding coursePdfCountsForTopics: seeds a throwaway in-memory Mongo with each
//   course's live PDF names and calls the function itself. Approximation: class rows take the names the topic list shows.
//     cd <worktree> && node -r ts-node/register/transpile-only <this script>
//   After deploy, reads the live pdfCount directly, no worktree or Mongo:
//     LIVE=1 node <this script>
//   env: COURSES=12 (sample size) COURSE=<id,id> (always included) PACE_MS=250
const path = require('path');

const BASE = 'https://backend.vidyagramar.com/api';
const LIVE = process.env.LIVE === '1';
const PACE_MS = Number(process.env.PACE_MS || 250);
const SAMPLE = Number(process.env.COURSES || 12);
const pinned = (process.env.COURSE || '').split(',').filter(Boolean);
const pause = (ms = PACE_MS) => new Promise((resolve) => setTimeout(resolve, ms));

const get = async (route) => {
  await pause();
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(BASE + route, { headers: { 'User-Agent': 'vg-topic-pdf-count-check' }, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()).data;
    } catch (error) {
      if (attempt === 3) throw new Error(`${route}: ${error.message}`);
      await pause(3000 * attempt);
    }
  }
};

// The function under test, on a memory Mongo holding one course's live names.
const localCounter = async () => {
  const local = (file) => require(path.join(process.cwd(), file));
  const mongoose = local('node_modules/mongoose');
  const { startMemoryMongo, stopMemoryMongo, clearCollections } = local('src/tests/integration/setup');
  const { coursePdfCountsForTopics } = local('src/services/coursePdfItem');
  await startMemoryMongo();
  const { Types } = mongoose;
  const db = mongoose.connection;
  return {
    stop: stopMemoryMongo,
    counts: async (courseId, topics, pdfs) => {
      await clearCollections();
      const course = new Types.ObjectId(courseId);
      if (pdfs.length > 0) {
        const placements = pdfs.map((pdf) => ({
          _id: new Types.ObjectId(),
          pdfId: new Types.ObjectId(),
          sectionName: pdf.section?.sectionName,
          topicName: pdf.topic?.topicName,
        }));
        await db.collection('pdfs').insertMany(placements.map(({ pdfId }) => ({ _id: pdfId, title: 'x' })));
        await db.collection('coursepdfs').insertMany(placements.map(({ _id, pdfId, sectionName, topicName }) => ({
          _id, course, pdf: pdfId, isActive: true, sectionName, topicName,
        })));
      }
      const classRows = topics.flatMap((topic) => (topic.sections || []).map((section) => ({
        course, isActive: true, class: new Types.ObjectId(), sectionName: section.sectionName, topicName: topic.topicName,
      })));
      if (classRows.length > 0) await db.collection('courseclasses').insertMany(classRows);
      return coursePdfCountsForTopics(course, topics);
    },
  };
};

(async () => {
  const counter = LIVE ? null : await localCounter();
  const all = (await get('/courses/all-ids')).map(({ id }) => id);
  const order = [...pinned, ...all.filter((id) => !pinned.includes(id)).sort(() => Math.random() - 0.5)];
  const totals = { courses: 0, topics: 0, classes: 0, topicPdfs: 0, ebookPdfs: 0, mismatches: 0, failures: 0 };
  const mismatches = [];

  for (const courseId of order) {
    if (totals.courses >= SAMPLE + pinned.length) break;
    try {
      const { pdfs } = await get(`/courses/${courseId}/pdfs`);
      if (pdfs.length === 0 && !pinned.includes(courseId)) continue;
      const { topics } = await get(`/topic-and-section?courseId=${courseId}`);
      const counts = counter ? await counter.counts(courseId, topics, pdfs) : null;
      totals.courses += 1;
      totals.ebookPdfs += pdfs.length;
      for (const topic of topics) {
        const opened = await get(`/topics/${topic.topicId}/classes?courseId=${courseId}`);
        const got = counts ? counts.get(String(topic.topicId)) ?? 0 : topic.pdfCount;
        totals.topics += 1;
        totals.classes += topic.classCount;
        totals.topicPdfs += opened.pdfs.length;
        if (got !== opened.pdfs.length) {
          totals.mismatches += 1;
          mismatches.push({ courseId, topicId: topic.topicId, topicName: topic.topicName, pdfCount: got, screen: opened.pdfs.length });
        }
      }
      console.error(`course ${totals.courses}: ${courseId} topics=${topics.length} pdfs=${pdfs.length} mismatches so far=${totals.mismatches}`);
    } catch (error) {
      totals.failures += 1;
      console.error(`FAILED ${courseId}: ${error.message}`);
    }
  }
  if (counter) await counter.stop();
  console.log(JSON.stringify({ mode: LIVE ? 'live pdfCount' : 'local function', totals, mismatches: mismatches.slice(0, 30) }, null, 2));
  process.exit(totals.mismatches > 0 || totals.failures > 0 ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

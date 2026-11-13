// Create the Course for an AppX course that is empty in AppX, with the fields the nightly placement
// step would give it (courseFieldsFromPlan: title, price, description lines, banner copied off AppX, validity,
// "Vidyagram Team", Vidyagram › All Courses, createdAt = AppX start date). The placement step only
// creates a course with its first CourseClass row, so an empty AppX course otherwise never appears.
// Later nightlies see it as `existing` (same apxCourseId + title) and file its classes in.
// Dry run by default; --commit writes one Course. Refuses when the AppX id or title is already used.
// Needs a done capture of the course in --run. Run on test-uday from the nightly checkout:
//   cd /home/raghav/vidyagram-nightly-20261019 && NODE_ENV=development node --require ts-node/register/transpile-only \
//     ~/vidyagram-create-empty-course.ts --run <capture run> --course 167 [--title '<title>'] [--off-sale] [--commit]
import path from 'path';
const APP = process.cwd();
require(path.join(APP, 'node_modules/dotenv')).config({ path: path.join(APP, '.env.development'), quiet: true });
const mongoose = require(path.join(APP, 'node_modules/mongoose'));
const { loadMirrorCourses } = require(path.join(APP, 'src/services/apx/apxCatalogMirrorReader'));
const { planCatalogue } = require(path.join(APP, 'src/services/apx/apxCatalogPlanner'));
const { courseFieldsFromPlan, withHostedBanner } = require(path.join(APP, 'src/services/apx/apxCatalogCourseImport'));
const { ensureImportTaxonomy } = require(path.join(APP, 'src/services/apx/apxCatalogClassCommit'));
const { CLASS_IMPORT_TEACHER } = require(path.join(APP, 'src/services/apx/apxCatalogClassImport'));
const Course = require(path.join(APP, 'src/models/Course')).default;
const FacultyDetails = require(path.join(APP, 'src/models/facultyDetails')).default;

const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const runId = arg('--run');
const apxCourseId = arg('--course');
const commit = process.argv.includes('--commit');
// --title: a different title from AppX's (two AppX courses share a name and titles are unique here). --off-sale: status 0.
const titleOverride = arg('--title');
const offSale = process.argv.includes('--off-sale');

(async () => {
  if (!runId || !apxCourseId) throw new Error('usage: --run <capture run> --course <AppX id> [--commit]');
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong database');
    const { inputs, missing } = await loadMirrorCourses(db, { customerId: '781', runId, courseIds: [apxCourseId] });
    if (missing?.length) throw new Error(`no done capture in ${runId} for ${missing.join(', ')}`);
    const { plans } = planCatalogue(inputs);
    const plan = plans.find((p: any) => String(p.course.apxCourseId) === apxCourseId);
    if (!plan) throw new Error(`no plan for course ${apxCourseId}`);
    const header = { ...plan.course, ...(titleOverride ? { title: titleOverride.trim() } : {}) };

    const byId = await Course.findOne({ apxCourseId }).select('_id title').lean();
    if (byId) throw new Error(`Course ${byId._id} already holds AppX ${apxCourseId} ("${byId.title}")`);
    const byTitle = await Course.findOne({ title: header.title }).select('_id apxCourseId').lean();
    if (byTitle) throw new Error(`title taken by Course ${byTitle._id} (AppX ${byTitle.apxCourseId ?? '-'})`);

    const faculty = (await FacultyDetails.findOne({ name: CLASS_IMPORT_TEACHER }).select('_id').lean())?._id ?? null;
    const refs = commit
      ? { ...(await ensureImportTaxonomy()), faculty }
      : { mainCategory: '(Vidyagram)', category: '(All Courses)', faculty };
    const fields = { ...courseFieldsFromPlan(header, refs), ...(offSale ? { status: 0 } : {}) };
    console.log(commit ? 'creating' : 'dry run, would create', JSON.stringify(fields, (k, v) => (typeof v === 'string' && v.length > 120 ? v.slice(0, 120) + '…' : v), 1));
    if (!commit) return;
    // The banner is copied off AppX first, as the nightly does (needs course-banner-ecf61637d deployed).
    if (typeof withHostedBanner !== 'function') throw new Error('nightly checkout predates course-banner-ecf61637d: deploy it first');
    const banner = await withHostedBanner(fields, console.error);
    if (banner.bannerOnAppx) console.error('WARNING: banner copy failed, course keeps AppX URL', banner.bannerOnAppx);
    const [course] = await Course.create([banner.fields]);
    const back = await Course.findById(course._id).select('_id apxCourseId title status price discountPrice createdAt').lean();
    console.log('created', JSON.stringify(back));
  } finally {
    await mongoose.disconnect();
  }
})().catch((e) => { console.error(String(e?.message ?? e)); process.exitCode = 1; });

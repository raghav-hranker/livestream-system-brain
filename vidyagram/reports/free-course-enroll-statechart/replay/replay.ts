/**
 * Replays FreeCourseEnroll.tla against the real backend functions, in memory: no database, no network.
 * Mongo reads and writes are stubbed on the model objects. Run with the worktree's ts-node.
 *  1. Conformance: every (mode, enrollment, order, ENFORCE_ORDER_EXPIRY) through authorizeCourseAccess,
 *     authorizeClassAccess, myCourseCandidateIds + the two $match objects + the tab split, against the model.
 *  2. The EnrollOnlyInEnrollMode path: tap Enroll, admin sets Paid, the write lands.
 *  3. The EnrollTab / PaidTab paths with expiry enforced: order, then it expires.
 */
const W = process.env.W!;
const { authorizeCourseAccess, authorizeClassAccess } = require(`${W}/src/services/classAccessAuthz`);
const { courseFreeMode, ENROLL_MODE_MATCH } = require(`${W}/src/services/courseFreeMode`);
const { MY_COURSES_COURSE_MATCH, myCourseCandidateIds } = require(`${W}/src/services/myCourses`);
const { enrollInCourse } = require(`${W}/src/services/courseEnrollment`);
const Course = require(`${W}/src/models/Course`).default;
const CourseEnrollment = require(`${W}/src/models/CourseEnrollment`).default;

type Mode = 'paid' | 'open' | 'enroll';
type OrderState = 'none' | 'active' | 'expired';
const CID = '64b000000000000000000001';
const UID = '64a000000000000000000001';
const NOW = new Date('2026-11-07T12:00:00Z');
const FUTURE = new Date('2027-11-07T00:00:00Z');
const PAST = new Date('2026-01-01T00:00:00Z');

const courseDoc = (mode: Mode) => ({
  _id: CID,
  isFree: mode !== 'paid',
  ...(mode === 'enroll' ? { freeAccess: 'enroll' } : mode === 'open' ? { freeAccess: 'open' } : {}),
});

// The two $match objects are flat equality / $ne; enough of Mongo's semantics to apply them to one doc.
const matches = (doc: any, match: Record<string, any>) =>
  Object.entries(match).every(([k, cond]) =>
    cond && typeof cond === 'object' && '$ne' in cond ? doc[k] !== cond.$ne : doc[k] === cond);

// ---- the model's derived outputs (FreeCourseEnroll.tla) ----
const model = (mode: Mode, enrolled: boolean, order: OrderState, enforce: boolean) => {
  const opens = order === 'active' || (order === 'expired' && !enforce);
  const play = mode === 'open' || (mode === 'enroll' && enrolled) || opens;
  const listed = (order !== 'none' && mode === 'paid') || ((order !== 'none' || enrolled) && mode === 'enroll');
  return { play, tab: !listed ? 'none' : mode === 'enroll' ? 'Free' : 'Paid' };
};

// ---- the code ----
const code = async (mode: Mode, enrolled: boolean, order: OrderState, enforce: boolean) => {
  const course = courseDoc(mode);
  const scopeOrders = order === 'none' ? [] : [{ courseIds: [CID], planId: null, expireDate: order === 'active' ? FUTURE : PAST }];
  const enrolledIds = async (_u: string, ids: string[]) => (enrolled ? ids.filter((id) => id === CID) : []);
  const opts = { enforceOrderExpiry: enforce, now: () => NOW };

  const courseAuthz = await authorizeCourseAccess(
    { userId: UID, isAdmin: false, courseId: CID },
    { findCourseById: async () => course, findActiveOrdersForUser: async () => scopeOrders, findEnrolledCourseIds: enrolledIds },
    opts,
  );
  const classAuthz = await authorizeClassAccess(
    { userId: UID, isAdmin: false, classId: 'c1', accessKind: 'play' },
    {
      findClassById: async () => ({ _id: 'c1', isFree: false, mp4Recordings: [] }),
      findCoursesForClass: async () => [{ courseId: CID, placementIsFree: false, courseMode: courseFreeMode(course), topicId: null, isRevision: false }],
      findActiveOrdersForUser: async () => scopeOrders,
      findEnrolledCourseIds: enrolledIds,
    },
    opts,
  );

  // getUserCourses (courseController.ts:2543-2566, 2651-2656) with its Mongo $match applied by hand.
  const rawOrders = order === 'none' ? [] : [{ _id: 'o1', courseId: [CID], orderStatus: 'success', status: 1, expireDate: order === 'active' ? FUTURE : PAST }];
  const candidates = myCourseCandidateIds({ orders: rawOrders, plans: [] } as any, NOW).map(String);
  const enrolledList = enrolled ? [CID] : [];
  const listed =
    (candidates.includes(CID) && matches(course, MY_COURSES_COURSE_MATCH)) ||
    ([...candidates, ...enrolledList].includes(CID) && matches(course, ENROLL_MODE_MATCH));
  const tab = !listed ? 'none' : courseFreeMode(course) === 'enroll' ? 'Free' : 'Paid';

  return { play: courseAuthz.allowed, classPlay: classAuthz.allowed, tab };
};

const conformance = async () => {
  let rows = 0, mismatches = 0;
  const table: string[] = [];
  for (const enforce of [false, true])
    for (const mode of ['paid', 'open', 'enroll'] as Mode[])
      for (const enrolled of [false, true])
        for (const order of ['none', 'active', 'expired'] as OrderState[]) {
          const m = model(mode, enrolled, order, enforce);
          const c = await code(mode, enrolled, order, enforce);
          const ok = m.play === c.play && m.play === c.classPlay && m.tab === c.tab;
          rows++; if (!ok) mismatches++;
          table.push(`${enforce ? 'on ' : 'off'} | ${mode.padEnd(6)} | ${String(enrolled).padEnd(5)} | ${order.padEnd(7)} | play ${c.play ? 'yes' : 'no '} (class ${c.classPlay ? 'yes' : 'no '}) | tab ${c.tab.padEnd(4)} | ${ok ? 'matches model' : `MODEL SAYS play ${m.play} tab ${m.tab}`}`);
        }
  console.log('## 1. Conformance: code vs model, every state\n');
  console.log('expiry | mode   | enrol | order   | code says');
  table.forEach((r) => console.log(r));
  console.log(`\n${rows} combinations, ${mismatches} mismatches\n`);
};

const race = async () => {
  console.log('## 2. EnrollOnlyInEnrollMode path, replayed on enrollInCourse (courseEnrollment.ts:28-38)\n');
  const store = { course: courseDoc('enroll') as any, enrollments: [] as any[] };
  let adminFlipsAfterRead = true;
  (Course as any).findOne = () => ({
    select: () => ({
      lean: async () => {
        const read = { ...store.course };
        if (adminFlipsAfterRead) {
          store.course = courseDoc('paid'); // step 2: the admin saves the course as Paid between the read and the write
          console.log('step 1: student taps Enroll; the call reads the course in enroll mode');
          console.log('step 2: admin sets Paid course (course saved isFree=false)');
        }
        return read;
      },
    }),
  });
  (CourseEnrollment as any).findOneAndUpdate = (filter: any, update: any) => ({
    lean: async () => {
      const row = { ...filter, enrolledAt: update.$setOnInsert.enrolledAt };
      store.enrollments.push(row);
      console.log(`step 3: the enrollment is saved while the course mode is now "${courseFreeMode(store.course)}"`);
      return row;
    },
  });
  const result = await enrollInCourse(UID, CID, NOW);
  console.log(`enrollInCourse returned kind=${result.kind}; CourseEnrollment rows: ${store.enrollments.length}`);
  const after = await code('paid', true, 'none', false);
  console.log(`then, still Paid: play ${after.play}, tab ${after.tab} (the stray row grants and lists nothing)`);
  const back = await code('enroll', true, 'none', false);
  console.log(`admin sets Free, enroll to unlock again: play ${back.play}, tab ${back.tab}\n`);
};

const expiry = async () => {
  console.log('## 3. EnrollTab / PaidTab paths with ENFORCE_ORDER_EXPIRY on\n');
  for (const mode of ['enroll', 'paid'] as Mode[]) {
    for (const order of ['none', 'active', 'expired'] as OrderState[]) {
      const c = await code(mode, false, order, true);
      console.log(`${mode}, not enrolled, order ${order.padEnd(7)}: play ${c.play ? 'yes' : 'no '}, tab ${c.tab}`);
    }
    console.log('');
  }
};

(async () => {
  await conformance();
  await race();
  await expiry();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

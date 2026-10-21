// Read-only production inventory. Run from the deployed backend root with Node on stdin.
// Output is JSON Lines with no session cookie, APX media URL, or stored asset key.
require('dotenv').config({ path: '.env.production', quiet: true });
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const id = x => String(x ?? '');
const clean = x => id(x).trim();
const digest = x => x ? crypto.createHash('sha256').update(x).digest('hex') : null;
const out = x => console.log(JSON.stringify(x));
const active = x => id(x.enable) !== '0' && id(x.deleted) !== '1';
const extract = x => clean(x?.link ?? x?.video_url ?? x?.attrUrl ?? x?.url ?? '');
const youtube = (x, link) => Boolean(x?.isYoutube || x?.is_youtube || x?.youtube) || /(?:youtube\.com|youtu\.be)/i.test(link);
const hasHls = c => !!(clean(c?.hlsAsset?.bucket) && clean(c?.hlsAsset?.key));
const hasMp4 = c => (c?.mp4Recordings || []).some(r => (clean(r.bucket) && clean(r.key)) || clean(r.url));
const hasRedirect = c => !!c?.isYoutubeRedirect && !!clean(c.link || c.class_link);
const hasLegacyLink = c => !!clean(c?.class_link || c?.link);
const placementActive = p => p && p.isActive !== false && p.status !== 0;
const sourceType = r => clean(r.type).toUpperCase();
const isVideo = r => ['VIDEO', 'LIVE_STREAM'].includes(sourceType(r));

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const { resolveLiveSession } = require('./dist/src/services/apx/apxVideoTokenService');
  const { deriveApxAssetKey } = require('./dist/src/services/apx/apxAssetKey');
  const courses = await db.collection('courses').find({ apxCourseId: { $exists: true, $ne: null } }, { projection: { title: 1, status: 1, apxCourseId: 1 } }).toArray();
  const classes = await db.collection('classes').find({}, { projection: { title: 1, status: 1, apxAssetKey: 1, hlsAsset: 1, streamStatus: 1, isYoutubeRedirect: 1, link: 1, class_link: 1, mp4Recordings: 1 } }).toArray();
  const links = await db.collection('courseclasses').find({}, { projection: { course: 1, class: 1, isActive: 1, status: 1, title: 1, sectionName: 1, topicName: 1, apxDisplayPlacements: 1 } }).toArray();
  const captures = await db.collection('apxcourses').find({}, { projection: { courseId: 1, 'courseData.classes': 1 } }).toArray();
  const byKey = new Map(classes.filter(c => clean(c.apxAssetKey)).map(c => [c.apxAssetKey, c]));
  const byId = new Map(classes.map(c => [id(c._id), c]));
  const byCourse = new Map();
  for (const p of links) {
    const k = id(p.course);
    if (!byCourse.has(k)) byCourse.set(k, []);
    byCourse.get(k).push(p);
  }
  const capByCourse = new Map(captures.map(c => [id(c.courseId), new Map((c.courseData?.classes || []).map(x => [id(x.id), x]))]));
  out({ event: 'inventory', at: new Date().toISOString(), courses: courses.length, classes: classes.length, placements: links.length, capturedCourses: captures.length });

  async function listing(apxCourseId) {
    const rows = [];
    let pages = 0;
    for (let start = 0; start < 50000;) {
      const session = await resolveLiveSession('472');
      const form = new URLSearchParams({ draw: '1', start: id(start), length: '500', 'search[value]': '', filterbycourse: id(apxCourseId) });
      const response = await axios.post('https://cms.appx.co.in/paid_course4/get_pc4_contents', form.toString(), {
        timeout: 25000, maxRedirects: 0,
        headers: { Cookie: `ci_session=${session.session_id}`, Referer: 'https://cms.appx.co.in/', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const page = Array.isArray(response.data?.data) ? response.data.data : response.data?.aaData;
      if (!Array.isArray(page)) throw new Error('listing unavailable');
      rows.push(...page);
      pages++;
      if (page.length < 500) return { rows, pages };
      start += page.length;
    }
    throw new Error('pagination cap');
  }

  async function auditCourse(course) {
    const apxCourseId = id(course.apxCourseId);
    try {
      const { rows, pages } = await listing(apxCourseId);
      const cap = capByCourse.get(apxCourseId) || new Map();
      const placements = byCourse.get(id(course._id)) || [];
      const localByClass = new Map(placements.map(p => [id(p.class), p]));
      const rowTypes = {};
      const summary = { activeVideoRows: 0, activeWithLink: 0, activeNoLink: 0, inactiveVideoRows: 0, sourceLiveStreamLinks: 0, categories: {} };
      const findings = [];
      for (const row of rows) {
        const type = sourceType(row);
        rowTypes[type] = (rowTypes[type] || 0) + 1;
        if (!isVideo(row)) continue;
        const isActive = active(row);
        if (!isActive) { summary.inactiveVideoRows++; continue; }
        summary.activeVideoRows++;
        const link = extract(row);
        if (link) summary.activeWithLink++; else summary.activeNoLink++;
        if (/\/live\//i.test(link)) summary.sourceLiveStreamLinks++;
        const liveKey = link ? deriveApxAssetKey(link, youtube(row, link)) : null;
        const captured = cap.get(id(row.id));
        const capturedLink = extract(captured);
        const capturedKey = capturedLink ? deriveApxAssetKey(capturedLink, youtube(captured, capturedLink)) : null;
        const liveClass = liveKey ? byKey.get(liveKey) : null;
        const capturedClass = capturedKey ? byKey.get(capturedKey) : null;
        const cls = liveClass || capturedClass || null;
        const match = liveClass ? 'live-video-identity' : capturedClass ? 'captured-row-video-identity' : null;
        const placement = cls ? localByClass.get(id(cls._id)) : null;
        let category;
        if (!link) category = 'source-no-video-link';
        else if (!cls) category = 'no-class-record';
        else if (!placement) category = 'class-without-course-placement';
        else if (!placementActive(placement)) category = 'course-placement-disabled';
        else if (cls.status === 0) category = 'class-disabled';
        else if (hasRedirect(cls)) category = 'youtube-redirect';
        else if (['preparing', 'processing'].includes(cls.streamStatus)) category = 'playback-status-blocked';
        else if (hasHls(cls)) category = 'hls-reference-present';
        else if (hasMp4(cls)) category = 'mp4-alternative';
        else if (hasLegacyLink(cls)) category = 'legacy-link-alternative';
        else category = 'no-playback-reference';
        summary.categories[category] = (summary.categories[category] || 0) + 1;
        if (category === 'hls-reference-present' || category === 'youtube-redirect') continue;
        findings.push({
          apxCourseId, courseId: id(course._id), courseTitle: course.title, courseStatus: course.status,
          sourceId: id(row.id), title: clean(row.title), sourceType: type,
          sourceHasVideoLink: !!link, sourceLinkKind: liveKey?.split(':')[0] || null,
          sourceLiveStreamLink: /\/live\//i.test(link), sourceVideoIdentityHash: digest(liveKey),
          sourceRowCaptured: !!captured, capturedVideoIdentityHash: digest(capturedKey),
          classId: cls ? id(cls._id) : null, classTitle: cls?.title || null,
          classStatus: cls?.status ?? null, classStreamStatus: cls?.streamStatus || null,
          hlsReferencePresent: hasHls(cls), youtubeRedirectPresent: hasRedirect(cls),
          mp4AlternativePresent: hasMp4(cls), legacyLinkAlternativePresent: hasLegacyLink(cls),
          coursePlacementId: placement ? id(placement._id) : null,
          coursePlacementStatus: placement?.status ?? null, coursePlacementIsActive: placement?.isActive ?? null,
          sectionName: placement?.sectionName || null, topicName: placement?.topicName || null,
          match, category,
        });
      }
      out({ event: 'course', checkedAt: new Date().toISOString(), apxCourseId, courseId: id(course._id), courseTitle: course.title, courseStatus: course.status, sourceRows: rows.length, pages, rowTypes, summary, findings });
    } catch (e) {
      out({ event: 'course-error', apxCourseId, courseId: id(course._id), courseTitle: course.title, error: e.name, message: clean(e.message).replace(/https?:\/\/\S+/g, '[url]') });
    }
  }

  let next = 0;
  const queue = courses.sort((a, b) => b.status - a.status);
  async function worker() { while (next < queue.length) await auditCourse(queue[next++]); }
  await Promise.all([worker(), worker()]);
  out({ event: 'complete', at: new Date().toISOString(), attemptedCourses: queue.length });
  await mongoose.disconnect();
})().catch(e => { out({ event: 'fatal', error: e.name, message: clean(e.message).replace(/https?:\/\/\S+/g, '[url]') }); process.exit(1); });

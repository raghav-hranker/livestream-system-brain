// Read-only, no DB, no AppX: which AppX course folders carry an image (student tree `thumbnail`) and which of
// them map one-to-one onto a node of our imported outline (section / topic / subTopic in the planner's plans).
// A node's source folder = the deepest folder holding all of the node's items; the map is clean when that
// folder holds no item filed under another node. Prints every folder of COURSE=<apxCourseId> (default 103)
// and totals over all courses.
//   node vidyagram-folder-image-map.cjs <snapshot-dir with apxcatalogtree.json + plans.json>
const path = require('path');
const dir = process.argv[2] || '.';
const tree = require(path.resolve(dir, 'apxcatalogtree.json'));
const { plans } = require(path.resolve(dir, 'plans.json'));
const ONE = process.env.COURSE || '103';
const WRAPPER = /^\s*(videos?|pdfs?|notes?|class notes|lectures?|recorded|live|tests?|quiz)\s*\.?\s*$/i;
const isImg = (u) => typeof u === 'string' && /^https?:\/\//.test(u);

function analyse(apx, pages, plan) {
  const parentOf = new Map(); // rowId -> parent folder id ('-1' = course root)
  const folders = new Map(); // folderId -> row
  for (const p of pages) for (const r of p.rows) {
    parentOf.set(String(r.id), String(p.parentId));
    if (String(r.material_type).toUpperCase() === 'FOLDER') folders.set(String(r.id), r);
  }
  const chain = (id) => { const out = []; let c = parentOf.get(id); while (c && c !== '-1' && out.length < 50) { out.push(c); c = parentOf.get(c); } return out; };

  const itemNode = new Map(); // itemId -> node key
  const nodes = [];
  for (const s of plan.outline || []) {
    const sKey = `S:${s.section}`; const sItems = [];
    for (const t of s.topics || []) {
      const tKey = `${sKey} > T:${t.topic}`; const tItems = [...(t.items || [])];
      for (const st of t.subTopics || []) {
        const stKey = `${tKey} > ST:${st.subTopic ?? st.name}`;
        nodes.push({ key: stKey, level: 'subTopic', items: st.items || [] });
        tItems.push(...(st.items || []));
        for (const i of st.items || []) itemNode.set(String(i), stKey);
      }
      for (const i of t.items || []) itemNode.set(String(i), tKey);
      nodes.push({ key: tKey, level: 'topic', items: tItems });
      sItems.push(...tItems);
    }
    nodes.push({ key: sKey, level: 'section', items: sItems });
  }

  // Items under each folder (any depth), for the "holds nothing else" test.
  const under = new Map();
  for (const id of itemNode.keys()) for (const f of chain(id)) { if (!under.has(f)) under.set(f, new Set()); under.get(f).add(id); }

  const folderNode = new Map(); // folderId -> { key, level }
  for (const n of nodes) {
    const ids = n.items.map(String).filter((i) => parentOf.has(i));
    if (!ids.length) continue;
    let common = chain(ids[0]);
    for (const i of ids.slice(1)) { const c = new Set(chain(i)); common = common.filter((f) => c.has(f)); }
    // A VIDEO/PDF wrapper is never the source: climb to the real folder above it.
    let k = 0;
    while (k < common.length && WRAPPER.test(String(folders.get(common[k])?.Title || ''))) k++;
    const lca = common[k];
    if (!lca) continue;
    const mine = new Set(ids);
    const clean = [...(under.get(lca) || [])].every((i) => mine.has(i));
    // Deepest node wins a folder (a topic and its only subTopic can share one).
    if (clean && !folderNode.has(lca)) folderNode.set(lca, { key: n.key, level: n.level });
  }

  const rows = [...folders.entries()].map(([id, r]) => ({
    id, title: String(r.Title || '').trim(), depth: chain(id).length + 1,
    image: isImg(r.thumbnail) ? r.thumbnail : null, node: folderNode.get(id) || null,
    items: (under.get(id) || new Set()).size,
  }));
  return { apx, rows, nodes };
}

const byCourse = new Map();
for (const p of tree) { const k = String(p.apxCourseId); if (!byCourse.has(k)) byCourse.set(k, []); byCourse.get(k).push(p); }
const planBy = new Map(plans.map((p) => [String(p.course.apxCourseId), p]));

const tot = { courses: 0, folders: 0, withImage: 0, mapped: 0, mappedWithImage: 0, imageNotMapped: 0, emptyFolders: 0, byLevel: {}, byLevelWithImage: {} };
let one = null;
const other = {};
for (const [apx, pages] of byCourse) {
  const plan = planBy.get(apx);
  if (!plan) continue;
  const a = analyse(apx, pages, plan);
  tot.courses++;
  for (const r of a.rows) {
    tot.folders++; if (r.image) tot.withImage++; if (!r.items) tot.emptyFolders++;
    if (r.node) { tot.mapped++; tot.byLevel[r.node.level] = (tot.byLevel[r.node.level] || 0) + 1; if (r.image) { tot.mappedWithImage++; tot.byLevelWithImage[r.node.level] = (tot.byLevelWithImage[r.node.level] || 0) + 1; } }
    else if (r.image && r.items) {
      tot.imageNotMapped++;
      if (WRAPPER.test(r.title)) tot.imageNotMappedWrapper = (tot.imageNotMappedWrapper || 0) + 1;
      else (other[r.title] = (other[r.title] || 0) + 1);
    }
  }
  for (const n of a.nodes) if (n.level !== 'section' && !a.rows.some((r) => r.node && r.node.key === n.key)) tot.nodesNoFolder = (tot.nodesNoFolder || 0) + 1;
  tot.topicNodes = (tot.topicNodes || 0) + a.nodes.filter((n) => n.level !== 'section').length;
  if (apx === ONE) one = a;
}

if (one) {
  console.log(`== AppX course ${ONE}: ${one.rows.length} folders`);
  for (const r of one.rows.sort((x, y) => x.depth - y.depth))
    console.log(`d${r.depth} | ${r.image ? 'IMG' : '---'} | ${String(r.items).padStart(3)} items | ${r.title.slice(0, 40).padEnd(40)} -> ${r.node ? r.node.key : '(no node)'}`);
  const nodesNoFolder = one.nodes.filter((n) => n.level !== 'section' && ![...one.rows].some((r) => r.node && r.node.key === n.key));
  console.log(`topic/subTopic nodes with no clean source folder: ${nodesNoFolder.length}`);
  for (const n of nodesNoFolder.slice(0, 15)) console.log('  ', n.key, `(${n.items.length} items)`);
}
console.log('\n== all courses', JSON.stringify(tot));
const top = Object.entries(other).sort((x, y) => y[1] - x[1]);
console.log(`image, not mapped, not a VIDEO/PDF wrapper: ${top.reduce((s, [, n]) => s + n, 0)} folders, ${top.length} titles; top:`);
for (const [t, n] of top.slice(0, 25)) console.log(`  ${String(n).padStart(4)}  ${t}`);

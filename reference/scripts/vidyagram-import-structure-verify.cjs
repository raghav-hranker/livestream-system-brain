// Offline, read-only database verification. Reads exported JSON; writes findings only.
const fs = require('fs');
const path = require('path');
const dir = process.argv[2] || 'outputs/vidyagram-import-verify-2026-10-19';
const worktree = process.env.VG_IMPORT_WORKTREE || '/Users/raghav/Projects/worktrees/vg-course-import';
require(path.join(worktree,'node_modules/ts-node')).register({transpileOnly:true,project:path.join(worktree,'tsconfig.json')});
const {proposeCourseSection} = require(path.join(worktree,'src/services/apx/apxCatalogPlanner.ts'));
const read = n => JSON.parse(fs.readFileSync(path.join(dir, n + '.json')));
const clean = v => String(v ?? '').trim();
const key = v => clean(v).normalize('NFC').replace(/\s+/g, ' ').toLowerCase();
const courses = read('courses').filter(c => c.apxCourseId), rows = read('courseclasses');
const sections = read('sections'), topics = read('topics'), subs = read('subtopics');
const index = a => new Map(a.map(x => [String(x._id), x]));
const sm = index(sections), tm = index(topics), um = index(subs), cm = index(read('classes'));
const byCourse = new Map(courses.map(c => [String(c._id), rows.filter(r => r.course === c._id)]));
const issues = [], add = (type, detail) => issues.push({type, ...detail});
const duplicates = (nodes, field, parent) => {
  const groups = new Map();
  for (const n of nodes) { const k = [n.customer_id, parent ? n[parent] : '', key(n[field])].join('|'); groups.set(k, [...(groups.get(k)||[]), n]); }
  return [...groups.values()].filter(g => g.length > 1).map(g => g.map(n => ({id:n._id,name:n[field],parent:parent?n[parent]:null})));
};
const taxonomy = {
  duplicateSections:duplicates(sections,'sectionName'), duplicateTopics:duplicates(topics,'topicName','section'),
  duplicateSubTopics:duplicates(subs,'subTopicName','topic'),
  emptyImportedSections:sections.filter(s=>s.createdAt?.startsWith('2026-10-19')&&!rows.some(r=>r.section===s._id)),
  emptyImportedTopics:topics.filter(t=>t.createdAt?.startsWith('2026-10-19')&&!rows.some(r=>r.topic===t._id)),
  emptyImportedSubTopics:subs.filter(t=>t.createdAt?.startsWith('2026-10-19')&&!rows.some(r=>r.subTopic===t._id)),
};
for(const c of courses) for(const r of byCourse.get(c._id)) {
  const s=sm.get(r.section),t=tm.get(r.topic),u=um.get(r.subTopic);
  if(!s||!t||(r.subTopic&&!u))add('dangling taxonomy',{course:c.apxCourseId,row:r._id});
  if(t&&t.section!==r.section||u&&u.topic!==r.topic)add('wrong taxonomy parent',{course:c.apxCourseId,row:r._id});
  if(s&&r.sectionName!==s.sectionName||t&&r.topicName!==t.topicName||u&&r.subTopicName!==u.subTopicName)add('snapshot differs from canonical',{course:c.apxCourseId,row:r._id,actual:[r.sectionName,r.topicName,r.subTopicName],canonical:[s?.sectionName,t?.topicName,u?.subTopicName]});
}
const result={taxonomy,issues,plansAvailable:fs.existsSync(path.join(dir,'plans.json'))};
if(result.plansAvailable){
  const raw=read('plans'),plans=Array.isArray(raw)?raw:raw.courses||raw.plans;
  const pm=new Map(plans.map(p=>[String(p.course.apxCourseId),p]));
  const expected=new Map(), skipped=[];
  for(const l of read('apxcatalogimports')) {
    if(!l.classId)continue;
    for(const p of l.placements||[]){
      const id=String(p.apxCourseId),plan=pm.get(id);if(!plan)continue;
      const items=plan.items.slice().sort((a,b)=>a.priority-b.priority), item=items.find(i=>String(i.rowId)===String(p.rowId));
      const filed=items.filter(i=>i.placement),loose={section:clean(plan.courseSection?.section)||clean(filed[0]?.placement?.section)||clean(proposeCourseSection(plan.course.title)),topic:filed.some(i=>i.kind!=='PDF')?'Start Here':'All Classes',subTopic:null};
      let filing=item?.placement|| (item?loose:null);
      if(!item){const same=items.find(i=>i.kind!=='PDF'&&JSON.stringify(i.path?.map(clean))===JSON.stringify(p.path?.map(clean)));filing=same?(same.placement||loose):(p.section&&p.topic?p:loose);}
      const ex={classId:String(l.classId),rowId:String(p.rowId),section:clean(filing.section),topic:clean(filing.topic),subTopic:clean(filing.subTopic)||null,priority:item?Number(item.priority):Math.max(0,...items.map(i=>Number(i.priority)||0))+Number(p.priority),active:item?item.active!==false:false,free:item?item.free===true:p.free===true,apxTitle:clean(p.apxTitle)||clean(item?.apxTitle),gone:!item};
      expected.set(id,[...(expected.get(id)||[]),ex]);
    }
  }
  const perCourse=[];
  for(const c of courses){
    const all=(expected.get(String(c.apxCourseId))||[]).sort((a,b)=>a.priority-b.priority||a.rowId.localeCompare(b.rowId));const seen=new Set(), ex=[];
    for(const x of all){if(seen.has(x.classId)){skipped.push({course:c.apxCourseId,...x});continue;}seen.add(x.classId);ex.push(x);}
    expected.set(String(c.apxCourseId),ex);
    const actual=byCourse.get(c._id),am=new Map(actual.map(r=>[String(r.class),r]));
    for(const x of ex){const r=am.get(x.classId);if(!r){add('missing placement',{course:c.apxCourseId,...x});continue;}
      const actualPath=[r.sectionName,r.topicName,r.subTopicName||null],expectedPath=[x.section,x.topic,x.subTopic];
      if(JSON.stringify(actualPath)!==JSON.stringify(expectedPath))add('filing mismatch',{course:c.apxCourseId,row:r._id,rowId:x.rowId,actual:actualPath,expected:expectedPath});
      if(r.priority!==Math.max(1,Math.trunc(x.priority)||1))add('priority mismatch',{course:c.apxCourseId,row:r._id,actual:r.priority,expected:x.priority});
    }
    for(const r of actual)if(!seen.has(String(r.class)))add('extra placement',{course:c.apxCourseId,row:r._id});
    const classes=actual.map(r=>r.class);if(new Set(classes).size!==classes.length)add('duplicate class',{course:c.apxCourseId});
    perCourse.push({course:c.apxCourseId,title:c.title,expected:ex.length,actual:actual.length,issues:issues.filter(i=>i.course===c.apxCourseId).length});
  }
  result.perCourse=perCourse;result.duplicateSourcePlacements=skipped.length;
  const ids=['85','153','10','113',String(courses.find(c=>c.status===0)?.apxCourseId)];
  const samples=ids.map(id=>{const c=courses.find(c=>String(c.apxCourseId)===id), p=pm.get(id);const actual=byCourse.get(c._id).slice().sort((a,b)=>a.priority-b.priority).map(r=>({topic:[r.sectionName,r.topicName,r.subTopicName].filter(Boolean).join(' > '),title:r.title??r.apxTitle??cm.get(r.class)?.title,priority:r.priority,eligible:r.isActive===true&&r.status===1&&cm.get(r.class)?.status===1,class:r.class}));return {course:id,title:c.title,status:c.status,appx:p.items.filter(i=>i.kind!=='PDF').map(i=>({rowId:i.rowId,title:i.apxTitle,path:i.path,filing:i.placement,priority:i.priority,active:i.active})),actual,expectedAfterApprovedDedupe:expected.get(id)};});
  fs.writeFileSync(path.join(dir,'student-sample-comparisons.json'),JSON.stringify(samples,null,2));
}
result.issueCounts=Object.fromEntries([...new Set(issues.map(i=>i.type))].map(t=>[t,issues.filter(i=>i.type===t).length]));
fs.writeFileSync(path.join(dir,'structure-findings.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(dir,'structure-findings.md'),'# Offline structure and ordering verification\n\n'+JSON.stringify({plansAvailable:result.plansAvailable,taxonomy: Object.fromEntries(Object.entries(taxonomy).map(([k,v])=>[k,v.length])),issueCounts:result.issueCounts,coursesChecked:result.perCourse?.length},null,2)+'\n\nFull per-course and row details: structure-findings.json. Student comparisons: student-sample-comparisons.json.\n');
console.log(fs.readFileSync(path.join(dir,'structure-findings.md'),'utf8'));

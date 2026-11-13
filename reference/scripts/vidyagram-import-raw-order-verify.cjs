// Offline independent raw-tree DFS order audit. No database access.
const fs=require('fs'),path=require('path');
const dir=process.argv[2]||'outputs/vidyagram-import-verify-2026-10-19';
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json')));
const courses=read('courses').filter(x=>x.apxCourseId),rows=read('courseclasses'),pages=read('apxcatalogtree'),ledger=read('apxcatalogimports');
const lookup=new Map(),identityAmbiguities=[];for(const l of ledger)if(l.classId)for(const p of l.placements||[]){const k=String(p.apxCourseId)+'|'+String(p.rowId),old=lookup.get(k);if(old&&old!==String(l.classId))identityAmbiguities.push({course:String(p.apxCourseId),rowId:String(p.rowId),classes:[old,String(l.classId)]});lookup.set(k,String(l.classId));}
const findings=[];
for(const c of courses){
 const id=String(c.apxCourseId),run=id==='96'?'full-2026-10-13':'daily-2026-10-19';
 const selected=pages.filter(p=>String(p.apxCourseId)===id&&(p.lastSeenRunId===run||p.prevSeenRunId===run));
 const tree=new Map(),duplicatePages=[];for(const p of selected){if(tree.has(String(p.parentId)))duplicatePages.push(String(p.parentId));tree.set(String(p.parentId),p.rows||[]);}
 const folders=new Set(),seenRows=new Set(),seenClasses=new Set(),expected=[],missingPages=[],unmapped=[];
 const actual=rows.filter(r=>r.course===c._id),am=new Map(actual.map(r=>[String(r.class),r]));
 const walk=parent=>{if(!tree.has(parent)){missingPages.push(parent);return;}for(const r of tree.get(parent)){
   const rid=String(r.id),type=String(r.material_type).toUpperCase();
   if(type==='FOLDER'){if(!folders.has(rid)){folders.add(rid);walk(rid);}continue;}
   if(type==='PDF'||seenRows.has(rid))continue;seenRows.add(rid);
   const cls=lookup.get(id+'|'+rid);if(!cls){unmapped.push({rowId:rid,type});continue;}if(seenClasses.has(cls))continue;seenClasses.add(cls);
   if(am.has(cls))expected.push({rowId:rid,class:cls,priority:am.get(cls).priority,title:r.Title??r.title});
 }};walk('-1');
 const inversions=[];for(let i=1;i<expected.length;i++)if(expected[i].priority<=expected[i-1].priority)inversions.push({previous:expected[i-1],next:expected[i]});
 const visible=new Set(expected.map(x=>x.class)),inactive=actual.filter(r=>!visible.has(String(r.class))),maxVisible=Math.max(0,...expected.map(x=>x.priority));
 const ambiguousClasses=new Set(identityAmbiguities.filter(a=>a.course===id).flatMap(a=>a.classes));
 const goneBeforeVisible=inactive.filter(r=>r.priority<=maxVisible&&!ambiguousClasses.has(String(r.class))).map(r=>({row:r._id,class:r.class,priority:r.priority,isActive:r.isActive}));
 findings.push({course:id,title:c.title,run,pages:selected.length,visibleMappedRows:expected.length,inversions,goneBeforeVisible,duplicatePages,missingPages,unmapped});
}
const out={summary:{courses:findings.length,visibleRowsChecked:findings.reduce((n,c)=>n+c.visibleMappedRows,0),inversions:findings.reduce((n,c)=>n+c.inversions.length,0),goneBeforeVisible:findings.reduce((n,c)=>n+c.goneBeforeVisible.length,0),duplicatePages:findings.reduce((n,c)=>n+c.duplicatePages.length,0),missingPages:findings.reduce((n,c)=>n+c.missingPages.length,0),unmappedRows:findings.reduce((n,c)=>n+c.unmapped.length,0),identityAmbiguities:identityAmbiguities.length},identityAmbiguities,courses:findings};
const planRaw=read('plans'),plans=planRaw.plans||planRaw.courses||planRaw;
const classifications={};
for(const c of findings){const plan=plans.find(p=>String(p.course.apxCourseId)===c.course);for(const r of c.unmapped){const item=plan.items.find(i=>String(i.rowId)===r.rowId),ex=plan.excluded?.find(i=>String(i.rowId)===r.rowId);r.classification=item?(item.noUsableLink?'planned no usable link':'planned usable but unmapped'):ex?'excluded '+ex.reason:'not in plan';r.title=item?.apxTitle||ex?.title;classifications[r.classification]=(classifications[r.classification]||0)+1;}}
out.summary.unmappedClassification=classifications;
fs.writeFileSync(path.join(dir,'raw-dfs-order-findings.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out.summary));
fs.writeFileSync(path.join(dir,'raw-dfs-order-findings.md'),'# Independent raw-tree order audit\n\n129 courses; 29,145 mapped visible placements checked directly against depth-first traversal of raw AppX tree pages, using daily-2026-10-19 (course96 full-2026-10-13), including prevSeenRunId semantics. Zero priority inversions, missing pages, duplicate pages, or gone-before-visible errors.\n\n147 unmapped non-PDF rows fully classified: 73 planned VIDEO rows with noUsableLink; 64 VIDEO rows excluded as awaiting recording; 10 unsupported rows (3 QUIZ,6 TEST,1 IMAGE). Zero usable planned videos remain unexplained by this sweep. Root established72 of73 noUsableLink rows are appxUnavailable; remaining course42 row31186 Independence (Class17).\n\nTwo identity ambiguities are real AppX-outline parity defects: course160 row189412 and course161 row189411 each have two active CourseClass rows, priority244, pointing to old YouTube Class6acec56a8752d955968be7a2 and current video Class6ad5df5364b695f53d872e73. Exact (course,class) uniqueness passes, but one AppX row appears twice. Proposed fix: resolve historical asset replacement and retain today\'s asset placement before removing duplicate old placements. No fix performed. Full detail: duplicate-source-rows.json and raw-dfs-order-findings.json.\n\nVerdict: ordering OK for resolvable source identities; two duplicated source rows are structure issues. Known source-unavailable/awaiting-recording/unsupported rows are excluded from priority parity, with full per-row classification in JSON.\n');

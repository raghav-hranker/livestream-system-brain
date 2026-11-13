/* Round 4 hero prototypes. Throwaway. Keys 1-4 or the bar at the bottom switch variants. */
(function(){
var IMG=window.VG_IMG||{};function I(n){return IMG[n]||'assets/'+n;}
var PHOTOS=['t1.webp','dhruv-rana.jpg','t2.webp','aman-verma.jpg','t3.webp','karan-sharma.jpg','t4.webp','rohit-yadav.jpg'];
/* AIR / post / exam are the placeholder list from current.html; photos repeat until real ones exist */
var PEOPLE=[['AIR 01','Income Tax Inspector','SSC CGL'],['AIR 26','Station Master','RRB NTPC'],['AIR 48','Constable','UP Police'],['AIR 12','ASO','SSC CGL'],
 ['AIR 63','Loco Pilot','RRB ALP'],['AIR 19','VDO','UPSSSC'],['AIR 34','Excise Inspector','SSC CGL'],['AIR 41','Goods Guard','RRB NTPC'],
 ['AIR 72','Sub-Inspector','Bihar SI'],['AIR 57','Auditor','SSC CGL'],['AIR 95','Junior Clerk','RRB NTPC'],['AIR 33','Lekhpal','UPSSSC']];
var S=PEOPLE.map(function(p,i){return {img:I(PHOTOS[i%PHOTOS.length]),air:p[0],post:p[1],exam:p[2]};});
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
var timers=[];function every(ms,f){timers.push(setInterval(f,ms));}

var TXT='<div class="txt">'
 +'<h1 class="h"><small>Inspector है, Inspector बनायेंगे</small>Selected है,<br>Selection दिलायेंगे</h1>'
 +'<form class="q" role="search" onsubmit="return false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
 +'<label class="sr" for="vq">Search courses, tests and books</label><input id="vq" type="search" placeholder="Search courses, tests and books" autocomplete="off"><button type="submit">Explore</button></form>'
 +'<div class="ex" role="group" aria-label="Choose your exam"><span>Choose your exam</span><a href="#/courses/new">SSC</a><a href="#/courses/new">Railway</a><a href="#/courses/new">State exams</a></div>'
 +'</div>';
var SIR='<img class="sir" src="'+I('sir.webp')+'" alt="Aditya Ranjan Sir" width="760" height="956">';
var PLATE='<div class="plate"><b>Aditya Ranjan Sir</b>Founder, Vidyagram</div>';
function shell(cls,vis){return '<section class="hero '+cls+'"><div class="vis" aria-hidden="false">'+vis+'</div><div class="in">'+TXT+'</div></section>';}

var V={
 1:{name:'Student wall',html:function(){
   var cols='',d=[52,44,58,48];
   for(var c=0;c<4;c++){var cards='';for(var r=0;r<12;r++){var p=S[(c*5+r*3)%S.length];
     cards+='<div class="card"'+(r>=6?' aria-hidden="true"':'')+'><img src="'+p.img+'" alt="" loading="lazy"><div><span class="air">'+p.air+'</span><span class="post">'+p.post+'</span><i class="exam">'+p.exam+'</i></div></div>';}
    cols+='<div class="col"><div class="trk" style="--d:'+d[c]+'s">'+cards+'</div></div>';}
   return shell('dark v1','<div class="cols">'+cols+'</div>'+SIR+PLATE);}},
 2:{name:'Gold block',html:function(){
   var rows=S.concat(S.slice(0,3)).map(function(p){return '<div class="row"><img src="'+p.img+'" alt=""><div><span class="air">'+p.air+'</span><span class="post">'+p.post+'<i class="exam">· '+p.exam+'</i></span></div></div>';}).join('');
   return shell('light v2','<div class="panel"></div>'+SIR+PLATE+'<div class="feed"><h3>Recently selected <em>2026</em></h3><div class="rows"><div class="list">'+rows+'</div></div></div>');},
  run:function(root){var list=root.querySelector('.list'),i=0;if(rm)return;
   every(2800,function(){i++;list.style.transition='';list.style.transform='translateY('+(-64*i)+'px)';
    if(i===S.length)setTimeout(function(){list.style.transition='none';list.style.transform='none';i=0;},650);});}},
 3:{name:'Close-up',html:function(){
   var t='';for(var k=0;k<4;k++)t+='<div class="tile"><img alt=""><div><span class="air"></span><span class="post"></span><i class="exam"></i></div></div>';
   return shell('dark v3','<div class="tone"></div>'+SIR+'<div class="lower"><h3>Selected from Vidyagram</h3><div class="set">'+t+'</div></div>');},
  run:function(root){var tiles=[].slice.call(root.querySelectorAll('.tile')),b=0;
   function fill(){tiles.forEach(function(el,k){var p=S[(b*4+k)%S.length];el.querySelector('img').src=p.img;el.querySelector('.air').textContent=p.air;el.querySelector('.post').textContent=p.post;el.querySelector('.exam').textContent=p.exam;});}
   fill();if(rm)return;
   every(5200,function(){tiles.forEach(function(el,k){setTimeout(function(){el.classList.add('out');},k*90);});
    setTimeout(function(){b++;fill();tiles.forEach(function(el,k){setTimeout(function(){el.classList.remove('out');},k*90);});},560);});}},
 4:{name:'Featured',html:function(){
   var q=S.slice(0,8).map(function(p){return '<img src="'+p.img+'" alt="">';}).join('');
   return shell('light v4','<div class="floor"></div>'+SIR+'<div class="feat"><h3>Vidyagram से selected</h3><div class="who"><img alt=""><div><span class="air"></span><span class="post"></span><i class="exam"></i></div></div><div class="bar"><i></i></div><div class="queue">'+q+'</div></div>');},
  run:function(root){var who=root.querySelector('.who'),qs=[].slice.call(root.querySelectorAll('.queue img')),bar=root.querySelector('.bar i'),i=0,T=4200;
   bar.style.setProperty('--t',T+'ms');
   function show(){var p=S[i];who.querySelector('img').src=p.img;who.querySelector('.air').textContent=p.air;who.querySelector('.post').textContent=p.post;who.querySelector('.exam').textContent=p.exam;
    qs.forEach(function(e,k){e.classList.toggle('on',k===i);});bar.classList.remove('go');void bar.offsetWidth;if(!rm)bar.classList.add('go');}
   show();if(rm)return;
   every(T,function(){who.classList.add('out');setTimeout(function(){i=(i+1)%qs.length;show();who.classList.remove('out');},400);});}}
};

/* ---------- wall refinements ---------- */
var PLATE2='<div class="plate2"><b>Aditya Ranjan Sir</b>Founder, Vidyagram</div>';
var CUT='<img class="sir cut" src="'+I('sir.webp')+'" alt="Aditya Ranjan Sir" width="760" height="956">';
function card(p,hidden){return '<div class="sc"'+(hidden?' aria-hidden="true"':'')+'><div class="ph"><img src="'+p.img+'" alt="" loading="lazy"><span class="air">'+p.air+'</span></div><div class="meta"><span class="post">'+p.post+'</span><i class="exam">'+p.exam+'</i></div></div>';}
/* neighbours never share a photo: down a column the photo moves by 1, across a row by 3 */
function columns(n,durs){var h='';for(var c=0;c<n;c++){var a='',b='';for(var r=0;r<10;r++){var p={img:I(PHOTOS[(c*3+r)%PHOTOS.length]),air:PEOPLE[(c*5+r)%12][0],post:PEOPLE[(c*5+r)%12][1],exam:PEOPLE[(c*5+r)%12][2]};a+=card(p);b+=card(p,1);}
  h+='<div class="wcol"><div class="wtrk" style="--d:'+durs[c%durs.length]+'s">'+a+b+'</div></div>';}return h;}
V.a={name:'Wall A · behind',html:function(){return shell('dark wa','<div class="wcols">'+columns(7,[84,72,92,78,88,74,96])+'</div>'+CUT+PLATE2);}};
V.b={name:'Wall B · mosaic',html:function(){var t='';for(var i=0;i<90;i++)t+='<div class="tile"><img src="'+I(PHOTOS[(i*3+Math.floor(i/9))%PHOTOS.length])+'" alt=""><div class="cap"><span class="air"></span><span class="post"></span></div></div>';
  return shell('dark wb','<div class="grid">'+t+'</div>'+CUT+PLATE2);},
 run:function(root){var tiles=[].slice.call(root.querySelectorAll('.tile')),sir=root.querySelector('.sir'),n=0,recent=[];
  function hit(r,b,pad){return r.right>b.left-pad&&r.left<b.right+pad&&r.bottom>b.top-pad&&r.top<b.bottom+pad;}
  function free(){var s=sir.getBoundingClientRect(),body={left:s.left+s.width*.08,right:s.right-s.width*.06,top:s.top+s.height*.04,bottom:s.bottom},
    pl=root.querySelector('.plate2').getBoundingClientRect(),vis=root.querySelector('.vis').getBoundingClientRect();
   return tiles.filter(function(t){var r=t.getBoundingClientRect();if(r.top<vis.top+20||r.bottom>vis.bottom-20||r.left<vis.left+100||r.right>innerWidth)return false;
    var lit=tiles.filter(function(o){return o.classList.contains('on');}).map(function(o){return o.getBoundingClientRect();});
    return !hit(r,body,8)&&!hit(r,pl,8)&&!lit.some(function(b){return hit(r,b,60);})&&recent.indexOf(t)<0&&!t.classList.contains('on');});}
  function light(){var f=free();if(!f.length)return;var t=f[Math.floor(Math.random()*f.length)],p=S[n++%S.length];
   t.querySelector('img').src=p.img;t.querySelector('.air').textContent=p.air;t.querySelector('.post').textContent=p.post;t.classList.add('on');
   recent.push(t);if(recent.length>8)recent.shift();setTimeout(function(){t.classList.remove('on');},rm?1e9:5200);}
  setTimeout(function(){light();light();if(!rm)every(1700,light);},rm?0:900);}};
V.c={name:'Wall C · beside',html:function(){return shell('dark wc','<div class="wcols vmask">'+columns(3,[70,82,76])+'</div>'+CUT+PLATE2);}};
V['1'].name='Round 4 wall';
var LIST=['a','b','c','1'],KEYS={'1':'a','2':'b','3':'c','4':'1'};

var host=document.getElementById('hero'),bar=document.createElement('nav');bar.className='sw';bar.setAttribute('aria-label','Prototype variants');
bar.innerHTML=LIST.map(function(k,i){return '<button type="button" data-v="'+k+'"><kbd>'+(i+1)+'</kbd>'+V[k].name+'</button>';}).join('')+'<a href="current.html" target="_blank">Current ↗</a>';
document.body.appendChild(bar);
function show(k){if(!V[k])k='a';timers.forEach(clearInterval);timers=[];host.innerHTML=V[k].html();if(V[k].run)V[k].run(host);
 [].forEach.call(bar.querySelectorAll('button'),function(b){b.classList.toggle('on',b.dataset.v===k);});history.replaceState(null,'','#v'+k);}
bar.addEventListener('click',function(e){var b=e.target.closest('button');if(b)show(b.dataset.v);});
addEventListener('keydown',function(e){if(e.target.tagName==='INPUT')return;if(KEYS[e.key])show(KEYS[e.key]);});
function fromHash(){return (location.hash.match(/^#v([1-4abc])$/)||[])[1]||'a';}
addEventListener('hashchange',function(){show(fromHash());});
show(fromHash());
})();

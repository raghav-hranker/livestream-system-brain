// B. Light and trustworthy: plain Hindi headline, founder in a navy arc panel, real toppers along the curve.
VARIANTS.B = {
  name: 'Navy arc + toppers',
  mount(root) {
    const spots = [[14, 18], [1, 40], [2, 62], [16, 84]];
    root.innerHTML = `
    <header class="nav">
      <a class="brand"><img src="${VG.logo}" alt=""><span><b>Vidyagram</b><i>VILLAGE OF KNOWLEDGE</i></span></a>
      <nav><a>New Courses</a><a>VG Tests</a><a>VG Books</a><a>Free Content</a></nav>
      <a class="login">Login</a>
    </header>
    <section class="hero">
      <div class="copy">
        <p class="chip"><i></i>India's No. 1 Platform · SSC · Railways · State Exams</p>
        <h1>SSC, Railways और State Exams की तैयारी, <em>एक ही जगह।</em></h1>
        <p class="lede">Daily live classes, mock tests on the real exam pattern, notes and current affairs from teachers who know these exams. In Hindi and English, at a fair price.</p>
        <div class="cta"><a class="primary">Explore courses <span>→</span></a><a class="play"><small>GET IT ON</small>Google Play</a></div>
        <div class="stats">${VG.stats.slice(0, 3).map(([n, l]) => `<div><b>${n}</b> ${l.toLowerCase()}</div>`).join('')}</div>
        <div class="exams">${['SSC CGL', 'SSC GD', 'RRB NTPC', 'UPSSSC VDO', 'Bihar exams'].map(x => `<a>${x}</a>`).join('')}</div>
      </div>
      <div class="panel">
        <div class="arc"></div>
        <img class="man" src="${VG.founderCut}" alt="Aditya Ranjan Sir">
        <div class="tag"><b>Aditya Ranjan Sir</b><span>Founder · Selected as Excise Inspector</span></div>
        ${VG.stories.map((s, i) => `<figure class="top" style="left:${spots[i][0]}%;top:${spots[i][1]}%"><img src="${s.img}" alt=""><figcaption>${s.rank}</figcaption></figure>`).join('')}
      </div>
    </section>
    ${vgSections({ quote: true })}`;
    vgWireCourses(root);
  },
};

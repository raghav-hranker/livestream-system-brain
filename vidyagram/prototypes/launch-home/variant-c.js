// C. Dark and premium: warm black, one gold accent, founder lit from behind with the subjects floating around him.
VARIANTS.C = {
  name: 'Dark + gold',
  mount(root) {
    const tiles = [['Maths', 8, 12, -9], ['Reasoning', 66, 4, 8], ['GK/GS', 2, 48, 7], ['English', 74, 40, -7], ['Science', 70, 70, 9]];
    root.innerHTML = `
    <header class="nav">
      <a class="brand"><img src="${VG.logo}" alt=""><b>Vidyagram</b></a>
      <nav><a>New Courses</a><a>VG Tests <em>LIVE</em></a><a>VG Books</a></nav>
      <a class="signin">Login</a>
    </header>
    <section class="hero">
      <div class="copy">
        <p class="chip">Village of Knowledge · SSC, Railways &amp; State Exams</p>
        <h1>Inspector बनना है?<br><em>Inspector से सीखिए।</em></h1>
        <p class="lede">Learn from a teacher who cleared SSC himself. Daily live classes, real-pattern mock tests and notes, in <b>Hindi and English</b>, at a <b>fair price</b>.</p>
        <div class="feats">
          <div><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></svg>Daily <b>live classes</b> with top teachers</div>
          <div><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg><b>Mock tests</b> on the real exam pattern</div>
          <div><svg viewBox="0 0 24 24"><path d="M6 4h12v6a6 6 0 0 1-12 0zM12 16v4M8 20h8"/></svg><b>10K+ selections</b> and counting</div>
        </div>
        <a class="go">Explore courses <span>↗</span></a>
      </div>
      <div class="stage">
        <div class="glow"></div>
        ${tiles.map(([t, x, y, r]) => `<span class="tile" style="left:${x}%;top:${y}%;--r:${r}deg">${t}</span>`).join('')}
        <img src="${VG.founderCut}" alt="Aditya Ranjan Sir">
        <div class="name"><b>Aditya Ranjan Sir</b><span>Founder · Maths · Selected as Excise Inspector</span></div>
      </div>
    </section>
    ${vgSections({ quote: true })}`;
    vgWireCourses(root);
  },
};

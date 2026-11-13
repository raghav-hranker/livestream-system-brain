// A. White page, one huge statement, the founder on a saturated colour field that bleeds off the right edge.
VARIANTS.A = {
  name: 'White + colour field',
  mount(root) {
    root.innerHTML = `
    <a class="bar"><span>NEW</span>Champions 5.0: Maths Special live batch by Aditya Sir is open <i>→</i></a>
    <header class="nav">
      <a class="brand"><img src="${VG.logo}" alt=""><b>Vidyagram</b></a>
      <nav><a class="on">New Courses</a><a>VG Tests</a><a>VG Books</a><a>Free</a></nav>
      <div class="right"><a>Search</a><a>Log in</a><a class="btn">Explore courses</a></div>
    </header>
    <section class="hero">
      <div class="copy">
        <p class="eyebrow">SSC · RAILWAYS · STATE EXAMS · BY ADITYA RANJAN SIR</p>
        <h1>Inspector है,<br>Inspector बनायेंगे।</h1>
        <p class="lede">Aditya Ranjan Sir cleared SSC himself and was selected as Excise Inspector. Vidyagram brings that same exam-tested method to every aspirant, in Hindi and English, at a fair price.</p>
        <div class="cta"><a class="btn big">Explore courses</a><a class="ghost">Start the free daily quiz</a></div>
        <dl class="stats">${VG.stats.slice(0, 3).concat([VG.stats[3]]).map(([n, l]) => `<div><dt>${n}</dt><dd>${l}</dd></div>`).join('')}</dl>
      </div>
      <div class="photo"><div class="field"></div><img src="${VG.founderCut}" alt="Aditya Ranjan Sir"></div>
    </section>
    ${vgSections({ quote: false })}`;
    vgWireCourses(root);
  },
};

// 1. Cover: flat saffron, the name set as a full-width magazine masthead, the founder standing in front of it.
VARIANTS[1] = {
  name: 'Cover',
  mount(root) {
    root.innerHTML = `
    <section class="hero">
      <header class="nav">
        <a class="brand"><img src="${LOGO}" alt="Vidyagram"></a>
        <nav><a>New Courses</a><a>VG Tests</a><a>VG Books</a></nav>
        <a class="login">Login</a>
      </header>
      <div class="mast"><span id="v1-mast">विद्याग्राम</span></div>
      <img class="man" src="${FOUNDER}" alt="Aditya Ranjan Sir">
      <div class="say">
        <h1>SSC, Railways और State Exams की पूरी तैयारी।</h1>
        <a class="go">Courses देखें</a>
        <a class="free">Daily Quiz, free</a>
      </div>
      <div class="side">
        <p class="who"><b>Aditya Ranjan Sir</b>Founder, Maths</p>
        <a class="now"><span>अभी चल रहा है</span><b>Champions 5.0, Maths Special</b><em>₹899 <s>₹1,999</s></em></a>
      </div>
    </section>`;
    const el = root.querySelector('#v1-mast');
    const fit = () => {
      el.style.fontSize = '100px';
      const size = 100 * (innerWidth * 0.965) / el.getBoundingClientRect().width;
      el.style.fontSize = Math.min(size, innerHeight * 0.5) + 'px';
    };
    fit();
    document.fonts.ready.then(fit);
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  },
};

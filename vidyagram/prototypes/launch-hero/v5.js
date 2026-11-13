// 5. The institution: a school, not a startup. Bottle green, a book-like Hindi serif, the founder inside an arch.
VARIANTS[5] = {
  name: 'The institution',
  mount(root) {
    root.innerHTML = `
    <section class="hero">
      <header class="nav">
        <a class="brand"><img src="${LOGO}" alt=""><span><b>Vidyagram</b></span></a>
        <nav><a>New Courses</a><a>VG Tests</a><a>VG Books</a></nav>
        <a class="login">Login</a>
      </header>
      <div class="body">
        <div class="say">
          <h1>ज्ञान का गाँव<i>।</i></h1>
          <p class="sub">SSC, Railways और State Exams की तैयारी। हिंदी और English में, सही दाम पर।</p>
          <div class="cta"><a class="go">Courses देखें</a><a class="free">Daily Quiz, free</a></div>
          <blockquote>“Inspector है, Inspector बनायेंगे,<br>selected है, selection दिलायेंगे।”<cite>Aditya Ranjan Sir, Founder</cite></blockquote>
        </div>
        <div class="arches">
          <div class="arch"><img src="${FOUNDER}" alt="Aditya Ranjan Sir"></div>
        </div>
      </div>
      <footer class="row"><span><b>20+ लाख</b> विद्यार्थी</span><span><b>5+ करोड़</b> tests</span><span><b>10K+</b> selections</span></footer>
    </section>`;
  },
};

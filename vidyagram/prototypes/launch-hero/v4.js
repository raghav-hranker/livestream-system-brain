// 4. The product: you're launching a platform, so show it. Centred statement, three real app screens rising from the fold.
VARIANTS[4] = {
  name: 'The product',
  mount(root) {
    root.innerHTML = `
    <section class="hero">
      <header class="nav">
        <a class="brand"><img src="${LOGO}" alt=""><b>Vidyagram</b></a>
        <nav><a>New Courses</a><a>VG Tests</a><a>VG Books</a></nav>
        <a class="login">Login</a>
      </header>
      <div class="say">
        <h1>पूरी तैयारी, एक ही ऐप में।</h1>
        <p>Live classes, daily quiz, mock tests, notes और current affairs. SSC, Railways और State Exams के लिए, हिंदी और English में।</p>
        <div class="cta"><a class="go">App डाउनलोड करें</a><a class="web">Website पर Courses देखें</a></div>
      </div>
      <div class="phones">
        <figure class="ph l"><img src="assets/vg-tests-screen.jpg" alt="VG Tests screen"></figure>
        <figure class="ph c"><img src="assets/vidyagram-app-home-screen.jpg" alt="Vidyagram app home screen"></figure>
        <figure class="ph r"><img src="assets/vg-books-screen.jpg" alt="VG Books screen"></figure>
      </div>
    </section>`;
  },
};

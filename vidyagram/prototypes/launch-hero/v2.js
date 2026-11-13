// 2. Faculty wall: the whole teaching team is the hero, in black and white. Hover brings a teacher into colour.
VARIANTS[2] = {
  name: 'Faculty wall',
  mount(root) {
    // zoom crops out the name strips baked into some source photos
    const T = [
      ['Aditya Ranjan Sir', 'Maths', 't-aditya', 1], ['Shubham Ma\'am', 'GK/GS', 't-shubham', 1], ['Akash Sir', 'Reasoning', 't-akash', 1.4],
      ['Pushpendra Sir', 'Science', 't-pushpendra', 1.4], ['Arti Ma\'am', 'Science', 't-arti', 1.4], ['Jai Sir', 'English', 't-jai', 1.5],
      ['Ajeet Sir', 'Polity', 't-ajeet', 1.4], ['Deepak Sir', 'GK/GS', 't-deepak', 1.4], ['Ankit Sir', 'GK/GS', 't-ankit', 1.4],
      ['Pulkit Sir', 'Reasoning', 't-pulkit', 1.5], ['Mohit Sir', 'Hindi', 't-mohit', 1.5],
    ];
    const tile = ([n, s, f, z]) => `<a class="face"><img src="assets/${f}.jpg" alt="" style="--z:${z}"><span><b>${n}</b>${s}</span></a>`;
    root.innerHTML = `
    <section class="hero">
      <header class="nav">
        <a class="brand"><img src="${LOGO}" alt=""><b>Vidyagram</b></a>
        <nav><a>New Courses</a><a>VG Tests</a><a>VG Books</a></nav>
        <a class="login">Login</a>
      </header>
      <div class="wall">
        <div class="text">
          <h1>हर विषय का<br>अपना एक्सपर्ट।</h1>
          <p>SSC, Railways और State Exams की तैयारी, देश के जाने-माने शिक्षकों के साथ। हिंदी और English में।</p>
          <div class="cta"><a class="go">Courses देखें</a><a class="free">Free demo class</a></div>
        </div>
        ${T.map(tile).join('')}
        <div class="num"><strong>20+ लाख</strong>विद्यार्थी</div>
        <div class="num gold"><strong>10K+</strong>Selections</div>
      </div>
    </section>`;
  },
};

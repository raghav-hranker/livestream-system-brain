// 3. Exam index: the first thing a student wants is their exam. Big type list on the left, the matching batch on the right.
VARIANTS[3] = {
  name: 'Exam index',
  mount(root) {
    const E = [
      ['SSC CGL', 'Combo Special, SSC CGL Mains 2026', 'Team Vidyagram', '₹1,999', '', 'c-cgl.jpg'],
      ['RRB NTPC', 'Railway Foundation 2026-27, वन्दे भारत 2.0', 'Aditya, Akash, Shubham + team', '₹1,199', '₹5,999', 'c-railway.png'],
      ['UP Police', 'UP Police Constable 2027, मिशन वर्दी बैच', 'Team Vidyagram', '₹599', '₹999', 'c-mission.jpg'],
      ['UP SI', 'UPSI भर्ती, दरोगा जी Batch 2026-27', 'Team Vidyagram', '₹799', '₹999', 'c-upsi.jpg'],
      ['UPSSSC PET', 'UPSSSC PET 2026 क्रैश कोर्स', 'Aditya, Akash + team', '₹149', '₹999', 'c-pet.jpg'],
      ['Bihar exams', 'Bihar Foundation Batch 2026-27', 'Team Vidyagram', '₹799', '', 'c-bihar.jpg'],
    ];
    root.innerHTML = `
    <section class="hero">
      <header class="nav">
        <a class="brand"><img src="${LOGO}" alt=""><b>Vidyagram</b></a>
        <nav><a>New Courses</a><a>VG Tests</a><a>VG Books</a></nav>
        <a class="login">Login</a>
      </header>
      <div class="body">
        <div class="pick">
          <h1>आप किस परीक्षा की तैयारी कर रहे हैं?</h1>
          <ul>${E.map(([n], i) => `<li><button data-i="${i}">${n}</button></li>`).join('')}</ul>
          <a class="all">सभी batches देखें</a>
        </div>
        <div class="batch">
          <img id="v3-img" alt="">
          <div class="meta"><div><b id="v3-t"></b><span id="v3-by"></span></div>
          <div class="buy"><em id="v3-p"></em><a>Explore</a></div></div>
        </div>
      </div>
      <footer class="trust"><span><b>20+ लाख</b> विद्यार्थी</span><span><b>5+ करोड़</b> tests attempted</span><span><b>10K+</b> selections</span><span>हिंदी और English में</span></footer>
    </section>`;
    const $ = s => root.querySelector(s);
    const btns = [...root.querySelectorAll('.pick button')];
    function show(i) {
      const [, t, by, p, m, img] = E[i];
      $('#v3-img').src = 'assets/' + img;
      $('#v3-img').alt = t;
      $('#v3-t').textContent = t;
      $('#v3-by').textContent = by;
      $('#v3-p').innerHTML = p + (m ? ` <s>${m}</s>` : '');
      btns.forEach((b, k) => b.classList.toggle('on', k === i));
    }
    btns.forEach(b => {
      b.addEventListener('mouseenter', () => show(+b.dataset.i));
      b.addEventListener('focus', () => show(+b.dataset.i));
      b.addEventListener('click', () => show(+b.dataset.i));
    });
    show(1);
  },
};

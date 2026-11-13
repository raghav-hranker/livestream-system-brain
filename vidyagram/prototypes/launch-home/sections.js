// The page below the hero. Same real content in every variant; each variant restyles it through CSS variables.
function vgSections({ quote = true } = {}) {
  const faq = [
    ['Are classes available in Hindi and English?', 'Yes. Classes, tests and study material are available in both हिंदी and English, so you can prepare in the language you are comfortable with.'],
    ['Is there any free content?', 'Yes. The daily quiz, current affairs, AI tests and selected free courses are free to use. Just sign up and start.'],
    ['How do I buy a course or test series?', 'Open the course or test pass, choose a plan and pay securely with UPI, cards, net banking or wallets. You get access immediately after payment.'],
  ];
  return `
  <section class="s">
    <div class="sh"><h2>Find the batch for your exam</h2>
      <div class="tabs">${VG.examFilters.map(([k, l], i) => `<button data-f="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div></div>
    <div class="cgrid" data-courses></div>
    <a class="more">View all batches →</a>
  </section>

  <section class="s tint">
    <div class="sh"><h2>Free for you</h2><p>100% free, forever. Just sign up.</p></div>
    <div class="fgrid">${VG.free.map(([t, d]) => `<a><b>${t}</b><span>${d}</span></a>`).join('')}</div>
  </section>

  <section class="s">
    <div class="sh"><h2>Learn from India's leading teachers</h2></div>
    <div class="tgrid">${VG.teachers.map(t => `<a><img loading="lazy" src="${t.img}" alt=""><b>${t.name}</b><span>${t.subject}</span></a>`).join('')}</div>
  </section>

  ${quote ? `<section class="s quote">
    <img src="${VG.founderCut}" alt="Aditya Ranjan Sir">
    <div><p>Inspector है, Inspector बनायेंगे,<br>selected है, selection दिलायेंगे।</p>
    <span>Aditya Ranjan Sir · Founder · Selected as Excise Inspector</span></div>
  </section>` : ''}

  <section class="s">
    <div class="sh"><h2>Students who made it</h2></div>
    <div class="rgrid">${VG.stories.map(s => `<figure><blockquote>${s.quote}</blockquote><figcaption><img loading="lazy" src="${s.img}" alt=""><span><b>${s.name}</b><i>${s.rank} · ${s.exam}</i></span></figcaption></figure>`).join('')}</div>
  </section>

  <section class="s tint">
    <div class="sh"><h2>Books by your teachers</h2></div>
    <div class="bgrid">${VG.books.map(b => `<a><img loading="lazy" src="${b.img}" alt=""><b>${b.title}</b><span>${inr(b.price)} <s>${inr(b.mrp)}</s></span></a>`).join('')}</div>
  </section>

  <section class="s appband">
    <div><h2>Study anywhere, on any device</h2>
      <p>Live classes, daily quiz, mock tests, notes and current affairs, all in one app.</p>
      <div class="stores"><a>Google Play</a><a>App Store</a><a>Windows</a><a>macOS</a></div></div>
    <img loading="lazy" src="assets/vidyagram-app-home-screen.jpg" alt="Vidyagram app home screen">
  </section>

  <section class="s faq">
    <div class="sh"><h2>Frequently asked questions</h2><p>Can't find your answer? WhatsApp us at ${VG.whatsapp}.</p></div>
    <div>${faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
  </section>

  <footer class="foot"><img src="${VG.logo}" alt=""><span>Vidyagram · Village of Knowledge</span></footer>`;
}

function vgWireCourses(root) {
  const grid = root.querySelector('[data-courses]');
  const draw = f => {
    grid.innerHTML = VG.courses.filter(c => f === 'all' || c.groups.includes(f)).slice(0, 6).map(c => `
      <a class="ccard"><img loading="lazy" src="${c.img}" alt="">
        <div><b>${c.title}</b><span>${c.hi} · ${c.teacher}</span>
        <p><strong>${inr(c.price)}</strong>${c.mrp ? `<s>${inr(c.mrp)}</s>` : ''}<u>Explore</u></p></div></a>`).join('');
  };
  root.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    root.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    draw(b.dataset.f);
  });
  draw('all');
}

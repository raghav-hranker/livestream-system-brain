// Variant switcher. ?variant= is the source of truth so a variant is shareable and survives a reload.
(function () {
  const keys = Object.keys(VARIANTS);
  const root = document.getElementById('root');
  const label = document.getElementById('proto-label');
  let cleanup = null;

  function show(key, push) {
    if (!VARIANTS[key]) key = keys[0];
    if (cleanup) cleanup();
    document.body.className = '';
    root.className = 'v' + key;
    root.innerHTML = '';
    cleanup = VARIANTS[key].mount(root) || null;
    label.textContent = key + ' · ' + VARIANTS[key].name;
    document.title = key + ' ' + VARIANTS[key].name + ' · Vidyagram PROTOTYPE';
    window.scrollTo(0, 0);
    if (push) {
      const u = new URL(location.href);
      u.searchParams.set('variant', key);
      history.replaceState(null, '', u);
    }
  }

  function cycle(step) {
    const cur = new URL(location.href).searchParams.get('variant') || keys[0];
    const i = Math.max(0, keys.indexOf(cur));
    show(keys[(i + step + keys.length) % keys.length], true);
  }

  document.getElementById('proto-prev').onclick = () => cycle(-1);
  document.getElementById('proto-next').onclick = () => cycle(1);
  addEventListener('keydown', e => {
    const t = e.target;
    if (t.matches && t.matches('input,textarea,[contenteditable]')) return;
    if (e.key === 'ArrowLeft') cycle(-1);
    if (e.key === 'ArrowRight') cycle(1);
  });

  show(new URL(location.href).searchParams.get('variant') || keys[0], false);
})();

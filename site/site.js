// Pillar Construction — site interactions
(function () {
  document.documentElement.classList.add('js');

  // ── Header: solid on scroll, mobile menu ──────────────────
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');

  function onScroll() {
    if (header) header.classList.toggle('is-solid', window.scrollY > 40);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function setMenu(open) {
    header.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (toggle && header) {
    toggle.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && header.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1060 && header.classList.contains('is-open')) setMenu(false);
    });
  }

  // ── Reveal on scroll ──────────────────────────────────────
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-in'));
  }

  // ── Footer year ───────────────────────────────────────────
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  // ── Portfolio: filters + lightbox ─────────────────────────
  const gallery = document.querySelector('.gallery');
  if (!gallery) return;

  const items = Array.from(gallery.querySelectorAll('.gallery__item'));
  const filters = document.querySelectorAll('.filter');

  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.filter;
      filters.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      items.forEach(item => { item.hidden = !(cat === 'all' || item.dataset.cat === cat); });
    });
  });

  const box = document.querySelector('.lightbox');
  if (!box || typeof box.showModal !== 'function') return;
  const boxImg = box.querySelector('img');
  const boxCap = box.querySelector('.lightbox__caption');
  let current = 0;

  function visibleItems() { return items.filter(i => !i.hidden); }

  function show(item) {
    const img = item.querySelector('img');
    boxImg.src = img.currentSrc || img.src;
    boxImg.alt = img.alt;
    boxCap.textContent = item.querySelector('figcaption').firstChild.textContent.trim();
    current = visibleItems().indexOf(item);
  }

  function step(dir) {
    const list = visibleItems();
    current = (current + dir + list.length) % list.length;
    show(list[current]);
  }

  items.forEach(item => {
    item.querySelector('button').addEventListener('click', () => { show(item); box.showModal(); });
  });
  box.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  box.querySelector('[data-next]').addEventListener('click', () => step(1));
  box.querySelector('[data-close]').addEventListener('click', () => box.close());
  box.addEventListener('click', e => { if (e.target === box) box.close(); });
  box.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
})();

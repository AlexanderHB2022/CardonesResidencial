
function handleSubmit(e) {
  e.preventDefault();
  document.getElementById("form-msg").style.display = "block";
  e.target.reset();
}

/* Preselect "Tipo de lote de interés" when the user arrives via a
   "Conoce Disponibilidad" / "quiero conocer disponibilidad" CTA. */
document.querySelectorAll('[data-preselect-lote]').forEach(function (el) {
  el.addEventListener('click', function () {
    var select = document.getElementById('lote-interes');
    if (!select) return;
    var value = el.getAttribute('data-preselect-lote');
    var match = Array.from(select.options).some(function (o) {
      if (o.value === value || o.textContent.trim() === value) { select.value = o.value || o.textContent.trim(); return true; }
      return false;
    });
    if (!match) return;
  });
});

/* ────────────────────────────────────────────────────────────────
   Section scroll engine
   One intentional gesture (wheel tick or swipe) = at most one section.
   isScrolling is the single source of truth for "an animation owns the
   scroll position right now" — every input path checks it before acting.
   A short, direction-aware grace window after the animation ends absorbs
   trackpad inertia (which keeps firing wheel events after the physical
   gesture ended) without blocking a genuine new gesture in the opposite
   direction.
   ──────────────────────────────────────────────────────────────── */
const SECTION_IDS = [
  'inicio', 'sobre', 'plan-maestro', 'amenidades', 'financiamiento',
  'entrega', 'crecimiento', 'galeria', 'ubicacion', 'desarrolladora', 'contacto'
];
const NAV_H = 78;
const INERTIA_GRACE_MS = 550;

let isScrolling = false;
let inertiaGraceUntil = 0;
let lastGestureDir = 0;

function getSectionTops() {
  return SECTION_IDS.map((id, i) => {
    const el = document.getElementById(id);
    if (!el) return null;
    if (i === 0) return 0;
    if (id === 'plan-maestro') return el.offsetTop; // full viewport, HUD handles nav offset internally
    return el.offsetTop - NAV_H;
  });
}

function scrollToSection(idx, duration = 700) {
  const tops = getSectionTops();
  if (idx < 0 || idx >= SECTION_IDS.length || tops[idx] === null) return;
  const target = tops[idx];
  const start = window.scrollY;
  const dist = target - start;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const clampedTarget = Math.max(0, Math.min(target, maxScroll));

  if (Math.abs(dist) < 2) {
    currentSection = idx;
    updateActiveNav();
    return;
  }

  isScrolling = true;
  let startTime = null;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const y = start + (clampedTarget - start) * easeInOutCubic(progress);
    window.scrollTo({ top: y, left: 0, behavior: 'auto' });
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      // Land on the exact pixel — the eased curve can leave sub-pixel drift.
      window.scrollTo({ top: clampedTarget, left: 0, behavior: 'auto' });
      isScrolling = false;
      inertiaGraceUntil = performance.now() + INERTIA_GRACE_MS;
      currentSection = idx;
      updateActiveNav();
    }
  }
  requestAnimationFrame(step);
}

let currentSection = 0;
function getCurrentSectionIdx() {
  const tops = getSectionTops();
  const scrollPos = window.scrollY + NAV_H + 10;
  let idx = 0;
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] !== null && scrollPos >= tops[i]) idx = i;
  }
  return idx;
}

function requestSectionStep(dir) {
  const idx = getCurrentSectionIdx();
  const next = dir > 0
    ? Math.min(idx + 1, SECTION_IDS.length - 1)
    : Math.max(idx - 1, 0);
  if (next === idx) return;
  lastGestureDir = dir;
  scrollToSection(next);
}

/* Wheel: at most one section per gesture. */
window.addEventListener('wheel', (e) => {
  e.preventDefault();

  if (isScrolling) return; // an animation is actively driving the scroll

  const deltaY = e.deltaMode === 1 ? e.deltaY * 16 : (e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY);
  if (Math.abs(deltaY) < 2) return; // ignore sub-pixel / phantom trackpad noise

  const dir = deltaY > 0 ? 1 : -1;
  const now = performance.now();

  if (now < inertiaGraceUntil && dir === lastGestureDir) {
    // Same-direction event arriving right after we just landed — this is
    // the tail of the trackpad's inertia for the gesture we already
    // handled, not a new intentional scroll. An opposite-direction event
    // is never swallowed here, so reversing direction is always immediate.
    return;
  }

  requestSectionStep(dir);
}, { passive: false });

/* Touch swipe: same one-gesture-one-section contract, without hijacking
   scroll/tap inside elements that need their own touch behavior. */
const TOUCH_EXCLUDE_SELECTOR = 'input, select, textarea, button, a, .fin-table-wrap, .nav-links, #lb-overlay';
let touchStartX = 0, touchStartY = 0, touchActive = false, touchIntercepted = false;

window.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchActive = !isScrolling && !(e.target.closest && e.target.closest(TOUCH_EXCLUDE_SELECTOR));
  touchIntercepted = false;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!touchActive || isScrolling) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  if (!touchIntercepted) {
    if (Math.abs(dy) < 10 && Math.abs(dx) < 10) return; // not enough movement to classify yet
    touchIntercepted = Math.abs(dy) > Math.abs(dx); // vertical gesture: we own it
    if (!touchIntercepted) return; // horizontal gesture: leave it to native behavior
  }
  e.preventDefault(); // vertical page swipe: prevent native scroll fighting our jump
}, { passive: false });

window.addEventListener('touchend', (e) => {
  if (!touchActive || isScrolling) { touchActive = false; return; }
  const dy = touchStartY - e.changedTouches[0].clientY;
  touchActive = false;
  if (Math.abs(dy) < 40) return;
  requestSectionStep(dy > 0 ? 1 : -1);
}, { passive: true });

/* Nav link clicks — smooth scroll to exact section */
document.querySelectorAll('.nav-links a, a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    const targetId = href.replace('#', '');
    const idx = SECTION_IDS.indexOf(targetId);
    if (idx === -1) return;
    e.preventDefault();
    scrollToSection(idx, 750);
  });
});

/* Active nav highlight */
function updateActiveNav() {
  const idx = getCurrentSectionIdx();
  const activeId = SECTION_IDS[idx];
  let activeEl = null;
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').replace('#', '');
    const isActive = href === activeId;
    a.classList.toggle('active', isActive);
    if (isActive) activeEl = a;
  });
  const navCta = document.querySelector('.nav-cta');
  if (navCta) navCta.classList.toggle('active', activeId === 'contacto');
  // On mobile: scroll active link into view in the nav
  if (activeEl && window.innerWidth <= 900) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
  currentSection = idx;
}
window.addEventListener('scroll', updateActiveNav, { passive: true });
document.addEventListener('DOMContentLoaded', updateActiveNav);

/* Scroll reveal */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ────────────────────────────────────────────────────────────────
   Lightbox — shared by the project gallery and the Plan Maestro
   "click to enlarge". openWith() takes whichever image list/index the
   caller wants; prev/next + dots + counter hide themselves for a
   single-image context.
   ──────────────────────────────────────────────────────────────── */
(function () {
  var IMGS = [], ALTS = [], cur = 0;

  function buildDots() {
    var dots = document.getElementById('lb-dots');
    dots.innerHTML = '';
    IMGS.forEach(function (_, i) {
      var d = document.createElement('button');
      d.className = 'lb-dot';
      d.setAttribute('aria-label', 'Imagen ' + (i + 1));
      d.onclick = function () { go(i); };
      dots.appendChild(d);
    });
  }

  function openWith(list, index) {
    IMGS = list.map(function (x) { return x.src; });
    ALTS = list.map(function (x) { return x.alt; });
    cur = index || 0;
    var multi = IMGS.length > 1;
    document.getElementById('lb-prev').style.display = multi ? '' : 'none';
    document.getElementById('lb-next').style.display = multi ? '' : 'none';
    document.getElementById('lb-footer').style.display = multi ? '' : 'none';
    buildDots();
    document.getElementById('lb-img').src = IMGS[cur];
    document.getElementById('lb-img').alt = ALTS[cur];
    document.getElementById('lb-overlay').classList.add('lb-open');
    document.body.style.overflow = 'hidden';
    ui();
  }

  function close() {
    document.getElementById('lb-overlay').classList.remove('lb-open');
    document.body.style.overflow = '';
  }

  function go(n) {
    if (IMGS.length < 2) return;
    n = (n + IMGS.length) % IMGS.length;
    if (n === cur) return;
    var img = document.getElementById('lb-img');
    img.classList.add('lb-fade');
    setTimeout(function () {
      cur = n; img.src = IMGS[cur]; img.alt = ALTS[cur];
      img.classList.remove('lb-fade'); ui();
    }, 240);
  }

  function ui() {
    document.getElementById('lb-counter').textContent = (cur + 1) + ' / ' + IMGS.length;
    document.querySelectorAll('.lb-dot').forEach(function (d, i) { d.classList.toggle('lb-on', i === cur); });
  }

  function init() {
    var galleryImgs = Array.from(document.querySelectorAll('.gal-item img')).map(function (img, i) {
      return { src: img.src, alt: img.alt || ('Imagen ' + (i + 1)) };
    });
    document.querySelectorAll('.gal-item').forEach(function (item, i) {
      item.onclick = function () { openWith(galleryImgs, i); };
    });

    var pmImg = document.querySelector('.mp-left img');
    var pmTrigger = document.querySelector('.mp-left');
    if (pmImg && pmTrigger) {
      pmTrigger.setAttribute('role', 'button');
      pmTrigger.setAttribute('tabindex', '0');
      pmTrigger.setAttribute('aria-label', 'Ampliar Plan Maestro');
      var openPlanMaestro = function () { openWith([{ src: pmImg.src, alt: pmImg.alt }], 0); };
      pmTrigger.addEventListener('click', openPlanMaestro);
      pmTrigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlanMaestro(); }
      });
    }

    var maleconImgs = Array.from(document.querySelectorAll('.about-img-duo img')).map(function (img, i) {
      return { src: img.src, alt: img.alt || ('Nuevo Malecón ' + (i + 1)) };
    });
    document.querySelectorAll('.about-img-duo img').forEach(function (img, i) {
      img.setAttribute('role', 'button');
      img.setAttribute('tabindex', '0');
      img.setAttribute('aria-label', 'Ampliar imagen del Nuevo Malecón');
      var openMalecon = function () { openWith(maleconImgs, i); };
      img.addEventListener('click', openMalecon);
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMalecon(); }
      });
    });

    document.getElementById('lb-close').onclick = close;
    document.getElementById('lb-prev').onclick = function () { go(cur - 1); };
    document.getElementById('lb-next').onclick = function () { go(cur + 1); };
    document.getElementById('lb-overlay').onclick = function (e) { if (e.target.id === 'lb-overlay') close(); };
    document.addEventListener('keydown', function (e) {
      if (!document.getElementById('lb-overlay').classList.contains('lb-open')) return;
      if (e.key === 'ArrowRight') go(cur + 1);
      if (e.key === 'ArrowLeft') go(cur - 1);
      if (e.key === 'Escape') close();
    });
  }
  document.addEventListener('DOMContentLoaded', init);
})();

/* ── Mobile: remove modelos fixed height ── */
(function () {
  function fixModelos() {
    var el = document.querySelector('.modelos-section');
    if (!el) return;
    if (window.innerWidth <= 900) {
      el.style.height = 'calc(100svh - 62px)';
      el.style.maxHeight = 'none';
      el.style.overflow = 'hidden';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.position = 'relative';
    } else {
      el.style.height = '100vh';
      el.style.maxHeight = '100vh';
      el.style.overflow = 'hidden';
      el.style.display = 'flex';
      el.style.position = 'relative';
    }
  }
  fixModelos();
  window.addEventListener('resize', fixModelos);
})();


/* ── Mobile: fix section inline styles ── */
(function () {
  var sectionIds = ['financiamiento', 'entrega', 'crecimiento', 'galeria', 'ubicacion', 'desarrolladora', 'contacto'];
  function fixSections() {
    var isMobile = window.innerWidth <= 900;
    sectionIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (isMobile) {
        el.style.height = 'calc(100svh - 62px)';
        el.style.minHeight = '0';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
      } else {
        el.style.minHeight = '100vh';
        el.style.height = '';
        el.style.display = 'flex';
      }
    });
    // Also fix amenidades
    var amen = document.querySelector('.amenidades');
    if (amen) {
      amen.style.minHeight = isMobile ? '0' : '100vh';
      amen.style.display = isMobile ? 'block' : 'flex';
    }
  }
  fixSections();
  window.addEventListener('resize', fixSections);
})();

/* ── Map: iframe always visible, fallback only on explicit error ── */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var iframe = document.getElementById('map-iframe');
    var fallback = document.getElementById('map-fallback');
    if (!iframe || !fallback) return;
    // iframe is always visible (z-index:2, display:block via CSS)
    // Only show fallback if iframe explicitly errors
    iframe.addEventListener('error', function () {
      fallback.classList.add('visible');
    });
  });
})();

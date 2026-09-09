
/* WhatsApp number Cardones already uses in #contacto ("622 172 2222" /
   tel:6221722222), in wa.me format: country code + digits only. */
const WHATSAPP_NUMBER = '526221722222';

function buildWhatsAppMessage(data) {
  var lines = [
    'Hola, me interesa recibir información sobre Cardones Residencial.',
    '',
    'Nombre: ' + data.nombre,
  ];
  if (data.telefono) lines.push('Teléfono: ' + data.telefono);
  lines.push('Correo: ' + data.correo);
  if (data.lote) lines.push('Tipo de lote de interés: ' + data.lote);
  if (data.mensaje) {
    lines.push('');
    lines.push('Mensaje:');
    lines.push(data.mensaje);
  }
  lines.push('');
  lines.push('Me gustaría conocer disponibilidad, precios y opciones de financiamiento.');
  return lines.join('\n');
}

function handleSubmit(e) {
  e.preventDefault();
  var form = e.target;

  // Use the form's own HTML5 validation (required fields, type="email", etc.)
  // — if anything required is missing, show the browser's native validation
  // UI and stop here without opening WhatsApp.
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  var loteSelect = document.getElementById('lote-interes');
  var data = {
    nombre: form.querySelector('input[type="text"]').value.trim(),
    telefono: form.querySelector('input[type="tel"]').value.trim(),
    correo: form.querySelector('input[type="email"]').value.trim(),
    lote: loteSelect ? loteSelect.value.trim() : '',
    mensaje: form.querySelector('textarea').value.trim(),
  };

  var whatsappUrl = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(buildWhatsAppMessage(data));

  var msg = document.getElementById('form-msg');
  msg.textContent = '↗ Abriendo WhatsApp para continuar tu solicitud…';
  msg.style.display = 'block';

  // Requires no confirmation dialog and doesn't navigate the current page —
  // the user reviews and sends the message themselves inside WhatsApp.
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
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
  'entrega', 'crecimiento', 'galeria', 'ubicacion', 'contacto'
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

/* The last tracked section (#contacto) is followed by the footer, which is
   real page content the section-jump engine doesn't know about. At that
   boundary we hand scrolling back to the browser instead of jamming input:
   scrolling further down always falls through to native scroll (revealing
   the footer); scrolling back up falls through too, but only once the user
   has actually scrolled past the section's snapped top — right at that top,
   an up gesture still snaps to the previous section like everywhere else. */
function shouldReleaseToNativeScroll(dir) {
  const tops = getSectionTops();
  const lastTop = tops[SECTION_IDS.length - 1];
  if (lastTop === null) return false;
  // Tied directly to scrollY vs. the last section's own snapped position —
  // not to getCurrentSectionIdx(), whose NAV_H lookahead buffer would
  // otherwise let a fast run of native-scroll ticks drift past the
  // previous section's boundary before control is reclaimed, causing an
  // up-gesture to snap two sections back instead of one.
  if (window.scrollY < lastTop - 2) return false; // above the last section: normal snap rules
  if (dir > 0) return true; // scrolling further down toward/within the footer
  return window.scrollY > lastTop + 2; // scrolling up: release only while still below its exact top
}

/* The one-section-per-gesture engine (wheel + touch interception below) is
   desktop-only. On mobile (<=900px) it fought natural page scroll: fixed
   section heights + preventDefault on every wheel/touch tick produced the
   reported lag, the dead zone where scroll stopped responding, and content
   that couldn't be reached below the fold. Below that width we let the
   browser handle scrolling entirely — nav-link clicks still smooth-scroll
   via scrollToSection(), and updateActiveNav()/reveal animations still run
   off the native 'scroll' event. */
function isMobileViewport() {
  return window.innerWidth <= 900;
}

/* Wheel: at most one section per gesture (desktop only). */
window.addEventListener('wheel', (e) => {
  if (isMobileViewport()) return; // let the browser scroll natively
  if (isScrolling) { e.preventDefault(); return; } // an animation is actively driving the scroll

  const deltaY = e.deltaMode === 1 ? e.deltaY * 16 : (e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY);
  if (Math.abs(deltaY) < 2) { e.preventDefault(); return; } // ignore sub-pixel / phantom trackpad noise

  const dir = deltaY > 0 ? 1 : -1;

  if (shouldReleaseToNativeScroll(dir)) return; // let the browser scroll to/from the footer

  e.preventDefault();
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

/* Touch swipe: same one-gesture-one-section contract on desktop-sized
   touchscreens only, without hijacking scroll/tap inside elements that
   need their own touch behavior. On mobile viewports touchmove/touchend
   never call preventDefault or read layout, so touch scrolling stays
   native and cheap. */
const TOUCH_EXCLUDE_SELECTOR = 'input, select, textarea, button, a, .fin-table-wrap, .nav-links, #lb-overlay';
let touchStartX = 0, touchStartY = 0, touchActive = false, touchIntercepted = false;

window.addEventListener('touchstart', (e) => {
  if (isMobileViewport()) { touchActive = false; return; }
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
  const dyPartial = touchStartY - t.clientY;
  if (shouldReleaseToNativeScroll(dyPartial > 0 ? 1 : -1)) {
    touchActive = false; // hand this gesture to native scroll (footer area)
    return;
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
let lastActiveNavId = null;
function centerNavLinkHorizontally(link) {
  // Moves only the nav's own horizontal scroll position (scrollLeft) so the
  // active link stays visible — never touches the page's vertical scroll,
  // unlike Element.scrollIntoView(), which can nudge ancestor scroll
  // containers on both axes even with block:'nearest'.
  const container = link.closest('.nav-links');
  if (!container) return;
  const cRect = container.getBoundingClientRect();
  const lRect = link.getBoundingClientRect();
  const delta = (lRect.left + lRect.width / 2) - (cRect.left + cRect.width / 2);
  if (Math.abs(delta) < 1) return;
  container.scrollTo({ left: container.scrollLeft + delta, behavior: 'smooth' });
}

function updateActiveNav() {
  const idx = getCurrentSectionIdx();
  const activeId = SECTION_IDS[idx];
  currentSection = idx;
  if (activeId === lastActiveNavId) return; // nothing changed — skip DOM writes
  lastActiveNavId = activeId;

  let activeEl = null;
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').replace('#', '');
    const isActive = href === activeId;
    a.classList.toggle('active', isActive);
    if (isActive) activeEl = a;
  });
  const navCta = document.querySelector('.nav-cta');
  if (navCta) navCta.classList.toggle('active', activeId === 'contacto');
  if (activeEl && isMobileViewport()) {
    centerNavLinkHorizontally(activeEl);
  }
}

/* Throttled to one read/write pass per animation frame — scroll fires far
   more often than that, and getCurrentSectionIdx() reads layout
   (offsetTop) for every tracked section, which is wasted work (and a
   contributor to mobile jank) if run synchronously on every event. */
let navUpdateQueued = false;
window.addEventListener('scroll', () => {
  if (navUpdateQueued) return;
  navUpdateQueued = true;
  requestAnimationFrame(() => { navUpdateQueued = false; updateActiveNav(); });
}, { passive: true });
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

    var pmImg = document.querySelector('.plan-maestro-card img');
    var pmTrigger = document.querySelector('.plan-maestro-card');
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

    var maleconImgs = Array.from(document.querySelectorAll('.about-img-stack img')).map(function (img, i) {
      return { src: img.src, alt: img.alt || ('Nuevo Malecón ' + (i + 1)) };
    });
    document.querySelectorAll('.about-img-stack img').forEach(function (img, i) {
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

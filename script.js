
/* ── Tab switching ── */
function showModelo(idx) {
  document.querySelectorAll(".modelo-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach((b,i) => b.classList.toggle("active", i === idx));
  requestAnimationFrame(function() {
    var t = document.getElementById("modelo-" + idx);
    if (t) t.classList.add("active");
  });
}
function handleSubmit(e) {
  e.preventDefault();
  document.getElementById("form-msg").style.display = "block";
  e.target.reset();
}

/* ── Section scroll engine ── */
const SECTION_IDS = ['inicio','sobre','modelos','amenidades','galeria','ubicacion','contacto'];
const NAV_H = 78;
let isScrolling = false;
let currentSection = 0;
let touchStartY = 0;

function getSectionTops() {
  return SECTION_IDS.map((id, i) => {
    const el = document.getElementById(id);
    if (!el) return 0;
    if (i === 0) return 0;
    if (id === 'modelos') return el.offsetTop; // full viewport, HUD handles nav offset internally
    return el.offsetTop - NAV_H;
  });
}

function scrollToSection(idx, duration = 700) {
  if (idx < 0 || idx >= SECTION_IDS.length) return;
  const tops = getSectionTops();
  const target = tops[idx];
  const start = window.scrollY;
  const dist = target - start;
  if (Math.abs(dist) < 5) { isScrolling = false; return; }

  isScrolling = true;
  let startTime = null;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  }

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    window.scrollTo(0, start + dist * easeInOutCubic(progress));
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      isScrolling = false;
      currentSection = idx;
      updateActiveNav();
    }
  }
  requestAnimationFrame(step);
}

function getCurrentSectionIdx() {
  const tops = getSectionTops();
  const scrollPos = window.scrollY + NAV_H + 10;
  let idx = 0;
  for (let i = 0; i < tops.length; i++) {
    if (scrollPos >= tops[i]) idx = i;
  }
  return idx;
}

/* Wheel: go to next/prev section */
let wheelCooldown = false;
window.addEventListener('wheel', (e) => {
  if (isScrolling || wheelCooldown) { e.preventDefault(); return; }
  e.preventDefault();
  wheelCooldown = true;
  setTimeout(() => { wheelCooldown = false; }, 900);

  const idx = getCurrentSectionIdx();
  const next = e.deltaY > 0
    ? Math.min(idx + 1, SECTION_IDS.length - 1)
    : Math.max(idx - 1, 0);
  if (next !== idx) scrollToSection(next);
}, { passive: false });

/* Touch swipe */
window.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchend', (e) => {
  if (isScrolling) return;
  const dy = touchStartY - e.changedTouches[0].clientY;
  if (Math.abs(dy) < 40) return;
  const idx = getCurrentSectionIdx();
  if (dy > 0) {
    scrollToSection(Math.min(idx + 1, SECTION_IDS.length - 1));
  } else {
    scrollToSection(Math.max(idx - 1, 0));
  }
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

(function(){
  var IMGS=[]; var ALTS=[]; var cur=0;
  function init(){
    document.querySelectorAll('.gal-item img').forEach(function(img,i){
      IMGS.push(img.src); ALTS.push(img.alt||'Imagen '+(i+1));
    });
    var dots=document.getElementById('lb-dots');
    IMGS.forEach(function(_,i){
      var d=document.createElement('button');
      d.className='lb-dot'; d.onclick=function(){go(i);};
      dots.appendChild(d);
    });
    document.querySelectorAll('.gal-item').forEach(function(item,i){
      item.onclick=function(){open(i);};
    });
    document.getElementById('lb-close').onclick=close;
    document.getElementById('lb-prev').onclick=function(){go(cur-1);};
    document.getElementById('lb-next').onclick=function(){go(cur+1);};
    document.getElementById('lb-overlay').onclick=function(e){if(e.target.id==='lb-overlay')close();};
    document.addEventListener('keydown',function(e){
      if(!document.getElementById('lb-overlay').classList.contains('lb-open'))return;
      if(e.key==='ArrowRight')go(cur+1);
      if(e.key==='ArrowLeft')go(cur-1);
      if(e.key==='Escape')close();
    });
  }
  function open(i){
    cur=i;
    document.getElementById('lb-img').src=IMGS[cur];
    document.getElementById('lb-img').alt=ALTS[cur];
    document.getElementById('lb-overlay').classList.add('lb-open');
    document.body.style.overflow='hidden';
    ui();
  }
  function close(){
    document.getElementById('lb-overlay').classList.remove('lb-open');
    document.body.style.overflow='';
  }
  function go(n){
    n=(n+IMGS.length)%IMGS.length;
    if(n===cur)return;
    var img=document.getElementById('lb-img');
    img.classList.add('lb-fade');
    setTimeout(function(){
      cur=n; img.src=IMGS[cur]; img.alt=ALTS[cur];
      img.classList.remove('lb-fade'); ui();
    },240);
  }
  function ui(){
    document.getElementById('lb-counter').textContent=(cur+1)+' / '+IMGS.length;
    document.querySelectorAll('.lb-dot').forEach(function(d,i){d.classList.toggle('lb-on',i===cur);});
  }
  document.addEventListener('DOMContentLoaded',init);
})();

/* ── Mobile: remove modelos fixed height ── */
(function(){
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
(function(){
  var sectionIds = ['galeria','ubicacion','contacto'];
  function fixSections() {
    var isMobile = window.innerWidth <= 900;
    sectionIds.forEach(function(id) {
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
(function(){
  document.addEventListener('DOMContentLoaded', function() {
    var iframe   = document.getElementById('map-iframe');
    var fallback = document.getElementById('map-fallback');
    if (!iframe || !fallback) return;
    // iframe is always visible (z-index:2, display:block via CSS)
    // Only show fallback if iframe explicitly errors
    iframe.addEventListener('error', function() {
      fallback.classList.add('visible');
    });
  });
})();

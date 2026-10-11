/* Small, optional motion layer. No idle frame loop, scroll hijack, or hidden content. */
(() => {
  'use strict';
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducePreference = matchMedia('(prefers-reduced-motion: reduce)');
  const motionAllowed = () => document.body.dataset.motionPreference === 'full' || (document.body.dataset.motion !== 'reduced' && !reducePreference.matches);
  let frame = 0, surface = null, pendingPoint = null;
  const nav = document.querySelector('.sidebar nav');
  const marker = document.createElement('span');
  marker.className = 'nav-marker'; marker.setAttribute('aria-hidden','true');
  nav?.prepend(marker);
  let navFrame=0;
  function alignNavigation() {
    if(navFrame) cancelAnimationFrame(navFrame);
    navFrame=requestAnimationFrame(()=>{
      navFrame=0; const active=nav?.querySelector('.nav-item.active');
      if(!active || !active.offsetWidth)return;
      marker.style.width=active.offsetWidth+'px';marker.style.height=active.offsetHeight+'px';
      marker.style.transform=`translate(${active.offsetLeft}px,${active.offsetTop}px)`;
    });
  }
  if(nav && 'ResizeObserver' in window)new ResizeObserver(alignNavigation).observe(nav);
  document.addEventListener('aether:page',alignNavigation);
  alignNavigation();
  const resetDepth = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; pendingPoint = null;
    if (surface) { surface.style.removeProperty('--depth-x'); surface.style.removeProperty('--depth-y'); }
    surface = null;
  };
  document.addEventListener('pointermove', event => {
    if (!finePointer.matches || !motionAllowed() || document.hidden) return;
    const candidate = event.target.closest('[data-depth]');
    if (!candidate || candidate.closest('[hidden]')) { if (surface) resetDepth(); return; }
    if (surface !== candidate) { resetDepth(); surface = candidate; }
    pendingPoint = {x:event.clientX,y:event.clientY};
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!surface || !pendingPoint || !motionAllowed()) return;
      const rect = surface.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      surface.style.setProperty('--depth-x', `${((pendingPoint.x - rect.left) / rect.width - .5) * 12}px`);
      surface.style.setProperty('--depth-y', `${((pendingPoint.y - rect.top) / rect.height - .5) * 10}px`);
    });
  }, {passive:true});
  document.addEventListener('pointerleave', resetDepth);
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetDepth(); });
  window.addEventListener('blur', resetDepth);
  finePointer.addEventListener('change', resetDepth);
  reducePreference.addEventListener('change', resetDepth);
  // Content remains visible without JavaScript and before intersection delivery.
  const seen = new WeakSet();
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !entry.target.closest('.page.active')) continue;
      if (motionAllowed()) entry.target.classList.add('reveal-seen');
      seen.add(entry.target); observer.unobserve(entry.target);
    }
  }, {threshold:.08}) : null;
  function preparePage() {
    resetDepth();
    const page = document.querySelector('.page.active');
    if (!page) return;
    for (const art of page.querySelectorAll('.hero-art, .orbit-hero-art, .observatory-art')) {
      const parent = art.closest('.hero, .orbit-hero, .focus-observatory');
      if (parent) { parent.dataset.depth = ''; art.classList.add('depth-art'); }
    }
    if (observer) for (const section of page.querySelectorAll('.library-section, .local-tools-shelf, .discovery-strips, .focus-layout > section, .party-layout > section, .settings-grid > section')) if (!seen.has(section)) observer.observe(section);
  }
  document.addEventListener('aether:page', preparePage);
  document.addEventListener('aether:settings', () => { if (!motionAllowed()) resetDepth(); });
  window.addEventListener('pagehide', () => { resetDepth(); observer?.disconnect(); });
  window.addEventListener('pageshow', preparePage);
  preparePage();
})();

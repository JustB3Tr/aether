/* Event-driven motion. Content and interactions never wait for an animation. */
(() => {
  'use strict';
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducePreference = matchMedia('(prefers-reduced-motion: reduce)');
  const motionAllowed = () => document.body.dataset.motionPreference === 'full' || (document.body.dataset.motion !== 'reduced' && !reducePreference.matches);
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const running = new Map(), seen = new WeakSet(), observed = new Set();
  const order = ['home','games','apps','multiplayer','proxies','focus','profile','settings'];
  let frame = 0, navFrame = 0, revealFrame = 0, surface = null, pendingPoint = null;
  const nav = document.querySelector('.sidebar nav');
  const marker = document.createElement('span');
  marker.className = 'nav-marker'; marker.setAttribute('aria-hidden','true'); nav?.prepend(marker);

  function animate(el, keyframes, options = {}) {
    if (!el?.animate || !motionAllowed() || document.hidden || !el.getClientRects().length) return;
    running.get(el)?.cancel();
    const animation = el.animate(keyframes,{duration:380,easing:ease,fill:'backwards',...options});
    running.set(el,animation);
    const done = () => { if (running.get(el) === animation) running.delete(el); };
    animation.onfinish = done; animation.oncancel = done;
  }
  function stopMotion() {
    for (const animation of running.values()) animation.cancel();
    running.clear(); resetDepth();
  }
  function alignNavigation() {
    if(navFrame) cancelAnimationFrame(navFrame);
    navFrame=requestAnimationFrame(()=>{
      navFrame=0;
      const active=[...(nav?.querySelectorAll('.nav-item.active') || [])].find(el=>el.offsetWidth);
      if(!active) return;
      // Dimensions are set immediately. Only the marker's position interpolates.
      marker.style.width=active.offsetWidth+'px'; marker.style.height=active.offsetHeight+'px';
      marker.style.transform=`translate(${active.offsetLeft}px,${active.offsetTop}px)`;
    });
  }
  if(nav && 'ResizeObserver' in window) new ResizeObserver(alignNavigation).observe(nav);

  function resetDepth() {
    if(frame) cancelAnimationFrame(frame);
    frame=0; pendingPoint=null;
    if(surface) for(const name of ['--depth-x','--depth-y','--tilt-x','--tilt-y']) surface.style.removeProperty(name);
    surface=null;
  }
  document.addEventListener('pointermove',event=>{
    if(!finePointer.matches || !motionAllowed() || document.hidden) return;
    const candidate=event.target.closest('[data-depth]');
    if(!candidate || candidate.closest('[hidden]')) { if(surface) resetDepth(); return; }
    if(surface!==candidate) { resetDepth(); surface=candidate; }
    pendingPoint={x:event.clientX,y:event.clientY};
    if(frame) return;
    frame=requestAnimationFrame(()=>{
      frame=0; if(!surface || !pendingPoint || !motionAllowed()) return;
      const rect=surface.getBoundingClientRect(); if(!rect.width || !rect.height) return;
      const x=(pendingPoint.x-rect.left)/rect.width-.5, y=(pendingPoint.y-rect.top)/rect.height-.5;
      surface.style.setProperty('--depth-x',`${x*14}px`); surface.style.setProperty('--depth-y',`${y*12}px`);
      surface.style.setProperty('--tilt-x',`${-y*3}deg`); surface.style.setProperty('--tilt-y',`${x*4}deg`);
    });
  },{passive:true});
  document.addEventListener('pointerout',event=>{ if(surface && !surface.contains(event.relatedTarget)) resetDepth(); },{passive:true});
  document.addEventListener('pointerleave',resetDepth);
  window.addEventListener('blur',resetDepth);
  finePointer.addEventListener('change',resetDepth);

  function inViewport(el) {
    const rect=el.getBoundingClientRect();
    return rect.width>0 && rect.height>0 && rect.bottom>0 && rect.top<innerHeight && rect.right>0 && rect.left<innerWidth;
  }
  function reveal(el,delay=0) {
    if(seen.has(el)) return;
    seen.add(el); observer?.unobserve(el); observed.delete(el);
    animate(el,[{opacity:.25,translate:'0 20px',scale:'.985'},{opacity:1,translate:'0 0',scale:'1'}],{duration:420,delay});
  }
  const observer='IntersectionObserver' in window ? new IntersectionObserver(entries=>{
    let index=0;
    for(const entry of entries) if(entry.isIntersecting && entry.target.closest('.page.active')) reveal(entry.target,Math.min(index++,5)*32);
  },{threshold:.08}) : null;
  const revealSelector='.game-card, .local-tools-shelf>button, .quick-collections>button, .crossroad, .focus-layout>section, .party-layout>section, .settings-grid>section, .proxy-card';
  function prepareReveals() {
    revealFrame=0;
    // Renders replace cards. Release old observer references immediately.
    for(const el of observed) if(!el.isConnected) { observer?.unobserve(el); observed.delete(el); }
    const page=document.querySelector('.page.active'); if(!page) return;
    let index=0;
    for(const el of page.querySelectorAll(revealSelector)) {
      if(seen.has(el) || observed.has(el)) continue;
      if(inViewport(el)) reveal(el,Math.min(index++,5)*32);
      else if(observer) { observed.add(el); observer.observe(el); }
    }
  }
  function scheduleReveals() { if(!revealFrame) revealFrame=requestAnimationFrame(prepareReveals); }
  function preparePage(event) {
    resetDepth(); alignNavigation();
    const page=document.querySelector('.page.active'); if(!page) return;
    const detail=event?.detail || {}, direction=order.indexOf(detail.page)<order.indexOf(detail.previous) ? -1 : 1;
    if(detail.changed!==false) {
      for(const [el,animation] of running) if(el.closest('.page')) animation.cancel();
      animate(page,[{opacity:.45,translate:`${direction*14}px 7px`},{opacity:1,translate:'0 0'}],{duration:320});
      animate(document.querySelector('.topbar>div'),[{opacity:.45,translate:'0 5px'},{opacity:1,translate:'0 0'}],{duration:250});
      const intro=page.querySelector('.discovery-intro, .page-intro, .orbit-hero-copy');
      if(intro && inViewport(intro)) [...intro.querySelectorAll('h2,p,.discovery-kicker,.orbit-hero-actions')].slice(0,4).forEach((el,i)=>animate(el,[{opacity:.3,translate:'0 16px'},{opacity:1,translate:'0 0'}],{duration:420,delay:i*40}));
      const index=Math.max(0,order.indexOf(detail.page));
      document.body.style.setProperty('--ambient-x',`${index%3*1.5-1.5}%`);
      document.body.style.setProperty('--ambient-y',`${index%2*2-1}%`);
    }
    for(const art of page.querySelectorAll('.hero-art, .orbit-hero-art, .observatory-art, .apps-orbital-art')) {
      const parent=art.closest('.hero, .orbit-hero, .focus-observatory, .discovery-intro');
      if(parent) { parent.dataset.depth=''; art.classList.add('depth-art'); }
    }
    for(const card of page.querySelectorAll('.editorial-feature, .local-tools-shelf>button, .app-spotlight')) card.dataset.depth='';
    scheduleReveals();
  }
  document.addEventListener('aether:page',preparePage);
  document.addEventListener('aether:cards',scheduleReveals);
  document.addEventListener('aether:visibility',event=>{
    const {id,visible}=event.detail;
    if(id==='overlay' && visible) { stopMotion(); return; }
    if(!visible) return;
    if(id==='overlayRecovery') animate(document.getElementById(id),[{opacity:0,translate:'0 12px'},{opacity:1,translate:'0 0'}],{duration:260});
    if(id==='moreMenu') [...document.querySelectorAll('.more-destinations button')].forEach((el,i)=>animate(el,[{opacity:.25,translate:'0 12px'},{opacity:1,translate:'0 0'}],{duration:320,delay:i*35}));
  });
  // Keyboard activation gets the same brief tactile response as a pointer click.
  document.addEventListener('click',event=>{
    const button=event.target.closest('button'); if(!button || button.disabled || !button.isConnected) return;
    if(button.classList.contains('nav-item')) animate(button.querySelector('.icon'),[{scale:'.8'},{scale:'1.14',offset:.55},{scale:'1'}],{duration:320});
    else animate(button,[{scale:'.965'},{scale:'1'}],{duration:220});
  });
  function preferenceChanged() { if(!motionAllowed()) stopMotion(); }
  reducePreference.addEventListener('change',preferenceChanged);
  document.addEventListener('aether:settings',preferenceChanged);
  document.addEventListener('visibilitychange',()=>{
    document.body.classList.toggle('motion-suspended',document.hidden);
    if(document.hidden) stopMotion();
  });
  window.addEventListener('pagehide',()=>{stopMotion();observer?.disconnect();observed.clear();if(revealFrame)cancelAnimationFrame(revealFrame);revealFrame=0;});
  window.addEventListener('pageshow',preparePage);
  preparePage();
})();

/* Shared launch rules. A document response is never proof of gameplay. */
(() => {
  'use strict';
  const ROUTES = Object.freeze(['direct', 'uv', 'scramjet-libcurl', 'scramjet-epoxy', 'rammer']);
  let fallbackSequence = 0;
  function createLaunchId(provider = globalThis.crypto) {
    try {
      if (typeof provider?.randomUUID === 'function') return provider.randomUUID();
      if (typeof provider?.getRandomValues === 'function') return Array.from(provider.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
    } catch { /* Correlation tokens are not authentication credentials. */ }
    return `${Date.now().toString(36)}-${++fallbackSequence}-${Math.random().toString(36).slice(2)}`;
  }
  const routeId = (engine, transport) => engine === 'scramjet' ? `scramjet-${transport === 'epoxy' ? 'epoxy' : 'libcurl'}` : engine;
  const routeLabel = route => ({ local: 'Aether Original', direct: 'Direct site', uv: 'Ultraviolet', 'scramjet-libcurl': 'Scramjet · Libcurl', 'scramjet-epoxy': 'Scramjet · Epoxy', rammer: 'Rammerhead' }[route] || 'Browser route');
  const routeOptions = route => ({engine:route.startsWith('scramjet-') ? 'scramjet' : route, transport:route === 'scramjet-epoxy' ? 'epoxy' : 'libcurl'});
  function routesFor(item) {
    if (item?.local) return ['local'];
    return item?.frameBlocked ? ROUTES.filter(route => route !== 'direct') : [...ROUTES];
  }
  function validURL(value) {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try { return ['http:', 'https:'].includes(new URL(value, 'https://aether.invalid').protocol); } catch { return false; }
  }
  function validatePreferences(value) {
    const clean = Object.create(null);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return clean;
    Object.entries(value).filter(([id, entry]) => id.length > 0 && id.length <= 160 && entry && ROUTES.includes(entry.route) && validURL(entry.url) && Number.isFinite(entry.at) && entry.at >= 0)
      .sort((a,b) => b[1].at - a[1].at).slice(0,200)
      .forEach(([id, entry]) => { clean[id] = {route:entry.route,url:entry.url,at:entry.at}; });
    return clean;
  }
  function savedRoute(item, preferences) {
    const entry = item?.id && preferences?.[item.id];
    return entry && entry.url === item.url && routesFor(item).includes(entry.route) ? entry.route : null;
  }
  function chooseRoute(item, options = {}, transport = 'libcurl', preferences = {}) {
    if (item?.local) return 'local';
    if (options.engine) {
      const explicit = routeId(options.engine, options.transport || transport);
      return ROUTES.includes(explicit) ? explicit : 'uv';
    }
    return savedRoute(item, preferences) || (item?.launch === 'direct' && !item.frameBlocked ? 'direct' : 'uv');
  }
  function nextRoute(item, current) {
    const routes = routesFor(item);
    return routes[(routes.indexOf(current) + 1) % routes.length];
  }
  function diagnosis(message, isolated = false, loaded = false) {
    const text = String(message || '').slice(0,240);
    if (/https|secure context/i.test(text)) return 'This browser route needs HTTPS or localhost.';
    if (/transport|wisp|websocket|libcurl|epoxy/i.test(text)) return 'The connection layer did not start. Try another Scramjet connection or browser route.';
    if (/worker|activate|install/i.test(text)) return 'The browser worker did not start. Reload Aether, then retry this route.';
    if (/engine file|wasm|export|initialize/i.test(text)) return 'A browser engine asset failed to load. Retry or choose another route.';
    if (isolated && !loaded) return 'The proxy page did not respond. A first launch may need Access sign-in in a separate Aether tab.';
    return text || 'The site did not respond. Try a different route or its original website.';
  }
  function progress(session) {
    if (session?.confirmed) return {title:'You confirmed this works',detail:'This route is remembered on this browser for this catalog entry.',step:3};
    if (session?.issue) return {title:session.loaded ? 'Page received; launch needs attention' : 'Launch needs attention',detail:session.issue,step:session.loaded ? 2 : 1};
    if (session?.loaded) return {title:session.engine === 'local' ? 'Original loaded' : 'Page received',detail:session.engine === 'local' ? 'The local game has loaded.' : 'The page responded. Its game, editor, or multiplayer connection may still be starting.',step:2};
    if (session?.stage === 'engine-ready' || session?.stage === 'navigating') return {title:'Waiting for the site',detail:'The browser route started. Waiting for its first page response.',step:1};
    return {title:session?.engine === 'direct' ? 'Connecting to the creator' : 'Preparing the browser',detail:'Starting this launch. You can choose a different route below.',step:0};
  }
  function statusMatches(session, data) {
    return Boolean(session?.launchId && data?.launchId === session.launchId && data.type === 'aether-proxy-status');
  }
  globalThis.AetherLaunchHealth = Object.freeze({ROUTES,createLaunchId,routeId,routeLabel,routeOptions,routesFor,validatePreferences,savedRoute,chooseRoute,nextRoute,diagnosis,progress,statusMatches});
})();

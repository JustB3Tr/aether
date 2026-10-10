(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const config = window.AETHER_PROXY_CONFIG || {};
  const query = new URLSearchParams(location.search);
  const engine = query.get('engine');
  let target;
  try { target = new URL(query.get('url') || ''); } catch {}
  const frame = $('targetFrame');
  const launchId = query.get('launchId') || '';
  let navigationTimer, documentReceived = false;
  const report = (stage, message = '') => {
    if (parent !== window && config.appOrigin) parent.postMessage({ type: 'aether-proxy-status', launchId, stage, message }, config.appOrigin);
  };
  function navigating() {
    report('engine-ready');
    clearTimeout(navigationTimer);
    if (!documentReceived) navigationTimer = setTimeout(() => {
      if (!documentReceived) report('error', 'No page response yet. You can keep waiting or choose another route.');
    }, 30_000);
  }
  const show = (title, detail) => { $('statusTitle').textContent = title; $('statusDetail').textContent = detail; $('status').hidden = false; };
  const timeout = (promise, ms, message) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
  function loadScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let timer;
      const finish = error => {
        clearTimeout(timer);script.onload=null;script.onerror=null;
        if (error) {script.remove();reject(error);} else resolve();
      };
      script.src = `${path}?v=${encodeURIComponent(config.version || 'dev')}`;
      script.onload = () => finish();
      script.onerror = () => finish(new Error(`A browser engine file did not load: ${path}`));
      timer=setTimeout(()=>finish(new Error('A browser engine file took too long to load.')),18_000);
      document.head.append(script);
    });
  }
  async function worker(path, scope) {
    const registration = await navigator.serviceWorker.register(path, { scope });
    const current = registration.active || registration.installing || registration.waiting;
    if (!current) throw new Error('The browser engine did not install.');
    if (current.state === 'activated') return current;
    await timeout(new Promise((resolve, reject) => current.addEventListener('statechange', () => {
      if (current.state === 'activated') resolve();
      if (current.state === 'redundant') reject(new Error('The browser engine failed to activate.'));
    })), 18_000, 'The browser engine took too long to start.');
    return registration.active || current;
  }
  async function launchUV(url) {
    await loadScript('/uv/uv.bundle.js');
    await loadScript('/uv/uv.config.js');
    await loadScript('/baremux/index.js');
    const uv = window.__uv$config;
    if (!uv || !window.BareMux?.BareMuxConnection) throw new Error('Ultraviolet could not initialize.');
    const activeWorker = await worker(uv.sw, uv.prefix);
    const mux = new window.BareMux.BareMuxConnection('/baremux/worker.js');
    const wisp = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/wisp/`;
    await timeout(mux.setTransport('/epoxy/index.mjs', [{ wisp }]), 18_000, 'The proxy transport did not respond.');
    navigating();frame.src = `${uv.prefix}${uv.encodeUrl(url)}`;
    return activeWorker;
  }
  async function launchScramjet(url) {
    await loadScript('/scramjet/scramjet.js');
    await loadScript('/controller/controller.api.js');
    const api = window.$scramjetController;
    if (!api?.Controller) throw new Error('Scramjet could not initialize.');
    const activeWorker = await worker('/scramjet-sw.js', '/service-sj/');
    const version = encodeURIComponent(config.version || 'dev');
    Object.assign(api.config, { prefix: '/service-sj/', scramjetPath: `/scramjet/scramjet.js?v=${version}`, injectPath: `/controller/controller.inject.js?v=${version}`, wasmPath: `/scramjet/scramjet.wasm?v=${version}` });
    const transportChoice = query.get('transport') || 'libcurl';
    const wisp = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/wisp/`;
    let transport;
    if (transportChoice === 'epoxy') {
      const module = await timeout(import(`/epoxy-v3/index.mjs?v=${version}`), 18_000, 'The Epoxy 3 transport took too long to load.');
      if (typeof module.default !== 'function') throw new Error('The Epoxy 3 transport did not export its browser client.');
      transport = new module.default({ wisp });
    } else if (transportChoice === 'libcurl') {
      await loadScript('/libcurl/index.js');
      if (!window.LibcurlTransport?.LibcurlClient) throw new Error('The Libcurl transport could not initialize.');
      transport = new window.LibcurlTransport.LibcurlClient({ wisp });
    } else {
      throw new Error('Choose the Epoxy or Libcurl Scramjet transport.');
    }
    const controller = new api.Controller({ serviceworker: activeWorker, transport });
    await timeout(controller.wait(), 18_000, 'Scramjet took too long to start.');
    const proxyFrame = controller.createFrame(frame);
    navigating();proxyFrame.go(url);
  }
  async function launchRammerhead(url) {
    const response = await timeout(fetch('/newsession', { credentials: 'same-origin' }), 15_000, 'Rammerhead session creation timed out.');
    if (!response.ok) throw new Error(`Rammerhead session failed (${response.status}).`);
    const session = (await response.text()).trim();
    if (!/^[a-f0-9]{32}$/i.test(session)) throw new Error('Rammerhead returned an invalid session.');
    navigating();frame.src = `/${session}/${url}`;
  }
  frame.addEventListener('load', () => {
    let aboutBlank = false;
    try { aboutBlank = frame.contentWindow.location.href === 'about:blank'; }
    catch { /* A cross-origin document still completed a navigation. */ }
    if (aboutBlank) return;
    documentReceived = true;
    clearTimeout(navigationTimer);
    $('status').hidden = true;
    report('document-loaded');
  });
  (async () => {
    if (!target || !['http:', 'https:'].includes(target.protocol) || !['uv', 'scramjet', 'rammer'].includes(engine)) throw new Error('This browser session has an invalid destination or engine.');
    if (!window.isSecureContext || !navigator.serviceWorker) throw new Error('This browser route requires HTTPS.');
    document.title = `${target.hostname} | Aether Browser`;
    document.body.dataset.motion = query.get('motion') === 'reduced' ? 'reduced' : 'system';
    show('Preparing the browser', `Connecting to ${target.hostname}.`);
    report('preparing');
    if (engine === 'uv') await launchUV(target.href);
    else if (engine === 'scramjet') await launchScramjet(target.href);
    else await launchRammerhead(target.href);
  })().catch(error => {
    clearTimeout(navigationTimer);
    show('This launch needs another route', error.message || 'The browser engine could not start.');
    report('error', error.message || 'The browser engine could not start.');
  });
})();

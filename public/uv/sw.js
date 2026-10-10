importScripts('/uv/uv.bundle.js?v=5.4.1', '/uv/uv.config.js?v=5.4.1', '/uv/uv.sw.js?v=5.4.1');

const ultraviolet = new UVServiceWorker();
self.addEventListener('fetch', (event) => {
  if (ultraviolet.route(event)) event.respondWith(ultraviolet.fetch(event));
});

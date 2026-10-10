importScripts('/uv/uv.bundle.js?v=5.4.0', '/uv/uv.config.js?v=5.4.0', '/uv/uv.sw.js?v=5.4.0');

const ultraviolet = new UVServiceWorker();
self.addEventListener('fetch', (event) => {
  if (ultraviolet.route(event)) event.respondWith(ultraviolet.fetch(event));
});

importScripts('/uv/uv.bundle.js?v=5.5.0&build=55b', '/uv/uv.config.js?v=5.5.0&build=55b', '/uv/uv.sw.js?v=5.5.0&build=55b');

const ultraviolet = new UVServiceWorker();
self.addEventListener('fetch', (event) => {
  if (ultraviolet.route(event)) event.respondWith(ultraviolet.fetch(event));
});

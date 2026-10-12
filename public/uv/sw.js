importScripts('/uv/uv.bundle.js?v=5.5.2&build=552a', '/uv/uv.config.js?v=5.5.2&build=552a', '/uv/uv.sw.js?v=5.5.2&build=552a');

const ultraviolet = new UVServiceWorker();
self.addEventListener('fetch', (event) => {
  if (ultraviolet.route(event)) event.respondWith(ultraviolet.fetch(event));
});

importScripts('/uv/uv.bundle.js?v=5.5.1&build=551a', '/uv/uv.config.js?v=5.5.1&build=551a', '/uv/uv.sw.js?v=5.5.1&build=551a');

const ultraviolet = new UVServiceWorker();
self.addEventListener('fetch', (event) => {
  if (ultraviolet.route(event)) event.respondWith(ultraviolet.fetch(event));
});

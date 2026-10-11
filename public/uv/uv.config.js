const build = '5.4.2';
self.__uv$config = {
  prefix: '/service/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: `/uv/uv.handler.js?v=5.5.0&build=55b`,
  client: `/uv/uv.client.js?v=5.5.0&build=55b`,
  bundle: `/uv/uv.bundle.js?v=5.5.0&build=55b`,
  config: `/uv/uv.config.js?v=5.5.0&build=55b`,
  sw: `/uv/sw.js?v=5.5.0&build=55b`,
};

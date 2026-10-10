const build = '5.4.1';
self.__uv$config = {
  prefix: '/service/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: `/uv/uv.handler.js?v=${build}`,
  client: `/uv/uv.client.js?v=${build}`,
  bundle: `/uv/uv.bundle.js?v=${build}`,
  config: `/uv/uv.config.js?v=${build}`,
  sw: `/uv/sw.js?v=${build}`,
};

const build = '5.4.2';
self.__uv$config = {
  prefix: '/service/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: `/uv/uv.handler.js?v=5.5.1&build=551a`,
  client: `/uv/uv.client.js?v=5.5.1&build=551a`,
  bundle: `/uv/uv.bundle.js?v=5.5.1&build=551a`,
  config: `/uv/uv.config.js?v=5.5.1&build=551a`,
  sw: `/uv/sw.js?v=5.5.1&build=551a`,
};

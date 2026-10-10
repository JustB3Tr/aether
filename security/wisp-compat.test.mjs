import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {server,packet} from '@mercuryworkshop/wisp-js/server';
const require=createRequire(import.meta.url);
const root=dirname(dirname(require.resolve('@mercuryworkshop/wisp-js')));
const filter=await import(pathToFileURL(join(root,'src/server/filter.mjs')));
test('Wisp per-host limits handle its actual stream object and block excess streams',async()=>{
 const before={...server.options};
 try {
  Object.assign(server.options,{allow_direct_ip:true,allow_tcp_streams:true,allow_private_ips:false,allow_loopback_ips:false,port_whitelist:[80,443],stream_limit_total:64,stream_limit_per_host:2});
  const host='1.1.1.1',stream={socket:{hostname:host}},connection={streams:{1:stream}};
  assert.equal(await filter.is_stream_allowed(connection,packet.stream_types.TCP,host,443),0);
  connection.streams[2]=stream;
  assert.equal(await filter.is_stream_allowed(connection,packet.stream_types.TCP,host,443),packet.close_reasons.ConnThrottled);
 } finally {Object.assign(server.options,before);}
});

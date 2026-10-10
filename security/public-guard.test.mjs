import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PublicDestinations, publicAddress, TokenBuckets, installRammerheadGuard, rammerheadSessionPath } from './public-guard.js';
import { profileSessions } from './profile-session.js';

test('private, reserved, mapped and transition destinations are blocked',() => {
  for (const address of ['127.0.0.1','10.1.2.3','192.168.1.214','172.16.0.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','::1','fc00::1','fe80::1','ff02::1','::ffff:192.168.1.214','64:ff9b::c0a8:1d6','2002:c0a8:1d6::1','2001:db8::1','2001::1','3fff::1']) assert.equal(publicAddress(address),false,address);
  for (const address of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111']) assert.equal(publicAddress(address),true,address);
});
test('Rammerhead session routes include script, iframe, charset and window descriptors',() => {
  const id='a'.repeat(32);
  for (const path of [`/${id}/https://example.com/`,`/${id}!s!utf-8/https://example.com/app.js`,`/${id}!i/https://example.com/`,`/${id}*window1!a!1!s%2Aexample.com/https://example.com/`]) assert.equal(rammerheadSessionPath(path),true,path);
  for (const path of ['/api/user',`/${id}other/https://example.com/`,`/${id}!bad\\path/target`]) assert.equal(rammerheadSessionPath(path),false,path);
});
test('web URLs reject local names, credentials, nonweb ports and app origins',() => {
  const guard=new PublicDestinations({excludedHosts:['aether.example.com']});
  for (const url of ['http://127.1/','http://2130706433/','http://0x7f000001/','http://[::1]/','http://nas.local/','http://localhost./','https://aether.example.com/','https://name:secret@example.com/','ftp://example.com/','https://example.com:22/']) assert.throws(() => guard.url(url),{code:'EAETHER_DESTINATION_BLOCKED'},url);
  assert.equal(guard.url('wss://example.com/path').hostname,'example.com');
});
test('DNS fails closed for mixed public and private answers',async () => {
  const guard=new PublicDestinations({lookup:async () => [{address:'1.1.1.1',family:4},{address:'10.0.0.1',family:4}]});
  await assert.rejects(guard.validate('https://example.com/'),{code:'EAETHER_DESTINATION_BLOCKED'});
});
test('validated DNS is cached and connection lookup pins the checked address',async () => {
  let calls=0,clock=0;
  const guard=new PublicDestinations({now:() => clock,lookup:async () => {calls++;return [{address:calls === 1 ? '1.1.1.1' : '127.0.0.1',family:4}];}});
  const records=await guard.validate('https://example.com/');
  await guard.validate('https://example.com/');assert.equal(calls,1);
  clock=30_001;await assert.rejects(guard.validate('https://example.com/'));
  await new Promise((resolve,reject) => guard.callback(records)('example.com',{all:true},(error,result) => {if(error)return reject(error);assert.deepEqual(result,[{address:'1.1.1.1',family:4}]);resolve();}));
});
test('token buckets limit bursts, refill, and fail closed at key capacity',() => {
  let clock=0;const bucket=new TokenBuckets({capacity:2,perSecond:1,maxKeys:1,now:() => clock});
  assert.equal(bucket.take('a'),true);assert.equal(bucket.take('a'),true);assert.equal(bucket.take('a'),false);assert.equal(bucket.take('b'),false);
  clock=1000;assert.equal(bucket.take('a'),true);clock=4000;assert.equal(bucket.take('b'),true);
});
test('Rammerhead validates its actual connection and disables HTTP2 lookup bypass',async () => {
  class Destination extends EventEmitter {async _send(){this.sent=true;} _onError(error){this.error=error;}}
  installRammerheadGuard(Destination,new PublicDestinations({lookup:async () => [{address:'1.1.1.1',family:4}]}));
  const good=new Destination();good.opts={url:'https://example.com/',hostname:'example.com',port:443,isHttps:true,headers:{'Accept-Encoding':'gzip, br, zstd'}};await good._send();assert.equal(good.sent,true);assert.equal(good.opts.disableHttp2,true);assert.equal(typeof good.opts.lookup,'function');assert.equal(good.opts.headers['accept-encoding'],'gzip, deflate, br');assert.equal(good.opts.headers['Accept-Encoding'],undefined);
  for (const opts of [{url:'http://127.0.0.1/',hostname:'127.0.0.1',port:80},{url:'https://example.com/',hostname:'127.0.0.1',port:443},{url:'https://example.com/',hostname:'example.com',port:443,proxy:{host:'example.net'}}]) {
    const bad=new Destination();bad.opts=opts;await bad._send();assert.equal(bad.sent,undefined);assert.equal(bad.error.code,'EAETHER_DESTINATION_BLOCKED');
  }
});
test('profile sessions are signed, tamper resistant, and survive restart',() => {
  const directory=mkdtempSync(join(tmpdir(),'aether-session-'));
  try {
    const sessions=profileSessions(directory),uid='11111111-1111-4111-8111-111111111111';
    const signed=sessions.sign(uid);assert.equal(sessions.verify(signed),uid);assert.equal(profileSessions(directory).verify(signed),uid);
    assert.equal(sessions.verify(signed.replace(/^1/,'2')),null);assert.equal(sessions.verify(uid),null);assert.equal(sessions.verify(`${signed}.extra`),null);
  } finally {rmSync(directory,{recursive:true,force:true});}
});

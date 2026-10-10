import test from 'node:test';
import assert from 'node:assert/strict';
import '../launch-health.js';
const rules = globalThis.AetherLaunchHealth;
const game = {id:'test-game',url:'https://game.example/',launch:'proxy'};
test('launch correlation also works on insecure LAN HTTP without randomUUID', () => {
  assert.equal(rules.createLaunchId({getRandomValues:bytes=>bytes.fill(17)}),'11'.repeat(16));
  assert.notEqual(rules.createLaunchId({}),rules.createLaunchId({}));
});
test('document and focus never establish gameplay readiness', () => {
  assert.equal(rules.progress({loaded:true,engine:'uv',engaged:true}).title,'Page received');
  assert.equal(rules.progress({confirmed:true}).step,3);
  assert.match(rules.progress({loaded:true,engine:'uv'}).detail,/may still be starting/);
});
test('route defaults and explicit transport override saved preferences', () => {
  const saved = { [game.id]: {route:'scramjet-epoxy',url:game.url,at:1} };
  assert.equal(rules.chooseRoute(game,{},'libcurl',saved),'scramjet-epoxy');
  assert.equal(rules.chooseRoute(game,{engine:'scramjet',transport:'libcurl'},'epoxy',saved),'scramjet-libcurl');
  assert.equal(rules.chooseRoute({...game,local:true},{engine:'uv'}),'local');
  assert.equal(rules.chooseRoute({...game,launch:'direct'}),'direct');
  assert.equal(rules.chooseRoute({...game,launch:'rammer'}),'rammer');
  assert.equal(rules.chooseRoute({...game,launch:'rammer'},{engine:'uv'}),'uv');
});
test('changed catalog URLs and blocked frames cannot reuse stale routes', () => {
  const saved = {[game.id]:{route:'direct',url:game.url,at:1}};
  assert.equal(rules.savedRoute({...game,url:'https://new.example/'},saved),null);
  assert.equal(rules.savedRoute({...game,frameBlocked:true},saved),null);
  assert.equal(rules.chooseRoute({...game,launch:'direct',frameBlocked:true}),'uv');
});
test('route cycle includes both Scramjet transports and avoids blocked direct frames', () => {
  assert.equal(rules.nextRoute(game,'scramjet-libcurl'),'scramjet-epoxy');
  assert.equal(rules.nextRoute({...game,frameBlocked:true},'rammer'),'uv');
  assert.deepEqual(rules.routesFor({local:true}),['local']);
});
test('route storage is bounded and untrusted entries are sanitized', () => {
  const dirty = Object.fromEntries(Array.from({length:250},(_,i)=>['g'+i,{route:'uv',url:game.url,at:i,secret:'unused'}]));
  dirty.bad={route:'scramjet',url:game.url,at:1};dirty.script={route:'uv',url:'javascript:alert(1)',at:999};
  const clean=rules.validatePreferences(dirty);
  assert.equal(Object.keys(clean).length,200);assert.equal(clean.g0,undefined);assert.equal(clean.bad,undefined);assert.equal(clean.script,undefined);
  assert.deepEqual(Object.keys(clean.g249),['route','url','at']);
  assert.equal(Object.getPrototypeOf(clean),null);
});
test('stale viewer status is ignored across launches', () => {
  const session={launchId:'new-launch'};
  assert.equal(rules.statusMatches(session,{type:'aether-proxy-status',launchId:'old-launch',stage:'error'}),false);
  assert.equal(rules.statusMatches(session,{type:'aether-proxy-status',launchId:'new-launch',stage:'document-loaded'}),true);
  assert.equal(rules.statusMatches(session,{type:'gp-save',launchId:'new-launch'}),false);
});
test('diagnosis separates engine startup, transport, and proxy connection hints', () => {
  assert.match(rules.diagnosis('The Wisp transport did not respond'),/connection layer/);
  assert.match(rules.diagnosis('The browser worker failed'),/worker/);
  assert.match(rules.diagnosis('Timeout',true,false),/proxy hostname/);
  assert.doesNotMatch(rules.diagnosis('Timeout',true,true),/Access/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function fixture() {
  const nodes=new Map(),storage=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{id,dataset:{},hidden:true,textContent:'',value:'',children:[],classList:{toggle(){},add(){},remove(){}},replaceChildren(...children){this.children=children;},setAttribute(){},removeAttribute(){},getClientRects(){return[1];},contains(item){return item?.parentId===id;},focus(){context.document.activeElement=this;}});
    return nodes.get(id);
  };
  const frame=node('gameFrame');frame.contentWindow={location:{href:'http://localhost/arcade/index.html?game=snake'},postMessage(){}};
  const context={console,URL,URLSearchParams,Set,Map,Object,JSON,Promise,Number,String,Math,Date,Uint8Array,
    location:{origin:'http://localhost',pathname:'/',hash:'#games',search:''},performance:{now:()=>100},setTimeout:()=>1,clearTimeout(){},setInterval(){},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    document:{cookie:'',readyState:'loading',activeElement:null,body:{classList:{remove(){}}},getElementById:node,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},createElement:tag=>({...node('new'+Math.random()),tagName:tag.toUpperCase()})},
    window:{},navigator:{},matchMedia:()=>({matches:false,addEventListener(){}}),history:{},fetch:async()=>({ok:true,json:async()=>({})})};
  context.window=context;
  vm.runInNewContext(readFileSync(new URL('../launch-health.js',import.meta.url),'utf8'),context);
  let source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  source=source.replace(/\}\)\(\);\s*$/,`globalThis.harness={favorite,recordRecent,renderLaunchOptions,frameLoaded,gameMessage,hideLaunchOptions,shellURL,openStandaloneViewer,
    setSession(value){active=value;},setCatalog(value){byId=new Map(value.map(item=>[item.id,item]));},
    waiting(gate){profileGate=gate;profileHydrated=false;},hydrate(f,r){favorites=new Set(f);recents=r;profileHydrated=true;},
    stats(){return {favorites:[...favorites],recents};}};})();`);
  vm.runInNewContext(source,context);
  return{...context.harness,node,context};
}
test('favorite and history clicks during profile loading merge after hydration',async()=>{
  const f=fixture(),old={id:'old',url:'https://old.example/'},fresh={id:'new',url:'https://new.example/'};
  f.setCatalog([old,fresh]);let resolve;const gate=new Promise(done=>resolve=done);f.waiting(gate);
  f.favorite(fresh);f.recordRecent(fresh);
  assert.equal(f.stats().favorites.length,0);assert.equal(f.stats().recents.length,0);
  f.hydrate(['old'],[{id:'old',url:old.url,at:1}]);resolve();await gate;await Promise.resolve();
  assert.deepEqual([...f.stats().favorites].sort(),['new','old']);assert.deepEqual([...f.stats().recents].map(item=>item.id),['new','old']);
});
test('incoming launch stages preserve a pending route selection',()=>{
  const f=fixture(),session={serial:1,item:{id:'remote',url:'https://game.example/'},engine:'uv',transport:'libcurl',openedAt:0};
  f.setSession(session);f.renderLaunchOptions();f.node('launchRoute').value='scramjet-epoxy';
  session.stage='engine-ready';f.renderLaunchOptions();assert.equal(f.node('launchRoute').value,'scramjet-epoxy');
  f.setSession({...session,serial:2,engine:'rammer'});f.renderLaunchOptions();assert.equal(f.node('launchRoute').value,'rammer');
});
test('Poki recovery exposes a standalone isolated viewer after page receipt',()=>{
  const f=fixture();f.setSession({serial:1,item:{id:'moto-x3m',url:'https://poki.com/en/g/moto-x3m'},engine:'uv',transport:'libcurl',openedAt:0,isolatedProxy:true,loaded:true});f.renderLaunchOptions();
  assert.equal(f.node('proxyAuthTab').hidden,false);assert.equal(f.node('proxyAuthTab').textContent,'Open standalone proxy viewer');assert.match(f.node('launchNotes').textContent,/separate game loader/);
});
test('standalone viewer opens the same isolated URL and releases the old player',()=>{
  const f=fixture(),tab={opener:{}};let opened;
  f.context.open=(...args)=>{opened=args;return tab;};f.node('overlay').hidden=false;
  f.setSession({viewerUrl:'https://proxy.example/proxy-viewer?engine=rammer&url=https%3A%2F%2Fpoki.com',item:{local:false}});f.openStandaloneViewer();
  assert.equal(opened[0],'https://proxy.example/proxy-viewer?engine=rammer&url=https%3A%2F%2Fpoki.com');assert.equal(tab.opener,null);assert.equal(f.node('gameFrame').src,'about:blank');assert.equal(f.node('overlay').hidden,true);
});
test('blocked standalone popup keeps the current player available',()=>{
  const f=fixture();f.context.open=()=>null;f.node('overlay').hidden=false;f.setSession({viewerUrl:'https://proxy.example/proxy-viewer'});f.openStandaloneViewer();assert.equal(f.node('overlay').hidden,false);assert.match(f.node('toast').textContent,/blocked/);
});
test('closing launch options restores toolbar focus',()=>{
  const f=fixture();f.context.document.activeElement={parentId:'overlayRecovery'};f.hideLaunchOptions();assert.equal(f.context.document.activeElement,f.node('overlayRoute'));
});
test('explicit local ready and local error survive a later iframe load event',()=>{
  const f=fixture(),session={serial:1,item:{id:'aether-snake',local:true,url:'/arcade/index.html?game=snake'},url:'/arcade/index.html?game=snake',engine:'local',started:true,launchId:'current',openedAt:0,gameReady:true};
  f.setSession(session);f.frameLoaded();assert.equal(f.node('saveStatus').textContent,'Aether Original ready');
  session.gameError='The local game code did not load. Retry this Original.';f.frameLoaded();assert.equal(f.node('overlayRecovery').hidden,false);assert.match(f.node('launchStatusDetail').textContent,/local game code/);
});
test('catalog and ad hoc direct routes serialize in new Aether tabs',()=>{
  const f=fixture(),item={id:'remote',url:'https://game.example/'};f.setCatalog([item]);
  assert.equal(new URL(f.shellURL(item,'direct',item.url)).searchParams.get('aether_proxy'),'direct');
  const url=new URL(f.shellURL(null,'direct',item.url));assert.equal(url.searchParams.get('aether_url'),item.url);assert.equal(url.searchParams.get('aether_proxy'),'direct');
});
test('late local packets from an earlier launch are ignored',async()=>{
  const f=fixture(),session={serial:1,item:{local:true,url:'/arcade/index.html?game=snake'},engine:'local',launchId:'current'};f.setSession(session);
  await f.gameMessage({source:f.node('gameFrame').contentWindow,origin:'http://localhost',data:{type:'aether-arcade-error',launchId:'old'}});
  assert.equal(session.gameError,undefined);
});

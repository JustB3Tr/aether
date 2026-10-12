import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../proxy-viewer.js',import.meta.url),'utf8');

function fixture({loadOnGo=true,scriptLoads=true,engine='scramjet',target='https://example.com/',savedSession=null,sessionExists=true}={}) {
  const messages=[], timers=new Map(), handlers=new Map(), scripts=[],requests=[];
  const storage=new Map(savedSession?[['aether.rh.poki.session.v1',JSON.stringify(savedSession)]]:[]);
  let timerId=0, currentHref='about:blank';
  const frame={contentWindow:{location:{get href(){return currentHref;}}},addEventListener:(name,callback)=>handlers.set(name,callback)};
  const receive=()=>{currentHref='/service-sj/target';handlers.get('load')();};
  Object.defineProperty(frame,'src',{set(value){if(loadOnGo){currentHref=value;handlers.get('load')();}}});
  const nodes={targetFrame:frame,status:{hidden:false},statusTitle:{},statusDetail:{}};
  const api={config:{},Controller:class{wait(){return Promise.resolve();}createFrame(){return{go:()=>{if(loadOnGo)receive();}};}}};
  const context={URL,URLSearchParams,Promise,Error,console,Date,Number,JSON,location:{search:`?engine=${engine}&url=${encodeURIComponent(target)}&launchId=current&transport=libcurl`,protocol:'http:',host:'localhost'},
    sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    parent:{postMessage:(data,origin)=>messages.push({data,origin})},navigator:{serviceWorker:{register:async()=>({active:{state:'activated'}})}},
    fetch:async path=>{requests.push(path);return{ok:true,text:async()=>path.startsWith('/sessionexists')?(sessionExists?'exists':'not found'):'a'.repeat(32)};},
    document:{getElementById:id=>nodes[id],body:{dataset:{}},createElement:()=>{const node={remove(){this.removed=true;}};scripts.push(node);return node;},head:{append(script){if(scriptLoads)queueMicrotask(()=>script.onload?.());}}},
  };
  context.window=context;context.isSecureContext=true;context.AETHER_PROXY_CONFIG={appOrigin:'https://app.example',version:'5.4.2'};
  context.$scramjetController=api;context.LibcurlTransport={LibcurlClient:class{}};
  context.__uv$config={sw:'/sw.js',prefix:'/service/',encodeUrl:value=>encodeURIComponent(value)};
  context.BareMux={BareMuxConnection:class{setTransport(){return Promise.resolve();}}};
  vm.runInNewContext(source,context);
  return{messages,timers,scripts,nodes,requests,storage,receive,blank:()=>handlers.get('load')(),flush:()=>new Promise(resolve=>setImmediate(resolve)),tick(ms){for(const[id,timer]of[...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}}};
}
test('page arriving immediately during Scramjet launch leaves no false timeout',async()=>{
  const f=fixture();await f.flush();
  assert.equal(f.nodes.status.hidden,true);assert.equal(f.timers.size,0);
  assert.deepEqual(f.messages.map(item=>item.data.stage),['preparing','engine-ready','document-loaded']);
  assert.ok(f.messages.every(item=>item.data.launchId==='current'&&item.origin==='https://app.example'));
});
test('blank iframe does not report a document; real delayed document clears timer',async()=>{
  const f=fixture({loadOnGo:false});await f.flush();f.blank();
  assert.equal(f.messages.some(item=>item.data.stage==='document-loaded'),false);
  assert.equal([...f.timers.values()].filter(item=>item.ms===30000).length,1);
  f.receive();assert.equal(f.timers.size,0);assert.equal(f.nodes.status.hidden,true);
});
test('waiting reports one recoverable error and a later response still reports arrival',async()=>{
  const f=fixture({loadOnGo:false});await f.flush();f.tick(30000);f.receive();
  assert.equal(f.messages.filter(item=>item.data.stage==='error').length,1);
  assert.equal(f.messages.at(-1).data.stage,'document-loaded');
});
test('engine asset timeout removes the failed script and reports the launch token',async()=>{
  const f=fixture({scriptLoads:false});await f.flush();f.tick(18000);await f.flush();
  assert.equal(f.scripts[0].removed,true);assert.equal(f.scripts[0].onload,null);
  assert.match(f.messages.at(-1).data.message,/file took too long/);
  assert.equal(f.messages.at(-1).data.launchId,'current');
});
test('Ultraviolet and Rammerhead also cancel navigation timeouts on page arrival',async()=>{
  for(const engine of ['uv','rammer']){const f=fixture({engine});await f.flush();assert.equal(f.timers.size,0);assert.equal(f.messages.at(-1).data.stage,'document-loaded');}
});
test('Poki Rammerhead reload validates and reuses its tab-local session',async()=>{
  const f=fixture({engine:'rammer',target:'https://poki.com/en/g/moto-x3m',savedSession:{id:'b'.repeat(32),at:Date.now()}});await f.flush();
  assert.deepEqual(f.requests,['/sessionexists?id='+'b'.repeat(32)]);assert.equal(f.messages.at(-1).data.stage,'document-loaded');
});
test('missing or expired Poki sessions get a fresh valid session',async()=>{
  for(const expired of [false,true]){
    const f=fixture({engine:'rammer',target:'https://poki.com/en/g/moto-x3m',sessionExists:false,savedSession:{id:'b'.repeat(32),at:Date.now()-(expired?3600001:0)}});await f.flush();
    assert.equal(f.requests.at(-1),'/newsession');assert.equal(JSON.parse(f.storage.get('aether.rh.poki.session.v1')).id,'a'.repeat(32));
  }
});
test('another provider does not reuse a Poki session',async()=>{
  const f=fixture({engine:'rammer',savedSession:{id:'b'.repeat(32),at:Date.now()}});await f.flush();assert.deepEqual(f.requests,['/newsession']);
});
test('malformed and future-dated Poki cache entries cannot select a session',async()=>{
  for(const savedSession of [{id:['b'.repeat(32)],at:Date.now()},{id:'bad',at:Date.now()},{id:'b'.repeat(32),at:Date.now()+100000}]){
    const f=fixture({engine:'rammer',target:'https://poki.com/en/g/moto-x3m',savedSession});await f.flush();assert.deepEqual(f.requests,['/newsession']);
  }
});

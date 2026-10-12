import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context={URL};
vm.runInNewContext(readFileSync(new URL('../blank-launch.js',import.meta.url),'utf8'),context);
const launch=context.AetherBlankLaunch.openAetherBlank;
function fixture(){
  const nodes=[],opened=[];
  const doc={head:{append(...items){nodes.push(...items);}},body:{replaceChildren(...items){nodes.push(...items);}},createElement(tag){return{tag,attrs:{},setAttribute(k,v){this.attrs[k]=v;}};}};
  const tab={document:doc,opener:{},close(){this.closed=true;}};
  return{nodes,opened,tab,env:{location:{origin:'https://app.example'},open(...args){opened.push(args);return tab;}}};
}
test('blank shell opens this instance, retains the page and detaches its opener',()=>{
  const f=fixture();assert.equal(launch('https://app.example/#settings',f.env).ok,true);
  assert.deepEqual(f.opened,[['about:blank','_blank']]);assert.equal(f.tab.opener,null);
  const frame=f.nodes.find(n=>n.tag==='iframe');assert.equal(frame.src,'https://app.example/#settings');assert.match(frame.attrs.allow,/cross-origin-isolated/);
  assert.equal(frame.attrs.sandbox.includes('allow-top-navigation'),false);
});
test('external, credential-bearing and script destinations never open a tab',()=>{
  for(const target of ['javascript:alert(1)','https://evil.example/','https://user:secret@app.example/']){const f=fixture();assert.equal(launch(target,f.env).ok,false);assert.equal(f.opened.length,0);}
});
test('blocked popup returns a useful recovery message',()=>{
  const result=launch('https://app.example/',{location:{origin:'https://app.example'},open:()=>null});assert.equal(result.ok,false);assert.match(result.error,/blocked/);
});
test('failed blank document setup closes only the newly opened tab',()=>{
  const f=fixture();f.tab.document=null;assert.equal(launch('https://app.example/',f.env).ok,false);assert.equal(f.tab.closed,true);
});

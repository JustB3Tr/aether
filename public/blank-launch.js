/* A blank address bar is a display preference, not a privacy boundary. */
(() => {
  'use strict';
  function openAetherBlank(url = location.href, env = window) {
    let target;
    try { target = new URL(url, env.location.origin); } catch { return {ok:false,error:'Invalid Aether address.'}; }
    if (!['http:','https:'].includes(target.protocol) || target.origin !== env.location.origin || target.username || target.password) return {ok:false,error:'Only this Aether instance can open in a blank tab.'};
    const tab = env.open('about:blank','_blank');
    if (!tab) return {ok:false,error:'Your browser blocked the blank tab. Allow popups for Aether.'};
    try {
      const doc = tab.document;
      doc.title = 'Aether';
      const style = doc.createElement('style');
      style.textContent = 'html,body{margin:0;width:100%;height:100%;background:#101316;overflow:hidden}iframe{display:block;width:100%;height:100%;border:0}';
      const icon = doc.createElement('link');icon.rel='icon';icon.href=new URL('/assets/favicon.png',target).href;
      doc.head.append(style,icon);
      const frame = doc.createElement('iframe');
      frame.title = 'Aether';
      frame.setAttribute('allow','fullscreen; autoplay; clipboard-read; clipboard-write; gamepad; cross-origin-isolated');
      frame.setAttribute('allowfullscreen','');
      frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock');
      frame.src = target.href;
      doc.body.replaceChildren(frame);
      tab.opener = null;
      return {ok:true};
    } catch {
      try { tab.close(); } catch {}
      return {ok:false,error:'The blank tab could not attach Aether. Try a normal Aether tab.'};
    }
  }
  globalThis.AetherBlankLaunch = Object.freeze({openAetherBlank});
})();

/* Aether 5.4.1: isolated browser routes, visible recovery, and explicit save acknowledgements. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const $$ = selector => [...document.querySelectorAll(selector)];
const AETHER_CONFIG = window.AETHER_CONFIG || {};
const launchHealth = window.AetherLaunchHealth;
const isolatedProxyOrigin = AETHER_CONFIG.proxyOrigin && AETHER_CONFIG.appOrigin && AETHER_CONFIG.proxyOrigin !== AETHER_CONFIG.appOrigin ? AETHER_CONFIG.proxyOrigin : '';
const engineAsset = path => `${path}?v=${encodeURIComponent(AETHER_CONFIG.version || 'dev')}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const put = (id, text) => { if ($(id)) $(id).textContent = text; };
const visible = (id, yes) => { if ($(id)) $(id).hidden = !yes; };
const on = (id, type, fn) => $(id)?.addEventListener(type, fn);
const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const readText = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const writeLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const decode = value => { let text = String(value ?? ''); for (let i = 0; i < 2; i++) { try { const next = decodeURIComponent(text); if (next === text) break; text = next; } catch { break; } } return text; };
const jsonValue = (value, fallback) => { if (typeof value === 'string') { try { return JSON.parse(value); } catch { return value; } } return value ?? fallback; };
const delay = (fn, ms = 140) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; };
const timeout = (promise, ms, message) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(message)), ms); Promise.resolve(promise).then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); }); });
async function api(path, method = 'GET', body, ms = 15000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(path, { method, credentials: 'same-origin', signal: controller.signal, headers: {'X-Aether-Request':'1',...(body === undefined ? {} : {'Content-Type':'application/json'})}, body: body === undefined ? undefined : JSON.stringify(body) });
    let result; try { result = await response.json(); } catch { throw new Error(`Unexpected response (${response.status})`); }
    if (!response.ok || result?.ok === false) throw new Error(result?.error || result?.message || `Request failed (${response.status})`);
    return result;
  } catch (error) { if (error.name === 'AbortError') throw new Error('The server took too long to respond. Try again.'); throw error; }
  finally { clearTimeout(timer); }
}
let toastTimer;
function toast(message) { put('toast', message); $('toast')?.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast')?.classList.remove('show'), 4500); }
const PAGE_META = {home:['Home','Find your next favorite.'],games:['Games','Small worlds. Big possibilities.'],apps:['Apps','Your useful corner of the web.'],focus:['Focus','Make room for one good thing.'],multiplayer:['Party','A room for your people.'],proxies:['Browser','The web, through Aether.'],profile:['Profile','Your progress travels with you.'],settings:['Settings','Make Aether feel like you.']};
const defaults = {scramjetTransport:'libcurl',motion:'system',density:'comfortable',newTab:false,focusDefault:false,timerLen:25,confirmLeave:true};
const legacySettings = readLocal('aether_settings',{});
let settings = {...defaults,...legacySettings,newTab:Boolean(legacySettings.newTab ?? legacySettings.aboutBlank),...readLocal('aether_v5_settings',{})};
let games = [], apps = [], items = [], byId = new Map(), canonical = new Map();
function cookieProfileUUID() { const value = (document.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('gp_uid='))?.slice(7) || readLocal('aether_v5_active_profile',''); return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ? value : ''; }
let user = {uuid:cookieProfileUUID(),saves:{}}, favorites = new Set(), recents = [], notes = '', todos = [], profileReady = false;
let currentPage = '', active = null, launchSerial = 0, frameTimer, overlayInvoker, paletteInvoker;
let profileGate = Promise.resolve();
let profileHydrated = false;
const routePreferenceKey = 'aether_v54_routes';
let routePreferences = launchHealth.validatePreferences(readLocal(routePreferenceKey,{}));
let focusMode = false, profileRevealed = false;
const library = {query:'',category:'all',favorites:false,availability:'all',sort:'recommended',limit:48};
const appFilter = {query:'',category:'all',favorites:false};
const metadataTimers = new Map(), metadataPending = new Set();
const profileKey = () => `aether_v5_profile_${user.uuid || 'offline'}`;
const pendingKey = () => `${profileKey()}_pending`;
function pendingMetadata(key = pendingKey()) { const value = readLocal(key,{}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function rememberPending(name,value) { const pending = pendingMetadata(); pending[name] = value; return writeLocal(pendingKey(),pending); }
function acknowledgeMetadata(key,name,value) { const pending = pendingMetadata(key); if (JSON.stringify(pending[name]) !== JSON.stringify(value)) return false; delete pending[name]; writeLocal(key,pending); return true; }
function adoptOfflineMetadata() {
  const key = 'aether_v5_profile_offline_pending', offline = pendingMetadata(key), pending = pendingMetadata();
  for (const name of ['favorites','recents','focus_notes','todos','settings']) if (Object.hasOwn(offline,name) && !Object.hasOwn(pending,name)) pending[name] = offline[name];
  if (Object.keys(offline).length && writeLocal(pendingKey(),pending)) writeLocal(key,{});
}
function canonicalURL(value) { try { const url = new URL(decode(value), location.origin); url.hash = ''; return url.href.replace(/\/$/, ''); } catch { return decode(value); } }
function resolveItem(value) { return byId.get(String(value)) || canonical.get(String(value)) || canonical.get(decode(value)) || canonical.get(canonicalURL(value)); }
function normalizeItem(raw, kind, index) {
  if (!raw || typeof raw.name !== 'string' || typeof raw.url !== 'string') return null;
  try {
    const target = new URL(raw.url, location.origin);
    if (!['http:','https:'].includes(target.protocol)) return null;
    const local = raw.launch === 'local' && target.origin === location.origin && target.pathname.startsWith('/arcade/');
    const id = String(raw.id || `${kind}-${index}-${raw.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`);
    const item = {...raw,id,kind,local,launch:local ? 'local' : launchHealth.ROUTES.includes(raw.launch) ? raw.launch : 'proxy',category:raw.category || raw.cat || 'Other',description:raw.description || '',tags:Array.isArray(raw.tags) ? raw.tags.map(String) : []};
    item.search = `${item.name} ${item.category} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
    return item;
  } catch { return null; }
}
function indexCatalog(data) {
  games = (Array.isArray(data) ? data : data.games || []).map((g,i) => normalizeItem(g,'game',i)).filter(Boolean);
  apps = (data.apps || []).map((a,i) => normalizeItem(a,'app',i)).filter(Boolean);
  items = [...games,...apps]; byId = new Map(); canonical = new Map();
  for (const item of items) { byId.set(item.id,item); for (const key of [item.id,item.url,item.previousUrl].filter(Boolean)) { canonical.set(key,item); canonical.set(decode(key),item); canonical.set(canonicalURL(key),item); } }
  put('navGameCount', games.length); put('statGames', games.length); put('statLocal', games.filter(g => g.local).length); put('statApps',apps.length); put('gamesTotal',games.length);
}
function metadata(name, fallback) { return jsonValue(user.saves?.[`__meta__:${name}`], fallback); }
function scopedCache() { return {favorites:[...favorites],recents,notes,todos,settings}; }
function cacheProfile() { if (user.uuid) writeLocal('aether_v5_active_profile',user.uuid);writeLocal(profileKey(),scopedCache()); }
function hydrateProfile() {
  const cache = readLocal(profileKey(),{});
  const pending = pendingMetadata();
  const legacyOwner = readLocal('aether_v5_legacy_owner',null);
  const canUseLegacy = !legacyOwner || legacyOwner === user.uuid;
  const favoriteList = pending.favorites ?? metadata('favorites', cache.favorites || (canUseLegacy ? readLocal('aether_favorites',[]) : []));
  favorites = new Set((Array.isArray(favoriteList) ? favoriteList : []).filter(value => typeof value === 'string' && value.length <= 2048).map(value => resolveItem(value)?.id || decode(value)));
  const recentList = pending.recents ?? metadata('recents',cache.recents || (canUseLegacy ? readLocal('aether_recents',[]) : []));
  const seen = new Set(); recents = (Array.isArray(recentList) ? recentList : []).map(entry => { const item = resolveItem(typeof entry === 'string' ? entry : entry.id || entry.url); if (!item || seen.has(item.id)) return null; seen.add(item.id); return {id:item.id,url:item.url,at:Number(entry.at) || Date.now(),score:Number.isFinite(entry.score) ? entry.score : undefined}; }).filter(Boolean).slice(0,30);
  const savedNotes = user.saves?.['__meta__:focus_notes'];
  notes = String(pending.focus_notes ?? (typeof savedNotes === 'string' ? savedNotes : cache.notes ?? (canUseLegacy ? readText('aether_focus_notes') : ''))).slice(0,8000);
  const savedTodos = pending.todos ?? metadata('todos',cache.todos || (canUseLegacy ? readLocal('aether_todos',[]) : [])); todos = (Array.isArray(savedTodos) ? savedTodos : []).filter(t => t && typeof t.text === 'string').map(t => ({id:String(t.id || `${Date.now()}-${Math.random()}`),text:t.text.slice(0,180),done:Boolean(t.done)})).slice(0,100);
  const savedSettings = pending.settings ?? metadata('settings',cache.settings || {});
  settings = {...defaults,...settings,...savedSettings,newTab:savedSettings.newTab ?? (savedSettings.aboutBlank === undefined ? settings.newTab : Boolean(savedSettings.aboutBlank))}; validateSettings(); applySettings();
  writeLocal('aether_v5_legacy_owner',user.uuid); cacheProfile();
  if ($('focusNotes')) $('focusNotes').value = notes;
  profileRevealed = false; renderFocus(); renderProfile(); refreshActivePage();
  put('notesStatus', profileReady && Object.hasOwn(user.saves,'__meta__:focus_notes') ? 'Saved' : 'Saved on this device');
  if (profileReady) {
    for (const [name,value] of Object.entries(pending)) if (['favorites','recents','focus_notes','todos','settings'].includes(name)) saveMetadata(name,value,0);
    if (JSON.stringify(favoriteList) !== JSON.stringify([...favorites]) || (!Object.hasOwn(user.saves,'__meta__:favorites') && favorites.size)) saveMetadata('favorites',[...favorites]);
    if (!Object.hasOwn(user.saves,'__meta__:recents') && recents.length) saveMetadata('recents',recents);
    if (!Object.hasOwn(user.saves,'__meta__:focus_notes') && notes) saveMetadata('focus_notes',notes);
    if (!Object.hasOwn(user.saves,'__meta__:todos') && todos.length) saveMetadata('todos',todos);
  }
}
function saveMetadata(name,value,wait = 450) {
  value = JSON.parse(JSON.stringify(value));
  cacheProfile(); clearTimeout(metadataTimers.get(name));
  const localSaved = rememberPending(name,value), key = pendingKey(), uid = user.uuid;
  if (name === 'focus_notes') put('notesStatus','Saving...');
  const id = setTimeout(() => { metadataTimers.delete(name); if (user.uuid !== uid) return;
    const promise = api('/api/save','POST',{key:`__meta__:${name}`,value}).then(() => { const latest = acknowledgeMetadata(key,name,value); if (user.uuid !== uid || !latest) return; user.saves[`__meta__:${name}`] = value; if (name === 'focus_notes') put('notesStatus','Saved'); }).catch(error => { if (user.uuid !== uid) return; if (name === 'focus_notes') put('notesStatus',localSaved ? 'Saved on this device' : 'Save failed'); toast(`${localSaved ? 'Saved on this device.' : 'Your browser could not keep a local copy.'} Server save failed: ${error.message}`); }).finally(() => metadataPending.delete(promise));
    metadataPending.add(promise);
  },wait); metadataTimers.set(name,id);
}
async function flushMetadata() {
  for (const timer of metadataTimers.values()) clearTimeout(timer); metadataTimers.clear();
  if (metadataPending.size) await Promise.allSettled([...metadataPending]);
  if (!user.uuid) return;
  const saves = {'__meta__:favorites':[...favorites],'__meta__:recents':recents,'__meta__:focus_notes':notes,'__meta__:todos':todos,'__meta__:settings':settings};
  const key = pendingKey(); await api('/api/save-batch','POST',{saves}); Object.assign(user.saves,saves); for (const [name,value] of Object.entries(saves)) acknowledgeMetadata(key,name.slice('__meta__:'.length),value);
}
function favorite(item) { if (!item) return;if(!profileHydrated){toast('Your profile is loading. This favorite is queued.');void profileGate.then(()=>favorite(item));return;} favorites.has(item.id) ? favorites.delete(item.id) : favorites.add(item.id); saveMetadata('favorites',[...favorites]); refreshActivePage(); toast(favorites.has(item.id) ? 'Added to favorites' : 'Removed from favorites'); }
function recordRecent(item,score) { if (!item?.id || !byId.has(item.id)) return;if(!profileHydrated){void profileGate.then(()=>recordRecent(item,score));return;} const previous = recents.find(r => r.id === item.id); recents = [{id:item.id,url:item.url,at:Date.now(),score:Number.isFinite(score) ? score : previous?.score},...recents.filter(r => r.id !== item.id)].slice(0,30); saveMetadata('recents',recents); }
function artwork(item) { if (!item.logo) return ''; try { const url = new URL(item.logo,location.origin); return url.origin === location.origin ? url.pathname + url.search : `/api/artwork?url=${encodeURIComponent(url.href)}`; } catch { return ''; } }
function accessLabel(item) { return /portal/i.test(item.access || '') ? 'Game portal' : /room|host/i.test(item.access || '') ? 'Room code' : /account|paid/i.test(item.access || '') ? 'Account / plan' : item.local ? 'Ready here' : item.launch === 'direct' ? 'Direct play' : 'Through proxy'; }
function card(item,index = 0) {
  const title = esc(item.name), selected = favorites.has(item.id), src = artwork(item), initials = item.name.split(/\s+/).slice(0,2).map(w => w[0] || '').join('');
  let hue = 0; for (const char of item.category) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return `<article class="game-card" style="--card-hue:${hue};--i:${Math.min(index,12)}"><div class="card-cover"><span class="card-fallback" aria-hidden="true">${esc(initials)}</span>${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" width="400" height="400">` : ''}<button class="card-play" data-launch="${esc(item.id)}" aria-label="Play ${title}"><span class="play-indicator">${icon('play')}</span></button><span class="card-badge ${item.local ? 'local-badge' : ''}">${item.local ? 'Aether Original' : esc(item.category)}</span><button class="favorite-btn ${selected ? 'is-favorite' : ''}" data-favorite="${esc(item.id)}" aria-label="${selected ? 'Remove' : 'Add'} ${title} ${selected ? 'from' : 'to'} favorites" aria-pressed="${selected}">${icon('star')}</button></div><div class="card-body"><button class="card-title" data-launch="${esc(item.id)}" aria-label="Play ${title}">${title}</button><div class="card-meta"><span>${esc(item.category)}</span><span title="${esc(item.launchNotes || '')}">${esc(accessLabel(item))}</span></div></div></article>`;
}
function renderCards(id,list,append = false) { const el = $(id); if (!el) return; const html = list.map(card).join(''); if (append) el.insertAdjacentHTML('beforeend',html); else el.innerHTML = html; }
function renderHome() {
  renderCards('originalsGrid',games.filter(g => g.local).slice(0,6)); renderCards('featuredGrid',[...games.filter(g => !g.local && g.featured),...games.filter(g => !g.local && !g.featured)].slice(0,6));
  const recentItems = recents.map(r => byId.get(r.id)).filter(Boolean); visible('recentSection',recentItems.length > 0); renderCards('recentGrid',recentItems.slice(0,6));
  const favoriteItems = items.filter(i => favorites.has(i.id)); visible('favoriteSection',favoriteItems.length > 0); renderCards('favoriteGrid',favoriteItems.slice(0,6));
}
function chips(id,source,selected) { const categories = [...new Set(source.map(i => i.category))].sort((a,b) => a.localeCompare(b)); if ($(id)) $(id).innerHTML = ['all',...categories].map(category => `<button type="button" class="chip ${category === selected ? 'active' : ''}" data-category="${esc(category)}" data-collection="${id === 'gameChips' ? 'games' : 'apps'}" aria-pressed="${category === selected}">${category === 'all' ? 'All' : esc(category)}</button>`).join(''); }
function filteredGames() {
  const query = library.query.toLowerCase(); const result = games.filter(g => (!query || g.search.includes(query)) && (library.category === 'all' || g.category === library.category) && (!library.favorites || favorites.has(g.id)) && (library.availability !== 'local' || g.local));
  if (library.sort === 'name') result.sort((a,b) => a.name.localeCompare(b.name));
  else if (library.sort === 'recent') { const order = new Map(recents.map((r,i) => [r.id,i])); result.sort((a,b) => (order.get(a.id) ?? 100000) - (order.get(b.id) ?? 100000) || a.name.localeCompare(b.name)); }
  else result.sort((a,b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(b.local) - Number(a.local));
  return result;
}
function renderGames(append = false) {
  const result = filteredGames(), start = append ? Math.max(0,library.limit - 48) : 0; renderCards('gamesGrid',result.slice(start,library.limit),append); chips('gameChips',games,library.category);
  put('gamesResultCount',`${result.length} ${result.length === 1 ? 'entry' : 'entries'}`); put('gamesLoadedCount',`Showing ${Math.min(library.limit,result.length)} of ${result.length}`);
  visible('gamesLoadMore',result.length > library.limit); visible('gamesEmpty',result.length === 0); visible('resetGameFilters',Boolean(library.query || library.category !== 'all' || library.favorites || library.availability !== 'all' || library.sort !== 'recommended'));
  $('gamesFavorites')?.setAttribute('aria-pressed',String(library.favorites)); $('gamesFavorites')?.classList.toggle('active',library.favorites);
}
function resetGames() { Object.assign(library,{query:'',category:'all',favorites:false,availability:'all',sort:'recommended',limit:48}); if ($('gameSearch')) $('gameSearch').value = ''; if ($('gameAvailability')) $('gameAvailability').value = 'all'; if ($('gameSort')) $('gameSort').value = 'recommended'; renderGames(); }
function renderApps() { const result = apps.filter(a => (!appFilter.query || a.search.includes(appFilter.query.toLowerCase())) && (appFilter.category === 'all' || a.category === appFilter.category) && (!appFilter.favorites || favorites.has(a.id))); renderCards('appsGrid',result); chips('appChips',apps,appFilter.category); put('appsResultCount',`${result.length} apps`); visible('appsEmpty',!result.length); $('appsFavorites')?.setAttribute('aria-pressed',String(appFilter.favorites)); $('appsFavorites')?.classList.toggle('active',appFilter.favorites); }
function refreshActivePage() { if (currentPage === 'home') renderHome(); else if (currentPage === 'games') renderGames(); else if (currentPage === 'apps') renderApps(); else if (currentPage === 'focus') renderFocus(); else if (currentPage === 'profile') renderProfile(); }
function go(page,updateHash = true) {
  if (!PAGE_META[page]) page = 'home'; const changed = currentPage !== page; currentPage = page;
  focusMode = page === 'focus'; document.body.classList.toggle('focus-mode',focusMode);
  document.body.dataset.page = page;
  $$('.page').forEach(el => el.classList.toggle('active',el.id === `page-${page}`)); $$('.nav-item').forEach(el => { const chosen = el.dataset.page === page; el.classList.toggle('active',chosen); if (chosen) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
  put('pageTitle',PAGE_META[page][0]); put('pageSubtitle',PAGE_META[page][1]); $('focusToggle')?.setAttribute('aria-label',focusMode ? 'Exit Focus' : 'Open Focus'); $('focusToggle')?.setAttribute('aria-pressed',String(focusMode)); if (updateHash && location.hash !== `#${page}`) history.pushState(null,'',`#${page}`);
  refreshActivePage(); if (page === 'multiplayer') refreshRooms(); if (page === 'settings') renderSettings();
  if (changed) window.scrollTo({top:0,left:0,behavior:'instant'});
  if (typeof document.dispatchEvent === 'function' && typeof CustomEvent === 'function') document.dispatchEvent(new CustomEvent('aether:page',{detail:{page,changed}}));
}
function syncInert() { const app = document.querySelector('.app'); if (app) app.inert = Boolean(!$('overlay')?.hidden || !$('palette')?.hidden); }
function trapFocus(event) { if (event.key !== 'Tab') return; const modal = !$('palette')?.hidden ? $('palette') : !$('overlay')?.hidden ? $('overlay') : null; if (!modal) return; const buttons = [...modal.querySelectorAll('button,a[href],input,textarea,select,iframe,[tabindex="0"]')].filter(el => !el.hidden && !el.disabled && el.getClientRects().length); if (!buttons.length) return; const first = buttons[0], last = buttons[buttons.length - 1]; if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
function normalizeTarget(raw) { const value = String(raw).trim(); if (!value) throw new Error('Enter a website or search first.'); if (/^https?:\/\//i.test(value)) return new URL(value).href; if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[^\s/:]+:\d+(\/|$)/.test(value)) throw new Error('Use an HTTP or HTTPS website.'); if (/^(localhost|[a-z0-9-]+(?:\.[a-z0-9-]+)+)(:\d+)?([/?#].*)?$/i.test(value)) return new URL(`https://${value}`).href; return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`; }
function shellURL(item,engine,url,transport = settings.scramjetTransport) { const target = new URL(location.pathname,location.origin); if (item?.id && byId.has(item.id)) { target.searchParams.set('aether_game',item.id); if (['direct','uv','scramjet','rammer'].includes(engine)) target.searchParams.set('aether_proxy',engine); } else { target.searchParams.set('aether_proxy',engine || 'uv'); target.searchParams.set('aether_url',url); } if (engine === 'scramjet') target.searchParams.set('aether_transport',transport === 'epoxy' ? 'epoxy' : 'libcurl'); target.hash = item?.kind === 'app' ? 'apps' : item?.id ? 'games' : 'proxies'; return target.href; }
function openShell(item,engine,url,transport = settings.scramjetTransport) { const tab = window.open(shellURL(item,engine,url,transport),'_blank'); if (!tab) { toast('Your browser blocked the new tab. Allow popups for Aether.'); return false; } try { tab.opener = null; } catch {} return true; }
function proxyViewerURL(engine,url,transport = settings.scramjetTransport,launchId = '') { const viewer = new URL('/proxy-viewer',isolatedProxyOrigin); viewer.searchParams.set('engine',engine); viewer.searchParams.set('url',url); viewer.searchParams.set('launchId',launchId);viewer.searchParams.set('motion',document.body.dataset.motion==='reduced'?'reduced':'system'); if (engine === 'scramjet') viewer.searchParams.set('transport',transport === 'epoxy' ? 'epoxy' : 'libcurl'); return viewer.href; }
function closeOverlay(force = false) {
  if (!$('overlay') || $('overlay').hidden) return;
  launchSerial++; clearTimeout(frameTimer); active?.recoveryCleanup?.(); active = null; $('gameFrame').src = 'about:blank'; $('gameFrame').removeAttribute('credentialless'); visible('overlay',false); visible('overlayRecovery',false); document.body.classList.remove('overlay-open'); syncInert(); overlayInvoker?.focus?.();
}
function loading(message,detail,recovery = false) { visible('frameLoading',true); put('loadingTitle',message); put('loadingDetail',detail); visible('overlayRecovery',recovery); visible('proxyAuthTab',false); }
function renderLaunchOptions() {
  if (!active) return;
  const route = launchHealth.routeId(active.engine,active.transport), info = launchHealth.progress(active);
  put('launchStatusTitle',info.title); put('launchStatusDetail',info.detail);
  put('launchTiming',active.loadedAt ? `First page: ${((active.loadedAt-active.openedAt)/1000).toFixed(1)}s` : 'Waiting for a page response');
  for (const node of $$('#launchSteps li')) node.classList.toggle('complete',Number(node.dataset.step)<=info.step);
  const picker = $('launchRoute');
  if (picker && picker.dataset.launchSerial!==String(active.serial)) { picker.replaceChildren(...launchHealth.routesFor(active.item).map(value => { const option=document.createElement('option');option.value=value;option.textContent=launchHealth.routeLabel(value);return option; })); picker.value=route;picker.dataset.launchSerial=String(active.serial); }
  visible('launchRouteForm',!active.item.local);visible('tryOtherEngine',!active.item.local);
  const canRemember = !active.item.local && byId.has(active.item.id) && active.loaded;
  visible('rememberRoute',canRemember); if ($('rememberRoute')) $('rememberRoute').disabled=Boolean(active.confirmed);
  put('rememberRoute',active.confirmed ? 'Route remembered' : 'This works · remember route');
  visible('forgetRoute',Boolean(launchHealth.savedRoute(active.item,routePreferences)));
  visible('proxyAuthTab',Boolean(AETHER_CONFIG.accessEnabled && active.isolatedProxy && !active.loaded));
  visible('launchNotes',Boolean(active.item.launchNotes || active.item.frameBlocked));
  put('launchNotes',active.item.frameBlocked ? 'This creator blocks direct embedding. Its original website is also available from the toolbar.' : active.item.launchNotes || '');
}
function showLaunchOptions() {
  if (!active || active.item.local) return;
  renderLaunchOptions();visible('overlayRecovery',true);$('overlayRoute')?.setAttribute('aria-expanded','true');$('launchRoute')?.focus();
}
function hideLaunchOptions() { const restore=$('overlayRecovery')?.contains(document.activeElement);visible('overlayRecovery',false);$('overlayRoute')?.setAttribute('aria-expanded','false');if(restore)$('overlayRoute')?.focus(); }
function startNavigation(serial) {
  if (active?.serial !== serial) return;
  active.stage='navigating';clearTimeout(frameTimer);
  if (!active.loaded) frameTimer=setTimeout(() => { if (active?.serial===serial && !active.loaded) launchError(new Error('No page response yet. You can keep waiting or choose another route.'),serial); },30000);
  renderLaunchOptions();
}
function launchError(error,serial) {
  if (active?.serial !== serial) return; clearTimeout(frameTimer);
  active.issue=launchHealth.diagnosis(error.message,active.isolatedProxy,active.loaded);active.confirmed=false;
  if (!active.loaded) loading('This launch needs attention',active.issue,true);
  renderLaunchOptions();visible('overlayRecovery',true);$('overlayRoute')?.setAttribute('aria-expanded','true');
  put('saveStatus',active.loaded ? 'Page received' : 'No page response');
}
const scripts = new Map(), scramjetTransports = new Map(); let uvPromise, scramjetPromise, scramjetController, scramjetFrame;
function loadScript(src) { if (scripts.has(src)) return scripts.get(src); const promise = new Promise((resolve,reject) => { const script=document.createElement('script');let timer; const finish=(error)=>{clearTimeout(timer);script.onload=null;script.onerror=null;if(error){script.remove();reject(error);}else resolve();};script.src=src;script.onload=()=>finish();script.onerror=()=>finish(new Error('A browser engine file could not load.'));timer=setTimeout(()=>finish(new Error('A browser engine file took too long to load.')),18000);document.head.appendChild(script); }).catch(error => { scripts.delete(src); throw error; }); scripts.set(src,promise); return promise; }
async function activatedWorker(path,scope) { const registration = await navigator.serviceWorker.register(path,{scope}); const worker = registration.active || registration.installing || registration.waiting; if (!worker) throw new Error('The browser engine did not install.'); if (worker.state === 'activated') return worker; await timeout(new Promise((resolve,reject) => { worker.addEventListener('statechange',() => { if (worker.state === 'activated') resolve(); if (worker.state === 'redundant') reject(new Error('The browser engine failed to activate.')); }); }),18000,'The browser engine took too long to start.'); return registration.active || worker; }
function secureProxy() { if (!window.isSecureContext || !navigator.serviceWorker) throw new Error('This proxy needs HTTPS or localhost. Aether Originals and direct games work here; open your HTTPS Aether address for proxies.'); }
function originalStorage(item) { if (!item?.local) return null; const game = new URL(item.url,location.origin).searchParams.get('game'); return {key:`aether.arcade.${game}`,owner:`aether_v5_arcade_owner_${game}`,cache:`aether_v5_arcade_${user.uuid || 'offline'}_${game}`,game}; }
function prepareOriginal(item) {
  const storage = originalStorage(item); if (!storage) return;
  const currentOwner = user.uuid || 'offline', previousOwner = readLocal(storage.owner,null);
  if (previousOwner && previousOwner !== currentOwner) {
    const previous = readLocal(storage.key,null); if (previous) writeLocal(`aether_v5_arcade_${previousOwner}_${storage.game}`,previous);
    const fallback = readLocal(storage.cache,null), cloud = jsonValue(user.saves[storage.key],null), next = fallback || cloud;
    if (next) writeLocal(storage.key,next); else { try { localStorage.removeItem(storage.key); } catch {} }
  } else if (!previousOwner && readLocal(storage.key,null) === null) {
    const cloud = jsonValue(user.saves[storage.key],null); if (cloud) writeLocal(storage.key,cloud);
  }
  // First adoption keeps standalone progress. Later profile switches isolate each game.
  writeLocal(storage.owner,currentOwner);
}
function clearOriginalCache(item) { const storage = originalStorage(item); if (!storage) return; try { localStorage.removeItem(storage.cache); if (readLocal(storage.owner,null) === (user.uuid || 'offline')) localStorage.removeItem(storage.key); } catch {} }
function ensureUV() { if (!uvPromise) uvPromise = (async () => { secureProxy(); await loadScript(engineAsset('/uv/uv.bundle.js')); await loadScript(engineAsset('/uv/uv.config.js')); await loadScript(engineAsset('/baremux/index.js')); if (!window.__uv$config || !window.BareMux?.BareMuxConnection) throw new Error('Ultraviolet could not initialize.'); const config = window.__uv$config; await activatedWorker(config.sw,config.prefix); const connection = new window.BareMux.BareMuxConnection(engineAsset('/baremux/worker.js')); await timeout(connection.setTransport(engineAsset('/epoxy/index.mjs'),[{wisp:`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/wisp/`}]),18000,'The proxy transport did not respond.'); return config; })().catch(error => { uvPromise = null; throw error; }); return uvPromise; }
async function getScramjetTransport(name) {
  if (!scramjetTransports.has(name)) {
    const ready = (async () => {
      const wisp = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/wisp/`;
      if (name === 'epoxy') {
        const { default: EpoxyTransport } = await timeout(import(engineAsset('/epoxy-v3/index.mjs')),18000,'The Epoxy transport took too long to load.');
        return new EpoxyTransport({wisp});
      }
      await loadScript(engineAsset('/libcurl/index.js'));
      if (!window.LibcurlTransport?.LibcurlClient) throw new Error('Libcurl could not initialize.');
      return new window.LibcurlTransport.LibcurlClient({wisp});
    })().catch(error => { scramjetTransports.delete(name); throw error; });
    scramjetTransports.set(name,ready);
  }
  return scramjetTransports.get(name);
}
async function ensureScramjet(name = 'libcurl', serial = active?.serial) {
  if (!scramjetPromise) scramjetPromise = (async () => {
    secureProxy();
    await loadScript(engineAsset('/scramjet/scramjet.js'));
    await loadScript(engineAsset('/controller/controller.api.js'));
    const worker = await activatedWorker('/scramjet-sw.js','/service-sj/');
    const api = window.$scramjetController;
    if (!api?.Controller) throw new Error('Scramjet could not initialize.');
    Object.assign(api.config,{prefix:'/service-sj/',scramjetPath:engineAsset('/scramjet/scramjet.js'),injectPath:engineAsset('/controller/controller.inject.js'),wasmPath:engineAsset('/scramjet/scramjet.wasm')});
    const transport = await getScramjetTransport(name);
    scramjetController = new api.Controller({serviceworker:worker,transport});
    await timeout(scramjetController.wait(),18000,'Scramjet took too long to start.');
    scramjetFrame = scramjetController.createFrame($('gameFrame'));
  })().catch(error => { scramjetPromise = null; throw error; });
  await scramjetPromise;
  const transport = await getScramjetTransport(name);
  if (active?.serial !== serial) return null;
  scramjetController.setTransport(transport);
  return scramjetFrame;
}
async function launch(item,options = {}) {
  const url = item?.url || options.url; if (!url) return;
  const route = launchHealth.chooseRoute(item,options,settings.scramjetTransport,routePreferences);
  const {engine,transport} = launchHealth.routeOptions(route);
  if (!options.same && (options.newTab ?? settings.newTab)) { if (openShell(item,engine,url,transport)) recordRecent(item); return; }
  closePalette(); overlayInvoker = document.activeElement; const serial = ++launchSerial; clearTimeout(frameTimer); active?.recoveryCleanup?.();
  active = {serial,launchId:launchHealth.createLaunchId(),openedAt:performance.now(),item:item || {name:'Web session',url},engine,transport,url,loaded:false,started:false,stage:'preparing',isolatedProxy:Boolean(isolatedProxyOrigin && ['uv','scramjet','rammer'].includes(engine))};
  if ($('overlay')) $('overlay').dataset.engine = engine;
  put('overlayEngine',launchHealth.routeLabel(route));
  visible('overlay',true); syncInert(); document.body.classList.add('overlay-open'); put('overlayTitle',item?.name || ({uv:'Ultraviolet',scramjet:'Scramjet',rammer:'Rammerhead'}[engine] || 'Web session')); put('overlayUrl',url); put('saveStatus',item?.local ? 'Aether save ready' : item?.kind === 'app' ? 'Export work from the app' : 'Site saves depend on the game');
  if ($('overlayLogo')) { $('overlayLogo').hidden = false; $('overlayLogo').src = item?.logo ? artwork(item) : '/assets/aether-mark.webp'; $('overlayLogo').alt = ''; }
  const originalLink = $('overlayOriginal'); if (originalLink) { const originalURL = new URL(url,location.origin); originalLink.hidden = engine === 'local'; originalLink.href = ['http:','https:'].includes(originalURL.protocol) ? originalURL.href : '#'; originalLink.setAttribute('aria-label',`Open ${item?.name || 'this site'} on its original website in a new tab`); }
  visible('overlayRoute',engine !== 'local');
  $('overlayRoute')?.setAttribute('aria-expanded','false');
  const frame = $('gameFrame'); frame.src = 'about:blank'; frame.removeAttribute('credentialless'); loading(`Opening ${item?.name || 'your site'}`,engine === 'local' ? 'Ready here. No proxy needed.' : engine === 'direct' ? 'Connecting to the original creator.' : 'Starting the browser engine.'); $('overlayBack')?.focus();
  renderLaunchOptions();
  recordRecent(item);
  if (item?.frameBlocked) toast('This editor blocks direct embedding. Use Original site for its normal editor, or try the proxy here.');
  if (item?.launchNotes && ((engine === 'direct' && /Recommended direct/i.test(item.launchNotes)) || /portal|room|host|account|paid/i.test(item.access || ''))) toast(item.launchNotes);
  try {
    if (active.isolatedProxy) {
      active.started = true;
      active.viewerUrl = proxyViewerURL(engine,url,transport,active.launchId);
      frame.src = active.viewerUrl;
      // The separate proxy host must respond before its own status arrives.
      frameTimer=setTimeout(()=>{if(active?.serial===serial&&!active.loaded)launchError(new Error('The browser page did not respond. Check the proxy hostname connection, then retry.'),serial);},65000);
      return;
    }
    if (engine === 'local') { await profileGate;if (active?.serial !== serial) return; prepareOriginal(item); active.started = true; startNavigation(serial);const localURL=new URL(url,location.origin);localURL.searchParams.set('launchId',active.launchId);frame.src = localURL.href; }
    else if (engine === 'direct') { if (window.crossOriginIsolated && !('credentialless' in frame)) throw new Error('Your browser needs a proxy for this game. Use Try another engine.'); frame.setAttribute('credentialless',''); active.started = true; frame.src = url; }
    else if (engine === 'uv') { const config = await ensureUV(); if (active?.serial !== serial) return; active.started = true; frame.src = `${config.prefix}${config.encodeUrl(url)}`; }
    else if (engine === 'scramjet') { const proxyFrame = await ensureScramjet(transport,serial); if (active?.serial !== serial) return; active.started = true; proxyFrame.go(url); }
    else if (engine === 'rammer') { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(),15000); let response; try { response = await fetch('/newsession',{signal:controller.signal}); } finally { clearTimeout(timer); } if (!response.ok) throw new Error(`Rammerhead session failed (${response.status})`); const session = (await response.text()).trim(); if (!/^[a-f0-9]{32}$/i.test(session)) throw new Error('Rammerhead returned an invalid session.'); if (active?.serial !== serial) return; if (!('credentialless' in frame)) throw new Error('Rammerhead needs a browser with credentialless frame support.'); frame.setAttribute('credentialless',''); active.started = true; frame.src = `/${session}/${url}`; }
    else throw new Error('Unknown browser engine.');
    if (engine !== 'local') startNavigation(serial);
  } catch (error) { launchError(error,serial); }
}
function frameLoaded() {
  if (!active?.started || active.isolatedProxy) return; try { if ($('gameFrame').contentWindow.location.href === 'about:blank') return; } catch {}
  clearTimeout(frameTimer); active.loaded = true; active.loadedAt=performance.now();active.stage = 'document-loaded'; visible('frameLoading',false);
  if(active.gameError){launchError(new Error(active.gameError),active.serial);return;}
  active.issue=null;hideLaunchOptions(); put('saveStatus',active.engine === 'local' ? active.gameReady ? 'Aether Original ready' : 'Loading game code' : 'Page received'); sendGameInit();renderLaunchOptions();
  // A document load is not a game-ready signal. Keep route controls available
  // without guessing readiness from a timer or cross-origin input events.
}
function sendGameInit() {
  if (!active?.item?.local || active.engine !== 'local') return;
  const saves = {};
  const key = `aether.arcade.${new URL(active.url,location.origin).searchParams.get('game')}`; if (Object.hasOwn(user.saves,key)) saves[key] = user.saves[key];
  $('gameFrame').contentWindow?.postMessage({type:'gp-init',launchId:active.launchId,saves,settings:{motion:settings.motion}},location.origin);
}
function allowedGameKey(key,session) { if (typeof key !== 'string' || key.length > 512 || key.startsWith('__meta__:') || !session.item.local || session.engine !== 'local') return false; return key === `aether.arcade.${new URL(session.url,location.origin).searchParams.get('game')}`; }
async function gameMessage(event) {
  const session = active; if (!session || event.source !== $('gameFrame').contentWindow || !event.data || typeof event.data !== 'object') return;
  const data = event.data;
  if (session.isolatedProxy) {
    if (event.origin !== isolatedProxyOrigin || !launchHealth.statusMatches(session,data)) return;
    if (data.stage === 'preparing' || data.stage === 'engine-ready') { if(active.loaded)return;active.stage = data.stage;put('saveStatus',data.stage === 'engine-ready' ? 'Waiting for site' : 'Preparing');if(data.stage==='engine-ready')startNavigation(session.serial);renderLaunchOptions();return; }
    if (data.stage === 'document-loaded') {
      clearTimeout(frameTimer); active.loaded = true;active.loadedAt??=performance.now();active.issue=null;active.stage = data.stage; visible('frameLoading',false); hideLaunchOptions(); put('saveStatus','Page received');renderLaunchOptions();
      return;
    }
    if (data.stage === 'error') { launchError(new Error(typeof data.message === 'string' ? data.message.slice(0,240) : 'The browser route needs another try.'),session.serial); return; }
    return;
  }
  if (event.origin !== location.origin || (session.item.local && data.launchId!==session.launchId)) return;
  const profileAtRequest = user.uuid;
  if (data.type === 'gp-ready') { sendGameInit(); return; }
  if (data.type === 'aether-arcade-ready' && session.item.local) {active.gameReady=true;put('saveStatus','Aether Original ready');return;}
  if (data.type === 'aether-arcade-error' && session.item.local) {active.gameError='The local game code did not load. Retry this Original.';launchError(new Error(active.gameError),session.serial);return;}
  if (data.type === 'aether-arcade-exit' && session.item.local) { closeOverlay(true); go('games'); return; }
  if (data.type === 'aether-arcade-result' && session.item.local) { const gameId = new URL(session.url,location.origin).searchParams.get('game'); if (data.game === gameId && Number.isFinite(data.score) && data.score >= 0) { recordRecent(session.item,data.score); put('saveStatus',`Score: ${data.score}`); } return; }
  if (!['gp-save','gp-delete','gp-save-batch'].includes(data.type)) return;
  const ack = {type:data.type === 'gp-delete' ? 'gp-delete-result' : 'gp-save-result',requestId:data.requestId};
  try {
    const saves = data.type === 'gp-save-batch' ? data.saves : {[data.key]:data.type === 'gp-delete' ? null : data.value};
    if (!saves || typeof saves !== 'object' || Array.isArray(saves) || Object.keys(saves).length > 100 || Object.keys(saves).some(key => !allowedGameKey(key,session)) || JSON.stringify(saves).length > 128000) throw new Error('This game requested an invalid save.');
    if (session.item.local) { const storage = originalStorage(session.item); const localValue = saves[storage.key]; if (localValue === null || localValue === undefined) { try { localStorage.removeItem(storage.cache); } catch {} } else writeLocal(storage.cache,localValue); }
    put('saveStatus','Saving...');
    const writes = {};
    for (const [key,value] of Object.entries(saves)) { if (value === null || value === undefined) await api(`/api/save/${encodeURIComponent(key)}`,'DELETE'); else writes[key] = value; }
    if (Object.keys(writes).length) await api('/api/save-batch','POST',{saves:writes});
    if (user.uuid !== profileAtRequest) return;
    for (const [key,value] of Object.entries(saves)) { if (value === null || value === undefined) delete user.saves[key]; else user.saves[key] = value; }
    if (active?.serial === session.serial) { put('saveStatus','Saved'); event.source.postMessage({...ack,ok:true},event.origin); }
  } catch (error) { if (active?.serial === session.serial) { put('saveStatus','Save failed'); event.source.postMessage({...ack,ok:false,error:error.message},event.origin); toast(`Game save failed: ${error.message}`); } }
}

/* The timer uses an end timestamp so sleeping/background tabs do not lose time. */
let timer = readLocal('aether_v5_timer',null) || {mode:'focus',running:false,total:settings.timerLen * 60,remaining:settings.timerLen * 60,endAt:0};
if (!['focus','break'].includes(timer.mode) || !Number.isFinite(timer.total) || timer.total < 1 || timer.total > 3600) timer = {mode:'focus',running:false,total:1500,remaining:1500,endAt:0};
timer.remaining = Math.max(0,Math.min(timer.total,Number(timer.remaining) || 0));
if (timer.running && !Number.isFinite(timer.endAt)) timer.running = false;
let lastTimerDisplay = -1;
function timerSeconds() { return timer.running ? Math.max(0,Math.ceil((timer.endAt - Date.now()) / 1000)) : timer.remaining; }
function persistTimer() { writeLocal('aether_v5_timer',timer); }
function updateTimer(force = false) {
  const remaining = timerSeconds();
  if (timer.running && remaining === 0) { timer.running = false; timer.remaining = 0; timer.endAt = 0; persistTimer(); toast(timer.mode === 'focus' ? 'Stretch complete. Take a little breather.' : 'Break complete. Ready for another stretch?'); }
  if (!force && remaining === lastTimerDisplay) return; lastTimerDisplay = remaining;
  const display = `${String(Math.floor(remaining / 60)).padStart(2,'0')}:${String(remaining % 60).padStart(2,'0')}`;
  put('timerDisplay',display); put('timerPhase',timer.mode === 'focus' ? 'FOCUS' : 'BREAK');
  put('timerCaption',timer.running ? 'One small step at a time.' : remaining === 0 ? 'A little progress is still progress.' : remaining < timer.total ? 'Pick up where you paused.' : 'A fresh start, right here.');
  const progress = Math.min(100,Math.max(0,100 * (1 - remaining / timer.total)));
  $('timerRing')?.style.setProperty('--progress',String(progress)); $('timerRing')?.setAttribute('aria-valuenow',String(Math.round(progress))); $('timerRing')?.setAttribute('aria-valuetext',`${display} remaining`);
  if ($('timerStart')) $('timerStart').innerHTML = `${icon(timer.running ? 'close' : 'play')} ${timer.running ? 'Pause' : remaining === 0 ? 'Start again' : remaining < timer.total ? 'Resume' : timer.mode === 'focus' ? 'Start focus' : 'Start break'}`;
  put('timerMode',timer.mode === 'focus' ? 'Switch to a 5 minute break' : 'Switch to focus');
  if ($('focusStatus')) $('focusStatus').innerHTML = `<span class="online-dot"></span> ${timer.running ? 'You are in your stretch' : remaining === 0 ? 'A stretch well spent' : 'Ready when you are'}`;
  visible('timerNav',timer.running); put('timerNav',display);
  $('focusTimerPanel')?.classList.toggle('is-running',timer.running);
  document.body.dataset.timer = timer.running ? 'running' : 'idle';
}
function toggleTimer() { if (timer.running) { timer.remaining = timerSeconds(); timer.running = false; timer.endAt = 0; } else { if (timer.remaining <= 0) timer.remaining = timer.total; timer.running = true; timer.endAt = Date.now() + timer.remaining * 1000; } persistTimer(); updateTimer(true); }
function resetTimer(mode = timer.mode) { timer = {mode,running:false,total:mode === 'break' ? 300 : settings.timerLen * 60,remaining:mode === 'break' ? 300 : settings.timerLen * 60,endAt:0}; persistTimer(); updateTimer(true); }
function renderTodos() {
  put('todoCount',`${todos.filter(t => !t.done).length} TO DO`);
  if ($('todoList')) $('todoList').innerHTML = todos.length ? todos.map(t => `<li class="todo-item ${t.done ? 'done' : ''}"><label><input type="checkbox" data-todo-check="${esc(t.id)}" ${t.done ? 'checked' : ''}><span>${esc(t.text)}</span></label><button class="icon-btn" data-todo-delete="${esc(t.id)}" aria-label="Delete task ${esc(t.text)}">${icon('close')}</button></li>`).join('') : '<li class="todo-empty">Start with one small thing.</li>';
}
function renderFocus() { updateTimer(true); renderTodos(); const reward = [...recents.map(r => byId.get(r.id)).filter(Boolean),...games.filter(g => g.local)]; const seen = new Set(); const choices = reward.filter(g => !seen.has(g.id) && seen.add(g.id)).slice(0,3); if ($('quickLaunch')) $('quickLaunch').innerHTML = choices.map(g => `<button class="quick-game" data-launch="${esc(g.id)}">${g.logo ? `<img src="${esc(artwork(g))}" width="44" height="44" alt="" loading="lazy">` : icon('play')}<span>${esc(g.name)}<small>${esc(g.category)}</small></span>${icon('arrow')}</button>`).join(''); }
function toggleFocus() { go(currentPage === 'focus' ? 'home' : 'focus'); }
function validateSettings() { settings.scramjetTransport = settings.scramjetTransport === 'epoxy' ? 'epoxy' : 'libcurl'; settings.motion = ['system','full','reduced'].includes(settings.motion) ? settings.motion : 'system'; settings.density = ['comfortable','compact'].includes(settings.density) ? settings.density : 'comfortable'; settings.timerLen = [15,25,40,50].includes(Number(settings.timerLen)) ? Number(settings.timerLen) : 25; for (const key of ['newTab','focusDefault','confirmLeave']) settings[key] = Boolean(settings[key]); }
function applySettings() { validateSettings(); const reduced = settings.motion === 'reduced' || (settings.motion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches); for (const el of [document.documentElement,document.body]) { el.dataset.motion = reduced ? 'reduced' : 'full'; el.dataset.motionPreference = settings.motion; el.dataset.density = settings.density; } document.body.classList.toggle('reduce-motion',reduced); document.body.classList.toggle('compact',settings.density === 'compact'); if ($('proxyNewTab')) $('proxyNewTab').checked = settings.newTab; if ($('scramjetTransport')) $('scramjetTransport').value = settings.scramjetTransport; writeLocal('aether_v5_settings',settings); renderSettings(); if (active?.item?.local && active.loaded) sendGameInit(); if (typeof document.dispatchEvent === 'function' && typeof CustomEvent === 'function') document.dispatchEvent(new CustomEvent('aether:settings')); }
const SHORTCUTS = [['Ctrl / ⌘ + K','Find a game, app, or page'],['Esc','Close the current overlay'],['/','Search this collection'],['G then H','Home'],['G then G','Games'],['G then A','Apps'],['G then P','Party'],['G then X','Proxies'],['G then R','Profile'],['G then S','Settings'],['F','Enter Focus']];
function renderSettings() { if ($('setMotion')) $('setMotion').value = settings.motion; if ($('setDensity')) $('setDensity').value = settings.density; if ($('setTimerLen')) $('setTimerLen').value = String(settings.timerLen); for (const [id,key] of [['setNewTab','newTab'],['setFocusDefault','focusDefault'],['setConfirmLeave','confirmLeave']]) if ($(id)) $(id).checked = settings[key]; if ($('shortcutsList')) $('shortcutsList').innerHTML = SHORTCUTS.map(([keys,label]) => `<div class="shortcut-row"><span>${esc(label)}</span><kbd>${esc(keys)}</kbd></div>`).join(''); }
async function copy(text,message) { if (!text) { toast('Nothing to copy yet.'); return; } try { await navigator.clipboard.writeText(text); toast(message || 'Copied'); } catch { toast('Your browser could not copy this. Select and copy the value instead.'); } }
function saveGroups() {
  const groups = new Map();
  for (const [key,value] of Object.entries(user.saves || {})) { if (key.startsWith('__meta__:')) continue; const localId = key.startsWith('aether.arcade.') ? key.slice('aether.arcade.'.length) : null; const group = localId ? `local:${localId}` : key.includes(':') ? `remote:${key.slice(0,key.indexOf(':'))}` : 'other'; if (!groups.has(group)) groups.set(group,{group,keys:[],values:[]}); const entry = groups.get(group); entry.keys.push(key); entry.values.push(value); }
  return [...groups.values()].map(entry => { const id = entry.group.startsWith('local:') ? `aether-${entry.group.slice(6)}` : null; const item = id ? byId.get(id) : items.find(i => { try { return `remote:${new URL(i.url,location.origin).hostname}` === entry.group; } catch { return false; } }); return {...entry,item,name:item?.name || (entry.group === 'other' ? 'Other game progress' : entry.group.slice(7))}; });
}
function renderProfile() {
  put('uuidBox',user.uuid ? profileRevealed ? user.uuid : `${user.uuid.slice(0,8)} •••• •••• ••••` : profileReady ? 'No profile key returned' : 'Profile unavailable. Retry the connection.'); put('revealUUID',profileRevealed ? 'Hide' : 'Show');
  const groups = saveGroups(), count = groups.reduce((n,g) => n + g.keys.length,0); put('saveCount',`${count} ${count === 1 ? 'SAVE' : 'SAVES'}`);
  if ($('savesList')) $('savesList').innerHTML = groups.length ? groups.map(entry => { const stats = entry.values.find(v => v && typeof v === 'object' && Number.isFinite(v.rounds)); const details = stats ? `${stats.rounds} rounds${Number.isFinite(stats.best) ? ` · Best ${stats.best}` : ''}` : `${entry.keys.length} saved ${entry.keys.length === 1 ? 'item' : 'items'}`; return `<div class="save-row"><div class="save-game">${entry.item?.logo ? `<img src="${esc(artwork(entry.item))}" width="44" height="44" alt="" loading="lazy">` : icon('cloud')}<div><strong>${esc(entry.name)}</strong><small>${esc(details)}</small></div></div><button class="text-btn danger" data-delete-group="${esc(entry.group)}" aria-label="Delete saved progress for ${esc(entry.name)}">Delete</button></div>`; }).join('') : '<div class="empty-state small"><h3>A fresh start.</h3><p>Supported games will keep their progress here. Favorites and Focus notes are stored separately.</p></div>';
}
async function exportProfile() {
  try { await flushMetadata(); const fresh = await api('/api/user'); user = fresh; profileReady = true; const backup = {format:'aether-profile',version:5,exportedAt:new Date().toISOString(),...fresh}; const url = URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'})); const link = document.createElement('a'); link.href = url; link.download = `aether-profile-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url),10000); renderProfile(); toast('Backup downloaded. Keep it private with your profile key.'); } catch (error) { toast(`Backup failed: ${error.message}`); }
}
async function importProfile(event) {
  event.preventDefault(); const uuid = $('importInput').value.trim(); if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(uuid)) { toast('That profile key is not a valid key. Check the full value.'); return; }
  const button = event.currentTarget.querySelector('button'); if (button) button.disabled = true;
  try { closeOverlay(true); await flushMetadata(); await api('/api/import','POST',{uuid}); const fresh = await api('/api/user'); user = fresh; profileReady = true; hydrateProfile(); $('importInput').value = ''; toast('Profile restored. Your previous profile is kept.'); } catch (error) { toast(`Profile restore failed: ${error.message}`); } finally { if (button) button.disabled = false; }
}
async function restoreBackup(file) {
  if (!file) return; if (file.size > 9 * 1024 * 1024) { toast('This backup is too large to restore.'); return; }
  try { const backup = JSON.parse(await file.text()); if (!backup.saves || typeof backup.saves !== 'object' || Array.isArray(backup.saves) || Object.keys(backup.saves).length > 2000) throw new Error('This file is not an Aether profile backup.'); if (!confirm('Restore this backup into your current profile? Matching saved items will be replaced.')) return; closeOverlay(true); await flushMetadata(); await api('/api/save-batch','POST',{saves:backup.saves}); user = await api('/api/user'); profileReady = true; hydrateProfile(); toast('Backup restored and saved to your profile.'); } catch (error) { toast(`Backup restore failed: ${error.message}`); } finally { if ($('importBackupFile')) $('importBackupFile').value = ''; }
}
async function deleteSaveGroup(group) {
  const entry = saveGroups().find(g => g.group === group); if (!entry || !confirm(`Delete saved progress for ${entry.name}?`)) return;
  try {
    if (group.startsWith('remote:')) { await api(`/api/saves-by-game/${encodeURIComponent(group.slice(7))}`,'DELETE'); for (const key of entry.keys) delete user.saves[key]; }
    else for (const key of entry.keys) { await api(`/api/save/${encodeURIComponent(key)}`,'DELETE'); delete user.saves[key]; }
    clearOriginalCache(entry.item); if (active?.item?.id === entry.item?.id) closeOverlay(true); renderProfile(); toast('Saved progress deleted.');
  } catch (error) { renderProfile(); toast(`Deletion did not finish: ${error.message}`); }
}
async function clearProfile() {
  if (!confirm('Delete all saved games, favorites, notes, and tasks in this profile? Download a backup first if you want to keep them.')) return;
  try { for (const pending of metadataTimers.values()) clearTimeout(pending); metadataTimers.clear(); await Promise.allSettled([...metadataPending]); await api('/api/user','DELETE'); closeOverlay(true); for (const item of games.filter(g => g.local)) clearOriginalCache(item); writeLocal(pendingKey(),{}); user.saves = {}; favorites = new Set(); recents = []; notes = ''; todos = []; cacheProfile(); if ($('focusNotes')) $('focusNotes').value = ''; renderFocus(); renderProfile(); refreshActivePage(); put('notesStatus','Saved'); toast('All profile saves deleted. Your profile key still works.'); } catch (error) { toast(`Deletion failed: ${error.message}`); }
}
function clearRecents() { recents = []; saveMetadata('recents',[]); refreshActivePage(); toast('Recent history cleared.'); }

/* A party shares an actual game and score. Publishing is acknowledged by the server. */
let partySocket = null, partyCode = '', partyConnecting = false, partyState = null, sharePending = null, roomRequest = false;
function chatLine(entry) { const time = new Date(entry.at || Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); return `<div class="chat-message"><div><strong>${esc(entry.from || 'Someone')}</strong><time>${esc(time)}</time></div><p>${esc(entry.text || '')}</p></div>`; }
function appendChat(entry) { const log = $('mpChatLog'); if (!log) return; log.insertAdjacentHTML('beforeend',chatLine(entry)); while (log.children.length > 100) log.firstElementChild.remove(); log.scrollTop = log.scrollHeight; }
function renderMembers(members) { if ($('mpMembers')) $('mpMembers').innerHTML = (Array.isArray(members) ? members : []).map(member => `<span class="member-chip"><span class="online-dot"></span>${esc(typeof member === 'string' ? member : member.userName || member.name || 'Someone')}</span>`).join(''); }
function renderPartyState(state,from = '') {
  partyState = state; const view = $('mpStateView'); if (!view) return;
  const item = state && resolveItem(state.gameId || state.game?.id || state.game?.url || state.url);
  if (!item) { view.innerHTML = '<p class="muted">Share your last game to give your party something to play.</p>'; return; }
  const score = Number.isFinite(state.score) && state.score >= 0 ? `<span class="shared-score">Latest score: ${esc(state.score)}</span>` : '';
  view.innerHTML = `<div class="shared-game-card">${item.logo ? `<img src="${esc(artwork(item))}" width="56" height="56" alt="" loading="lazy">` : icon('games')}<div><strong>${esc(item.name)}</strong><small>${esc(from || state.sharedBy || 'Your party')} shared this</small>${score}</div><button class="btn" data-launch="${esc(item.id)}">Play ${icon('play')}</button></div>`;
}
async function refreshRooms() { if (roomRequest) return; roomRequest = true; const button = $('refreshRoomsBtn'); if (button) button.disabled = true; try { const data = await api('/api/rooms'); if ($('roomList')) $('roomList').innerHTML = data.rooms?.length ? data.rooms.map(room => `<button class="room-row" data-room="${esc(room.code)}"><span><strong>${esc(room.name || room.code)}</strong><small>${esc(room.code)}</small></span><span>${Number(room.members) || 0} ${(Number(room.members) || 0) === 1 ? 'person' : 'people'} ${icon('arrow')}</span></button>`).join('') : '<p class="muted">No rooms yet. Start one and invite a friend.</p>'; } catch (error) { if ($('roomList')) $('roomList').innerHTML = `<p class="muted">Rooms could not load. ${esc(error.message)}</p>`; } finally { roomRequest = false; if (button) button.disabled = false; } }
function endShare(message) { if (!sharePending) return; clearTimeout(sharePending.timer); sharePending = null; if ($('mpShareBtn')) $('mpShareBtn').disabled = false; if (message) toast(message); }
function leaveParty(force = false) { if (partyCode && !force && settings.confirmLeave && !confirm('Leave this party?')) return false; const socket = partySocket; partySocket = null; partyCode = ''; partyConnecting = false; endShare(); socket?.close(); visible('mpRoomView',false); if ($('mpCreate')) $('mpCreate').disabled = false; if ($('mpJoinBtn')) $('mpJoinBtn').disabled = false; return true; }
function joinParty(room = '') {
  room = String(room).trim().toUpperCase(); const name = $('mpName')?.value.trim().slice(0,24) || 'Guest';
  if (room && !/^[A-Z0-9]{4,12}$/.test(room)) { toast('Enter a room code with 4 to 12 letters or numbers.'); return; }
  if (partyConnecting) return; if (!leaveParty()) return;
  writeLocal('aether_v5_party_name',name); partyConnecting = true; if ($('mpCreate')) $('mpCreate').disabled = true; if ($('mpJoinBtn')) $('mpJoinBtn').disabled = true;
  const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`); partySocket = socket;
  const handshake = setTimeout(() => { if (partySocket === socket && !partyCode) { leaveParty(true); toast('The party connection took too long. Try again.'); } },15000);
  socket.addEventListener('open',() => { if (partySocket === socket) socket.send(JSON.stringify({type:'join',room,userName:name})); });
  socket.addEventListener('message',event => { if (partySocket !== socket) return; let data; try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'joined') { clearTimeout(handshake); partyConnecting = false; partyCode = data.code; put('mpRoomCode',partyCode); visible('mpRoomView',true); if ($('mpChatLog')) $('mpChatLog').innerHTML = ''; (data.history || []).slice(-100).forEach(appendChat); renderMembers(data.members); renderPartyState(data.state); if ($('mpRoom')) $('mpRoom').value = partyCode; if ($('mpCreate')) $('mpCreate').disabled = false; if ($('mpJoinBtn')) $('mpJoinBtn').disabled = false; toast(`Joined room ${partyCode}`); }
    else if (data.type === 'chat') appendChat(data.entry || {});
    else if (data.type === 'members' || data.type === 'member-left') renderMembers(data.members);
    else if (data.type === 'state') renderPartyState(data.state,data.from);
    else if (data.type === 'state-published') { if (sharePending) { renderPartyState(sharePending.state,name); endShare('Game shared with your party.'); } }
    else if (data.type === 'error') { endShare(); toast(data.message || data.error || 'The party request failed.'); if (!partyCode) leaveParty(true); }
  });
  socket.addEventListener('close',() => { clearTimeout(handshake); if (partySocket === socket) { const wasJoined = Boolean(partyCode); leaveParty(true); toast(wasJoined ? 'Party disconnected. You can join again.' : 'The party connection closed. Try again.'); } });
  socket.addEventListener('error',() => { if (partySocket === socket) toast('The party connection failed.'); });
}
function shareGame() { if (!partyCode || partySocket?.readyState !== WebSocket.OPEN) { toast('Join a party first.'); return; } if (sharePending) return; const item = active?.item?.id && byId.get(active.item.id) || byId.get(recents[0]?.id); if (!item) { toast('Play a game first, then share it.'); return; } const recent = recents.find(r => r.id === item.id); const state = {gameId:item.id,game:{id:item.id,name:item.name},score:Number.isFinite(recent?.score) ? recent.score : undefined,sharedBy:$('mpName')?.value.trim().slice(0,24) || 'Guest',at:Date.now()}; if ($('mpShareBtn')) $('mpShareBtn').disabled = true; sharePending = {state,timer:setTimeout(() => endShare('Sharing was not acknowledged. Try again.'),8000)}; try { partySocket.send(JSON.stringify({type:'state',state})); } catch { endShare('The game could not be shared.'); } }
let paletteChoices = [], paletteIndex = 0;
function openPalette() { paletteInvoker = document.activeElement; visible('palette',true); syncInert(); if ($('paletteInput')) { $('paletteInput').value = ''; $('paletteInput').focus(); } renderPalette(); }
function closePalette() { if (!$('palette') || $('palette').hidden) return; visible('palette',false); syncInert(); paletteInvoker?.focus?.(); }
function renderPalette() {
  const query = $('paletteInput')?.value.trim().toLowerCase() || '';
  const pages = Object.entries(PAGE_META).filter(([id,[name]]) => !query || `${id} ${name}`.toLowerCase().includes(query)).map(([page,[name]]) => ({page,name,category:'Page'}));
  const candidates = query ? items.filter(i => i.search.includes(query)) : [...recents.map(r => byId.get(r.id)).filter(Boolean),...games.filter(g => g.featured || g.local)];
  const unique = new Set(); paletteChoices = [...pages,...candidates.filter(i => !unique.has(i.id) && unique.add(i.id))].slice(0,30); paletteIndex = Math.min(paletteIndex,Math.max(0,paletteChoices.length - 1));
  if ($('paletteResults')) $('paletteResults').innerHTML = paletteChoices.length ? paletteChoices.map((choice,i) => `<button role="option" id="palette-option-${i}" class="palette-result ${i === paletteIndex ? 'active' : ''}" data-palette-index="${i}" aria-selected="${i === paletteIndex}">${choice.page ? icon(choice.page === 'home' ? 'home' : choice.page) : choice.logo ? `<img src="${esc(artwork(choice))}" width="36" height="36" alt="" loading="lazy">` : icon('play')}<span><strong>${esc(choice.name)}</strong><small>${esc(choice.category)}</small></span>${icon('arrow')}</button>`).join('') : '<p class="palette-empty">Nothing found. Try another search.</p>';
  $('paletteInput')?.setAttribute('aria-activedescendant',paletteChoices.length ? `palette-option-${paletteIndex}` : '');
}
function choosePalette(index) { const choice = paletteChoices[index]; if (!choice) return; closePalette(); if (choice.page) go(choice.page); else launch(choice); }
function focusSearch() { const search = currentPage === 'games' ? $('gameSearch') : currentPage === 'apps' ? $('appSearch') : null; if (search) search.focus(); else openPalette(); }
function paletteKeys(event) { if (!['ArrowDown','ArrowUp','Enter'].includes(event.key)) return; event.preventDefault(); if (event.key === 'Enter') { choosePalette(paletteIndex); return; } paletteIndex = (paletteIndex + (event.key === 'ArrowDown' ? 1 : -1) + Math.max(1,paletteChoices.length)) % Math.max(1,paletteChoices.length); renderPalette(); $(`palette-option-${paletteIndex}`)?.scrollIntoView({block:'nearest'}); }

let shortcutPrefix = 0;
function keyboard(event) {
  trapFocus(event);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); !$('palette')?.hidden ? closePalette() : openPalette(); return; }
  if (event.key === 'Escape') { if (!$('palette')?.hidden) closePalette();else if(!$('overlayRecovery')?.hidden)hideLaunchOptions();else closeOverlay();return; }
  if (event.target.closest('input,textarea,select,[contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey || !$('overlay')?.hidden) return;
  const key = event.key.toLowerCase(); if (key === '/') { event.preventDefault(); focusSearch(); return; }
  if (key === '?') { go('settings'); return; } if (key === 'f') { toggleFocus(); return; }
  if (Date.now() - shortcutPrefix < 1000) { shortcutPrefix = 0; const page = {h:'home',g:'games',a:'apps',p:'multiplayer',x:'proxies',r:'profile',s:'settings'}[key]; if (page) { event.preventDefault(); go(page); return; } }
  if (key === 'g') shortcutPrefix = Date.now();
}
function bindUI() {
  document.addEventListener('click',event => {
    const button = event.target.closest('button,[data-page]'); if (!button || button.disabled) return;
    if (button.dataset.page) { go(button.dataset.page); return; }
    if (button.dataset.favorite) { favorite(byId.get(button.dataset.favorite)); return; }
    if (button.dataset.launch) { launch(byId.get(button.dataset.launch)); return; }
    if (button.dataset.category) { const state = button.dataset.collection === 'games' ? library : appFilter; state.category = button.dataset.category; library.limit = 48; button.dataset.collection === 'games' ? renderGames() : renderApps(); return; }
    if (button.dataset.deleteGroup) { deleteSaveGroup(button.dataset.deleteGroup); return; }
    if (button.dataset.todoDelete) { todos = todos.filter(t => t.id !== button.dataset.todoDelete); saveMetadata('todos',todos); renderTodos(); return; }
    if (button.dataset.room) { joinParty(button.dataset.room); return; }
    if (button.dataset.paletteIndex !== undefined) choosePalette(Number(button.dataset.paletteIndex));
  });
  document.addEventListener('change',event => { if (event.target.dataset.todoCheck) { const todo = todos.find(t => t.id === event.target.dataset.todoCheck); if (todo) { todo.done = event.target.checked; saveMetadata('todos',todos); renderTodos(); } } });
  document.addEventListener('error',event => { if (event.target.tagName !== 'IMG') return; const image = event.target; image.hidden = true; image.parentElement?.classList.add('art-failed'); },true);
  on('gameSearch','input',delay(() => { library.query = $('gameSearch').value.trim(); library.limit = 48; renderGames(); }));
  on('appSearch','input',delay(() => { appFilter.query = $('appSearch').value.trim(); renderApps(); }));
  on('gamesFavorites','click',() => { library.favorites = !library.favorites; library.limit = 48; renderGames(); });
  on('appsFavorites','click',() => { appFilter.favorites = !appFilter.favorites; renderApps(); });
  on('gameAvailability','change',() => { library.availability = $('gameAvailability').value; library.limit = 48; renderGames(); });
  on('gameSort','change',() => { library.sort = $('gameSort').value; library.limit = 48; renderGames(); });
  on('gamesLoadMore','click',() => { library.limit += 48; renderGames(true); });
  for (const id of ['resetGameFilters','emptyResetGames']) on(id,'click',resetGames);
  for (const id of ['allOriginalsBtn','originalsCollection']) on(id,'click',() => { resetGames(); library.availability = 'local'; if ($('gameAvailability')) $('gameAvailability').value = 'local'; go('games'); });
  on('timerNav','click',() => go('focus'));
  on('allFavoritesBtn','click',() => { resetGames(); library.favorites = true; go('games'); });
  on('surpriseBtn','click',() => { const pool = games.filter(g => g.local || g.launch === 'direct'); if (pool.length) launch(pool[Math.floor(Math.random() * pool.length)]); });
  for (const id of ['clearRecentsBtn','settingsClearRecents']) on(id,'click',clearRecents);
  for (const id of ['paletteBtn','sidebarSearch']) on(id,'click',openPalette);
  on('paletteClose','click',closePalette); on('palette','click',event => { if (event.target === $('palette')) closePalette(); });
  on('paletteInput','input',delay(() => { paletteIndex = 0; renderPalette(); },80)); on('paletteInput','keydown',paletteKeys);
  on('focusToggle','click',toggleFocus); on('timerStart','click',toggleTimer); on('timerReset','click',() => resetTimer()); on('timerMode','click',() => resetTimer(timer.mode === 'focus' ? 'break' : 'focus'));
  on('focusNotes','input',() => { notes = $('focusNotes').value.slice(0,8000); saveMetadata('focus_notes',notes,650); });
  on('todoForm','submit',event => { event.preventDefault(); const text = $('todoInput').value.trim(); if (!text) return; if (todos.length >= 100) { toast('You have 100 tasks. Finish or clear a few before adding more.'); return; } todos.push({id:crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,text:text.slice(0,180),done:false}); $('todoInput').value = ''; saveMetadata('todos',todos); renderTodos(); });
  $$('.proxy-launch-form').forEach(form => form.addEventListener('submit',event => { event.preventDefault(); try { const url = normalizeTarget(form.querySelector('input').value); launch(null,{url,engine:form.dataset.engine,newTab:$('proxyNewTab')?.checked}); } catch (error) { toast(error.message); } }));
  on('gameFrame','load',frameLoaded); window.addEventListener('message',gameMessage);
  on('scramjetTransport','change',() => { settings.scramjetTransport = $('scramjetTransport').value; applySettings(); saveMetadata('settings',settings); });
  on('overlayBack','click',() => closeOverlay()); on('cancelLaunch','click',() => closeOverlay(true));
  on('overlayReload','click',() => { if (active) launch(active.item,{url:active.url,engine:active.engine,transport:active.transport,same:true}); });
  on('retryLaunch','click',() => { if (active) launch(active.item,{url:active.url,engine:active.engine,transport:active.transport,same:true}); });
  const tryOtherEngine = () => { if (!active || active.item.local) return; const next=launchHealth.nextRoute(active.item,launchHealth.routeId(active.engine,active.transport));launch(active.item,{url:active.url,...launchHealth.routeOptions(next),same:true}); };
  on('tryOtherEngine','click',tryOtherEngine);on('overlayRoute','click',() => { if ($('overlayRecovery').hidden) showLaunchOptions();else hideLaunchOptions(); });
  on('dismissRecovery','click',hideLaunchOptions);on('keepWaiting','click',hideLaunchOptions);
  on('launchRouteForm','submit',event => {event.preventDefault();if(!active || active.item.local)return;const route=$('launchRoute').value;if(!launchHealth.routesFor(active.item).includes(route))return;launch(active.item,{url:active.url,...launchHealth.routeOptions(route),same:true});});
  on('rememberRoute','click',() => {if(!active?.loaded || active.item.local || !byId.has(active.item.id))return;routePreferences=launchHealth.validatePreferences({...routePreferences,[active.item.id]:{route:launchHealth.routeId(active.engine,active.transport),url:active.item.url,at:Date.now()}});if(!writeLocal(routePreferenceKey,routePreferences)){toast('This browser could not remember the route.');return;}active.confirmed=true;active.issue=null;renderLaunchOptions();put('saveStatus','You confirmed working');toast('Working route remembered on this browser.');});
  on('forgetRoute','click',() => {if(!active)return;delete routePreferences[active.item.id];writeLocal(routePreferenceKey,routePreferences);active.confirmed=false;renderLaunchOptions();toast('Saved route forgotten.');});
  on('overlayNewTab','click',() => { if (active) openShell(active.item,active.engine,active.url,active.transport); });
  on('proxyAuthTab','click',() => { if (!active?.viewerUrl) return; const tab = window.open(active.viewerUrl,'_blank');if(tab){try{tab.opener=null;}catch{}}else toast('Your browser blocked the new tab. Allow popups for Aether.'); });
  on('overlayFullscreen','click',async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('gameFrame').requestFullscreen(); } catch { toast('This browser could not enter fullscreen.'); } });
  on('revealUUID','click',() => { profileRevealed = !profileRevealed; renderProfile(); }); on('copyUUIDBtn','click',() => copy(user.uuid,'Profile key copied. Keep it private.'));
  on('exportProfileBtn','click',exportProfile); on('settingsExport','click',exportProfile); on('importForm','submit',importProfile); on('clearAllBtn','click',clearProfile);
  on('importBackupBtn','click',() => $('importBackupFile')?.click()); on('importBackupFile','change',event => restoreBackup(event.target.files?.[0]));
  for (const [id,key] of [['setMotion','motion'],['setDensity','density'],['setTimerLen','timerLen'],['setNewTab','newTab'],['setFocusDefault','focusDefault'],['setConfirmLeave','confirmLeave']]) on(id,'change',() => { settings[key] = $(id).type === 'checkbox' ? $(id).checked : $(id).value; applySettings(); saveMetadata('settings',settings); if (key === 'timerLen' && !timer.running && timer.mode === 'focus') resetTimer('focus'); });
  on('mpCreate','click',() => joinParty()); on('mpJoinBtn','click',() => joinParty($('mpRoom').value)); on('mpRoom','keydown',event => { if (event.key === 'Enter') { event.preventDefault(); joinParty($('mpRoom').value); } });
  on('mpLeaveBtn','click',() => { if (leaveParty()) toast('Left the party.'); }); on('mpCopyBtn','click',() => copy(partyCode,'Room code copied.')); on('refreshRoomsBtn','click',refreshRooms); on('mpShareBtn','click',shareGame);
  on('mpChatForm','submit',event => { event.preventDefault(); const text = $('mpChatInput').value.trim(); if (!text) return; if (!partyCode || partySocket?.readyState !== WebSocket.OPEN) { toast('The party is not connected.'); return; } try { partySocket.send(JSON.stringify({type:'chat',text:text.slice(0,500)})); $('mpChatInput').value = ''; } catch { toast('The message could not be sent.'); } });
  on('catalogRetry','click',async () => { $('catalogRetry').disabled = true; await loadCatalog(); $('catalogRetry').disabled = false; });
  window.addEventListener('hashchange',() => { if (active) closeOverlay(true); go(location.hash.slice(1),false); });
  window.addEventListener('popstate',() => { if (active) closeOverlay(true); go(location.hash.slice(1),false); });
  document.addEventListener('keydown',keyboard); document.addEventListener('visibilitychange',() => { if (!document.hidden) updateTimer(true); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',applySettings);
  window.addEventListener('beforeunload',event => { if (partyCode && settings.confirmLeave) { event.preventDefault(); event.returnValue = ''; } });
  setInterval(updateTimer,500); setInterval(() => { if (currentPage === 'multiplayer' && !document.hidden) refreshRooms(); },15000);
  if ($('mpName')) $('mpName').value = readLocal('aether_v5_party_name','');
  if (!window.isSecureContext || !navigator.serviceWorker) { visible('proxyContextNotice',true); put('proxyContextNotice','Ultraviolet and Scramjet need HTTPS or localhost. Try your HTTPS Aether address for these engines. Local games and direct play are available here.'); }
}
async function loadCatalog() {
  try { const data = await api('/api/games?v=5.4.1'); indexCatalog(data); try { sessionStorage.setItem('aether_catalog_v5',JSON.stringify(data)); } catch {} visible('catalogNotice',false); hydrateProfile(); }
  catch (error) { visible('catalogNotice',true); put('catalogNoticeText',`The library could not refresh. ${error.message}`); }
}
async function boot() {
  bindUI(); applySettings(); updateTimer(true);
  for(const page of ['page-focus','page-profile','page-settings']) {$(page).inert=true;$(page).setAttribute('aria-busy','true');}
  go(location.hash.slice(1) || (settings.focusDefault ? 'focus' : 'home'),false);
  let settleProfile;profileGate=new Promise(resolve=>{settleProfile=resolve;});
  const catalogRequest=api('/api/games?v=5.4.1').then(data=>{indexCatalog(data);refreshActivePage();return data;});
  const [catalogResult,userResult] = await Promise.allSettled([catalogRequest,api('/api/user')]);
  if (catalogResult.status === 'fulfilled') { indexCatalog(catalogResult.value); try { sessionStorage.setItem('aether_catalog_v5',JSON.stringify(catalogResult.value)); } catch {} }
  else { let cached; try { cached = JSON.parse(sessionStorage.getItem('aether_catalog_v5')); } catch {} if (cached) indexCatalog(cached); visible('catalogNotice',true); put('catalogNoticeText',`${cached ? 'Showing the library from this tab. ' : ''}${catalogResult.reason.message}`); }
  if (userResult.status === 'fulfilled') { user = {...userResult.value,saves:userResult.value.saves || {}}; profileReady = true; adoptOfflineMetadata(); }
  else { user.uuid ||= cookieProfileUUID(); profileReady = false; toast(`Profile connection failed. Notes and favorites will stay on this device: ${userResult.reason.message}`); }
  hydrateProfile();profileHydrated=true;settleProfile();
  for(const page of ['page-focus','page-profile','page-settings']) {$(page).inert=false;$(page).removeAttribute('aria-busy');}
  const parameters = new URLSearchParams(location.search), requestedGame = parameters.get('aether_game'), requestedEngine = parameters.get('aether_proxy'), requestedURL = parameters.get('aether_url'), requestedTransport = parameters.get('aether_transport') === 'epoxy' ? 'epoxy' : 'libcurl';
  const requestedPage = location.hash.slice(1) || (settings.focusDefault ? 'focus' : 'home'); go(requestedPage,false);
  if (requestedGame || requestedEngine || requestedURL) { parameters.delete('aether_game'); parameters.delete('aether_proxy'); parameters.delete('aether_url'); parameters.delete('aether_transport'); history.replaceState(null,'',`${location.pathname}${parameters.size ? `?${parameters}` : ''}${location.hash}`); if (requestedGame) { const item = resolveItem(requestedGame); if (item) launch(item,{same:true,transport:requestedTransport,engine:['direct','uv','scramjet','rammer'].includes(requestedEngine) ? requestedEngine : undefined}); else toast('That game is no longer in the library.'); } else if (requestedURL && ['direct','uv','scramjet','rammer'].includes(requestedEngine)) { try { launch(null,{url:normalizeTarget(requestedURL),engine:requestedEngine,transport:requestedTransport,same:true}); } catch (error) { toast(error.message); } } }
  window.Aether = {version:'5.4.1',get favorites(){return [...favorites];},get recents(){return [...recents];},get activeGame(){return active?.item?.id || null;},go,openPalette};
}
window.openGame = (url,name) => launch(resolveItem(url) || {name:name || 'Game',url:decode(url),launch:'proxy'});
window.openApp = window.openGame;
window.launchProxy = (engine,id) => { try { launch(null,{url:normalizeTarget($(id)?.value),engine,newTab:$('proxyNewTab')?.checked}); } catch (error) { toast(error.message); } };
window.closeOverlay = closeOverlay;
window.go = go;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();

})();

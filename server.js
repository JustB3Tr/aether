import express from 'express';
import { createServer, request as requestHTTP } from 'node:http';
import { request as requestHTTPS } from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { readFile, writeFile, rename, unlink, readdir, stat } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { gzip, brotliCompress, gzipSync, brotliCompressSync, createGunzip, createBrotliDecompress, createInflate, constants as zlibConstants } from 'node:zlib';
import { promisify } from 'node:util';

import { createBareServer } from '@tomphttp/bare-server-node';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport-v2';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import { WebSocketServer } from 'ws';
import rammerhead from '@rubynetwork/rammerhead';
import rammerheadConfig from '@rubynetwork/rh/src/config.js';
import { verifyAccessAssertion } from './security/cloudflare-access.js';
import { PublicDestinations, TokenBuckets, installRammerheadGuard, rammerheadSessionPath } from './security/public-guard.js';
import { profileSessions, validUUID } from './security/profile-session.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const packageDir = (name) => dirname(require.resolve(name));
const controllerPath = packageDir('@mercuryworkshop/scramjet-controller');
const scramjetUtilsPath = packageDir('@mercuryworkshop/scramjet-utils');
const libcurlPath = packageDir('@mercuryworkshop/libcurl-transport');
const epoxyV3Path = packageDir('@mercuryworkshop/epoxy-transport-v3');
const PORT = process.env.PORT || 3000;
const USERS_DIR = process.env.USERS_DIR || join(__dirname, 'userdata');
const RAMMERHEAD_SESSIONS_DIR = process.env.RAMMERHEAD_SESSIONS_DIR || join(USERS_DIR, 'rammerhead-sessions');
const VERSION = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8')).version;
const production = process.env.NODE_ENV === 'production';
function configuredOrigin(value, name) {
  if (!value) return '';
  const parsed = new URL(value);
  if (parsed.origin !== value.replace(/\/$/, '') || parsed.pathname !== '/' || parsed.search || parsed.hash || (production && parsed.protocol !== 'https:')) {
    throw new Error(`${name} must be an origin only${production ? ' and use HTTPS' : ''}`);
  }
  return parsed.origin;
}
const APP_ORIGIN = configuredOrigin(process.env.AETHER_APP_ORIGIN, 'AETHER_APP_ORIGIN');
const PROXY_ORIGIN = configuredOrigin(process.env.AETHER_PROXY_ORIGIN, 'AETHER_PROXY_ORIGIN');
const ACCESS_TEAM_DOMAIN = String(process.env.AETHER_ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
const APP_ACCESS_AUDIENCE = process.env.AETHER_APP_ACCESS_AUDIENCE || '';
const PROXY_ACCESS_AUDIENCE = process.env.AETHER_PROXY_ACCESS_AUDIENCE || '';
if (ACCESS_TEAM_DOMAIN && !/^[a-z0-9.-]+$/i.test(ACCESS_TEAM_DOMAIN)) throw new Error('AETHER_ACCESS_TEAM_DOMAIN must be a hostname only.');
const ACCESS_MODE = process.env.AETHER_ACCESS_MODE || 'public';
if (!['public','access'].includes(ACCESS_MODE)) throw new Error('AETHER_ACCESS_MODE must be public or access');
const ACCESS_ENABLED = ACCESS_MODE === 'access';
if (ACCESS_ENABLED && (!ACCESS_TEAM_DOMAIN || !APP_ACCESS_AUDIENCE || !PROXY_ACCESS_AUDIENCE)) {
  throw new Error('Access mode requires a Cloudflare team domain and both audience values');
}
if (production && (!APP_ORIGIN || !PROXY_ORIGIN || APP_ORIGIN === PROXY_ORIGIN)) {
  throw new Error('Production requires distinct HTTPS app and proxy origins. Cloudflare Access is optional.');
}
if ((APP_ORIGIN || PROXY_ORIGIN) && (!APP_ORIGIN || !PROXY_ORIGIN || APP_ORIGIN === PROXY_ORIGIN)) {
  throw new Error('Configure both AETHER_APP_ORIGIN and AETHER_PROXY_ORIGIN as distinct origins.');
}
const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
const normalizeIP = value => String(value || '').replace(/^::ffff:/,'');
const trustedProxyIPs = new Set(['127.0.0.1','::1',...(process.env.AETHER_TRUSTED_PROXY_IPS || '').split(',').filter(Boolean)].map(normalizeIP));
for (const address of trustedProxyIPs) if (!isIP(address)) throw new Error('AETHER_TRUSTED_PROXY_IPS must contain exact IP addresses');
const trustedPeer = req => trustedProxyIPs.has(normalizeIP(req.socket.remoteAddress));
const clientIP = req => trustedPeer(req) && isIP(String(req.headers['cf-connecting-ip'] || ''))
  ? normalizeIP(req.headers['cf-connecting-ip']) : normalizeIP(req.socket.remoteAddress);
const destinations = new PublicDestinations({excludedHosts:[APP_ORIGIN,PROXY_ORIGIN].filter(Boolean).map(origin => new URL(origin).hostname)});
const requestLimits = new TokenBuckets({capacity:400,perSecond:20});
const globalRequests = new TokenBuckets({capacity:2000,perSecond:200,maxKeys:1});
const writeLimits = new TokenBuckets({capacity:30,perSecond:1});
const importLimits = new TokenBuckets({capacity:3,perSecond:5/60});
const profileLimits = new TokenBuckets({capacity:6,perSecond:10/60});
const sessionLimits = new TokenBuckets({capacity:6,perSecond:10/60});
const globalSessions = new TokenBuckets({capacity:30,perSecond:100/60,maxKeys:1});
const upgradeLimits = new TokenBuckets({capacity:10,perSecond:20/60});
const outboundBytes=new TokenBuckets({capacity:32*1024*1024,perSecond:10*1024*1024});
const globalOutboundBytes=new TokenBuckets({capacity:128*1024*1024,perSecond:50*1024*1024,maxKeys:1});
const inboundBytes=new TokenBuckets({capacity:16*1024*1024,perSecond:4*1024*1024});
const proxyConnections = new Map();let proxyConnectionCount=0;
function countOutbound(ip,chunk,encoding) {
  const bytes=typeof chunk === 'string' ? Buffer.byteLength(chunk,typeof encoding === 'string' ? encoding : undefined) : chunk?.byteLength || 0;
  return outboundBytes.take(ip,bytes) && globalOutboundBytes.take('all',bytes);
}
function boundProxyResponse(req,res) {
  const ip=clientIP(req);
  for (const method of ['write','end']) {
    const original=res[method];
    res[method]=function(chunk,encoding,...args) {
      if (!countOutbound(ip,chunk,encoding)) {res.destroy();return method === 'write' ? false : res;}
      return original.call(this,chunk,encoding,...args);
    };
  }
}

// RH 1.2.76 hides its own listener methods in the cross-window storage proxy,
// then calls addChangeEventListener during startup. Adapt the served client only.
const rammerheadClientPath = join(packageDir('@rubynetwork/rh'), 'client', 'rammerhead.min.js');
const rammerheadClientSource = readFileSync(rammerheadClientPath, 'utf-8');
const rammerheadStorageMarker = '["internal","clear","key","getItem","setItem","removeItem","length"]';
if (rammerheadClientSource.split(rammerheadStorageMarker).length !== 2) {
  throw new Error('Rammerhead storage compatibility marker changed. Review the client adapter before upgrading the dependency.');
}
const rammerheadClientPatched = rammerheadClientSource.replace(rammerheadStorageMarker,
  '["internal","clear","key","getItem","setItem","removeItem","length","addChangeEventListener","removeChangeEventListener"]');
const rammerheadClientBody = Buffer.from(rammerheadClientPatched);
const rammerheadClientDigest = createHash('sha256').update(rammerheadClientBody).digest('hex').slice(0,24);
const rammerheadClientBodies = {
  identity: rammerheadClientBody,
  gzip: gzipSync(rammerheadClientBody, { level: 6 }),
  br: brotliCompressSync(rammerheadClientBody, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } }),
};

mkdirSync(USERS_DIR, { recursive: true });
mkdirSync(RAMMERHEAD_SESSIONS_DIR, { recursive: true });
const sessions = profileSessions(USERS_DIR);
rammerheadConfig.fileCacheSessionConfig.saveDirectory = RAMMERHEAD_SESSIONS_DIR;
rammerheadConfig.fileCacheSessionConfig.staleCleanupOptions={staleTimeout:24*60*60*1000,maxToLive:7*24*60*60*1000,staleCheckInterval:60*60*1000};
let sessionDiskScan=null,sessionDiskExpires=0,sessionDiskCount=0,sessionDiskBytes=0;
async function roomForRammerheadSession() {
  if (Date.now() >= sessionDiskExpires && !sessionDiskScan) {
    sessionDiskScan=(async () => {
      const files=(await readdir(RAMMERHEAD_SESSIONS_DIR)).filter(file => file.endsWith('.rhfsession'));
      let bytes=0;for (const file of files) {try {bytes+=(await stat(join(RAMMERHEAD_SESSIONS_DIR,file))).size;}catch(error){if(error.code !== 'ENOENT')throw error;}}
      sessionDiskCount=files.length;sessionDiskBytes=bytes;sessionDiskExpires=Date.now()+60_000;
    })().finally(() => {sessionDiskScan=null;});
  }
  if (sessionDiskScan) await sessionDiskScan;
  if (sessionDiskCount >= 5000 || sessionDiskBytes >= 1024*1024*1024) return false;
  sessionDiskCount++;return true;
}

function requestOrigin(req) {
  const host = req.headers.host;
  if (!host || /[\s\\/?#]/.test(host)) throw new Error('Invalid request host');
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = (trustedPeer(req) && forwardedProto === 'https') || req.socket.encrypted ? 'https:' : 'http:';
  return new URL(`${protocol}//${host}`);
}

function requestRole(req) {
  let origin;
  try { origin = requestOrigin(req).origin; }
  catch { return 'unknown'; }
  if (APP_ORIGIN && origin === APP_ORIGIN) return 'app';
  if (PROXY_ORIGIN && origin === PROXY_ORIGIN) return 'proxy';
  if (!production && !APP_ORIGIN && !PROXY_ORIGIN) return 'development';
  return 'unknown';
}

function proxyRouteAllowed(pathname) {
  if (rammerheadPaths.has(pathname)) return true;
  return pathname === '/proxy-viewer' || pathname === '/proxy-viewer.js' || pathname === '/proxy-viewer.css' ||
    pathname === '/aether-proxy-config.js' || pathname === '/rammerhead.js' || pathname === '/scramjet-sw.js' ||
    pathname === '/newsession' || pathname === '/wisp' || pathname.startsWith('/wisp/') ||
    pathname === '/bare' || pathname.startsWith('/bare/') || pathname.startsWith('/uv/') ||
    pathname.startsWith('/baremux/') || pathname.startsWith('/epoxy/') || pathname.startsWith('/epoxy-v3/') || pathname.startsWith('/scramjet/') ||
    pathname.startsWith('/controller/') || pathname.startsWith('/utils/') || pathname.startsWith('/libcurl/') ||
    pathname.startsWith('/service/') || pathname.startsWith('/service-sj/') || rammerheadSessionPath(pathname);
}

function proxyOnlyPath(pathname) {
  return pathname === '/proxy-viewer' || pathname === '/proxy-viewer.js' || pathname === '/proxy-viewer.css' || pathname === '/aether-proxy-config.js';
}

function isProxyEnginePath(pathname) {
  if (rammerheadPaths.has(pathname)) return true;
  return pathname === '/rammerhead.js' || pathname === '/scramjet-sw.js' || pathname === '/newsession' ||
    pathname === '/wisp' || pathname.startsWith('/wisp/') || pathname === '/bare' || pathname.startsWith('/bare/') ||
    pathname.startsWith('/uv/') || pathname.startsWith('/baremux/') || pathname.startsWith('/epoxy/') || pathname.startsWith('/epoxy-v3/') ||
    pathname.startsWith('/scramjet/') || pathname.startsWith('/controller/') || pathname.startsWith('/utils/') ||
    pathname.startsWith('/libcurl/') || pathname.startsWith('/service/') || pathname.startsWith('/service-sj/') ||
    rammerheadSessionPath(pathname);
}

function localHealthRequest(req, pathname) {
  const address = req.socket.remoteAddress || '';
  return pathname === '/health' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) &&
    ['localhost', '127.0.0.1', '[::1]'].includes(String(req.headers.host || '').split(':')[0].replace(/^\[|\]$/g, '').toLowerCase());
}

async function authorizeRequest(req, res) {
  let pathname;
  try { pathname = new URL(req.url || '/', 'http://localhost').pathname; }
  catch { res.statusCode = 400; res.end(); return false; }
  if (localHealthRequest(req, pathname)) return true;
  const role = requestRole(req);
  if (role === 'unknown') { res.statusCode = 421; res.end('Unknown Aether origin'); return false; }
  if (role === 'proxy' && !proxyRouteAllowed(pathname)) { res.statusCode = 404; res.end(); return false; }
  if (role === 'app' && PROXY_ORIGIN && (isProxyEnginePath(pathname) || proxyOnlyPath(pathname))) { res.statusCode = 404; res.end(); return false; }
  if (ACCESS_ENABLED) {
    const audience = role === 'proxy' ? PROXY_ACCESS_AUDIENCE : role === 'app' ? APP_ACCESS_AUDIENCE : '';
    const assertion = req.headers['cf-access-jwt-assertion'];
    if (!await verifyAccessAssertion(assertion, { teamDomain: ACCESS_TEAM_DOMAIN, audience })) {
      res.statusCode = 401; res.setHeader('Cache-Control', 'no-store'); res.end('Cloudflare Access authorization required'); return false;
    }
  }
  if (!req.aetherRateChecked) {
    const ip=clientIP(req);
    let allowed=requestLimits.take(ip) && globalRequests.take('all');
    if (pathname === '/newsession') allowed=allowed && sessionLimits.take(ip) && globalSessions.take('all');
    if (pathname === '/newsession' && allowed && !await roomForRammerheadSession()) {
      res.statusCode=503;res.end('Proxy session storage is full. Try again later.');return false;
    }
    if (pathname === '/editsession' && new URL(req.url,'http://localhost').searchParams.has('httpProxy')) {
      res.statusCode=403;res.end('External proxy chaining is disabled');return false;
    }
    if (!allowed) { res.statusCode=429;res.setHeader('Retry-After','10');res.end('Request limit reached. Try again shortly.');return false; }
    req.aetherRateChecked=true;
  }
  return true;
}

function isSameOrigin(req) {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).origin === requestOrigin(req).origin; }
  catch { return false; }
}

rammerheadConfig.getServerInfo = (req) => {
  const origin = requestOrigin(req);
  const port = Number(origin.port) || (origin.protocol === 'https:' ? 443 : 80);

  return {
    hostname: origin.hostname,
    port,
    crossDomainPort: port,
    protocol: origin.protocol
  };
};
const rammerheadPaths=new Set(['/rammerhead.js','/hammerhead.js','/transport-worker.js','/task.js','/iframe-task.js','/worker-hammerhead.js','/messaging','/sessionexists','/deletesession','/newsession','/editsession','/needpassword','/syncLocalStorage','/api/shuffleDict','/mainport']);
rammerheadConfig.getIP = clientIP;
rammerheadConfig.getIPProxy = clientIP;
if (require('testcafe-hammerhead/package.json').version !== '31.7.8') throw new Error('Review the destination guard before upgrading Hammerhead');
installRammerheadGuard(require('testcafe-hammerhead/lib/request-pipeline/destination-request'),destinations);
Object.assign(wisp.options, {
  port_whitelist:[80,443],allow_direct_ip:false,allow_private_ips:false,allow_loopback_ips:false,
  allow_udp_streams:false,stream_limit_per_host:16,stream_limit_total:64,dns_ttl:0,
  dns_method:async host => (await destinations.addresses(host))[0].address,parse_real_ip:false,
});

// Rammerhead's default disk rewrite cache performs synchronous file I/O.
// Keep only a bounded cache of rewritten scripts; session persistence is unaffected.
const rewriteCache = new Map();
let rewriteCacheBytes = 0;
const rewriteCacheLimit = 32 * 1024 * 1024;
rammerheadConfig.jsCache = {
  get(key) {
    const entry = rewriteCache.get(key);
    if (!entry) return undefined;
    rewriteCache.delete(key);
    rewriteCache.set(key, entry);
    return entry.value;
  },
  set(key, value) {
    const previous = rewriteCache.get(key);
    if (previous) { rewriteCacheBytes -= previous.bytes; rewriteCache.delete(key); }
    const bytes = Buffer.byteLength(value);
    if (bytes > rewriteCacheLimit) return;
    rewriteCache.set(key, { value, bytes });
    rewriteCacheBytes += bytes;
    while (rewriteCacheBytes > rewriteCacheLimit || rewriteCache.size > 2_000) {
      const oldest = rewriteCache.keys().next().value;
      rewriteCacheBytes -= rewriteCache.get(oldest).bytes;
      rewriteCache.delete(oldest);
    }
  },
};

const gamesData = JSON.parse(readFileSync(join(__dirname, 'data', 'games.json'), 'utf-8'));
const catalogJSON = Buffer.from(JSON.stringify(gamesData));
const catalogETag = `W/"catalog-${createHash('sha256').update(catalogJSON).digest('hex').slice(0, 24)}"`;
const catalogBodies = {
  identity: catalogJSON,
  gzip: gzipSync(catalogJSON, { level: 6 }),
  br: brotliCompressSync(catalogJSON, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } }),
};
const catalogArtwork = new Set();
for (const item of [...(gamesData.games || []), ...(gamesData.apps || [])]) {
  if (typeof item.logo !== 'string' || !/^https?:\/\//i.test(item.logo)) continue;
  try {
    const url = new URL(item.logo);
    if (url.username || url.password) continue;
    url.hash = '';
    catalogArtwork.add(url.href);
  } catch {}
}
// RH writes destination headers outside Express. Its document responses need
// compatible COEP when nested in the isolated proxy viewer.
rammerheadConfig.rewriteServerHeaders['cross-origin-embedder-policy'] = () => 'require-corp';
const rammerheadServer = rammerhead.createRammerhead({
  logLevel: process.env.RAMMERHEAD_LOG_LEVEL || 'warn',
  reverseProxy: true,
  disableHttp2: true,
});

// ═══════════════ USER STORAGE ═══════════════
const userFile = (uuid) => join(USERS_DIR, `${uuid}.json`);
const USER_CACHE_TTL = 30_000;
const MAX_PROFILE_BYTES = 8 * 1024 * 1024;
const MAX_SAVE_BYTES = 2 * 1024 * 1024;
const MAX_SAVE_KEYS = 2_000;
const userCache = new Map();
const userReads = new Map();
const userWrites = new Map();
let userCacheBytes = 0;
const profileSizes=new Map();let profileStorageBytes=0;
for (const filename of await readdir(USERS_DIR)) {
  if (!validUUID(filename.replace(/\.json$/,'')) || !filename.endsWith('.json')) continue;
  const info=await stat(join(USERS_DIR,filename));profileSizes.set(filename.slice(0,-5),info.size);profileStorageBytes+=info.size;
}
let storageQueue=Promise.resolve();

function apiError(status, message) {
  return Object.assign(new Error(message), { status, expose: true });
}
const newUser = (uuid) => ({ uuid, version: 2, created: new Date().toISOString(), saves: {} });
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isSaveKey = (key) => typeof key === 'string' && key.length > 0 && key.length <= 256 &&
  !/[\u0000-\u001f\u007f]/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key);

function cacheUser(user, bytes) {
  const prior = userCache.get(user.uuid);
  if (prior) { userCacheBytes -= prior.bytes; userCache.delete(user.uuid); }
  userCache.set(user.uuid, { user: structuredClone(user), bytes, expires: Date.now() + USER_CACHE_TTL });
  userCacheBytes += bytes;
  while (userCache.size > 128 || userCacheBytes > 16 * 1024 * 1024) {
    const first = userCache.keys().next().value;
    userCacheBytes -= userCache.get(first).bytes;
    userCache.delete(first);
  }
}

async function readUser(uuid) {
  const cached = userCache.get(uuid);
  if (cached && cached.expires > Date.now()) {
    userCache.delete(uuid);
    userCache.set(uuid, cached);
    return structuredClone(cached.user);
  }
  if (!userReads.has(uuid)) {
    const read = (async () => {
      try {
        const info = await stat(userFile(uuid));
        if (info.size > MAX_PROFILE_BYTES) throw apiError(413, 'Profile exceeds the 8 MiB storage limit');
        const json = await readFile(userFile(uuid), 'utf-8');
        const user = JSON.parse(json);
        if (!isRecord(user) || !isRecord(user.saves)) throw new Error('Invalid profile structure');
        // The validated filename is authoritative. Preserve existing metadata and save formats.
        user.uuid = uuid;
        cacheUser(user, Buffer.byteLength(json));
        return user;
      } catch (error) {
        if (error.code === 'ENOENT') return newUser(uuid);
        if (error.expose) throw error;
        console.error('[userdata] Unable to read a profile:', error.code || error.message);
        throw apiError(503, 'Profile storage could not be read. Restore the profile backup before saving.');
      }
    })();
    userReads.set(uuid, read);
    read.finally(() => userReads.delete(uuid)).catch(() => {});
  }
  return structuredClone(await userReads.get(uuid));
}

function withUserLock(uuid, action) {
  const previous = userWrites.get(uuid) || Promise.resolve();
  const operation = previous.catch(() => {}).then(action);
  userWrites.set(uuid, operation);
  operation.finally(() => {
    if (userWrites.get(uuid) === operation) userWrites.delete(uuid);
  }).catch(() => {});
  return operation;
}

async function loadUser(uuid) {
  if (userWrites.has(uuid)) await userWrites.get(uuid).catch(() => {});
  return readUser(uuid);
}

async function persistUserUnlocked(user) {
  if (Object.keys(user.saves).length > MAX_SAVE_KEYS) throw apiError(413, 'Profile exceeds the 2,000 save key limit');
  user.updated = new Date().toISOString();
  const json = JSON.stringify(user, null, 2);
  const bytes = Buffer.byteLength(json);
  if (bytes > MAX_PROFILE_BYTES) throw apiError(413, 'Profile exceeds the 8 MiB storage limit');
  const priorBytes=profileSizes.get(user.uuid) || 0;
  if ((!profileSizes.has(user.uuid) && profileSizes.size >= 10_000) || profileStorageBytes-priorBytes+bytes > 512*1024*1024) {
    throw apiError(507,'Profile storage is full. Existing saves remain intact.');
  }
  const temporary = `${userFile(user.uuid)}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, json, { encoding: 'utf-8', mode: 0o600 });
    await rename(temporary, userFile(user.uuid));
    profileStorageBytes+=bytes-priorBytes;profileSizes.set(user.uuid,bytes);
    cacheUser(user, bytes);
    userCountCache.expires = 0;
  } catch (error) {
    await unlink(temporary).catch(() => {});
    console.error('[userdata] Unable to persist a profile:', error.code || error.message);
    throw apiError(503, 'Save could not be written. Please try again.');
  }
}
function persistUser(user) {
  const operation=storageQueue.catch(() => {}).then(() => persistUserUnlocked(user));
  storageQueue=operation;return operation;
}

async function updateUser(uuid, change) {
  return withUserLock(uuid, async () => {
    const user = await readUser(uuid);
    change(user);
    await persistUser(user);
    return user;
  });
}

function validateSave(key, value) {
  if (!isSaveKey(key)) throw apiError(400, 'Save key must contain 1 to 256 characters and cannot be reserved');
  if (value !== undefined && Buffer.byteLength(JSON.stringify(value)) > MAX_SAVE_BYTES) {
    throw apiError(413, 'A save value cannot exceed 2 MiB');
  }
}

const userCountCache = { count: 0, expires: 0, pending: null };
async function countUsers() {
  if (userCountCache.expires > Date.now()) return userCountCache.count;
  if (!userCountCache.pending) {
    userCountCache.pending = readdir(USERS_DIR).then(files => {
      userCountCache.count = files.filter(file => /^[0-9a-f-]{36}\.json$/i.test(file)).length;
      userCountCache.expires = Date.now() + 30_000;
      return userCountCache.count;
    }).finally(() => { userCountCache.pending = null; });
  }
  return userCountCache.pending;
}

function getCookie(req, name) {
  const c = req.headers.cookie;
  if (!c) return null;
  for (const part of c.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) {
      try { return decodeURIComponent(v.join('=')); }
      catch { return null; }
    }
  }
  return null;
}
const isUUID = validUUID;
function setProfileCookies(req,res,uid) {
  const secure=requestOrigin(req).protocol === 'https:';
  const options={maxAge:365*24*60*60*1000,httpOnly:true,sameSite:'strict',path:'/',secure};
  res.cookie(secure ? '__Host-aether_session' : 'aether_session',sessions.sign(uid),options);
  res.cookie('gp_uid',uid,options);
}

// Compress only local, text-like static files. Proxy response streams bypass Express.
const assetCache = new Map();
const assetPending = new Map();
let assetCacheBytes = 0;
function cacheAsset(key, value) {
  if (assetCache.has(key)) assetCacheBytes -= assetCache.get(key).body.length;
  assetCache.delete(key);
  assetCache.set(key, value);
  assetCacheBytes += value.body.length;
  while (assetCache.size > 96 || assetCacheBytes > 16 * 1024 * 1024) {
    const oldest = assetCache.keys().next().value;
    assetCacheBytes -= assetCache.get(oldest).body.length;
    assetCache.delete(oldest);
  }
}
function assetPolicy(req, filename) {
  const path = req.path.toLowerCase();
  const worker = /(?:^|\/)(?:sw|.*[-.]sw|.*\.worker)\.js$/.test(path) || path === '/scramjet-sw.js';
  if (extname(filename).toLowerCase() === '.html' || worker || ['/proxy-viewer.js','/proxy-viewer.css'].includes(path)) return 'no-cache';
  if (isProxyEnginePath(path) && req.query.v !== VERSION) return 'no-cache';
  if (req.query.v === VERSION) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600, stale-while-revalidate=86400';
}
function staticFiles(root) {
  const absoluteRoot = resolve(root);
  const fallback = express.static(absoluteRoot, {
    setHeaders(res, filename) {
      res.setHeader('Cache-Control', assetPolicy(res.req, filename));
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    },
  });
  return async (req, res, next) => {
    const encoding = req.acceptsEncodings('br', 'gzip', 'identity');
    if (!['GET', 'HEAD'].includes(req.method) || req.headers.range || !['br', 'gzip'].includes(encoding) ||
        !/\.(?:m?js|css|svg|json|wasm)$/i.test(req.path)) return fallback(req, res, next);
    try {
      const filename = resolve(absoluteRoot, `.${sep}${decodeURIComponent(req.path)}`);
      if (!filename.startsWith(absoluteRoot + sep)) return fallback(req, res, next);
      const info = await stat(filename);
      if (!info.isFile() || info.size < 512 || info.size > 8 * 1024 * 1024) return fallback(req, res, next);
      const key = `${filename}:${encoding}`;
      const signature = `${info.size}:${info.mtimeMs}`;
      let asset = assetCache.get(key);
      if (!asset || asset.signature !== signature) {
        const pendingKey = `${key}:${signature}`;
        if (!assetPending.has(pendingKey)) {
          const pending = (async () => {
            const source = await readFile(filename);
            const body = encoding === 'br'
              ? await brotliAsync(source, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } })
              : await gzipAsync(source, { level: 6 });
            const item = { body, signature, etag: `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}-${encoding}"` };
            cacheAsset(key, item);
            return item;
          })();
          assetPending.set(pendingKey, pending);
          pending.finally(() => assetPending.delete(pendingKey)).catch(() => {});
        }
        asset = await assetPending.get(pendingKey);
      } else {
        assetCache.delete(key);
        assetCache.set(key, asset);
      }
      res.vary('Accept-Encoding');
      res.type(extname(filename));
      res.set({
        'Content-Encoding': encoding,
        'Cache-Control': assetPolicy(req, filename),
        'ETag': asset.etag,
        'Last-Modified': info.mtime.toUTCString(),
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Content-Length': String(asset.body.length),
      });
      if (req.fresh) {
        res.removeHeader('Content-Length');
        return res.status(304).end();
      }
      if (req.method === 'HEAD') return res.end();
      return res.end(asset.body);
    } catch {
      // Let Express handle missing files, malformed paths, and disk errors normally.
      return fallback(req, res, next);
    }
  };
}

// Only catalog artwork is fetchable. This is deliberately separate from the browsing proxies.
const artworkCache = new Map();
const artworkJobs = new Map();
const artworkFailures = new Map();
const artworkQueue = [];
let artworkCacheBytes = 0;
let activeArtworkJobs = 0;
const MAX_ARTWORK_BYTES = 5 * 1024 * 1024;
const artworkTypes = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif',
  'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon',
]);

function isPublicArtworkAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && ((b === 168) || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && ((b === 18 || b === 19) || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (family === 6) {
    const [first, second = '0'] = address.toLowerCase().split(':');
    const a = parseInt(first, 16), b = parseInt(second || '0', 16);
    // Accept global unicast only, excluding special protocol, transition, and documentation ranges.
    return a >= 0x2000 && a <= 0x3ffe && a !== 0x2002 &&
      !(a === 0x2001 && (b < 0x200 || b === 0xdb8));
  }
  return false;
}

function artworkURL(value) {
  const url = new URL(value);
  const defaultPort = url.protocol === 'https:' ? '443' : '80';
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== defaultPort)) throw new Error('Artwork destination is not allowed');
  url.hash = '';
  return url;
}

function imageSignatureMatches(type, body) {
  if (body.length < 8) return false;
  if (type === 'image/png') return body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === 'image/jpeg') return body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  if (type === 'image/gif') return /^GIF8[79]a$/.test(body.subarray(0, 6).toString('ascii'));
  if (type === 'image/webp') return body.subarray(0, 4).toString('ascii') === 'RIFF' && body.subarray(8, 12).toString('ascii') === 'WEBP';
  if (type === 'image/avif') return body.subarray(4, 8).toString('ascii') === 'ftyp' && /avif|avis/.test(body.subarray(8, 32).toString('ascii'));
  if (type === 'image/svg+xml') {
    const text = body.toString('utf-8');
    return /<svg(?:\s|>)/i.test(text) && !/<!DOCTYPE|<!ENTITY/i.test(text);
  }
  return body[0] === 0 && body[1] === 0 && body[2] === 1 && body[3] === 0;
}

async function fetchArtwork(url, deadline, redirects = 0) {
  if (Date.now() >= deadline) throw new Error('Artwork request timed out');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let dnsTimeout;
  const addresses = await Promise.race([
    lookup(hostname, { all: true, verbatim: true }),
    new Promise((_resolve, reject) => {
      dnsTimeout = setTimeout(() => reject(new Error('Artwork DNS timed out')), Math.max(1, Math.min(5_000, deadline - Date.now())));
      dnsTimeout.unref();
    }),
  ]).finally(() => clearTimeout(dnsTimeout));
  if (!addresses.length || addresses.some(item => !isPublicArtworkAddress(item.address))) {
    throw new Error('Artwork destination must resolve only to public addresses');
  }
  if (Date.now() >= deadline) throw new Error('Artwork request timed out');
  const response = await new Promise((resolveRequest, rejectRequest) => {
    let timeout;
    const request = (url.protocol === 'https:' ? requestHTTPS : requestHTTP)(url, {
      agent: false,
      rejectUnauthorized: true,
      headers: { Accept: 'image/avif,image/webp,image/*', 'Accept-Encoding': 'identity', 'User-Agent': `Aether/${VERSION} catalog artwork` },
      // Pin the connection to this validated resolution; do not resolve a second time at connect.
      lookup(_hostname, options, callback) {
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      },
    }, upstream => {
      if ([301,302,303,307,308].includes(upstream.statusCode)) {
        const location = upstream.headers.location;
        upstream.destroy();
        clearTimeout(timeout);
        if (!location) return rejectRequest(new Error('Artwork redirect has no destination'));
        return resolveRequest({ redirect: new URL(location, url) });
      }
      const type = String(upstream.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (upstream.statusCode !== 200 || !artworkTypes.has(type) || Number(upstream.headers['content-length']) > MAX_ARTWORK_BYTES) {
        upstream.destroy();
        clearTimeout(timeout);
        return rejectRequest(new Error('Artwork response is not a supported bounded image'));
      }
      const encoding = String(upstream.headers['content-encoding'] || 'identity').trim().toLowerCase();
      const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : null;
      if (encoding !== 'identity' && !decoder) {
        upstream.destroy();
        clearTimeout(timeout);
        return rejectRequest(new Error('Unsupported artwork content encoding'));
      }
      const stream = decoder ? upstream.pipe(decoder) : upstream;
      const chunks = [];
      let received = 0;
      const fail = error => {
        clearTimeout(timeout);
        upstream.destroy();
        if (decoder) decoder.destroy();
        rejectRequest(error);
      };
      upstream.on('error', fail);
      upstream.on('aborted', () => fail(new Error('Artwork response was interrupted')));
      if (decoder) decoder.on('error', fail);
      stream.on('data', chunk => {
        received += chunk.length;
        if (received > MAX_ARTWORK_BYTES) return fail(new Error('Artwork exceeds the 5 MiB limit'));
        chunks.push(chunk);
      });
      stream.on('end', () => {
        clearTimeout(timeout);
        const body = Buffer.concat(chunks);
        if (!imageSignatureMatches(type, body)) return rejectRequest(new Error('Artwork MIME and signature disagree'));
        resolveRequest({ body, type });
      });
    });
    request.on('error', error => { clearTimeout(timeout); rejectRequest(error); });
    timeout = setTimeout(() => request.destroy(new Error('Artwork request timed out')), Math.max(1, deadline - Date.now()));
    timeout.unref();
    request.end();
  });
  if (!response.redirect) return response;
  if (redirects >= 3) throw new Error('Artwork redirected too many times');
  const nextURL = artworkURL(response.redirect.href);
  if (url.protocol === 'https:' && nextURL.protocol !== 'https:') throw new Error('Artwork cannot redirect from HTTPS to HTTP');
  return fetchArtwork(nextURL, deadline, redirects + 1);
}

function pumpArtworkQueue() {
  while (activeArtworkJobs < 8 && artworkQueue.length) {
    const job = artworkQueue.shift();
    activeArtworkJobs++;
    fetchArtwork(artworkURL(job.url), job.deadline).then(item => {
      item.expires = Date.now() + 24 * 60 * 60 * 1000;
      item.etag = `"artwork-${createHash('sha256').update(item.type).update(item.body).digest('hex').slice(0, 24)}"`;
      const previous = artworkCache.get(job.url);
      if (previous) { artworkCacheBytes -= previous.body.length; artworkCache.delete(job.url); }
      artworkCache.set(job.url, item);
      artworkCacheBytes += item.body.length;
      while (artworkCache.size > 256 || artworkCacheBytes > 32 * 1024 * 1024) {
        const oldest = artworkCache.keys().next().value;
        artworkCacheBytes -= artworkCache.get(oldest).body.length;
        artworkCache.delete(oldest);
      }
      job.resolve(item);
    }, () => {
      artworkFailures.delete(job.url);
      artworkFailures.set(job.url, Date.now() + 60_000);
      while (artworkFailures.size > 256) artworkFailures.delete(artworkFailures.keys().next().value);
      job.reject(apiError(502, 'Catalog artwork is temporarily unavailable'));
    }).finally(() => {
      activeArtworkJobs--;
      artworkJobs.delete(job.url);
      pumpArtworkQueue();
    });
  }
}

function loadArtwork(url) {
  const cached = artworkCache.get(url);
  if (cached && cached.expires > Date.now()) {
    artworkCache.delete(url);
    artworkCache.set(url, cached);
    return Promise.resolve(cached);
  }
  if ((artworkFailures.get(url) || 0) > Date.now()) {
    return Promise.reject(apiError(502, 'Catalog artwork is temporarily unavailable'));
  }
  artworkFailures.delete(url);
  if (artworkJobs.has(url)) return artworkJobs.get(url);
  if (artworkJobs.size >= 64) return Promise.reject(apiError(503, 'Artwork queue is busy. Please retry shortly.'));
  const job = new Promise((resolveJob, rejectJob) => artworkQueue.push({ url, deadline: Date.now() + 15_000, resolve: resolveJob, reject: rejectJob }));
  artworkJobs.set(url, job);
  pumpArtworkQueue();
  return job;
}

// ═══════════════ EXPRESS ═══════════════
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  if (localHealthRequest(req, req.path)) return next();
  const role = requestRole(req);
  if (role === 'unknown') return res.status(421).send('Unknown Aether origin');
  if (role === 'proxy' && !proxyRouteAllowed(req.path)) return res.sendStatus(404);
  if (role === 'app' && PROXY_ORIGIN && (isProxyEnginePath(req.path) || proxyOnlyPath(req.path))) return res.sendStatus(404);
  next();
});
app.get('/aether-config.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.type('application/javascript').send(`window.AETHER_CONFIG=${JSON.stringify({ appOrigin: APP_ORIGIN, proxyOrigin: PROXY_ORIGIN, version: VERSION, accessEnabled:ACCESS_ENABLED })};`);
});
app.get('/proxy-viewer', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // This route returns before the generic document middleware. Its outer
  // iframe must keep Access cookies while the isolated app embeds it.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', `frame-ancestors ${APP_ORIGIN || "'self'"}`);
  res.sendFile(join(__dirname, 'public', 'proxy-viewer.html'));
});
app.get('/aether-proxy-config.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const origin = PROXY_ORIGIN || requestOrigin(req).origin;
  res.type('application/javascript').send(`window.AETHER_PROXY_CONFIG=${JSON.stringify({ appOrigin: APP_ORIGIN || origin, proxyOrigin: origin, version: VERSION })};`);
});
app.use((req, res, next) => {
  // SharedArrayBuffer transports need isolation on the shell and its own assets.
  // API JSON and health responses do not need document isolation headers.
  if (!req.path.startsWith('/api/') && req.path !== '/health') {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    if (PROXY_ORIGIN && requestRole(req) === 'app') {
      res.setHeader('Permissions-Policy', `cross-origin-isolated=(self "${PROXY_ORIGIN}")`);
    }
  }
  if (req.path === '/uv/sw.js') res.setHeader('Service-Worker-Allowed', '/');
  next();
});

app.use((req, res, next) => {
  const usesProfile = req.path.startsWith('/api/') && !['/api/games', '/api/rooms', '/api/artwork'].includes(req.path);
  if (!usesProfile) return next();
  const secure=requestOrigin(req).protocol === 'https:';
  const signed=getCookie(req,secure ? '__Host-aether_session' : 'aether_session');
  let uid=sessions.verify(signed);
  if (!uid && !signed) {
    const legacy=getCookie(req,'gp_uid');
    if (isUUID(legacy) && profileSizes.has(legacy)) uid=legacy;
  }
  if (!uid) {
    if (!profileLimits.take(clientIP(req))) return res.status(429).json({error:'Profile creation limit reached. Try again shortly.'});
    uid=randomUUID();
  }
  if (!signed || !sessions.verify(signed)) setProfileCookies(req,res,uid);
  req.uid = uid;
  next();
});

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isSameOrigin(req)) return res.status(403).json({ error: 'API requests must come from this Aether origin' });
  if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({error:'Cross-site API requests are blocked'});
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    if (req.headers['x-aether-request'] !== '1') return res.status(403).json({error:'Aether request header is required'});
    if (!writeLimits.take(clientIP(req)) || (req.path === '/import' && !importLimits.take(clientIP(req)))) return res.status(429).json({error:'Save request limit reached. Try again shortly.'});
  }
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.vary('Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Aether-Request');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}, express.json({ limit: '9mb' }));

app.use(staticFiles(join(__dirname, 'public')));

// ═══════════════ API: GAMES ═══════════════
app.get('/api/games', (req, res) => {
  const encoding = req.acceptsEncodings('br', 'gzip', 'identity') || 'identity';
  const body = catalogBodies[encoding] || catalogBodies.identity;
  res.vary('Accept-Encoding');
  res.type('application/json');
  res.set({ 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600', 'ETag': catalogETag });
  if (encoding !== 'identity') res.setHeader('Content-Encoding', encoding);
  if (req.fresh) return res.status(304).end();
  return res.send(body);
});

// ═══════════════ API: USER + SAVES ═══════════════
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
function requestedUID(value, fallback) {
  if (value !== undefined && !isUUID(value)) throw apiError(400, 'Invalid profile UUID');
  if (value && value !== fallback) throw apiError(403,'This request cannot access another profile. Use your private recovery key to restore it.');
  return fallback;
}

app.get('/api/artwork', asyncRoute(async (req, res) => {
  if (typeof req.query.url !== 'string' || req.query.url.length > 4_096) {
    throw apiError(400, 'Catalog artwork URL is required');
  }
  let url;
  try { url = artworkURL(req.query.url).href; }
  catch { throw apiError(400, 'Invalid catalog artwork URL'); }
  if (!catalogArtwork.has(url)) throw apiError(404, 'Artwork is not present in the Aether catalog');
  const image = await loadArtwork(url);
  res.type(image.type);
  res.set({
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'ETag': image.etag,
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'",
  });
  if (req.fresh) return res.status(304).end();
  return res.send(image.body);
}));

app.get('/api/user', asyncRoute(async (req, res) => {
  const uid = requestedUID(req.query.uid, req.uid);
  const u = await loadUser(uid);
  const keys = Object.keys(u.saves);
  const saveCount = keys.filter(key => !key.startsWith('__meta__')).length;
  res.json({
    uuid: u.uuid, created: u.created, updated: u.updated, saves: u.saves,
    saveCount, metadataCount: keys.length - saveCount,
  });
}));

app.post('/api/save', asyncRoute(async (req, res) => {
  const uid = requestedUID(req.body?.uid, req.uid);
  const { key, value } = req.body || {};
  validateSave(key, value);
  await updateUser(uid, user => {
    if (value === null || value === undefined) delete user.saves[key];
    else user.saves[key] = value;
  });
  res.json({ ok: true, uuid: uid });
}));

app.post('/api/save-batch', asyncRoute(async (req, res) => {
  const uid = requestedUID(req.body?.uid, req.uid);
  const saves = req.body?.saves;
  if (!isRecord(saves)) throw apiError(400, 'saves must be an object');
  const entries = Object.entries(saves);
  if (entries.length > MAX_SAVE_KEYS) throw apiError(413, 'A batch cannot exceed 2,000 save keys');
  entries.forEach(([key, value]) => validateSave(key, value));
  await updateUser(uid, user => {
    for (const [key, value] of entries) user.saves[key] = value;
  });
  res.json({ ok: true, uuid: uid, count: Object.keys(saves).length });
}));

app.get('/api/load/:key', asyncRoute(async (req, res) => {
  validateSave(req.params.key);
  const uid = requestedUID(req.query.uid, req.uid);
  const u = await loadUser(uid);
  res.json({ value: Object.hasOwn(u.saves, req.params.key) ? u.saves[req.params.key] : null });
}));

app.delete('/api/save/:key', asyncRoute(async (req, res) => {
  validateSave(req.params.key);
  await updateUser(req.uid, user => { delete user.saves[req.params.key]; });
  res.json({ ok: true });
}));

app.get('/api/saves-by-game', asyncRoute(async (req, res) => {
  const u = await loadUser(req.uid);
  const groups = Object.create(null);
  for (const [k, v] of Object.entries(u.saves)) {
    if (k.startsWith('__meta__')) continue;
    const host = k.includes(':') ? k.split(':')[0] : '_other';
    (groups[host] ||= Object.create(null))[k] = v;
  }
  res.json({ groups });
}));

app.delete('/api/saves-by-game/:host', asyncRoute(async (req, res) => {
  const host = req.params.host;
  if (!host || host.length > 256 || /[\u0000-\u001f\u007f]/.test(host)) throw apiError(400, 'Invalid save group');
  await updateUser(req.uid, user => {
    for (const key of Object.keys(user.saves)) {
      if (key.startsWith('__meta__')) continue;
      if (host === '_other' ? !key.includes(':') : key.startsWith(host + ':')) delete user.saves[key];
    }
  });
  res.json({ ok: true });
}));

app.delete('/api/user', asyncRoute(async (req, res) => {
  await updateUser(req.uid, user => { user.saves = {}; });
  res.json({ ok: true });
}));

app.post('/api/import', asyncRoute(async (req, res) => {
  const target = req.body?.uuid;
  if (!isUUID(target)) throw apiError(400, 'Invalid profile UUID');
  await withUserLock(target, async () => {
    if (!profileSizes.has(target)) throw apiError(404,'Profile recovery key was not found');
    await readUser(target);
  });
  setProfileCookies(req,res,target);
  res.json({ ok: true, uuid: target });
}));

// ═══════════════ API: ROOMS ═══════════════
const rooms = new Map();

app.get('/api/rooms', (_req, res) => {
  const list = [];
  for (const [code, room] of rooms) {
    list.push({
      code,
      members: room.members.size,
      created: room.created,
      name: room.name || 'Room',
    });
  }
  list.sort((a, b) => b.created - a.created);
  res.json({ rooms: list.slice(0, 50) });
});

app.get('/health', asyncRoute(async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json({ ok: true, version: VERSION, users: await countUsers(), rooms: rooms.size }); }
  catch { res.status(503).json({ ok: false, error: 'Profile storage is unavailable', rooms: rooms.size }); }
}));

// ═══════════════ PROXIES ═══════════════
const bare = createBareServer('/bare/',{
  filterRemote:async url => { await destinations.validate(url); },lookup:destinations.nodeLookup,
  connectionLimiter:{maxConnectionsPerIP:64,windowDuration:60,blockDuration:60},
});
const wispWSS=new WebSocketServer({noServer:true,maxPayload:1024*1024,perMessageDeflate:false});
app.use('/uv/', (req, res, next) => {
  if (req.path === '/sw.js') res.setHeader('Service-Worker-Allowed', '/');
  next();
}, staticFiles(join(__dirname, 'public', 'uv')));
app.use('/uv/', staticFiles(uvPath));
app.use('/baremux/', staticFiles(baremuxPath));
app.use('/epoxy/', staticFiles(epoxyPath));
app.use('/epoxy-v3/', staticFiles(epoxyV3Path));
app.use('/scramjet/', staticFiles(scramjetPath));
app.use('/controller/', staticFiles(controllerPath));
app.use('/utils/', staticFiles(scramjetUtilsPath));
app.use('/libcurl/', staticFiles(libcurlPath));
app.get('/rammerhead.js', (req, res) => {
  const accepted = req.acceptsEncodings('br', 'gzip', 'identity');
  const encoding = ['br','gzip'].includes(accepted) ? accepted : 'identity';
  const body = rammerheadClientBodies[encoding];
  res.vary('Accept-Encoding');
  res.type('application/javascript');
  res.set({
    'Cache-Control': 'no-cache',
    'ETag': `W/"rh-storage-v1-${rammerheadClientDigest}-${encoding}"`,
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Length': String(body.length),
  });
  if (encoding !== 'identity') res.setHeader('Content-Encoding', encoding);
  if (req.fresh) { res.removeHeader('Content-Length'); return res.status(304).end(); }
  if (req.method === 'HEAD') return res.end();
  return res.end(body);
});
app.get('/scramjet-sw.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Service-Worker-Allowed', '/');
  res.type('application/javascript').send(`
    importScripts('/controller/controller.sw.js?v=${VERSION}');
    addEventListener('fetch', event => {
      if ($scramjetController.shouldRoute(event)) {
        event.respondWith($scramjetController.route(event));
      }
    });
  `);
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route' }));
app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number(error.status) || 500;
  let message = error.expose ? error.message : 'The request could not be completed';
  if (error.type === 'entity.too.large') message = 'Request body exceeds the 9 MiB limit';
  if (error.type === 'entity.parse.failed') message = 'Request body must contain valid JSON';
  if (status >= 500 && !error.expose) console.error('[request]', error.code || error.message);
  res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
});

// ═══════════════ HTTP SERVER ═══════════════
const server = createServer((req, res) => {
  void (async () => {
    if (!await authorizeRequest(req, res)) return;
    if (isProxyEnginePath(new URL(req.url,'http://localhost').pathname)) boundProxyResponse(req,res);
    if (['GET','HEAD'].includes(req.method) && req.url.split('?')[0] === '/rammerhead.js') return app(req, res);
    if (bare.shouldRoute(req)) return bare.routeRequest(req, res);
    if (rammerhead.shouldRouteRh(req)) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      return rammerhead.routeRhRequest(rammerheadServer, req, res);
    }
    app(req, res);
  })().catch(error => {
    console.error('[request gate]', error.message);
    if (!res.headersSent) res.statusCode = 503;
    res.end('Aether request could not be authorized');
  });
});

// ═══════════════ WEBSOCKET ROOMS ═══════════════
function genRoomCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(out) ? genRoomCode() : out;
}

function memberList(room) {
  return [...room.members.values()].map(m => m.name);
}
function send(ws, obj) {
  return sendRaw(ws, JSON.stringify(obj));
}
function sendRaw(ws, raw) {
  if (ws.readyState !== 1) return false;
  if (ws.bufferedAmount > 512 * 1024) {
    ws.close(1013, 'Connection cannot keep up with room updates');
    return false;
  }
  try { ws.send(raw, error => { if (error) ws.terminate(); }); return true; }
  catch { ws.terminate(); return false; }
}
function broadcast(room, obj, except) {
  const raw = JSON.stringify(obj);
  for (const ws of room.members.keys()) {
    if (ws !== except) sendRaw(ws, raw);
  }
}
function leaveRoom(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) { ws.roomCode = null; return; }
  room.members.delete(ws);
  broadcast(room, { type: 'member-left', name: ws.userName, members: memberList(room) });
  if (room.members.size === 0) {
    const code = ws.roomCode;
    clearTimeout(room.emptyTimer);
    rooms.delete(code);
  }
  ws.roomCode = null;
}

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024, perMessageDeflate: false });

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.userName = 'Guest';
  ws.isAlive = true;
  ws.messageWindow = Date.now();
  ws.messageCount = 0;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    const now = Date.now();
    if (now - ws.messageWindow > 10_000) {
      ws.messageWindow = now;
      ws.messageCount = 0;
    }
    if (++ws.messageCount > 80) return ws.close(1008, 'Too many room messages');
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!isRecord(msg)) return;

    if (msg.type === 'join') {
      let code = typeof msg.room === 'string' ? msg.room.toUpperCase().trim() : '';
      if (code && !/^[A-Z0-9]{4,12}$/.test(code)) {
        return send(ws, { type: 'error', code: 'invalid-room', message: 'Room codes contain 4 to 12 letters or numbers' });
      }
      if (!code) code = genRoomCode();

      let room = rooms.get(code);
      if (!room && rooms.size >= 250) {
        return send(ws, { type: 'error', code: 'rooms-full', message: 'Room capacity reached. Try an existing room.' });
      }
      if (room && room.members.size >= 32 && !room.members.has(ws)) {
        return send(ws, { type: 'error', code: 'room-full', message: 'This room has reached 32 members' });
      }
      if (ws.roomCode) leaveRoom(ws);
      if (!room) {
        room = {
          members: new Map(),
          state: null,
          history: [],
          created: Date.now(),
          name: typeof msg.name === 'string' ? msg.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40) || 'Room' : 'Room',
          emptyTimer: null,
        };
        rooms.set(code, room);
      }
      clearTimeout(room.emptyTimer);
      room.emptyTimer = null;

      ws.roomCode = code;
      ws.userName = (typeof msg.userName === 'string' ? msg.userName : 'Guest').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || 'Guest';
      room.members.set(ws, { name: ws.userName, joined: Date.now() });

      send(ws, {
        type: 'joined',
        code,
        state: room.state,
        history: room.history,
        members: memberList(room),
        you: ws.userName,
      });
      broadcast(room, { type: 'members', members: memberList(room) }, ws);
    }

    else if (msg.type === 'state') {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      if (!isRecord(msg.state) || Buffer.byteLength(JSON.stringify(msg.state)) > 128 * 1024) {
        return send(ws, { type: 'error', code: 'invalid-state', message: 'Shared state must be an object smaller than 128 KiB' });
      }
      room.state = msg.state;
      broadcast(room, { type: 'state', state: room.state, from: ws.userName }, ws);
      send(ws, { type: 'state-published', at: Date.now() });
    }

    else if (msg.type === 'chat') {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      const text = typeof msg.text === 'string' ? msg.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, 500) : '';
      if (!text.trim()) return;
      const entry = { from: ws.userName, text, at: Date.now() };
      room.history.push(entry);
      if (room.history.length > 100) room.history.shift();
      broadcast(room, { type: 'chat', entry });
    }

    else if (msg.type === 'ping') {
      send(ws, { type: 'pong', t: Date.now() });
    }
  });

  ws.on('close', () => { if (ws.roomCode) leaveRoom(ws); });
  ws.on('error', () => {});
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 30_000).unref();

server.on('upgrade', (req, socket, head) => {
  const gateResponse = {
    statusCode: 200,
    setHeader() {},
    end(body = '') {
      const reason = ({400:'Bad Request',404:'Not Found',401:'Unauthorized',421:'Misdirected Request',503:'Service Unavailable'})[this.statusCode] || 'Forbidden';
      const payload = Buffer.from(String(body));
      socket.write(`HTTP/1.1 ${this.statusCode} ${reason}\r\nConnection: close\r\nContent-Length: ${payload.length}\r\n\r\n`);
      if (payload.length) socket.write(payload);
      socket.destroy();
    },
  };
  void authorizeRequest(req, gateResponse).then(allowed => {
    if (!allowed) return;
    const ip=clientIP(req);
    if (!upgradeLimits.take(ip) || (proxyConnections.get(ip) || 0) >= 16 || proxyConnectionCount >= 256) {
      gateResponse.statusCode=429;gateResponse.end('Connection limit reached');return;
    }
    proxyConnections.set(ip,(proxyConnections.get(ip) || 0)+1);proxyConnectionCount++;
    socket.on('data',chunk => {if(!inboundBytes.take(ip,chunk.length))socket.destroy();});
    const write=socket.write;socket.write=function(chunk,encoding,...args) {
      if(!countOutbound(ip,chunk,encoding)){socket.destroy();return false;}return write.call(this,chunk,encoding,...args);
    };
    const lifetime=setTimeout(() => socket.destroy(),60*60*1000);lifetime.unref();socket.setTimeout(5*60*1000,() => socket.destroy());
    socket.once('close',() => {clearTimeout(lifetime);proxyConnectionCount--;const count=proxyConnections.get(ip)-1;if(count)proxyConnections.set(ip,count);else proxyConnections.delete(ip);});
    if (req.url && req.url.startsWith('/wisp/')) {
      if (req.url !== '/wisp/' || !isSameOrigin(req)) return socket.destroy();
      return wispWSS.handleUpgrade(req,socket,head,async ws => {
        ws.binaryType='arraybuffer';
        try { const connection=new wisp.ServerConnection(ws,'/wisp/',{wisp_version:req.headers['sec-websocket-protocol'] ? 2 : 1});await connection.setup();await connection.run(); }
        catch { ws.close(); }
      });
    }
    if (bare.shouldRoute(req)) return bare.routeUpgrade(req, socket, head);
    if (rammerhead.shouldRouteRh(req)) return rammerhead.routeRhUpgrade(rammerheadServer, req, socket, head);
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { return socket.destroy(); }
    if (pathname === '/ws') {
      if (!isSameOrigin(req) || wss.clients.size >= 500) {
        socket.write(`HTTP/1.1 ${isSameOrigin(req) ? '503 Service Unavailable' : '403 Forbidden'}\r\nConnection: close\r\n\r\n`);
        return socket.destroy();
      }
      return wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    }
    socket.end();
  }).catch(error => {
    console.error('[upgrade gate]', error.message);
    if (!socket.destroyed) socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
  });
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Aether v${VERSION} on :${PORT}`);
  console.log(`   Ultraviolet   /uv/`);
  console.log(`   Rammerhead    /rammer/`);
  console.log(`   Bare          /bare/`);
  console.log(`   Multiplayer   /ws`);
  console.log(`   Users dir     ${USERS_DIR}`);
  console.log(`   Proxy sessions ${RAMMERHEAD_SESSIONS_DIR}`);
});

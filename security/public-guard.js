import { lookup as systemLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

const blocked = message => Object.assign(new Error(message), {code:'EAETHER_DESTINATION_BLOCKED'});
// Hammerhead adds window/resource/charset/origin descriptors to session IDs.
export const rammerheadSessionPath = pathname => /^\/[a-f0-9]{32}(?:\*[a-z0-9_-]{1,80})?(?:![^/?#\\\s]{0,600})?(?:\/|$)/i.test(pathname);
export function publicAddress(value) {
  if (!isIP(value)) return false;
  const address = ipaddr.parse(value);
  if (address.range() !== 'unicast') return false;
  if (address.kind() === 'ipv4') {
    const [a,b,c] = address.octets;
    return !(a === 192 && ((b === 0 && c === 0) || (b === 88 && c === 99)));
  }
  // Only ordinary global IPv6. Exclude transition and special-purpose blocks.
  return address.match(ipaddr.parse('2000::'),3) &&
    !address.match(ipaddr.parse('2002::'),16) &&
    !address.match(ipaddr.parse('2001::'),23) &&
    !address.match(ipaddr.parse('2001:db8::'),32) &&
    !address.match(ipaddr.parse('3fff::'),20);
}

export class PublicDestinations {
  constructor({lookup = systemLookup, excludedHosts = [], now = Date.now} = {}) {
    this.lookup = lookup; this.now = now; this.cache = new Map(); this.pending = new Map();
    this.excluded = new Set(excludedHosts.map(host => host.toLowerCase()));
  }
  hostname(value) {
    const host = String(value).replace(/^\[|\]$/g,'').toLowerCase().replace(/\.$/,'');
    if (!host || host.length > 253 || host.includes('%') || this.excluded.has(host) ||
        /(?:^|\.)(?:localhost|local|internal|home|lan|onion)$/.test(host) ||
        (!isIP(host) && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host))) {
      throw blocked('Destination hostname is not public');
    }
    if (isIP(host) && !publicAddress(host)) throw blocked('Private or reserved destinations are blocked');
    return host;
  }
  url(value) {
    let url; try { url = new URL(value); } catch { throw blocked('Invalid destination URL'); }
    if (!['http:','https:','ws:','wss:'].includes(url.protocol) || url.username || url.password ||
        ![80,443].includes(Number(url.port) || (['https:','wss:'].includes(url.protocol) ? 443 : 80))) {
      throw blocked('Only public web destinations on ports 80 and 443 are allowed');
    }
    this.hostname(url.hostname); return url;
  }
  async addresses(value) {
    const host = this.hostname(value);
    if (isIP(host)) return [{address:host,family:isIP(host)}];
    const cached = this.cache.get(host);
    if (cached && cached.expires > this.now()) return cached.addresses;
    if (this.pending.has(host)) return this.timed(this.pending.get(host));
    if (this.pending.size >= 64) throw blocked('Destination resolver is busy');
    const operation = (async () => {
      // Keep the pending slot until the OS lookup finishes, including after timeout.
      const records = await this.lookup(host,{all:true,verbatim:true});
      if (!records.length || records.length > 32 || records.some(record => !publicAddress(record.address))) {
        throw blocked('Destination resolves to a private or reserved address');
      }
      const addresses = records.map(({address,family}) => ({address,family}));
      this.cache.delete(host); this.cache.set(host,{addresses,expires:this.now()+30_000});
      while (this.cache.size > 512) this.cache.delete(this.cache.keys().next().value);
      return addresses;
    })();
    this.pending.set(host,operation);
    operation.finally(() => this.pending.delete(host)).catch(() => {});
    return this.timed(operation);
  }
  async timed(operation) {
    let timer;
    try { return await Promise.race([operation,new Promise((_,reject) => {
      timer = setTimeout(() => reject(blocked('Destination DNS timed out')),5_000);
    })]); } finally { clearTimeout(timer); }
  }
  callback(records) {
    return (_host, options, callback) => {
      if (typeof options === 'function') { callback = options; options = {}; }
      const family = typeof options === 'number' ? options : options?.family || 0;
      const selected = records.filter(record => !family || record.family === family);
      if (!selected.length) return callback(blocked('No public address for this IP family'));
      if (options?.all) callback(null,selected);
      else callback(null,selected[0].address,selected[0].family);
    };
  }
  nodeLookup = (host,options,callback) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    this.addresses(host).then(records => this.callback(records)(host,options,callback),callback);
  };
  async validate(value) { const url = this.url(value); return this.addresses(url.hostname); }
}

export class TokenBuckets {
  constructor({capacity,perSecond,maxKeys = 10_000,now = Date.now}) {
    this.capacity=capacity;this.perSecond=perSecond;this.maxKeys=maxKeys;this.now=now;this.entries=new Map();
  }
  take(key,amount = 1) {
    const now=this.now();let entry=this.entries.get(key);
    if (!entry && this.entries.size >= this.maxKeys) {
      for (const [oldKey,old] of this.entries) if (now-old.at > this.capacity/this.perSecond*1000) this.entries.delete(oldKey);
      if (this.entries.size >= this.maxKeys) return false;
    }
    entry ||= {tokens:this.capacity,at:now};
    entry.tokens=Math.min(this.capacity,entry.tokens+Math.max(0,now-entry.at)/1000*this.perSecond);entry.at=now;
    this.entries.set(key,entry);
    if (entry.tokens < amount) return false;
    entry.tokens-=amount;return true;
  }
}

export function installRammerheadGuard(DestinationRequest,destinations) {
  const original=DestinationRequest.prototype._send;
  if (typeof original !== 'function') throw new Error('Rammerhead destination adapter changed');
  DestinationRequest.prototype._send=async function(...args) {
    try {
      if (this.opts.proxy) throw blocked('External proxy chaining is disabled');
      const url=destinations.url(this.opts.url);
      if (destinations.hostname(this.opts.hostname) !== destinations.hostname(url.hostname) ||
          Number(this.opts.port || (this.opts.isHttps ? 443 : 80)) !== Number(url.port || (['https:','wss:'].includes(url.protocol) ? 443 : 80))) {
        throw blocked('Destination connection does not match its URL');
      }
      const addresses=await destinations.addresses(url.hostname);
      if (this.aborted) return;
      // Hammerhead 31 rewrites gzip/deflate/Brotli, but cannot decode Chrome's zstd.
      this.opts.headers ||= {};
      for (const name of Object.keys(this.opts.headers)) if (name.toLowerCase() === 'accept-encoding') delete this.opts.headers[name];
      this.opts.headers['accept-encoding']='gzip, deflate, br';
      this.opts.disableHttp2=true;this.opts.lookup=destinations.callback(addresses);
      return await original.apply(this,args);
    } catch (error) {
      // Constructor invokes _send before the pipeline attaches error listeners.
      await Promise.resolve();
      if (!this.aborted) this._onError(error);
    }
  };
}

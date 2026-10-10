import { createPublicKey, verify as verifySignature } from 'node:crypto';

const KEY_CACHE_MS = 10 * 60 * 1000;
let cachedKeys = null;
let expiresAt = 0;
let pendingKeys = null;

function decodePart(part) {
  if (typeof part !== 'string' || part.length > 24_000) throw new Error('Malformed Access assertion');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

async function keysFor(teamDomain, force = false) {
  if (force) { cachedKeys = null; expiresAt = 0; }
  if (cachedKeys && expiresAt > Date.now()) return cachedKeys;
  if (!pendingKeys) {
    pendingKeys = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      try {
        const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, { signal: controller.signal, redirect: 'error' });
        if (!response.ok) throw new Error(`Cloudflare Access keys returned ${response.status}`);
        const value = await response.json();
        if (!Array.isArray(value.keys) || value.keys.length > 32) throw new Error('Cloudflare Access returned an invalid key set');
        cachedKeys = value.keys.filter(key => key && key.kty === 'RSA' && typeof key.kid === 'string');
        expiresAt = Date.now() + KEY_CACHE_MS;
        return cachedKeys;
      } finally {
        clearTimeout(timer);
        pendingKeys = null;
      }
    })();
  }
  return pendingKeys;
}

export async function verifyAccessAssertion(assertion, { teamDomain, audience }) {
  if (!assertion || !teamDomain || !audience) return false;
  const parts = assertion.split('.');
  if (parts.length !== 3) return false;
  try {
    const header = decodePart(parts[0]);
    const claims = decodePart(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;
    const issuer = `https://${teamDomain}`;
    const acceptedAudience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== issuer || !acceptedAudience.includes(audience) || !Number.isFinite(claims.exp) || claims.exp <= now || (Number.isFinite(claims.nbf) && claims.nbf > now + 30)) return false;
    let jwk = (await keysFor(teamDomain)).find(key => key.kid === header.kid);
    if (!jwk) jwk = (await keysFor(teamDomain, true)).find(key => key.kid === header.kid);
    if (!jwk) return false;
    return verifySignature('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  } catch {
    return false;
  }
}

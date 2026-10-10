import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const validUUID = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function profileSessions(directory) {
  const path=join(directory,'.session-secret');
  try { writeFileSync(path,randomBytes(32),{flag:'wx',mode:0o600}); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const secret=readFileSync(path);
  if (secret.length !== 32) throw new Error('Profile signing secret is invalid. Restore the userdata backup.');
  const signature=uid => createHmac('sha256',secret).update(uid).digest('base64url');
  return {
    sign(uid) { if (!validUUID(uid)) throw new Error('Invalid profile ID'); return `${uid}.${signature(uid)}`; },
    verify(value) {
      if (typeof value !== 'string' || value.length > 100) return null;
      const [uid,mac,...extra]=value.split('.');if (extra.length || !validUUID(uid) || !mac) return null;
      const expected=Buffer.from(signature(uid)),actual=Buffer.from(mac);
      return expected.length === actual.length && timingSafeEqual(expected,actual) ? uid : null;
    },
  };
}

export const ROUND_SECONDS = 90;
export const ARENA = Object.freeze({ width: 720, height: 500, x: 360, y: 250, startRadius: 218, endRadius: 142 });
export const WEAPONS = Object.freeze({
  pulse: Object.freeze({ name: 'Pulse', interval: .19, speed: 490, damage: 1, radius: 3, spread: [0], pierce: 0, color: '#76f3d7' }),
  scatter: Object.freeze({ name: 'Scatter', interval: .56, speed: 420, damage: 1, radius: 3, spread: [-.25, -.125, 0, .125, .25], pierce: 0, color: '#ffe09c' }),
  lance: Object.freeze({ name: 'Lance', interval: .68, speed: 800, damage: 3, radius: 4, spread: [0], pierce: 2, color: '#afacff' }),
});
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function seededRandom(seed = 8743) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function arenaRadius(seconds) {
  return ARENA.startRadius + (ARENA.endRadius - ARENA.startRadius) * clamp(seconds / ROUND_SECONDS, 0, 1);
}

export function waveForTime(seconds) {
  return clamp(Math.floor(Math.max(0, seconds) / 18) + 1, 1, 5);
}

export function confine(body, radius, center = ARENA) {
  const dx = body.x - center.x, dy = body.y - center.y;
  const distance = Math.hypot(dx, dy), limit = Math.max(0, radius - body.r);
  if (distance <= limit || !distance) return { ...body };
  return { ...body, x: center.x + dx / distance * limit, y: center.y + dy / distance * limit };
}

export function movePlayer(body, input, seconds, radius, speed = 175) {
  const dt = clamp(seconds, 0, .06);
  const length = Math.hypot(input.x, input.y);
  const scale = length > 1 ? 1 / length : 1;
  return confine({ ...body, x: body.x + input.x * scale * speed * dt, y: body.y + input.y * scale * speed * dt }, radius);
}

export function segmentHit(ax, ay, bx, by, cx, cy, radius) {
  const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
  const t = length ? clamp(((cx - ax) * dx + (cy - ay) * dy) / length, 0, 1) : 0;
  return (ax + dx * t - cx) ** 2 + (ay + dy * t - cy) ** 2 <= radius ** 2;
}

export function nearestTarget(player, enemies) {
  let nearest = null, distance = Infinity;
  for (const enemy of enemies) {
    if (enemy.hp <= 0 || enemy.warning > 0) continue;
    const next = (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2;
    if (next < distance) { nearest = enemy; distance = next; }
  }
  return nearest;
}

export function shotAngles(angle, weapon) {
  return (WEAPONS[weapon] || WEAPONS.pulse).spread.map(offset => angle + offset);
}

export function pulseHits(hazard, player) {
  return hazard.age >= hazard.warning && hazard.age < hazard.warning + hazard.active &&
    Math.hypot(hazard.x - player.x, hazard.y - player.y) < hazard.r + player.r;
}

export function createRound() {
  return { time: 0, remaining: ROUND_SECONDS, hp: 5, score: 0, kills: 0, combo: 1, comboTime: 0, immunity: 1.4, ended: false, won: false };
}

export function advanceRound(state, seconds) {
  if (state.ended) return state;
  const dt = clamp(seconds, 0, .06);
  const time = Math.min(ROUND_SECONDS, state.time + dt);
  const comboTime = Math.max(0, state.comboTime - dt);
  const next = { ...state, time, remaining: Math.max(0, ROUND_SECONDS - time), comboTime, combo: comboTime > 0 ? state.combo : 1, immunity: Math.max(0, state.immunity - dt) };
  if (state.hp <= 0) return { ...next, ended: true, won: false };
  if (time >= ROUND_SECONDS - 1e-8) return { ...next, time: ROUND_SECONDS, remaining: 0, ended: true, won: true, score: next.score + 500 + next.hp * 150 };
  return next;
}

export function damageRound(state, dodging = false) {
  if (state.ended || state.immunity > 0 || dodging) return state;
  const hp = Math.max(0, state.hp - 1);
  return { ...state, hp, immunity: 1.1, combo: 1, comboTime: 0, ended: hp === 0, won: false };
}

export function rewardKill(state, bounty = 100) {
  if (state.ended) return state;
  const combo = state.comboTime > 0 ? Math.min(8, state.combo + 1) : 1;
  return { ...state, kills: state.kills + 1, score: state.score + bounty * combo, combo, comboTime: 3.4 };
}

export function restoreShield(state) {
  return state.ended ? state : { ...state, hp: Math.min(5, state.hp + 1) };
}

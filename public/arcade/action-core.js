export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function circleRectHit(x, y, radius, rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.w);
  const closestY = clamp(y, rect.y, rect.y + rect.h);
  return (x - closestX) ** 2 + (y - closestY) ** 2 < radius ** 2;
}

// Substeps prevent fast dashes from crossing thin cover. Axis separation lets
// the player slide along a wall without getting stuck on its outside corner.
export function moveInArena(body, dx, dy, walls, width, height) {
  let { x, y, r } = body;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(2, r / 2)));
  for (let i = 0; i < steps; i++) {
    const nextX = clamp(x + dx / steps, r + 8, width - r - 8);
    if (!walls.some(wall => circleRectHit(nextX, y, r, wall))) x = nextX;
    const nextY = clamp(y + dy / steps, r + 8, height - r - 8);
    if (!walls.some(wall => circleRectHit(x, nextY, r, wall))) y = nextY;
  }
  return { ...body, x, y };
}

export function segmentCircleHit(ax, ay, bx, by, cx, cy, radius) {
  const dx = bx - ax, dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? clamp(((cx - ax) * dx + (cy - ay) * dy) / length, 0, 1) : 0;
  return (ax + dx * t - cx) ** 2 + (ay + dy * t - cy) ** 2 <= radius ** 2;
}

// Liang-Barsky clipping also handles shots that enter and leave a wall in
// one frame, rather than checking only the projectile's final position.
export function segmentRectHit(ax, ay, bx, by, rect, padding = 0) {
  const dx = bx - ax, dy = by - ay;
  const left = rect.x - padding, right = rect.x + rect.w + padding;
  const top = rect.y - padding, bottom = rect.y + rect.h + padding;
  let enter = 0, exit = 1;
  const edges = [[-dx, ax - left], [dx, right - ax], [-dy, ay - top], [dy, bottom - ay]];
  for (const [direction, distance] of edges) {
    if (direction === 0) { if (distance < 0) return false; continue; }
    const t = distance / direction;
    if (direction < 0) enter = Math.max(enter, t);
    else exit = Math.min(exit, t);
    if (enter > exit) return false;
  }
  return true;
}

export function breachWave(sector) {
  const level = clamp(Math.floor(sector), 1, 6);
  const types = [];
  for (let i = 0; i < 3 + level; i++) types.push(i % 3 === 2 && level > 1 ? 'gunner' : 'seeker');
  if (level >= 3) types.push('tank');
  if (level >= 4) types.push('gunner', 'tank');
  if (level === 6) types.push('warden');
  return types;
}

export function createRacer() {
  return { x: 0, speed: 0, distance: 0, nitro: 100, boosting: false, offroad: false };
}

export function roadCenter(distance) {
  return Math.sin(distance / 3200) * 2900 + Math.sin(distance / 1500) * 420;
}

export function roadSlope(distance) {
  return Math.cos(distance / 3200) * 2900 / 3200 + Math.cos(distance / 1500) * 420 / 1500;
}

export function roadCurve(distance) {
  return -Math.sin(distance / 3200) * .68 - Math.sin(distance / 1500) * .24;
}

export function stepRacer(state, input, seconds) {
  const dt = clamp(seconds, 0, .06);
  let speed = state.speed;
  const offroad = Math.abs(state.x) > 1.04;
  const boosting = Boolean(input.boost && state.nitro > 1 && !offroad && !input.brake);
  const topSpeed = boosting ? 550 : offroad ? 155 : 390;
  const acceleration = input.brake ? -480 : (input.accelerate || boosting) ? 150 : -70;
  speed = clamp(speed + acceleration * dt, 0, 550);
  if (speed > topSpeed) speed = Math.max(topSpeed, speed - (offroad ? 450 : 180) * dt);
  const steering = input.steer * (1.32 + .72 * speed / 390) * dt;
  const centrifugal = roadCurve(state.distance) * (speed / 390) ** 2 * .42 * dt;
  const x = clamp(state.x + steering - centrifugal, -1.55, 1.55);
  const nitro = clamp(state.nitro + (boosting ? -32 : 8) * dt, 0, 100);
  return { x, speed, distance: state.distance + speed * dt, nitro, boosting, offroad: Math.abs(x) > 1.04 };
}

// The racer can pass an object between frames. Swept longitudinal checks
// catch both collisions and close passes at high nitro speed.
export function passingEvent(previousGap, nextGap, lateralGap, radius = .18) {
  if (previousGap <= 0 || nextGap > 0) return null;
  const gap = Math.abs(lateralGap);
  if (gap < radius) return 'collision';
  if (gap < radius + .17) return 'near';
  return 'pass';
}

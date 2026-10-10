export const DRIFT_DURATION = 90;
export const DRIFT_LAPS = 3;
export const ROAD_HALF_WIDTH = 36;
export const CAR_RADIUS = 9;
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

// Sample one closed Catmull-Rom curve once, then reuse its polyline for rendering,
// collision projection, lap gates, and the lightweight racing line.
export function createDriftTrack(samplesPerSection = 18) {
  const anchors = [[205, 110], [435, 105], [578, 182], [577, 322], [418, 382], [246, 348], [137, 275], [137, 186]];
  const count = clamp(Math.round(samplesPerSection), 4, 80);
  const points = [];
  for (let section = 0; section < anchors.length; section++) {
    const p0 = anchors[(section + anchors.length - 1) % anchors.length];
    const p1 = anchors[section], p2 = anchors[(section + 1) % anchors.length], p3 = anchors[(section + 2) % anchors.length];
    for (let index = 0; index < count; index++) {
      const t = index / count, t2 = t * t, t3 = t2 * t;
      const coordinate = axis => .5 * (2 * p1[axis] + (-p0[axis] + p2[axis]) * t + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2 + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3);
      points.push({ x: coordinate(0), y: coordinate(1) });
    }
  }
  let length = 0;
  const segments = points.map((start, index) => {
    const end = points[(index + 1) % points.length];
    const dx = end.x - start.x, dy = end.y - start.y, size = Math.hypot(dx, dy);
    const segment = { start, end, dx, dy, length: size, offset: length, nx: -dy / size, ny: dx / size, angle: Math.atan2(dy, dx) };
    length += size;
    return segment;
  });
  return { points, segments, length, halfWidth: ROAD_HALF_WIDTH };
}

export function trackPoint(track, progress) {
  const distance = ((progress % 1 + 1) % 1) * track.length;
  const segment = track.segments.find(item => distance < item.offset + item.length) || track.segments[track.segments.length - 1];
  const t = clamp((distance - segment.offset) / segment.length, 0, 1);
  return { x: segment.start.x + segment.dx * t, y: segment.start.y + segment.dy * t, nx: segment.nx, ny: segment.ny, angle: segment.angle };
}

export function projectTrack(track, x, y) {
  let best = null;
  for (const segment of track.segments) {
    const t = clamp(((x - segment.start.x) * segment.dx + (y - segment.start.y) * segment.dy) / (segment.length * segment.length), 0, 1);
    const px = segment.start.x + segment.dx * t, py = segment.start.y + segment.dy * t;
    const distance = Math.hypot(x - px, y - py);
    if (!best || distance < best.distance) best = { x: px, y: py, distance, signedDistance: (x - px) * segment.nx + (y - py) * segment.ny, nx: segment.nx, ny: segment.ny, angle: segment.angle, progress: (segment.offset + segment.length * t) / track.length };
  }
  return best;
}

export function createDriftCar(track = createDriftTrack()) {
  const start = trackPoint(track, .015);
  return { x: start.x, y: start.y, angle: start.angle, vx: 0, vy: 0, speed: 0, slip: 0 };
}

export function stepDriftCar(car, input, delta) {
  const dt = clamp(Number(delta) || 0, 0, .06);
  const result = { ...car };
  const steer = clamp(Number(input.steer) || 0, -1, 1);
  const steps = Math.max(1, Math.ceil(dt / (1 / 120))), step = dt / steps;
  for (let index = 0; index < steps; index++) {
    const speed = Math.hypot(result.vx, result.vy);
    const forward = result.vx * Math.cos(result.angle) + result.vy * Math.sin(result.angle);
    const steeringRate = steer * 2.1 * clamp(speed / 70, 0, 1) * (forward < -4 ? -1 : 1);
    result.angle = wrapAngle(result.angle + steeringRate * step);
    const hx = Math.cos(result.angle), hy = Math.sin(result.angle);
    let longitudinal = result.vx * hx + result.vy * hy;
    let lateral = result.vx * -hy + result.vy * hx;
    if (input.throttle && !input.brake) longitudinal += 83 * step;
    if (input.brake) longitudinal = Math.max(0, longitudinal - 145 * step);
    longitudinal *= Math.exp(-(input.handbrake ? .62 : .18) * step);
    lateral *= Math.exp(-(input.handbrake ? 1.5 : 7.8) * step);
    longitudinal = clamp(longitudinal, -18, input.handbrake ? 132 : 157);
    result.vx = hx * longitudinal - hy * lateral;
    result.vy = hy * longitudinal + hx * lateral;
    const total = Math.hypot(result.vx, result.vy);
    if (total > 164) { result.vx *= 164 / total; result.vy *= 164 / total; }
    result.x += result.vx * step;
    result.y += result.vy * step;
  }
  result.speed = Math.hypot(result.vx, result.vy);
  result.slip = result.speed > 1 ? wrapAngle(Math.atan2(result.vy, result.vx) - result.angle) : 0;
  return result;
}

export function constrainDriftCar(car, track) {
  const projection = projectTrack(track, car.x, car.y);
  const limit = track.halfWidth - CAR_RADIUS;
  const result = { ...car };
  const shoulder = projection.distance > limit - 6;
  const hit = projection.distance > limit;
  let impact = 0;
  if (hit) {
    const dx = car.x - projection.x, dy = car.y - projection.y;
    const size = Math.hypot(dx, dy) || 1, nx = dx / size, ny = dy / size;
    const outward = car.vx * nx + car.vy * ny;
    impact = Math.max(0, outward);
    result.x = projection.x + nx * (limit - .4);
    result.y = projection.y + ny * (limit - .4);
    if (outward > 0) { result.vx -= nx * outward * 1.16; result.vy -= ny * outward * 1.16; }
    result.vx *= .8; result.vy *= .8;
  }
  result.speed = Math.hypot(result.vx, result.vy);
  result.slip = result.speed > 1 ? wrapAngle(Math.atan2(result.vy, result.vx) - result.angle) : 0;
  return { car: result, projection: projectTrack(track, result.x, result.y), shoulder, hit, impact };
}

export function createLapProgress(progress = .015) {
  return { previous: progress, nextGate: 1, laps: 0 };
}

export function advanceLapProgress(state, progress) {
  const next = { ...state, previous: progress };
  let delta = progress - state.previous;
  if (delta < -.5) delta += 1;
  if (delta > .5) delta -= 1;
  if (delta <= 0 || delta > .12) return { ...next, crossed: false, lapCompleted: false };
  const gate = state.nextGate / 4 % 1;
  const distance = (gate - state.previous + 1) % 1;
  if (distance <= 0 || distance > delta + 1e-9) return { ...next, crossed: false, lapCompleted: false };
  next.nextGate = state.nextGate === 4 ? 1 : state.nextGate + 1;
  next.laps = state.laps + Number(state.nextGate === 4);
  return { ...next, crossed: true, lapCompleted: state.nextGate === 4 };
}

export function createDriftCombo() { return { pending: 0, chain: 0, idle: 0 }; }

export function stepDriftCombo(combo, car, delta, collision = false) {
  const dt = clamp(Number(delta) || 0, 0, .06);
  if (collision) return { ...createDriftCombo(), banked: 0, drifting: false };
  const angle = Math.abs(car.slip);
  const drifting = car.speed >= 48 && angle >= .18 && angle <= 1.18;
  const next = { pending: combo.pending, chain: combo.chain, idle: combo.idle, banked: 0, drifting };
  if (drifting) {
    next.chain += dt;
    next.idle = 0;
    next.pending += (car.speed * .38 + angle * 115) * (1 + Math.min(2, next.chain / 4)) * dt;
  } else if (next.pending > 0) {
    next.idle += dt;
    if (next.idle >= .85) return { ...createDriftCombo(), banked: Math.round(next.pending), drifting: false };
  }
  return next;
}

export function bankDriftCombo(combo) { return { ...createDriftCombo(), banked: Math.round(combo.pending), drifting: false }; }

export function driftRunResult(laps, hull, time) {
  if (laps >= DRIFT_LAPS) return 'finished';
  if (hull <= 0) return 'wrecked';
  if (time <= 0) return 'timeout';
  return null;
}

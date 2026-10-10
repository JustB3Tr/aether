import test from 'node:test';
import assert from 'node:assert/strict';
import {
  breachWave,
  circleRectHit,
  createRacer,
  moveInArena,
  passingEvent,
  roadCenter,
  roadSlope,
  seededRandom,
  segmentCircleHit,
  segmentRectHit,
  stepRacer,
} from '../action-core.js';

test('seeded random is repeatable and stays in the half-open unit interval', () => {
  const a = seededRandom(87), b = seededRandom(87);
  const first = Array.from({ length: 12 }, a);
  assert.deepEqual(first, Array.from({ length: 12 }, b));
  assert.ok(first.every(value => value >= 0 && value < 1));
});

test('circle and swept segment checks include fast hits but reject misses', () => {
  const rect = { x: 10, y: 10, w: 20, h: 12 };
  assert.equal(circleRectHit(9, 16, 2, rect), true);
  assert.equal(circleRectHit(5, 16, 2, rect), false);
  assert.equal(segmentCircleHit(0, 16, 40, 16, 20, 16, 3), true);
  assert.equal(segmentCircleHit(0, 2, 40, 2, 20, 16, 3), false);
});

test('wall sweep blocks a high-speed dash and still clamps the arena bounds', () => {
  const wall = { x: 40, y: 20, w: 4, h: 60 };
  const moved = moveInArena({ x: 20, y: 40, r: 5, speed: 690 }, 70, 0, [wall], 100, 100);
  assert.ok(moved.x <= wall.x - moved.r + 1e-9, `player crossed wall to x=${moved.x}`);
  assert.equal(moved.y, 40);
  const bounded = moveInArena({ x: 50, y: 50, r: 8 }, 500, -500, [], 100, 100);
  assert.equal(bounded.x, 84);
  assert.equal(bounded.y, 16);
});

test('segment wall checks catch a projectile crossing a thin wall', () => {
  const wall = { x: 40, y: 12, w: 3, h: 36 };
  assert.equal(segmentRectHit(0, 20, 80, 20, wall, 2), true);
  assert.equal(segmentRectHit(0, 0, 80, 0, wall, 2), false);
  assert.equal(segmentRectHit(0, 60, 80, 60, wall, 2), false);
});

test('breach waves scale monotonically and reserve the Warden for the final sector', () => {
  const waves = Array.from({ length: 6 }, (_, index) => breachWave(index + 1));
  assert.deepEqual(waves.map(wave => wave.length), [4, 5, 7, 10, 11, 13]);
  assert.ok(waves.slice(0, 5).every(wave => !wave.includes('warden')));
  assert.equal(waves[5].filter(type => type === 'warden').length, 1);
  assert.ok(waves[5].includes('tank'));
  assert.ok(waves[5].includes('gunner'));
  assert.deepEqual(breachWave(0), waves[0]);
  assert.deepEqual(breachWave(99), waves[5]);
});

test('racer acceleration, braking, and speed remain bounded at the frame cap', () => {
  const accelerated = stepRacer(createRacer(), { steer: 0, accelerate: true }, 1);
  assert.equal(accelerated.speed, 9);
  assert.equal(accelerated.distance, 0.54);
  assert.equal(stepRacer({ ...createRacer(), speed: 100 }, { steer: 0, brake: true }, .06).speed, 71.2);
  const fast = stepRacer({ ...createRacer(), speed: 545, nitro: 100 }, { steer: 0, accelerate: true, boost: true }, .06);
  assert.equal(fast.speed, 550);
  assert.ok(fast.distance <= 33);
});

test('nitro only boosts on-road without braking, and restores while coasting', () => {
  const starting = { ...createRacer(), speed: 390, nitro: 50 };
  const boosted = stepRacer(starting, { steer: 0, boost: true }, .06);
  assert.equal(boosted.boosting, true);
  assert.equal(boosted.nitro, 48.08);
  const braking = stepRacer(starting, { steer: 0, boost: true, brake: true }, .06);
  assert.equal(braking.boosting, false);
  assert.equal(braking.nitro, 50.48);
  const shoulder = stepRacer({ ...starting, x: 1.1 }, { steer: 0, boost: true }, .06);
  assert.equal(shoulder.boosting, false);
  assert.equal(shoulder.offroad, true);
  assert.equal(shoulder.nitro, 50.48);
});

test('road projection helpers return finite, locally consistent geometry', () => {
  for (const distance of [0, 1200, 6000, 22000]) {
    const center = roadCenter(distance);
    const slope = roadSlope(distance);
    assert.ok(Number.isFinite(center) && Number.isFinite(slope));
    const delta = .01;
    const observed = (roadCenter(distance + delta) - center) / delta;
    assert.ok(Math.abs(observed - slope) < .002);
  }
});

test('traffic and battery events require a genuine forward crossing', () => {
  assert.equal(passingEvent(10, -5, 0, .23), 'collision');
  assert.equal(passingEvent(10, -5, .3, .23), 'near');
  assert.equal(passingEvent(10, -5, .6, .23), 'pass');
  assert.equal(passingEvent(10, 1, 0, .23), null);
  assert.equal(passingEvent(-1, -5, 0, .23), null);
  assert.equal(passingEvent(0, 0, 0, .23), null);
});

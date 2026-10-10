import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRIFT_LAPS, CAR_RADIUS, createDriftTrack, trackPoint, projectTrack,
  createDriftCar, stepDriftCar, constrainDriftCar, createLapProgress,
  advanceLapProgress, createDriftCombo, stepDriftCombo, bankDriftCombo,
  driftRunResult, wrapAngle, clamp,
} from '../driftline-core.js';
import { driftlineDefinition } from '../driftline-definition.js';

test('Driftline has its own stable id and describes actual driving controls', () => {
  assert.equal(driftlineDefinition.driftline.name, 'Driftline');
  assert.equal(driftlineDefinition.driftline.category, 'Driving');
  assert.match(driftlineDefinition.driftline.rules, /three clockwise laps in 90 seconds/);
  assert.match(driftlineDefinition.driftline.rules, /Space/);
});

test('the closed circuit is finite and its projection agrees with its sampled line', () => {
  const track = createDriftTrack();
  assert.equal(track.points.length, 144);
  assert.ok(track.length > 1000 && track.length < 1400);
  for (const progress of [0, .015, .25, .5, .75, .99]) {
    const point = trackPoint(track, progress), projection = projectTrack(track, point.x, point.y);
    assert.ok(projection.distance < 1e-8);
    assert.ok(Math.abs(projection.progress - progress) < 1e-8);
    assert.ok(Number.isFinite(point.angle));
  }
  assert.deepEqual(trackPoint(track, -.25), trackPoint(track, .75));
});

test('throttle and braking stay bounded and a long frame is capped', () => {
  const track = createDriftTrack(), car = createDriftCar(track);
  const short = stepDriftCar(car, { throttle: true, steer: 0 }, .06);
  assert.deepEqual(stepDriftCar(car, { throttle: true, steer: 0 }, 10), short);
  assert.deepEqual(stepDriftCar(car, { throttle: true, steer: 0 }, -1), car);
  let moving = car;
  for (let index = 0; index < 900; index++) moving = stepDriftCar(moving, { throttle: true }, 1 / 60);
  assert.ok(moving.speed <= 164 && moving.speed > 150);
  const braking = stepDriftCar(moving, { brake: true, throttle: true }, .06);
  assert.ok(braking.speed < moving.speed - 7);
  assert.ok(Number.isFinite(braking.x) && Number.isFinite(braking.y));
});

test('a handbrake turn retains more lateral slip than a grip turn', () => {
  const track = createDriftTrack(), start = createDriftCar(track);
  const moving = { ...start, vx: Math.cos(start.angle) * 115, vy: Math.sin(start.angle) * 115, speed: 115 };
  let grip = moving, slide = moving;
  for (let index = 0; index < 30; index++) {
    grip = stepDriftCar(grip, { steer: 1, throttle: true }, 1 / 60);
    slide = stepDriftCar(slide, { steer: 1, throttle: true, handbrake: true }, 1 / 60);
  }
  assert.ok(Math.abs(slide.slip) > Math.abs(grip.slip) * 1.6);
  assert.ok(Math.abs(slide.slip) >= .18, 'handbrake should enter scoring slip range');
  assert.ok(slide.speed < grip.speed, 'handbrake costs speed');
});

test('track barriers contain the car and remove outward velocity', () => {
  const track = createDriftTrack(), p = trackPoint(track, .3);
  const car = { x: p.x + p.nx * 47, y: p.y + p.ny * 47, angle: p.angle, vx: p.nx * 80, vy: p.ny * 80, speed: 80, slip: .6 };
  const bounded = constrainDriftCar(car, track);
  assert.equal(bounded.hit, true);
  assert.equal(bounded.shoulder, true);
  assert.ok(bounded.impact > 60);
  assert.ok(bounded.projection.distance <= track.halfWidth - CAR_RADIUS + 1e-6);
  const outward = bounded.car.vx * p.nx + bounded.car.vy * p.ny;
  assert.ok(outward < 0, 'barrier should bounce inward');
});

test('ordered gates count three forward laps and reject shortcuts and reverse travel', () => {
  let progress = createLapProgress();
  for (let lap = 0; lap < DRIFT_LAPS; lap++) {
    for (let fraction = lap === 0 ? .02 : .01; fraction < 1; fraction += .01) progress = advanceLapProgress(progress, fraction);
    progress = advanceLapProgress(progress, .005);
    assert.equal(progress.laps, lap + 1);
  }
  let skipped = advanceLapProgress(createLapProgress(.9), .01);
  assert.equal(skipped.laps, 0, 'finish line without other gates cannot make a lap');
  skipped = advanceLapProgress(createLapProgress(.2), .5);
  assert.equal(skipped.nextGate, 1, 'large progress jump cannot claim a gate');
  const backward = advanceLapProgress({ ...createLapProgress(.3), nextGate: 1 }, .24);
  assert.equal(backward.crossed, false);
  assert.equal(backward.laps, 0);
});

test('a drift combo scores only meaningful slip and banks after a straight recovery', () => {
  let combo = createDriftCombo();
  const sliding = { speed: 100, slip: .5 };
  for (let index = 0; index < 120; index++) combo = stepDriftCombo(combo, sliding, 1 / 60);
  assert.ok(combo.pending > 200);
  assert.equal(combo.banked, 0);
  const earned = Math.round(combo.pending);
  let banked = 0;
  for (let index = 0; index < 52; index++) {
    combo = stepDriftCombo(combo, { speed: 100, slip: .02 }, 1 / 60);
    banked += combo.banked;
  }
  assert.equal(banked, earned);
  assert.equal(combo.pending, 0);
  for (const car of [{ speed: 10, slip: .5 }, { speed: 100, slip: 0 }, { speed: 100, slip: 1.5 }]) {
    assert.equal(stepDriftCombo(createDriftCombo(), car, .06).pending, 0);
  }
});

test('a barrier hit discards the unbanked combo; explicit banking is exact', () => {
  const combo = { pending: 342.7, chain: 3, idle: .3 };
  assert.deepEqual(stepDriftCombo(combo, { speed: 110, slip: .4 }, .06, true), { pending: 0, chain: 0, idle: 0, banked: 0, drifting: false });
  assert.equal(bankDriftCombo(combo).banked, 343);
  assert.equal(bankDriftCombo(combo).pending, 0);
});

test('terminal conditions are explicit and a guided legal racing line can finish in time', () => {
  assert.equal(driftRunResult(2, 1, 1), null);
  assert.equal(driftRunResult(3, 4, 12), 'finished');
  assert.equal(driftRunResult(1, 0, 55), 'wrecked');
  assert.equal(driftRunResult(1, 3, 0), 'timeout');
  const track = createDriftTrack();
  let car = createDriftCar(track), progress = createLapProgress(), elapsed = 0;
  while (progress.laps < 3 && elapsed < 90) {
    const p = projectTrack(track, car.x, car.y), target = trackPoint(track, p.progress + .029);
    const heading = Math.atan2(target.y - car.y, target.x - car.x);
    car = stepDriftCar(car, { throttle: true, steer: clamp(wrapAngle(heading - car.angle) * 2.1, -1, 1) }, 1 / 60);
    const bounded = constrainDriftCar(car, track); car = bounded.car;
    progress = advanceLapProgress(progress, bounded.projection.progress); elapsed += 1 / 60;
  }
  assert.equal(progress.laps, 3, 'ordinary grip physics must be able to finish the actual circuit');
  assert.ok(elapsed < 90);
});

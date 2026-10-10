import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA, ROUND_SECONDS, WEAPONS, advanceRound, arenaRadius, confine, createRound,
  damageRound, movePlayer, nearestTarget, pulseHits, restoreShield, rewardKill,
  seededRandom, segmentHit, shotAngles, waveForTime,
} from '../pulse-arena-core.js';
import { pulsearena } from '../pulse-arena-game.js';

test('deterministic seeds and bounded closing ring', () => {
  const a = seededRandom(52), b = seededRandom(52);
  assert.deepEqual(Array.from({ length: 20 }, a), Array.from({ length: 20 }, b));
  assert.equal(arenaRadius(-10), ARENA.startRadius);
  assert.equal(arenaRadius(45), 180);
  assert.equal(arenaRadius(999), ARENA.endRadius);
  assert.deepEqual([0, 17.99, 18, 36, 54, 72, 90].map(waveForTime), [1, 1, 2, 3, 4, 5, 5]);
});

test('movement normalizes diagonals and clamps blink movement to the circle', () => {
  const player = { x: ARENA.x, y: ARENA.y, r: 10 };
  const straight = movePlayer(player, { x: 1, y: 0 }, .06, 200);
  const diagonal = movePlayer(player, { x: 1, y: 1 }, .06, 200);
  assert.ok(Math.abs(Math.hypot(diagonal.x - player.x, diagonal.y - player.y) - (straight.x - player.x)) < 1e-8);
  const edge = confine({ ...player, x: 10000, y: 10000 }, 142);
  assert.ok(Math.abs(Math.hypot(edge.x - ARENA.x, edge.y - ARENA.y) - 132) < 1e-8);
  assert.deepEqual(confine(player, 1), player);
});

test('swept shots catch a high-speed crossing and reject a miss', () => {
  assert.equal(segmentHit(0, 20, 100, 20, 50, 20, 4), true);
  assert.equal(segmentHit(0, 20, 100, 20, 50, 40, 4), false);
  assert.equal(segmentHit(4, 5, 4, 5, 4, 5, 0), true);
});

test('weapon patterns stay distinct and invalid selection falls back to Pulse', () => {
  assert.deepEqual(shotAngles(1, 'pulse'), [1]);
  assert.deepEqual(shotAngles(1, 'scatter'), [.75, .875, 1, 1.125, 1.25]);
  assert.deepEqual(shotAngles(1, 'invalid'), [1]);
  assert.ok(WEAPONS.lance.damage > WEAPONS.pulse.damage);
  assert.equal(WEAPONS.lance.pierce, 2);
});

test('assisted aim skips defeated or spawning targets', () => {
  const player = { x: 0, y: 0 };
  const alive = { x: 3, y: 4, hp: 2, warning: 0 };
  assert.equal(nearestTarget(player, [{ x: 1, y: 1, hp: 0 }, { x: 2, y: 2, hp: 3, warning: .1 }, alive]), alive);
  assert.equal(nearestTarget(player, []), null);
});

test('floor pulses only damage during their marked active interval', () => {
  const hazard = { x: 10, y: 10, r: 20, warning: 1.2, active: .3 };
  const player = { x: 10, y: 10, r: 8 };
  assert.equal(pulseHits({ ...hazard, age: 1.19 }, player), false);
  assert.equal(pulseHits({ ...hazard, age: 1.2 }, player), true);
  assert.equal(pulseHits({ ...hazard, age: 1.5 }, player), false);
  assert.equal(pulseHits({ ...hazard, age: 1.3 }, { ...player, x: 80 }), false);
});

test('round has a finite win, a single survival bonus and immutable final result', () => {
  let state = createRound();
  for (let frame = 0; frame < 1800 && !state.ended; frame++) state = advanceRound(state, .06);
  assert.equal(state.time, ROUND_SECONDS);
  assert.equal(state.remaining, 0);
  assert.equal(state.ended, true);
  assert.equal(state.won, true);
  assert.equal(state.score, 1250);
  assert.equal(advanceRound(state, .06), state);
  assert.equal(rewardKill(state), state);
  assert.equal(damageRound(state), state);
});

test('damage honors blink and hurt immunity; lethal loss cannot become a timed win', () => {
  const state = { ...createRound(), hp: 1, immunity: 0, time: 89.99, remaining: .01 };
  assert.equal(damageRound(state, true), state);
  assert.equal(damageRound({ ...state, immunity: .1 }).hp, 1);
  const lost = damageRound(state);
  assert.equal(lost.hp, 0);
  assert.equal(lost.ended, true);
  assert.equal(lost.won, false);
  assert.equal(advanceRound(lost, 1), lost);
});

test('quick kills increase capped multiplier; shield cells and delayed kills stay bounded', () => {
  let state = createRound();
  for (let i = 0; i < 12; i++) state = rewardKill(state, 100);
  assert.equal(state.kills, 12);
  assert.equal(state.combo, 8);
  assert.equal(rewardKill({ ...state, comboTime: 0 }).combo, 1);
  assert.equal(restoreShield(state).hp, 5);
  assert.equal(restoreShield({ ...state, hp: 2 }).hp, 3);
  assert.equal(advanceRound({ ...state, comboTime: .01 }, .06).combo, 1);
});

test('all three game loops render finite geometry and end one stationary round', () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  let drawCalls = 0;
  const drawing = new Proxy({}, {
    get(_target, name) {
      return (...args) => {
        drawCalls++;
        for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), name + ' received non-finite geometry');
      };
    },
  });
  class Node {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.style = {}; this.children = []; this.hidden = false; }
    append(...children) { this.children.push(...children); }
    prepend(...children) { this.children.unshift(...children); }
    setAttribute() {}
    getContext() { return drawing; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 340, height: 236 }; }
    focus() {}
  }
  globalThis.document = { body: { dataset: { motion: 'reduced' } }, createElement: tag => new Node(tag) };
  globalThis.window = { devicePixelRatio: 3 };
  try {
    for (const selected of ['pulse', 'scatter', 'lance']) {
      const buttons = [], results = [], listeners = [];
      const ctx = {
        board: new Node('div'), controls: new Node('div'), active: true, ended: false,
        listen(target, type, handler) { listeners.push({ target, type, handler }); }, tone() {}, after() {}, status() {}, score() {},
        button(label, handler, options = {}) {
          const node = new Node('button');
          (options.parent || this.controls).append(node);
          buttons.push({ label, handler });
          return node;
        },
        finish(message, score, extra) { this.ended = true; results.push({ message, score, extra }); },
      };
      pulsearena(ctx);
      const stage = ctx.board.children.find(node => node.children.some(child => child.tagName === 'CANVAS'));
      const panel = stage.children.find(node => node.tagName === 'SECTION');
      const canvas = stage.children.find(node => node.tagName === 'CANVAS');
      const select = panel.children.find(node => node.tagName === 'LABEL').children[0];
      assert.equal(select.style.minHeight, '44px');
      assert.equal(panel.children.find(node => node.tagName === 'BUTTON').style.minHeight, '44px');
      select.value = selected;
      buttons.find(button => button.label === 'Enter the arena').handler();
      const keydown = listeners.find(item => item.target === document && item.type === 'keydown').handler;
      const keyup = listeners.find(item => item.target === document && item.type === 'keyup').handler;
      const nativeKey = (key, extra = {}) => ({ key, target: { tagName: 'BUTTON' }, preventDefault() { assert.fail('native shortcut was intercepted'); }, ...extra });
      keydown(nativeKey(' '));
      keydown(nativeKey('Enter'));
      for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) keydown(nativeKey('w', { [modifier]: true, target: canvas }));
      keydown({ key: 'w', target: canvas, preventDefault() {} });
      ctx.frame(.06);
      keyup({ key: 'w' });
      const touchStart = listeners.find(item => item.target === canvas && item.type === 'pointerdown').handler;
      const touchMove = listeners.find(item => item.target === canvas && item.type === 'pointermove').handler;
      touchStart({ pointerType: 'touch', pointerId: 4, clientX: 80, clientY: 80, preventDefault() {} });
      touchMove({ pointerType: 'touch', pointerId: 4, clientX: 120, clientY: 80 });
      ctx.frame(.06);
      ctx.onPause();
      for (let i = 0; i < 1800 && !ctx.ended; i++) ctx.frame(.06);
      assert.equal(ctx.ended, true, selected + ' did not end');
      assert.equal(results.length, 1);
      assert.equal(results[0].extra.weapon, selected);
      assert.ok(Number.isFinite(results[0].score) && results[0].score >= 0);
      ctx.frame(.06);
      assert.equal(results.length, 1, 'finished frames must not record again');
      ctx.onPause();
    }
    assert.ok(drawCalls > 1000);
  } finally {
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
  }
});

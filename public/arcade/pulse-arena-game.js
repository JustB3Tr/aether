import {
  ARENA, ROUND_SECONDS, WEAPONS, advanceRound, arenaRadius, clamp, confine,
  createRound, damageRound, movePlayer, nearestTarget, pulseHits, restoreShield,
  rewardKill, seededRandom, segmentHit, shotAngles, waveForTime,
} from './pulse-arena-core.js?v=5.4.0';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const COLORS = { teal: '#79f6d5', gold: '#ffce85', pink: '#ff91af', violet: '#b4a8ff', ink: '#e6fff3', muted: '#8bacb3' };

export function pulsearena(ctx) {
  const { width: W, height: H, x: CX, y: CY } = ARENA;
  const wrapper = el('div', 'action-stage');
  const canvas = el('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.aspectRatio = W + '/' + H;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Pulse Arena. A circular arena with hostile drones, visible projectiles and marked floor hazards. Use the controls below or WASD to move.');
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const panel = el('section', 'action-panel');
  panel.style.inset = '5% 9%';
  panel.style.gap = '8px';
  panel.style.padding = '8px';
  const heading = el('h2', '', 'Pulse Arena');
  heading.style.fontSize = '28px';
  const copy = el('p', 'action-copy', 'Survive 90 seconds. Dodge the closing ring.');
  copy.style.fontSize = '12px';
  copy.style.lineHeight = '1.3';
  const weaponLabel = el('label', '', 'Weapon ');
  weaponLabel.style.fontSize = '12px';
  const weaponSelect = el('select');
  weaponSelect.setAttribute('aria-label', 'Choose a weapon for this round');
  Object.assign(weaponSelect.style, { background: '#102830', color: '#d8f5e7', padding: '7px 8px', border: '1px solid #42656b', borderRadius: '8px', maxWidth: '100%', minHeight: '44px' });
  for (const [value, label] of [['pulse', 'Pulse / rapid'], ['scatter', 'Scatter / wide'], ['lance', 'Lance / piercing']]) {
    const option = el('option', '', label);
    option.value = value;
    weaponSelect.append(option);
  }
  weaponLabel.append(weaponSelect);
  panel.append(heading, copy, weaponLabel);
  const startButton = ctx.button('Enter the arena', begin, { parent: panel, primary: true });
  startButton.style.minHeight = '44px';
  wrapper.append(canvas, panel);
  ctx.board.append(wrapper);

  const hud = el('div', 'action-hud');
  const values = [['Wave', '1 / 5'], ['Shield', '5 / 5'], ['Clock', '90.0s'], ['Blink', 'Ready']].map(([label, value]) => {
    const box = el('div'), strong = el('strong', '', value);
    box.append(el('span', '', label), strong);
    hud.append(box);
    return strong;
  });
  ctx.board.prepend(hud);
  const toggle = (name, checked) => {
    const label = el('label', 'action-toggle');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = checked;
    label.append(input, el('span', '', name));
    ctx.controls.append(label);
    return input;
  };
  const assistedAim = toggle('Assisted aim', true), autoFire = toggle('Auto-fire', true);
  const pad = el('div', 'action-pad');
  ctx.controls.append(pad);
  const held = new Set();
  const control = (label, action, accessible) => {
    const button = ctx.button(label, () => {
      if (ctx.ended) return;
      held.add(action);
      ctx.after(.16, () => held.delete(action));
    }, { parent: pad, label: accessible });
    ctx.listen(button, 'pointerdown', event => {
      event.preventDefault();
      held.add(action);
      button.setPointerCapture?.(event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) ctx.listen(button, type, () => held.delete(action));
  };
  for (const [label, action, accessible] of [['↑', 'up', 'Move up'], ['←', 'left', 'Move left'], ['↓', 'down', 'Move down'], ['→', 'right', 'Move right'], ['Fire', 'fire', 'Fire weapon']]) control(label, action, accessible);
  ctx.button('Blink', blink, { parent: pad, label: 'Blink dodge, Shift on keyboard' });

  let round = createRound(), player = { x: CX, y: CY + 35, r: 10 };
  let weapon = 'pulse', started = false, wave = 1, lastHud = -1, nextEnemy = 1;
  let enemies = [], shots = [], hazards = [], particles = [], cells = [];
  let shotClock = 0, spawnClock = .8, hazardClock = 5, blinkClock = 0, blinkTime = 0, hurtFlash = 0;
  let aim = -Math.PI / 2, pointer = null, manualAim = 0, stick = null;
  let blinkDirection = { x: 0, y: -1 }, shake = 0;
  const random = seededRandom(9841);
  const keyActions = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', ' ': 'fire' };
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
  };
  const clearInputs = () => { held.clear(); stick = null; pointer = null; manualAim = 0; };
  ctx.onPause = clearInputs;
  ctx.listen(window, 'blur', clearInputs);
  ctx.listen(document, 'keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (event.target.tagName === 'BUTTON' && (key === ' ' || key === 'enter')) return;
    if (keyActions[key]) { event.preventDefault(); held.add(keyActions[key]); }
    if (key === 'shift' && !event.repeat) { event.preventDefault(); blink(); }
    if (key === 'enter' && !started) { event.preventDefault(); begin(); }
  });
  ctx.listen(document, 'keyup', event => held.delete(keyActions[event.key.toLowerCase()]));
  ctx.listen(canvas, 'pointerdown', event => {
    if (!started || ctx.ended) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture?.(event.pointerId);
    const location = point(event);
    if (event.pointerType === 'touch') {
      if (!stick) stick = { id: event.pointerId, origin: location, location };
    } else {
      pointer = location;
      manualAim = 2;
      held.add('fire');
    }
  });
  ctx.listen(canvas, 'pointermove', event => {
    const location = point(event);
    if (event.pointerType === 'touch') {
      if (stick?.id === event.pointerId) stick.location = location;
    } else { pointer = location; manualAim = 2; }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) ctx.listen(canvas, type, event => {
    if (stick?.id === event.pointerId) stick = null;
    if (event.pointerType !== 'touch') held.delete('fire');
  });

  function begin() {
    if (started || ctx.ended) return;
    weapon = Object.hasOwn(WEAPONS, weaponSelect.value) ? weaponSelect.value : 'pulse';
    started = true;
    panel.hidden = true;
    canvas.focus({ preventScroll: true });
    ctx.status('Wave 1. Keep moving. Orange circles warn before they pulse.');
    updateHud(true);
  }
  function movement() {
    let x = Number(held.has('right')) - Number(held.has('left'));
    let y = Number(held.has('down')) - Number(held.has('up'));
    if (stick) {
      x += clamp((stick.location.x - stick.origin.x) / 36, -1, 1);
      y += clamp((stick.location.y - stick.origin.y) / 36, -1, 1);
    }
    return { x, y };
  }
  function blink() {
    if (!started || ctx.ended || blinkClock > 0) return;
    let direction = movement();
    const length = Math.hypot(direction.x, direction.y);
    if (length) direction = { x: direction.x / length, y: direction.y / length };
    else direction = { x: Math.cos(aim), y: Math.sin(aim) };
    blinkDirection = direction;
    blinkTime = .18;
    blinkClock = 2.3;
    ctx.tone(820, .05);
  }
  function burst(x, y, color, count = 9) {
    if (document.body.dataset.motion === 'reduced') return;
    for (let i = 0; i < count && particles.length < 96; i++) {
      const angle = random() * Math.PI * 2, speed = 30 + random() * 110;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .25 + random() * .25, color });
    }
  }
  function finish() {
    if (ctx.ended) return;
    clearInputs();
    updateHud(true);
    ctx.score(round.score);
    ctx.finish(round.won ? 'Ring conquered. ' + round.kills + ' drones cleared, ' + round.score + ' points.' : 'Shield broken in wave ' + wave + '. ' + round.kills + ' drones cleared. Try a different weapon.', round.score, { won: round.won, kills: round.kills, wave, weapon, seconds: Math.round(round.time) });
  }
  function hurt() {
    const next = damageRound(round, blinkTime > 0);
    if (next === round) return false;
    round = next;
    hurtFlash = .18;
    shake = .14;
    burst(player.x, player.y, COLORS.gold, 12);
    ctx.tone(135, .08);
    if (round.ended) finish();
    return true;
  }
  function spawn(type) {
    if (enemies.length >= 18) {
      if (type !== 'core') return;
      enemies.shift();
    }
    const radius = arenaRadius(round.time);
    let position = null, furthest = 0;
    for (let i = 0; i < 8; i++) {
      const angle = random() * Math.PI * 2;
      const candidate = { x: CX + Math.cos(angle) * (radius - 24), y: CY + Math.sin(angle) * (radius - 24) };
      const distance = Math.hypot(candidate.x - player.x, candidate.y - player.y);
      if (distance > furthest) { position = candidate; furthest = distance; }
    }
    const stats = {
      runner: { r: 11, hp: 2 + Math.floor(wave / 3), speed: 54 + wave * 6, bounty: 100, color: COLORS.pink },
      sentry: { r: 14, hp: 4, speed: 33, bounty: 160, color: COLORS.gold },
      charger: { r: 13, hp: 4, speed: 45, bounty: 190, color: COLORS.violet },
      core: { r: 25, hp: 34, speed: 19, bounty: 1200, color: '#ffd69d' },
    }[type];
    enemies.push({ ...stats, ...position, type, id: nextEnemy++, maxHp: stats.hp, warning: type === 'core' ? 1.4 : .7, cooldown: 1.5 + random(), charge: 0, dash: 0, dx: 0, dy: 0, hit: 0, turn: random() * Math.PI * 2 });
  }
  function shot(owner, x, y, angle, stats = {}) {
    if (shots.length >= 160) return;
    shots.push({ owner, x, y, vx: Math.cos(angle) * (stats.speed || 180), vy: Math.sin(angle) * (stats.speed || 180), r: stats.radius || 4, damage: stats.damage || 1, pierce: stats.pierce || 0, color: stats.color || COLORS.pink, life: owner === 'player' ? 1.05 : 2.5, hits: [] });
  }
  function fire() {
    const stats = WEAPONS[weapon];
    for (const angle of shotAngles(aim, weapon)) shot('player', player.x + Math.cos(angle) * 15, player.y + Math.sin(angle) * 15, angle, stats);
    shotClock = stats.interval;
    ctx.tone(weapon === 'lance' ? 320 : weapon === 'scatter' ? 430 : 590, .025);
  }
  function floorPulse(x, y, r = 33) {
    if (hazards.length >= 10) return;
    hazards.push({ x, y, r, age: 0, warning: 1.3, active: .35 });
  }
  function updateHud(force = false) {
    if (!force && round.time - lastHud < .1) return;
    lastHud = round.time;
    values[0].textContent = wave + ' / 5';
    values[1].textContent = round.hp + ' / 5';
    values[2].textContent = round.remaining.toFixed(1) + 's';
    values[3].textContent = blinkClock <= 0 ? 'Ready' : blinkClock.toFixed(1) + 's';
    ctx.score(round.score);
  }
  function update(dt) {
    round = advanceRound(round, dt);
    if (round.ended) { finish(); return; }
    const nextWave = waveForTime(round.time);
    if (nextWave !== wave) {
      wave = nextWave;
      ctx.status('Wave ' + wave + '. ' + (wave === 5 ? 'Final lock. Outlast the core for the win, or break it for bonus points.' : 'The ring is closing. Chain drone kills to build your multiplier.'));
      if (wave === 5) spawn('core');
      updateHud(true);
    }
    const radius = arenaRadius(round.time);
    shotClock -= dt;
    spawnClock -= dt;
    hazardClock -= dt;
    blinkClock = Math.max(0, blinkClock - dt);
    blinkTime = Math.max(0, blinkTime - dt);
    hurtFlash = Math.max(0, hurtFlash - dt);
    shake = Math.max(0, shake - dt);
    manualAim = Math.max(0, manualAim - dt);
    player = blinkTime > 0 ? movePlayer(player, blinkDirection, dt, radius, 550) : movePlayer(player, movement(), dt, radius);
    if (pointer && (manualAim > 0 || !assistedAim.checked)) aim = Math.atan2(pointer.y - player.y, pointer.x - player.x);
    else if (assistedAim.checked) {
      const target = nearestTarget(player, enemies);
      if (target) aim = Math.atan2(target.y - player.y, target.x - player.x);
    }
    if ((autoFire.checked || held.has('fire')) && shotClock <= 0) fire();
    if (spawnClock <= 0) {
      const roll = random();
      spawn(wave > 1 && roll > .7 ? 'sentry' : wave > 2 && roll < .2 ? 'charger' : 'runner');
      spawnClock = Math.max(.9, 2.8 - wave * .32);
    }
    if (hazardClock <= 0) {
      floorPulse(player.x, player.y);
      if (wave >= 3) {
        const angle = random() * Math.PI * 2, distance = random() * (radius - 45);
        floorPulse(CX + Math.cos(angle) * distance, CY + Math.sin(angle) * distance, 38);
      }
      hazardClock = 4.7 - wave * .35;
    }
    for (const enemy of enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt);
      if (enemy.warning > 0) { enemy.warning -= dt; continue; }
      const dx = player.x - enemy.x, dy = player.y - enemy.y, distance = Math.hypot(dx, dy) || 1;
      const direction = Math.atan2(dy, dx);
      enemy.cooldown -= dt;
      if (enemy.type === 'charger' && enemy.charge > 0) {
        enemy.charge -= dt;
        if (enemy.charge <= 0) { enemy.dash = .4; enemy.dx = dx / distance; enemy.dy = dy / distance; }
      } else if (enemy.dash > 0) {
        enemy.dash -= dt;
        enemy.x += enemy.dx * 305 * dt;
        enemy.y += enemy.dy * 305 * dt;
      } else if (enemy.type === 'sentry' && distance < 120) {
        enemy.x += -dx / distance * enemy.speed * .45 * dt;
        enemy.y += -dy / distance * enemy.speed * .45 * dt;
      } else {
        enemy.x += dx / distance * enemy.speed * dt;
        enemy.y += dy / distance * enemy.speed * dt;
      }
      const bounded = confine(enemy, radius);
      enemy.x = bounded.x;
      enemy.y = bounded.y;
      if (enemy.cooldown <= 0) {
        if (enemy.type === 'sentry') {
          for (const offset of wave >= 4 ? [-.18, 0, .18] : [0]) shot('enemy', enemy.x, enemy.y, direction + offset, { speed: 150 + wave * 6, color: COLORS.gold });
          enemy.cooldown = 2.1 + random() * .7;
        } else if (enemy.type === 'charger') {
          enemy.charge = .75;
          enemy.cooldown = 3.5;
        } else if (enemy.type === 'core') {
          // Its expanding aim ring is visible for the last .7 seconds before each volley.
          for (let i = 0; i < 8; i++) shot('enemy', enemy.x, enemy.y, direction + i * Math.PI / 4, { speed: 145, radius: 5, color: COLORS.violet });
          enemy.cooldown = 2.6;
        }
      }
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.r + player.r) {
        hurt();
        if (round.ended) return;
      }
    }
    for (const bullet of shots) {
      const x = bullet.x, y = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.owner === 'player') {
        for (const enemy of enemies) {
          if (enemy.hp <= 0 || enemy.warning > 0 || bullet.hits.includes(enemy.id) || bullet.life <= 0) continue;
          if (!segmentHit(x, y, bullet.x, bullet.y, enemy.x, enemy.y, enemy.r + bullet.r)) continue;
          bullet.hits.push(enemy.id);
          enemy.hp -= bullet.damage;
          enemy.hit = .09;
          if (bullet.pierce-- <= 0) bullet.life = 0;
          if (enemy.hp <= 0) {
            round = rewardKill(round, enemy.bounty);
            burst(enemy.x, enemy.y, enemy.color, enemy.type === 'core' ? 22 : 9);
            if (round.kills % 8 === 0 && cells.length < 8) cells.push({ x: enemy.x, y: enemy.y, r: 8, life: 12 });
            if (enemy.type === 'core') ctx.status('Core shattered. Hold the ring until the clock hits zero.');
          }
        }
      } else if (segmentHit(x, y, bullet.x, bullet.y, player.x, player.y, player.r + bullet.r)) {
        bullet.life = 0;
        hurt();
        if (round.ended) return;
      }
      if (Math.hypot(bullet.x - CX, bullet.y - CY) > radius + 4) bullet.life = 0;
    }
    for (const hazard of hazards) {
      hazard.age += dt;
      if (pulseHits(hazard, player)) { hurt(); if (round.ended) return; }
    }
    for (const cell of cells) {
      cell.life -= dt;
      const bounded = confine(cell, radius - 4);
      cell.x = bounded.x;
      cell.y = bounded.y;
      if (Math.hypot(cell.x - player.x, cell.y - player.y) < cell.r + player.r + 4 && round.hp < 5) {
        round = restoreShield(round);
        cell.life = 0;
        burst(cell.x, cell.y, COLORS.teal, 7);
        ctx.tone(980, .06);
      }
    }
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    enemies = enemies.filter(enemy => enemy.hp > 0);
    shots = shots.filter(bullet => bullet.life > 0);
    hazards = hazards.filter(hazard => hazard.age < hazard.warning + hazard.active + .18);
    cells = cells.filter(cell => cell.life > 0);
    particles = particles.filter(particle => particle.life > 0);
    updateHud();
  }

  function label(value, x, y, color = COLORS.muted, size = 12, align = 'center') {
    g.font = '650 ' + size + 'px system-ui';
    g.fillStyle = color;
    g.textAlign = align;
    g.fillText(value, x, y);
  }
  function draw() {
    const radius = arenaRadius(round.time), reduced = document.body.dataset.motion === 'reduced';
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#09151e';
    g.fillRect(0, 0, W, H);
    g.save();
    if (!reduced && shake > 0) g.translate(Math.sin(round.time * 91) * shake * 11, Math.cos(round.time * 83) * shake * 11);
    g.beginPath();
    g.arc(CX, CY, radius, 0, Math.PI * 2);
    g.fillStyle = '#102631';
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = '#23414c';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x < W; x += 36) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y < H; y += 36) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke();
    for (const r of [72, 144, 216]) {
      g.beginPath();
      g.arc(CX, CY, r, 0, Math.PI * 2);
      g.strokeStyle = '#365665';
      g.stroke();
    }
    for (const hazard of hazards) {
      const active = hazard.age >= hazard.warning;
      g.beginPath();
      g.arc(hazard.x, hazard.y, hazard.r, 0, Math.PI * 2);
      g.fillStyle = active ? '#f4ac684d' : '#f4ac6810';
      g.fill();
      g.strokeStyle = '#ffd196';
      g.lineWidth = active ? 3 : 1.5;
      g.setLineDash(active ? [] : [5, 5]);
      g.stroke();
      g.setLineDash([]);
      if (!active) {
        g.beginPath();
        g.arc(hazard.x, hazard.y, Math.max(2, hazard.r * (1 - hazard.age / hazard.warning)), 0, Math.PI * 2);
        g.stroke();
        label('!', hazard.x, hazard.y + 5, COLORS.gold, 16);
      }
    }
    for (const cell of cells) {
      g.save();
      g.translate(cell.x, cell.y);
      g.rotate(Math.PI / 4);
      g.fillStyle = '#79f6d524';
      g.strokeStyle = COLORS.teal;
      g.lineWidth = 2;
      g.fillRect(-7, -7, 14, 14);
      g.strokeRect(-7, -7, 14, 14);
      g.restore();
      label('+', cell.x, cell.y + 4, COLORS.teal, 12);
    }
    for (const bullet of shots) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      g.lineWidth = bullet.r * 1.4;
      g.strokeStyle = bullet.color;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bullet.x - Math.cos(angle) * (bullet.owner === 'player' ? 10 : 5), bullet.y - Math.sin(angle) * (bullet.owner === 'player' ? 10 : 5));
      g.lineTo(bullet.x, bullet.y);
      g.stroke();
    }
    for (const enemy of enemies) {
      g.save();
      g.translate(enemy.x, enemy.y);
      if (enemy.warning > 0) {
        g.strokeStyle = enemy.color;
        g.setLineDash([3, 5]);
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(0, 0, enemy.r + 11, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = .38;
      }
      if (enemy.charge > 0 || (enemy.type === 'core' && enemy.cooldown < .7 && enemy.warning <= 0)) {
        g.strokeStyle = COLORS.gold;
        g.lineWidth = 1;
        g.setLineDash([6, 6]);
        if (enemy.type === 'charger') {
          g.beginPath();
          g.moveTo(0, 0);
          const direction = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          g.lineTo(Math.cos(direction) * 140, Math.sin(direction) * 140);
          g.stroke();
        } else {
          g.beginPath(); g.arc(0, 0, enemy.r + 14, 0, Math.PI * 2); g.stroke();
        }
        g.setLineDash([]);
      }
      g.rotate(Math.atan2(player.y - enemy.y, player.x - enemy.x));
      g.beginPath();
      const sides = enemy.type === 'runner' ? 3 : enemy.type === 'sentry' ? 4 : enemy.type === 'core' ? 8 : 6;
      for (let i = 0; i < sides; i++) {
        const a = i * Math.PI * 2 / sides;
        const x = Math.cos(a) * enemy.r, y = Math.sin(a) * enemy.r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      g.fillStyle = enemy.hit > 0 ? COLORS.ink : enemy.color;
      g.fill();
      g.strokeStyle = '#ffe9f4';
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = '#122535';
      g.beginPath(); g.arc(0, 0, enemy.r * .4, 0, Math.PI * 2); g.fill();
      g.restore();
      if (enemy.hp < enemy.maxHp && enemy.warning <= 0) {
        g.fillStyle = '#09141a'; g.fillRect(enemy.x - 14, enemy.y - enemy.r - 10, 28, 3);
        g.fillStyle = enemy.color; g.fillRect(enemy.x - 14, enemy.y - enemy.r - 10, 28 * Math.max(0, enemy.hp / enemy.maxHp), 3);
      }
    }
    if (!reduced) for (const particle of particles) {
      g.globalAlpha = Math.min(1, particle.life * 3);
      g.fillStyle = particle.color;
      g.fillRect(particle.x - 1.5, particle.y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
    g.save();
    g.translate(player.x, player.y);
    if (round.immunity > 0 || blinkTime > 0) {
      g.beginPath(); g.arc(0, 0, player.r + 6, 0, Math.PI * 2);
      g.strokeStyle = blinkTime > 0 ? COLORS.violet : '#79f6d577';
      g.lineWidth = 2;
      g.stroke();
    }
    g.rotate(aim);
    g.beginPath();
    g.moveTo(13, 0); g.lineTo(-6, -10); g.lineTo(-10, 0); g.lineTo(-6, 10); g.closePath();
    g.fillStyle = blinkTime > 0 ? COLORS.violet : COLORS.teal;
    g.strokeStyle = COLORS.ink;
    g.lineWidth = 1.6;
    g.fill(); g.stroke();
    g.fillStyle = WEAPONS[weapon].color;
    g.fillRect(7, -3, 15, 6);
    g.restore();
    g.restore();
    g.beginPath();
    g.arc(CX, CY, radius, 0, Math.PI * 2);
    g.lineWidth = 3;
    g.strokeStyle = wave >= 4 ? COLORS.gold : '#90c8bf';
    g.stroke();
    g.beginPath();
    g.arc(CX, CY, radius + 9, -.5 * Math.PI, -.5 * Math.PI + Math.PI * 2 * (1 - round.time / ROUND_SECONDS));
    g.lineWidth = 2;
    g.strokeStyle = COLORS.violet;
    g.stroke();
    label(WEAPONS[weapon].name.toUpperCase(), 22, 29, WEAPONS[weapon].color, 11, 'left');
    label('CHAIN ×' + round.combo, W - 22, 29, COLORS.gold, 11, 'right');
    label('SURVIVE THE LOCK', CX, H - 14, '#78a0a9', 10);
    if (!reduced && hurtFlash > 0) { g.fillStyle = '#ffd196' + Math.round(hurtFlash * 180).toString(16).padStart(2, '0'); g.fillRect(0, 0, W, H); }
    if (stick) {
      g.strokeStyle = '#d5fff466'; g.fillStyle = '#79f6d52a'; g.lineWidth = 2;
      g.beginPath(); g.arc(stick.origin.x, stick.origin.y, 36, 0, Math.PI * 2); g.stroke();
      const dx = stick.location.x - stick.origin.x, dy = stick.location.y - stick.origin.y;
      const distance = Math.hypot(dx, dy), scale = distance > 36 ? 36 / distance : 1;
      g.beginPath(); g.arc(stick.origin.x + dx * scale, stick.origin.y + dy * scale, 13, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  ctx.status('Choose a weapon. Assisted aim and auto-fire are on. Touch players can drag anywhere in the arena to move.');
  ctx.frame = dt => {
    if (!ctx.active) return;
    if (started && !ctx.ended) update(dt);
    draw();
  };
  draw();
}

import {
  clamp, seededRandom, moveInArena, segmentCircleHit, segmentRectHit,
  breachWave, createRacer, stepRacer, roadCenter, roadSlope, passingEvent,
} from './action-core.js?v=5.4.0';

const element = (tag, className, text) => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
};

function stage(ctx, width, height, label) {
  const wrapper = element('div', 'action-stage');
  const view = element('canvas');
  const scale = Math.min(devicePixelRatio || 1, 2);
  view.width = width * scale;
  view.height = height * scale;
  view.style.width = width + 'px';
  view.style.aspectRatio = width + '/' + height;
  view.setAttribute('role', 'img');
  view.setAttribute('aria-label', label);
  view.tabIndex = 0;
  const draw = view.getContext('2d');
  draw.scale(scale, scale);
  const panel = element('section', 'action-panel');
  wrapper.append(view, panel);
  ctx.board.append(wrapper);
  const point = event => {
    const rect = view.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height };
  };
  return { wrapper, view, draw, panel, point };
}

function makeHud(ctx, labels) {
  const row = element('div', 'action-hud');
  const fields = labels.map(([label, initial]) => {
    const item = element('div');
    const value = element('strong', '', initial);
    item.append(element('span', '', label), value);
    row.append(item);
    return value;
  });
  ctx.board.prepend(row);
  return fields;
}

function toggle(ctx, title, checked) {
  const label = element('label', 'action-toggle');
  const input = element('input');
  input.type = 'checkbox';
  input.checked = checked;
  label.append(input, element('span', '', title));
  ctx.controls.append(label);
  return input;
}

function heldControl(ctx, parent, held, text, action, label) {
  const button = ctx.button(text, () => {
    held.add(action);
    ctx.after(.14, () => held.delete(action));
  }, { parent, label });
  ctx.listen(button, 'pointerdown', event => {
    event.preventDefault();
    held.add(action);
    button.setPointerCapture?.(event.pointerId);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    ctx.listen(button, event, () => held.delete(action));
  }
  return button;
}

function text(g, value, x, y, size = 12, color = '#b7d1ce', align = 'left') {
  g.fillStyle = color;
  g.font = '650 ' + size + 'px system-ui';
  g.textAlign = align;
  g.fillText(value, x, y);
}

function breach(ctx) {
  const W = 720, H = 460;
  const { view, draw: g, panel, point } = stage(ctx, W, H, 'Breachline arena. Move through cover, dodge drone fire, and defeat the Warden.');
  const [sectorHud, hullHud, comboHud, dashHud] = makeHud(ctx, [['Sector', '1 / 6'], ['Hull', '5 / 5'], ['Streak', 'x1'], ['Dash', 'Ready']]);
  const autoFire = toggle(ctx, 'Auto-fire', true);
  const held = new Set();
  const pad = element('div', 'action-pad');
  ctx.controls.append(pad);
  for (const [label, action, name] of [['↑', 'up', 'Move up'], ['←', 'left', 'Move left'], ['↓', 'down', 'Move down'], ['→', 'right', 'Move right']]) {
    heldControl(ctx, pad, held, label, action, name);
  }
  heldControl(ctx, pad, held, 'Fire', 'fire', 'Fire weapon');
  ctx.button('Dash', () => dash(), { parent: pad, label: 'Dash through incoming fire' });

  const walls = [
    { x: 140, y: 108, w: 120, h: 28 }, { x: 460, y: 324, w: 120, h: 28 },
    { x: 320, y: 178, w: 80, h: 28 }, { x: 320, y: 254, w: 80, h: 28 },
    { x: 92, y: 290, w: 30, h: 82 }, { x: 598, y: 88, w: 30, h: 82 },
  ];
  let player = { x: W / 2, y: H / 2, r: 11 };
  let sector = 1, health = 5, maxHealth = 5, score = 0, kills = 0;
  let started = false, choosing = false, clock = 0, spawnClock = 0;
  let enemies = [], queue = [], bullets = [], particles = [], pickups = [];
  let nextId = 1, shotClock = 0, dashClock = 0, dashTime = 0, hurtTime = 0;
  let aim = -Math.PI / 2, manualAim = 0, pointer = null;
  let combo = 1, comboClock = 0, fireLevel = 0, spreadLevel = 0, speedLevel = 0;
  let dashVector = { x: 0, y: -1 }, flash = 0, lastHud = -1;
  const random = seededRandom(7317);
  const spawns = [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40], [W / 2, 40], [W / 2, H - 40]];

  const resetHeld = () => { held.clear(); pointer = null; manualAim = 0; };
  ctx.onPause = resetHeld;
  ctx.listen(window, 'blur', resetHeld);
  ctx.listen(document, 'keydown', event => {
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    const actions = { w: 'up', s: 'down', a: 'left', d: 'right', ' ': 'fire', arrowup: 'aimup', arrowdown: 'aimdown', arrowleft: 'aimleft', arrowright: 'aimright' };
    if (actions[key]) { event.preventDefault(); held.add(actions[key]); }
    if (key === 'shift' && !event.repeat) { event.preventDefault(); dash(); }
    if (key === 'enter' && !started) { event.preventDefault(); begin(); }
  });
  ctx.listen(document, 'keyup', event => {
    const actions = { w: 'up', s: 'down', a: 'left', d: 'right', ' ': 'fire', arrowup: 'aimup', arrowdown: 'aimdown', arrowleft: 'aimleft', arrowright: 'aimright' };
    held.delete(actions[event.key.toLowerCase()]);
  });
  ctx.listen(view, 'pointermove', event => {
    if (event.pointerType === 'touch') return;
    pointer = point(event);
    manualAim = 1.5;
  });
  ctx.listen(view, 'pointerdown', event => {
    if (!started || choosing || ctx.ended) return;
    event.preventDefault();
    pointer = point(event);
    manualAim = 1.5;
    held.add('fire');
    view.setPointerCapture?.(event.pointerId);
  });
  for (const type of ['pointerup', 'pointercancel']) ctx.listen(view, type, () => held.delete('fire'));

  function dash() {
    if (!started || choosing || ctx.ended || dashClock > 0) return;
    let dx = Number(held.has('right')) - Number(held.has('left'));
    let dy = Number(held.has('down')) - Number(held.has('up'));
    if (!dx && !dy) { dx = Math.cos(aim); dy = Math.sin(aim); }
    const size = Math.hypot(dx, dy) || 1;
    dashVector = { x: dx / size, y: dy / size };
    dashTime = .17;
    dashClock = 2.1;
    ctx.tone(740, .04);
  }

  const burst = (x, y, color, amount = 10) => {
    for (let i = 0; i < amount && particles.length < 160; i++) {
      const angle = random() * Math.PI * 2, speed = 30 + random() * 140;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .3 + random() * .3, color });
    }
  };
  const lineClear = (a, b) => !walls.some(wall => segmentRectHit(a.x, a.y, b.x, b.y, wall, 2));
  const updateHud = (force = false) => {
    if (!force && clock - lastHud < .1) return;
    lastHud = clock;
    sectorHud.textContent = sector + ' / 6';
    hullHud.textContent = health + ' / ' + maxHealth;
    comboHud.textContent = 'x' + combo;
    dashHud.textContent = dashClock <= 0 ? 'Ready' : dashClock.toFixed(1) + 's';
  };
  function begin() {
    if (started || ctx.ended) return;
    started = true;
    panel.hidden = true;
    startSector();
    view.focus?.({ preventScroll: true });
  }
  function startSector() {
    choosing = false;
    enemies = [];
    bullets = [];
    queue = breachWave(sector);
    spawnClock = .8;
    shotClock = 0;
    hurtTime = 1.2;
    panel.hidden = true;
    ctx.status(sector === 6 ? 'The Warden is awake. Break its escort, then its core.' : 'Sector ' + sector + '. Cover blocks shots from both sides. Keep moving.');
    updateHud(true);
  }
  function spawn(type) {
    const candidates = spawns.filter(([x, y]) => Math.hypot(x - player.x, y - player.y) > 220);
    const [x, y] = candidates[Math.floor(random() * candidates.length)] || spawns[0];
    const stats = {
      seeker: { r: 10, hp: 2, speed: 64 + sector * 5, color: '#ff889f', bounty: 110 },
      gunner: { r: 12, hp: 3, speed: 42, color: '#ffd58b', bounty: 170 },
      tank: { r: 18, hp: 8, speed: 31, color: '#ac99ff', bounty: 260 },
      warden: { r: 28, hp: 65, speed: 24, color: '#ffbb74', bounty: 1800 },
    }[type];
    enemies.push({ ...stats, id: nextId++, type, x, y, maxHp: stats.hp, fire: 1.3 + random(), stuck: 0, hit: 0 });
    burst(x, y, stats.color, 8);
  }
  function fireShot(owner, x, y, angle, speed, damage = 1, radius = 3) {
    if (bullets.length >= 180) return;
    bullets.push({ owner, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, r: radius, life: 1.7 });
  }
  function damagePlayer() {
    if (hurtTime > 0 || dashTime > 0 || ctx.ended) return;
    health--;
    hurtTime = 1.15;
    combo = 1;
    flash = .14;
    burst(player.x, player.y, '#ffd58b', 12);
    ctx.tone(130, .1);
    updateHud(true);
    if (health <= 0) {
      resetHeld();
      ctx.finish('Hull lost in sector ' + sector + '. ' + kills + ' drones cleared. Rebuild your loadout and go again.', score, { won: false, sector, kills });
    }
  }
  function clearSector() {
    bullets = [];
    score += 250 * sector;
    ctx.score(score);
    resetHeld();
    if (sector === 6) {
      score += health * 300;
      ctx.score(score);
      ctx.finish('Warden down. All six sectors cleared with ' + health + ' hull remaining.', score, { won: true, sector, kills });
      return;
    }
    choosing = true;
    panel.hidden = false;
    panel.replaceChildren(element('p', 'action-kicker', 'SECTOR ' + sector + ' CLEAR'), element('h2', '', 'Build your next advantage.'), element('p', 'action-copy', 'Choose one permanent upgrade. The arena waits for you.'));
    const choices = element('div', 'upgrade-choices');
    panel.append(choices);
    const upgrades = [
      ['Overclock', 'Faster fire rate', () => fireLevel++],
      ['Split shot', 'Add an angled projectile', () => spreadLevel = Math.min(3, spreadLevel + 1)],
      ['Reinforce', '+1 max hull and repair 2', () => { maxHealth++; health = Math.min(maxHealth, health + 2); }],
    ];
    // A maxed weapon gets a movement choice instead of a wasted upgrade.
    if (spreadLevel >= 3) upgrades[1] = ['Light chassis', 'Move faster', () => speedLevel++];
    upgrades.forEach(([name, detail, effect]) => {
      const button = ctx.button(name, () => {
        if (!choosing || ctx.ended) return;
        effect();
        sector++;
        startSector();
      }, { parent: choices });
      button.append(element('small', '', detail));
    });
    choices.querySelector('button')?.focus({ preventScroll: true });
    ctx.status('Sector cleared. Choose your upgrade above to continue.');
  }

  function simulate(dt) {
    clock += dt;
    dashClock = Math.max(0, dashClock - dt);
    dashTime = Math.max(0, dashTime - dt);
    hurtTime = Math.max(0, hurtTime - dt);
    manualAim = Math.max(0, manualAim - dt);
    comboClock = Math.max(0, comboClock - dt);
    flash = Math.max(0, flash - dt);
    if (!comboClock) combo = 1;
    let dx = Number(held.has('right')) - Number(held.has('left'));
    let dy = Number(held.has('down')) - Number(held.has('up'));
    const movement = Math.hypot(dx, dy) || 1;
    const speed = 174 + speedLevel * 22;
    if (dashTime > 0) { dx = dashVector.x * 690; dy = dashVector.y * 690; }
    else { dx = dx / movement * speed; dy = dy / movement * speed; }
    player = moveInArena(player, dx * dt, dy * dt, walls, W, H);

    const aimX = Number(held.has('aimright')) - Number(held.has('aimleft'));
    const aimY = Number(held.has('aimdown')) - Number(held.has('aimup'));
    let target = null, nearest = Infinity;
    for (const enemy of enemies) {
      const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (distance < nearest && lineClear(player, enemy)) { nearest = distance; target = enemy; }
    }
    if (aimX || aimY) aim = Math.atan2(aimY, aimX);
    else if (manualAim > 0 && pointer) aim = Math.atan2(pointer.y - player.y, pointer.x - player.x);
    else if (target) aim = Math.atan2(target.y - player.y, target.x - player.x);

    shotClock -= dt;
    const wantsFire = held.has('fire') || (autoFire.checked && target);
    if (wantsFire && shotClock <= 0) {
      shotClock = Math.max(.1, .28 * .81 ** fireLevel);
      fireShot('player', player.x + Math.cos(aim) * 16, player.y + Math.sin(aim) * 16, aim, 570);
      if (spreadLevel > 0) fireShot('player', player.x, player.y, aim - .15, 570);
      if (spreadLevel > 1) fireShot('player', player.x, player.y, aim + .15, 570);
      if (spreadLevel > 2) fireShot('player', player.x, player.y, aim, 600, 2, 4);
      ctx.tone(480, .025);
    }

    spawnClock -= dt;
    if (queue.length && spawnClock <= 0) { spawn(queue.shift()); spawnClock = .85; }
    for (const enemy of enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt);
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      let moveAngle = angle;
      const blocked = !lineClear(enemy, player);
      if (blocked) {
        // Pick a visible cover corner that also has a path to the player.
        let choice = null, cost = Infinity;
        for (const wall of walls) {
          for (const corner of [{ x: wall.x - enemy.r - 12, y: wall.y - enemy.r - 12 }, { x: wall.x + wall.w + enemy.r + 12, y: wall.y - enemy.r - 12 }, { x: wall.x - enemy.r - 12, y: wall.y + wall.h + enemy.r + 12 }, { x: wall.x + wall.w + enemy.r + 12, y: wall.y + wall.h + enemy.r + 12 }]) {
            if (!lineClear(enemy, corner) || !lineClear(corner, player)) continue;
            const nextCost = Math.hypot(enemy.x - corner.x, enemy.y - corner.y) + Math.hypot(player.x - corner.x, player.y - corner.y);
            if (nextCost < cost) { cost = nextCost; choice = corner; }
          }
        }
        if (choice) moveAngle = Math.atan2(choice.y - enemy.y, choice.x - enemy.x);
        else moveAngle += Math.sin(clock * 2 + enemy.id) > 0 ? .8 : -.8;
      }
      if (enemy.type === 'seeker' || distance > (enemy.type === 'warden' ? 220 : 170) || blocked) {
        const moved = moveInArena(enemy, Math.cos(moveAngle) * enemy.speed * dt, Math.sin(moveAngle) * enemy.speed * dt, walls, W, H);
        enemy.x = moved.x; enemy.y = moved.y;
      }
      if (distance < enemy.r + player.r + 2) damagePlayer();
      if (ctx.ended) return;
      if (enemy.type !== 'seeker') {
        enemy.fire -= dt;
        if (enemy.fire <= 0 && !blocked) {
          enemy.fire = enemy.type === 'warden' ? .95 : enemy.type === 'tank' ? 2.7 : 1.8;
          const shots = enemy.type === 'warden' ? 5 : enemy.type === 'tank' ? 3 : 1;
          for (let i = 0; i < shots; i++) {
            const shotAngle = angle + (i - (shots - 1) / 2) * .19;
            fireShot('enemy', enemy.x + Math.cos(shotAngle) * (enemy.r + 5), enemy.y + Math.sin(shotAngle) * (enemy.r + 5), shotAngle, enemy.type === 'warden' ? 170 : 155, 1, 4);
          }
        }
      }
    }

    for (const bullet of bullets) {
      const oldX = bullet.x, oldY = bullet.y;
      bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
      if (bullet.x < 8 || bullet.y < 8 || bullet.x > W - 8 || bullet.y > H - 8 || walls.some(wall => segmentRectHit(oldX, oldY, bullet.x, bullet.y, wall, bullet.r))) {
        bullet.life = 0;
        continue;
      }
      if (bullet.owner === 'player') {
        for (const enemy of enemies) {
          if (enemy.hp <= 0 || !segmentCircleHit(oldX, oldY, bullet.x, bullet.y, enemy.x, enemy.y, enemy.r + bullet.r)) continue;
          enemy.hp -= bullet.damage;
          enemy.hit = .07;
          bullet.life = 0;
          burst(bullet.x, bullet.y, enemy.color, 3);
          if (enemy.hp <= 0) {
            kills++;
            combo = Math.min(5, combo + 1);
            comboClock = 3.2;
            score += enemy.bounty * combo;
            ctx.score(score);
            burst(enemy.x, enemy.y, enemy.color, enemy.type === 'warden' ? 30 : 12);
            if (kills % 7 === 0) pickups.push({ x: enemy.x, y: enemy.y, life: 14 });
          }
          break;
        }
      } else if (segmentCircleHit(oldX, oldY, bullet.x, bullet.y, player.x, player.y, player.r + bullet.r)) {
        bullet.life = 0;
        damagePlayer();
        if (ctx.ended) return;
      }
    }
    bullets = bullets.filter(bullet => bullet.life > 0);
    enemies = enemies.filter(enemy => enemy.hp > 0);
    for (const pickup of pickups) {
      pickup.life -= dt;
      if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 25) {
        health = Math.min(maxHealth, health + 1);
        score += 80;
        ctx.score(score);
        pickup.life = 0;
        ctx.tone(840, .06);
      }
    }
    pickups = pickups.filter(pickup => pickup.life > 0);
    particles.forEach(particle => { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; });
    particles = particles.filter(particle => particle.life > 0);
    updateHud();
    if (!queue.length && !enemies.length && !ctx.ended) clearSector();
  }

  function paint() {
    g.fillStyle = '#09161d'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#18323b'; g.lineWidth = 1;
    for (let x = 24; x < W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 6; y < H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = '#37747a'; g.lineWidth = 2; g.strokeRect(8, 8, W - 16, H - 16);
    text(g, 'BREACH / ' + String(sector).padStart(2, '0'), 22, 31, 10, '#60898d');
    text(g, (queue.length + enemies.length) + ' HOSTILES', W - 22, 31, 10, '#60898d', 'right');
    for (const wall of walls) {
      g.fillStyle = '#050e1580'; g.fillRect(wall.x + 6, wall.y + 6, wall.w, wall.h);
      g.fillStyle = '#213c49'; g.fillRect(wall.x, wall.y, wall.w, wall.h);
      g.strokeStyle = '#416978'; g.strokeRect(wall.x + .5, wall.y + .5, wall.w - 1, wall.h - 1);
      g.fillStyle = '#68d8bd'; g.fillRect(wall.x + 5, wall.y + 4, Math.min(22, wall.w - 10), 2);
    }
    for (const pickup of pickups) {
      g.save(); g.translate(pickup.x, pickup.y); g.rotate(Math.PI / 4);
      g.fillStyle = '#65e9cc'; g.fillRect(-8, -8, 16, 16); g.restore();
      text(g, '+', pickup.x, pickup.y + 4, 13, '#092822', 'center');
    }
    for (const particle of particles) {
      g.globalAlpha = clamp(particle.life * 2, 0, 1);
      g.fillStyle = particle.color; g.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
    g.globalAlpha = 1;
    for (const bullet of bullets) {
      g.strokeStyle = bullet.owner === 'player' ? '#8fffe0' : '#ffafaa'; g.lineWidth = bullet.r * 1.4;
      g.beginPath(); g.moveTo(bullet.x - bullet.vx * .012, bullet.y - bullet.vy * .012); g.lineTo(bullet.x, bullet.y); g.stroke();
    }
    for (const enemy of enemies) {
      g.save(); g.translate(enemy.x, enemy.y);
      g.rotate(Math.atan2(player.y - enemy.y, player.x - enemy.x));
      g.fillStyle = enemy.hit > 0 ? '#ffffff' : enemy.color;
      g.beginPath();
      if (enemy.type === 'seeker') { g.moveTo(enemy.r + 4, 0); g.lineTo(-enemy.r, -enemy.r); g.lineTo(-enemy.r * .5, 0); g.lineTo(-enemy.r, enemy.r); }
      else { g.rect(-enemy.r, -enemy.r, enemy.r * 2, enemy.r * 2); }
      g.closePath(); g.fill();
      g.fillStyle = '#142330'; g.fillRect(-enemy.r * .5, -4, enemy.r, 8);
      if (enemy.type === 'warden') { g.strokeStyle = '#ffe7b1'; g.lineWidth = 3; g.strokeRect(-enemy.r - 5, -enemy.r - 5, enemy.r * 2 + 10, enemy.r * 2 + 10); }
      g.restore();
      if (enemy.hp < enemy.maxHp) {
        g.fillStyle = '#24353f'; g.fillRect(enemy.x - enemy.r, enemy.y - enemy.r - 12, enemy.r * 2, 3);
        g.fillStyle = enemy.color; g.fillRect(enemy.x - enemy.r, enemy.y - enemy.r - 12, enemy.r * 2 * enemy.hp / enemy.maxHp, 3);
      }
    }
    g.save(); g.translate(player.x, player.y); g.rotate(aim);
    g.globalAlpha = hurtTime > 0 ? .6 + Math.sin(clock * 24) * .25 : 1;
    if (dashTime > 0) { g.fillStyle = '#65e9cc30'; g.fillRect(-38, -9, 36, 18); }
    g.fillStyle = '#76f3d0'; g.beginPath(); g.arc(0, 0, player.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e0fff2'; g.fillRect(3, -3, 19, 6);
    g.fillStyle = '#12342e'; g.fillRect(-6, -4, 8, 8); g.restore(); g.globalAlpha = 1;
    if (pointer && manualAim > 0) {
      g.strokeStyle = '#b8fbe278'; g.lineWidth = 1;
      g.beginPath(); g.arc(pointer.x, pointer.y, 9, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#b8fbe2'; g.fillRect(pointer.x - 1, pointer.y - 1, 2, 2);
    }
    if (flash > 0 && document.body.dataset.motion !== 'reduced') { g.fillStyle = '#ff778d22'; g.fillRect(0, 0, W, H); }
  }

  panel.append(element('p', 'action-kicker', 'AETHER ORIGINAL / TACTICAL ARCADE'), element('h2', '', 'Hold the line.'), element('p', 'action-copy', 'Six sectors of drones. Cover that works. Upgrades that change your run. Make the Warden regret waking up.'));
  const hints = element('div', 'action-hints');
  hints.append(element('span', '', 'WASD move'), element('span', '', 'Mouse aim'), element('span', '', 'Shift dash'));
  panel.append(hints);
  ctx.button('Breach sector one', begin, { primary: true, parent: panel });
  ctx.frame = dt => {
    if (started && !choosing && !ctx.ended) simulate(dt);
    paint();
  };
  ctx.status('Auto-fire is on. Use cover, keep moving, and choose an upgrade after every sector.');
  paint();
}

function overdrive(ctx) {
  const W = 720, H = 440, finishLine = 22000;
  const { view, draw: g, panel } = stage(ctx, W, H, 'Overdrive highway. Steer around traffic, collect batteries, and reach checkpoints before time expires.');
  const [speedHud, distanceHud, timeHud, hullHud] = makeHud(ctx, [['Speed', '0 km/h'], ['Distance', '0.0 / 4.4 km'], ['Clock', '50.0s'], ['Hull', '3 / 3']]);
  const cruise = toggle(ctx, 'Cruise assist', true);
  const held = new Set();
  const pad = element('div', 'action-pad race-pad');
  ctx.controls.append(pad);
  for (const [label, action, name] of [['←', 'left', 'Steer left'], ['→', 'right', 'Steer right'], ['Brake', 'brake', 'Brake'], ['Nitro', 'boost', 'Use nitro boost']]) heldControl(ctx, pad, held, label, action, name);
  let racer = createRacer(), started = false, remaining = 50, health = 3;
  let traffic = [], batteries = [], checkpoint = 6000, nearMisses = 0, score = 0;
  let invulnerable = 0, messageTime = 0, message = '', clock = 0, lastHud = -1;
  let nextTraffic = 800, nextBattery = 1700;
  const random = seededRandom(94821);
  const colors = ['#ff929d', '#f5d189', '#9db8ff', '#ae9deb', '#88c8db'];
  const resetHeld = () => held.clear();
  ctx.onPause = resetHeld;
  ctx.listen(window, 'blur', resetHeld);
  ctx.listen(document, 'keydown', event => {
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const actions = { a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', s: 'brake', arrowdown: 'brake', w: 'accelerate', arrowup: 'accelerate', ' ': 'boost' };
    const action = actions[event.key.toLowerCase()];
    if (action) { event.preventDefault(); held.add(action); }
    if (event.key === 'Enter' && !started) { event.preventDefault(); begin(); }
  });
  ctx.listen(document, 'keyup', event => {
    const actions = { a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', s: 'brake', arrowdown: 'brake', w: 'accelerate', arrowup: 'accelerate', ' ': 'boost' };
    held.delete(actions[event.key.toLowerCase()]);
  });

  function notice(value) { message = value; messageTime = 2; ctx.status(value); }
  function begin() {
    if (started || ctx.ended) return;
    started = true;
    panel.hidden = true;
    notice('Midnight run. Three checkpoints, 4.4 km. Find the gaps.');
  }
  function finish(won, reason) {
    resetHeld();
    if (won) score += Math.round(remaining * 40) + health * 400;
    ctx.score(score);
    ctx.finish(won ? 'Finish line. ' + remaining.toFixed(1) + ' seconds to spare, ' + nearMisses + ' close passes.' : reason + ' ' + (racer.distance / 5000).toFixed(1) + ' km and ' + nearMisses + ' close passes.', score, { won, distance: Math.round(racer.distance), nearMisses, timeRemaining: Math.max(0, remaining) });
  }
  function populate() {
    while (nextTraffic < racer.distance + 7000) {
      const lane = Math.floor(random() * 3) - 1;
      traffic.push({ z: nextTraffic, x: lane * .67, speed: 112 + random() * 76, color: colors[Math.floor(random() * colors.length)], passed: false });
      nextTraffic += 450 + random() * 650;
    }
    while (nextBattery < racer.distance + 7000) {
      batteries.push({ z: nextBattery, x: (Math.floor(random() * 3) - 1) * .67, passed: false });
      nextBattery += 2300 + random() * 1400;
    }
  }
  function updateHud(force = false) {
    if (!force && clock - lastHud < .1) return;
    lastHud = clock;
    speedHud.textContent = Math.round(racer.speed * .72) + ' km/h';
    distanceHud.textContent = (racer.distance / 5000).toFixed(1) + ' / 4.4 km';
    timeHud.textContent = Math.max(0, remaining).toFixed(1) + 's';
    hullHud.textContent = health + ' / 3';
    view.setAttribute('aria-label', 'Overdrive highway. ' + Math.round(racer.speed * .72) + ' km/h. ' + Math.round(racer.nitro) + ' percent nitro. ' + health + ' hull.');
  }
  function simulate(dt) {
    clock += dt;
    remaining -= dt;
    invulnerable = Math.max(0, invulnerable - dt);
    messageTime = Math.max(0, messageTime - dt);
    const before = racer;
    racer = stepRacer(racer, { steer: Number(held.has('right')) - Number(held.has('left')), accelerate: cruise.checked || held.has('accelerate'), brake: held.has('brake'), boost: held.has('boost') }, dt);
    populate();
    for (const car of traffic) {
      const gapBefore = car.z - before.distance;
      car.z += car.speed * dt;
      const gapNow = car.z - racer.distance;
      if (car.passed) continue;
      const event = passingEvent(gapBefore, gapNow, racer.x - car.x, .23);
      if (!event) continue;
      car.passed = true;
      if (event === 'collision' && invulnerable <= 0) {
        health--;
        racer.speed *= .43;
        invulnerable = 1.8;
        notice('Traffic hit. ' + health + ' hull remaining. Brake early or pick a new lane.');
        ctx.tone(110, .12);
        if (health <= 0) { finish(false, 'Hull lost.'); return; }
      } else if (event === 'near' && racer.speed > 230 && invulnerable <= 0) {
        nearMisses++;
        score += 180;
        racer.nitro = Math.min(100, racer.nitro + 16);
        notice('Close pass +180. Nitro +16.');
        ctx.tone(630, .05);
      }
    }
    for (const battery of batteries) {
      if (battery.passed) continue;
      const event = passingEvent(battery.z - before.distance, battery.z - racer.distance, racer.x - battery.x, .24);
      if (!event) continue;
      battery.passed = true;
      if (event === 'collision') {
        racer.nitro = Math.min(100, racer.nitro + 38);
        score += 120;
        notice('Battery collected. Nitro +38.');
        ctx.tone(850, .055);
      }
    }
    traffic = traffic.filter(car => car.z > racer.distance - 600);
    batteries = batteries.filter(battery => battery.z > racer.distance - 600);
    while (racer.distance >= checkpoint && checkpoint <= 18000) {
      remaining += 12;
      score += 400;
      checkpoint += 6000;
      notice('Checkpoint. +12 seconds. Keep the run alive.');
      ctx.tone(960, .12);
    }
    score += (racer.distance - before.distance) / 10;
    ctx.score(score);
    updateHud();
    if (racer.distance >= finishLine) finish(true);
    else if (remaining <= 0) finish(false, 'Time expired.');
    else if (!messageTime) ctx.status(racer.offroad ? 'Shoulder slows you down. Bring the car back between the road lines.' : 'Steer A/D. Brake S. Nitro Space. Close passes refill boost.');
  }

  const project = (z, lateral = 0) => {
    const ahead = Math.max(80, z - racer.distance + 1100);
    const scale = .88 / ahead;
    const bend = roadCenter(z) - roadCenter(racer.distance) - roadSlope(racer.distance) * (z - racer.distance);
    return { x: W / 2 + (bend + (lateral - racer.x) * 1400) * scale * W / 2, y: H * .40 + 860 * scale * H / 2, half: 1400 * scale * W / 2, scale };
  };
  const quad = (a, b, left, right, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(a.x + a.half * left, a.y); g.lineTo(a.x + a.half * right, a.y);
    g.lineTo(b.x + b.half * right, b.y); g.lineTo(b.x + b.half * left, b.y);
    g.closePath(); g.fill();
  };
  function drawCar(x, y, width, height, color, lean = 0, playerCar = false) {
    g.save(); g.translate(x, y); g.rotate(lean);
    g.fillStyle = '#030b1570'; g.fillRect(-width * .57, -height * .05, width * 1.14, height * .16);
    g.fillStyle = '#101723';
    g.fillRect(-width * .59, -height * .76, width * .2, height * .5);
    g.fillRect(width * .39, -height * .76, width * .2, height * .5);
    g.fillStyle = color;
    g.beginPath(); g.moveTo(-width * .47, 0); g.lineTo(-width * .45, -height * .62); g.lineTo(-width * .27, -height); g.lineTo(width * .27, -height); g.lineTo(width * .45, -height * .62); g.lineTo(width * .47, 0); g.closePath(); g.fill();
    g.fillStyle = '#112937'; g.fillRect(-width * .27, -height * .75, width * .54, height * .24);
    g.fillStyle = '#eefbf578'; g.fillRect(-width * .36, -height * .34, width * .72, height * .07);
    g.fillStyle = '#ff8296'; g.fillRect(-width * .4, -height * .14, width * .2, height * .06); g.fillRect(width * .2, -height * .14, width * .2, height * .06);
    if (playerCar && racer.boosting) {
      g.fillStyle = '#a2ffe9';
      for (const side of [-1, 1]) { g.beginPath(); g.moveTo(side * width * .2 - 5, 0); g.lineTo(side * width * .2 + 5, 0); g.lineTo(side * width * .2, 16 + Math.sin(clock * 50) * 5); g.fill(); }
    }
    g.restore();
  }
  function paint() {
    const sky = g.createLinearGradient(0, 0, 0, H * .5);
    sky.addColorStop(0, '#101a37'); sky.addColorStop(.8, '#385270'); sky.addColorStop(1, '#b4969a');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#eac7a87a'; g.beginPath(); g.arc(W * .77, H * .20, 28, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b3049';
    g.beginPath(); g.moveTo(0, H * .44);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, H * .34 - Math.sin(x * .017 + .3) * 22 - Math.cos(x * .039) * 15);
    g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    g.fillStyle = '#172e36'; g.fillRect(0, H * .42, W, H);
    const segment = 180, base = Math.floor((racer.distance - 650) / segment) * segment;
    for (let i = 80; i >= 0; i--) {
      const z = base + i * segment;
      if (z - racer.distance + 1100 < 80) continue;
      const near = project(z), far = project(z + segment);
      const stripe = Math.floor(z / segment) % 2 === 0;
      g.fillStyle = stripe ? '#173538' : '#1a3b3b'; g.fillRect(0, far.y, W, Math.max(0, near.y - far.y));
      quad(near, far, -1.15, 1.15, stripe ? '#b4b8b2' : '#6e8289');
      quad(near, far, -1.04, 1.04, stripe ? '#22323e' : '#253641');
      quad(near, far, -1.01, -.98, '#e9daba'); quad(near, far, .98, 1.01, '#e9daba');
      if (stripe) for (const lane of [-1 / 3, 1 / 3]) quad(near, far, lane - .009, lane + .009, '#b7c8c3');
      if (Math.floor(z / segment) % 4 === 0 && far.y > H * .41) {
        for (const side of [-1.35, 1.35]) {
          const pos = project(z + segment, side);
          const post = Math.min(60, far.half * .07);
          g.fillStyle = '#819e9c'; g.fillRect(pos.x - 1, pos.y - post, Math.max(2, post * .12), post);
          g.fillStyle = '#7af6d4'; g.fillRect(pos.x - 2, pos.y - post, Math.max(3, post * .2), Math.max(2, post * .1));
        }
      }
    }
    const objects = [...traffic.map(car => ({ kind: 'car', ...car })), ...batteries.filter(b => !b.passed).map(battery => ({ kind: 'battery', ...battery }))].sort((a, b) => b.z - a.z);
    for (const object of objects) {
      const gap = object.z - racer.distance;
      if (gap < -100 || gap > 10000) continue;
      const position = project(object.z, object.x);
      if (position.y < H * .40 || position.y > H + 90) continue;
      if (object.kind === 'car') drawCar(position.x, position.y, position.half * .21, position.half * .28, object.color);
      else {
        const size = Math.max(3, position.half * .06);
        g.fillStyle = '#68eed0'; g.fillRect(position.x - size, position.y - size * 2.5, size * 2, size * 2.5);
        if (size > 7) text(g, '+', position.x, position.y - size * .5, size * 1.5, '#102b2b', 'center');
      }
    }
    const steer = Number(held.has('right')) - Number(held.has('left'));
    if (!invulnerable || Math.floor(clock * 9) % 2 === 0) drawCar(W / 2 + steer * 7, H - 30, 66, 87, '#69efd0', steer * .06, true);
    g.fillStyle = '#061421c9'; g.fillRect(18, H - 23, 168, 11);
    g.fillStyle = racer.boosting ? '#b6fbef' : '#66dfc5'; g.fillRect(20, H - 21, 164 * racer.nitro / 100, 7);
    text(g, 'NITRO ' + Math.round(racer.nitro) + '%', 20, H - 31, 10, '#b9e6d8');
    text(g, 'NEXT ' + (Math.min(checkpoint, finishLine) / 5000).toFixed(1) + ' KM', W - 20, H - 16, 10, '#d3e4db', 'right');
    g.fillStyle = '#061421b5'; g.fillRect(0, 0, W, 39);
    const progress = clamp(racer.distance / finishLine, 0, 1);
    g.fillStyle = '#3a5668'; g.fillRect(20, 18, W - 40, 3);
    g.fillStyle = '#68efce'; g.fillRect(20, 18, (W - 40) * progress, 3);
    for (const km of [6, 12, 18, 22]) { g.fillStyle = racer.distance >= km * 1000 ? '#81efce' : '#879ba4'; g.fillRect(20 + (W - 40) * km / 22 - 2, 14, 4, 11); }
    if (messageTime > 0 && started) {
      g.fillStyle = '#081d29dc'; g.fillRect(100, 49, W - 200, 31);
      text(g, message, W / 2, 69, 11, '#c7f0e2', 'center');
    }
    if (racer.boosting && document.body.dataset.motion !== 'reduced') {
      g.strokeStyle = '#adf5e55c'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = 180 + ((clock * 360 + i * 47) % 240), side = i % 2 ? 1 : -1;
        g.beginPath(); g.moveTo(W / 2 + side * (220 + (y - 180) * .6), y); g.lineTo(W / 2 + side * (235 + (y - 180) * .65), y + 28); g.stroke();
      }
    }
  }

  panel.append(element('p', 'action-kicker', 'AETHER ORIGINAL / MIDNIGHT RUN'), element('h2', '', 'Leave a little room.'), element('p', 'action-copy', '4.4 km of curves, traffic and narrow escapes. Chase the checkpoints. Save some nitro for the open road.'));
  const hints = element('div', 'action-hints');
  hints.append(element('span', '', 'A/D steer'), element('span', '', 'S brake'), element('span', '', 'Space nitro'));
  panel.append(hints);
  ctx.button('Start the midnight run', begin, { primary: true, parent: panel });
  ctx.frame = dt => { if (started && !ctx.ended) simulate(dt); paint(); };
  ctx.status('Cruise assist is on. Steer, brake and boost. The clock starts when you do.');
  populate();
  updateHud(true);
  paint();
}

export const actionGames = { breach, overdrive };

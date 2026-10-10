import {
  DRIFT_DURATION, DRIFT_LAPS, createDriftTrack, trackPoint,
  createDriftCar, stepDriftCar, constrainDriftCar, createLapProgress,
  advanceLapProgress, createDriftCombo, stepDriftCombo, bankDriftCombo,
  driftRunResult, clamp,
} from './driftline-core.js?v=5.4.2';

const element = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};

export function driftline(ctx) {
  const W = 720, H = 480, scale = Math.min(window.devicePixelRatio || 1, 2);
  const wrapper = element('div', 'action-stage');
  const canvas = element('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  canvas.style.width = W + 'px'; canvas.style.aspectRatio = W + '/' + H;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Driftline dockside racing circuit. Drive clockwise, bank drifts, and finish three laps.');
  canvas.tabIndex = 0;
  const g = canvas.getContext('2d'); g.scale(scale, scale);
  const panel = element('section', 'action-panel');
  panel.style.gap = 'clamp(8px, 2vw, 16px)';
  wrapper.append(canvas, panel); ctx.board.append(wrapper);

  const hud = element('div', 'action-hud');
  const fields = [['Time', '1:30'], ['Lap', '1 / 3'], ['Combo', '0'], ['Speed', '0 km/h']].map(([name, value]) => {
    const item = element('div'), strong = element('strong', '', value);
    item.append(element('span', '', name), strong); hud.append(item); return strong;
  });
  ctx.board.prepend(hud);
  function toggle(title, checked) {
    const label = element('label', 'action-toggle'), input = element('input');
    input.type = 'checkbox'; input.checked = checked;
    label.append(input, element('span', '', title)); ctx.controls.append(label); return input;
  }
  const cruise = toggle('Cruise assist', true);
  const guide = toggle('Racing line', true);
  const pad = element('div', 'action-pad'); ctx.controls.append(pad);
  const keys = new Set(), pointers = new Map(), pulses = new Set();
  const isHeld = action => keys.has(action) || pulses.has(action) || Array.from(pointers.values()).includes(action);
  const resetInput = () => { keys.clear(); pointers.clear(); pulses.clear(); };
  for (const [label, action, description] of [['←', 'left', 'Steer left'], ['→', 'right', 'Steer right'], ['Gas', 'gas', 'Accelerate'], ['Brake', 'brake', 'Brake'], ['Drift', 'drift', 'Hold handbrake to drift']]) {
    const button = ctx.button(label, event => {
      if (event.detail === 0 && started && !ctx.ended) {
        pulses.add(action); ctx.after(.18, () => pulses.delete(action));
      }
    }, { parent: pad, label: description });
    ctx.listen(button, 'pointerdown', event => {
      if (!started || ctx.ended || !ctx.active) return;
      event.preventDefault(); pointers.set(event.pointerId, action);
      button.setPointerCapture?.(event.pointerId);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) ctx.listen(button, name, event => pointers.delete(event.pointerId));
  }
  const actions = { a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', w: 'gas', arrowup: 'gas', s: 'brake', arrowdown: 'brake', ' ': 'drift' };
  ctx.listen(document, 'keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (!started && event.key === 'Enter' && event.target.tagName !== 'BUTTON') { event.preventDefault(); begin(); return; }
    if (!started || ctx.ended || !ctx.active || (event.target.tagName === 'BUTTON' && event.key === ' ')) return;
    const action = actions[event.key.toLowerCase()];
    if (action) { event.preventDefault(); keys.add(action); }
  });
  ctx.listen(document, 'keyup', event => keys.delete(actions[event.key.toLowerCase()]));
  ctx.listen(window, 'blur', resetInput);
  ctx.onPause = resetInput;
  ctx.onResume = () => { resetInput(); updateHud(true); };

  const track = createDriftTrack();
  let car = createDriftCar(track), progress = createLapProgress(), combo = createDriftCombo();
  let time = DRIFT_DURATION, hull = 5, score = 0, started = false;
  let clock = 0, lastHud = -1, crashCooldown = 0, flash = 0, messageTime = 0;
  let message = '', bestDrift = 0, lastLap = 0, lapStart = 0;
  let trails = [], smoke = [], trailClock = 0;
  const reducedMotion = () => document.body.dataset.motion === 'reduced';
  function notify(value, seconds = 1.8) { message = value; messageTime = seconds; }
  function bank() {
    const result = bankDriftCombo(combo); combo = result;
    if (result.banked > 0) {
      score += result.banked; bestDrift = Math.max(bestDrift, result.banked);
      notify('BANKED +' + result.banked); ctx.tone(610, .045);
    }
  }
  function updateHud(force = false) {
    if (!force && clock - lastHud < .1) return;
    lastHud = clock;
    const seconds = Math.max(0, Math.ceil(time));
    fields[0].textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    fields[1].textContent = Math.min(DRIFT_LAPS, progress.laps + 1) + ' / ' + DRIFT_LAPS;
    fields[2].textContent = combo.pending ? '+' + Math.round(combo.pending) + ' ×' + (1 + Math.min(2, combo.chain / 4)).toFixed(1) : 'Banked';
    fields[3].textContent = Math.round(car.speed * 1.5) + ' km/h';
    ctx.score(score);
    if (started && !ctx.ended) ctx.status(messageTime > 0 ? message + ' · Hull ' + hull + ' / 5' : (combo.drifting ? 'Hold the slide, then straighten to bank. ' : 'Clockwise circuit. Follow the next lit gate. ') + 'Hull ' + hull + ' / 5');
  }
  function begin() {
    if (started || ctx.ended || !ctx.active) return;
    started = true; panel.hidden = true; resetInput();
    ctx.status('Dockside circuit. Three laps, five hull points.');
    canvas.focus({ preventScroll: true }); updateHud(true);
  }
  function finish(reason) {
    resetInput();
    if (reason === 'finished') {
      bank(); score += Math.round(time * 20) + hull * 150;
      const medal = score >= 6500 ? 'Gold' : score >= 3500 ? 'Silver' : 'Bronze';
      updateHud(true);
      ctx.finish(medal + ' finish. Three laps in ' + (DRIFT_DURATION - time).toFixed(1) + 's. Best drift: ' + bestDrift + '.', score, { won: true, laps: progress.laps, bestDrift, time: DRIFT_DURATION - time, medal });
    } else {
      // A combo still sliding at the buzzer is not banked. Finish the corner.
      combo = createDriftCombo(); updateHud(true);
      ctx.finish(reason === 'wrecked' ? 'Barrier wins. ' + progress.laps + ' laps finished; banked score ' + score + '.' : 'Time expired. ' + progress.laps + ' / 3 laps; banked score ' + score + '.', score, { won: false, laps: progress.laps, bestDrift, reason });
    }
  }
  panel.append(element('p', 'action-kicker', 'DOCKSIDE / THREE LAP RUN'), element('h2', '', 'Own the corner.'), element('p', 'action-copy', 'Hold Space to drift. Straighten to bank. Finish three laps before time runs out.'));
  const hints = element('div', 'action-hints');
  for (const hint of ['A/D steer', 'Space drift', '90 seconds', '5 hull']) hints.append(element('span', '', hint));
  panel.append(hints);
  const startButton = ctx.button('Start engine', begin, { parent: panel, primary: true });
  startButton.style.minHeight = '44px'; startButton.style.flexShrink = '0';

  const circuitPath = new Path2D();
  circuitPath.moveTo(track.points[0].x, track.points[0].y);
  for (const point of track.points.slice(1)) circuitPath.lineTo(point.x, point.y);
  circuitPath.closePath();
  const background = element('canvas');
  background.width = W * scale; background.height = H * scale;
  const backgroundDraw = background.getContext('2d'); backgroundDraw.scale(scale, scale);
  let cachedGuide = null;
  function label(value, x, y, size, color, align = 'left') {
    g.fillStyle = color; g.font = '700 ' + size + 'px system-ui'; g.textAlign = align; g.fillText(value, x, y);
  }
  function drawGate(fraction, active, start = false) {
    const p = trackPoint(track, fraction);
    g.save(); g.translate(p.x, p.y); g.rotate(p.angle);
    if (start) {
      for (let side = 0; side < 2; side++) for (let row = 0; row < 8; row++) {
        g.fillStyle = (side + row) % 2 ? '#1b333e' : '#b0c4c3';
        g.fillRect(side * 5 - 5, -32 + row * 8, 5, 8);
      }
    } else {
      g.fillStyle = active ? '#82f3d4' : '#567478'; g.globalAlpha = active ? .75 : .35;
      g.fillRect(-2, -33, 4, 66); g.globalAlpha = 1;
    }
    g.fillStyle = active ? '#abffe5' : '#435c64';
    for (const side of [-1, 1]) { g.fillRect(-7, side * 42 - 4, 14, 8); }
    g.restore();
  }
  function paintBackground(g) {
    g.fillStyle = '#081a25'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#16303c'; g.lineWidth = 1;
    // Static dock geometry keeps the track legible without camera shake.
    for (let row = 14; row < H; row += 34) {
      g.beginPath(); g.moveTo(0, row); g.lineTo(70, row); g.stroke();
      g.beginPath(); g.moveTo(648, row + 10); g.lineTo(W, row + 10); g.stroke();
    }
    g.fillStyle = '#122d36'; g.fillRect(17, 104, 55, 271); g.fillRect(658, 111, 49, 260);
    const crates = [[226, 201, 74, 34], [306, 208, 104, 33], [253, 251, 120, 33], [424, 245, 47, 61]];
    for (let index = 0; index < crates.length; index++) {
      const [x, y, w, h] = crates[index];
      g.fillStyle = ['#213e46', '#30433c', '#273a50', '#324047'][index]; g.fillRect(x, y, w, h);
      g.strokeStyle = '#456166';
      for (let slot = x + 7; slot < x + w; slot += 11) { g.beginPath(); g.moveTo(slot, y + 4); g.lineTo(slot, y + h - 4); g.stroke(); }
    }
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = '#061019'; g.lineWidth = 91; g.stroke(circuitPath);
    g.strokeStyle = '#496065'; g.lineWidth = 79; g.stroke(circuitPath);
    g.strokeStyle = '#243843'; g.lineWidth = 72; g.stroke(circuitPath);
    g.strokeStyle = '#1a2d37'; g.lineWidth = 55; g.stroke(circuitPath);
    for (let index = 0; index < track.segments.length; index++) {
      const segment = track.segments[index];
      g.strokeStyle = Math.floor(index / 3) % 2 ? '#e2bba0' : '#775d64'; g.lineWidth = 3;
      for (const side of [-1, 1]) {
        g.beginPath(); g.moveTo(segment.start.x + segment.nx * 35 * side, segment.start.y + segment.ny * 35 * side);
        g.lineTo(segment.end.x + segment.nx * 35 * side, segment.end.y + segment.ny * 35 * side); g.stroke();
      }
    }
    if (guide.checked) {
      g.setLineDash([5, 11]); g.strokeStyle = '#637b73'; g.lineWidth = 1.2; g.stroke(circuitPath); g.setLineDash([]);
      for (const fraction of [.12, .37, .62, .87]) {
        const p = trackPoint(track, fraction); g.save(); g.translate(p.x, p.y); g.rotate(p.angle);
        g.strokeStyle = '#a0c7b0'; g.lineWidth = 2; g.beginPath(); g.moveTo(-5, -4); g.lineTo(2, 0); g.lineTo(-5, 4); g.stroke(); g.restore();
      }
    }
  }
  function render() {
    const motion = !reducedMotion();
    if (cachedGuide !== guide.checked) { paintBackground(backgroundDraw); cachedGuide = guide.checked; }
    g.drawImage(background, 0, 0, W, H);
    for (let gate = 1; gate <= 4; gate++) drawGate(gate / 4 % 1, gate === progress.nextGate, gate === 4);
    if (motion) {
      for (const trail of trails) {
        g.globalAlpha = clamp(trail.life / 6, 0, .35); g.strokeStyle = '#040b10'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(trail.x1, trail.y1); g.lineTo(trail.x2, trail.y2); g.stroke();
      }
      for (const particle of smoke) {
        g.globalAlpha = particle.life * .24; g.fillStyle = '#9cbec0'; g.beginPath(); g.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
    g.save(); g.translate(car.x, car.y); g.rotate(car.angle);
    g.fillStyle = '#040b13'; g.fillRect(-12, -10, 28, 20);
    g.fillStyle = crashCooldown > 0 && Math.floor(clock * 12) % 2 ? '#f7c48c' : '#6bedca'; g.fillRect(-13, -8, 27, 16);
    g.fillStyle = '#19424c'; g.fillRect(-5, -6, 10, 12); g.fillStyle = '#214456'; g.fillRect(7, -6, 4, 12);
    g.fillStyle = '#c9ffee'; g.fillRect(12, -6, 3, 3); g.fillRect(12, 3, 3, 3);
    g.fillStyle = '#ff9bab'; g.fillRect(-14, -6, 2, 3); g.fillRect(-14, 3, 2, 3);
    g.restore();
    label('DOCKSIDE CIRCUIT', 29, 32, 10, '#89afae');
    label('DRIFTLINE', 29, 58, 24, '#def9ef');
    label('HULL', 624, 31, 9, '#89afae', 'right');
    for (let index = 0; index < 5; index++) { g.fillStyle = index < hull ? '#7fead0' : '#28424a'; g.fillRect(636 + index * 11, 23, 7, 12); }
    label(lastLap ? 'LAST LAP ' + lastLap.toFixed(1) + 's' : 'CLOCKWISE / 3 LAPS', 360, 428, 11, '#8eaaa9', 'center');
    label(messageTime > 0 ? message : combo.drifting ? '+' + Math.round(combo.pending) + '  DRIFT ×' + (1 + Math.min(2, combo.chain / 4)).toFixed(1) : 'STRAIGHTEN TO BANK', 360, 450, 16, combo.drifting ? '#f6d399' : '#b8e9da', 'center');
    if (flash > 0 && motion) { g.fillStyle = '#ffad9040'; g.fillRect(0, 0, W, H); }
  }
  ctx.frame = dt => {
    if (!ctx.active || ctx.ended) return;
    if (!started) { render(); return; }
    const step = clamp(dt, 0, .06); clock += step; time = Math.max(0, time - step);
    crashCooldown = Math.max(0, crashCooldown - step); flash = Math.max(0, flash - step); messageTime = Math.max(0, messageTime - step);
    const previousCar = car;
    car = stepDriftCar(car, { steer: Number(isHeld('right')) - Number(isHeld('left')), throttle: cruise.checked || isHeld('gas'), brake: isHeld('brake'), handbrake: isHeld('drift') }, step);
    const bounded = constrainDriftCar(car, track); car = bounded.car;
    const crash = bounded.hit && bounded.impact > 26 && crashCooldown <= 0;
    if (crash) {
      hull--; score = Math.max(0, score - 75); crashCooldown = 1.15; flash = .12;
      notify('BARRIER / COMBO LOST'); ctx.tone(140, .08);
    }
    combo = stepDriftCombo(combo, { ...car, slip: bounded.shoulder ? 0 : car.slip }, step, bounded.hit);
    if (combo.banked > 0) {
      score += combo.banked; bestDrift = Math.max(bestDrift, combo.banked);
      notify('BANKED +' + combo.banked); ctx.tone(610, .045);
    }
    progress = advanceLapProgress(progress, bounded.projection.progress);
    if (progress.crossed) {
      if (progress.lapCompleted) {
        bank(); lastLap = clock - lapStart; lapStart = clock; score += 350;
        notify('LAP ' + progress.laps + ' / 3  ·  ' + lastLap.toFixed(1) + 's'); ctx.tone(820, .06);
      } else notify('CHECKPOINT ' + progress.nextGate + ' / 4', .7);
    }
    if (!reducedMotion()) {
      trailClock += step;
      if (combo.drifting && trailClock >= .035) {
        trailClock = 0;
        for (const side of [-1, 1]) {
          trails.push({ x1: previousCar.x - Math.sin(previousCar.angle) * side * 7, y1: previousCar.y + Math.cos(previousCar.angle) * side * 7, x2: car.x - Math.sin(car.angle) * side * 7, y2: car.y + Math.cos(car.angle) * side * 7, life: 6 });
        }
        if (smoke.length < 45) smoke.push({ x: car.x - Math.cos(car.angle) * 12, y: car.y - Math.sin(car.angle) * 12, vx: Math.sin(car.angle) * car.slip * 15, vy: -Math.cos(car.angle) * car.slip * 15, life: .65, size: 4 });
      }
      if (trails.length > 220) trails.splice(0, trails.length - 220);
      for (const trail of trails) trail.life -= step;
      trails = trails.filter(item => item.life > 0);
      for (const particle of smoke) { particle.life -= step; particle.x += particle.vx * step; particle.y += particle.vy * step; particle.size += step * 5; }
      smoke = smoke.filter(item => item.life > 0);
    } else { trails.length = 0; smoke.length = 0; }
    updateHud(); render();
    const result = driftRunResult(progress.laps, hull, time);
    if (result) finish(result);
  };
  ctx.status('Start your engine. Cruise assist lets you focus on steering.'); render();
}

import {
  makeStackBoard,
  createStackPiece,
  canPlaceStackPiece,
  rotateStackPiece,
  lockStackPiece,
  clearStackLines,
  typingStats,
} from './extra-core.js?v=5.4.0';


const palettes = {
  I: '#68ead1', J: '#8ab6ff', L: '#ffae77', O: '#ffd981',
  S: '#8ce1a5', T: '#bd9aff', Z: '#ff829c',
};

const lines = [
  'Small steps still move the whole sky.',
  'A clear mind finds the open path.',
  'Make the next move the one that matters.',
  'The bright idea was hiding in plain sight.',
  'Every new round starts with empty space.',
  'Take a breath and keep your hands moving.',
  'Good timing turns a close call into a clean win.',
  'The long way around can still be the fast route.',
  'Build a steady rhythm and let the noise pass.',
  'A little patience leaves room for a better choice.',
  'Look ahead, leave space, and trust the pattern.',
  'There is always another way through the maze.',
  'One good turn can change the shape of the board.',
  'Find the signal, then follow it all the way home.',
  'The best line is the one you can keep moving on.',
];

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function makeCanvas(ctx, width, height, label) {
  const view = node('canvas');
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  view.width = width * ratio;
  view.height = height * ratio;
  view.style.width = width + 'px';
  view.style.aspectRatio = width + '/' + height;
  view.setAttribute('role', 'img');
  view.setAttribute('aria-label', label);
  const draw = view.getContext('2d');
  draw.scale(ratio, ratio);
  ctx.board.append(view);
  return { view, draw };
}

function stack(ctx) {
  const { draw: g } = makeCanvas(ctx, 420, 560, 'Prism Stack board. Move, rotate, and drop the falling shapes to clear rows.');
  const width = 10;
  const height = 20;
  const cell = 24;
  const field = { x: 18, y: 28, width: width * cell, height: height * cell };
  let board = makeStackBoard(width, height);
  let bag = [];
  let nextType = null;
  let active = null;
  let started = false;
  let score = 0;
  let cleared = 0;
  let level = 1;
  let gravityClock = 0;
  let softClock = 0;
  let repeatClock = 0;
  const held = new Set();

  const shuffleBag = () => {
    bag = Object.keys(palettes);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  };
  const takeType = () => {
    if (!bag.length) shuffleBag();
    return bag.pop();
  };
  const begin = () => {
    if (started || ctx.ended) return;
    started = true;
    active = createStackPiece(nextType || takeType(), 3, -1);
    nextType = takeType();
    startButton.hidden = true;
    if (!canPlaceStackPiece(board, active)) endRound();
    else ctx.status('Keep the field open. The shapes are coming faster.');
  };
  const move = (dx, dy = 0) => {
    if (!active || ctx.ended) return false;
    if (!canPlaceStackPiece(board, active, active.x + dx, active.y + dy)) return false;
    active = { ...active, x: active.x + dx, y: active.y + dy };
    return true;
  };
  const endRound = () => {
    held.clear();
    ctx.finish('Field filled. ' + score + ' points across ' + cleared + ' cleared rows.', score, { won: false, lines: cleared, level });
  };
  const spawn = () => {
    active = createStackPiece(nextType, 3, -1);
    nextType = takeType();
    if (!canPlaceStackPiece(board, active)) endRound();
  };
  const lock = () => {
    if (!active || ctx.ended) return;
    const result = lockStackPiece(board, active);
    board = result.board;
    if (result.overflow) return endRound();
    const resultLines = clearStackLines(board);
    board = resultLines.board;
    if (resultLines.lines) {
      const points = [0, 100, 300, 500, 800][Math.min(resultLines.lines, 4)] * level;
      score += points;
      cleared += resultLines.lines;
      level = 1 + Math.floor(cleared / 10);
      ctx.score(score);
      ctx.tone(420 + Math.min(4, resultLines.lines) * 90, .1);
      ctx.status(resultLines.lines === 4 ? 'Four rows at once. Beautifully done.' : resultLines.lines + ' row' + (resultLines.lines === 1 ? '' : 's') + ' cleared. Keep the stack low.');
    }
    gravityClock = 0;
    spawn();
  };
  const dropOne = soft => {
    if (move(0, 1)) {
      if (soft) {
        score++;
        ctx.score(score);
      }
    } else lock();
  };
  const rotate = () => {
    if (active && !ctx.ended) active = rotateStackPiece(board, active);
  };
  const hardDrop = () => {
    if (!active || !started || ctx.ended) return;
    let distance = 0;
    while (move(0, 1)) distance++;
    score += distance * 2;
    ctx.score(score);
    ctx.tone(280, .045);
    lock();
  };
  const startButton = ctx.button('Start a run', begin, { primary: true });

  const moveButton = (text, key, dx, dy, label) => {
    const button = ctx.button(text, () => {}, { label });
    button.classList.add('stack-control');
    ctx.listen(button, 'pointerdown', event => {
      event.preventDefault();
      held.add(key);
      if (dx) move(dx, 0);
      if (dy) dropOne(true);
      repeatClock = 0;
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) ctx.listen(button, type, () => held.delete(key));
    return button;
  };
  const controls = node('div', 'stack-controls');
  ctx.controls.append(controls);
  controls.append(moveButton('←', 'left', -1, 0, 'Move left'));
  controls.append(moveButton('↓', 'down', 0, 1, 'Soft drop'));
  controls.append(moveButton('→', 'right', 1, 0, 'Move right'));
  ctx.button('Rotate', rotate, { parent: controls, label: 'Rotate falling shape' });
  ctx.button('Drop', hardDrop, { parent: controls, label: 'Hard-drop falling shape' });
  const pointerRelease = () => held.clear();
  ctx.listen(window, 'pointerup', pointerRelease);
  ctx.listen(window, 'blur', pointerRelease);
  ctx.onPause = pointerRelease;

  ctx.listen(document, 'keydown', event => {
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (!started && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      begin();
      return;
    }
    if (!started || ctx.ended) return;
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowdown', 'arrowup', ' ', 'x', 'a', 'd', 's'].includes(key)) event.preventDefault();
    if (key === 'arrowleft' || key === 'a') {
      if (!event.repeat) move(-1, 0);
      held.add('left');
      repeatClock = 0;
    } else if (key === 'arrowright' || key === 'd') {
      if (!event.repeat) move(1, 0);
      held.add('right');
      repeatClock = 0;
    } else if (key === 'arrowdown' || key === 's') {
      held.add('down');
      if (!event.repeat) dropOne(true);
    } else if ((key === 'arrowup' || key === 'x') && !event.repeat) rotate();
    else if (key === ' ' && !event.repeat) hardDrop();
  });
  ctx.listen(document, 'keyup', event => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'a'].includes(key)) held.delete('left');
    if (['arrowright', 'd'].includes(key)) held.delete('right');
    if (['arrowdown', 's'].includes(key)) held.delete('down');
  });

  const paintBlock = (x, y, type, alpha = 1) => {
    if (y < 0) return;
    const left = field.x + x * cell + 1;
    const top = field.y + y * cell + 1;
    g.globalAlpha = alpha;
    g.fillStyle = palettes[type];
    g.fillRect(left, top, cell - 2, cell - 2);
    g.fillStyle = '#ffffff2d';
    g.fillRect(left + 2, top + 2, cell - 6, 3);
    g.fillStyle = '#07131745';
    g.fillRect(left + 2, top + cell - 6, cell - 6, 3);
    g.globalAlpha = 1;
  };
  const paintText = (text, x, y, size, color = '#91aaa8', align = 'left') => {
    g.fillStyle = color;
    g.font = '650 ' + size + 'px system-ui';
    g.textAlign = align;
    g.fillText(text, x, y);
  };
  const paint = () => {
    g.clearRect(0, 0, 420, 560);
    g.fillStyle = '#0a151b';
    g.fillRect(0, 0, 420, 560);
    g.fillStyle = '#27414b';
    for (let i = 0; i < 28; i++) g.fillRect((i * 83 + 17) % 420, (i * 47 + 19) % 560, 2, 2);
    g.fillStyle = '#101e26';
    g.fillRect(field.x, field.y, field.width, field.height);
    g.strokeStyle = '#213842';
    g.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      g.beginPath(); g.moveTo(field.x + x * cell, field.y); g.lineTo(field.x + x * cell, field.y + field.height); g.stroke();
    }
    for (let y = 0; y <= height; y++) {
      g.beginPath(); g.moveTo(field.x, field.y + y * cell); g.lineTo(field.x + field.width, field.y + y * cell); g.stroke();
    }
    g.strokeStyle = '#4b7776';
    g.lineWidth = 2;
    g.strokeRect(field.x, field.y, field.width, field.height);
    board.forEach((row, y) => row.forEach((type, x) => { if (type) paintBlock(x, y, type); }));
    if (active) {
      let ghostY = active.y;
      while (canPlaceStackPiece(board, active, active.x, ghostY + 1)) ghostY++;
      active.shape.forEach((row, y) => row.forEach((filled, x) => {
        if (filled) paintBlock(active.x + x, ghostY + y, active.type, .19);
      }));
      active.shape.forEach((row, y) => row.forEach((filled, x) => {
        if (filled) paintBlock(active.x + x, active.y + y, active.type);
      }));
    }
    const sideX = 288;
    paintText('NEXT', sideX, 52, 11, '#65e9cc');
    if (nextType) {
      const shape = createStackPiece(nextType, 0, 0).shape;
      const offsetX = sideX + 3;
      const offsetY = 70;
      shape.forEach((row, y) => row.forEach((filled, x) => {
        if (filled) {
          g.fillStyle = palettes[nextType];
          g.fillRect(offsetX + x * 15, offsetY + y * 15, 13, 13);
        }
      }));
    }
    paintText('SCORE', sideX, 176, 10);
    paintText(String(score).padStart(6, '0'), sideX, 199, 19, '#e6f4f1');
    paintText('LINES', sideX, 244, 10);
    paintText(String(cleared).padStart(2, '0'), sideX, 268, 20, '#e6f4f1');
    paintText('LEVEL', sideX, 314, 10);
    paintText(String(level).padStart(2, '0'), sideX, 338, 20, '#e6f4f1');
    paintText('NEXT LEVEL', sideX, 384, 9);
    paintText((10 - cleared % 10) + ' rows', sideX, 405, 12, '#c1d8d3');
    paintText('← → move', sideX, 472, 10);
    paintText('↑ rotate', sideX, 491, 10);
    paintText('SPACE drop', sideX, 510, 10);
    if (!started) {
      g.fillStyle = '#081319d9';
      g.fillRect(field.x, field.y, field.width, field.height);
      paintText('PRISM STACK', field.x + field.width / 2, field.y + field.height / 2 - 8, 17, '#e6f4f1', 'center');
      paintText('Choose Start to play', field.x + field.width / 2, field.y + field.height / 2 + 17, 10, '#91aaa8', 'center');
    }
  };

  ctx.frame = dt => {
    if (started && !ctx.ended) {
      const horizontal = held.has('left') === held.has('right') ? 0 : held.has('left') ? -1 : 1;
      if (horizontal) {
        repeatClock += dt;
        if (repeatClock >= .13) {
          repeatClock %= .13;
          move(horizontal, 0);
        }
      } else repeatClock = 0;
      if (held.has('down')) {
        softClock += dt;
        if (softClock >= .045) {
          softClock %= .045;
          dropOne(true);
        }
      } else softClock = 0;
      gravityClock += dt;
      const interval = Math.max(.075, .72 - (level - 1) * .055);
      while (gravityClock >= interval && !ctx.ended) {
        gravityClock -= interval;
        dropOne(false);
      }
    }
    paint();
  };
  ctx.status('Keep complete rows clear. Each shape is in the next preview.');
  paint();
}

function typerush(ctx) {
  const arena = node('section', 'typing-arena');
  const prompt = node('div', 'typing-prompt');
  prompt.setAttribute('aria-label', 'Typing prompt');
  const input = node('input', 'typing-entry');
  input.type = 'text';
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.maxLength = lines[0].length;
  input.placeholder = 'Your line goes here';
  input.setAttribute('aria-label', 'Type the displayed sentence');
  input.disabled = true;
  const instructions = node('p', 'typing-instructions', 'Exact punctuation counts. Backspace is allowed.');
  const meters = node('div', 'typing-meters');
  const timeReadout = node('span', 'typing-clock', '45.0s');
  const accuracyReadout = node('span', '', 'Accuracy 0%');
  const phraseReadout = node('span', '', '0 lines');
  meters.append(timeReadout, accuracyReadout, phraseReadout);
  arena.append(prompt, input, instructions, meters);
  ctx.board.append(arena);

  let phrase = '';
  let previousPhrase = '';
  let started = false;
  let advancing = false;
  let startedAt = 0;
  let remaining = 45;
  let completedLines = 0;
  let completedCorrect = 0;
  let completedTyped = 0;
  let sampleClock = 0;

  const chooseLine = () => {
    let next = lines[Math.floor(Math.random() * lines.length)];
    if (lines.length > 1) while (next === previousPhrase) next = lines[Math.floor(Math.random() * lines.length)];
    previousPhrase = next;
    return next;
  };
  const currentCounts = () => {
    let correct = 0;
    for (let i = 0; i < input.value.length; i++) if (input.value[i] === phrase[i]) correct++;
    return { correct, typed: input.value.length };
  };
  const renderPrompt = () => {
    prompt.replaceChildren();
    prompt.setAttribute('aria-label', phrase);
    for (let i = 0; i < phrase.length; i++) {
      const char = node('span', '', phrase[i]);
      char.setAttribute('aria-hidden', 'true');
      if (i < input.value.length) char.className = input.value[i] === phrase[i] ? 'correct' : 'wrong';
      else if (i === input.value.length) char.className = 'current';
      prompt.append(char);
    }
  };
  const stats = () => {
    const current = currentCounts();
    const elapsed = started ? Math.min(45, Math.max(0, ctx.elapsed - startedAt)) : 0;
    return typingStats(completedCorrect + current.correct, completedTyped + current.typed, elapsed);
  };
  const update = () => {
    const result = stats();
    ctx.score(result.wpm);
    accuracyReadout.textContent = 'Accuracy ' + result.accuracy.toFixed(1) + '%';
    phraseReadout.textContent = completedLines + ' line' + (completedLines === 1 ? '' : 's');
  };
  const finish = () => {
    const result = stats();
    const attempted = completedTyped + input.value.length;
    const message = 'Time. ' + result.wpm.toFixed(1) + ' WPM at ' + result.accuracy.toFixed(1) + '% accuracy.';
    input.disabled = true;
    ctx.finish(message, attempted ? result.wpm : undefined, { won: true, wpm: result.wpm, accuracy: result.accuracy, lines: completedLines });
  };
  const startButton = ctx.button('Start 45-second run', () => {
    if (started || ctx.ended) return;
    started = true;
    startedAt = ctx.elapsed;
    phrase = chooseLine();
    input.maxLength = phrase.length;
    input.disabled = false;
    startButton.hidden = true;
    renderPrompt();
    input.focus({ preventScroll: true });
    ctx.status('Find your rhythm. Accuracy is part of the score.');
  }, { primary: true });

  ctx.listen(input, 'input', () => {
    if (!started || ctx.ended || advancing) return;
    renderPrompt();
    update();
    if (input.value.length < phrase.length) return;
    const current = currentCounts();
    completedCorrect += current.correct;
    completedTyped += current.typed;
    completedLines++;
    advancing = true;
    input.disabled = true;
    input.value = '';
    ctx.tone(590, .04);
    ctx.status('Line complete. Here comes another.');
    ctx.after(.22, () => {
      if (ctx.ended) return;
      phrase = chooseLine();
      input.value = '';
      input.maxLength = phrase.length;
      advancing = false;
      input.disabled = false;
      renderPrompt();
      update();
      input.focus({ preventScroll: true });
    });
  });
  ctx.onPause = () => { input.disabled = true; };
  ctx.onResume = () => { input.disabled = !started || ctx.ended || advancing; };
  ctx.frame = dt => {
    if (!started || ctx.ended) return;
    remaining = Math.max(0, 45 - (ctx.elapsed - startedAt));
    const timeText = remaining.toFixed(1) + 's';
    if (timeReadout.textContent !== timeText) timeReadout.textContent = timeText;
    sampleClock += dt;
    if (sampleClock >= .18) {
      sampleClock = 0;
      update();
    }
    if (remaining <= 0) finish();
  };
  ctx.status('Type the sentence accurately, then see how fast you can go.');
}

export const extraGames = { stack, typerush };

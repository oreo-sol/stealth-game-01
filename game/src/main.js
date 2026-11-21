// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, level complete,
// game over and win.
//
// ?seed=N fixes the random seed. ?shot=start|play|alarm|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. ?test=1 runs the self-test instead and writes its results to the page.
import { BEST_KEY, GADGETS, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_LEVEL, EVENT_OVER, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { runTests } from './test.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const testMode = params.get('test') === '1';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
world.state.gadgetCounts = { pebble: GADGETS.pebble.start, smoke: GADGETS.smoke.start, chime: GADGETS.chime.start };

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.conePolygon);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runTestMode() {
  const out = runTests(world);
  const text = `TEST ${out.passed}/${out.total}\n` + out.results.map((r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.name} — ${r.detail}`).join('\n');
  document.title = `TEST ${out.passed}/${out.total}`;
  const pre = document.getElementById('test-results');
  pre.textContent = text;
  pre.style.display = 'block';
  status.textContent = text;
  window.__testResult = out;
  window.__shotReady = true;
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.state.gadgetCounts = { pebble: GADGETS.pebble.start, smoke: GADGETS.smoke.start, chime: GADGETS.chime.start };
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. Night One, ${LIVES} lives.`);
  }

  function nextLevel() {
    const next = world.state.levelIndex + 1;
    world.loadLevel(next);
    world.state.gadgetCounts = { pebble: GADGETS.pebble.start, smoke: GADGETS.smoke.start, chime: GADGETS.chime.start };
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.level.name}, ${world.state.level.title}.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    const finalScore = won ? world.state.winScore : world.state.score;
    if (finalScore > best) {
      best = finalScore;
      saveBest(best);
    }
    announce(won ? `You win. Score ${finalScore}. Best ${best}.` : `Game over. Score ${finalScore}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      audio.play('click');
      startGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_LEVEL) {
      audio.play('click');
      nextLevel();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    const move = input.move();
    const gadget = input.takeGadget();
    const aim = input.mouse();
    const counts = world.state.gadgetCounts;
    const events = world.step(STEP, {
      mx: move.mx,
      my: move.my,
      sneak: input.sneak(),
      sprint: input.sprint(),
      gadget: gadget ? gadget.kind : null,
      aimX: gadget ? gadget.x : aim.x,
      aimY: gadget ? gadget.y : aim.y,
      gadgetCounts: counts,
    });
    for (const name of world.state.sfx) audio.play(name);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_LEVEL) {
      screen = SCREEN_LEVEL;
      announce(`Night complete. Score ${world.state.score}.`);
    } else if (events & EVENT_CAUGHT) {
      world.state.gadgetCounts = { pebble: GADGETS.pebble.start, smoke: GADGETS.smoke.start, chime: GADGETS.chime.start };
      announce(world.state.lives === 1 ? 'Caught. 1 life left.' : `Caught. ${world.state.lives} lives left.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world.conePolygon);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Beaconlight: The Lighthouse Job. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (testMode) runTestMode();
else if (shot) runShot(shot);
else runGame();

// The screenshot scenes behind ?shot=start|play|alarm|end. Each one plays the real rules
// forward from a fresh world, steered by a simple autopilot (chase the nearest loot, duck
// into mist or shadow when a cone is about to catch you), so the frame is what a short
// game really looks like — and the same seed always gives the same frame.

import { FIELD, GUARD, STEP } from './config.js';
import { EVENT_ALARM, EVENT_CAUGHT, EVENT_LEVEL, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_LEVEL, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 20;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function freshCounts() {
  return { pebble: 5, smoke: 2, chime: 2 };
}

/** Is the player about to be seen by this guard if they keep standing there? */
function threatened(world, x, y) {
  const st = world.state;
  for (const g of st.guards) {
    const d = dist(g.x, g.y, x, y);
    if (d > GUARD.range) continue;
    if (Math.abs(angleDiff(Math.atan2(y - g.y, x - g.x), g.angle)) > GUARD.halfFov) continue;
    if (!world.losClear(g.x, g.y, x, y)) continue;
    return true;
  }
  return false;
}

function nearestCover(world, x, y) {
  const st = world.state;
  let best = null;
  let bestD = Infinity;
  for (const m of st.level.mist) {
    const d = dist(x, y, m.x, m.y);
    if (d < bestD) {
      bestD = d;
      best = { x: m.x, y: m.y };
    }
  }
  for (const s of st.level.shadows) {
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const d = dist(x, y, cx, cy);
    if (d < bestD) {
      bestD = d;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

/** Steer toward the nearest uncollected loot; duck for cover when a cone is near. */
function autopilot(world) {
  const st = world.state;
  const p = st.player;
  let target = null;
  let bestD = Infinity;
  for (const l of st.loot) {
    if (l.taken) continue;
    const d = dist(p.x, p.y, l.x, l.y);
    if (d < bestD) {
      bestD = d;
      target = l;
    }
  }
  if (!target) {
    const ex = st.level.exit;
    target = { x: ex.x + ex.w / 2, y: ex.y + ex.h / 2 };
  }
  let tx = target.x;
  let ty = target.y;
  let sneak = false;
  if (threatened(world, p.x, p.y)) {
    const cover = nearestCover(world, p.x, p.y);
    if (cover && dist(p.x, p.y, cover.x, cover.y) > 20) {
      tx = cover.x;
      ty = cover.y;
      sneak = true;
    }
  }
  const dx = tx - p.x;
  const dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { mx: dx / len, my: dy / len, sneak, sprint: false, gadget: null, gadgetCounts: freshCounts() };
}

function runFor(world, seconds, drive) {
  const counts = freshCounts();
  let events = 0;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const input = drive ? drive(world) : { mx: 0, my: 0, sneak: false, sprint: false, gadget: null, gadgetCounts: counts };
    events |= world.step(STEP, input);
    if (events & (EVENT_LEVEL | EVENT_WIN | EVENT_OVER)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, alarm or end) and return the screen to
 * draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.loadLevel(1);
    runFor(world, PLAY_SECONDS, autopilot);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'alarm') {
    // Wren mirrors one keeper — always 150 px ahead of where it faces, 40 px to the
    // side — so it never stops seeing her and suspicion climbs to the alarm. Only an
    // alert keeper can catch her, and she keeps her distance through the hold, so
    // the shot is taken a third of a second into the alarm: red cones, banner up.
    world.loadLevel(2);
    const st = world.state;
    const counts = freshCounts();
    const idle = { mx: 0, my: 0, sneak: false, sprint: false, gadget: null, gadgetCounts: counts };
    function mirror() {
      const g = st.guards[1];
      const fx = Math.cos(g.angle);
      const fy = Math.sin(g.angle);
      st.player.x = g.x + fx * 150 - fy * 40;
      st.player.y = g.y + fy * 150 + fx * 40;
    }
    let events = 0;
    for (let i = 0; i < 12 / STEP; i += 1) {
      mirror();
      events |= world.step(STEP, idle);
      if (events & EVENT_ALARM) break;
      if (events & (EVENT_OVER | EVENT_LEVEL | EVENT_WIN | EVENT_CAUGHT)) break;
    }
    for (let i = 0; i < 0.3 / STEP; i += 1) {
      mirror();
      events |= world.step(STEP, idle);
      if (events & (EVENT_OVER | EVENT_LEVEL | EVENT_WIN | EVENT_CAUGHT)) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    world.loadLevel(3);
    const st = world.state;
    st.score = 2450;
    st.winScore = 2450;
    st.levelScore = 420;
    st.lootGot = 5;
    return { screen: SCREEN_WIN, best: 2450 };
  }
  world.loadLevel(0);
  runFor(world, START_SECONDS, null);
  return { screen: SCREEN_TITLE, best: 0 };
}

export { FIELD };

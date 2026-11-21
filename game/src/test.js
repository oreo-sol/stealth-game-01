// A self-test that drives the real world code with scripted inputs and asserts the
// mechanics: movement and wall collision, vision cones, shadow and mist cover, loot,
// gadgets, smoke blocking sight, being caught, the locked and open exit, the lighthouse
// beam, and guard patrols. Run with ?test=1; the results are written to document.title
// and to #test-results for a headless check.

import { EVENT_ALARM, EVENT_LEVEL, EVENT_OVER } from './world.js';
import { GUARD, STEP } from './config.js';

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function counts() {
  return { pebble: 5, smoke: 2, chime: 2 };
}

function idleInput() {
  return { mx: 0, my: 0, sneak: false, sprint: false, gadget: null, gadgetCounts: counts() };
}

export function runTests(world) {
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: String(detail) });
  const st = world.state;

  // 1. Levels: four nights, 18 guards, 26 loot pieces.
  let guards = 0;
  let loot = 0;
  for (let i = 0; i < 4; i += 1) {
    world.loadLevel(i);
    guards += world.state.guards.length;
    loot += world.state.loot.length;
  }
  check('levels', world.state.level !== null && guards === 18 && loot === 26, `${guards} guards, ${loot} loot`);

  // 2. Movement: walking right for 2 s moves the player and never enters a wall.
  world.loadLevel(0);
  st.lives = 3;
  const x0 = st.player.x;
  for (let i = 0; i < 2 / STEP; i += 1) world.step(STEP, { ...idleInput(), mx: 1 });
  check('movement', st.player.x - x0 > 100 && !world.pointInWall(st.player.x, st.player.y), `moved ${Math.round(st.player.x - x0)}px`);

  // 3. Wall collision: pushing into a rock for 1 s never enters it.
  world.loadLevel(0);
  st.player.x = 240 - 14;
  st.player.y = 170;
  for (let i = 0; i < 1 / STEP; i += 1) world.step(STEP, { ...idleInput(), mx: 1 });
  check('wall-collision', st.player.x < 240 && !world.pointInWall(st.player.x, st.player.y), `x=${Math.round(st.player.x)}`);

  // 4. Vision: a guard facing the player in the open grows suspicious fast.
  // pinGuard parks a guard in place (speed 0) so the geometry stays fixed; it only
  // resets suspicion when asked, so a rate can be measured across steps.
  function pinGuard(x, y, angle, reset = false) {
    const g = st.guards[0];
    g.speed = 0;
    g.x = x;
    g.y = y;
    g.angle = angle;
    g.state = 'patrol';
    if (reset) g.suspicion = 0;
    return g;
  }
  world.loadLevel(0);
  st.lives = 3;
  let g = pinGuard(350, 250, 0, true);
  st.player.x = 500;
  st.player.y = 250;
  for (let i = 0; i < 2 / STEP; i += 1) {
    pinGuard(350, 250, 0);
    world.step(STEP, idleInput());
  }
  const openSuspicion = g.suspicion;
  check('vision-open', openSuspicion > 40, `suspicion ${Math.round(openSuspicion)} after 2s`);

  // 5. Shadow: the same setup in a shadow grows suspicion far slower.
  world.loadLevel(0);
  st.lives = 3;
  g = pinGuard(900, 360, 0, true);
  st.player.x = 1050;
  st.player.y = 360; // inside the (980,320,180,90) shadow, 150px ahead of the guard
  for (let i = 0; i < 2 / STEP; i += 1) {
    pinGuard(900, 360, 0);
    world.step(STEP, idleInput());
  }
  check('vision-shadow', g.suspicion < openSuspicion * 0.6, `shadow ${Math.round(g.suspicion)} vs open ${Math.round(openSuspicion)}`);

  // 6. Mist: the same setup inside a mist bank barely registers.
  world.loadLevel(0);
  st.lives = 3;
  g = pinGuard(900, 550, 0, true);
  st.player.x = 1050;
  st.player.y = 550; // centre of the (1050,550,r75) mist bank, 150px ahead of the guard
  for (let i = 0; i < 2 / STEP; i += 1) {
    pinGuard(900, 550, 0);
    world.step(STEP, idleInput());
  }
  check('vision-mist', g.suspicion < 20, `mist suspicion ${Math.round(g.suspicion)}`);

  // 7. Loot: stepping onto a piece collects it and adds its value.
  world.loadLevel(0);
  st.lives = 3;
  st.score = 0;
  const first = st.loot[0];
  st.player.x = first.x;
  st.player.y = first.y;
  world.step(STEP, idleInput());
  check('loot', first.taken && st.lootGot === 1 && st.score === first.value, `got ${st.lootGot}, score ${st.score}`);

  // 8. Pebble: throwing one near a guard sends it to investigate the landing spot.
  world.loadLevel(0);
  st.lives = 3;
  st.player.x = 300;
  st.player.y = 250;
  const gg = st.guards[0];
  const c = counts();
  world.step(STEP, { ...idleInput(), gadget: 'pebble', aimX: gg.x + 40, aimY: gg.y, gadgetCounts: c });
  check('gadget-pebble', gg.state === 'investigate' && c.pebble === 4, `guard ${gg.state}, pebbles left ${c.pebble}`);

  // 9. Smoke: a cloud between guard and player blocks sight.
  world.loadLevel(0);
  st.lives = 3;
  g = pinGuard(350, 250, 0, true);
  st.player.x = 500;
  st.player.y = 250;
  const c2 = counts();
  world.step(STEP, { ...idleInput(), gadget: 'smoke', gadgetCounts: c2 });
  for (let i = 0; i < 2 / STEP; i += 1) {
    pinGuard(350, 250, 0);
    world.step(STEP, idleInput());
  }
  check('gadget-smoke', g.suspicion < 5 && st.smokes.length === 1, `suspicion ${Math.round(g.suspicion)}`);

  // 10. Caught: an alerted guard reaching the player costs a life and respawns the level.
  world.loadLevel(0);
  st.lives = 3;
  st.player.invuln = 0;
  const cg = st.guards[0];
  cg.state = 'alert';
  cg.suspicion = 100;
  cg.x = st.player.x + 20;
  cg.y = st.player.y;
  world.step(STEP, idleInput());
  check('caught', st.lives === 2, `lives ${st.lives}`);

  // 11. Exit locked: reaching the exit without the required loot does nothing.
  world.loadLevel(0);
  st.lives = 3;
  const ex = st.level.exit;
  st.player.x = ex.x + ex.w / 2;
  st.player.y = ex.y + ex.h / 2;
  const evLocked = world.step(STEP, idleInput());
  check('exit-locked', (evLocked & EVENT_LEVEL) === 0, `events ${evLocked}`);

  // 12. Exit open: carrying the required loot and reaching the exit completes the night.
  world.loadLevel(0);
  st.lives = 3;
  let ev = 0;
  for (const l of st.loot.slice(0, 3)) {
    st.player.x = l.x;
    st.player.y = l.y;
    ev |= world.step(STEP, idleInput());
  }
  st.player.x = ex.x + ex.w / 2;
  st.player.y = ex.y + ex.h / 2;
  ev |= world.step(STEP, idleInput());
  check('exit-open', (ev & EVENT_LEVEL) !== 0, `events ${ev}`);

  // 13. Beam: standing in the lamp's sweep on night four raises beam suspicion.
  world.loadLevel(3);
  st.lives = 3;
  st.player.x = 640;
  st.player.y = 200;
  for (let i = 0; i < 2 / STEP; i += 1) {
    st.beamAngle = Math.atan2(st.player.y - 360, st.player.x - 640);
    world.step(STEP, idleInput());
  }
  check('beam', st.beamSuspicion > 0, `beam suspicion ${Math.round(st.beamSuspicion)}`);

  // 14. Patrols: with no input for 30 s, every guard on night one has walked its route.
  world.loadLevel(0);
  st.lives = 3;
  st.player.invuln = 1000; // keep the player from being caught mid-test
  const starts = st.guards.map((gd) => ({ x: gd.x, y: gd.y }));
  for (let i = 0; i < 30 / STEP; i += 1) world.step(STEP, idleInput());
  const moved = st.guards.every((gd, i) => dist(gd.x, gd.y, starts[i].x, starts[i].y) > 20);
  check('patrols', moved, st.guards.map((gd, i) => Math.round(dist(gd.x, gd.y, starts[i].x, starts[i].y))).join(','));

  // 15. Alarm: a fully suspicious guard raises the alarm and alerts the others.
  world.loadLevel(0);
  st.lives = 3;
  g = pinGuard(350, 250, 0, true);
  st.player.x = 500;
  st.player.y = 250;
  let evAlarm = 0;
  for (let i = 0; i < 4 / STEP; i += 1) {
    pinGuard(350, 250, 0);
    evAlarm |= world.step(STEP, idleInput());
    if (evAlarm & EVENT_ALARM) break;
  }
  const othersAlert = st.guards.filter((gd) => gd.state === 'alert').length;
  check('alarm', (evAlarm & EVENT_ALARM) !== 0 && othersAlert >= 2, `alerted ${othersAlert}/3`);

  const passed = results.filter((r) => r.pass).length;
  return { passed, total: results.length, results };
}

export { EVENT_OVER };

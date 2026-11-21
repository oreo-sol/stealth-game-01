// The simulation: movement with wall sliding, raycast line of sight, guard suspicion
// and states, gadgets, the lighthouse beam, alarms, loot, lives and scoring. The world
// advances in fixed 1/60 s steps; the renderer only paints state, it never changes it.

import { ALARM, BEAM, FIELD, GADGETS, GUARD, LIVES, PLAYER, SCORE, STAMINA } from './config.js';
import { LEVELS as LEVEL_DEFS } from './levels.js';

export const EVENT_PICKUP = 1;
export const EVENT_ALARM = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;
export const EVENT_SPOTTED = 64;
export const EVENT_GADGET = 128;

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function createWorld() {
  const state = {
    levelIndex: 0,
    level: LEVEL_DEFS[0],
    player: { x: 70, y: 650, dirX: 0, dirY: -1, sneak: false, sprint: false, stamina: 100, sprintLocked: false, invuln: 0 },
    guards: [],
    loot: [],
    smokes: [],
    noises: [],
    beamAngle: -Math.PI / 2,
    beamSuspicion: 0,
    alarm: 0,
    alarmCool: 0,
    lives: LIVES,
    score: 0,
    lootGot: 0,
    lootValue: 0,
    time: 0,
    levelTime: 0,
    ghost: true,
    caughtFlash: 0,
    levelScore: 0,
    winScore: 0,
    sfx: [],
  };

  function pointInWall(x, y) {
    for (const w of state.level.walls) {
      if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
    }
    return false;
  }

  function pointInSmoke(x, y) {
    for (const s of state.smokes) {
      if (dist(x, y, s.x, s.y) < s.r) return true;
    }
    return false;
  }

  /** Line of sight: true when no wall and no smoke cloud sits between the two points. */
  function losClear(x1, y1, x2, y2) {
    const d = dist(x1, y1, x2, y2);
    const steps = Math.max(1, Math.ceil(d / 6));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      if (pointInWall(x, y) || pointInSmoke(x, y)) return false;
    }
    return true;
  }

  /** Cast one ray from (x, y) along angle; stop at a wall or at maxDist. */
  function rayHit(x, y, angle, maxDist) {
    const step = 8;
    for (let d = step; d <= maxDist; d += step) {
      const px = x + Math.cos(angle) * d;
      const py = y + Math.sin(angle) * d;
      if (px < 0 || py < 0 || px > FIELD.width || py > FIELD.height) return d;
      if (pointInWall(px, py)) return d;
    }
    return maxDist;
  }

  /** The polygon of a vision cone, for the renderer. */
  function conePolygon(x, y, angle, halfFov, range) {
    const rays = 26;
    const pts = [[x, y]];
    for (let i = 0; i <= rays; i += 1) {
      const a = angle - halfFov + (2 * halfFov * i) / rays;
      const d = rayHit(x, y, a, range);
      pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
    }
    return pts;
  }

  function inShadow(x, y) {
    for (const s of state.level.shadows) {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    }
    return false;
  }

  function inMist(x, y) {
    for (const m of state.level.mist) {
      if (dist(x, y, m.x, m.y) < m.r) return true;
    }
    return false;
  }

  /** Move a circle with wall sliding; returns the distance actually travelled. */
  function moveCircle(body, dx, dy, radius) {
    let moved = 0;
    const nx = body.x + dx;
    if (!circleHitsWall(nx, body.y, radius)) {
      body.x = nx;
      moved += Math.abs(dx);
    }
    const ny = body.y + dy;
    if (!circleHitsWall(body.x, ny, radius)) {
      body.y = ny;
      moved += Math.abs(dy);
    }
    body.x = clamp(body.x, radius + 2, FIELD.width - radius - 2);
    body.y = clamp(body.y, radius + 2, FIELD.height - radius - 2);
    return moved;
  }

  function circleHitsWall(x, y, radius) {
    for (const w of state.level.walls) {
      const cx = clamp(x, w.x, w.x + w.w);
      const cy = clamp(y, w.y, w.y + w.h);
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < radius * radius) return true;
    }
    return false;
  }

  function loadLevel(index) {
    state.levelIndex = index;
    state.level = LEVEL_DEFS[index];
    const def = state.level;
    state.player.x = def.start.x;
    state.player.y = def.start.y;
    state.player.dirX = 0;
    state.player.dirY = -1;
    state.player.stamina = STAMINA.max;
    state.player.sprintLocked = false;
    state.player.invuln = 0;
    state.guards = def.guards.map((g) => ({
      x: g.waypoints[0][0],
      y: g.waypoints[0][1],
      waypoints: g.waypoints,
      wp: 1 % g.waypoints.length,
      speed: g.speed,
      angle: 0,
      state: 'patrol',
      suspicion: 0,
      pauseT: 0,
      stuckT: 0,
      lastX: g.waypoints[0][0],
      lastY: g.waypoints[0][1],
      lastSeen: null,
      loseT: 0,
      searchT: 0,
      scanDir: 1,
    }));
    for (const g of state.guards) {
      const t = g.waypoints[g.wp];
      g.angle = Math.atan2(t[1] - g.y, t[0] - g.x);
    }
    state.loot = def.loot.map((l) => ({ ...l, taken: false }));
    state.smokes = [];
    state.noises = [];
    state.beamAngle = -Math.PI / 2;
    state.beamSuspicion = 0;
    state.alarm = 0;
    state.alarmCool = 0;
    state.lootGot = 0;
    state.lootValue = 0;
    state.levelTime = 0;
    state.ghost = true;
    state.caughtFlash = 0;
    state.levelScore = 0;
  }

  function triggerAlarm(sourceX, sourceY) {
    if (state.alarm > 0) return false;
    state.alarm = ALARM.seconds;
    state.alarmCool = ALARM.coolDown;
    state.ghost = false;
    state.sfx.push('alarm');
    for (const g of state.guards) {
      if (g.state !== 'alert') {
        g.state = 'alert';
        g.lastSeen = { x: sourceX, y: sourceY };
        g.loseT = 0;
      }
    }
    return true;
  }

  function guardCanSee(g) {
    const p = state.player;
    const d = dist(g.x, g.y, p.x, p.y);
    if (d > GUARD.range) return { see: false, d };
    if (Math.abs(angleDiff(Math.atan2(p.y - g.y, p.x - g.x), g.angle)) > GUARD.halfFov) return { see: false, d };
    if (!losClear(g.x, g.y, p.x, p.y)) return { see: false, d };
    return { see: true, d };
  }

  function stepGuard(g, dt) {
    const p = state.player;
    const seen = guardCanSee(g);
    const wasSuspicious = g.suspicion >= 50;

    if (seen.see) {
      let rate = GUARD.gainBase * (1 - (seen.d / GUARD.range) * 0.7);
      if (p.sprint) rate *= GUARD.gainSprint;
      if (p.sneak) rate *= GUARD.gainSneak;
      if (inShadow(p.x, p.y)) rate *= GUARD.gainShadow;
      if (inMist(p.x, p.y)) rate *= GUARD.gainMist;
      g.suspicion = Math.min(100, g.suspicion + rate * dt);
      g.lastSeen = { x: p.x, y: p.y };
      g.loseT = 0;
      if (g.suspicion >= 100 && g.state !== 'alert') {
        g.state = 'alert';
        if (triggerAlarm(p.x, p.y)) return EVENT_ALARM;
      }
    } else {
      g.suspicion = Math.max(0, g.suspicion - GUARD.decay * dt);
    }
    if (!wasSuspicious && g.suspicion >= 50 && g.suspicion < 100) {
      state.sfx.push('spotted');
    }

    let target = null;
    let speed = g.speed;
    if (g.state === 'alert') {
      if (seen.see) {
        target = { x: p.x, y: p.y };
        speed = GUARD.chaseSpeed;
      } else {
        g.loseT += dt;
        if (g.loseT >= GUARD.loseSight) {
          g.state = 'search';
          g.searchT = GUARD.searchTime;
          target = g.lastSeen;
          speed = GUARD.investigateSpeed;
        } else {
          target = g.lastSeen;
          speed = GUARD.chaseSpeed;
        }
      }
    } else if (g.state === 'investigate') {
      target = g.investigate;
      speed = GUARD.investigateSpeed;
      if (target && dist(g.x, g.y, target.x, target.y) < 12) {
        g.pauseT += dt;
        g.angle += g.scanDir * 1.4 * dt;
        if (g.pauseT > 2) {
          g.state = 'patrol';
          g.pauseT = 0;
        }
        return 0;
      }
    } else if (g.state === 'search') {
      target = g.lastSeen;
      speed = GUARD.investigateSpeed;
      if (target && dist(g.x, g.y, target.x, target.y) < 12) {
        g.searchT -= dt;
        g.angle += g.scanDir * 1.6 * dt;
        if (g.searchT <= 0) {
          g.state = 'patrol';
          g.suspicion = 0;
        }
        return 0;
      }
    } else {
      // Patrol: walk the waypoint loop, pausing briefly at each one.
      const wp = g.waypoints[g.wp];
      if (g.pauseT > 0) {
        g.pauseT -= dt;
        g.angle += g.scanDir * 0.9 * dt;
        return 0;
      }
      target = { x: wp[0], y: wp[1] };
      if (dist(g.x, g.y, wp[0], wp[1]) < 10) {
        g.wp = (g.wp + 1) % g.waypoints.length;
        g.pauseT = 0.8;
        g.scanDir = g.scanDir === 1 ? -1 : 1;
        return 0;
      }
    }

    if (target) {
      const d = dist(g.x, g.y, target.x, target.y);
      if (d > 4) {
        const want = Math.atan2(target.y - g.y, target.x - g.x);
        let turn = angleDiff(want, g.angle);
        const maxTurn = 5 * dt;
        g.angle += clamp(turn, -maxTurn, maxTurn);
        const moved = moveCircle(g, Math.cos(g.angle) * speed * dt, Math.sin(g.angle) * speed * dt, GUARD.radius);
        if (moved < speed * dt * 0.25) {
          g.stuckT += dt;
          if (g.stuckT > 1.5 && g.state === 'patrol') {
            // A waypoint the walls will not let us reach: skip it.
            g.wp = (g.wp + 1) % g.waypoints.length;
            g.stuckT = 0;
          }
        } else {
          g.stuckT = 0;
        }
      }
    }
    return 0;
  }

  function stepBeam(dt) {
    const def = state.level;
    if (!def.beam) return 0;
    state.beamAngle += (TAU / def.beam.period) * dt;
    const p = state.player;
    const d = dist(def.beam.x, def.beam.y, p.x, p.y);
    let hit = false;
    if (d < def.beam.range) {
      const a = Math.atan2(p.y - def.beam.y, p.x - def.beam.x);
      if (Math.abs(angleDiff(a, state.beamAngle)) < BEAM.halfWidth && losClear(def.beam.x, def.beam.y, p.x, p.y)) {
        hit = true;
      }
    }
    if (hit) {
      let rate = BEAM.suspicionRate * (1 - (d / def.beam.range) * 0.5);
      if (p.sneak) rate *= GUARD.gainSneak;
      if (inShadow(p.x, p.y)) rate *= GUARD.gainShadow;
      if (inMist(p.x, p.y)) rate *= GUARD.gainMist;
      state.beamSuspicion = Math.min(100, state.beamSuspicion + rate * dt);
      if (state.beamSuspicion >= 100) {
        state.beamSuspicion = 60;
        if (triggerAlarm(p.x, p.y)) return EVENT_ALARM;
      }
    } else {
      state.beamSuspicion = Math.max(0, state.beamSuspicion - 20 * dt);
    }
    return 0;
  }

  function useGadget(kind, aimX, aimY) {
    const p = state.player;
    if (kind === 'smoke') {
      state.smokes.push({ x: p.x, y: p.y, r: GADGETS.smoke.radius, t: GADGETS.smoke.seconds });
      state.sfx.push('smoke');
      return true;
    }
    const dx = aimX - p.x;
    const dy = aimY - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = kind === 'chime' ? 300 : 260;
    const tx = p.x + (dx / d) * Math.min(d, range);
    const ty = p.y + (dy / d) * Math.min(d, range);
    state.noises.push({ x: tx, y: ty, t: 0.6, radius: kind === 'chime' ? GADGETS.chime.radius : GADGETS.pebble.radius, kind });
    state.sfx.push(kind);
    for (const g of state.guards) {
      if (g.state === 'alert') continue;
      if (dist(g.x, g.y, tx, ty) < (kind === 'chime' ? GADGETS.chime.radius : GADGETS.pebble.radius)) {
        g.state = 'investigate';
        g.investigate = { x: tx, y: ty };
        g.pauseT = 0;
        g.suspicion = Math.max(g.suspicion, 30);
      }
    }
    return true;
  }

  function step(dt, input) {
    let events = 0;
    state.time += dt;
    state.levelTime += dt;
    state.sfx.length = 0;
    const p = state.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (state.caughtFlash > 0) state.caughtFlash -= dt;
    if (state.alarm > 0) state.alarm -= dt;
    if (state.alarmCool > 0) state.alarmCool -= dt;

    // Gadgets (one-shot, from the input's gadget queue).
    if (input.gadget) {
      const counts = input.gadgetCounts;
      if (counts && counts[input.gadget] > 0) {
        if (useGadget(input.gadget, input.aimX ?? p.x, input.aimY ?? p.y)) {
          counts[input.gadget] -= 1;
          events |= EVENT_GADGET;
        }
      }
    }

    // Player movement.
    const mx = input.mx || 0;
    const my = input.my || 0;
    const moving = mx !== 0 || my !== 0;
    let speed = PLAYER.walkSpeed;
    p.sneak = !!input.sneak && !input.sprint;
    p.sprint = !!input.sprint && !p.sprintLocked && moving;
    if (p.sneak) speed = PLAYER.sneakSpeed;
    else if (p.sprint) speed = PLAYER.sprintSpeed;
    if (moving) {
      const len = Math.hypot(mx, my) || 1;
      const nx = (mx / len) * speed * dt;
      const ny = (my / len) * speed * dt;
      moveCircle(p, nx, ny, PLAYER.radius);
      p.dirX = mx / len;
      p.dirY = my / len;
    }
    if (p.sprint && moving) {
      p.stamina = Math.max(0, p.stamina - STAMINA.drain * dt);
      if (p.stamina <= 0) p.sprintLocked = true;
    } else {
      p.stamina = Math.min(STAMINA.max, p.stamina + STAMINA.refill * dt);
      if (p.stamina > STAMINA.minSprint) p.sprintLocked = false;
    }

    // Loot pickup.
    for (const l of state.loot) {
      if (!l.taken && dist(p.x, p.y, l.x, l.y) < PLAYER.radius + 16) {
        l.taken = true;
        state.lootGot += 1;
        state.lootValue += l.value;
        state.score += l.value;
        state.sfx.push('pickup');
        events |= EVENT_PICKUP;
      }
    }

    // Noises and smoke age.
    for (const n of state.noises) n.t -= dt;
    state.noises = state.noises.filter((n) => n.t > 0);
    for (const s of state.smokes) s.t -= dt;
    state.smokes = state.smokes.filter((s) => s.t > 0);

    // Guards.
    for (const g of state.guards) {
      events |= stepGuard(g, dt);
    }
    events |= stepBeam(dt);

    // Caught? An alerted guard close enough, and not in the grace window.
    if (p.invuln <= 0) {
      for (const g of state.guards) {
        if (g.state === 'alert' && dist(g.x, g.y, p.x, p.y) < GUARD.catchDist) {
          state.lives -= 1;
          state.caughtFlash = 1.2;
          state.sfx.push('caught');
          events |= EVENT_CAUGHT;
          if (state.lives <= 0) {
            return events | EVENT_OVER;
          }
          // The level resets (loot included), so its points come off the score too.
          state.score -= state.lootValue;
          loadLevel(state.levelIndex);
          p.invuln = PLAYER.invulnerable;
          return events;
        }
      }
    }

    // Exit: open once the required loot is carried.
    const def = state.level;
    const ex = def.exit;
    if (
      state.lootGot >= def.required &&
      p.x > ex.x && p.x < ex.x + ex.w && p.y > ex.y && p.y < ex.y + ex.h
    ) {
      const timeBonus = Math.max(0, Math.round(def.par - state.levelTime)) * SCORE.timePerSecond;
      const ghostBonus = state.ghost ? SCORE.ghostBonus : 0;
      state.levelScore = timeBonus + ghostBonus;
      state.score += state.levelScore;
      state.sfx.push('level');
      if (state.levelIndex >= LEVEL_DEFS.length - 1) {
        state.winScore = state.score;
        return events | EVENT_WIN;
      }
      return events | EVENT_LEVEL;
    }
    return events;
  }

  loadLevel(0);

  /** Start the whole game over: lives and score back, first night loaded. */
  function reset() {
    state.lives = LIVES;
    state.score = 0;
    state.winScore = 0;
    loadLevel(0);
  }

  return {
    state,
    loadLevel,
    reset,
    step,
    conePolygon,
    losClear,
    pointInWall,
    inShadow,
    inMist,
    events: { EVENT_PICKUP, EVENT_ALARM, EVENT_CAUGHT, EVENT_LEVEL, EVENT_WIN, EVENT_OVER, EVENT_SPOTTED, EVENT_GADGET },
  };
}

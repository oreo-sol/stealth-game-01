// Paints the world on a canvas: night floor, walls, shadows and mist, loot and the exit,
// guards with their raycast vision cones, the player, the lighthouse beam, the darkness
// overlay with its lantern-lit holes, the HUD, and the title / pause / level / end screens.
// The renderer only reads state; it never changes it.

import { FIELD, FONT, GADGETS, GUARD, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL = 'level';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const LOOT_STYLE = {
  shard: { color: PALETTE.lootShard, label: 'lens shard' },
  log: { color: PALETTE.lootLog, label: 'logbook' },
  oil: { color: PALETTE.lootOil, label: 'lamp oil' },
  brass: { color: PALETTE.lootBrass, label: 'brass' },
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  const darkCtx = dark.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view = {
      scale,
      ox: (canvas.width - FIELD.width * scale) / 2,
      oy: (canvas.height - FIELD.height * scale) / 2,
      w: canvas.width,
      h: canvas.height,
    };
    dark.width = canvas.width;
    dark.height = canvas.height;
  }
  window.addEventListener('resize', resize);
  resize();

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function coneColor(g) {
    if (g.state === 'alert') return PALETTE.coneAlert;
    if (g.suspicion >= 50) return PALETTE.coneSuspect;
    return PALETTE.coneCalm;
  }

  function drawFloor(state) {
    ctx.fillStyle = PALETTE.floorA;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.floorB;
    for (let y = 0; y < FIELD.height; y += 128) {
      for (let x = (y / 128) % 2 === 0 ? 0 : 64; x < FIELD.width; x += 128) {
        ctx.fillRect(x, y, 64, 64);
      }
    }
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 64) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
    }
    for (let y = 0; y <= FIELD.height; y += 64) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();
  }

  function drawWorld(state, conePolygon) {
    drawFloor(state);
    const def = state.level;

    for (const s of def.shadows) {
      ctx.fillStyle = 'rgba(8, 12, 26, 0.55)';
      rr(s.x, s.y, s.w, s.h, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 140, 190, 0.25)';
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const m of def.mist) {
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        ctx.fillStyle = 'rgba(157, 184, 214, 0.10)';
        ctx.beginPath();
        ctx.arc(m.x + Math.cos(a) * m.r * 0.35, m.y + Math.sin(a) * m.r * 0.35, m.r * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Exit: a doorway (or the boat) that glows green once the loot is carried.
    const ex = def.exit;
    const open = state.lootGot >= def.required;
    ctx.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    rr(ex.x, ex.y, ex.w, ex.h, 8);
    ctx.fill();
    ctx.fillStyle = '#0a0e1a';
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'EXIT' : `LOCKED ${state.lootGot}/${def.required}`, ex.x + ex.w / 2, ex.y + ex.h / 2 + 5);
    if (!open) {
      ctx.strokeStyle = 'rgba(10, 14, 26, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ex.x + 8, ex.y + 8);
      ctx.lineTo(ex.x + ex.w - 8, ex.y + ex.h - 8);
      ctx.moveTo(ex.x + ex.w - 8, ex.y + 8);
      ctx.lineTo(ex.x + 8, ex.y + ex.h - 8);
      ctx.stroke();
    }

    const t = performance.now() / 1000;
    for (const l of state.loot) {
      if (l.taken) continue;
      const style = LOOT_STYLE[l.kind];
      const pulse = 1 + 0.12 * Math.sin(t * 3 + l.x);
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = style.color;
      const s = 11 * pulse;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.strokeStyle = style.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 18 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const s of state.smokes) {
      ctx.fillStyle = 'rgba(199, 211, 224, 0.35)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(199, 211, 224, 0.25)';
      ctx.beginPath();
      ctx.arc(s.x - s.r * 0.4, s.y - s.r * 0.2, s.r * 0.6, 0, Math.PI * 2);
      ctx.arc(s.x + s.r * 0.4, s.y + s.r * 0.3, s.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const n of state.noises) {
      const frac = 1 - n.t / 0.6;
      ctx.strokeStyle = n.kind === 'chime' ? 'rgba(232, 182, 76, 0.8)' : 'rgba(238, 241, 245, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 6 + frac * n.radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Guards.
    for (const g of state.guards) {
      ctx.fillStyle = PALETTE.guardDark;
      ctx.beginPath();
      ctx.arc(g.x, g.y, GUARD.radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.guard;
      ctx.beginPath();
      ctx.arc(g.x, g.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      // Facing tick and lantern dot.
      ctx.strokeStyle = '#eef1f5';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.angle) * (GUARD.radius + 6), g.y + Math.sin(g.angle) * (GUARD.radius + 6));
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(g.x + Math.cos(g.angle) * (GUARD.radius - 2), g.y + Math.sin(g.angle) * (GUARD.radius - 2), 3, 0, Math.PI * 2);
      ctx.fill();
      // Suspicion arc over the head.
      if (g.suspicion > 2) {
        ctx.strokeStyle = g.suspicion >= 50 ? PALETTE.coneSuspect : PALETTE.coneCalm;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(g.x, g.y - GUARD.radius - 8, 9, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * g.suspicion) / 100);
        ctx.stroke();
      }
      // ? when suspicious, ! when alerted.
      if (g.state === 'alert') {
        ctx.fillStyle = PALETTE.danger;
        ctx.font = `bold 20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('!', g.x, g.y - GUARD.radius - 14);
      } else if (g.suspicion >= 50) {
        ctx.fillStyle = PALETTE.coneSuspect;
        ctx.font = `bold 20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('?', g.x, g.y - GUARD.radius - 14);
      }
    }

    // Player: a hooded figure, gold against the dark.
    const p = state.player;
    const blink = p.invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0;
    if (!blink) {
      ctx.fillStyle = PALETTE.playerDark;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a0e1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.dirX * 16, p.y + p.dirY * 16);
      ctx.stroke();
      if (p.sneak) {
        ctx.strokeStyle = 'rgba(238, 241, 245, 0.7)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Walls, with a lit top edge.
    for (const w of def.walls) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(w.x, w.y, w.w, 4);
    }

    // The lamp itself on the final night: a brass housing that throws the beam.
    if (def.beam) {
      ctx.fillStyle = '#8a6a24';
      ctx.beginPath();
      ctx.arc(def.beam.x, def.beam.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(def.beam.x, def.beam.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6a24';
      ctx.beginPath();
      ctx.arc(def.beam.x, def.beam.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDarkness(state) {
    darkCtx.setTransform(1, 0, 0, 1, 0, 0);
    darkCtx.clearRect(0, 0, dark.width, dark.height);
    darkCtx.fillStyle = 'rgba(5, 8, 18, 0.78)';
    darkCtx.fillRect(0, 0, dark.width, dark.height);
    darkCtx.globalCompositeOperation = 'destination-out';
    const holes = [];
    const p = state.player;
    holes.push([p.x, p.y, 175, 0.85]);
    const ex = state.level.exit;
    holes.push([ex.x + ex.w / 2, ex.y + ex.h / 2, 110, 0.7]);
    for (const l of state.loot) if (!l.taken) holes.push([l.x, l.y, 55, 0.55]);
    for (const g of state.guards) holes.push([g.x, g.y, 85, 0.45]);
    if (state.level.beam) holes.push([state.level.beam.x, state.level.beam.y, 150, 0.8]);
    for (const [x, y, r, a] of holes) {
      const gx = view.ox + x * view.scale;
      const gy = view.oy + y * view.scale;
      const gr = r * view.scale;
      const grad = darkCtx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      grad.addColorStop(0, `rgba(0, 0, 0, ${a})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      darkCtx.fillStyle = grad;
      darkCtx.beginPath();
      darkCtx.arc(gx, gy, gr, 0, Math.PI * 2);
      darkCtx.fill();
    }
    darkCtx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(dark, 0, 0);
  }

  function drawCones(state, conePolygon) {
    for (const g of state.guards) {
      const pts = conePolygon(g.x, g.y, g.angle, GUARD.halfFov, GUARD.range);
      const color = coneColor(g);
      ctx.fillStyle = color;
      ctx.globalAlpha = g.state === 'alert' ? 0.34 : 0.26;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (state.level.beam) {
      const b = state.level.beam;
      const pts = conePolygon(b.x, b.y, state.beamAngle, 0.16, b.range);
      ctx.fillStyle = '#ffe9a8';
      ctx.globalAlpha = 0.20;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawHud(state, screen, best) {
    const def = state.level;
    ctx.fillStyle = 'rgba(5, 8, 18, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, 44);
    ctx.fillRect(0, FIELD.height - 40, FIELD.width, 40);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'left';
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(`${def.name} — ${def.title}`, 16, 28);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`◆ ${state.lootGot}/${def.required} loot   ♥ ${'♥'.repeat(state.lives)}${'♡'.repeat(Math.max(0, 3 - state.lives))}`, 16, FIELD.height - 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(`Score ${state.score}`, FIELD.width - 16, 28);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    const mm = Math.floor(state.levelTime / 60);
    const ss = Math.floor(state.levelTime % 60).toString().padStart(2, '0');
    ctx.fillText(`Best ${Math.max(best, state.score)}   ${mm}:${ss}`, FIELD.width - 16, FIELD.height - 14);

    // Stamina bar.
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText('SHIFT sprint', 16, FIELD.height - 52);
    ctx.fillStyle = '#26304a';
    ctx.fillRect(120, FIELD.height - 62, 140, 10);
    ctx.fillStyle = p.stamina > 30 ? PALETTE.exit : PALETTE.danger;
    ctx.fillRect(120, FIELD.height - 62, 140 * (p.stamina / 100), 10);

    // Gadgets.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `15px ${FONT}`;
    const g = state.gadgetCounts;
    ctx.fillText(`1 Pebble ×${g.pebble}    2 Smoke ×${g.smoke}    3 Chime ×${g.chime}`, FIELD.width - 16, FIELD.height - 52);

    // Alarm banner.
    if (state.alarm > 0) {
      const flash = Math.floor(performance.now() / 180) % 2 === 0;
      ctx.fillStyle = flash ? PALETTE.danger : '#7a1d20';
      ctx.textAlign = 'center';
      ctx.font = `bold 26px ${FONT}`;
      ctx.fillText('— ALARM —', FIELD.width / 2, 78);
    } else {
      let maxSus = 0;
      for (const gd of state.guards) maxSus = Math.max(maxSus, gd.suspicion);
      if (state.beamSuspicion > 30) maxSus = Math.max(maxSus, state.beamSuspicion);
      if (maxSus > 2) {
        ctx.fillStyle = maxSus >= 50 ? PALETTE.coneSuspect : PALETTE.coneCalm;
        ctx.textAlign = 'center';
        ctx.font = `bold 15px ${FONT}`;
        ctx.fillText(maxSus >= 50 ? 'SUSPICIOUS — break line of sight!' : 'SEEN — stay out of the light', FIELD.width / 2, 72);
      }
    }

    if (state.caughtFlash > 0) {
      ctx.fillStyle = `rgba(229, 72, 77, ${0.25 * (state.caughtFlash / 1.2)})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(5, 8, 18, 0.6)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      panel('Paused', ['Take a breath. The patrols keep walking.', '', 'Space — resume      M — sound on/off']);
    }
  }

  function panel(title, lines, accent) {
    const w = 640;
    const h = 120 + lines.length * 30;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    ctx.fillStyle = 'rgba(10, 14, 26, 0.92)';
    rr(x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || PALETTE.gold;
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(title, FIELD.width / 2, y + 58);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, y + 100 + i * 30);
    });
  }

  function draw(state, screen, best, conePolygon) {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(-view.ox / view.scale, -view.oy / view.scale, view.w / view.scale, view.h / view.scale);
    drawWorld(state, conePolygon);
    drawDarkness(state);
    drawCones(state, conePolygon);

    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(5, 8, 18, 0.55)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 64px ${FONT}`;
      ctx.fillText('BEACONLIGHT', FIELD.width / 2, 190);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `24px ${FONT}`;
      ctx.fillText('The Lighthouse Job', FIELD.width / 2, 232);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `17px ${FONT}`;
      ctx.fillText('Four nights. One stolen light. Slip past the keepers, take it back, vanish unseen.', FIELD.width / 2, 272);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `16px ${FONT}`;
      const lines = [
        'WASD / arrows — move      SHIFT — sprint (drains stamina)      C — sneak',
        '1 pebble · 2 smoke · 3 chime — gadgets (aim with the mouse, press the key)',
        'Stay out of the cones. Shadows slow their eyes; mist hides you. The beam is another eye.',
        'Carry the required loot to the exit. Three lives. Ghost a night for +250.',
      ];
      lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 330 + i * 28));
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText('Press SPACE to begin', FIELD.width / 2, 500);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `15px ${FONT}`;
      ctx.fillText(`Best score ${best}      ·      P pause      ·      M sound`, FIELD.width / 2, 534);
      return;
    }

    drawHud(state, screen, best);

    if (screen === SCREEN_LEVEL) {
      const def = state.level;
      panel('Night complete', [
        `${def.name} — ${def.title}`,
        `Loot ${state.lootValue}   ·   Time bonus ${state.levelScore - (state.ghost ? 250 : 0)}   ·   Ghost ${state.ghost ? '+250' : '—'}`,
        `Level score ${state.levelScore}      Total ${state.score}`,
        '',
        'SPACE — next night',
      ]);
    } else if (screen === SCREEN_WIN) {
      panel(
        'The light is yours',
        [
          'Four nights, four shards, and not a soul the wiser — or at least, none that caught you.',
          `Final score ${state.winScore}      ·      Best ${Math.max(best, state.winScore)}`,
          '',
          'SPACE — play again',
        ],
        PALETTE.exit,
      );
    } else if (screen === SCREEN_OVER) {
      panel(
        'Caught for the last time',
        [
          'The keepers drag you to the shore gate as the lamp turns overhead.',
          `Score ${state.score}      ·      Best ${Math.max(best, state.score)}`,
          '',
          'SPACE — try again',
        ],
        PALETTE.danger,
      );
    }
  }

  return { draw, resize };
}

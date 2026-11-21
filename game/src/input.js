// Keyboard and pointer input. WASD/arrows steer; Shift sprints, C sneaks; Space/Enter
// confirm, P/Esc pause, M mutes. Number keys use a gadget toward the mouse; clicking the
// canvas throws a pebble toward the click. One-shot presses are queued as flags and taken
// once by the loop, so a press between two frames is never lost or counted twice.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const SNEAK = new Set(['KeyC', 'ControlLeft', 'ControlRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let gadget = null;
  let mouseX = FIELD.width / 2;
  let mouseY = FIELD.height / 2;

  function fieldPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const ox = (rect.width - FIELD.width * scale) / 2;
    const oy = (rect.height - FIELD.height * scale) / 2;
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'Digit1') {
      if (!event.repeat) gadget = { kind: 'pebble', x: mouseX, y: mouseY };
    } else if (event.code === 'Digit2') {
      if (!event.repeat) gadget = { kind: 'smoke', x: mouseX, y: mouseY };
    } else if (event.code === 'Digit3') {
      if (!event.repeat) gadget = { kind: 'chime', x: mouseX, y: mouseY };
    }
    keys.add(event.code);
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || SPRINT.has(event.code) || SNEAK.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });
  canvas.addEventListener('pointermove', (event) => {
    const p = fieldPoint(event.clientX, event.clientY);
    mouseX = p.x;
    mouseY = p.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = fieldPoint(event.clientX, event.clientY);
    mouseX = p.x;
    mouseY = p.y;
    gadget = { kind: 'pebble', x: p.x, y: p.y };
    actions |= ACTION_CONFIRM;
  });

  function has(set) {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector, each component in -1..1. */
    move() {
      const mx = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const my = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      return { mx, my };
    },
    sneak() {
      return has(SNEAK);
    },
    sprint() {
      return has(SPRINT);
    },
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    /** The queued gadget use since the last call, or null. */
    takeGadget() {
      const taken = gadget;
      gadget = null;
      return taken;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

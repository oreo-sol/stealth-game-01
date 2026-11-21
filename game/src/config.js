// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on screen size.
// BEACONLIGHT — The Lighthouse Job: a top-down stealth game in four nights.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 12,
  walkSpeed: 165,
  sneakSpeed: 95,
  sprintSpeed: 265,
  /** Seconds of grace after being caught, during which guards cannot catch again. */
  invulnerable: 2.0,
};

export const LIVES = 3;

/** Stamina: sprint drains it, walking and sneaking refill it. */
export const STAMINA = { max: 100, drain: 34, refill: 22, minSprint: 12 };

export const GUARD = {
  radius: 13,
  patrolSpeed: 62,
  chaseSpeed: 148,
  investigateSpeed: 95,
  /** Vision range and half-angle of the cone, in px and radians. */
  range: 225,
  halfFov: 0.62,
  /** Suspicion 0..100. Base gain per second at point blank, scaled by distance and stance. */
  gainBase: 62,
  gainSprint: 1.6,
  gainSneak: 0.55,
  gainShadow: 0.45,
  gainMist: 0.12,
  decay: 16,
  /** Seconds of not seeing the player before an alerted guard gives up the chase. */
  loseSight: 3.0,
  /** Seconds spent searching the last seen spot before returning to patrol. */
  searchTime: 4.0,
  /** How close an alerted guard must get to catch the player. */
  catchDist: 26,
};

export const GADGETS = {
  pebble: { start: 5, label: 'Pebble', key: '1', radius: 150 },
  smoke: { start: 2, label: 'Smoke', key: '2', radius: 95, seconds: 4.5 },
  chime: { start: 2, label: 'Chime', key: '3', radius: 260 },
};

/** The lighthouse beam on the final night: a sweeping cone of light. */
export const BEAM = { suspicionRate: 55, range: 520, halfWidth: 0.16 };

export const ALARM = { seconds: 6, coolDown: 8 };

/** Points: loot value as listed per piece; time bonus per second under par; ghost bonus. */
export const SCORE = { timePerSecond: 10, ghostBonus: 250 };

export const PALETTE = {
  // Night palette: deep blue stone, warm lantern gold, sea mist.
  backdrop: '#0a0e1a',
  floorA: '#1c2438',
  floorB: '#171e2f',
  floorLine: '#232c44',
  wall: '#3a4666',
  wallTop: '#4d5a80',
  shadow: '#0d1322',
  mist: '#9db8d6',
  player: '#e8b64c',
  playerDark: '#8a6a24',
  guard: '#7d8fb5',
  guardDark: '#4a5878',
  coneCalm: '#e8c95c',
  coneSuspect: '#f08a2e',
  coneAlert: '#e5484d',
  lootShard: '#7de3ff',
  lootLog: '#f2e3b3',
  lootOil: '#c98af2',
  lootBrass: '#ffd76a',
  exit: '#58d68d',
  exitLocked: '#5a6a8a',
  smoke: '#c7d3e0',
  text: '#eef1f5',
  muted: '#9aa5bd',
  danger: '#e5484d',
  gold: '#e8b64c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'beaconlight.best';

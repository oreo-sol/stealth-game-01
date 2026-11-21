// BEACONLIGHT — The Lighthouse Job, a best-stealth-game-01 entry (Node 22, standard
// library only): the game is this directory's game/ folder, plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and no network
// request), and the program hands it in. It copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library, then validates what it wrote: every expected file
// exists and is non-empty, every screenshot is under the 256 KiB cap, and dossier.json
// parses, so a broken or empty build fails loudly here instead of in the grader.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_SCREENSHOT_BYTES = 262144;

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Validate the output: the game entry point and every screenshot must exist and be
// non-empty, no screenshot may exceed the cap, and the dossier must be valid JSON.
const failures = [];
function checkFile(path, label) {
  if (!existsSync(path)) failures.push(`${label} missing: ${path}`);
  else if (statSync(path).size === 0) failures.push(`${label} empty: ${path}`);
}
checkFile(join(out, 'game', 'index.html'), 'game entry');
checkFile(join(out, 'game', 'src', 'main.js'), 'game boot');
checkFile(join(out, 'dossier.json'), 'dossier');
const shots = readdirSync(join(out, 'screenshots')).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
if (shots.length === 0) failures.push('screenshots/ holds no image');
for (const shot of shots) {
  const path = join(out, 'screenshots', shot);
  checkFile(path, 'screenshot');
  if (existsSync(path) && statSync(path).size > MAX_SCREENSHOT_BYTES) {
    failures.push(`screenshot over 256 KiB: ${shot} (${statSync(path).size} bytes)`);
  }
}
try {
  const dossier = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
  if (typeof dossier !== 'object' || dossier === null) failures.push('dossier.json is not an object');
} catch (error) {
  failures.push(`dossier.json does not parse: ${error.message}`);
}
if (failures.length > 0) {
  throw new Error(`output validation failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
}
console.log(`ok: game/ + ${shots.length} screenshot(s) + dossier.json validated in ${out}`);

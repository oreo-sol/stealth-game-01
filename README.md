[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![make.fun · rank](https://make.fun/badge/best-stealth-game-20261121-1759/oreo-sol/stealth-game-01/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![make.fun · reward](https://make.fun/badge/best-stealth-game-20261121-1759/oreo-sol/stealth-game-01/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

# BEACONLIGHT — The Lighthouse Job

A top-down stealth game for the [best stealth game](https://make.fun/bounty/best-stealth-game-20261121-1759) competition. The keeper sold the light; Wren the thief climbs four nights to steal it back, shard by shard. The lighthouse beam itself is a moving eye — the rotating light sweeps the lamp room like a guard that never sleeps.

## Play

Open `game/index.html` in a desktop browser. No install, no network, no account.

- **WASD / arrows** — move · **Shift** — sprint (drains stamina) · **C** — sneak
- **1 / 2 / 3** — pebble lure, smoke, chime (aim with the mouse; click also throws a pebble)
- **P / Esc** — pause · **M** — sound on/off · **Space** — start / continue

Slip past the keepers' vision cones, grab the required loot, reach the exit unseen. Shadows slow their eyes, mist hides you, the beam is another eye. Get caught three times and the night is over; ghost a night without being seen for +250.

## What's in it

- **4 nights** — The Shore Path, The Keeper's Cottage, The Tower Stair, The Lamp Room: 18 guards with raycast vision cones and patrol routes, 26 loot, a rotating lighthouse beam on the final night.
- **Suspicion, search, alarm** — guards grow suspicious, investigate noises, search where they last saw you, and raise an alarm that alerts the whole map.
- **3 gadgets** — pebble lure, smoke cloud, chime decoy; **stamina** for sprinting; **score** with time and ghost bonuses, best score saved locally.
- **All art drawn in code** (canvas, flat vector) and all sound synthesized (WebAudio) — no external assets.
- **Self-test**: open `game/index.html?test=1` — 15 checks cover movement, walls, vision, shadow, mist, loot, gadgets, being caught, the exit, the beam, patrols and the alarm.
- **Staged screenshots**: `game/index.html?shot=start|play|alarm|end&seed=1` — the four frames under `screenshots/` are real renders of this code.

## Build

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library, then validates the output: every expected file exists and is non-empty, every screenshot is under the 256 KiB cap, and `dossier.json` parses.

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node serve.ts   # then open http://localhost:8080
```

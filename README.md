# Amber Isles Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/DaDiaoShuai/makefun-best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/DaDiaoShuai/makefun-best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A bush-plane courier over the golden-hour isles. Fly the amber rings, mind your fuel, and land it on the strip — in a desktop browser, from static files, with no network.

## Play

Open `game/index.html` in desktop Chrome, or serve the game locally:

```sh
node serve.ts
# then open http://localhost:8080
```

Pick a sortie on the title screen (click, or press 1 / 2 / 3):

- **Ring Run** — thread five rings over the isles, then bring her home.
- **Island Hop** — carry the mail to the far strip and land it soft, on the numbers.
- **Storm Return** — low fuel, gusting crosswind, dusk closing in.

## Controls

- **W / S** or **↑ / ↓** — pitch
- **A / D** or **← / →** — bank and turn
- **Shift** / **Ctrl** — throttle up / down
- **Mouse** — hold and drag to steer
- **F** — flaps, **P** — pause, **R** — restart, **M** — mute

## How it is built

- `game/` — the playable game as static files: a canvas chase view over a seeded low-poly archipelago, with a runway, target rings, weather, fuel and damage, and lit instruments (altitude, speed, heading, attitude, throttle, fuel).
- `game/src/` — one job per file: `config.js` (tuning and missions), `random.js` (seeded noise), `world.js` (islands, runway, rings, clouds), `physics.js` (flight model), `input.js` (keyboard and mouse), `audio.js` (synthesised WebAudio sounds), `render.js` (sky, terrain, aircraft, HUD), `shots.js` (screenshot poses), `main.js` (game loop and states).
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
- `screenshots/` — real renders of the game's own code.

## License

MIT. See [LICENSE](LICENSE).

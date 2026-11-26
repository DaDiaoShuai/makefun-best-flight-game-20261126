/* Amber Isles Courier — the entry program.
   One clear job: hand the game in. Copy game/ and screenshots/ from
   this repository to the output directory and write dossier.json with
   buildDossier from vendor/makefun-game.ts, exactly as the kit asks.
   Standard library only; no network, no installs. */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

function main(): void {
  if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  for (const name of ["game", "screenshots"]) {
    const src = join(repoRoot, name);
    if (!existsSync(src)) throw new Error(`main.ts: missing ${name}/ in the repository`);
    cpSync(src, join(outputDir, name), { recursive: true });
  }

  const dossier = buildDossier(repoRoot, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, "dossier.json"), dossier);
  console.log(`wrote ${outputDir}/dossier.json (${dossier.length} bytes)`);
}

main();

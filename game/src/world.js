/* The world: islands, sea, runway, rings and clouds.
   One clear job: answer "how high is the ground here?" and hand the
   renderer the fixed geography of the Amber Isles. Nothing here draws. */

import { fbm2D, mulberry32 } from "./random.js";
import { WORLD, clamp, degToRad } from "./config.js";

export const SEA_LEVEL = WORLD.seaLevel;
export const RUNWAY = {
  x: 0,
  z: 0,
  length: 720,
  width: 38,
  headingDeg: 0, // runs north-south, threshold at the south end
  altitude: WORLD.runwayAltitude,
};

/* The isles: centre, radius and peak height in metres. */
export const ISLANDS = [
  { x: 0, z: 0, r: 980, peak: 118, seed: 11, name: "Home Isle" },
  { x: -760, z: -1150, r: 430, peak: 128, seed: 23, name: "Palm Cay" },
  { x: 1150, z: -420, r: 520, peak: 158, seed: 37, name: "Ember Rock" },
  { x: 950, z: 950, r: 390, peak: 92, seed: 41, name: "Turtle Flat" },
  { x: -1150, z: 620, r: 460, peak: 142, seed: 53, name: "Windward" },
  { x: 240, z: -1450, r: 260, peak: 74, seed: 67, name: "Needle" },
  { x: -420, z: 1350, r: 300, peak: 66, seed: 71, name: "Driftwood" },
];

function islandHeight(x, z, isle) {
  const dx = x - isle.x;
  const dz = z - isle.z;
  const d = Math.sqrt(dx * dx + dz * dz) / isle.r;
  if (d >= 1) return 0;
  const falloff = Math.pow(Math.cos((d * Math.PI) / 2), 0.8);
  const rough = 0.72 + 0.28 * fbm2D(x / 260, z / 260, isle.seed, 3);
  return isle.peak * falloff * rough;
}

/* Distance from a point to the runway rectangle, in metres. */
function runwayDistance(x, z) {
  const halfL = RUNWAY.length / 2;
  const halfW = RUNWAY.width / 2;
  const dx = Math.max(Math.abs(x - RUNWAY.x) - halfW, 0);
  const dz = Math.max(Math.abs(z - RUNWAY.z) - halfL, 0);
  return Math.sqrt(dx * dx + dz * dz);
}

/* Ground height in metres. The strip itself is flattened to its altitude. */
export function terrainHeight(x, z) {
  let h = 0;
  for (const isle of ISLANDS) h += islandHeight(x, z, isle);
  const rd = runwayDistance(x, z);
  if (rd < 320) {
    const t = rd / 320;
    const blend = t * t * (3 - 2 * t);
    h = RUNWAY.altitude + (h - RUNWAY.altitude) * blend;
  }
  // A flat valley on the southern approach, so the strip is visible
  // from final and a landing is a landing, not a hill climb.
  if (z > RUNWAY.length / 2) {
    const along = z - RUNWAY.length / 2;
    if (along < 1100) {
      const across = clamp(1 - Math.abs(x - RUNWAY.x) / 220, 0, 1);
      const down = 1 - along / 1100;
      const valley = across * across * down * 0.92;
      h = RUNWAY.altitude + 2 + (h - RUNWAY.altitude - 2) * (1 - valley);
    }
  }
  return Math.max(h, -4);
}

export function isOverRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.width / 2 + 6 &&
    Math.abs(z - RUNWAY.z) <= RUNWAY.length / 2 + 6
  );
}

export function isOverSea(x, z) {
  return terrainHeight(x, z) <= 0.5;
}

/* Ring courses: one flowing path per mission, heights that reward
   climbing and descending rather than flying flat. */
const RING_PATHS = {
  "ring-run": [
    { x: 0, z: 260, alt: 150 },
    { x: -420, z: -220, alt: 210 },
    { x: -700, z: -950, alt: 180 },
    { x: 320, z: -1150, alt: 240 },
    { x: 1080, z: -520, alt: 190 },
  ],
  "island-hop": [
    { x: -520, z: 420, alt: 190 },
    { x: -900, z: -300, alt: 230 },
    { x: -420, z: -980, alt: 200 },
  ],
  "storm-return": [
    { x: 620, z: -420, alt: 230 },
    { x: 120, z: 120, alt: 170 },
    { x: -620, z: 480, alt: 210 },
    { x: -180, z: 900, alt: 160 },
  ],
};

export function ringPath(missionId) {
  return (RING_PATHS[missionId] || RING_PATHS["ring-run"]).map((r) => ({ ...r }));
}

/* Clouds: fixed, seeded, high above the isles. */
export function makeClouds() {
  const rng = mulberry32(20261126);
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({
      x: (rng() - 0.5) * 5200,
      z: (rng() - 0.5) * 5200,
      alt: 380 + rng() * 160,
      scale: 90 + rng() * 190,
      puffs: 3 + Math.floor(rng() * 3),
      seed: Math.floor(rng() * 1000),
    });
  }
  return clouds;
}

/* Gusts: a slow, seeded wobble so the wind never feels dead. */
export function gustAt(timeSec, mission) {
  const base = mission.wind.speed;
  const wobble = Math.sin(timeSec * 0.31) * 0.5 + Math.sin(timeSec * 0.83 + 1.7) * 0.3;
  return {
    speed: Math.max(0, base + wobble * base * 0.25),
    fromDeg: mission.wind.fromDeg + Math.sin(timeSec * 0.11) * 9,
  };
}

export function windVector(timeSec, mission) {
  const g = gustAt(timeSec, mission);
  const a = degToRad(g.fromDeg + 180); // wind blows *toward* this heading
  return { x: Math.sin(a) * g.speed, z: -Math.cos(a) * g.speed, speed: g.speed, fromDeg: g.fromDeg };
}

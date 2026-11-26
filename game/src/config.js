/* Amber Isles Courier — game configuration.
   One clear job: every tunable number for the flight model, the world
   and the three sorties lives here, so balancing never touches the
   engine, the renderer or the flight model. */

export const GAME_TITLE = "Amber Isles Courier";
export const GAME_SUBTITLE = "a bush-plane courier over the golden-hour isles";

// --- flight model ---------------------------------------------------------
export const FLIGHT = {
  maxSpeedKts: 165, // knots at full throttle, level flight
  cruiseSpeedKts: 110,
  stallSpeedKts: 52,
  maxThrottle: 1,
  throttleStep: 0.55, // per second while a throttle key is held
  pitchRate: 0.55, // radians per second at full stick
  rollRate: 1.5, // radians per second at full stick
  turnRate: 0.55, // heading change per second per radian of bank
  liftFactor: 0.9,
  dragFactor: 0.35,
  gravityMs: 9.81,
  climbFromPitch: 22, // m/s of vertical speed per radian of pitch
  maxBankDeg: 62,
  maxPitchDeg: 28,
  fuelBurnPerSec: 0.0016, // fraction of tank per second at full throttle
  fuelBurnIdle: 0.0004,
  damageOnHardLanding: 34,
  damageOnScrape: 18,
};

// --- world ----------------------------------------------------------------
export const WORLD = {
  seaLevel: 0,
  runwayAltitude: 10, // metres, the flattened strip on the home isle
  fogDistance: 2600, // metres, beyond this the terrain fades into haze
  viewDistance: 2100,
  terrainStepNear: 70,
  terrainStepFar: 160,
  sunAzimuthDeg: 262, // low sun in the west: golden hour
  sunElevationDeg: 14,
};

// --- palette: one golden-hour style for sky, sea and land -----------------
export const PALETTE = {
  skyTop: "#2e4a7a",
  skyMid: "#e8956b",
  skyHorizon: "#f7c489",
  sunCore: "#fff3c4",
  sunGlow: "rgba(255, 190, 90, 0.55)",
  seaDeep: "#1d4e6b",
  seaShallow: "#3f8ea8",
  seaGlitter: "rgba(255, 220, 150, 0.5)",
  sand: "#e8cf9a",
  grass: "#6fa055",
  forest: "#3f7a44",
  rock: "#8a7a6a",
  snow: "#e8e8e2",
  runway: "#3a3f46",
  runwayLine: "#f2f2e8",
  ringNext: "#ffb63d",
  ringDone: "#7ddc8a",
  ringFuture: "#9fb6c9",
  hudAmber: "#ffb63d",
  hudGreen: "#7ddc8a",
  hudRed: "#ff6b5e",
  panel: "rgba(16, 22, 32, 0.82)",
  planeCream: "#f2e6c8",
  planeRed: "#c94f3d",
  planeDark: "#2c343c",
};

// --- missions ---------------------------------------------------------------
// Each sortie is a different job with its own rings, fuel, wind and goal.
export const MISSIONS = [
  {
    id: "ring-run",
    name: "Ring Run",
    blurb: "Thread five rings over the isles, then bring her home.",
    rings: 5,
    fuel: 1.0,
    wind: { speed: 3, fromDeg: 270 },
    timeLimitSec: 240,
    start: { x: 0, z: 620, alt: 130, headingDeg: 0, speedKts: 95, throttle: 0.62 },
  },
  {
    id: "island-hop",
    name: "Island Hop",
    blurb: "Carry the mail to the far strip. Land it soft, on the numbers.",
    rings: 3,
    fuel: 0.72,
    wind: { speed: 7, fromDeg: 300 },
    timeLimitSec: 300,
    start: { x: -650, z: 900, alt: 170, headingDeg: 25, speedKts: 100, throttle: 0.66 },
  },
  {
    id: "storm-return",
    name: "Storm Return",
    blurb: "Low fuel, gusting crosswind, dusk closing in. Fly it like you mean it.",
    rings: 4,
    fuel: 0.45,
    wind: { speed: 12, fromDeg: 250 },
    timeLimitSec: 260,
    start: { x: 950, z: -750, alt: 210, headingDeg: 140, speedKts: 105, throttle: 0.7 },
  },
];

export const RING_RADIUS_M = 34;
export const RING_SCORE = 250;
export const LANDING_SCORE = 1000;
export const TIME_BONUS_PER_SEC = 4;

export function knotsToMs(kts) {
  return (kts * 1852) / 3600;
}
export function msToKnots(ms) {
  return (ms * 3600) / 1852;
}
export function feetOf(metres) {
  return Math.round(metres * 3.28084);
}
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function wrapAngle(rad) {
  while (rad > Math.PI) rad -= Math.PI * 2;
  while (rad < -Math.PI) rad += Math.PI * 2;
  return rad;
}
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}
export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

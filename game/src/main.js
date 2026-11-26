/* Amber Isles Courier — entry point.
   One clear job: own the game loop and the game states (title, flying,
   paused, landed, crashed, complete), and wire input, physics, audio
   and rendering together. The flight model lives in physics.js, the
   pictures live in render.js. */

import { GAME_TITLE, MISSIONS, clamp } from "./config.js";
import { createInput, drainActions, readStick } from "./input.js";
import { createAudio } from "./audio.js";
import { createPlane, planeStatus, stepPlane } from "./physics.js";
import { makeClouds } from "./world.js";
import { render } from "./render.js";
import { SHOTS, applyShot } from "./shots.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const input = createInput(canvas);
const audio = createAudio();
const clouds = makeClouds();

const params = new URLSearchParams(window.location.search);
const shotName = params.get("shot");
const freeze = params.get("freeze") === "1";

let selectedMission = 0;
let mission = MISSIONS[selectedMission];
let plane = createPlane(mission);
let gameState = "title"; // title | flying | paused | landed | crashed | complete
let lastTime = performance.now();
let elapsed = 0;
let muted = false;
let endReason = "";

function startMission(index) {
  selectedMission = index;
  mission = MISSIONS[index];
  plane = createPlane(mission);
  gameState = "flying";
  elapsed = 0;
  audio.unlock();
  audio.click();
}

function restart() {
  plane = createPlane(mission);
  gameState = "flying";
  elapsed = 0;
}

function status() {
  return planeStatus(plane, mission);
}

function handleActions() {
  for (const action of drainActions(input)) {
    if (typeof action === "string") {
      if (action === "restart") restart();
      else if (action === "pause") {
        if (gameState === "flying") gameState = "paused";
        else if (gameState === "paused") gameState = "flying";
      } else if (action === "mute") {
        muted = !muted;
        audio.setMuted(muted);
      } else if (action === "flaps") {
        plane.flaps = !plane.flaps;
      } else if (action.startsWith("mission-")) {
        const i = Number(action.slice("mission-".length));
        if (gameState === "title" || gameState === "landed" || gameState === "crashed" || gameState === "complete") {
          startMission(i);
        }
      } else if (action === "confirm") {
        if (gameState === "title") startMission(selectedMission);
        else if (gameState === "landed" || gameState === "crashed" || gameState === "complete") restart();
      }
      continue;
    }
    // Mouse click: mission cards on the title screen, restart elsewhere.
    if (action.type === "click") {
      audio.unlock();
      if (gameState === "title") {
        const card = missionCardAt(action.x, action.y);
        if (card >= 0) startMission(card);
      }
    }
  }
}

function missionCardAt(x, y) {
  const w = canvas.width;
  const h = canvas.height;
  const cardW = 250;
  const cardH = 118;
  const gap = 22;
  const totalW = cardW * 3 + gap * 2;
  const x0 = w / 2 - totalW / 2;
  const y0 = h * 0.36;
  if (y < y0 || y > y0 + cardH) return -1;
  for (let i = 0; i < 3; i++) {
    const cx0 = x0 + i * (cardW + gap);
    if (x >= cx0 && x <= cx0 + cardW) return i;
  }
  return -1;
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function frame(now) {
  const dt = clamp((now - lastTime) / 1000, 0.001, 0.05);
  lastTime = now;
  handleActions();

  if (gameState === "flying") {
    elapsed += dt;
    const stick = readStick(input, canvas.width, canvas.height);
    const events = stepPlane(plane, stick, dt, mission, elapsed);
    for (const e of events) {
      if (e === "ring") audio.ring();
      if (e === "landed") {
        audio.land();
        gameState = status().allRingsDone ? "complete" : "landed";
      }
      if (e === "crashed") {
        audio.crash();
        gameState = "crashed";
        endReason = plane.crashReason;
      }
    }
    if (status().timeLeft <= 0 && !plane.landed && !plane.crashed) {
      gameState = "crashed";
      plane.crashReason = "ran out of time over the isles";
    }
    audio.setEngine(plane.throttle, plane.speedMs / 85);
  }

  render(ctx, {
    width: canvas.width,
    height: canvas.height,
    plane,
    mission,
    missions: MISSIONS,
    status: status(),
    clouds,
    gameState,
    timeSec: elapsed,
    selectedMission,
    muted,
    endReason,
  });

  requestAnimationFrame(frame);
}

// --- screenshot mode: a fixed pose, rendered by the normal loop --------
// The pose is the game's own state; the loop keeps repainting it, so a
// resize (which clears a canvas) can never leave a blank frame.
if (shotName && SHOTS[shotName]) {
  mission = MISSIONS[0];
  plane = createPlane(mission);
  // The "approach" and "dusk" shots belong to the ring-run course too.
  applyShot(shotName, plane);
  gameState = shotName === "start" ? "title" : "flying";
  if (shotName === "start") selectedMission = 0;
  elapsed = 12; // a little simulated time, so the sun and sea settle
  document.title = `${GAME_TITLE} — ${SHOTS[shotName].title}`;
} else {
  document.title = GAME_TITLE;
}
requestAnimationFrame(frame);

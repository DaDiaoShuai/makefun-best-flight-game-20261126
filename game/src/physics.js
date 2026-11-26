/* The flight model: one clear job. A plane state goes in, a stepped
   plane state comes out — throttle, bank, pitch, lift, drag, wind,
   fuel, rings and landings, with no drawing anywhere in here. */

import {
  FLIGHT,
  RING_RADIUS_M,
  RING_SCORE,
  LANDING_SCORE,
  clamp,
  degToRad,
  knotsToMs,
  msToKnots,
  wrapAngle,
} from "./config.js";
import { isOverRunway, ringPath, terrainHeight, windVector } from "./world.js";

export function createPlane(mission) {
  const s = mission.start;
  return {
    x: s.x,
    z: s.z,
    alt: s.alt,
    heading: degToRad(s.headingDeg),
    pitch: 0,
    roll: 0,
    speedMs: knotsToMs(s.speedKts),
    throttle: s.throttle,
    fuel: mission.fuel,
    damage: 0,
    flaps: false,
    verticalSpeed: 0,
    rings: ringPath(mission.id).map((r) => ({ ...r, passed: false })),
    nextRing: 0,
    score: 0,
    landed: false,
    crashed: false,
    crashReason: "",
    timeSec: 0,
    groundSpeedKts: s.speedKts,
  };
}

/* Step the plane one frame. Returns events: "ring", "landed", "crashed". */
export function stepPlane(plane, stick, dt, mission, timeSec) {
  const events = [];
  if (plane.crashed || plane.landed) return events;
  plane.timeSec += dt;

  // Throttle: keys move it, and it stays where you leave it.
  plane.throttle = clamp(plane.throttle + stick.throttle * FLIGHT.throttleStep * dt, 0, 1);

  // Bank and pitch ease toward the stick, so the plane feels weighted.
  const targetRoll = stick.roll * degToRad(FLIGHT.maxBankDeg);
  const targetPitch = stick.pitch * degToRad(FLIGHT.maxPitchDeg);
  plane.roll += (targetRoll - plane.roll) * Math.min(1, dt * 3.2);
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, dt * 2.6);

  // Turn: bank turns the nose; a steep bank without pitch loses height.
  plane.heading = wrapAngle(plane.heading + Math.sin(plane.roll) * FLIGHT.turnRate * dt * 1.6);

  // Speed: throttle pushes, drag pulls, climbing costs speed.
  const targetSpeed = knotsToMs(FLIGHT.maxSpeedKts) * (0.25 + 0.75 * plane.throttle);
  const climbCost = Math.max(0, plane.pitch) * 14;
  const flapDrag = plane.flaps ? 6 : 0;
  plane.speedMs += ((targetSpeed - climbCost - flapDrag - plane.speedMs) * dt * 0.45);

  // Vertical speed from pitch and lift; a slow plane sinks.
  const stallSink = plane.speedMs < knotsToMs(FLIGHT.stallSpeedKts) ? 7 : 0;
  plane.verticalSpeed =
    Math.sin(plane.pitch) * FLIGHT.climbFromPitch * (plane.speedMs / knotsToMs(100)) -
    Math.abs(Math.sin(plane.roll)) * 2.2 -
    stallSink;
  plane.alt += plane.verticalSpeed * dt;

  // Wind drifts the plane across the ground.
  const wind = windVector(timeSec, mission);
  const fx = Math.sin(plane.heading);
  const fz = -Math.cos(plane.heading);
  plane.x += (fx * plane.speedMs + wind.x) * dt;
  plane.z += (fz * plane.speedMs + wind.z) * dt;
  plane.groundSpeedKts = msToKnots(
    Math.hypot(fx * plane.speedMs + wind.x, fz * plane.speedMs + wind.z),
  );

  // Fuel: throttle burns it; empty tanks mean a glider, then a crash.
  const burn = FLIGHT.fuelBurnIdle + plane.throttle * FLIGHT.fuelBurnPerSec;
  plane.fuel = Math.max(0, plane.fuel - burn * dt);
  if (plane.fuel <= 0 && plane.throttle > 0.15) plane.throttle = 0.15;

  // Rings: fly through the next one and it counts.
  const ring = plane.rings[plane.nextRing];
  if (ring) {
    const dx = plane.x - ring.x;
    const dz = plane.z - ring.z;
    const dy = plane.alt - ring.alt;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (dist < RING_RADIUS_M) {
      ring.passed = true;
      plane.nextRing += 1;
      plane.score += RING_SCORE;
      events.push("ring");
    }
  }

  // Ground contact: runway landing, water, or terrain.
  const ground = terrainHeight(plane.x, plane.z);
  if (plane.alt <= ground + 1.5) {
    const speedKts = msToKnots(plane.speedMs);
    const overRunway = isOverRunway(plane.x, plane.z);
    const headingErr = Math.abs(wrapAngle(plane.heading - degToRad(0)));
    const gentle = plane.verticalSpeed > -3.5 && speedKts < 105 && speedKts > 45;
    if (overRunway && gentle && (headingErr < 0.5 || headingErr > Math.PI * 2 - 0.5)) {
      plane.alt = ground + 1.5;
      plane.landed = true;
      plane.score += LANDING_SCORE;
      events.push("landed");
    } else {
      plane.crashed = true;
      plane.crashReason =
        ground <= 1
          ? "ditched in the sea"
          : overRunway
            ? "landed too hard on the strip"
            : "flew into the hillside";
      if (plane.verticalSpeed < -6) plane.damage += FLIGHT.damageOnHardLanding;
      events.push("crashed");
    }
  }

  // Out of the world: turn back before the isles run out.
  const distFromHome = Math.hypot(plane.x, plane.z);
  if (distFromHome > 3400) {
    plane.heading = wrapAngle(plane.heading + Math.PI);
    plane.x *= 0.98;
    plane.z *= 0.98;
  }
  return events;
}

export function planeStatus(plane, mission) {
  const totalRings = plane.rings.length;
  const doneRings = plane.rings.filter((r) => r.passed).length;
  const timeLeft = Math.max(0, mission.timeLimitSec - plane.timeSec);
  return {
    totalRings,
    doneRings,
    timeLeft,
    allRingsDone: doneRings === totalRings,
    fuelLow: plane.fuel < 0.22,
    stalling: plane.speedMs < knotsToMs(FLIGHT.stallSpeedKts),
  };
}

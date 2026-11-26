/* Screenshot presets: one clear job. Put the plane in a fixed,
   scenic pose for each shot, so the screenshots are real renders of
   the game's own code — same flight model, same renderer, no staging
   outside the game. */

import { degToRad, knotsToMs } from "./config.js";

function pose(plane, x, z, alt, headingDeg, speedKts, throttle, nextRing) {
  plane.x = x;
  plane.z = z;
  plane.alt = alt;
  plane.heading = degToRad(headingDeg);
  plane.pitch = 0;
  plane.roll = 0;
  plane.speedMs = knotsToMs(speedKts);
  plane.throttle = throttle;
  plane.nextRing = nextRing;
  plane.rings.forEach((r, i) => {
    r.passed = i < nextRing;
  });
}

/* Named shots, in the order they are filed under screenshots/. */
export const SHOTS = {
  start: {
    file: "1-start.jpg",
    title: "On the strip at golden hour",
    apply(plane) {
      // Parked on the runway threshold, strip ahead, isles beyond.
      pose(plane, 0, 330, 12, 0, 0, 0.25, 0);
      plane.speedMs = 0;
    },
  },
  play: {
    file: "2-play.jpg",
    title: "Chasing the amber ring",
    apply(plane) {
      // Mid-flight over the sea south of Home Isle, banked toward the
      // next ring, islands and the strip in the distance.
      pose(plane, -520, 260, 230, 345, 112, 0.68, 1);
      plane.roll = degToRad(-12);
      plane.pitch = degToRad(3);
    },
  },
  approach: {
    file: "3-approach.jpg",
    title: "Final approach, gear down",
    apply(plane) {
      // Low on final, offset so the strip shows clear of the aircraft,
      // runway dead ahead down the valley, flaps out.
      pose(plane, 140, 1150, 72, 0, 78, 0.42, 5);
      plane.flaps = true;
      plane.pitch = degToRad(-3);
      plane.rings.forEach((r) => {
        r.passed = true;
      });
    },
  },
  dusk: {
    file: "4-dusk.jpg",
    title: "Dusk run over Ember Rock",
    apply(plane) {
      // Low over the eastern isle at sunset, ring ahead, sea glitter.
      pose(plane, 760, -120, 150, 285, 118, 0.72, 4);
      plane.roll = degToRad(18);
    },
  },
};

export function applyShot(name, plane) {
  const shot = SHOTS[name];
  if (!shot) return false;
  shot.apply(plane);
  return true;
}

/* The renderer: one clear job. Take a plane state and a world, paint
   one frame — sky, sea, low-poly isles, runway, rings, the aircraft,
   and the lit instruments. Nothing here changes the game state. */

import { PALETTE, WORLD, clamp, degToRad, feetOf, lerp, msToKnots, radToDeg } from "./config.js";
import { ISLANDS, RUNWAY, SEA_LEVEL, isOverRunway, terrainHeight } from "./world.js";

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${Math.round(lerp(ca[0], cb[0], t))},${Math.round(lerp(ca[1], cb[1], t))},${Math.round(
    lerp(ca[2], cb[2], t),
  )})`;
}
function groundColor(h, x, z) {
  if (h <= 0.6) return mix(PALETTE.seaShallow, PALETTE.seaDeep, 0.6);
  if (h <= 5) return PALETTE.sand;
  if (h <= 55) return mix(PALETTE.grass, PALETTE.forest, clamp((h - 5) / 50, 0, 1));
  if (h <= 115) return mix(PALETTE.forest, PALETTE.rock, clamp((h - 55) / 60, 0, 1));
  if (h <= 165) return PALETTE.rock;
  return mix(PALETTE.rock, PALETTE.snow, clamp((h - 165) / 40, 0, 1));
}

export function render(ctx, view) {
  const { width, height, plane, mission, status, clouds, gameState, timeSec } = view;
  const cx = width / 2;
  const cy = height / 2;

  drawSky(ctx, view);
  const cam = makeCamera(plane, width, height);
  drawSeaBase(ctx, view, cam);
  drawTerrain(ctx, view, cam);
  drawRunway(ctx, view, cam);
  drawClouds(ctx, view, cam);
  drawRings(ctx, view, cam);
  drawPlaneShadow(ctx, view, cam);
  drawPlane(ctx, view);
  drawHud(ctx, view);
  drawPanel(ctx, view);
  drawMinimap(ctx, view);
  if (gameState === "title") drawTitle(ctx, view);
  if (gameState === "paused") drawCentreCard(ctx, view, "PAUSED", "P to resume  ·  R to restart");
  if (gameState === "landed") drawEndCard(ctx, view, "DELIVERED — LANDED SOFT", true);
  if (gameState === "crashed")
    drawEndCard(ctx, view, "CRASHED — " + (plane.crashReason || "down in the isles").toUpperCase(), false);
  if (gameState === "complete") drawEndCard(ctx, view, "SORTIE COMPLETE", true);
}

function makeCamera(plane, width, height) {
  const heading = plane.heading;
  const camPitch = clamp(plane.pitch * 0.45, -0.22, 0.22) + 0.06;
  const focal = height * 0.9;
  // Camera sits behind and above the aircraft, looking along its nose.
  const back = 42;
  const up = 10;
  const camX = plane.x - Math.sin(heading) * back;
  const camZ = plane.z + Math.cos(heading) * back;
  const camY = plane.alt + up;
  const fx = Math.sin(heading);
  const fz = -Math.cos(heading);
  // Basis: forward (yaw + camera pitch), right, up.
  const fwd = { x: fx * Math.cos(camPitch), y: Math.sin(camPitch), z: fz * Math.cos(camPitch) };
  const right = { x: -fz, y: 0, z: fx };
  const upv = {
    x: -fx * Math.sin(camPitch),
    y: Math.cos(camPitch),
    z: fz * Math.sin(camPitch),
  };
  return { x: camX, y: camY, z: camZ, fwd, right, up: upv, focal, width, height };
}

function project(cam, px, py, pz) {
  const dx = px - cam.x;
  const dy = py - cam.y;
  const dz = pz - cam.z;
  const depth = dx * cam.fwd.x + dy * cam.fwd.y + dz * cam.fwd.z;
  if (depth < 3) return null;
  const rx = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
  const uy = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;
  const s = cam.focal / depth;
  return { x: cam.width / 2 + rx * s, y: cam.height / 2 - uy * s, depth, scale: s };
}

function drawSky(ctx, view) {
  const { width, height, plane, timeSec } = view;
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.45, PALETTE.skyMid);
  g.addColorStop(0.72, PALETTE.skyHorizon);
  g.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  // Low sun, west: its screen spot drifts with the heading.
  const rel = ((radToDeg(plane.heading) - 262 + 540) % 360) - 180;
  const sunX = width / 2 + (rel / 90) * width * 0.62;
  const sunY = height * 0.3 + Math.sin(timeSec * 0.05) * 4;
  if (Math.abs(rel) < 120) {
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSeaBase(ctx, view, cam) {
  const { width, height } = view;
  const g = ctx.createLinearGradient(0, height * 0.45, 0, height);
  g.addColorStop(0, PALETTE.seaShallow);
  g.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, height * 0.48, width, height * 0.52);
  // Sun glitter on the water, left of the nose.
  ctx.fillStyle = PALETTE.seaGlitter;
  for (let i = 0; i < 14; i++) {
    const x = width * 0.08 + i * 34 + ((i * 37) % 23);
    const y = height * (0.55 + ((i * 13) % 30) / 100);
    ctx.fillRect(x, y, 26 - (i % 3) * 6, 2);
  }
}

function drawTerrain(ctx, view, cam) {
  const { plane } = view;
  const step = 95;
  const range = 1300;
  const cells = [];
  const startX = Math.floor((plane.x - range) / step) * step;
  const startZ = Math.floor((plane.z - range) / step) * step;
  for (let gx = startX; gx < plane.x + range; gx += step) {
    for (let gz = startZ; gz < plane.z + range; gz += step) {
      const cxm = gx + step / 2;
      const czm = gz + step / 2;
      const dist = Math.hypot(cxm - plane.x, czm - plane.z);
      if (dist > WORLD.viewDistance) continue;
      cells.push({ gx, gz, dist });
    }
  }
  cells.sort((a, b) => b.dist - a.dist);
  for (const cell of cells) {
    const { gx, gz } = cell;
    const corners = [
      [gx, gz],
      [gx + step, gz],
      [gx + step, gz + step],
      [gx, gz + step],
    ];
    const pts = [];
    let hAvg = 0;
    for (const [x, z] of corners) {
      const h = terrainHeight(x, z);
      hAvg += h;
      pts.push(project(cam, x, h, z));
    }
    if (pts.some((p) => p === null)) continue;
    hAvg /= 4;
    const fade = clamp(1 - (cell.dist - 1500) / 900, 0.25, 1);
    ctx.globalAlpha = fade;
    ctx.fillStyle = groundColor(hAvg, gx, gz);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    // A faint ridge line on high ground reads as mountains at a glance.
    if (hAvg > 110) {
      ctx.globalAlpha = fade * 0.5;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function runwayCorners() {
  const halfL = RUNWAY.length / 2;
  const halfW = RUNWAY.width / 2;
  return [
    [RUNWAY.x - halfW, RUNWAY.z - halfL],
    [RUNWAY.x + halfW, RUNWAY.z - halfL],
    [RUNWAY.x + halfW, RUNWAY.z + halfL],
    [RUNWAY.x - halfW, RUNWAY.z + halfL],
  ];
}

function drawRunway(ctx, view, cam) {
  const pts = runwayCorners().map(([x, z]) => project(cam, x, RUNWAY.altitude + 0.4, z));
  if (pts.some((p) => p === null)) return;
  ctx.fillStyle = PALETTE.runway;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes and threshold bars.
  ctx.fillStyle = PALETTE.runwayLine;
  for (let d = -300; d <= 300; d += 60) {
    const a = project(cam, -2.5, RUNWAY.altitude + 0.6, d);
    const b = project(cam, 2.5, RUNWAY.altitude + 0.6, d);
    const c = project(cam, 2.5, RUNWAY.altitude + 0.6, d + 26);
    const e = project(cam, -2.5, RUNWAY.altitude + 0.6, d + 26);
    if ([a, b, c, e].some((p) => p === null)) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(e.x, e.y);
    ctx.closePath();
    ctx.fill();
  }
  // Windsock on the strip's edge, so the wind reads in the picture.
  const sock = project(cam, RUNWAY.width / 2 + 26, RUNWAY.altitude + 12, 120);
  const sockBase = project(cam, RUNWAY.width / 2 + 26, RUNWAY.altitude, 120);
  if (sock && sockBase) {
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sockBase.x, sockBase.y);
    ctx.lineTo(sock.x, sock.y);
    ctx.stroke();
    ctx.fillStyle = "#ff7a3d";
    ctx.beginPath();
    ctx.moveTo(sock.x, sock.y);
    ctx.lineTo(sock.x + 16, sock.y + 4);
    ctx.lineTo(sock.x, sock.y + 8);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClouds(ctx, view, cam) {
  const items = view.clouds
    .map((c) => ({ c, p: project(cam, c.x, c.alt, c.z) }))
    .filter((o) => o.p !== null)
    .sort((a, b) => b.p.depth - a.p.depth);
  for (const { c, p } of items) {
    const s = p.scale * c.scale * 0.014;
    if (s < 4) continue;
    ctx.fillStyle = "rgba(255, 244, 230, 0.8)";
    for (let i = 0; i < c.puffs; i++) {
      const ox = Math.sin(c.seed + i * 2.1) * s * 0.9;
      const oy = Math.cos(c.seed + i * 1.3) * s * 0.22;
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + oy, s * (0.55 + (i % 3) * 0.14), s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRings(ctx, view, cam) {
  const { plane, timeSec } = view;
  plane.rings.forEach((ring, i) => {
    const p = project(cam, ring.x, ring.alt, ring.z);
    if (!p) return;
    const r = Math.max(6, p.scale * 34);
    const isNext = i === plane.nextRing;
    const isDone = ring.passed;
    ctx.save();
    ctx.lineWidth = isNext ? 7 : 4;
    ctx.strokeStyle = isDone ? PALETTE.ringDone : isNext ? PALETTE.ringNext : PALETTE.ringFuture;
    if (isNext) {
      ctx.shadowColor = PALETTE.ringNext;
      ctx.shadowBlur = 18 + Math.sin(timeSec * 5) * 6;
    }
    ctx.globalAlpha = isDone ? 0.55 : 0.95;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 0.72, r * 0.66, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // A guide line down to the ground, so the ring's height reads.
    const gp = project(cam, ring.x, terrainHeight(ring.x, ring.z), ring.z);
    if (gp && isNext) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,182,61,0.45)";
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(gp.x, gp.y);
      ctx.stroke();
      ctx.restore();
    }
    if (isNext) {
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(13, Math.min(20, r * 0.22))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`RING ${i + 1}`, p.x, p.y - r - 10);
    }
  });
}

function drawPlaneShadow(ctx, view, cam) {
  const { plane } = view;
  const ground = terrainHeight(plane.x, plane.z);
  const p = project(cam, plane.x, ground + 1, plane.z);
  if (!p) return;
  const r = clamp(p.scale * 14, 4, 90);
  ctx.fillStyle = "rgba(10, 16, 24, 0.35)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlane(ctx, view) {
  const { width, height, plane, timeSec } = view;
  const px = width / 2;
  const py = height * 0.6;
  const size = Math.max(90, width * 0.13);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-plane.roll * 0.85);
  // Propeller blur, spinning — a faint disc at the nose.
  const propA = 0.12 + 0.08 * Math.sin(timeSec * 40);
  ctx.fillStyle = `rgba(230, 230, 220, ${propA})`;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.4, size * 0.06, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wings: cream with red tips, a shadow line underneath.
  ctx.fillStyle = PALETTE.planeCream;
  ctx.beginPath();
  ctx.moveTo(-size, size * 0.08);
  ctx.lineTo(-size * 0.12, -size * 0.1);
  ctx.lineTo(size * 0.12, -size * 0.1);
  ctx.lineTo(size, size * 0.08);
  ctx.lineTo(size * 0.12, size * 0.16);
  ctx.lineTo(-size * 0.12, size * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeRed;
  ctx.fillRect(-size, size * 0.02, size * 0.16, size * 0.1);
  ctx.fillRect(size - size * 0.16, size * 0.02, size * 0.16, size * 0.1);
  // Fuselage, nose to tail, with a lit cockpit.
  ctx.fillStyle = PALETTE.planeCream;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.05, size * 0.16, size * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7ec8e8";
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.28, size * 0.09, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.planeRed;
  ctx.fillRect(-size * 0.16, -size * 0.12, size * 0.32, size * 0.07);
  // Tail fin and tailplane.
  ctx.fillStyle = PALETTE.planeRed;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.32);
  ctx.lineTo(-size * 0.1, size * 0.52);
  ctx.lineTo(size * 0.1, size * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeCream;
  ctx.fillRect(-size * 0.42, size * 0.36, size * 0.84, size * 0.07);
  // Navigation lights, lit.
  ctx.fillStyle = PALETTE.hudGreen;
  ctx.beginPath();
  ctx.arc(size, size * 0.08, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudRed;
  ctx.beginPath();
  ctx.arc(-size, size * 0.08, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function text(ctx, str, x, y, size, color, align = "left", bold = true) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold" : "normal"} ${size}px sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}

function drawHud(ctx, view) {
  const { width, height, plane, mission, status, gameState } = view;
  if (gameState === "title") return;
  const altFt = feetOf(plane.alt);
  const spd = Math.round(msToKnots(plane.speedMs));
  const hdg = Math.round(((radToDeg(plane.heading) % 360) + 360) % 360);
  // Top bar.
  ctx.fillStyle = "rgba(10, 16, 26, 0.55)";
  ctx.fillRect(0, 0, width, 64);
  text(ctx, "ALT", 18, 22, 12, PALETTE.hudAmber, "left", true);
  text(ctx, `${altFt} FT`, 18, 50, 24, "#fff");
  text(ctx, "SPD", 150, 22, 12, PALETTE.hudAmber);
  text(ctx, `${spd} KT`, 150, 50, 24, "#fff");
  text(ctx, "HDG", 282, 22, 12, PALETTE.hudAmber);
  text(ctx, `${String(hdg).padStart(3, "0")}°`, 282, 50, 24, "#fff");
  text(ctx, "V/S", 400, 22, 12, PALETTE.hudAmber);
  const vs = Math.round(plane.verticalSpeed * 196.85);
  text(ctx, `${vs >= 0 ? "+" : ""}${vs} FPM`, 400, 50, 24, vs < -600 ? PALETTE.hudRed : "#fff");
  // Compass strip.
  const compassY = 78;
  ctx.fillStyle = "rgba(10, 16, 26, 0.45)";
  ctx.fillRect(width / 2 - 190, compassY - 14, 380, 26);
  for (let d = -60; d <= 60; d += 15) {
    const deg = ((hdg + d) % 360 + 360) % 360;
    const x = width / 2 + d * 3;
    text(ctx, String(deg).padStart(3, "0"), x, compassY + 4, 11, d === 0 ? PALETTE.hudAmber : "#cfe0ea", "center");
  }
  // Mission + objective, top centre.
  text(ctx, mission.name.toUpperCase(), width / 2, 118, 15, PALETTE.hudAmber, "center");
  const objective = status.allRingsDone
    ? "All rings done — land on the strip"
    : `Ring ${status.doneRings + 1} of ${status.totalRings} — fly the amber ring`;
  text(ctx, objective, width / 2, 140, 14, "#fff", "center", false);
  // Score, time, fuel, damage — top right.
  const rightX = width - 18;
  text(ctx, "SCORE", rightX, 22, 12, PALETTE.hudAmber, "right");
  text(ctx, String(plane.score), rightX, 50, 24, "#fff", "right");
  const mins = Math.floor(status.timeLeft / 60);
  const secs = Math.floor(status.timeLeft % 60);
  text(ctx, `TIME ${mins}:${String(secs).padStart(2, "0")}`, rightX, 118, 13, status.timeLeft < 45 ? PALETTE.hudRed : "#cfe0ea", "right");
  text(ctx, `FUEL ${Math.round(plane.fuel * 100)}%`, rightX, 140, 13, status.fuelLow ? PALETTE.hudRed : PALETTE.hudGreen, "right");
  if (status.stalling) {
    text(ctx, "STALL — NOSE DOWN, THROTTLE UP", width / 2, height * 0.42, 18, PALETTE.hudRed, "center");
  }
  if (status.fuelLow) {
    text(ctx, "LOW FUEL", width / 2, height * 0.46, 16, PALETTE.hudRed, "center");
  }
}

function drawPanel(ctx, view) {
  const { width, height, plane, mission, status, gameState } = view;
  if (gameState === "title") return;
  const panelH = 108;
  const y0 = height - panelH;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, y0, width, panelH);
  ctx.fillStyle = "rgba(255,182,61,0.25)";
  ctx.fillRect(0, y0, width, 2);
  // Attitude indicator.
  const ax = 78;
  const ay = y0 + panelH / 2;
  const ar = 38;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(ax, ay);
  ctx.rotate(-plane.roll);
  ctx.translate(0, clamp(plane.pitch * 90, -ar, ar));
  ctx.fillStyle = "#3d7ab8";
  ctx.fillRect(-ar, -ar * 2, ar * 2, ar * 2);
  ctx.fillStyle = "#8a6a44";
  ctx.fillRect(-ar, 0, ar * 2, ar * 2);
  ctx.fillStyle = "#fff";
  ctx.fillRect(-ar, -1, ar * 2, 2);
  ctx.restore();
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(ax, ay - 6);
  ctx.lineTo(ax - 14, ay + 4);
  ctx.lineTo(ax + 14, ay + 4);
  ctx.closePath();
  ctx.fill();
  text(ctx, "ATTITUDE", ax, y0 + panelH - 8, 10, "#9fb6c9", "center", false);
  // Throttle gauge.
  const gx = 170;
  ctx.fillStyle = "#22303f";
  ctx.fillRect(gx, y0 + 22, 170, 12);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.fillRect(gx, y0 + 22, 170 * plane.throttle, 12);
  text(ctx, `THROTTLE ${Math.round(plane.throttle * 100)}%`, gx, y0 + 52, 12, "#fff");
  text(ctx, "SHIFT up · CTRL down", gx, y0 + 72, 11, "#9fb6c9", "left", false);
  // Fuel gauge.
  const fx = 380;
  ctx.fillStyle = "#22303f";
  ctx.fillRect(fx, y0 + 22, 170, 12);
  ctx.fillStyle = status.fuelLow ? PALETTE.hudRed : PALETTE.hudGreen;
  ctx.fillRect(fx, y0 + 22, 170 * plane.fuel, 12);
  text(ctx, `FUEL ${Math.round(plane.fuel * 100)}%`, fx, y0 + 52, 12, "#fff");
  text(ctx, `WIND ${Math.round(mission.wind.speed)} KT FROM ${mission.wind.fromDeg}°`, fx, y0 + 72, 11, "#9fb6c9", "left", false);
  // Lights: flaps, gear, rings.
  const lx = 590;
  const lights = [
    ["FLAPS", plane.flaps, PALETTE.hudGreen],
    ["RINGS", status.allRingsDone, PALETTE.hudGreen],
    ["FUEL", !status.fuelLow, status.fuelLow ? PALETTE.hudRed : PALETTE.hudGreen],
  ];
  lights.forEach(([label, on, color], i) => {
    const x = lx + i * 78;
    ctx.fillStyle = on ? color : "#33424f";
    ctx.beginPath();
    ctx.arc(x + 8, y0 + 28, 7, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, label, x, y0 + 52, 11, "#cfe0ea", "left", false);
  });
  text(ctx, "W/S pitch · A/D bank · F flaps · P pause · R restart", lx, y0 + 72, 11, "#9fb6c9", "left", false);
}

function drawMinimap(ctx, view) {
  const { width, height, plane, gameState } = view;
  if (gameState === "title") return;
  const size = 132;
  const x0 = width - size - 16;
  const y0 = height - 108 - size - 14;
  ctx.fillStyle = "rgba(10, 16, 26, 0.6)";
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = "rgba(255,182,61,0.6)";
  ctx.strokeRect(x0, y0, size, size);
  const toMap = (x, z) => [x0 + size / 2 + (x / 3600) * size, y0 + size / 2 + (z / 3600) * size];
  for (const isle of ISLANDS) {
    const [mx, my] = toMap(isle.x, isle.z);
    ctx.fillStyle = "#5da05e";
    ctx.beginPath();
    ctx.arc(mx, my, Math.max(2, (isle.r / 3600) * size), 0, Math.PI * 2);
    ctx.fill();
  }
  const [rx, ry] = toMap(RUNWAY.x, RUNWAY.z);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(rx, ry - 12);
  ctx.lineTo(rx, ry + 12);
  ctx.stroke();
  plane.rings.forEach((ring, i) => {
    const [mx, my] = toMap(ring.x, ring.z);
    ctx.fillStyle = i === plane.nextRing ? PALETTE.ringNext : ring.passed ? PALETTE.ringDone : "#9fb6c9";
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  const [px, py] = toMap(plane.x, plane.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(plane.heading);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, "MAP", x0 + 6, y0 + 12, 10, "#9fb6c9");
}

function drawCentreCard(ctx, view, title, sub) {
  const { width, height } = view;
  ctx.fillStyle = "rgba(8, 12, 20, 0.55)";
  ctx.fillRect(0, 0, width, height);
  text(ctx, title, width / 2, height / 2 - 10, 34, "#fff", "center");
  text(ctx, sub, width / 2, height / 2 + 26, 15, "#cfe0ea", "center", false);
}

function drawTitle(ctx, view) {
  const { width, height, selectedMission, timeSec } = view;
  ctx.fillStyle = "rgba(8, 12, 20, 0.45)";
  ctx.fillRect(0, 0, width, height);
  const bob = Math.sin(timeSec * 1.2) * 3;
  text(ctx, "AMBER ISLES COURIER", width / 2, height * 0.24 + bob, 44, "#fff", "center");
  text(ctx, "a bush-plane courier over the golden-hour isles", width / 2, height * 0.24 + 34 + bob, 16, PALETTE.hudAmber, "center", false);
  text(ctx, "Fly the amber rings, mind your fuel, land it on the strip.", width / 2, height * 0.24 + 62 + bob, 14, "#cfe0ea", "center", false);
  // Mission cards.
  const cardW = 250;
  const cardH = 118;
  const gap = 22;
  const totalW = cardW * 3 + gap * 2;
  const x0 = width / 2 - totalW / 2;
  const y0 = height * 0.36;
  view.missions.forEach((m, i) => {
    const x = x0 + i * (cardW + gap);
    const selected = i === selectedMission;
    ctx.fillStyle = selected ? "rgba(255,182,61,0.22)" : "rgba(16,22,32,0.8)";
    ctx.fillRect(x, y0, cardW, cardH);
    ctx.strokeStyle = selected ? PALETTE.hudAmber : "rgba(160,180,200,0.4)";
    ctx.lineWidth = selected ? 3 : 1;
    ctx.strokeRect(x, y0, cardW, cardH);
    text(ctx, `${i + 1} · ${m.name.toUpperCase()}`, x + 14, y0 + 28, 15, selected ? PALETTE.hudAmber : "#fff");
    const words = wrapText(m.blurb, cardW - 28);
    words.forEach((line, li) => text(ctx, line, x + 14, y0 + 54 + li * 18, 12, "#cfe0ea", "left", false));
    text(ctx, `${m.rings} rings · fuel ${Math.round(m.fuel * 100)}% · wind ${m.wind.speed} kt`, x + 14, y0 + cardH - 14, 11, "#9fb6c9", "left", false);
  });
  text(ctx, "Click a mission, or press 1 / 2 / 3 — then fly with W/S, A/D and Shift / Ctrl.", width / 2, y0 + cardH + 34, 14, "#fff", "center", false);
  text(ctx, "Mouse: hold and drag to steer.  F flaps · P pause · R restart · M sound", width / 2, y0 + cardH + 58, 13, "#9fb6c9", "center", false);
}

function wrapText(str, maxWidth) {
  // Cards are drawn on canvas; keep the wrap rough and short.
  const words = str.split(" ");
  const lines = [""];
  for (const w of words) {
    if ((lines[lines.length - 1] + " " + w).length > 34) lines.push(w);
    else lines[lines.length - 1] = (lines[lines.length - 1] + " " + w).trim();
  }
  return lines.slice(0, 2);
}

function drawEndCard(ctx, view, title, good) {
  const { width, height, plane, status } = view;
  ctx.fillStyle = "rgba(8, 12, 20, 0.55)";
  ctx.fillRect(0, 0, width, height);
  text(ctx, title, width / 2, height / 2 - 64, 30, good ? PALETTE.hudGreen : PALETTE.hudRed, "center");
  text(ctx, `Score ${plane.score}  ·  Rings ${status.doneRings}/${status.totalRings}`, width / 2, height / 2 - 22, 18, "#fff", "center");
  text(ctx, `Altitude ${feetOf(plane.alt)} ft  ·  Speed ${Math.round(msToKnots(plane.speedMs))} kt  ·  Fuel ${Math.round(plane.fuel * 100)}%`, width / 2, height / 2 + 8, 14, "#cfe0ea", "center", false);
  text(ctx, "R to fly again  ·  1 / 2 / 3 to change sortie", width / 2, height / 2 + 44, 14, "#9fb6c9", "center", false);
}

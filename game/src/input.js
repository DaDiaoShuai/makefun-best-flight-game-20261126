/* Input: keyboard and mouse, one clear job.
   The game reads this and never touches DOM events itself. */

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    /* A queue of one-shot actions the main loop drains each frame. */
    actions: [],
  };

  function keyName(e) {
    return e.code;
  }

  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) {
      keys.add(keyName(e));
      if (e.code === "KeyR") input.actions.push("restart");
      if (e.code === "KeyP" || e.code === "Escape") input.actions.push("pause");
      if (e.code === "Enter" || e.code === "Space") input.actions.push("confirm");
      if (e.code === "KeyM") input.actions.push("mute");
      if (e.code === "KeyF") input.actions.push("flaps");
      if (e.code === "Digit1") input.actions.push("mission-0");
      if (e.code === "Digit2") input.actions.push("mission-1");
      if (e.code === "Digit3") input.actions.push("mission-2");
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(keyName(e)));
  window.addEventListener("blur", () => keys.clear());

  canvas.addEventListener("pointerdown", (e) => {
    input.mouseDown = true;
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
    input.actions.push({ type: "click", x: e.clientX, y: e.clientY });
  });
  window.addEventListener("pointerup", () => {
    input.mouseDown = false;
  });
  window.addEventListener("pointermove", (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });

  return input;
}

/* Read the continuous controls out of the input state, -1..1 each. */
export function readStick(input, width, height) {
  let pitch = 0; // +1 = pull up
  let roll = 0; // +1 = bank right
  let throttle = 0; // +1 = more throttle

  if (input.keys.has("ArrowUp") || input.keys.has("KeyW")) pitch += 1;
  if (input.keys.has("ArrowDown") || input.keys.has("KeyS")) pitch -= 1;
  if (input.keys.has("ArrowLeft") || input.keys.has("KeyA")) roll -= 1;
  if (input.keys.has("ArrowRight") || input.keys.has("KeyD")) roll += 1;
  if (input.keys.has("ShiftLeft") || input.keys.has("ShiftRight") || input.keys.has("Equal"))
    throttle += 1;
  if (input.keys.has("ControlLeft") || input.keys.has("ControlRight") || input.keys.has("Minus"))
    throttle -= 1;

  // Mouse steering: hold the pointer down and the plane follows it.
  if (input.mouseDown && width > 0 && height > 0) {
    const nx = (input.mouseX / width) * 2 - 1;
    const ny = (input.mouseY / height) * 2 - 1;
    roll += Math.max(-1, Math.min(1, nx * 1.4));
    pitch += Math.max(-1, Math.min(1, -ny * 1.2));
  }

  return {
    pitch: Math.max(-1, Math.min(1, pitch)),
    roll: Math.max(-1, Math.min(1, roll)),
    throttle: Math.max(-1, Math.min(1, throttle)),
  };
}

export function drainActions(input) {
  const out = input.actions;
  input.actions = [];
  return out;
}

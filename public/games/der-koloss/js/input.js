// Input: pointer lock, keyboard, mouse deltas
export const input = {
  keys: Object.create(null),
  pressed: Object.create(null),   // cleared each frame — edge triggers
  mouseDX: 0, mouseDY: 0,
  mouseDown: false,
  rmbDown: false,
  locked: false,
  enabled: false,
  onKey: null, // callback(code) for UI keys
};

export function initInput(canvas) {
  // Tab is scoreboard-only. Never let it traverse focus, exit lock, or reach the
  // browser chrome — but DO feed it to the game ourselves before killing it.
  const killTab = (e) => {
    if (e.code !== 'Tab') return;
    if (e.type === 'keydown' && !e.repeat) { input.keys['Tab'] = true; input.pressed['Tab'] = true; }
    if (e.type === 'keyup') input.keys['Tab'] = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', killTab, { capture: true });
  window.addEventListener('keyup', killTab, { capture: true });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys[e.code] = true;
    input.pressed[e.code] = true;
    if (input.onKey) input.onKey(e.code, e);
    if (input.enabled && ['Space', 'KeyF'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
  window.addEventListener('blur', () => { input.keys = Object.create(null); input.mouseDown = false; input.rmbDown = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (!input.locked) return;
    if (e.button === 0) input.mouseDown = true;
    if (e.button === 2) input.rmbDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
    if (e.button === 2) input.rmbDown = false;
  });
  window.addEventListener('contextmenu', (e) => { if (input.enabled) e.preventDefault(); });

  document.addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.mouseDX += e.movementX;
    input.mouseDY += e.movementY;
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    if (!input.locked && input.onPointerUnlock) input.onPointerUnlock();
  });
}

export function lockPointer(canvas) {
  if (document.pointerLockElement !== canvas) {
    try {
      const r = canvas.requestPointerLock?.();
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* headless or unsupported */ }
  }
}
export function unlockPointer() {
  if (document.pointerLockElement) document.exitPointerLock?.();
}

export function consumeMouse() {
  const dx = input.mouseDX, dy = input.mouseDY;
  input.mouseDX = 0; input.mouseDY = 0;
  return [dx, dy];
}
export function isAimDown() {
  return input.rmbDown || !!input.keys['KeyE'];
}
export function endFrame() {
  input.pressed = Object.create(null);
}
export function clearPressed() {
  input.pressed = Object.create(null);
  input.mouseDX = 0; input.mouseDY = 0;
}

// Screen transitions must not carry held ADS/fire/movement state into a new
// renderer. Browsers do not reliably emit keyup/mouseup while pointer lock and
// fullscreen are changing, which previously produced transient zoom/pan starts.
export function resetInputState() {
  clearPressed();
  input.keys = Object.create(null);
  input.mouseDown = false;
  input.rmbDown = false;
}

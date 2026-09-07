import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));

export function dist2D(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); }

// ---------- AABB (2D, x/z) collision helpers ----------
// The resolver itself lives in js/collision.js, which is deliberately free of
// Three.js so CI can import it and test real movement behaviour. Re-exported
// here because everything in the game already reaches for it through utils.
export {
  makeBox, pointInBox, resolveCircleBox, moveCircleWithColliders, segmentHitsBox,
} from './collision.js';

// ---------- Procedural canvas textures (all original, generated) ----------
export function canvasTexture(size, fn, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  fn(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  // These land on floors, walls and ceilings, which are read at glancing
  // angles far more often than face-on. 4x was not enough to stop the tiling
  // from beating into a moire ladder along a corridor.
  tex.anisotropy = 8;
  return tex;
}

function noiseFill(g, s, base, vary, grime = 0.25) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  const img = g.getImageData(0, 0, s, s);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * vary;
    d[i] = clamp(d[i] + n, 0, 255);
    d[i + 1] = clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  g.putImageData(img, 0, 0);
  // grime streaks
  g.globalAlpha = grime * 0.35;
  for (let i = 0; i < 14; i++) {
    const x = rand(s), w = rand(8, 42);
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(10,8,6,0.8)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x, rand(-s * 0.2, s * 0.4), w, s * 1.4);
  }
  g.globalAlpha = 1;
}

export function concreteTexture(base = '#5a5d60', vary = 34, repeat = 1) {
  return canvasTexture(256, (g, s) => {
    noiseFill(g, s, base, vary);
    g.globalAlpha = 0.16; g.strokeStyle = '#1c1d1f';
    for (let i = 0; i < 7; i++) { // cracks
      g.beginPath();
      let x = rand(s), y = rand(s);
      g.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += rand(-30, 30); y += rand(-30, 30); g.lineTo(x, y); }
      g.lineWidth = rand(0.5, 1.6); g.stroke();
    }
    g.globalAlpha = 1;
  }, repeat);
}

export function brickTexture(repeat = 1) {
  return canvasTexture(256, (g, s) => {
    noiseFill(g, s, '#4a3a32', 26, 0.15);
    const bh = 32, bw = 64;
    g.strokeStyle = 'rgba(20,16,14,0.85)'; g.lineWidth = 3;
    for (let y = 0; y < s; y += bh) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let x = off; x < s; x += bw) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bh); g.stroke(); }
    }
  }, repeat);
}

export function metalTexture(base = '#3d4148', repeat = 1) {
  return canvasTexture(256, (g, s) => {
    noiseFill(g, s, base, 22, 0.12);
    g.globalAlpha = 0.2; g.strokeStyle = '#14161a';
    for (let i = 0; i < 24; i++) { // scratches
      const x = rand(s), y = rand(s);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-60, 60), y + rand(-8, 8));
      g.lineWidth = rand(0.4, 1); g.stroke();
    }
    g.globalAlpha = 1;
    // rivets
    g.fillStyle = 'rgba(12,13,16,0.7)';
    for (let x = 16; x < s; x += 56) for (let y = 16; y < s; y += 56) {
      g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
    }
  }, repeat);
}

export function woodTexture(repeat = 1) {
  return canvasTexture(256, (g, s) => {
    noiseFill(g, s, '#5d4426', 30, 0.1);
    g.globalAlpha = 0.35;
    for (let y = 0; y < s; y += 6) {
      g.strokeStyle = `rgba(30,20,10,${rand(0.2, 0.6)})`;
      g.beginPath(); g.moveTo(0, y + rand(-2, 2));
      g.bezierCurveTo(s * 0.3, y + rand(-4, 4), s * 0.7, y + rand(-4, 4), s, y + rand(-2, 2));
      g.lineWidth = rand(0.6, 2); g.stroke();
    }
    g.globalAlpha = 1;
  }, repeat);
}

export function textTexture(text, { w = 512, h = 128, bg = '#101114', fg = '#e8e4d8', font = 'bold 72px Impact, sans-serif', glow = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (glow) { g.shadowColor = glow; g.shadowBlur = 26; }
  g.fillStyle = fg;
  g.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Simple seeded event bus
export class Bus {
  constructor() { this.m = new Map(); }
  on(ev, fn) { (this.m.get(ev) || this.m.set(ev, []).get(ev)).push(fn); return fn; }
  emit(ev, ...args) { const l = this.m.get(ev); if (l) for (const fn of l) fn(...args); }
}

export function formatCode(code) { return code.toUpperCase(); }
export function genCode(len = 5) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

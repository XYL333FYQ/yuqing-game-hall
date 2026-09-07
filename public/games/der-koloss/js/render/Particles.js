// GPU particle pool.
//
// The old system was a single THREE.Points with PointsMaterial, which cannot
// read a per-particle size attribute — every spark, every smoke puff and every
// blood droplet in the game rendered at exactly 0.09 units. This replaces it
// with a small shader that supports per-particle size, rotation, colour ramps
// and alpha ramps, split across an additive emitter (sparks, fire, energy) and
// an alpha-blended one (smoke, dust, blood mist).
//
// Fixed pool, ring allocation, zero per-frame garbage.
import * as THREE from 'three';

const VERT = /* glsl */`
attribute float aSize;
attribute float aRot;
attribute float aAlpha;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
varying float vRot;
uniform float uScale;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vRot = aRot;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // Perspective size, clamped so a particle passing through the near plane
  // cannot balloon to fill the screen.
  gl_PointSize = clamp(aSize * uScale / max(0.15, -mv.z), 0.0, 220.0);
}
`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uTex;
varying vec3 vColor;
varying float vAlpha;
varying float vRot;
void main() {
  if (vAlpha <= 0.002) discard;
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c) + 0.5;
  vec4 t = texture2D(uTex, uv);
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
  if (gl_FragColor.a < 0.004) discard;
}
`;

// ---------------------------------------------------------------------------
// procedural sprite textures
// ---------------------------------------------------------------------------
const _texCache = {};

function makeTex(key, draw, size = 64) {
  if (_texCache[key]) return _texCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  _texCache[key] = t;
  return t;
}

/** Soft round puff — smoke, dust, blood mist. */
export function puffTexture() {
  return makeTex('puff', (g, s) => {
    const r = s / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    // Break the perfect circle so a cloud of them does not read as bubbles.
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, d = (0.25 + Math.random() * 0.32) * r;
      g.beginPath();
      g.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, r * (0.07 + Math.random() * 0.19), 0, 7);
      g.fill();
    }
  }, 64);
}

/** Hot elongated streak — sparks and embers. */
export function sparkTexture() {
  return makeTex('spark', (g, s) => {
    const grad = g.createLinearGradient(0, s / 2, s, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.42, 'rgba(255,250,235,0.85)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(0.58, 'rgba(255,240,210,0.8)');
    grad.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = grad;
    g.fillRect(0, s * 0.42, s, s * 0.16);
    const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.16);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, s, s);
  }, 64);
}

/**
 * Irregular blood/liquid splat. Each `variant` is a separately cached shape —
 * one blot repeated across a room reads as wallpaper, so callers that stamp
 * several at once should ask for different variants.
 */
export function splatTexture(variant = 0) {
  return makeTex(`splat${variant || ''}`, (g, s) => {
    g.fillStyle = 'rgba(255,255,255,1)';
    const r = s / 2;
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = r * (0.42 + Math.random() * 0.5);
      const x = r + Math.cos(a) * rr, y = r + Math.sin(a) * rr;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, d = r * (0.5 + Math.random() * 0.45);
      g.beginPath();
      g.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, r * (0.04 + Math.random() * 0.1), 0, 7);
      g.fill();
    }
  }, 64);
}

// ---------------------------------------------------------------------------
export class ParticlePool {
  constructor(scene, { max = 1200, texture, blending = THREE.NormalBlending, depthWrite = false, renderOrder = 0 } = {}) {
    this.max = max;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));

    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTex: { value: texture }, uScale: { value: 300 } },
      transparent: true,
      depthWrite,
      depthTest: true,
      blending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
    scene.add(this.points);

    // Per-particle simulation state, parallel to the attribute arrays.
    this.p = new Array(max).fill(null).map(() => ({
      life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0,
      grav: 0, drag: 0, rotV: 0,
      s0: 1, s1: 1, a0: 1, a1: 0,
      r0: 1, g0: 1, b0: 1, r1: 1, g1: 1, b1: 1,
      floorY: -1e9, bounce: 0,
    }));
    this.head = 0;
    this.active = new Set();
    this._dirty = false;
  }

  /**
   * @param {object} o emitter description. Colour and size interpolate from
   *   the `0` values at birth to the `1` values at death.
   */
  emit(o) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    const p = this.p[i];
    p.maxLife = p.life = Math.max(0.02, o.life ?? 0.6);
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.grav = o.grav ?? 0;
    p.drag = o.drag ?? 0;
    p.rotV = o.rotV || 0;
    p.s0 = o.size0 ?? 1; p.s1 = o.size1 ?? p.s0;
    p.a0 = o.alpha0 ?? 1; p.a1 = o.alpha1 ?? 0;
    const c0 = o.color0 || [1, 1, 1];
    const c1 = o.color1 || c0;
    p.r0 = c0[0]; p.g0 = c0[1]; p.b0 = c0[2];
    p.r1 = c1[0]; p.g1 = c1[1]; p.b1 = c1[2];
    p.floorY = o.floorY ?? -1e9;
    p.bounce = o.bounce ?? 0;
    this.pos[i * 3] = o.x; this.pos[i * 3 + 1] = o.y; this.pos[i * 3 + 2] = o.z;
    this.col[i * 3] = p.r0; this.col[i * 3 + 1] = p.g0; this.col[i * 3 + 2] = p.b0;
    this.size[i] = p.s0;
    this.rot[i] = o.rot ?? Math.random() * Math.PI * 2;
    this.alpha[i] = p.a0;
    this.active.add(i);
    this._dirty = true;
    return i;
  }

  _retire(i) {
    this.p[i].life = 0;
    this.alpha[i] = 0;
    this.size[i] = 0;
    this.pos[i * 3 + 1] = -10000;
    this.active.delete(i);
  }

  clear() {
    for (const i of [...this.active]) this._retire(i);
    this._dirty = true;
    this.flush();
  }

  update(dt) {
    if (!this.active.size) return;
    for (const i of this.active) {
      const p = this.p[i];
      p.life -= dt;
      if (!(p.life > 0)) { this._retire(i); continue; }
      const t = 1 - p.life / p.maxLife;      // 0 at birth, 1 at death
      if (p.drag > 0) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d; p.vy *= d; p.vz *= d;
      }
      p.vy -= p.grav * dt;
      const b = i * 3;
      this.pos[b] += p.vx * dt;
      this.pos[b + 1] += p.vy * dt;
      this.pos[b + 2] += p.vz * dt;
      if (this.pos[b + 1] < p.floorY) {
        this.pos[b + 1] = p.floorY;
        if (p.bounce > 0) { p.vy = -p.vy * p.bounce; p.vx *= 0.6; p.vz *= 0.6; }
        else { p.vx *= 0.85; p.vz *= 0.85; p.vy = 0; }
      }
      this.col[b] = p.r0 + (p.r1 - p.r0) * t;
      this.col[b + 1] = p.g0 + (p.g1 - p.g0) * t;
      this.col[b + 2] = p.b0 + (p.b1 - p.b0) * t;
      this.size[i] = p.s0 + (p.s1 - p.s0) * t;
      this.alpha[i] = p.a0 + (p.a1 - p.a0) * t;
      this.rot[i] += p.rotV * dt;
    }
    this._dirty = true;
    this.flush();
  }

  flush() {
    if (!this._dirty) return;
    this._dirty = false;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aRot.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  setViewportScale(height) {
    // gl_PointSize is in pixels, so the world-space size of a particle has to
    // track the render target height or particles change size with resolution.
    this.mat.uniforms.uScale.value = height * 0.55;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.points.parent?.remove(this.points);
  }
}

// Small assembly kit for the hero machines.
//
// A period vending machine or a cast-iron arcane press is a hundred little
// boxes, cylinders and rivets. Adding a hundred meshes per machine would cost
// a hundred draw calls (and, with the shadow pass, two hundred). Everything
// static is instead accumulated per material and merged once, so a whole
// machine ships in a handful of draws while still being modelled part by part.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Rescale a BoxGeometry's per-face UVs to a uniform world density. */
export function boxUV(geo, w, h, d, tilesPerMetre) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
  for (let f = 0; f < 6; f++) {
    const [du, dv] = dims[f];
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * du * tilesPerMetre, uv.getY(idx) * dv * tilesPerMetre);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export class Kit {
  /** @param {number} density texture tiles per world metre for box UVs */
  constructor(density = 1.4) {
    this.density = density;
    this.buckets = new Map();
  }

  bucket(key) {
    let b = this.buckets.get(key);
    if (!b) { b = []; this.buckets.set(key, b); }
    return b;
  }

  /** Place an already-built geometry. Consumes it. */
  put(key, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _v.set(x, y, z);
    _s.set(sx, sy, sz);
    _m.compose(_v, _q, _s);
    geo.applyMatrix4(_m);
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    geo.deleteAttribute('uv1');
    geo.deleteAttribute('uv2');
    this.bucket(key).push(geo);
    return geo;
  }

  box(key, w, h, d, x, y, z, opts = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    boxUV(g, w, h, d, opts.density ?? this.density);
    return this.put(key, g, x, y, z, opts.rx || 0, opts.ry || 0, opts.rz || 0);
  }

  cyl(key, rTop, rBot, h, seg, x, y, z, opts = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, !!opts.open);
    const d = opts.density ?? this.density;
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * Math.PI * 2 * Math.max(rTop, rBot) * d, uv.getY(i) * h * d);
    }
    return this.put(key, g, x, y, z, opts.rx || 0, opts.ry || 0, opts.rz || 0);
  }

  torus(key, r, tube, rs, ts, x, y, z, opts = {}) {
    const g = new THREE.TorusGeometry(r, tube, rs, ts, opts.arc ?? Math.PI * 2);
    return this.put(key, g, x, y, z, opts.rx || 0, opts.ry || 0, opts.rz || 0);
  }

  sphere(key, r, wsg, hsg, x, y, z, opts = {}) {
    const g = new THREE.SphereGeometry(r, wsg, hsg, 0, Math.PI * 2, 0, opts.phi ?? Math.PI);
    return this.put(key, g, x, y, z, opts.rx || 0, opts.ry || 0, opts.rz || 0);
  }

  lathe(key, points, seg, x, y, z, opts = {}) {
    const g = new THREE.LatheGeometry(points, seg);
    return this.put(key, g, x, y, z, opts.rx || 0, opts.ry || 0, opts.rz || 0);
  }

  /**
   * A dome-headed rivet. Cheap: a 7x4 sphere cap.
   * `axis` is the direction the dome faces: 'z' | '-z' | 'x' | '-x' | 'y' | '-y'.
   * Facing matters — a rivet domed into the panel it sits on reads as a dent.
   */
  rivet(key, r, x, y, z, axis = 'z') {
    let rx = 0, rz = 0;
    if (axis === 'z') rx = Math.PI / 2;
    else if (axis === '-z') rx = -Math.PI / 2;
    else if (axis === 'x') rz = -Math.PI / 2;
    else if (axis === '-x') rz = Math.PI / 2;
    else if (axis === '-y') rz = Math.PI;
    return this.sphere(key, r, 7, 4, x, y, z, { phi: Math.PI / 2, rx, rz });
  }

  /** Merge every bucket into one mesh per material and parent them to `group`. */
  finish(group, materials, opts = {}) {
    const out = {};
    for (const [key, geos] of this.buckets) {
      if (!geos.length) continue;
      const mat = materials[key];
      if (!mat) { for (const g of geos) g.dispose(); continue; }
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) for (const g of geos) g.dispose();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = opts.noShadow?.includes(key) ? false : (opts.castShadow ?? true);
      mesh.receiveShadow = opts.receiveShadow ?? true;
      mesh.name = key;
      group.add(mesh);
      out[key] = mesh;
    }
    this.buckets.clear();
    return out;
  }
}

/** Bottle profile for the perk machines — a real 1940s pressed-glass bottle. */
export function bottleProfile(scale = 1) {
  const p = [];
  const add = (x, y) => p.push(new THREE.Vector2(x * scale, y * scale));
  add(0.000, 0.000);
  add(0.036, 0.000);
  add(0.040, 0.008);
  add(0.040, 0.062);
  add(0.038, 0.078);
  add(0.030, 0.094);
  add(0.019, 0.108);
  add(0.014, 0.124);
  add(0.014, 0.146);
  add(0.017, 0.150);
  add(0.017, 0.158);
  add(0.000, 0.158);
  return p;
}

/** A helical tube — copper coils on the teleporter columns. */
export function helixGeometry(radius, height, turns, tube, segments = 96, radial = 5) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = t * Math.PI * 2 * turns;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t * height, Math.sin(a) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, segments, tube, radial, false);
}

/** A sagging cable between two points. */
export function cableGeometry(a, b, sag, tube, segments = 14, radial = 5) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push(new THREE.Vector3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag,
      a.z + (b.z - a.z) * t,
    ));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segments, tube, radial, false);
}

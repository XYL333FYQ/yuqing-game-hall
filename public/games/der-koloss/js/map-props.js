// Environment art pass: architectural trim, industrial clutter, and the
// practical lighting rig.
//
// The base map is a correct but bare set of boxes — flat walls, empty floors,
// ten hanging bulbs. Everything here is decoration layered on top of that
// geometry: it never adds colliders, never moves a spawn, and never changes a
// navigable route, so gameplay and the map invariant validators are untouched.
//
// Everything is merged per material (a handful of draw calls for hundreds of
// props) and laid out from a seeded PRNG so the dressing is identical every
// session — a level should not reshuffle itself between matches.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';
import { MAP_WALKWAYS, MAP_TRAVERSAL_ZONES } from './map-layout.js';

// ---------------------------------------------------------------------------
// deterministic RNG
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function decorateMap(group, ctx) {
  const rnd = mulberry32(0x5EED17);
  const R = (a = 1, b) => (b === undefined ? rnd() * a : a + rnd() * (b - a));
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  // ---------------------------------------------------------------------
  // clearance
  // ---------------------------------------------------------------------
  // Solid props get real colliders — a crate you can walk through reads worse
  // than no crate at all. That makes placement a gameplay concern, so every
  // candidate position is tested against the things a player must always be
  // able to reach or walk through: interactables, doorways, spawn points,
  // zombie ground-spawn risers, and window barriers.
  const keepClear = ctx.keepClear || [];
  const colliders = ctx.colliders;
  function isClear(x, z, radius) {
    for (const k of keepClear) {
      const dx = x - k.x, dz = z - k.z;
      if (dx * dx + dz * dz < (k.r + radius) ** 2) return false;
    }
    return true;
  }

  /**
   * Is there actually a wall here?
   *
   * `alongWalls` picks positions inset from a room's RECTANGLE, but a rect edge
   * is frequently an open doorway, a corridor mouth or the boundary with the
   * next room. Props placed there stood in the middle of movement lanes. This
   * requires a real solid collider within reach before anything is committed,
   * which lets openings reject themselves.
   */
  function againstWall(x, z, reach = 1.35) {
    const list = ctx.wallColliders;
    if (!list || !list.length) return true;
    for (const c of list) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz <= reach * reach) return true;
    }
    return false;
  }
  /** Register a solid, non-climbable prop. Returns false if it was rejected. */
  /**
   * Footprints claimed by props that deliberately register NO collider.
   *
   * A pallet is walk-through on purpose, so nothing in the clearance system
   * stops the placer dropping one on top of another. Two pallets at the same
   * height are not merely untidy: every pallet builds its deck at exactly
   * y + 0.135, so an overlap puts two decks in one plane and the seam crawls.
   * Spread over every room that had pallets, that was the largest remaining
   * z-fight in the map after the crate rails.
   *
   * This is a placement-time test only — it never becomes a collider, so it
   * cannot change where the player can walk.
   */
  const footprints = [];
  function footprintFree(x, z, y, radius) {
    for (const f of footprints) {
      if (Math.abs(f.y - y) > 0.05) continue;
      const dx = x - f.x, dz = z - f.z;
      if (dx * dx + dz * dz < (f.r + radius) ** 2) return false;
    }
    return true;
  }
  function claimFootprint(x, z, y, radius) {
    footprints.push({ x, z, y, r: radius });
  }

  /**
   * Is this candidate standing INSIDE a prop that has already been placed?
   *
   * `alongWalls` tests a candidate against everything the player must be able
   * to reach, but never against the props it has itself already put down, so
   * two workbenches or two crates could occupy the same corner. Interpenetrating
   * props read as broken on their own, and because two copies of one builder
   * put their tops at exactly the same height, they also z-fight across every
   * horizontal surface they share.
   *
   * Deliberately a containment test with a small margin rather than a spacing
   * radius: props are SUPPOSED to cluster against walls and against each other,
   * and pushing them apart would thin out the dressing.
   */
  function propFree(x, z, y, margin = 0.25) {
    if (!colliders) return true;
    for (const c of colliders) {
      if (!c.prop) continue;
      if (Math.abs((c.y0 ?? 0) - y) > 0.05) continue;
      if (x > c.minX - margin && x < c.maxX + margin
        && z > c.minZ - margin && z < c.maxZ + margin) return false;
    }
    return true;
  }

  function solid(x, z, halfW, halfD, height, y = 0) {
    if (!colliders) return true;
    colliders.push({
      minX: x - halfW, maxX: x + halfW,
      minZ: z - halfD, maxZ: z + halfD,
      y0: y, h: height, prop: true,
    });
    return true;
  }

  const M = ctx.materials;
  // Geometry buckets, merged once at the end — one draw call per material.
  const buckets = {
    metal: [], wood: [], plate: [], concrete: [], dark: [], brick: [],
    rubber: [], canvas: [], emissive: [],
  };
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();

  /** Push a geometry into a bucket at a transform. Consumes `geo`. */
  function place(bucket, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    tmpE.set(rx, ry, rz);
    tmpQ.setFromEuler(tmpE);
    tmpV.set(x, y, z);
    tmpS.set(sx, sy, sz);
    tmpM.compose(tmpV, tmpQ, tmpS);
    const g = geo.clone();
    g.applyMatrix4(tmpM);
    if (!g.attributes.uv) {
      // Merging requires a consistent attribute set across the bucket.
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    buckets[bucket].push(g);
    return g;
  }

  // ---- shared primitive geometries (cloned per placement, never rebuilt) ----
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    cyl16: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
    cone: new THREE.ConeGeometry(0.5, 1, 12, 1, true),
    torus: new THREE.TorusGeometry(0.5, 0.1, 6, 14),
    sphere: new THREE.SphereGeometry(0.5, 10, 8),
    rock: new THREE.IcosahedronGeometry(0.5, 0),
    rock1: new THREE.DodecahedronGeometry(0.5, 0),
    plane: new THREE.PlaneGeometry(1, 1),
  };
  // Give the rubble chunks irregular silhouettes once, up front.
  for (const key of ['rock', 'rock1']) {
    const p = G[key].attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) * R(0.6, 1.4), p.getY(i) * R(0.5, 1.2), p.getZ(i) * R(0.6, 1.4));
    }
    G[key].computeVertexNormals();
  }

  const lights = [];
  const animated = [];

  // =========================================================================
  // prop builders
  // =========================================================================

  /** Slatted wooden crate with corner braces. */
  function crate(x, y, z, s = 0.8, ry = 0) {
    const h = s * R(0.85, 1.05);
    place('wood', G.box, x, y + h / 2, z, 0, ry, 0, s, h, s);
    // corner posts + rails read as construction rather than a painted cube
    const t = s * 0.08;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      place('wood', G.box, x + sx * (s / 2 - t / 2) * Math.cos(ry) - sz * (s / 2 - t / 2) * Math.sin(ry),
        y + h / 2, z + sx * (s / 2 - t / 2) * Math.sin(ry) + sz * (s / 2 - t / 2) * Math.cos(ry),
        0, ry, 0, t * 1.2, h * 1.01, t * 1.2);
    }
    // One rail per height. The rail is a square band — it is scaled equally in
    // x and z — so a copy of it turned 90° is the SAME box in the same place,
    // not a second pair of sides. Placing both left every crate in the map with
    // two perfectly coincident rails, and coincident faces have no depth-buffer
    // winner: the pixels pick between two sets of UVs per frame. That was the
    // single largest source of the "the map flickers while I stand still"
    // report — 150m² of it, because crates are scattered through every room.
    for (const hy of [h * 0.22, h * 0.78]) {
      place('wood', G.box, x, y + hy, z, 0, ry, 0, s * 1.02, t, s * 1.02);
    }
    if (rnd() < 0.25) { // stencilled band
      place('dark', G.box, x, y + h * 0.5, z, 0, ry, 0, s * 1.03, t * 0.8, s * 1.03);
    }
  }

  /** 200 litre steel drum with rolling hoops and a bung. */
  const DRUM_R = 0.29;
  const DRUM_HOOP_R = DRUM_R * 1.045;   // the hoops stand proud of the barrel
  function drum(x, y, z, ry = 0, tipped = false) {
    const r = DRUM_R, h = 0.88;
    if (tipped) {
      place('metal', G.cyl16, x, y + r, z, Math.PI / 2, ry, 0, r * 2, h, r * 2);
      for (const o of [-0.22, 0.22]) {
        place('metal', G.cyl16, x + Math.cos(ry) * o, y + r, z + Math.sin(ry) * o, Math.PI / 2, ry, 0, r * 2.09, 0.05, r * 2.09);
      }
      return;
    }
    place('metal', G.cyl16, x, y + h / 2, z, 0, ry, 0, r * 2, h, r * 2);
    for (const o of [-0.2, 0.2]) place('metal', G.cyl16, x, y + h / 2 + o, z, 0, ry, 0, r * 2.09, 0.055, r * 2.09);
    place('metal', G.cyl12, x, y + h + 0.012, z, 0, ry, 0, r * 2.02, 0.03, r * 2.02);
    place('dark', G.cyl8, x + r * 0.45, y + h + 0.03, z, 0, 0, 0, 0.07, 0.035, 0.07);
  }

  /** Shipping pallet — visible slat gaps are what make it read. */
  function pallet(x, y, z, ry = 0) {
    const w = 1.1, d = 0.85;
    // Half the diagonal, so the test is independent of `ry`. Returns false when
    // the spot is taken so `alongWalls` retries elsewhere rather than laying a
    // second deck in the first one's plane.
    const FOOT = Math.hypot(w, d) / 2;
    if (!footprintFree(x, z, y, FOOT)) return false;
    claimFootprint(x, z, y, FOOT);
    // Deck boards are spread ACROSS the pallet's depth, on the same axis the
    // stringers below them are spread on. They were being stepped along the
    // pallet's LENGTH instead — the axis each board already spans — so all five
    // 1.1m boards piled up in one 0.12m strip, every one of them coplanar with
    // the other four top and bottom. That is what the deck gap is for, and it
    // was also the largest single z-fight left in the map: 9m² of it, on the
    // floor, in every room that dresses with pallets.
    const across = (o) => [x - Math.sin(ry) * o, z + Math.cos(ry) * o];
    for (let i = 0; i < 5; i++) {
      const [px, pz] = across(-d / 2 + (i / 4) * d);
      place('wood', G.box, px, y + 0.135, pz, 0, ry, 0, w, 0.028, d * 0.14);
    }
    for (const o of [-d / 2 + 0.08, 0, d / 2 - 0.08]) {
      const [px, pz] = across(o);
      place('wood', G.box, px, y + 0.065, pz, 0, ry, 0, w, 0.09, 0.1);
    }
    return true;
  }

  /** Sandbag wall — staggered courses with slightly squashed bags. */
  function sandbags(x, y, z, len, ry, rows = 3) {
    const bagW = 0.42;
    const n = Math.max(2, Math.round(len / bagW));
    for (let r0 = 0; r0 < rows; r0++) {
      const off = (r0 % 2) * bagW * 0.5;
      for (let i = 0; i < n - (r0 % 2); i++) {
        const t = -len / 2 + off + i * bagW + bagW / 2;
        place('canvas', G.sphere,
          x + Math.cos(ry) * t, y + 0.11 + r0 * 0.19, z + Math.sin(ry) * t,
          R(-0.08, 0.08), ry + R(-0.15, 0.15), R(-0.06, 0.06),
          bagW * 1.02, 0.2, 0.34);
      }
    }
  }

  /** Rubble pile: chunks of broken concrete with rebar spurs. */
  function rubble(x, y, z, radius = 1.1, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = R(Math.PI * 2), d = Math.sqrt(rnd()) * radius;
      const s = R(0.1, 0.36);
      place('concrete', pick([G.rock, G.rock1]),
        x + Math.cos(a) * d, y + s * R(0.25, 0.5), z + Math.sin(a) * d,
        R(Math.PI), R(Math.PI), R(Math.PI), s, s * R(0.5, 0.9), s);
    }
    for (let i = 0; i < Math.max(1, count / 5); i++) {
      const a = R(Math.PI * 2), d = R(radius * 0.7);
      place('metal', G.cyl8, x + Math.cos(a) * d, y + 0.18, z + Math.sin(a) * d,
        R(-0.7, 0.7), R(Math.PI), R(-0.7, 0.7), 0.018, R(0.3, 0.7), 0.018);
    }
  }

  /** Horizontal pipe run with brackets, elbows and the odd valve wheel. */
  function pipeRun(x1, y, z1, x2, z2, radius = 0.07, mat = 'metal') {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const ry = Math.atan2(dx, dz);
    place(mat, G.cyl12, (x1 + x2) / 2, y, (z1 + z2) / 2, Math.PI / 2, ry, 0, radius * 2, len, radius * 2);
    // flanges
    place(mat, G.cyl12, x1, y, z1, Math.PI / 2, ry, 0, radius * 2.6, 0.06, radius * 2.6);
    place(mat, G.cyl12, x2, y, z2, Math.PI / 2, ry, 0, radius * 2.6, 0.06, radius * 2.6);
    // brackets every ~2.2m
    const n = Math.max(1, Math.floor(len / 2.2));
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const bx = x1 + dx * t, bz = z1 + dz * t;
      place('dark', G.box, bx, y + radius + 0.05, bz, 0, ry, 0, radius * 3.2, 0.1, 0.05);
      if (rnd() < 0.22) {
        // valve wheel
        place('metal', G.torus, bx, y + radius * 1.1, bz, 0, ry, Math.PI / 2, 0.3, 0.3, 0.3);
        place('metal', G.cyl8, bx, y + radius * 0.6, bz, 0, 0, 0, 0.05, 0.16, 0.05);
      }
    }
  }

  /** Drooping cable between two points (catenary, segmented). */
  function cable(x1, y1, z1, x2, y2, z2, sag = 0.35, segs = 8, radius = 0.016) {
    let px = x1, py = y1, pz = z1;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const cx = x1 + (x2 - x1) * t;
      const cz = z1 + (z2 - z1) * t;
      const cy = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * sag;
      const dx = cx - px, dy = cy - py, dz = cz - pz;
      const len = Math.hypot(dx, dy, dz);
      const g = new THREE.CylinderGeometry(radius, radius, len, 5);
      const m = new THREE.Matrix4();
      const up = new THREE.Vector3(0, 1, 0);
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
      m.compose(new THREE.Vector3((px + cx) / 2, (py + cy) / 2, (pz + cz) / 2), q, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      buckets.dark.push(g);
      px = cx; py = cy; pz = cz;
    }
  }

  /** Hanging chain with a hook. */
  function chain(x, yTop, z, len) {
    const links = Math.max(2, Math.round(len / 0.13));
    for (let i = 0; i < links; i++) {
      place('metal', G.torus, x, yTop - i * 0.13 - 0.065, z, Math.PI / 2, (i % 2) * Math.PI / 2, 0, 0.12, 0.12, 0.12);
    }
    place('metal', G.torus, x, yTop - len - 0.07, z, Math.PI / 2, 0, 0, 0.2, 0.2, 0.2);
  }

  /** Structural I-beam. */
  function ibeam(x, y, z, len, ry = 0, w = 0.26, h = 0.34) {
    place('plate', G.box, x, y + h / 2, z, 0, ry, 0, len, 0.05, w);
    place('plate', G.box, x, y - h / 2, z, 0, ry, 0, len, 0.05, w);
    place('plate', G.box, x, y, z, 0, ry, 0, len, h, 0.045);
    // gusset plates + rivets
    const n = Math.max(1, Math.floor(len / 3));
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (i / n) * len;
      place('plate', G.box, x + Math.cos(ry) * t, y, z + Math.sin(ry) * t, 0, ry, 0, 0.06, h * 0.94, w * 0.92);
    }
  }

  /** Ventilation duct with joint bands. */
  function duct(x, y, z, len, ry = 0, size = 0.5) {
    place('plate', G.box, x, y, z, 0, ry, 0, len, size, size);
    const n = Math.max(1, Math.floor(len / 2.4));
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (i / n) * len;
      place('plate', G.box, x + Math.cos(ry) * t, y, z + Math.sin(ry) * t, 0, ry, 0, 0.07, size * 1.13, size * 1.13);
    }
    // hangers up to the ceiling
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (i / n) * len;
      place('dark', G.box, x + Math.cos(ry) * t, y + size * 0.5 + 0.28, z + Math.sin(ry) * t, 0, ry, 0, 0.03, 0.56, 0.03);
    }
  }

  /** Caged work lamp on a wall bracket. Adds a real PointLight. */
  function wallLamp(x, y, z, ry, color = 0xffb765, opts = {}) {
    const dx = -Math.sin(ry), dz = -Math.cos(ry);   // outward from the wall
    // bracket
    place('dark', G.box, x + dx * 0.09, y, z + dz * 0.09, 0, ry, 0, 0.1, 0.12, 0.18);
    place('dark', G.cyl8, x + dx * 0.22, y + 0.02, z + dz * 0.22, Math.PI / 2, ry, 0, 0.035, 0.3, 0.035);
    // conical shade
    place('metal', G.cone, x + dx * 0.38, y + 0.06, z + dz * 0.38, Math.PI * 0.14, ry, 0, 0.34, 0.26, 0.34);
    // cage bars
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      place('dark', G.cyl8,
        x + dx * 0.38 + Math.cos(a) * 0.14 * Math.cos(ry), y - 0.06, z + dz * 0.38 + Math.cos(a) * 0.14 * Math.sin(ry),
        0.2, ry, 0, 0.014, 0.22, 0.014);
    }
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0x1a1610, emissive: new THREE.Color(color), emissiveIntensity: 1.4, roughness: 0.3, toneMapped: false,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), bulbMat);
    bulb.position.set(x + dx * 0.38, y - 0.05, z + dz * 0.38);
    group.add(bulb);

    const light = new THREE.PointLight(color, 0, opts.distance ?? 13, 2);
    light.position.set(x + dx * 0.5, y - 0.1, z + dz * 0.5);
    group.add(light);
    lights.push({
      light, bulb, mat: bulbMat, base: color,
      on: opts.on ?? 55, off: opts.off ?? 0,
      flicker: opts.flicker ?? (rnd() < 0.22),
      broken: opts.broken ?? false,
      t: R(20),
    });
  }

  /** Emergency dome light — red, on even without main power. */
  function emergencyLight(x, y, z, ry) {
    const dx = -Math.sin(ry), dz = -Math.cos(ry);
    place('dark', G.box, x + dx * 0.06, y, z + dz * 0.06, 0, ry, 0, 0.26, 0.16, 0.12);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x2a0604, emissive: new THREE.Color(0xff2a12), emissiveIntensity: 2.2, roughness: 0.25, toneMapped: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), domeMat);
    dome.rotation.z = Math.PI / 2;
    dome.rotation.y = ry;
    dome.position.set(x + dx * 0.17, y, z + dz * 0.17);
    group.add(dome);
    const light = new THREE.PointLight(0xff2a12, 6, 9, 2);
    light.position.set(x + dx * 0.35, y, z + dz * 0.35);
    group.add(light);
    lights.push({ light, bulb: dome, mat: domeMat, base: 0xff2a12, on: 4, off: 11, flicker: false, emergency: true, t: R(20) });
  }

  /** Fluorescent tube fixture (labs). Flickers hard when about to fail. */
  function fluorescent(x, y, z, ry, len = 1.5, color = 0xd6e6ff) {
    place('plate', G.box, x, y + 0.06, z, 0, ry, 0, len, 0.07, 0.16);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x0d1014, emissive: new THREE.Color(color), emissiveIntensity: 1.6, roughness: 0.2, toneMapped: false,
    });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len * 0.92, 8), tubeMat);
    tube.rotation.set(0, ry, Math.PI / 2);
    tube.position.set(x, y, z);
    group.add(tube);
    const light = new THREE.PointLight(color, 0, 11, 2);
    light.position.set(x, y - 0.12, z);
    group.add(light);
    lights.push({ light, bulb: tube, mat: tubeMat, base: color, on: 26, off: 0, flicker: rnd() < 0.45, fluoro: true, t: R(20) });
  }

  /** Heavy factory machine: base, housing, motor, pipes, gauge panel. */
  function machine(x, y, z, ry, w = 1.6, h = 1.5, d = 1.1) {
    place('plate', G.box, x, y + 0.09, z, 0, ry, 0, w * 1.1, 0.18, d * 1.1);
    place('metal', G.box, x, y + 0.18 + h / 2, z, 0, ry, 0, w, h, d);
    // motor housing on top
    place('metal', G.cyl12, x - Math.cos(ry) * w * 0.24, y + 0.18 + h + 0.16, z - Math.sin(ry) * w * 0.24,
      0, ry, Math.PI / 2, 0.32, 0.5, 0.32);
    // exhaust stack
    place('metal', G.cyl8, x + Math.cos(ry) * w * 0.3, y + 0.18 + h + 0.4, z + Math.sin(ry) * w * 0.3, 0, 0, 0, 0.11, 0.8, 0.11);
    // access hatch + bolts
    place('dark', G.box, x - Math.sin(ry) * (d / 2 + 0.01), y + 0.18 + h * 0.55, z - Math.cos(ry) * (d / 2 + 0.01),
      0, ry, 0, w * 0.5, h * 0.42, 0.03);
    // gauge panel — small emissive dials the bloom pass will catch
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d10, emissive: 0x2fbf6a, emissiveIntensity: 0.9, roughness: 0.35, toneMapped: false,
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.03), panelMat);
    panel.position.set(x - Math.sin(ry) * (d / 2 + 0.03), y + 0.18 + h * 0.82, z - Math.cos(ry) * (d / 2 + 0.03));
    panel.rotation.y = ry;
    group.add(panel);
    animated.push({ kind: 'gauge', mat: panelMat, t: R(10) });
    // feed pipes into the floor
    for (const o of [-w * 0.32, w * 0.32]) {
      place('metal', G.cyl8, x + Math.cos(ry) * o, y + 0.6, z + Math.sin(ry) * o, 0, 0, 0, 0.08, 1.2, 0.08);
    }
  }

  /** Workbench with a vice and scattered tools. */
  function workbench(x, y, z, ry, len = 1.8) {
    place('wood', G.box, x, y + 0.86, z, 0, ry, 0, len, 0.07, 0.62);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      place('dark', G.box,
        x + Math.cos(ry) * sx * (len / 2 - 0.09) - Math.sin(ry) * sz * 0.24,
        y + 0.43,
        z + Math.sin(ry) * sx * (len / 2 - 0.09) + Math.cos(ry) * sz * 0.24,
        0, ry, 0, 0.06, 0.86, 0.06);
    }
    place('metal', G.box, x + Math.cos(ry) * (len * 0.3), y + 0.96, z + Math.sin(ry) * (len * 0.3), 0, ry, 0, 0.18, 0.14, 0.12);
    for (let i = 0; i < 3; i++) {
      place('metal', G.box, x + Math.cos(ry) * R(-len / 2 + 0.2, len / 2 - 0.2), y + 0.91,
        z + Math.sin(ry) * R(-len / 2 + 0.2, len / 2 - 0.2), 0, R(Math.PI), 0, R(0.05, 0.24), 0.03, 0.035);
    }
  }

  /** Cable spool on its side or upright. */
  function spool(x, y, z, ry) {
    const r = 0.46;
    for (const o of [-0.24, 0.24]) {
      place('wood', G.cyl16, x, y + r, z + o, Math.PI / 2, ry, 0, r * 2, 0.06, r * 2);
    }
    place('dark', G.cyl12, x, y + r, z, Math.PI / 2, ry, 0, r * 1.2, 0.42, r * 1.2);
  }

  /** Hanging torn tarpaulin. */
  function tarp(x, y, z, w, h, ry) {
    place('canvas', G.plane, x, y - h / 2, z, 0, ry, 0, w, h, 1);
    place('dark', G.cyl8, x, y, z, Math.PI / 2, ry, 0, 0.025, w, 0.025);
  }

  // -------------------------------------------------------------------------
  // overhead clearance
  // -------------------------------------------------------------------------
  // Ground props are kept off interactables by `isClear`. Overhead dressing had
  // no equivalent test at all: it is positioned from the room rect at a height
  // fixed per room, so a duct, chain or cable happily materialised in mid-air
  // over a staircase, a doorway or the catwalk. See MAP_WALKWAYS for the case
  // that prompted this. Nothing decorative may occupy a walkway's headroom.

  /** The walkway a point intrudes on, or null. */
  function inWalkway(x, z, y, pad = 0.35) {
    for (const w of MAP_WALKWAYS) {
      // Below the surface is fine — that is the soffit of the deck, not its
      // headroom — as is anything above the volume a player's head sweeps.
      if (y <= w.floorY + 0.02 || y >= w.clearTop) continue;
      if (x > w.minX - pad && x < w.maxX + pad && z > w.minZ - pad && z < w.maxZ + pad) return w;
    }
    return null;
  }

  /** True when a straight run at height `y` touches no walkway along its length. */
  function runClear(ax, az, bx, bz, y, pad = 0.35) {
    const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (inWalkway(ax + (bx - ax) * t, az + (bz - az) * t, y, pad)) return false;
    }
    return true;
  }

  /**
   * Slide a hall-spanning run along z until `test` passes, starting from where
   * it wanted to be and stepping outward. Returns null when the hall offers no
   * clear line at that height, in which case the caller drops the run — an
   * empty ceiling reads as unfinished, but a duct through a staircase is worse.
   */
  function slideZ(want, lo, hi, test) {
    if (test(want)) return want;
    for (let s = 0.25; s <= hi - lo; s += 0.25) {
      if (want + s <= hi && test(want + s)) return want + s;
      if (want - s >= lo && test(want - s)) return want - s;
    }
    return null;
  }

  /**
   * The lowest elevated deck directly over a ground-level point, if any.
   *
   * Both corridor rooms run under a balcony for half their length, so their
   * single room-wide "ceiling height" is wrong for that half: a wall lamp at
   * 3.1m sat 20cm ABOVE the balcony floor it was supposed to hang below. Lamps
   * tuck under whatever is actually overhead instead of being deleted, so the
   * space under the balcony stays lit.
   */
  function deckAbove(x, z, y) {
    let best = null;
    for (const w of MAP_WALKWAYS) {
      if (w.floorY <= y + 0.1) continue;
      if (x < w.minX || x > w.maxX || z < w.minZ || z > w.maxZ) continue;
      if (best === null || w.floorY < best) best = w.floorY;
    }
    return best;
  }

  /** Floor drain grate. */
  function drain(x, y, z) {
    place('dark', G.box, x, y + 0.01, z, 0, 0, 0, 0.52, 0.03, 0.52);
    for (let i = 0; i < 6; i++) {
      place('metal', G.box, x - 0.2 + i * 0.08, y + 0.025, z, 0, 0, 0, 0.045, 0.02, 0.46);
    }
  }

  // =========================================================================
  // placement
  // =========================================================================
  // Rooms are laid out as axis-aligned rects; each entry describes how densely
  // to dress the walls and floor of that space and what it is used for.
  const ROOM_DRESSING = [
    { id: 'mainframe', rect: [-10, 10, 14, 26], y: 0, outdoor: true, crates: 3, drums: 3, rubble: 2, lamps: 0, bags: 2 },
    { id: 'leftcorridor', rect: [-14, -6, -22, 14], y: 0, ceilingY: 4.375, crates: 5, drums: 4, rubble: 3, lamps: 4, pipes: true, ducts: true },
    { id: 'garageentrance', rect: [6, 14, -22, 14], y: 0, ceilingY: 4.375, crates: 5, drums: 4, rubble: 3, lamps: 4, pipes: true, ducts: true },
    { id: 'animallab', rect: [-32, -14, -20, -6], y: 0, ceilingY: 4.375, crates: 4, drums: 3, rubble: 2, fluoro: 4, benches: 2, machines: 1, pipes: true },
    { id: 'genroom', rect: [-44, -32, -20, -6], y: 0, ceilingY: 4.375, crates: 3, drums: 5, rubble: 2, lamps: 2, machines: 2, pipes: true, cables: true },
    { id: 'autogarage', rect: [14, 32, -20, -6], y: 0, ceilingY: 4.375, crates: 5, drums: 5, rubble: 3, lamps: 3, benches: 2, spools: 2, pipes: true },
    { id: 'courtyard', rect: [-16, 10, -42, -22], y: 0, outdoor: true, crates: 6, drums: 6, rubble: 5, bags: 3, lamps: 3, spools: 1 },
    { id: 'factory', rect: [-14, 14, -62, -42], y: 0, ceilingY: 6.875, crates: 8, drums: 7, rubble: 4, lamps: 4, machines: 3, benches: 2, beams: true, pipes: true, ducts: true, cables: true, spools: 2 },
    { id: 'chemtesting', rect: [10, 24, -38, -22], y: 2.9, ceilingY: 5.875, fluoro: 3, drums: 4, crates: 2, machines: 1, benches: 1 },
  ];

  // Underside of each room's ceiling slab (see the `ceil()` calls in map.js).
  // Overhead dressing is clamped below it: Chemical Testing's fluorescents were
  // computed as roomY + 3.25 = 6.15, which put all three inside a ceiling whose
  // underside is at 5.875, so the room's only fixtures were buried in concrete.
  const ceilLimit = (room, want, gap) =>
    (room.ceilingY === undefined ? want : Math.min(want, room.ceilingY - gap));

  // Keep dressing out of the middle of rooms so nothing blocks a fighting lane
  // or a spawn approach: props hug the walls with a margin from each corner.
  // `clearance` is the prop's own footprint radius. It used to default to 0 AND
  // to gate the keep-clear test itself, so every caller that did not pass one
  // skipped the test completely — which is how a rusted plate ended up standing
  // on Teleporter A's pad and a slab ended up at eye height in front of the
  // power switch. The test now always runs, with a floor under the radius.
  // Set per room before its dressing runs, so the helpers below know which
  // level they are placing on without threading it through every call site.
  let roomY = 0;

  /**
   * Is a footprint clear of every walkway ON THIS LEVEL?
   *
   * `isClear` covers interactables and doorways, but nothing described the
   * staircases, so a crate or rubble pile could be dropped straight onto the
   * lab flight: `alongWalls` runs the corridor's west edge at x = -13.15 and
   * the stairwell sits at x -13.2..-8.8, so any candidate whose z landed in the
   * flight passed both tests and spawned on the steps. Decks belonging to other
   * levels are skipped — a crate parked UNDER the balcony is fine.
   */
  function walkwayFree(x, z, radius) {
    for (const w of MAP_WALKWAYS) {
      if (w.floorY > roomY + 0.1) continue;
      if (x > w.minX - radius && x < w.maxX + radius && z > w.minZ - radius && z < w.maxZ + radius) return false;
    }
    return true;
  }

  /**
   * Is a footprint clear of every route that must stay walkable end to end?
   *
   * `walkwayFree` covers the surfaces a player stands on; this covers getting
   * ONTO them — the apron at the foot and head of each flight — and the wall
   * openings that are routes but carry no door record, which `isClear` only
   * knows about through MAP_DOOR_DEFS. Both gaps had the same symptom: a solid
   * prop against a real wall, passing every existing test, parked in the single
   * lane to the stairs or squarely in the courtyard exit.
   */
  function zoneFree(x, z, radius) {
    for (const zone of MAP_TRAVERSAL_ZONES) {
      if (zone.floorY > roomY + 0.1 || zone.floorY < roomY - 0.1) continue;
      if (x > zone.minX - radius && x < zone.maxX + radius
        && z > zone.minZ - radius && z < zone.maxZ + radius) return false;
    }
    return true;
  }

  function alongWalls(rect, count, fn, inset = 0.85, clearance = 0.8) {
    const [x0, x1, z0, z1] = rect;
    for (let i = 0; i < count; i++) {
      // A few attempts per prop: if every candidate lands on something that
      // must stay reachable, drop the prop rather than block the level.
      for (let attempt = 0; attempt < 8; attempt++) {
        const side = RI(0, 3);
        let x, z, ry;
        if (side === 0) { x = R(x0 + 1.6, x1 - 1.6); z = z0 + inset; ry = 0; }
        else if (side === 1) { x = R(x0 + 1.6, x1 - 1.6); z = z1 - inset; ry = Math.PI; }
        else if (side === 2) { x = x0 + inset; z = R(z0 + 1.6, z1 - 1.6); ry = Math.PI / 2; }
        else { x = x1 - inset; z = R(z0 + 1.6, z1 - 1.6); ry = -Math.PI / 2; }
        if (!isClear(x, z, Math.max(0.8, clearance))) continue;
        if (!walkwayFree(x, z, Math.max(0.5, clearance * 0.6))) continue;
        if (!zoneFree(x, z, Math.max(0.5, clearance * 0.6))) continue;
        if (!againstWall(x, z)) continue;
        if (!propFree(x, z, roomY)) continue;
        // A builder may reject the spot itself (see `pallet`); treat that like
        // any other failed clearance test and try another candidate, so the
        // room keeps its authored prop count.
        if (fn(x, z, ry, i) === false) continue;
        break;
      }
    }
  }

  for (const room of ROOM_DRESSING) {
    const [x0, x1, z0, z1] = room.rect;
    const y = room.y;
    roomY = y;
    const w = x1 - x0, d = z1 - z0;

    // ---- crates, sometimes stacked two high ----
    alongWalls(room.rect, room.crates || 0, (x, z, ry) => {
      const s = R(0.62, 0.95);
      crate(x, y, z, s, R(-0.4, 0.4));
      let top = s;
      if (rnd() < 0.42) { const s2 = s * R(0.72, 0.92); crate(x + R(-0.14, 0.14), y + s * R(0.85, 1.05), z + R(-0.14, 0.14), s2, R(-0.6, 0.6)); top = s + s2; }
      solid(x, z, s * 0.62, s * 0.62, top, y);
    }, 0.85, 1.1);

    // ---- drums ----
    alongWalls(room.rect, room.drums || 0, (x, z, ry) => {
      const tipped = rnd() < 0.22;
      drum(x, y, z, R(Math.PI * 2), tipped);
      solid(x, z, 0.31, 0.31, tipped ? 0.6 : 0.9, y);
      if (!tipped && rnd() < 0.35) {
        // Stand the neighbour off the HOOPS, which are the widest part of a
        // drum, not off the barrel. At the old 0.50-0.66m the two barrels
        // interpenetrated and both pairs of rolling hoops landed in the same
        // two horizontal planes, so every paired drum in the map fought.
        const gap = R(DRUM_HOOP_R * 2 + 0.02, DRUM_HOOP_R * 2 + 0.2);
        const ang = R(-0.32, 0.32);
        const ox = x + Math.cos(ang) * gap, oz = z + Math.sin(ang) * gap;
        // Standing clear of its OWN primary is not enough — the offset can put
        // it on top of a drum some earlier iteration already placed.
        if (propFree(ox, oz, y)) {
          drum(ox, y, oz, R(Math.PI * 2), false);
          solid(ox, oz, 0.31, 0.31, 0.9, y);
        }
      }
    }, 0.85, 1.2);

    // ---- rubble ----
    alongWalls(room.rect, room.rubble || 0, (x, z) => rubble(x, y, z, R(0.5, 0.85), RI(6, 12)), 1.6, 0.9);

    // ---- sandbags ----
    alongWalls(room.rect, room.bags || 0, (x, z, ry) => {
      const len = R(1.6, 2.8), rows = RI(2, 4);
      sandbags(x, y, z, len, ry + Math.PI / 2, rows);
      const along = Math.abs(Math.cos(ry + Math.PI / 2));
      solid(x, z, along > 0.5 ? len / 2 : 0.28, along > 0.5 ? 0.28 : len / 2, 0.12 + rows * 0.19, y);
    }, 1.1, 1.5);

    // ---- pallets + spools ----
    alongWalls(room.rect, room.spools || 0, (x, z, ry) => {
      spool(x, y, z, ry);
      solid(x, z, 0.48, 0.3, 0.95, y);
      if (rnd() < 0.5) pallet(x + R(-1, 1), y, z + R(-0.6, 0.6), R(Math.PI));
    }, 0.85, 1.3);
    alongWalls(room.rect, Math.round((room.crates || 0) * 0.4), (x, z, ry) => pallet(x, y, z, ry + R(-0.3, 0.3)), 0.85, 1.0);

    // ---- workbenches ----
    alongWalls(room.rect, room.benches || 0, (x, z, ry) => {
      const len = R(1.5, 2.2);
      workbench(x, y, z, ry, len);
      const along = Math.abs(Math.cos(ry));
      solid(x, z, along > 0.5 ? len / 2 : 0.34, along > 0.5 ? 0.34 : len / 2, 0.95, y);
    }, 0.95, 1.4);

    // ---- machines: pulled off the wall a little so they read in the round ----
    alongWalls(room.rect, room.machines || 0, (x, z, ry) => {
      const w = R(1.3, 1.9), h = R(1.2, 1.7), d = R(0.9, 1.2);
      machine(x, y, z, ry, w, h, d);
      const along = Math.abs(Math.cos(ry));
      solid(x, z, along > 0.5 ? w / 2 : d / 2, along > 0.5 ? d / 2 : w / 2, h + 0.2, y);
    }, 1.35, 1.7);

    // ---- wall lamps ----
    const lampY = ceilLimit(room, y + (room.id === 'factory' ? 4.6 : 3.1), 0.35);
    alongWalls(room.rect, room.lamps || 0, (x, z, ry) => {
      // Tuck under a balcony rather than hovering above its floor.
      const deck = deckAbove(x, z, y);
      const ly = deck === null ? lampY : Math.min(lampY, deck - 0.55);
      if (inWalkway(x, z, ly, 0.2)) return;
      wallLamp(x, ly, z, ry, 0xffb765, {
        distance: room.id === 'factory' ? 17 : 13,
        on: room.id === 'factory' ? 66 : 44,
        off: room.outdoor ? 0 : 26,
      });
    }, 0.35);

    // ---- fluorescents ----
    const fluoY = ceilLimit(room, y + 3.25, 0.25);
    alongWalls(room.rect, room.fluoro || 0, (x, z, ry) => {
      if (inWalkway(x, z, fluoY, 0.2)) return;
      fluorescent(x, fluoY, z, ry + Math.PI / 2, R(1.2, 1.9));
    }, 1.6);

    // ---- emergency lights: one per interior room, near a corner ----
    if (!room.outdoor) emergencyLight(x0 + 0.32, y + 2.65, z0 + R(2, d - 2), Math.PI / 2);

    // ---- wall pipe runs at head height ----
    if (room.pipes) {
      // Both corridor rooms run under a balcony for half their length. A pipe at
      // 2.75 was threaded straight through that slab (2.65-2.90) — a third of
      // each run vanished into the floor above. Drop the run under the soffit
      // when the room has one; elsewhere head height is unchanged.
      let py = y + 2.75;
      const deck = deckAbove((x0 + x1) / 2, (z0 + z1) / 2, y) ?? deckAbove(x0 + 0.42, z0 + 1.2, y);
      if (deck !== null) py = Math.min(py, deck - 0.125 - 0.24);
      pipeRun(x0 + 0.42, py, z0 + 1.2, x0 + 0.42, z1 - 1.2, R(0.055, 0.09));
      pipeRun(x1 - 0.42, py - 0.22, z0 + 1.6, x1 - 0.42, z1 - 1.6, R(0.04, 0.07));
      if (w > 12) pipeRun(x0 + 1.4, py + 0.25, z0 + 0.42, x1 - 1.4, z0 + 0.42, R(0.05, 0.08));
    }

    // ---- ceiling ducts ----
    if (room.ducts) {
      const dy = ceilLimit(room, y + (room.id === 'factory' ? 5.9 : 3.55), 0.45);
      const dx = (x0 + x1) / 2 + R(-1, 1), len = Math.min(d * 0.42, 10), sec = R(0.4, 0.6);
      // This run is what used to cross both balcony stairwells. Slide it along
      // the hall until its whole length is clear rather than trusting z0+0.4d.
      const dz = slideZ(z0 + d * 0.4, z0 + len / 2, z1 - len / 2,
        (cz) => runClear(dx, cz - len / 2, dx, cz + len / 2, dy));
      if (dz !== null) duct(dx, dy, dz, len, Math.PI / 2, sec);
    }

    // ---- structural beams ----
    if (room.beams) {
      for (let i = 0; i < 4; i++) {
        const bz = z0 + ((i + 0.5) / 4) * d;
        ibeam((x0 + x1) / 2, y + 6.35, bz, w * 0.80, 0, 0.3, 0.4);
      }
    }

    // ---- hanging cables + chains ----
    if (room.cables) {
      const cy = ceilLimit(room, y + 3.3, 0.3);
      for (let i = 0; i < 3; i++) {
        const sag = R(0.4, 0.9);
        // The factory's middle run landed on the catwalk's centre line and read
        // as a pole through the top of its staircase; every hall is checked now.
        const cz = slideZ(z0 + ((i + 0.5) / 3) * d, z0 + 1.5, z1 - 1.5,
          (z) => runClear(x0 + 1.6, z, x1 - 1.6, z, cy - sag));
        if (cz !== null) cable(x0 + 1.6, cy, cz, x1 - 1.6, cy - 0.05, cz, sag, 10, 0.018);
      }
    }
    if (!room.outdoor) {
      const chy = ceilLimit(room, y + (room.id === 'factory' ? 6.1 : 3.5), 0.3);
      for (let i = 0; i < 2; i++) {
        // A chain hangs, so both its anchor and its free end have to be clear.
        for (let attempt = 0; attempt < 8; attempt++) {
          const cx = R(x0 + 2, x1 - 2), cz = R(z0 + 2, z1 - 2), len = R(0.7, 1.8);
          if (inWalkway(cx, cz, chy) || inWalkway(cx, cz, chy - len)) continue;
          chain(cx, chy, cz, len);
          break;
        }
      }
    }

    // ---- floor drains + oil stains ----
    if (!room.outdoor && rnd() < 0.8) {
      const dnx = R(x0 + 2.5, x1 - 2.5), dnz = R(z0 + 2.5, z1 - 2.5);
      // A floor grate is flat, but it still cannot be let onto a stair tread.
      if (walkwayFree(dnx, dnz, 0.4)) drain(dnx, y, dnz);
    }
  }

  // ---- courtyard hero dressing: a wrecked truck chassis and a barricade ----
  {
    const cx = -11.5, cz = -37, cy = 0;
    place('metal', G.box, cx, cy + 0.95, cz, 0, 0.38, 0, 2.1, 0.7, 4.4);       // bed
    place('metal', G.box, cx + 0.55, cy + 1.5, cz - 1.6, 0, 0.38, 0, 1.9, 1.3, 1.5); // cab
    place('dark', G.box, cx + 0.55, cy + 1.75, cz - 2.28, 0, 0.38, 0, 1.5, 0.7, 0.08); // windscreen frame
    for (const [ox, oz] of [[-0.85, 1.5], [0.85, 1.5], [-0.85, -1.4], [0.85, -1.4]]) {
      place('rubber', G.cyl12,
        cx + ox * Math.cos(0.38) - oz * Math.sin(0.38), cy + 0.42, cz + ox * Math.sin(0.38) + oz * Math.cos(0.38),
        0, 0.38, Math.PI / 2, 0.84, 0.32, 0.84);
    }
    rubble(cx + 2.4, cy, cz + 1.2, 1.6, 16);
    sandbags(cx + 3.6, cy, cz - 2.2, 3.2, 0.38, 3);
    solid(cx, cz, 1.6, 2.6, 2.1, cy);              // truck body
    solid(cx + 3.6, cz - 2.2, 1.5, 0.3, 0.7, cy);  // barricade
  }

  // ---- factory hero dressing: overhead crane rail + gantry ----
  {
    const fy = 5.6;
    // The rail runs along the hall, clear of the catwalk deck (z -53.1..-50.9).
    ibeam(0, fy, -54, 15, Math.PI / 2, 0.36, 0.5);
    for (const bz of [-60.5, -47.5]) {
      place('plate', G.box, 0, fy - 1.6, bz, 0, 0, 0, 0.34, 3.2, 0.34);
    }
    // Crane trolley + hook block. This used to sit at z = -52 with the hook at
    // y = 2.25 — which is exactly the catwalk's deck height, so the hook block
    // hung in the middle of the walkway and players ran into it. It now hangs
    // over open floor well north of the catwalk, and the hook stops at 3.4m so
    // it cannot reach head height on any walkable surface.
    place('plate', G.box, 0, fy - 0.55, -58.5, 0, 0, 0, 1.1, 0.7, 1.5);
    chain(0, fy - 0.9, -58.5, 1.4);
    place('metal', G.box, 0, fy - 2.5, -58.5, 0, 0.3, 0, 0.34, 0.5, 0.34);
  }

  // ---- generator room hero: the generator itself, humming ----
  {
    // This used to be hard-coded at (-38, -13) — which is Teleporter A's pad,
    // so the generator was built straight through the teleporter and its
    // controls. Hero props are positioned by hand and therefore skip the
    // wall-hugging placer, which means they also skip its keep-clear test: the
    // one check that would have caught it.
    //
    // So pick from candidate anchors along the room's walls and take the first
    // that is actually clear. A hero prop is scenery — if the room genuinely
    // has no room for it, dropping it is strictly better than building it
    // through something the player needs to use.
    const anchor = [
      [-42.4, -18.4], [-42.4, -8.2], [-34.6, -18.4], [-42.4, -13.0], [-38.0, -18.6],
    ].find(([cx, cz]) => isClear(cx, cz, 1.8));
    if (anchor) {
      const [gx, gz] = anchor;
      machine(gx, 0, gz, Math.PI / 2, 2.6, 1.9, 1.5);
      solid(gx, gz, 0.85, 1.45, 2.1, 0);
      pipeRun(gx + 1.4, 1.4, gz - 2.4, gx + 1.4, gz + 2.4, 0.11);
    }
    const gx = anchor ? anchor[0] : -38, gz = anchor ? anchor[1] : -13;
    for (let i = 0; i < 3; i++) {
      const dx2 = gx + R(-2.6, 2.6), dz2 = gz + R(-3, 3);
      if (!isClear(dx2, dz2, 1.2)) continue;
      // These three are scattered freehand rather than through `alongWalls`, so
      // they need the same test: two drums in one spot put both pairs of
      // rolling hoops in the same two planes.
      if (!propFree(dx2, dz2, 0)) continue;
      drum(dx2, 0, dz2, R(Math.PI * 2), false);
      solid(dx2, dz2, 0.31, 0.31, 0.9, 0);
    }
  }

  // =========================================================================
  // merge + attach
  // =========================================================================
  const bucketMat = {
    metal: M.metal, wood: M.wood, plate: M.plate, concrete: M.concrete,
    dark: M.dark, brick: M.brick,
    rubber: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.95, metalness: 0.0 }),
    canvas: new THREE.MeshStandardMaterial({ color: 0x5c5747, roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide }),
    emissive: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffaa44, emissiveIntensity: 1 }),
  };
  let propTris = 0;
  for (const [key, geos] of Object.entries(buckets)) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    propTris += merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
    const mesh = new THREE.Mesh(merged, bucketMat[key]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `props_${key}`;
    group.add(mesh);
  }

  function update(dt, time, powerOn) {
    for (const l of lights) {
      l.t += dt;
      let target = powerOn ? l.on : l.off;
      if (l.emergency) target = powerOn ? l.on : l.off; // brighter while mains are dead
      if (l.broken) target = 0;
      else if (l.flicker) {
        // Two detuned sines beat against each other: irregular, never periodic.
        const n = Math.sin(l.t * 23.3 + l.t * 0.7) + Math.sin(l.t * 7.1) + Math.sin(l.t * 51.7) * 0.4;
        if (l.fluoro) { if (n > 0.9) target *= 0.12; else if (n > 0.55) target *= 0.72; }
        else if (n > 1.25) target *= 0.18;
      }
      l.light.intensity += (target - l.light.intensity) * Math.min(1, dt * 12);
      const lit = l.light.intensity / Math.max(1, l.on);
      l.mat.emissiveIntensity = 0.12 + lit * (l.emergency ? 2.6 : 2.2);
    }
    for (const a of animated) {
      a.t += dt;
      if (a.kind === 'gauge') a.mat.emissiveIntensity = 0.55 + Math.sin(a.t * 2.3) * 0.28 + (Math.sin(a.t * 11) > 0.9 ? 0.5 : 0);
    }
  }

  return { update, lights, propTris };
}

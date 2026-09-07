// The hellhound, as an actual animal.
//
// The previous hound was ~91 loose meshes stacked into a flat group: a slab
// chest, a jaw and a tail that were never parented to anything and so floated
// clear of the body the moment the pose function touched them, and sixteen
// orange boxes pasted on the flanks that read as painted-on panels. It cost 728
// draw calls for a pack of eight and still looked like a crate with ears.
//
// This rebuilds it around three ideas:
//
//  1. SILHOUETTE FIRST. The torso is a single swept tube through a table of
//     elliptical stations, so the animal has a real profile — high withers, a
//     deep narrow brisket, a hard abdominal tuck, a topline that falls away to
//     low haunches. That shape is what makes a hellhound read at twenty metres
//     in the dark, and no amount of surface detail substitutes for it.
//
//  2. ONE MESH PER BONE. Everything that rides a given bone — hide, ember
//     fissures, exposed bone, fur — is merged into a single geometry with one
//     material group per surface. A hound is ~14 meshes instead of ~91, and
//     because the geometry is built once per variant and SHARED, a pack of
//     eight allocates nothing but the Mesh wrappers.
//
//  3. NOTHING FIGHTS THE POSE. Every part is parented to the bone group that
//     applyHellhoundPose() drives, so attachments inherit the gait, the head
//     sway and the tail whip for free. This file writes no transform per frame.
//
// Coordinate frame: +X is the nose, +Y is up, +Z is the animal's left. Metres.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';
import { enhanceCreatureMaterial } from './CreatureShading.js';

/** Distinct builds, so a pack of eight never reads as one model duplicated. */
export const HOUND_VARIANTS = 5;

// ---------------------------------------------------------------------------
// materials — shared by every hound in the process
// ---------------------------------------------------------------------------
let _mats = null;
export function houndMaterials() {
  if (_mats) return _mats;
  // Charcoal, not black — and remember that enhanceCreatureMaterial MULTIPLIES
  // this by its tint pair. The old hound set both the colour and the tints near
  // black, so the product was effectively zero: every value you could see on
  // the animal came from the additive rim, which is exactly why a pack read as
  // eight identical flat orange cut-outs with no form. Keep the tints close to
  // neutral and let this colour be the charcoal.
  const hide = new THREE.MeshStandardMaterial({ color: 0x3d332c, roughness: 0.95, metalness: 0.0 });
  // Ember channels sit above the bloom threshold so they bleed light in the
  // HDR stack — but only just. Pushed harder they clip to flat yellow and stop
  // reading as heat inside a body.
  const ember = new THREE.MeshStandardMaterial({
    color: 0x2a0c04, emissive: 0xff4a12, emissiveIntensity: 4.2,
    roughness: 0.7, toneMapped: false,
  });
  // Hotter and much smaller than the fissures: the eyes and the back of the
  // throat are the two things a player tracks across a dark room.
  const eye = new THREE.MeshStandardMaterial({
    color: 0x140200, emissive: 0xffb43a, emissiveIntensity: 5.5, toneMapped: false,
  });
  const gullet = new THREE.MeshStandardMaterial({
    color: 0x2a0a02, emissive: 0xff5a10, emissiveIntensity: 2.6, toneMapped: false,
  });
  // Scorched bone: ribs, vertebrae, fangs, claws. Dirty and warm, never white —
  // bright bone on a black animal reads as beads glued to the spine.
  const bone = new THREE.MeshStandardMaterial({ color: 0x776b57, roughness: 0.6, metalness: 0.0 });

  // The hounds are lit by what is burning inside them, so their rim is ember
  // coloured rather than the moon-blue the zombies use.
  //
  // The rim is added AFTER tone mapping, so its strength is in display units:
  // the old 1.9 clipped the whole animal to white under any nearby light and
  // was the reason a pack read as pale blobs. Kept low enough that it only
  // catches the silhouette edge.
  enhanceCreatureMaterial(hide, {
    rimColor: 0xff7a2c, rimStrength: 0.22, rimPower: 3.4,
    wrap: 0.45, sssColor: 0xff3a08, sssStrength: 0.15,
    fleshScale: 13.0, fleshAmount: 0.55, grime: 0.7, wet: 0.08,
    tintA: 0xc9c1b8, tintB: 0x9a938b, tintMix: 0.45,
  });
  enhanceCreatureMaterial(bone, {
    rimColor: 0xffa060, rimStrength: 0.2, rimPower: 3.6,
    wrap: 0.35, sssColor: 0xff5a20, sssStrength: 0.1,
    fleshScale: 9.0, fleshAmount: 0.5, grime: 0.75, wet: 0.06,
    tintA: 0xd6cec2, tintB: 0xa79f93, tintMix: 0.5,
  });
  _mats = { hide, ember, eye, gullet, bone };
  return _mats;
}

/** Material slot order used by every merged geometry in this file. */
const SLOTS = ['hide', 'ember', 'bone', 'eye', 'gullet'];

// ---------------------------------------------------------------------------
// deterministic RNG — a given variant index always builds the same hound
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// the body, as a table of elliptical stations along the spine
// ---------------------------------------------------------------------------
// [x, centreY, verticalHalf, lateralHalf]
//
// Read the third and fourth columns together: vertical half-height is always
// well over lateral half-width, which is what makes the animal slab-sided and
// deep-chested rather than tubular. The topline peaks at the withers (station
// 2) and falls away to the rump; the belly line plunges to the brisket at
// station 3 and then climbs 0.10 m into the tuck at station 6.
const BODY = [
  [0.560, 0.855, 0.098, 0.084],   // 0 base of the neck
  [0.430, 0.845, 0.148, 0.114],   // 1
  [0.300, 0.826, 0.190, 0.146],   // 2 withers / shoulder
  [0.160, 0.800, 0.212, 0.160],   // 3 deepest chest — brisket at 0.588
  [0.030, 0.796, 0.190, 0.147],   // 4 last true rib
  [-0.090, 0.802, 0.134, 0.107],  // 5 the tuck begins
  [-0.200, 0.798, 0.099, 0.092],  // 6 waist — belly at 0.699
  [-0.310, 0.762, 0.135, 0.126],  // 7 loin
  [-0.430, 0.706, 0.174, 0.164],  // 8 haunch
  [-0.560, 0.692, 0.148, 0.140],  // 9
  [-0.665, 0.706, 0.078, 0.073],  // 10 rump / tail root
];

/** Interpolate the station table at a continuous index. */
function bodyAt(u) {
  const t = Math.max(0, Math.min(BODY.length - 1, u));
  const i = Math.min(BODY.length - 2, Math.floor(t));
  const f = t - i;
  const a = BODY[i], b = BODY[i + 1];
  return {
    x: a[0] + (b[0] - a[0]) * f,
    y: a[1] + (b[1] - a[1]) * f,
    ry: a[2] + (b[2] - a[2]) * f,
    rz: a[3] + (b[3] - a[3]) * f,
  };
}

/**
 * A point on the body surface.
 * @param {number} u station index (see BODY)
 * @param {number} a angle: 0 = spine, PI = belly, PI/2 = the animal's left
 * @param {number} out how far proud of the hide, in metres
 */
function bodySurface(u, a, out = 0) {
  const s = bodyAt(u);
  // Squash the cross-section toward a rounded-off wedge: a real rib cage is
  // flatter on the flank and keeled underneath, not a clean ellipse.
  const ca = Math.cos(a), sa = Math.sin(a);
  const keel = 1 - 0.16 * Math.max(0, -ca);
  return new THREE.Vector3(
    s.x,
    s.y + ca * (s.ry + out) * keel,
    sa * (s.rz + out) * (1 + 0.12 * Math.max(0, ca)),
  );
}

// ---------------------------------------------------------------------------
// primitive builders
// ---------------------------------------------------------------------------

/** Swept tube through the station table, capped at both ends. */
function bodyTube(sides = 12, u0 = 0, u1 = BODY.length - 1, steps = 22, jitter = null) {
  const pos = [], idx = [];
  const rings = steps + 1;
  for (let i = 0; i < rings; i++) {
    const u = u0 + (u1 - u0) * (i / steps);
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const p = bodySurface(u, a, jitter ? jitter(u, a) : 0);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < sides; j++) {
      const j2 = (j + 1) % sides;
      const a = i * sides + j, b = i * sides + j2;
      const c = (i + 1) * sides + j, d = (i + 1) * sides + j2;
      idx.push(a, c, d, a, d, b);
    }
  }
  // Caps: a single fan to the axis point at each end.
  const capAt = (u, ring, flip) => {
    const s = bodyAt(u);
    const centre = pos.length / 3;
    pos.push(s.x, s.y, 0);
    for (let j = 0; j < sides; j++) {
      const j2 = (j + 1) % sides;
      if (flip) idx.push(centre, ring + j2, ring + j);
      else idx.push(centre, ring + j, ring + j2);
    }
  };
  capAt(u0, 0, true);
  capAt(u1, steps * sides, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A tapered cone-ish spike along +Y, origin at its base.
 * Used for every fur tuft, hackle, ear and fang in the model.
 */
function spike(len, r0, r1 = 0, sides = 4) {
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, r1 <= 0.0001);
  g.translate(0, len / 2, 0);
  return g;
}

/** A tapered limb segment along -Y, origin at the joint. */
function limb(len, rTop, rBot, depthTop, depthBot, sides = 6) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, sides, 1);
  g.scale(1, 1, 1);
  g.translate(0, -len / 2, 0);
  // Fore-aft depth: a thigh is a blade, not a dowel.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (-p.getY(i)) / len;         // 0 at the joint, 1 at the far end
    const d = depthTop + (depthBot - depthTop) * Math.min(1, Math.max(0, t));
    p.setX(i, p.getX(i) * d);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A ribbon that follows a list of points — the shape a crack in a burnt hide
 * actually has. Tapers to nothing at both ends so it never reads as a decal
 * with hard corners.
 */
function ribbon(points, width, up = new THREE.Vector3(0, 1, 0), normals = null) {
  const n = points.length;
  if (n < 2) return null;
  const pos = [], idx = [];
  const dir = new THREE.Vector3(), side = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    dir.copy(b).sub(a).normalize();
    // Widening across the SURFACE normal is what keeps a crack lying in the
    // hide. Widening across world up leaves it standing off the body as a
    // blade whenever the body curves away, which is exactly how the first
    // pass grew 30 cm orange shards off the shoulder.
    side.copy(dir).cross(normals ? normals[i] : up);
    if (side.lengthSq() < 1e-8) side.set(0, 0, 1); else side.normalize();
    if (!Number.isFinite(side.x)) side.set(0, 0, 1);
    const t = i / (n - 1);
    const w = width * Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) ** 0.55;
    pos.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
    pos.push(p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, c, d, a, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function placed(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  geo.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  ));
  return geo;
}

/**
 * Merge a {slot: [geometry, ...]} bag into ONE geometry with one material
 * group per slot, plus the matching material list. This is where the draw-call
 * saving comes from: everything riding a bone becomes a single object.
 */
function pack(bag) {
  const keys = SLOTS.filter((k) => bag[k]?.length);
  if (!keys.length) return null;
  const per = keys.map((k) => {
    // Position and normal only. The creature shader samples its detail
    // triplanarly in world space, so nothing here needs UVs — and mixing
    // UV'd primitives with hand-built geometry is what makes a merge fail.
    for (const g of bag[k]) {
      g.deleteAttribute('uv');
      g.deleteAttribute('uv1');
      g.deleteAttribute('uv2');
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.index) {
        const n = g.attributes.position.count;
        g.setIndex(Array.from({ length: n }, (_, i) => i));
      }
    }
    const merged = mergeGeometries(bag[k], false);
    for (const g of bag[k]) g.dispose();
    return merged;
  }).filter(Boolean);
  if (!per.length) return null;
  if (per.length === 1) return { geo: per[0], slots: [keys[0]] };
  const merged = mergeGeometries(per, true);
  for (const g of per) g.dispose();
  return merged ? { geo: merged, slots: keys } : null;
}

// ---------------------------------------------------------------------------
// variant construction (once per process, shared by every hound)
// ---------------------------------------------------------------------------

/** The outward surface normal at a point on the body, near enough. */
function bodyNormal(u, a) {
  const p = bodySurface(u, a, 0), q = bodySurface(u, a, 0.01);
  return q.sub(p).normalize();
}

/** Ember fissures crawling over the hide, following the body's own surface. */
function emberFissures(bag, rnd, count) {
  for (let i = 0; i < count; i++) {
    const side = rnd() < 0.5 ? 1 : -1;
    // Keep them off the exact spine and exact belly: cracks run along the
    // flanks and around the shoulder/haunch masses where the hide is stretched.
    let a = side * (0.35 + rnd() * 1.9);
    let u = 0.6 + rnd() * 8.6;
    const steps = 2 + Math.floor(rnd() * 3);
    const du = (rnd() - 0.5) * 0.5 - 0.12;
    const da = (rnd() - 0.5) * 0.34;
    const pts = [], nrm = [];
    for (let s = 0; s <= steps; s++) {
      pts.push(bodySurface(u, a, 0.0025));
      nrm.push(bodyNormal(u, a));
      u = Math.max(0.15, Math.min(9.85, u + du));
      a += da + (rnd() - 0.5) * 0.14;
    }
    const g = ribbon(pts, 0.007 + rnd() * 0.008, null, nrm);
    if (g) bag.ember.push(g);
  }
}

/**
 * A raised mane of charred hackles.
 *
 * Each clump is a FLATTENED spike swept hard backwards. Round spikes standing
 * upright is what turned the first pass into a stegosaur; a wolf's raised
 * hackles are wide flat sheaves of hair lying along the neck.
 */
function hackles(bag, rnd, u0, u1, n, len0, len1) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const u = u0 + (u1 - u0) * t;
    const lean = 0.95 + t * 0.45 + rnd() * 0.25;
    for (const off of [-1, 0, 1]) {
      if (off !== 0 && rnd() < 0.3) continue;
      const a = off * (0.30 + rnd() * 0.16);
      const p = bodySurface(u, a, -0.012);
      const len = (len0 + (len1 - len0) * t) * (0.75 + rnd() * 0.5);
      const s = spike(len, 0.026 + rnd() * 0.010, 0.004, 4);
      s.scale(1, 1, 0.6);                  // a sheaf of hair, not a razor blade
      bag.hide.push(placed(s, p.x, p.y, p.z, a * 0.85, 0, lean));
    }
  }
}

/** Loose fur: short flat tufts breaking the silhouette along a run of the body. */
function fur(bag, rnd, u0, u1, aMin, aMax, n, len) {
  for (let i = 0; i < n; i++) {
    const u = u0 + (u1 - u0) * rnd();
    const a = (rnd() < 0.5 ? 1 : -1) * (aMin + rnd() * (aMax - aMin));
    const p = bodySurface(u, a, -0.014);
    const s = spike(len * (0.6 + rnd() * 0.8), 0.019 + rnd() * 0.010, 0.003, 4);
    s.scale(1, 1, 0.65);
    bag.hide.push(placed(s, p.x, p.y, p.z, a, 0, 1.5 + rnd() * 0.6));
  }
}

function buildTorso(rnd) {
  const bag = { hide: [], ember: [], bone: [] };
  // The animal itself.
  bag.hide.push(bodyTube(13, 0, BODY.length - 1, 24, (u, a) =>
    // Break the sweep so it does not read as a machined solid: a shallow
    // rib corrugation over the chest and a little noise everywhere else.
    (u > 1.4 && u < 4.6 ? Math.cos(u * 6.2) * 0.008 * Math.abs(Math.sin(a)) : 0)
    + Math.sin(u * 9.1 + a * 3.0) * 0.004));

  // ---- exposed spine: vertebral knobs along the topline --------------------
  // Small and irregular. Big regular ones read as a string of beads glued on.
  for (let i = 0; i <= 15; i++) {
    const u = 1.4 + (BODY.length - 2.2) * (i / 15);
    const p = bodySurface(u, 0, -0.014);
    const s = 0.011 + 0.009 * Math.sin((i / 15) * Math.PI) + rnd() * 0.003;
    bag.bone.push(placed(new THREE.BoxGeometry(0.026, s * 2.0, s * 1.5),
      p.x, p.y + s * 0.5, p.z, 0, 0, -0.12));
  }

  // ---- exposed ribs on one flank ------------------------------------------
  // The hide has burnt away over the rib cage on one side. Arcs are struck on
  // the body's own cross-section, so they hug the animal instead of hovering,
  // and a glowing gap is laid between each pair so they read as a hole rather
  // than as bones stuck onto intact skin.
  const ribSide = rnd() < 0.5 ? 1 : -1;
  const ribCount = 4 + Math.floor(rnd() * 2);
  const ribU0 = 1.7 + rnd() * 0.3;
  for (let r = 0; r < ribCount; r++) {
    const u = ribU0 + r * 0.58;
    const pts = [], nrm = [];
    for (let k = 0; k <= 8; k++) {
      const a = ribSide * (0.34 + (k / 8) * 2.05);
      pts.push(bodySurface(u, a, 0.012));
      nrm.push(bodyNormal(u, a));
    }
    const g = ribbon(pts, 0.013, null, nrm);
    if (g) bag.bone.push(g);
    if (r < ribCount - 1) {
      const gap = [], gn = [];
      for (let k = 0; k <= 6; k++) {
        const a = ribSide * (0.5 + (k / 6) * 1.7);
        gap.push(bodySurface(u + 0.29, a, 0.004));
        gn.push(bodyNormal(u + 0.29, a));
      }
      const e = ribbon(gap, 0.010, null, gn);
      if (e) bag.ember.push(e);
    }
  }

  emberFissures(bag, rnd, 30);
  // Mane: heavy over the neck and withers, thinning out by the mid-back.
  hackles(bag, rnd, 0.1, 4.4, 9, 0.15, 0.05);
  // Shoulder ruff and haunch feathering: the two places a wolf carries bulk.
  fur(bag, rnd, 0.3, 2.4, 0.7, 2.2, 13, 0.085);
  fur(bag, rnd, 7.2, 9.6, 0.6, 2.3, 11, 0.08);
  // A few tufts hanging off the belly line.
  fur(bag, rnd, 3.2, 6.2, 2.5, 3.05, 6, 0.06);
  return pack(bag);
}

function buildNeck(rnd) {
  const bag = { hide: [], ember: [], bone: [] };
  // Neck runs from the withers up and forward to the skull base. Thick at the
  // root, and deeper than it is wide, like the rest of the animal.
  const L = 0.34;
  const pos = [], idx = [];
  const sides = 10, steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = t * 0.29, cy = t * 0.155;
    const ry = 0.125 - t * 0.048, rz = 0.098 - t * 0.036;
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      pos.push(cx - Math.cos(a) * ry * 0.30, cy + Math.cos(a) * ry, Math.sin(a) * rz);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < sides; j++) {
      const j2 = (j + 1) % sides;
      idx.push(i * sides + j, (i + 1) * sides + j, (i + 1) * sides + j2);
      idx.push(i * sides + j, (i + 1) * sides + j2, i * sides + j2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  bag.hide.push(g);

  // Ruff: the heavy collar of fur a wolf carries at the throat and jaw line.
  // Flattened sheaves swept back, densest low on the throat.
  for (let i = 0; i < 18; i++) {
    const t = 0.12 + (i % 6) / 6 * 0.6;
    const a = (i / 18) * Math.PI * 2 + (rnd() - 0.5) * 0.35;
    const ry = 0.125 - t * 0.048, rz = 0.098 - t * 0.036;
    const x = t * 0.29 - Math.cos(a) * ry * 0.30, y = t * 0.155 + Math.cos(a) * ry, z = Math.sin(a) * rz;
    const s = spike(0.065 + rnd() * 0.05, 0.026, 0.004, 4);
    s.scale(1, 1, 0.6);
    bag.hide.push(placed(s, x, y, z, a * 0.8, 0, 1.75 + rnd() * 0.4));
  }
  // Two ember lines running up the throat toward the jaw.
  for (const sgn of [1, -1]) {
    const pts = [], nrm = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const a = Math.PI + sgn * (0.4 + t * 0.35);
      const ry = 0.125 - t * 0.048, rz = 0.098 - t * 0.036;
      const at = (o) => new THREE.Vector3(
        t * 0.29 - Math.cos(a) * (ry + o) * 0.30,
        t * 0.155 + Math.cos(a) * (ry + o),
        Math.sin(a) * (rz + o),
      );
      pts.push(at(0.002));
      nrm.push(at(0.012).sub(at(0.002)).normalize());
    }
    const r = ribbon(pts, 0.007, null, nrm);
    if (r) bag.ember.push(r);
  }
  return pack(bag);
}

// Muzzle profile, shared by the skull and the teeth that hang off it so they
// can never drift apart. `t` runs 0 at the stop to 1 at the nose.
const MUZ_X0 = 0.045, MUZ_LEN = 0.205;
function muzzleAt(t) {
  return {
    x: MUZ_X0 + t * MUZ_LEN,
    y: 0.004 - t * 0.040,
    ry: 0.070 - t * 0.026,
    rz: 0.066 - t * 0.030,
  };
}

function buildHead(rnd) {
  const bag = { hide: [], bone: [], eye: [], ember: [], gullet: [] };
  // ---- braincase -----------------------------------------------------------
  // A heavy wedge: broad and tall at the back, narrowing hard into the muzzle,
  // with the sides drawn in above the cheeks so the skull has real planes.
  const skull = new THREE.BoxGeometry(0.19, 0.150, 0.172, 3, 3, 3);
  {
    const p = skull.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const t = (x + 0.095) / 0.19;                   // 0 at the back, 1 at the front
      const narrow = 1 - t * 0.36;
      p.setY(i, y * (1 - t * 0.26) - t * 0.014);
      // Taper the top of the skull inward — the cranium is a dome on a wedge.
      p.setZ(i, z * narrow * (y > 0.03 ? 0.74 : 1.0));
      p.setX(i, x - Math.abs(y) * 0.09 - Math.abs(z) * 0.10);
    }
    skull.computeVertexNormals();
  }
  bag.hide.push(placed(skull, -0.048, 0.006, 0));

  // Sagittal crest and occiput: the bony ridge a big dog's jaw muscles anchor
  // to, and the knob at the back of the head.
  bag.bone.push(placed(new THREE.BoxGeometry(0.10, 0.030, 0.022), -0.085, 0.078, 0, 0, 0, -0.08));
  bag.bone.push(placed(new THREE.SphereGeometry(0.030, 6, 5), -0.140, 0.045, 0, 0, 0, 0, 0.7, 1.1, 0.9));
  // Cheek / masseter masses, low and wide.
  for (const sgn of [1, -1]) {
    bag.hide.push(placed(new THREE.SphereGeometry(0.058, 6, 5),
      -0.052, -0.030, sgn * 0.058, 0, 0, 0.15, 1.2, 0.9, 0.62));
  }
  // ---- brow ridge ----------------------------------------------------------
  // The single most important feature on the head: it shades the eyes and gives
  // the skull the heavy, scowling read a hellhound needs.
  for (const sgn of [1, -1]) {
    bag.hide.push(placed(new THREE.SphereGeometry(0.040, 6, 5),
      0.014, 0.046, sgn * 0.050, 0, 0, -0.28, 1.5, 0.55, 0.9));
  }
  bag.hide.push(placed(new THREE.BoxGeometry(0.055, 0.024, 0.082), 0.008, 0.050, 0, 0, 0, -0.26));

  // ---- muzzle --------------------------------------------------------------
  {
    const pos = [], idx = [];
    const sides = 8, steps = 4;
    for (let i = 0; i <= steps; i++) {
      const m = muzzleAt(i / steps);
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        const c = Math.cos(a);
        // Flatten the bridge and square off the sides: a dog's muzzle is a
        // box with rounded corners, not a cone.
        pos.push(m.x, m.y + c * m.ry * (c > 0 ? 0.72 : 1.0), Math.sin(a) * m.rz * (1 + 0.18 * Math.abs(Math.sin(a))));
      }
    }
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < sides; j++) {
        const j2 = (j + 1) % sides;
        idx.push(i * sides + j, (i + 1) * sides + j, (i + 1) * sides + j2);
        idx.push(i * sides + j, (i + 1) * sides + j2, i * sides + j2);
      }
    }
    const nose = muzzleAt(1);
    const c = pos.length / 3;
    pos.push(nose.x + 0.012, nose.y, 0);
    for (let j = 0; j < sides; j++) idx.push(c, steps * sides + j, steps * sides + (j + 1) % sides);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    bag.hide.push(g);
    // Nose leather, wide and blunt.
    bag.hide.push(placed(new THREE.SphereGeometry(0.030, 6, 5),
      nose.x + 0.004, nose.y + 0.006, 0, 0, 0, 0, 0.75, 0.95, 1.15));
  }

  // ---- eyes ----------------------------------------------------------------
  // Small, deep-set and hot. Size is what keeps them from reading as headlights:
  // two sparks under the brow, not two lamps. The orbit around them is scorched
  // rather than glowing, so the eye itself is the only bright thing.
  for (const sgn of [1, -1]) {
    bag.eye.push(placed(new THREE.SphereGeometry(0.0155, 6, 5),
      0.026, 0.018, sgn * 0.050, 0, 0, 0, 1.1, 0.78, 0.95));
    bag.ember.push(placed(new THREE.TorusGeometry(0.021, 0.0042, 4, 7),
      0.022, 0.018, sgn * 0.050, 0, Math.PI / 2, 0));
  }

  // ---- ears ----------------------------------------------------------------
  // Broad triangles pinned back along the skull, not horns: wide at the base,
  // flattened, and swept until they nearly lie on the neck. One is often torn.
  for (const sgn of [1, -1]) {
    const torn = rnd() < 0.45;
    const len = torn ? 0.075 : 0.115;
    const e = spike(len, 0.050, 0.008, 4);
    e.scale(1.1, 1, 0.5);
    bag.hide.push(placed(e, -0.082, 0.066, sgn * 0.050, sgn * 0.42, 0, -0.52 - rnd() * 0.14));
  }

  // ---- upper teeth ---------------------------------------------------------
  // Struck off the muzzle profile so they always sit on the gum line.
  for (const sgn of [1, -1]) {
    for (const [t, fl] of [[0.16, 0.038], [0.42, 0.020], [0.63, 0.016], [0.83, 0.013]]) {
      const m = muzzleAt(t);
      bag.bone.push(placed(spike(fl, 0.0095, 0.0, 4),
        m.x, m.y - m.ry * 0.88, sgn * m.rz * 0.72, 0, 0, Math.PI + sgn * 0.05));
    }
  }
  // ---- the furnace at the back of the throat -------------------------------
  // Attached to the SKULL, not the jaw, so opening the mouth reveals it. Kept
  // small and tucked behind the tooth line: a glow deep in the gullet, never a
  // lamp bolted to the side of the face.
  bag.gullet.push(placed(new THREE.SphereGeometry(0.024, 6, 5),
    0.030, -0.044, 0, 0, 0, 0.06, 2.0, 0.62, 0.85));

  // ---- charred detail ------------------------------------------------------
  for (let i = 0; i < 4; i++) {
    const sgn = i % 2 ? 1 : -1;
    const pts = [];
    let x = -0.10 + rnd() * 0.06, y = 0.02 + rnd() * 0.045, z = sgn * (0.045 + rnd() * 0.025);
    for (let k = 0; k < 4; k++) {
      pts.push(new THREE.Vector3(x, y, z));
      x += 0.030 + rnd() * 0.025; y -= 0.010 + rnd() * 0.016; z += sgn * (rnd() - 0.4) * 0.012;
    }
    const g = ribbon(pts, 0.0045 + rnd() * 0.003);
    if (g) bag.ember.push(g);
  }
  return pack(bag);
}

// The lower jaw, in the jaw group's own frame (hinged just behind the cheek).
const JAW_X0 = 0.032, JAW_LEN = 0.215;
function jawAt(t) {
  return {
    x: JAW_X0 + t * JAW_LEN,
    y: -0.008 - t * 0.026,
    ry: 0.034 - t * 0.015,
    rz: 0.054 - t * 0.028,
  };
}

function buildJaw(rnd) {
  const bag = { hide: [], bone: [] };
  // Lower jaw: a tapering trough hinged at the back of the skull, closing so
  // its tooth line meets the muzzle's.
  {
    const pos = [], idx = [];
    const sides = 6, steps = 4;
    for (let i = 0; i <= steps; i++) {
      const m = jawAt(i / steps);
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        pos.push(m.x, m.y + Math.cos(a) * m.ry, Math.sin(a) * m.rz);
      }
    }
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < sides; j++) {
        const j2 = (j + 1) % sides;
        idx.push(i * sides + j, (i + 1) * sides + j, (i + 1) * sides + j2);
        idx.push(i * sides + j, (i + 1) * sides + j2, i * sides + j2);
      }
    }
    const tip = jawAt(1);
    const c0 = pos.length / 3;
    pos.push(tip.x + 0.010, tip.y, 0);
    for (let j = 0; j < sides; j++) idx.push(c0, steps * sides + j, steps * sides + (j + 1) % sides);
    const root = jawAt(0);
    const c1 = pos.length / 3;
    pos.push(root.x, root.y, 0);
    for (let j = 0; j < sides; j++) idx.push(c1, (j + 1) % sides, j);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    bag.hide.push(g);
  }
  // Ramus: the vertical plate of bone the jaw muscles pull on.
  bag.hide.push(placed(new THREE.BoxGeometry(0.052, 0.070, 0.036), 0.014, 0.014, 0, 0, 0, 0.35));
  // Lower teeth, pointing up into the gap.
  for (const sgn of [1, -1]) {
    for (const [t, fl] of [[0.14, 0.032], [0.40, 0.018], [0.62, 0.015], [0.84, 0.012]]) {
      const m = jawAt(t);
      bag.bone.push(placed(spike(fl, 0.0085, 0.0, 4),
        m.x, m.y + m.ry * 0.85, sgn * m.rz * 0.72, 0, 0, sgn * 0.04));
    }
  }
  // Beard tufts under the chin.
  for (let i = 0; i < 5; i++) {
    const t = rnd();
    const m = jawAt(t);
    const s = spike(0.026 + rnd() * 0.016, 0.014, 0.002, 4);
    s.scale(1, 1, 0.7);
    bag.hide.push(placed(s, m.x, m.y - m.ry * 0.85, (rnd() - 0.5) * m.rz, 0, 0, 2.6 + rnd() * 0.5));
  }
  return pack(bag);
}

/** One tail segment. `i` selects taper; the last one carries the ember tip. */
function buildTailSeg(rnd, i, n, len) {
  const bag = { hide: [], ember: [] };
  const r0 = 0.048 - i * 0.012, r1 = 0.048 - (i + 1) * 0.012;
  const g = new THREE.CylinderGeometry(Math.max(0.009, r1), r0, len, 6, 1);
  g.rotateZ(Math.PI / 2);          // along +X, which the tail root flips to -X
  g.translate(len / 2, 0, 0);
  bag.hide.push(g);
  // Coarse brush along the tail, heaviest at the base — a wolf's tail is
  // mostly hair, and a bare rod reads as a rat's.
  for (let k = 0; k < 9; k++) {
    const t = rnd();
    const a = rnd() * Math.PI * 2;
    const r = (r0 + (r1 - r0) * t) * 0.8;
    const s = spike(0.075 + rnd() * 0.05 - i * 0.014, 0.022, 0.003, 4);
    s.scale(1, 1, 0.7);
    bag.hide.push(placed(s, len * t, Math.cos(a) * r, Math.sin(a) * r, a, 0, -1.9 - rnd() * 0.4));
  }
  if (i === n - 1) {
    // Only the tip burns, and only the tip carries the ember slot: a crack on
    // a tail link is not worth a second draw call on three meshes per hound.
    const tip = spike(0.085, 0.024, 0.002, 5);
    bag.ember.push(placed(tip, len * 0.9, 0, 0, 0, 0, -Math.PI / 2));
    const pts = [];
    for (let k = 0; k <= 3; k++) {
      const t = k / 3;
      const r = (r0 + (r1 - r0) * t) + 0.003;
      pts.push(new THREE.Vector3(len * t, Math.cos(0.6 + t) * r, Math.sin(0.6 + t) * r));
    }
    const rb = ribbon(pts, 0.006);
    if (rb) bag.ember.push(rb);
  }
  return pack(bag);
}

// ---- legs -----------------------------------------------------------------
// Long and rangy. Front and rear share geometry — the difference between them
// lives in the rig's rest angles and hip height, not in two sets of meshes.
const UPPER_LEN = 0.40;
const LOWER_LEN = 0.48;

function buildUpperLeg(rnd) {
  // Deliberately ONE slot. Every extra material slot on a leg costs four draw
  // calls per hound, and a thigh has nothing on it worth that at any distance
  // the player will ever see one from.
  const bag = { hide: [] };
  bag.hide.push(limb(UPPER_LEN, 0.082, 0.036, 1.55, 1.1, 6));
  // A little muscle belly on the front of the thigh.
  bag.hide.push(placed(new THREE.SphereGeometry(0.055, 6, 5), 0.02, -0.10, 0, 0, 0, 0, 1.15, 1.7, 0.8));
  // Feathering down the back of the leg.
  for (let i = 0; i < 5; i++) {
    const t = 0.15 + rnd() * 0.7;
    bag.hide.push(placed(spike(0.06 + rnd() * 0.04, 0.011, 0.001, 3),
      -0.03 - rnd() * 0.02, -UPPER_LEN * t, (rnd() - 0.5) * 0.05, 0, 0, 2.3 + rnd() * 0.6));
  }
  return pack(bag);
}

function buildLowerLeg(rnd) {
  const bag = { hide: [] };
  // Cannon bone: deliberately thin. The gap between a heavy thigh and a wire
  // shin is what makes an animal look fast.
  bag.hide.push(limb(LOWER_LEN * 0.86, 0.036, 0.023, 1.4, 1.05, 5));
  // Hock/pastern: the bare tendon running to the foot.
  bag.hide.push(placed(new THREE.CylinderGeometry(0.013, 0.016, LOWER_LEN * 0.30, 4),
    0.004, -LOWER_LEN * 0.86, 0, 0, 0, 0));
  for (let i = 0; i < 3; i++) {
    bag.hide.push(placed(spike(0.05 + rnd() * 0.03, 0.010, 0.001, 3),
      -0.022, -LOWER_LEN * (0.1 + rnd() * 0.4), (rnd() - 0.5) * 0.03, 0, 0, 2.4));
  }
  return pack(bag);
}

function buildPaw(rnd) {
  const bag = { hide: [], bone: [] };
  // Origin is the ground contact, so the rig's paw-plant clamp stays exact.
  bag.hide.push(placed(new THREE.SphereGeometry(0.052, 6, 5), 0.028, 0.038, 0, 0, 0, 0, 1.5, 0.7, 1.05));
  for (const off of [-0.038, 0, 0.038]) {
    const toe = off === 0 ? 0.075 : 0.062;
    bag.hide.push(placed(new THREE.SphereGeometry(0.024, 5, 4), 0.055 + toe * 0.3, 0.026, off, 0, 0, 0, 1.9, 0.85, 0.9));
    // Claws ride the HIDE slot: keratin is dark horn, and bone-white toes read
    // as socks at any distance. It also keeps a paw down to one draw call.
    bag.hide.push(placed(spike(0.038, 0.0085, 0.0, 4),
      0.055 + toe + 0.018, 0.020, off, 0, 0, -2.0 - rnd() * 0.2));
  }
  return pack(bag);
}

// ---------------------------------------------------------------------------
// the shared geometry pool
// ---------------------------------------------------------------------------
let _pool = null;
function pool() {
  if (_pool) return _pool;
  _pool = [];
  for (let v = 0; v < HOUND_VARIANTS; v++) {
    const rnd = mulberry32(0x5eed + v * 2654435761);
    _pool.push({
      torso: buildTorso(rnd),
      neck: buildNeck(rnd),
      head: buildHead(rnd),
      jaw: buildJaw(rnd),
      tail: [0, 1, 2].map((i) => buildTailSeg(rnd, i, 3, [0.19, 0.17, 0.15][i])),
      upper: buildUpperLeg(rnd),
      lower: buildLowerLeg(rnd),
      paw: buildPaw(rnd),
    });
  }
  return _pool;
}

/** Warm the geometry pool before the first dog round, off the spawn frame. */
export function prewarmHellhounds() { pool(); houndMaterials(); }

function meshFor(part, M, parent, name) {
  if (!part) return null;
  const mats = part.slots.map((k) => M[k]);
  const m = new THREE.Mesh(part.geo, mats.length === 1 ? mats[0] : mats);
  m.castShadow = true;
  m.name = name;
  parent.add(m);
  return m;
}

/**
 * Build a hellhound.
 *
 * Returns a group whose userData carries exactly the contract
 * applyHellhoundPose() and the cinematic director expect: `legs`, `legChains`,
 * `head`, `jaw`, `tail`, `body`.
 *
 * @param {number} variant which prebuilt geometry set to use
 */
export function buildHellhound(variant = Math.floor(Math.random() * HOUND_VARIANTS)) {
  const M = houndMaterials();
  const V = pool()[((variant | 0) % HOUND_VARIANTS + HOUND_VARIANTS) % HOUND_VARIANTS];
  const g = new THREE.Group();
  const detail = [];

  // ---- torso ---------------------------------------------------------------
  const body = new THREE.Group();
  body.name = 'HoundBody';
  g.add(body);
  meshFor(V.torso, M, body, 'HoundTorso');

  // ---- neck -> head -> jaw -------------------------------------------------
  const neck = new THREE.Group();
  neck.name = 'HoundNeck';
  neck.position.set(0.565, 0.855, 0);
  g.add(neck);
  meshFor(V.neck, M, neck, 'HoundNeckMesh');

  const head = new THREE.Group();
  head.name = 'HoundHead';
  head.position.set(0.295, 0.155, 0);     // lands the skull at ~(0.86, 1.01)
  neck.add(head);
  meshFor(V.head, M, head, 'HoundHeadMesh');

  const jaw = new THREE.Group();
  jaw.name = 'HoundJaw';
  jaw.position.set(-0.012, -0.058, 0);
  head.add(jaw);
  meshFor(V.jaw, M, jaw, 'HoundJawMesh');

  // ---- tail ----------------------------------------------------------------
  // rotation.y = PI points the chain backward, which means a POSITIVE
  // rotation.z on any link raises the tail — the sign the pose grammar wants.
  const tailSegs = [];
  let attach = g;
  for (let i = 0; i < V.tail.length; i++) {
    const seg = new THREE.Group();
    seg.name = `HoundTail${i}`;
    if (i === 0) seg.position.set(-0.660, 0.688, 0);
    else seg.position.set([0.19, 0.17, 0.15][i - 1], 0, 0);
    // Carried low off the croup, drooping, with a sabre flick at the tip —
    // the way a running wolf holds it, and the shape that stops the tail
    // reading as a rod continuing the topline.
    seg.userData.baseZ = [-0.30, -0.22, 0.20][i] ?? -0.2;
    seg.userData.baseY = i === 0 ? Math.PI : 0;
    seg.rotation.set(0, seg.userData.baseY, seg.userData.baseZ);
    attach.add(seg);
    meshFor(V.tail[i], M, seg, `HoundTailMesh${i}`);
    tailSegs.push(seg);
    attach = seg;
  }

  // ---- legs ----------------------------------------------------------------
  const legs = [], legChains = [];
  const LEGS = [
    [0.300, 0.775, 0.108, 1],
    [0.300, 0.775, -0.108, 1],
    [-0.415, 0.700, 0.102, 0],
    [-0.415, 0.700, -0.102, 0],
  ];
  for (const [lx, ly, lz, front] of LEGS) {
    const phase = front ? (lz > 0 ? 0 : Math.PI) : (lz > 0 ? Math.PI : 0);
    const hip = new THREE.Group(), knee = new THREE.Group(), paw = new THREE.Group();
    hip.name = `DirectorDogHip_${front ? 'F' : 'R'}_${lz > 0 ? 'L' : 'R'}`;
    knee.name = hip.name.replace('Hip', 'Knee');
    paw.name = hip.name.replace('Hip', 'Paw');
    hip.position.set(lx, ly, lz);
    knee.position.y = -UPPER_LEN;
    paw.position.y = -LOWER_LEN;
    const upper = meshFor(V.upper, M, hip, 'HoundUpper');
    const lower = meshFor(V.lower, M, knee, 'HoundLower');
    meshFor(V.paw, M, paw, 'HoundPaw');
    hip.add(knee);
    knee.add(paw);
    g.add(hip);
    // Front legs bend backward at the elbow, rear legs forward at the stifle.
    const baseUpper = front ? 0.26 : -0.34, baseLower = front ? -0.40 : 0.48;
    hip.rotation.z = baseUpper;
    knee.rotation.z = baseLower;
    legChains.push({
      hip, knee, paw, upper, lower,
      upperLen: UPPER_LEN, lowerLen: LOWER_LEN,
      phase, baseUpper, baseLower, front: !!front, side: lz > 0 ? 1 : -1,
    });
    legs.push({ mesh: hip, base: baseUpper, phase }, { mesh: knee, base: baseLower, phase: phase + 0.4 });
  }

  g.userData = {
    legs, legChains, head, jaw, neck, body,
    tail: tailSegs[0], tailSegs, detail,
    jawRestY: jaw.position.y,
    dog: true, directorRig: true, variant,
  };
  return g;
}

/**
 * Distance LOD.
 *
 * A hound is ~14 meshes, most of them casting shadows, and a dog round puts
 * eight of them on screen at once. The shadow pass is the expensive half, and
 * a hound past ~18 m contributes a shadow nobody can resolve — so the far tier
 * keeps the full silhouette (popping geometry would be far more visible than a
 * missing shadow) and drops shadow casting from everything except the torso.
 *
 * @param {THREE.Object3D} model
 * @param {number} d2 squared distance to the camera
 */
export function setHellhoundLOD(model, d2) {
  const tier = d2 < 330 ? 0 : d2 < 2000 ? 1 : 2;
  if (model.userData.lodTier === tier) return;
  model.userData.lodTier = tier;
  const u = model.userData;
  model.traverse((o) => { if (o.isMesh) o.castShadow = tier === 0; });
  if (u.body) u.body.traverse((o) => { if (o.isMesh) o.castShadow = tier < 2; });
  // Past ~45 m the last two tail links are a couple of pixels of noise.
  if (u.tailSegs) for (let i = 1; i < u.tailSegs.length; i++) u.tailSegs[i].visible = tier < 2;
}

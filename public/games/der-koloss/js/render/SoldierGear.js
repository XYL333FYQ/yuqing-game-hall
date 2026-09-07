// Uniform and field gear for the four playable marines, as seen by other
// players in co-op.
//
// WHAT THIS IS NOT: it is not a body. The shipped CC0 humanoid stays the body —
// its sculpted head, its face, its fingers, its skinned limbs. Nothing here
// replaces a limb, and nothing here is allowed to float. Every piece is a
// merged rigid shell parented to the bone it belongs to, so it inherits that
// bone's motion for free and cannot desync from the pose. That is the same
// contract as js/render/ZombieDetail.js, and for the same reason: the moment
// gear stops being a child of a bone it starts sliding off the body.
//
// The two traps that cost the most time, both inherited from ZombieDetail:
//
//  - BONE AXES ARE NOT WORLD AXES. This rig's spine leans a long way forward,
//    so a local -Y offset on the Torso travels down AND backwards. Every mount
//    below cancels its bone's rest world rotation, which lets the geometry be
//    authored in plain world-aligned metres against a standing figure.
//
//  - THE RIG IS RESCALED AROUND ATTACHMENT. SoldierVisual normalises height
//    before mounting and again after (once the oversized head has been brought
//    down to human proportion). Mounts cancel the bone's world SCALE at attach
//    time, uniformly — a component-wise inverse does not commute with the
//    rotation and shears the mesh — and the later uniform rescale then applies
//    to body and gear alike, which is exactly what should happen.
//
// Memory shape: the geometry pool is built once per persona for the whole
// process and every avatar gets cheap Meshes POINTING AT it. Four players can
// join, leave and rejoin all session without allocating a second helmet.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';

// The Head bone carries a deliberately oversized cartoon skull with ears that
// stand a long way off it. SoldierVisual reshapes it to human proportion every
// frame: down overall, and narrower still across X so the ears tuck in under
// the headgear instead of sticking out past it.
//
// HEAD_SCALE is the uniform part and HEAD_SHAPE the per-axis remainder. A
// helmet parented to the Head bone inherits both, so the mount at the bottom of
// this file cancels the bone's world scale per axis before the gear is drawn.
export const HEAD_SCALE = 0.42;
// The size head gear was authored against. Change HEAD_SCALE and the helmets
// follow, instead of floating off a head that is no longer that size.
const HEAD_REF = 0.64;
export const HEAD_SHAPE = [0.86, 1.0, 0.94];   // multiplies HEAD_SCALE, per axis

// Limb slimming. X/Z only: the joints sit along Y, so touching Y would move
// the knees and elbows away from the sculpted mesh and off the foot IK bones,
// which are parented to the root rather than to the shins.
// The shipped hands are cartoon-huge — a fist as wide as the skull. Scaling
// the finger ROOTS shrinks every joint below them, which brings the hand back
// to something that can plausibly hold a rifle grip. The palm rides on the
// forearm bone and is slimmed with it.
export const HAND_SCALE = 0.58;

// The sculpted feet are cartoon-huge too. They carry no child bones, so unlike
// the rest of the limbs they can be scaled outright without shearing anything
// below them.
export const FOOT_SCALE = 0.74;

export const LIMB_SHAPE = {
  // The shipped torso is a barrel — nearly as deep as it is wide, and half
  // again too broad for a 1.78 m man. Narrowing it across X and Z does shear
  // the arm chain slightly, because the shoulders are rotated children of the
  // chest, but at this little anisotropy it is invisible and the silhouette
  // gain is the difference between a soldier and a beer keg.
  Hips: [0.84, 1, 0.88], Abdomen: [0.82, 1, 0.86], Torso: [0.80, 1, 0.84],
  UpperArmL: [0.90, 1, 0.90], UpperArmR: [0.90, 1, 0.90],
  LowerArmL: [0.88, 1, 0.88], LowerArmR: [0.88, 1, 0.88],
  UpperLegL: [0.92, 1, 0.92], UpperLegR: [0.92, 1, 0.92],
  LowerLegL: [0.92, 1, 0.92], LowerLegR: [0.92, 1, 0.92],
};

// Corrective rotations applied to the spine every frame, in radians about each
// bone's own X axis (which is the world X axis at rest for all five).
//
// These are large on purpose. The shipped rig is a shambling corpse: measured
// at rest, its chest bone leans 70 degrees forward and its neck another 65, so
// the head hangs out in front of the knees. A soldier stands up. Undoing that
// swings the shoulders back with the chest, which is exactly why the rifle
// carry pose in player.js is solved by IK AFTER these are applied — the arms
// then reach for where the hands should be rather than for where the corpse
// happened to leave them.
export const SPINE_FIX = {
  Abdomen: -0.16,
  Torso: -1.00,
  Neck: -0.10,
  Head: 0.86,
};

// ---------------------------------------------------------------------------
// palettes
// ---------------------------------------------------------------------------

/**
 * One entry per playable character, in the order game.js resolves personas
 * (dempsey, nikolai, takeo, richtofen). `skin` and `hair` feed the atlas
 * recolour in player.js; everything else is worn.
 *
 * Silhouette is what reads at twenty metres, so the four differ first in
 * headgear and coat length and only then in colour.
 */
export const SOLDIER_LOOKS = [
  {
    id: 'dempsey',
    skin: 0xc79a72, hair: 0xc2a24e,           // USMC blond, high and tight
    cloth: 0x59603f, clothDark: 0x3d4430, webbing: 0x6f6b4a,
    leather: 0x33251a, hard: 0x474f3e, accent: 0x8a2f22,
    headgear: 'helmet', coat: 'short', pack: 'haversack',
    legs: 'leggings', beard: 'none', glasses: false,
    build: { chest: 1.06, waist: 1.0, arm: 1.06 },
  },
  {
    id: 'nikolai',
    skin: 0xcaa07c, hair: 0x2b1d14,
    cloth: 0x6a6142, clothDark: 0x494330, webbing: 0x6b6248,
    leather: 0x3c2c1c, hard: 0x4a4438, accent: 0xa32a20,   // the red star
    headgear: 'fieldcap_star', coat: 'quilted', pack: 'bedroll',
    legs: 'boots', beard: 'full', glasses: false,
    build: { chest: 1.16, waist: 1.14, arm: 1.12 },
  },
  {
    id: 'takeo',
    skin: 0xd0a87e, hair: 0x14100c,
    cloth: 0x8a7d55, clothDark: 0x655c3e, webbing: 0x7d7150,
    leather: 0x4e3822, hard: 0x5a5138, accent: 0x6b5a33,
    headgear: 'havelock', coat: 'tunic', pack: 'small',
    legs: 'puttees', beard: 'moustache', glasses: false,
    build: { chest: 0.94, waist: 0.93, arm: 0.94 },
  },
  {
    id: 'richtofen',
    skin: 0xd3b795, hair: 0x30231a,
    cloth: 0x353a3b, clothDark: 0x23282a, webbing: 0x2c2f30,
    leather: 0x1d1916, hard: 0x2a2e30, accent: 0x9a8548,   // spectacle wire
    headgear: 'peakcap', coat: 'long', pack: 'satchel',
    legs: 'boots', beard: 'none', glasses: true,
    build: { chest: 0.92, waist: 0.9, arm: 0.9 },
  },
];

// ---------------------------------------------------------------------------
// materials — one set per persona, shared by every avatar wearing that persona
// ---------------------------------------------------------------------------

const _matSets = new Map();
function materials(look) {
  let set = _matSets.get(look.id);
  if (set) return set;
  const std = (color, roughness, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  set = {
    cloth: std(look.cloth, 0.95),
    clothDark: std(look.clothDark, 0.93),
    webbing: std(look.webbing, 0.9),
    leather: std(look.leather, 0.62),
    hard: std(look.hard, 0.45, 0.55),
    accent: std(look.accent, 0.6, 0.25),
    hair: std(look.hair, 0.94),
  };
  _matSets.set(look.id, set);
  return set;
}

// ---------------------------------------------------------------------------
// primitive helpers — everything in metres, everything merged before it ships
// ---------------------------------------------------------------------------

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Position/rotate/scale a geometry in place and hand it back. */
function put(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  _m4.compose(
    new THREE.Vector3(x, y, z),
    _q.setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  geo.applyMatrix4(_m4);
  return geo;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** A garment tube. `flat` squashes the cross-section front-to-back — human
 *  torsos and legs are ovals, and a true circle reads as a barrel. */
function tube(rTop, rBot, h, { segs = 12, flat = 1, open = true, thetaStart = 0, thetaLength = Math.PI * 2 } = {}) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs, 1, open, thetaStart, thetaLength);
  if (flat !== 1) g.scale(1, 1, flat);
  return g;
}

/** A dome: helmets, crowns, shoulders. `phi` under PI leaves it open below. */
const dome = (r, phi = Math.PI * 0.55, segs = 14) =>
  new THREE.SphereGeometry(r, segs, Math.max(4, Math.round(segs * 0.5)), 0, Math.PI * 2, 0, phi);

/**
 * A shell spanning two WORLD points — the workhorse for sleeves, trouser legs
 * and puttees. Because each mount cancels its bone's rest rotation, "world"
 * here means the frame the geometry is authored in, so a limb shell can be
 * described by the two joints it covers and will always land on the limb.
 */
function span(from, to, rFrom, rTo, { t0 = 0, t1 = 1, flat = 1, segs = 10 } = {}) {
  const dir = _v.copy(to).sub(from);
  const len = dir.length() || 1e-4;
  dir.multiplyScalar(1 / len);
  const h = len * (t1 - t0);
  const g = tube(rTo, rFrom, h, { segs, flat, open: false });
  // Cylinders are built along +Y; rotate that onto the joint-to-joint axis.
  const quat = new THREE.Quaternion().setFromUnitVectors(_up, dir);
  const mid = new THREE.Vector3().copy(from).addScaledVector(dir, len * (t0 + t1) * 0.5);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1)));
  return g;
}

/** A strap between two world points: thin, flat, and actually touching both. */
function strap(from, to, width, thick) {
  const dir = new THREE.Vector3().copy(to).sub(from);
  const len = dir.length() || 1e-4;
  dir.multiplyScalar(1 / len);
  const g = box(width, len, thick);
  const quat = new THREE.Quaternion().setFromUnitVectors(_up, dir);
  const mid = new THREE.Vector3().copy(from).add(to).multiplyScalar(0.5);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1)));
  return g;
}

/**
 * Merge a list of `[materialKey, geometry]` into ONE geometry with one material
 * group per key, so a jacket with webbing, buttons and a pack still costs a
 * single draw call rather than four.
 */
function mergeByMaterial(parts) {
  const byKey = new Map();
  for (const [key, geo] of parts) {
    if (!geo) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(geo);
  }
  if (!byKey.size) return null;
  const keys = [...byKey.keys()];
  const merged = [];
  for (const key of keys) {
    const list = byKey.get(key);
    const one = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (list.length > 1) for (const g of list) g.dispose();
    if (!one) return null;
    merged.push(one);
  }
  if (merged.length === 1) return { geo: merged[0], mats: keys };
  const out = mergeGeometries(merged, true);
  for (const g of merged) g.dispose();
  return out ? { geo: out, mats: keys } : null;
}

// ---------------------------------------------------------------------------
// the wardrobe
// ---------------------------------------------------------------------------

/**
 * Build every piece of gear for one persona, expressed against a live
 * measurement of the rig so the numbers below stay honest if the spine
 * correction is ever retuned.
 *
 * @param {object} look   an entry of SOLDIER_LOOKS
 * @param {object} P      bone world positions, already spine-corrected
 * @returns {Map<string, {geo, mats}>} bone name -> merged gear
 */
function buildWardrobe(look, P) {
  const out = new Map();
  const B = look.build;
  const add = (bone, parts) => {
    const m = mergeByMaterial(parts.filter(Boolean));
    if (m) out.set(bone, m);
  };
  // Local frame helper: everything is authored in world metres, then expressed
  // relative to the bone it hangs from at the very end.
  const rel = (bone, geo) => { geo.translate(-P[bone].x, -P[bone].y, -P[bone].z); return geo; };

  const chestY = P.Neck.y - 0.12;                 // top of the ribcage
  const waistY = THREE.MathUtils.lerp(P.Hips.y, P.Torso.y, 0.72);
  const chestZ = (P.Torso.z + P.Neck.z) * 0.5;
  const hipZ = P.Hips.z + 0.03;

  // ---- TORSO: jacket, collar, webbing, epaulettes, pack --------------------
  {
    const p = [];
    // The garment may be bulkier than the body but never slimmer than it —
    // a lean persona multiplier that dips below the sculpted chest lets the
    // torso mesh poke through the tunic as a jagged bare patch.
    const rChest = 0.250 * Math.max(1, B.chest);
    const rWaist = 0.272 * Math.max(1, B.waist);
    const jacketH = (chestY + 0.10) - (waistY - 0.06);
    const jacketY = (chestY + 0.10 + waistY - 0.06) * 0.5;
    // The jacket itself. Slightly oval, closed at both ends so a low camera
    // never sees up inside it.
    p.push(['cloth', put(tube(rChest, rWaist, jacketH, { flat: 0.74, open: false, segs: 14 }),
      { y: jacketY, z: chestZ })]);
    // Shoulder yoke. On a field jacket — a Marine's P41 herringbone, an M1943,
    // a gymnastyorka — the yoke is a panel laid OVER the top of the body panels.
    // It stands a few millimetres proud at its seam, it runs square across the
    // shoulders, and then it slopes up into the neck. The deltoid itself is not
    // its job: the sleeve already runs up past the shoulder joint to cover that.
    //
    // What was here widened DOWNWARD, from 0.92x the chest at the neck to 1.14x
    // at its lower rim, and that rim ended in mid-air over the ribs — a flared
    // lampshade sitting on the chest. Nothing on a shoulder gets wider as it
    // goes down. The old over-scaled mount hid it; a correct mount does not.
    const rYoke = rChest * 1.03;
    p.push(['cloth', put(tube(rYoke, rYoke, 0.095, { flat: 0.76, open: false, segs: 14 }),
      { y: chestY + 0.1025, z: chestZ })]);
    p.push(['cloth', put(tube(rChest * 0.72, rYoke, 0.085, { flat: 0.78, open: false, segs: 14 }),
      { y: chestY + 0.1925, z: chestZ })]);
    // Collar. Richtofen and Nikolai wear it standing; the others fold it down.
    const collarTall = look.coat === 'long' || look.coat === 'quilted';
    p.push(['clothDark', put(tube(rChest * 0.60, rChest * 0.80, collarTall ? 0.15 : 0.09, { flat: 0.8, segs: 12 }),
      { y: chestY + (collarTall ? 0.26 : 0.23), z: chestZ + 0.01 })]);
    // Front placket and buttons — the line that tells you which way he faces.
    const frontZ = chestZ + rChest * 0.74 - 0.005;
    p.push(['clothDark', put(box(0.075, jacketH * 0.92, 0.035), { y: jacketY, z: frontZ })]);
    for (let i = 0; i < 3; i++) {
      p.push(['hard', put(new THREE.SphereGeometry(0.016, 6, 5),
        { y: jacketY + jacketH * 0.3 - i * jacketH * 0.28, z: frontZ + 0.02 })]);
    }
    // Breast pockets.
    for (const s of [-1, 1]) {
      p.push(['clothDark', put(box(0.115, 0.115, 0.035),
        { x: s * rChest * 0.46, y: chestY - 0.03, z: frontZ - 0.01, ry: s * 0.25 })]);
    }
    // Epaulettes ride the clavicle, but the clavicle barely moves relative to
    // the chest, so they live here and save two draw calls per avatar. Pulled
    // in onto the shoulder slope, so they read as straps sewn down to the yoke
    // rather than as tabs standing off the end of it.
    for (const s of [-1, 1]) {
      p.push(['clothDark', put(box(0.096, 0.026, 0.150),
        { x: s * rChest * 0.76, y: chestY + 0.172, z: chestZ - 0.01, rz: s * 0.24 })]);
    }
    // Webbing: two shoulder straps front and back, meeting a chest strap.
    const wl = look.headgear === 'peakcap' ? 0.05 : 0.062;    // Richtofen wears less kit
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Vector3(s * rChest * 0.62, chestY + 0.185, chestZ - 0.02);
      p.push(['webbing', strap(shoulder,
        new THREE.Vector3(s * rChest * 0.34, waistY, frontZ - 0.01), wl, 0.024)]);
      p.push(['webbing', strap(shoulder,
        new THREE.Vector3(s * rChest * 0.20, waistY + 0.02, chestZ - rChest * 0.72), wl, 0.024)]);
    }
    // Pack / bedroll / satchel — the back half of the silhouette.
    const backZ = chestZ - rChest * 0.74;
    if (look.pack === 'haversack') {
      p.push(['cloth', put(box(0.30, 0.32, 0.145), { y: chestY - 0.09, z: backZ - 0.072 })]);
      p.push(['webbing', put(box(0.32, 0.05, 0.155), { y: chestY - 0.19, z: backZ - 0.072 })]);
      p.push(['leather', put(box(0.09, 0.10, 0.16), { x: 0.12, y: chestY - 0.02, z: backZ - 0.080 })]);
    } else if (look.pack === 'bedroll') {
      // A rolled greatcoat horseshoed over one shoulder: unmistakable at range.
      const roll = new THREE.TorusGeometry(0.235, 0.052, 6, 16, Math.PI * 1.15);
      p.push(['clothDark', put(roll, { y: chestY - 0.02, z: chestZ - 0.02, rx: 0.12, rz: -0.55 })]);
      p.push(['cloth', put(box(0.28, 0.28, 0.125), { y: chestY - 0.14, z: backZ - 0.065 })]);
    } else if (look.pack === 'small') {
      p.push(['cloth', put(box(0.24, 0.23, 0.112), { y: chestY - 0.10, z: backZ - 0.058 })]);
      p.push(['webbing', put(box(0.26, 0.045, 0.122), { y: chestY - 0.19, z: backZ - 0.058 })]);
    } else {
      // satchel: a flat map case slung on the left hip, worn high on the strap
      p.push(['leather', strap(new THREE.Vector3(rChest * 0.55, chestY + 0.18, chestZ - 0.02),
        new THREE.Vector3(-rChest * 0.55, waistY - 0.02, chestZ + 0.04), 0.05, 0.02)]);
      p.push(['leather', put(box(0.20, 0.23, 0.075),
        { x: -rChest * 0.80, y: waistY - 0.06, z: chestZ + 0.03 })]);
    }
    add('Torso', p.map(([k, g]) => [k, rel('Torso', g)]));
  }

  // ---- HIPS: belt, pouches, coat skirt, holster ----------------------------
  {
    const p = [];
    const rHip = 0.268 * Math.max(1, B.waist);
    const beltY = waistY + 0.015;
    const frontZ = hipZ + rHip * 0.74;
    // Coat length is the single strongest read of who a character is at
    // distance, so it is the one thing every persona does differently.
    // Each is a couple of centimetres longer than it was, which closes the
    // gap over the top of the thigh and the crotch where the source mesh's
    // torn trousers used to show. Deliberately only a couple: the skirt is
    // rigid on the Hips bone, so every centimetre past this starts to cut
    // through the thigh as it swings forward in the run and the crouch.
    const skirt = { short: 0.225, tunic: 0.285, quilted: 0.360, long: 0.545 }[look.coat] ?? 0.24;
    p.push(['cloth', put(tube(rHip * 0.99, rHip * (look.coat === 'long' ? 1.16 : 1.05), skirt, { flat: 0.76, segs: 14 }),
      { y: beltY - skirt * 0.5 + 0.01, z: hipZ })]);
    if (look.coat === 'long') {
      // A vent up the back, so the coat swings as two panels rather than a bell.
      p.push(['clothDark', put(box(0.05, skirt * 0.8, 0.03), { y: beltY - skirt * 0.5, z: hipZ - rHip * 0.86 })]);
    }
    // Belt and buckle.
    p.push(['leather', put(new THREE.TorusGeometry(rHip * 1.0, 0.026, 5, 16),
      { y: beltY, z: hipZ, rx: Math.PI / 2, sz: 0.78 })]);
    p.push(['hard', put(box(0.075, 0.062, 0.03), { y: beltY, z: frontZ + 0.01 })]);
    // Ammo pouches. Placement differs per army but the read is the same: mass
    // on the front of the belt, which is what stops the waist looking naked.
    const pouchN = look.pack === 'satchel' ? 1 : 2;
    for (let i = 0; i < pouchN; i++) {
      const s = pouchN === 1 ? 1 : (i === 0 ? -1 : 1);
      p.push(['leather', put(box(0.135, 0.125, 0.085),
        { x: s * rHip * 0.42, y: beltY - 0.075, z: frontZ - 0.02, ry: -s * 0.30 })]);
    }
    // Sidearm on the right hip (the model's -X side).
    p.push(['leather', put(box(0.085, 0.19, 0.06),
      { x: -rHip * 0.86, y: beltY - 0.10, z: hipZ + 0.02, rz: 0.12 })]);
    // A canteen balances it on the left.
    if (look.pack !== 'satchel') {
      p.push(['webbing', put(tube(0.062, 0.062, 0.13, { flat: 0.6, open: false, segs: 10 }),
        { x: rHip * 0.86, y: beltY - 0.10, z: hipZ - 0.05 })]);
    }
    add('Hips', p.map(([k, g]) => [k, rel('Hips', g)]));
  }

  // ---- HEAD: headgear, facial hair, spectacles -----------------------------
  {
    const p = [];
    // The head mesh, once scaled to human proportion, occupies roughly this
    // box. Headgear is sized off it rather than off the bone, because the bone
    // sits down at the jaw hinge.
    // Head gear is authored against HEAD_REF and rescaled to whatever
    // HEAD_SCALE currently is, so a helmet never outgrows the skull under it.
    const hs = HEAD_SCALE / HEAD_REF;
    const hc = new THREE.Vector3(P.Head.x, P.Head.y + 0.165 * hs, P.Head.z + 0.02 * hs);
    const rHead = 0.175 * hs;
    if (look.headgear === 'helmet') {
      // M1: a deep dome with a continuous rolled brim. No decal, no insignia.
      //
      // THE BRIM IS THE SHELL'S LOWER EDGE, not a ring round its widest point.
      // Authored the other way — brim at the equator, shell carried on below it
      // through 0.58 PI — the steel hung three centimetres PAST its own brim,
      // and three centimetres below the equator of this head is exactly the eye
      // line. At eye level Dempsey had no eyes, which is the same "faceless"
      // read the head gear was just fixed for. So the shell now stops at the
      // brim, the whole helmet is seated a little higher on the skull, and it
      // is raked back the way it is worn in every photograph: front edge up off
      // the brow, back edge down over the nape.
      //
      // Helmet-only, on purpose. The other three wear soft caps that grip the
      // skull, they sit correctly already, and moving all four would put the
      // caps up off their heads.
      const shellY = hc.y + 0.072 * hs;   // shell equator: the seat on the skull
      const edge = 0.029 * hs;            // how far the shell reaches below it
      const rake = -0.075;                // radians about X: tipped back
      p.push(['hard', put(dome(rHead * 1.10, Math.PI * 0.545, 16), { y: shellY, z: hc.z, rx: rake, sy: 1.05, sz: 1.10 })]);
      // The rolled edge rides ON the lower rim of the shell, and takes the same
      // rake, so it stays welded to it instead of cutting across it at an angle.
      p.push(['hard', put(new THREE.TorusGeometry(rHead * 1.12, 0.021 * hs, 5, 18),
        { y: shellY - edge, z: hc.z, rx: Math.PI / 2 + rake, sz: 1.10 })]);
      p.push(['webbing', put(new THREE.TorusGeometry(rHead * 1.06, 0.012 * hs, 4, 14),
        { y: hc.y + 0.112 * hs, z: hc.z, rx: Math.PI / 2 + rake, sz: 1.08 })]);
      // Chin strap, hanging loose the way every photograph of Peleliu shows it.
      for (const s of [-1, 1]) {
        p.push(['webbing', strap(
          new THREE.Vector3(s * rHead * 1.02, shellY - edge, hc.z),
          new THREE.Vector3(s * rHead * 0.70, hc.y - 0.14 * hs, hc.z + 0.05 * hs), 0.026 * hs, 0.012 * hs)]);
      }
    } else if (look.headgear === 'fieldcap_star') {
      // Soviet soft field cap: low crown, soft turn-up band, red star. A star
      // is the whole point of the silhouette, so it gets real geometry.
      p.push(['cloth', put(tube(rHead * 1.02, rHead * 1.06, 0.085 * hs, { flat: 0.94 * hs, open: false, segs: 14 }),
        { y: hc.y + 0.085 * hs, z: hc.z })]);
      p.push(['cloth', put(dome(rHead * 1.02, Math.PI * 0.5, 14), { y: hc.y + 0.125 * hs, z: hc.z, sy: 0.55 * hs })]);
      p.push(['clothDark', put(tube(rHead * 1.07, rHead * 1.09, 0.055 * hs, { flat: 0.94 * hs, segs: 14 }),
        { y: hc.y + 0.038 * hs, z: hc.z })]);
      p.push(['cloth', put(box(0.20 * hs, 0.022 * hs, 0.075 * hs), { y: hc.y + 0.030 * hs, z: hc.z + rHead * 0.94, rx: -0.25 })]);
      p.push(['accent', put(new THREE.CylinderGeometry(0.030 * hs, 0.030 * hs, 0.012 * hs, 5),
        { y: hc.y + 0.085 * hs, z: hc.z + rHead * 0.98, rx: Math.PI / 2 })]);
    } else if (look.headgear === 'havelock') {
      // Imperial Japanese soft field cap. SOFT, with a short cloth peak and
      // the hanging neck flaps — deliberately not the stiff peaked visor cap.
      p.push(['cloth', put(tube(rHead * 0.99, rHead * 1.05, 0.105 * hs, { flat: 0.96 * hs, open: false, segs: 14 }),
        { y: hc.y + 0.080 * hs, z: hc.z })]);
      p.push(['cloth', put(dome(rHead * 0.99, Math.PI * 0.5, 14), { y: hc.y + 0.130 * hs, z: hc.z, sy: 0.5 * hs })]);
      p.push(['clothDark', put(tube(rHead * 1.06, rHead * 1.07, 0.04 * hs, { flat: 0.96 * hs, segs: 14 }),
        { y: hc.y + 0.030 * hs, z: hc.z })]);
      // Short soft peak.
      p.push(['clothDark', put(box(0.19 * hs, 0.024 * hs, 0.10 * hs),
        { y: hc.y + 0.022 * hs, z: hc.z + rHead * 1.02, rx: -0.30 })]);
      // Three neck flaps: one behind, one over each ear. Boxes, not planes, so
      // there is no back-face to catch the light wrong.
      // They HANG. Sticking them out square turns the cap into a mortarboard.
      const flap = (x, z, ry) => put(box(0.105 * hs, 0.150 * hs, 0.020 * hs),
        { x, y: hc.y - 0.095 * hs, z, ry, rx: 0.05 });
      p.push(['cloth', flap(0, hc.z - rHead * 0.92, 0)]);
      p.push(['cloth', flap(rHead * 0.84, hc.z - rHead * 0.38, 1.30)]);
      p.push(['cloth', flap(-rHead * 0.84, hc.z - rHead * 0.38, -1.30)]);
    } else {
      // Plain dark peaked service cap. Band, crown, leather visor, nothing
      // else — no eagle, no wreath, no insignia of any kind.
      p.push(['clothDark', put(tube(rHead * 1.14, rHead * 1.04, 0.085 * hs, { flat: 0.94 * hs, open: false, segs: 14 }),
        { y: hc.y + 0.095 * hs, z: hc.z })]);
      p.push(['clothDark', put(new THREE.CylinderGeometry(rHead * 1.14, rHead * 1.14, 0.012 * hs, 16),
        { y: hc.y + 0.137 * hs, z: hc.z, sz: 0.94 * hs })]);
      p.push(['leather', put(tube(rHead * 1.05, rHead * 1.06, 0.055 * hs, { flat: 0.94 * hs, segs: 14 }),
        { y: hc.y + 0.030 * hs, z: hc.z })]);
      p.push(['leather', put(box(0.215 * hs, 0.020 * hs, 0.105 * hs),
        { y: hc.y + 0.014 * hs, z: hc.z + rHead * 1.02, rx: -0.34 })]);
    }
    // Facial hair, hugging the jaw. Never a slab standing off the chin.
    if (look.beard === 'full') {
      p.push(['hair', put(dome(0.088 * hs, Math.PI * 0.60, 12),
        { y: hc.y - 0.052 * hs, z: hc.z + 0.030 * hs, rx: Math.PI, sy: 1.10, sz: 1.00 })]);
      p.push(['hair', put(box(0.105 * hs, 0.032 * hs, 0.035 * hs), { y: hc.y - 0.028 * hs, z: hc.z + 0.145 * hs })]);
    } else if (look.beard === 'moustache') {
      p.push(['hair', put(box(0.085 * hs, 0.022 * hs, 0.030 * hs), { y: hc.y - 0.035 * hs, z: hc.z + 0.150 * hs })]);
    }
    // Round wire spectacles.
    if (look.glasses) {
      for (const s of [-1, 1]) {
        p.push(['accent', put(new THREE.TorusGeometry(0.040 * hs, 0.005 * hs, 4, 14),
          { x: s * 0.048 * hs, y: hc.y + 0.005 * hs, z: hc.z + 0.150 * hs })]);
        p.push(['accent', put(box(0.008 * hs, 0.006 * hs, 0.115 * hs),
          { x: s * 0.085 * hs, y: hc.y + 0.012 * hs, z: hc.z + 0.095 * hs })]);
      }
      p.push(['accent', put(box(0.020 * hs, 0.005 * hs, 0.006 * hs), { y: hc.y + 0.005 * hs, z: hc.z + 0.152 * hs })]);
    }
    add('Head', p.map(([k, g]) => [k, rel('Head', g)]));
  }

  // ---- ARMS: sleeves. They stop short of the elbow and the wrist so the -----
  // ---- sculpted joints and hands stay visible and keep deforming. ----------
  for (const s of ['L', 'R']) {
    const up = P['UpperArm' + s], low = P['LowerArm' + s], hand = P['Hand' + s];
    {
      const p = [];
      // The sleeve runs UP past the shoulder joint as well as down past the
      // elbow. A set-in sleeve that starts at the shoulder bone leaves the
      // deltoid and the armpit bare, which reads as a torn shirt.
      p.push(['cloth', span(up, low, 0.096 * B.arm, 0.088 * B.arm, { t0: -0.16, t1: 1.16, segs: 10 })]);
      p.push(['cloth', span(up, low, 0.118 * B.arm, 0.100 * B.arm, { t0: -0.62, t1: -0.10, segs: 10 })]);
      add('UpperArm' + s, p.map(([k, g]) => [k, rel('UpperArm' + s, g)]));
    }
    {
      const p = [];
      // Dempsey rolls his sleeves; everyone else runs them to the wrist.
      const t1 = look.headgear === 'helmet' ? 0.46 : 0.76;
      p.push(['cloth', span(low, hand, 0.082 * B.arm, 0.070 * B.arm, { t0: -0.34, t1, segs: 10 })]);
      p.push(['clothDark', span(low, hand, 0.086 * B.arm, 0.080 * B.arm,
        { t0: t1 - 0.10, t1: t1 + 0.01, segs: 10 })]);
      add('LowerArm' + s, p.map(([k, g]) => [k, rel('LowerArm' + s, g)]));
    }
  }

  // ---- LEGS: trousers, then whatever each army wound round the calf --------
  for (const s of ['L', 'R']) {
    const up = P['UpperLeg' + s], low = P['LowerLeg' + s], foot = P['Foot' + s];
    {
      const p = [];
      // Trousers. Measured against the sculpted thigh rather than guessed: the
      // source mesh carries TORN TROUSER GEOMETRY — ragged flaps hanging off
      // the front of each thigh — and it holds a radius of about 0.144 m all
      // the way from the hip to just above the knee. The old shell started at
      // 0.140 and tapered to 0.108, so from a quarter of the way down the thigh
      // the corpse's rags stood proud of the marine's trousers and read as a
      // dark jagged band across both legs.
      //
      // So the shell clears 0.144 along its whole length, and, exactly as the
      // tunic does, it never takes a persona multiplier BELOW one: a lean
      // multiplier is what let the mesh through in the first place.
      const trouser = Math.max(1, B.waist);
      p.push(['cloth', span(up, low, 0.160 * trouser, 0.138 * trouser, { t0: -0.10, t1: 1.22, segs: 12 })]);
      add('UpperLeg' + s, p.map(([k, g]) => [k, rel('UpperLeg' + s, g)]));
    }
    {
      const p = [];
      if (look.legs === 'puttees') {
        // Wrapped puttees: a taper plus visible windings.
        p.push(['cloth', span(low, foot, 0.112, 0.082, { t0: -0.22, t1: 0.84, segs: 12 })]);
        for (let i = 0; i < 4; i++) {
          const t = 0.18 + i * 0.16;
          p.push(['clothDark', span(low, foot, 0.116 - i * 0.008, 0.112 - i * 0.008,
            { t0: t, t1: t + 0.05, segs: 12 })]);
        }
      } else if (look.legs === 'leggings') {
        p.push(['cloth', span(low, foot, 0.118, 0.102, { t0: -0.22, t1: 0.55, segs: 12 })]);
        p.push(['webbing', span(low, foot, 0.108, 0.098, { t0: 0.45, t1: 0.86, segs: 12 })]);
      } else {
        // Trouser bloused into a tall boot: the boot shaft is the calf shell.
        p.push(['cloth', span(low, foot, 0.122, 0.112, { t0: -0.22, t1: 0.42, segs: 12 })]);
        p.push(['leather', span(low, foot, 0.112, 0.096, { t0: 0.36, t1: 0.92, segs: 12 })]);
      }
      add('LowerLeg' + s, p.map(([k, g]) => [k, rel('LowerLeg' + s, g)]));
    }
    {
      // The boot itself, over the sculpted foot.
      const p = [];
      const f = P['Foot' + s];
      // The sculpted foot runs a long way forward of the ankle joint, so the
      // boot is measured from the ankle to the toe rather than centred on the
      // bone — get this wrong and bare cartoon toes poke out the front.
      p.push(['leather', put(box(0.140, 0.104, 0.310), { x: f.x, y: f.y + 0.028, z: f.z + 0.104 })]);
      p.push(['hard', put(box(0.148, 0.028, 0.318), { x: f.x, y: f.y - 0.020, z: f.z + 0.104 })]);
      p.push(['leather', put(box(0.132, 0.094, 0.112), { x: f.x, y: f.y + 0.076, z: f.z - 0.016 })]);
      add('Foot' + s, p.map(([k, g]) => [k, rel('Foot' + s, g)]));
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// attachment
// ---------------------------------------------------------------------------

const _pool = new Map();          // persona id -> Map(bone -> {geo, mats})
const _scratchScale = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();

/** Bones whose gear is dropped first when an avatar gets far away. */
const LIMB_BONES = new Set([
  'UpperArmL', 'UpperArmR', 'LowerArmL', 'LowerArmR',
  'UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR', 'FootL', 'FootR',
]);

/**
 * Dress a soldier.
 *
 * Must be called with the skeleton already holding the pose the gear is
 * authored against — SoldierVisual forces Idle and applies the spine
 * correction first — because every offset below is measured from live bone
 * positions at this instant.
 *
 * @param {object} visual   needs `.bones` (name -> Bone) and `.inner`
 * @param {number} personaIdx
 * @returns {{meshes: THREE.Mesh[], byBone: Map<string, THREE.Mesh>}}
 */
export function attachSoldierGear(visual, personaIdx) {
  const B = visual?.bones;
  if (!B) return { meshes: [], byBone: new Map() };
  const look = SOLDIER_LOOKS[((personaIdx | 0) % SOLDIER_LOOKS.length + SOLDIER_LOOKS.length) % SOLDIER_LOOKS.length];
  const M = materials(look);

  let wardrobe = _pool.get(look.id);
  if (!wardrobe) {
    // Measure this rig once and build the whole persona against it. Every
    // SoldierVisual is a clone of the same source at the same calibration, so
    // the measurement is valid for all of them and the pool is shared.
    const P = {};
    const read = (name, key = name) => {
      const bone = B[name];
      if (!bone) return;
      bone.updateWorldMatrix(true, false);
      P[key] = bone.getWorldPosition(new THREE.Vector3());
    };
    for (const n of ['Hips', 'Abdomen', 'Torso', 'Neck', 'Head']) read(n);
    for (const s of ['L', 'R']) {
      read('Shoulder' + s); read('UpperArm' + s); read('LowerArm' + s);
      read('UpperLeg' + s); read('LowerLeg' + s); read('Foot' + s);
      read('Middle1' + s, 'Hand' + s);
    }
    const needed = ['Hips', 'Torso', 'Neck', 'Head', 'UpperArmL', 'LowerArmL', 'HandL',
      'UpperLegL', 'LowerLegL', 'FootL'];
    if (!needed.every((k) => P[k])) return { meshes: [], byBone: new Map() };
    wardrobe = buildWardrobe(look, P);
    _pool.set(look.id, wardrobe);
  }

  const meshes = [];
  const byBone = new Map();
  for (const [boneName, build] of wardrobe) {
    const bone = B[boneName];
    if (!bone) continue;
    const mats = build.mats.map((k) => M[k]);
    const mesh = new THREE.Mesh(build.geo, mats.length === 1 ? mats[0] : mats);
    mesh.castShadow = true;
    mesh.userData.soldierGear = true;
    bone.updateWorldMatrix(true, false);
    bone.getWorldScale(_scratchScale);
    bone.getWorldQuaternion(_scratchQuat);
    // Undo the bone's rest rotation FIRST, so the mesh is back in world axes —
    // which is the space every offset in buildWardrobe was measured in.
    mesh.quaternion.copy(_scratchQuat).invert();
    // Now cancel the bone's world scale PER AXIS. Because the rotation is
    // already undone, an axis-aligned inverse reproduces world metres exactly
    // and cannot shear: it is the identity, not a squash of a rotated frame.
    //
    // A uniform mean CANNOT do that here, and getting it wrong is not subtle.
    // LIMB_SHAPE narrows Hips, Abdomen and Torso across X and Z only, and those
    // compound down the chain, so by the time you reach the Head bone the world
    // scale is roughly (0.26, 0.53, 0.32) — twice as tall as it is wide.
    // Cancelling the mean of that left head gear 1.4x too tall and 0.7x too
    // narrow, and the torso collar standing above the crown of the head. The
    // cap band, the hair and the beard closed over the face until every marine
    // read as a black block from the brow to the collarbone.
    mesh.scale.set(
      1 / Math.max(1e-4, Math.abs(_scratchScale.x)),
      1 / Math.max(1e-4, Math.abs(_scratchScale.y)),
      1 / Math.max(1e-4, Math.abs(_scratchScale.z)),
    );
    bone.add(mesh);
    meshes.push(mesh);
    byBone.set(boneName, mesh);
  }
  return { meshes, byBone };
}

/**
 * Level of detail. 0 dresses him fully, 1 drops the limb gear (sleeves,
 * trousers, boots — the pieces that read as texture rather than silhouette),
 * 2 strips everything. Called from the avatar's own distance check.
 */
export function setSoldierGearLOD(handle, level) {
  if (!handle) return;
  for (const [bone, mesh] of handle.byBone) {
    mesh.visible = level === 0 ? true : level === 1 ? !LIMB_BONES.has(bone) : false;
  }
}

/**
 * Unparent an avatar's gear. Deliberately does NOT dispose geometry or
 * materials: both are shared with every other avatar of the same persona and
 * live for the process, so disposing here would undress the whole squad.
 */
export function detachSoldierGear(handle) {
  for (const m of handle?.meshes || []) m.parent?.remove(m);
}

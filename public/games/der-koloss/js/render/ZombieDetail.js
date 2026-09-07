// Bone-attached geometry detail for zombies.
//
// The shipped corpse is a clean low-poly humanoid. Shading alone got it a long
// way, but a remastered-WaW corpse needs actual silhouette damage: a shredded
// greatcoat, exposed ribs where the flesh is gone, hanging strips, torn
// sleeves, a wrecked jaw.
//
// CRITICAL CONSTRAINT: this parents plain meshes to EXISTING bones. It adds no
// clips, no additive layers, no head-look, no retargeting, and never writes a
// bone transform. Attachments inherit their bone's motion for free, so they
// cannot desync the skeleton — which is what produced the rolling heads when
// this was previously attempted through the animation system.
//
// Memory shape matters here. Zombies are spawned and thrown away every round
// and the spawn path never disposes geometry, so anything generated per corpse
// would leak GPU memory for the whole session. Instead a small fixed pool of
// damage variants is built once and every corpse gets cheap Meshes POINTING AT
// the shared geometry — nothing per-instance to free but the meshes themselves.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';
import { enhanceCreatureMaterial } from './CreatureShading.js';

/** How many distinct damage builds exist. Enough that a horde never twins. */
const VARIANTS = 8;

const _scratchScale = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _boneA = new THREE.Vector3();
const _boneB = new THREE.Vector3();
const _scratchCentre = new THREE.Vector3();

/**
 * Hips-to-head distance, in world units, of the rig everything below was
 * authored against (a calibrated in-game corpse standing 1.78 m tall).
 *
 * Sizes here are expressed relative to THIS rather than in absolute metres
 * because attachment happens before ZombieVisual calibrates: at attach time
 * the rig is still at its authored scale and only later gets multiplied up to
 * the target height. Anything measured in absolute metres therefore came out
 * ~1.6x too big, which is what put the tunic down around the knees.
 *
 * Measuring a ratio sidesteps the ordering entirely — both the measurement and
 * the bone scale get multiplied by the same factor, so they cancel.
 */
const REFERENCE_SPAN = 0.71;

// Authored heights of the two garments. The fitter below rescales each mesh so
// these map onto the real distance between the rig's own bones, which is what
// makes placement correct on every variant regardless of proportions or of
// whether calibration has run yet.
const SKIRT_H = 0.30;
const TUNIC_H = 0.50;

// ---------------------------------------------------------------------------
// deterministic RNG — a given variant index always builds the same corpse
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

let _mats = null;
function materials() {
  if (_mats) return _mats;
  const cloth = new THREE.MeshStandardMaterial({
    color: 0x2b2e2b, roughness: 0.98, metalness: 0.0, side: THREE.DoubleSide,
  });
  const bone = new THREE.MeshStandardMaterial({
    color: 0x9a927c, roughness: 0.62, metalness: 0.0,
  });
  const flesh = new THREE.MeshStandardMaterial({
    color: 0x4a1512, roughness: 0.38, metalness: 0.0, side: THREE.DoubleSide,
  });
  // Same rim/wrap treatment as the body, so the additions sit in the same
  // light instead of reading as pasted-on props.
  enhanceCreatureMaterial(cloth, {
    rimStrength: 0.34, rimPower: 3.6, wrap: 0.2, sssStrength: 0.05,
    fleshAmount: 0.35, grime: 0.6, wet: 0.05, tintA: 0x3a3d38, tintB: 0x242623,
  });
  enhanceCreatureMaterial(bone, {
    rimStrength: 0.5, rimPower: 3.2, wrap: 0.3, sssColor: 0xd8b090, sssStrength: 0.2,
    fleshAmount: 0.3, grime: 0.45, wet: 0.15, tintA: 0xa79d86, tintB: 0x8b8271,
  });
  enhanceCreatureMaterial(flesh, {
    rimStrength: 0.45, rimPower: 3.0, wrap: 0.35, sssColor: 0xa02818, sssStrength: 0.55,
    fleshAmount: 0.5, grime: 0.3, wet: 0.55, tintA: 0x5a1a15, tintB: 0x3a0f0c,
  });
  _mats = { cloth, bone, flesh };
  return _mats;
}

// ---------------------------------------------------------------------------
// primitive builders — all in metres, all merged before they reach the scene
// ---------------------------------------------------------------------------

/** A ragged hanging strip: a cloth tatter or a strand of flesh. */
function stripGeo(w, len, taper, rnd) {
  const g = new THREE.PlaneGeometry(w, len, 1, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = 0.5 - p.getY(i) / len;              // 0 at the root, 1 at the tip
    p.setX(i, p.getX(i) * (1 - t * taper) + (rnd() - 0.5) * w * 0.25 * t);
    // Curl it so it does not read as a flat rectangle.
    p.setZ(i, p.getZ(i) + Math.sin(t * 3.1) * len * 0.10 * (rnd() - 0.5) * 2);
  }
  g.translate(0, -len / 2, 0);                    // hang from the origin
  g.computeVertexNormals();
  return g;
}

/**
 * An open tube with a torn-off hem, used for the tunic and the coat.
 *
 * `thetaLength` below a full turn leaves a vertical gap — that is the rip the
 * ribs show through, so the exposed bone reads as a wound in clothing rather
 * than as bones stuck onto bare skin.
 */
function garmentGeo(rTop, rBot, h, thetaStart, thetaLength, rnd) {
  const segs = Math.max(6, Math.round((thetaLength / (Math.PI * 2)) * 16));
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs, 3, true, thetaStart, thetaLength);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < -h * 0.49) {
      // Bottom ring: tear it upward by a random amount so the hem is ragged
      // instead of a machine-cut circle.
      p.setY(i, y + h * 0.34 * rnd());
      p.setX(i, x * (1 + rnd() * 0.10));
      p.setZ(i, z * (1 + rnd() * 0.10));
    } else {
      // Everywhere else: a little slack so the cloth is not a perfect cylinder.
      const slack = 1 + (rnd() - 0.5) * 0.07;
      p.setX(i, x * slack);
      p.setZ(i, z * slack);
    }
  }
  g.computeVertexNormals();
  return g;
}

function placed(geo, x, y, z, rx, ry, rz) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  );
  geo.applyMatrix4(m);
  return geo;
}

function mergeOne(list) {
  if (!list.length) return null;
  const merged = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  return merged || null;
}

// ---------------------------------------------------------------------------
// variant construction (once per process)
// ---------------------------------------------------------------------------

function buildVariant(seed) {
  const rnd = mulberry32(seed);
  // How mauled this build is. Most are ragged; a few are wrecked.
  const damage = rnd() < 0.25 ? 0.85 + rnd() * 0.15 : 0.25 + rnd() * 0.5;
  const v = { hips: null, torso: null, shoulderL: null, shoulderR: null, head: null };

  // ---- hips: the torn-off skirt of a greatcoat ----------------------------
  {
    const parts = [];
    // The skirt itself, as one continuous piece of cloth with a shredded hem.
    // Doing this as a garment rather than as loose strips is what stops it
    // reading as a grass skirt.
    parts.push(placed(garmentGeo(0.185, 0.225, SKIRT_H, 0, Math.PI * 2, rnd),
      0, 0, 0, 0, 0, 0));
    // A few strips torn loose below the hem. Short and wide: long thin ones
    // read as sticks hanging off the model, not fabric.
    for (let i = 0, n = 3 + Math.floor(rnd() * 4); i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.185 + rnd() * 0.03;
      parts.push(placed(
        stripGeo(0.13 + rnd() * 0.10, 0.10 + rnd() * 0.14, 0.5 + rnd() * 0.3, rnd),
        Math.cos(a) * r, -SKIRT_H * 0.5, Math.sin(a) * r,
        (rnd() - 0.5) * 0.25, -a + Math.PI / 2, (rnd() - 0.5) * 0.3,
      ));
    }
    // A thin surviving belt strap. Kept deliberately tight to the body — the
    // earlier version was a wide cylinder and read as a hoop around the waist.
    parts.push(placed(new THREE.TorusGeometry(0.175, 0.014, 4, 14), 0, SKIRT_H * 0.42, 0, Math.PI / 2, 0, 0));
    v.hips = mergeOne(parts);
  }

  // ---- torso: exposed ribs, wound cavity, hanging flesh -------------------
  // One mesh, two material groups (bone then flesh), so a torn-open torso
  // costs a single draw call instead of two.
  {
    const clothParts = [];
    const boneParts = [];
    const fleshParts = [];
    const side = rnd() < 0.5 ? 1 : -1;
    const ribs = damage > 0.6 ? 4 : damage > 0.35 ? 2 : 0;

    // A ripped tunic. The base model is bare-chested, which reads as an
    // unfinished character rather than a corpse; clothing it is the single
    // biggest step toward a WaW-era soldier silhouette. The rip is placed on
    // the same side as the ribs so the two damage features agree.
    {
      const gapCentre = side > 0 ? 0.35 : Math.PI - 0.35;
      const gap = ribs ? 0.55 + damage * 0.55 : 0.16;
      clothParts.push(placed(
        garmentGeo(0.215, 0.245, TUNIC_H, gapCentre + gap / 2, Math.PI * 2 - gap, rnd),
        0, 0, 0, 0, 0, 0,
      ));
    }
    for (let i = 0; i < ribs; i++) {
      boneParts.push(placed(
        new THREE.TorusGeometry(0.085 - i * 0.006, 0.009, 4, 8, 1.5 + rnd() * 0.4),
        side * 0.045, 0.12 - i * 0.045, 0.055,
        Math.PI / 2, side > 0 ? 0.5 : Math.PI - 0.5, 0,
      ));
    }
    if (ribs) {
      // A dark cavity behind the ribs, so they read as a hole rather than
      // as bones stuck onto an intact chest.
      fleshParts.push(placed(
        new THREE.SphereGeometry(0.085, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
        side * 0.05, 0.06, 0.035, Math.PI * 0.5, 0, 0,
      ));
    }
    for (let i = 0, n = Math.round(damage * 4); i < n; i++) {
      fleshParts.push(placed(
        stripGeo(0.03 + rnd() * 0.025, 0.10 + rnd() * 0.14, 0.7, rnd),
        (rnd() - 0.5) * 0.16, 0.02 - rnd() * 0.12, 0.07 + rnd() * 0.03,
        0.3 + rnd() * 0.4, rnd() * Math.PI, (rnd() - 0.5) * 0.5,
      ));
    }
    // One mesh for the whole torso, with a material group per surface type, so
    // a clothed and torn-open chest still costs a single draw call.
    const layers = [
      ['cloth', mergeOne(clothParts)],
      ['bone', mergeOne(boneParts)],
      ['flesh', mergeOne(fleshParts)],
    ].filter(([, g]) => g);
    if (layers.length === 1) {
      v.torso = { geo: layers[0][1], mats: [layers[0][0]] };
    } else if (layers.length > 1) {
      const merged = mergeGeometries(layers.map(([, g]) => g), true);
      for (const [, g] of layers) g.dispose();
      if (merged) v.torso = { geo: merged, mats: layers.map(([k]) => k) };
    }
  }

  // ---- shoulders: torn sleeve tatters -------------------------------------
  for (const [key, sgn] of [['shoulderL', 1], ['shoulderR', -1]]) {
    if (rnd() > 0.75) continue;                   // some sleeves survive intact
    const parts = [];
    for (let i = 0, n = 2 + Math.floor(rnd() * 3); i < n; i++) {
      parts.push(placed(
        stripGeo(0.055 + rnd() * 0.04, 0.09 + rnd() * 0.13, 0.6, rnd),
        sgn * (0.03 + rnd() * 0.05), -0.03 - rnd() * 0.05, (rnd() - 0.5) * 0.09,
        (rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.6,
      ));
    }
    v[key] = mergeOne(parts);
  }

  // ---- head: jaw and skull damage ------------------------------------------
  if (damage > 0.55) {
    const parts = [];
    const side = rnd() < 0.5 ? 1 : -1;
    // Exposed cheekbone, hugging the skull along the jawline. The earlier
    // version stood proud of the face and read as a splinter stuck to the chin.
    parts.push(placed(new THREE.SphereGeometry(0.032, 6, 5, 0, Math.PI * 1.1, 0, Math.PI * 0.6),
      side * 0.052, -0.012, 0.028, Math.PI * 0.12, side > 0 ? -0.5 : 0.5 + Math.PI, 0));
    if (rnd() < 0.6) {
      // A patch of bare skull above the ear, scalp gone.
      parts.push(placed(new THREE.SphereGeometry(0.047, 7, 5, 0, Math.PI * 0.9, 0, Math.PI * 0.45),
        side * 0.022, 0.052, -0.008, -0.25, side > 0 ? 0.6 : -0.6 + Math.PI, 0));
    }
    v.head = mergeOne(parts);
  }

  return v;
}

let _variants = null;
function variants() {
  if (!_variants) _variants = Array.from({ length: VARIANTS }, (_, i) => buildVariant(0x9e37 + i * 2654435761));
  return _variants;
}

// ---------------------------------------------------------------------------
// attachment
// ---------------------------------------------------------------------------

/**
 * Attach damage detail to a zombie visual.
 *
 * @param {object} visual the ZombieVisual (needs a `.bones` map)
 * @param {number} [variantIndex] which prebuilt damage build to use
 * @returns {THREE.Mesh[]} the attachments, for {@link detachZombieDetail}
 */
export function attachZombieDetail(visual, variantIndex = Math.floor(Math.random() * VARIANTS)) {
  const B = visual?.bones;
  if (!B) return [];
  const M = materials();
  const v = variants()[((variantIndex % VARIANTS) + VARIANTS) % VARIANTS];
  const out = [];

  const worldOf = (name) => {
    const b = B[name];
    if (!b) return null;
    b.updateWorldMatrix(true, false);
    return b.getWorldPosition(new THREE.Vector3());
  };

  // Measure this rig so every attachment is sized as a proportion of the body
  // rather than in absolute metres. See REFERENCE_SPAN.
  let fit = 1;
  if (B.Head && B.Hips) {
    B.Head.updateWorldMatrix(true, false);
    B.Hips.updateWorldMatrix(true, false);
    B.Head.getWorldPosition(_boneA);
    B.Hips.getWorldPosition(_boneB);
    const span = _boneA.distanceTo(_boneB);
    if (span > 1e-3) fit = span / REFERENCE_SPAN;
  }

  /**
   * Parent to a bone, cancelling that bone's rest transform so the geometry
   * above can be authored in plain world-aligned metres.
   *
   * Both halves matter:
   *
   * - SCALE. The rig is scaled to hit a target height, so raw bone space is
   *   not metres. Divided out here, uniformly — a component-wise inverse does
   *   not commute with the rotation below and shears the mesh.
   *
   * - ROTATION. Bone axes are NOT world axes: the spine bones lean, so a
   *   local -Y offset travels down AND backwards. Without this the tunic and
   *   the coat hung roughly 0.2 m behind the body, floating clear of the back.
   *
   * Cancelling the rest rotation is not the same as pinning the mesh in world
   * space — the mesh still inherits every subsequent bone transform, so it
   * animates with the pose exactly as intended. It just starts from square.
   */
  const mount = (boneName, geo, material, span = null) => {
    const bone = B[boneName];
    if (!bone || !geo) return;
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    bone.updateWorldMatrix(true, false);
    bone.getWorldScale(_scratchScale);
    bone.getWorldQuaternion(_scratchQuat);
    const s = (_scratchScale.x + _scratchScale.y + _scratchScale.z) / 3;
    mesh.quaternion.copy(_scratchQuat).invert();

    if (span) {
      // Fit the garment to the rig instead of trusting an authored offset.
      // `from` and `to` are bones, so the cloth lands correctly on a lanky
      // corpse and a fat one alike, and stays right whatever height the rig
      // was calibrated to.
      const a = worldOf(span.from), b = worldOf(span.to);
      if (a && b) {
        const wanted = a.distanceTo(b) * span.coverage;
        mesh.scale.setScalar(wanted / span.authored / Math.max(1e-4, s));
        // Ride the line between the two bones, then convert to bone space.
        _scratchCentre.copy(a).lerp(b, span.at);
        bone.worldToLocal(_scratchCentre);
        mesh.position.copy(_scratchCentre);
        bone.add(mesh);
        out.push(mesh);
        return;
      }
    }
    mesh.scale.setScalar(fit / Math.max(1e-4, s));
    bone.add(mesh);
    out.push(mesh);
  };

  // Skirt: hangs from the waist down toward the knees.
  mount('Hips', v.hips, M.cloth,
    { from: 'Hips', to: 'LowerLegL', at: 0.30, coverage: 0.62, authored: SKIRT_H });
  mount('ShoulderL', v.shoulderL, M.cloth);
  mount('ShoulderR', v.shoulderR, M.cloth);
  mount('Head', v.head, M.bone);
  if (v.torso) {
    const mats = v.torso.mats.map((k) => M[k]);
    mount('Torso', v.torso.geo, mats.length === 1 ? mats[0] : mats,
      { from: 'Hips', to: 'Neck', at: 0.58, coverage: 0.92, authored: TUNIC_H });
  }
  return out;
}

/**
 * Unparent a corpse's detail meshes.
 *
 * Deliberately does NOT dispose geometry: it is shared by every zombie using
 * the same variant and lives for the process. Disposing here would blank the
 * detail on every other corpse in the horde.
 */
export function detachZombieDetail(list) {
  for (const m of list || []) m.parent?.remove(m);
}

/** Toggle detail for LOD, so distant corpses skip the extra draw calls. */
export function setZombieDetailVisible(list, visible) {
  for (const m of list || []) m.visible = visible;
}

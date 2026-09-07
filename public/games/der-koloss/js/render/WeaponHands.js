// Gloved first-person hands.
//
// One parametric builder covers every grip on every weapon. The canonical hand
// wraps a cylinder lying along its local X axis:
//
//     +Z  = back of the hand / heel of the palm (the side the wrist is on)
//     -Z  = the far side the fingertips reach around to
//     +Y  = the side the fingers travel over while curling
//     +X  = index-finger end of the knuckle row, -X = little finger
//
// Callers rotate that canonical frame into place: rotate +90° about Z and the
// grip column stands vertical with the index at the top, which is exactly a
// pistol grip; leave it alone and the hand wraps a horizontal handguard.
//
// Handedness is a true mirror of the wrap plane (all Y flipped, all curls
// negated) rather than a negative scale, so lighting stays correct.
import * as THREE from 'three';
import { WM } from './WeaponMaterials.js';
import { bevelBoxGeo, cylGeo, sphereGeo, torusGeo, mesh } from './WeaponParts.js';

const FINGER_X = [0.0255, 0.0090, -0.0075, -0.0240];
// proximal / middle / distal lengths, index -> little
const FINGER_LEN = [
  [0.0270, 0.0195, 0.0150],
  [0.0290, 0.0215, 0.0160],
  [0.0275, 0.0200, 0.0150],
  [0.0230, 0.0165, 0.0130],
];
const FINGER_W = [0.0138, 0.0142, 0.0134, 0.0118];

/**
 * @param {object} o
 *   side      1 = right hand, -1 = left hand
 *   curl      base wrap amount, 0 = flat, 1 = full fist
 *   curls     optional per-finger multipliers [index, middle, ring, little]
 *   trigger   0..1 — how much the index finger is straightened onto a trigger
 *   thumb     0..1 — how far the thumb is wrapped across
 *   thumbUp   splay the thumb along the frame instead of around the grip
 *   spread    finger separation multiplier
 *   cuff      show the sleeve cuff (off for the support hand under a handguard)
 *   scale     overall size
 */
export function buildHand(o = {}) {
  const {
    side = 1, curl = 1, curls = null, trigger = 0, thumb = 0.75,
    thumbUp = false, spread = 1, cuff = true, scale = 0.94, wrist = 1,
    glove = WM.glove, dark = WM.gloveDark, sleeve = WM.canvasStrap,
  } = o;
  // The canonical build (fingers along -Z, thumb at +X) is anatomically a LEFT
  // hand when the wrap runs toward -Y, so `side: 1` (right) mirrors the wrap
  // plane and `side: -1` (left) leaves it alone.
  const S = side >= 0 ? -1 : 1;
  const g = new THREE.Group();

  // ---- palm -------------------------------------------------------------
  // thicker at the heel, tapering toward the knuckles
  const palm = mesh(bevelBoxGeo(0.072, 0.028, 0.054, 0.007), glove, 0, S * 0.009, 0.020);
  g.add(palm);
  // thenar pad (thumb muscle) bulges on the index side
  g.add(mesh(bevelBoxGeo(0.021, 0.026, 0.042, 0.008), glove, 0.028, S * 0.003, 0.018));
  // hypothenar pad on the little-finger side
  g.add(mesh(bevelBoxGeo(0.016, 0.022, 0.040, 0.007), glove, -0.029, S * 0.005, 0.022));
  // knuckle ridge — four domes where the fingers leave the hand
  for (let i = 0; i < 4; i++) {
    const k = mesh(sphereGeo(0.0072, 8, 6), glove,
      FINGER_X[i] * spread, S * 0.0195, -0.008);
    k.scale.set(1, 0.8, 1.2);
    g.add(k);
  }
  // reinforced glove patch across the back of the hand
  g.add(mesh(bevelBoxGeo(0.062, 0.005, 0.038, 0.002), dark, 0, S * 0.024, 0.018));

  // ---- fingers ----------------------------------------------------------
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const mul = curls ? curls[i] : 1;
    const c = curl * mul;
    const root = new THREE.Group();
    root.position.set(FINGER_X[i] * spread, S * 0.019, -0.017);
    const L = FINGER_LEN[i], W = FINGER_W[i];
    // index finger straightens onto the trigger when asked
    const isIndex = i === 0;
    const k1 = isIndex ? 0.92 * (1 - trigger) + 0.12 * trigger : 0.92;
    const k2 = isIndex ? 1.20 * (1 - trigger) + 0.70 * trigger : 1.20;
    const k3 = isIndex ? 1.00 * (1 - trigger) + 0.34 * trigger : 1.00;
    const a1 = k1 * c, a2 = k2 * c, a3 = k3 * c;
    root.rotation.x = -S * a1;
    root.rotation.z = S * (i - 1.5) * 0.045 * spread;
    const seg1 = mesh(bevelBoxGeo(W, W * 1.12, L[0], 0.0035), glove, 0, 0, -L[0] / 2);
    root.add(seg1);
    const j2 = new THREE.Group();
    j2.position.z = -L[0];
    j2.rotation.x = -S * a2;
    j2.add(mesh(bevelBoxGeo(W * 0.94, W * 1.02, L[1], 0.0032), glove, 0, 0, -L[1] / 2));
    // knuckle bump at the PIP joint
    const b2 = mesh(sphereGeo(W * 0.48, 7, 5), glove, 0, S * W * 0.12, 0);
    b2.scale.set(0.94, 0.86, 0.8);
    j2.add(b2);
    root.add(j2);
    const j3 = new THREE.Group();
    j3.position.z = -L[1];
    j3.rotation.x = -S * a3;
    j3.add(mesh(bevelBoxGeo(W * 0.86, W * 0.9, L[2], 0.0030), glove, 0, 0, -L[2] / 2));
    // fingertip cap
    j3.add(mesh(sphereGeo(W * 0.40, 7, 5), glove, 0, 0, -L[2] + W * 0.10));
    j2.add(j3);
    // Joint handles + the per-unit-curl coefficients that produced this pose,
    // so an animation can re-drive the same finger without rebuilding it.
    root.userData.j2 = j2;
    root.userData.j3 = j3;
    root.userData.k = [k1, k2, k3];
    root.userData.mul = mul;
    root.userData.S = S;
    root.userData.spreadZ = root.rotation.z;
    g.add(root);
    fingers.push(root);
  }

  // ---- thumb ------------------------------------------------------------
  const th = new THREE.Group();
  th.position.set(0.034, S * 0.003, 0.000);
  if (thumbUp) {
    th.rotation.set(-S * 0.25, 0, S * 0.55);
  } else {
    th.rotation.set(-S * (0.35 + thumb * 0.55), 0.35, S * 0.75);
  }
  th.add(mesh(bevelBoxGeo(0.017, 0.018, 0.028, 0.005), glove, 0, 0, -0.014));
  const th2 = new THREE.Group();
  th2.position.z = -0.028;
  th2.rotation.x = -S * (0.25 + thumb * 0.75);
  th2.rotation.y = -0.25;
  th2.add(mesh(bevelBoxGeo(0.0145, 0.015, 0.024, 0.0045), glove, 0, 0, -0.012));
  th2.add(mesh(sphereGeo(0.0068, 7, 5), glove, 0, 0, -0.022));
  th.add(th2);
  g.add(th);
  g.userData.thumb = th;
  g.userData.thumb2 = th2;
  g.userData.thumbBase = th.rotation.clone();
  g.userData.thumb2Base = th2.rotation.clone();
  g.userData.baseCurl = curl;
  g.userData.side = side;
  g.userData.S = S;
  g.userData.fingers = fingers;

  // ---- wrist + cuff -----------------------------------------------------
  if (wrist) {
    g.add(mesh(bevelBoxGeo(0.050, 0.038, 0.038, 0.010), glove, 0, S * 0.005, 0.058));
    if (cuff) {
      // Deliberately stubby: the forearm sits a few centimetres from the lens,
      // so a full sleeve fills the screen instead of framing the weapon.
      g.add(mesh(cylGeo(0.026, 0.025, 0.022, 14), dark, 0, S * 0.004, 0.080, Math.PI / 2));
      g.add(mesh(torusGeo(0.0265, 0.0034, 5, 14), dark, 0, S * 0.004, 0.070));
      g.add(mesh(cylGeo(0.025, 0.026, 0.028, 14, true), sleeve, 0, S * 0.004, 0.100, Math.PI / 2));
      g.add(mesh(torusGeo(0.0255, 0.0026, 4, 14), dark, 0, S * 0.004, 0.090));
    }
  }

  if (scale !== 1) g.scale.setScalar(scale);
  // Mark every glove mesh as flesh, not weapon. Anything that has to strip the
  // hands out of a tree — the asset archive, the cinematic, any world display —
  // tests THIS, never the part name. The archive used to hide parts whose name
  // began with "hand", which quietly deleted `handguard` and `handle` (the
  // wooden forend and the carry handle) from fifteen weapons.
  g.traverse((o) => { if (o.isMesh) o.userData.isGlove = true; });
  g.userData.isGlove = true;
  return g;
}

const _vx = new THREE.Vector3(), _vy = new THREE.Vector3(), _vz = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
/** Rotate a hand so its canonical X/Y/Z axes land on the given world axes. */
function orient(h, xa, ya, za) {
  _m4.makeBasis(_vx.set(...xa), _vy.set(...ya), _vz.set(...za));
  h.quaternion.setFromRotationMatrix(_m4);
}

/**
 * Right hand closed on a pistol grip, index finger on the trigger.
 * Canonical X (index end of the knuckle row) points up, the palm stays at the
 * back of the grip and the fingers wrap around the weapon's left side — which
 * is where a right hand's fingers actually go.
 *
 * `rake` tilts the whole hand back with the grip it is holding.
 */
export function triggerHand(x, y, z, rake = -0.28, opts = {}) {
  const wrap = new THREE.Group();
  const h = buildHand({ side: 1, curl: 1, trigger: 0.8, thumb: 0.4, thumbUp: true, ...opts });
  orient(h, [0, 1, 0], [-1, 0, 0], [0, 0, 1]);
  wrap.add(h);
  // Call sites give the grip's CENTRE; a real fist closes around the upper
  // third of it with the index finger up level with the trigger, so bias the
  // hand up and slightly forward rather than making every weapon compensate.
  wrap.position.set(x, y + (opts.lift ?? 0.030), z - (opts.reach ?? 0.008));
  wrap.rotation.set(rake, opts.yaw ?? -0.10, opts.roll ?? 0);
  wrap.userData.hand = h;
  return wrap;
}

/**
 * Left hand wrapped over a horizontal handguard: palm on the weapon's left,
 * fingers reaching over the top and down the right side, index toward the
 * muzzle. The forearm trails back and to the left.
 */
export function supportHand(x, y, z, opts = {}) {
  const wrap = new THREE.Group();
  const h = buildHand({ side: -1, curl: 0.92, trigger: 0, thumb: 0.85, spread: 1.05, ...opts });
  orient(h, [0, 0, -1], [0, -1, 0], [-1, 0, 0]);
  wrap.add(h);
  // Biased down onto the underside of the handguard the hand is cupping.
  wrap.position.set(x, y - (opts.lift ?? 0.008), z);
  wrap.rotation.set(opts.pitch ?? 0.05, opts.yaw ?? 0, opts.roll ?? -0.25);
  wrap.userData.hand = h;
  return wrap;
}

/** Left hand closed on a vertical foregrip / drum / magazine well. */
export function foreGripHand(x, y, z, rake = 0.1, opts = {}) {
  const wrap = new THREE.Group();
  // Same frame as the trigger hand; `side: -1` mirrors the wrap internally so
  // the left hand's fingers come round the weapon's right side.
  const h = buildHand({ side: -1, curl: 1, trigger: 0, thumb: 0.7, thumbUp: true, ...opts });
  orient(h, [0, 1, 0], [-1, 0, 0], [0, 0, 1]);
  wrap.add(h);
  wrap.position.set(x, y + (opts.lift ?? 0.026), z - (opts.reach ?? 0.006));
  wrap.rotation.set(rake, opts.yaw ?? 0.14, opts.roll ?? 0);
  wrap.userData.hand = h;
  return wrap;
}

/** Bare clenched fist, knuckles forward (Pack-a-Punch knuckle crack). */
export function fistHand(side, opts = {}) {
  const h = buildHand({ side, curl: 1.15, trigger: 0, thumb: 1, ...opts });
  return h;
}

/**
 * Re-pose a hand built by buildHand() without rebuilding it.
 *
 * `curl` re-drives every finger through the same per-joint coefficients the
 * build used, so 0 is flat, 1 is the pose it was authored at and >1 over-closes
 * into a hard fist. `curls` overrides individual fingers (index -> little),
 * which is what makes a knuckle crack read: the fingers do not all snap at
 * once. `spread` splays the knuckle row, `thumb` folds the thumb across.
 */
export function setHandPose(h, { curl = null, curls = null, spread = null, thumb = null } = {}) {
  if (!h?.userData?.fingers) return;
  const fs = h.userData.fingers;
  for (let i = 0; i < fs.length; i++) {
    const root = fs[i];
    const u = root.userData;
    const c = (curls ? curls[i] : (curl ?? h.userData.baseCurl)) * u.mul;
    root.rotation.x = -u.S * u.k[0] * c;
    u.j2.rotation.x = -u.S * u.k[1] * c;
    u.j3.rotation.x = -u.S * u.k[2] * c;
    if (spread !== null) root.rotation.z = u.spreadZ * spread;
  }
  if (thumb !== null && h.userData.thumb) {
    const S = h.userData.S;
    h.userData.thumb.rotation.set(-S * (0.35 + thumb * 0.55), 0.35, S * 0.75);
    h.userData.thumb2.rotation.x = -S * (0.25 + thumb * 0.75);
  }
}

/**
 * Hammer grip on a handle that runs along Z (a trench knife). The knuckle row
 * lies along the handle with the index finger up against the guard, the palm
 * faces the weapon's left, and the wrist rides above the pommel so the forearm
 * can trail back out of shot.
 */
export function knifeHand(side = 1, opts = {}) {
  const wrap = new THREE.Group();
  const h = buildHand({ side, curl: 1.02, trigger: 0, thumb: 0.55, thumbUp: true, ...opts });
  orient(h, [0, 0, -1], [-1, 0, 0], [0, 1, 0]);
  wrap.add(h);
  wrap.userData.hand = h;
  return wrap;
}

/** Put a hand back in the pose buildHand() authored it in. */
export function resetHandPose(h) {
  if (!h?.userData?.fingers) return;
  setHandPose(h, { curl: h.userData.baseCurl, spread: 1 });
  if (h.userData.thumb) {
    h.userData.thumb.rotation.copy(h.userData.thumbBase);
    h.userData.thumb2.rotation.copy(h.userData.thumb2Base);
  }
}

/**
 * A raised fist for the Pack-a-Punch knuckle crack, with the forearm attached.
 *
 * Frame: the forearm runs down -Y out of the bottom of the group, the fingers
 * point up out of the knuckles, and the BACK of the hand faces +Z — which is
 * what you actually see when you raise your own hands in front of your face.
 * The index side of the knuckle row lands medially (left hand -> +X, right hand
 * -> -X), so the two hands face each other without any extra correction.
 *
 * The hand hangs off a wrist pivot placed at the joint itself, so an animation
 * can cant the hand over without dragging the forearm around with it — a hand
 * reaching across to work on the other one bends at the wrist, it does not
 * rotate the whole arm from the elbow.
 *
 * Returns a wrap group; `userData.hand` is the hand itself (feed it to
 * setHandPose), `userData.wrist` the pivot, `userData.arm` the forearm.
 */
const WRIST_Y = -0.058;
export function crackFist(side, opts = {}) {
  const wrap = new THREE.Group();
  // No glove cuff: the forearm below carries the sleeve and its own wrist ring,
  // and a cuff on the hand would swing off the arm as the wrist bends.
  const h = buildHand({ side, curl: 0.9, trigger: 0, thumb: 0.85, cuff: false, scale: 1.0, ...opts });
  orient(h, [-side, 0, 0], [0, 0, -side], [0, -1, 0]);
  const wrist = new THREE.Group();
  wrist.position.y = WRIST_Y;
  h.position.y = -WRIST_Y;
  wrist.add(h);
  wrap.add(wrist);
  const arm = forearm(0.15);
  wrap.add(arm);
  // Joint ball at the pivot, parented to the WRAP so it never rotates away:
  // it dresses the hand/forearm seam the cuff used to hide, at any bend angle.
  // Without it the hand reads as detached the moment the wrist cants over.
  wrap.add(mesh(sphereGeo(0.031, 10, 8), WM.gloveDark, 0, WRIST_Y, 0));
  wrap.userData.hand = h;
  wrap.userData.wrist = wrist;
  wrap.userData.arm = arm;
  return wrap;
}

/**
 * Sleeved forearm stub that continues out of a wrist along -Y in the hand's own
 * frame. Only used where the arm is actually in shot (the Pack-a-Punch knuckle
 * crack); the weapon poses keep the deliberately stubby cuff instead.
 */
export function forearm(len = 0.13, { glove = WM.gloveDark, sleeve = WM.canvasStrap } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cylGeo(0.030, 0.036, len, 12, false), sleeve, 0, -len / 2 - 0.03, 0));
  g.add(mesh(torusGeo(0.0305, 0.004, 5, 14), glove, 0, -0.032, 0, Math.PI / 2));
  g.add(mesh(torusGeo(0.0345, 0.0045, 5, 14), glove, 0, -len - 0.02, 0, Math.PI / 2));
  g.traverse((o) => { if (o.isMesh) o.userData.isGlove = true; });
  return g;
}

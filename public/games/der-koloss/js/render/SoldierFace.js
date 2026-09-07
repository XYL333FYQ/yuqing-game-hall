// Turn the corpse's face into a man's face.
//
// The shipped humanoid is a screaming zombie: the jaw hangs permanently open
// on a full set of bared teeth, the eye sockets are cut back into empty
// hollows, and the ears stand well off the skull. Dressed in a uniform it
// still reads, unmistakably, as a grimacing skull — which is the single
// loudest remaining "this is a zombie" cue on a teammate.
//
// So the head is RESHAPED, not replaced. This edits the position buffer of a
// CLONE of the shipped geometry: the sculpt, the topology, the skin weights,
// the UVs and every animation clip are untouched, and the face keeps the
// character the artist put in it.
//
// THE THING THAT MUST NEVER BREAK: SkeletonUtils.clone() shares geometry by
// reference, so every zombie in the horde and every soldier are looking at the
// same BufferGeometry. Writing into it in place would hand the entire horde a
// calm, closed-mouth face. Everything below therefore works on a clone, cached
// once for the process, and hands the original back untouched.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Feature geography, measured off the shipped head in HEAD-BONE-LOCAL space
// (x right, y up, z forward; the head bone sits at the jaw hinge, so y runs
// from -0.14 under the chin to 0.43 at the crown).
//
//   teeth      x +-0.090   y -0.088 .. 0.108   z 0.214 .. 0.289
//   gums/lips  x +-0.083   y -0.068 .. 0.216   z 0.192 .. 0.287
//   hair       x +-0.242   y  0.105 .. 0.288   z 0.056 .. 0.211
//
// The tooth rows split around y = 0.01: uppers above, lowers below, with the
// gape between them. That split is where the mouth has to close to.
// ---------------------------------------------------------------------------
const JAW_HINGE = { y: 0.150, z: -0.060 };
const JAW_CLOSE = 0.26;         // radians the mandible swings up
// Swinging about a hinge behind and above the chin lifts it but also throws it
// forward, which trades a hanging jaw for a beak. Sliding the mandible back by
// the same amount keeps the lift and drops the projection.
const JAW_RETRACT = 0.088;
// Where the lips meet AFTER the hinge has closed, which is a little above the
// original gape because the whole mandible has come up with it.
const SEAL_Y = 0.062;
const LIP_Z = 0.255;            // the plane the closed lips sit on
const LIP_SEAL = 0.85;          // how firmly the aperture rim is drawn together
const CAVITY_SEAL = 0.95;       // how completely the painted lining is buried
const TOOTH_RECESS = 0.050;     // extra sink, so no white edge splits the seam

// Deliberately gentle. Driving this harder pushes the socket floor through
// the lids and the rim, and a torn socket looks far worse than a deep one.
const SOCKET_FILL = 0.55;       // how much of each hollow is filled back in
const EAR_TUCK = 0.42;          // how far the ears are pulled toward the skull
const BROW_SOFTEN = 0.45;

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// atlas classification
// ---------------------------------------------------------------------------

/**
 * Read the source atlas once into a pixel buffer.
 *
 * Classifying vertices by the colour the artist painted them is far more
 * reliable than guessing from position: the teeth are bone-white, the gums are
 * red, the hair is near-black and the skin is corpse-green, and those four
 * regions are exactly the ones that need different treatment.
 */
let _pixels = null;
function atlasPixels(texture) {
  if (_pixels !== undefined && _pixels !== null) return _pixels;
  const img = texture?.image;
  if (!img?.width) return (_pixels = null);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  _pixels = { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
  return _pixels;
}

const TOOTH = 1, GUM = 2, HAIR = 3, SKIN = 0;
function atlasLum(pix, u, v) {
  const x = Math.max(0, Math.min(pix.w - 1, Math.round(u * (pix.w - 1))));
  const y = Math.max(0, Math.min(pix.h - 1, Math.round(v * (pix.h - 1))));
  const i = (y * pix.w + x) * 4;
  return (0.3 * pix.data[i] + 0.55 * pix.data[i + 1] + 0.15 * pix.data[i + 2]) / 255;
}

function classify(pix, u, v) {
  if (!pix) return SKIN;
  const x = Math.max(0, Math.min(pix.w - 1, Math.round(u * (pix.w - 1))));
  const y = Math.max(0, Math.min(pix.h - 1, Math.round(v * (pix.h - 1))));
  const i = (y * pix.w + x) * 4;
  const r = pix.data[i] / 255, g = pix.data[i + 1] / 255, b = pix.data[i + 2] / 255;
  const lum = 0.3 * r + 0.55 * g + 0.15 * b;
  if (g > r * 1.12 && g > b * 1.12) return SKIN;      // corpse green
  if (lum < 0.18) return HAIR;
  if (r > g * 1.15 && r > b * 1.15) return GUM;
  if (lum > 0.55) return TOOTH;
  return SKIN;
}

// ---------------------------------------------------------------------------
// the eyes
// ---------------------------------------------------------------------------
//
// The shipped atlas is not a painted face. It is a grid of flat colour swatches
// — the whole head samples six texels in total — and brow, lid, lash, sclera and
// iris all share ONE of them, painted (20,20,20). There is no eye in the texture
// and, because every vertex of the socket carries the same single UV, there is
// no UV space to paint one into either. That is why sculpting could not fix it:
// no amount of pushing the socket floor forward makes a hole that is painted
// black stop reading as a hole, and driving it hard enough to try tore the mesh
// through the lids.
//
// So the sockets are given UVs of their own. Every socket vertex is re-mapped
// across a patch of otherwise-empty atlas, and js/player.js paints a real eye
// into that patch on the per-persona canvas it already builds. Both sides map
// through |x|, so the left eye is the right eye mirrored and one patch does for
// both.
//
// This is only safe because of a property of the shipped mesh that was checked
// rather than assumed: NO triangle spans two swatches. All 7570 faces lie wholly
// inside one flat colour, so re-mapping a whole swatch's worth of vertices
// cannot drag a neighbouring face across the atlas behind it.
//
// And it reaches the soldiers only: this runs on the cloned geometry, and
// BufferGeometry.clone() deep-copies the UV attribute, so the horde is still
// pointing at the original UVs and its sockets stay the empty black they should
// be.
//
// v runs downward, matching the GLTF convention the atlas is sampled with
// (texture.flipY = false), so v0 is the brow edge and v1 the cheek edge.
export const EYE_PATCH = { u0: 0.500, v0: 0.500, u1: 0.750, v1: 0.750 };

// Where the socket swatch lives on the head, in the head-bone-local space the
// measurements at the top of this file are in. Used only to tell the socket
// swatch apart from the other dark one (the hair), which sits above y = 0.232
// and reaches out to |x| = 0.242.
const SOCKET_WINDOW = { ax: 0.230, y0: 0.080, y1: 0.258, z0: 0.020 };

/**
 * Find the atlas swatch the artist used for the eye sockets.
 *
 * Picked by evidence rather than by a hardcoded texel: the socket swatch is the
 * dark one whose vertices sit in a symmetric pair inside the socket window on
 * the front of the face. If nothing matches — a different model, a retextured
 * atlas — this returns null and the head simply keeps the face it had.
 */
function findEyeSwatch(groups) {
  let best = null;
  for (const g of groups.values()) {
    if (g.lum > 0.22) continue;                       // not one of the dark ones
    if (g.maxAx > SOCKET_WINDOW.ax) continue;         // reaches out past the temples
    if (g.minY < SOCKET_WINDOW.y0 || g.maxY > SOCKET_WINDOW.y1) continue;
    if (g.maxZ < SOCKET_WINDOW.z0) continue;          // behind the face
    if (g.minX > -0.03 || g.maxX < 0.03) continue;    // must be a symmetric pair
    if (!best || g.n > best.n) best = g;
  }
  return best;
}

// ---------------------------------------------------------------------------
// the reshape
// ---------------------------------------------------------------------------

const _p = new THREE.Vector3();

/**
 * Reshape one head vertex, in head-local space. Returns nothing; edits `_p`.
 *
 * Every move is weighted by a smooth falloff rather than applied to a hard
 * selection, because a hard boundary tears a seam straight across the cheek.
 */
function reshapeVertex(kind) {
  const { x, y, z } = _p;
  const ax = Math.abs(x);

  // ---- 1. the jaw closes -------------------------------------------------
  // Everything below the mouth line and forward of the hinge is mandible. It
  // swings up about the hinge, carrying the chin, the lower lip and the lower
  // tooth row with it. The falloff reaches well above the mouth line so the
  // cheeks come along softly instead of creasing.
  const jaw = smoothstep(0.115, -0.020, y) * smoothstep(-0.145, -0.020, z);
  if (jaw > 0) {
    const dy = y - JAW_HINGE.y, dz = z - JAW_HINGE.z;
    // NEGATIVE about +X: the chin is in front of and below the hinge, and it
    // has to swing UP and BACK. The other sign drops it, which opens the mouth
    // further — briefly a very convincing scream.
    const a = -JAW_CLOSE * jaw;
    const c = Math.cos(a), s = Math.sin(a);
    _p.y = JAW_HINGE.y + dy * c - dz * s;
    _p.z = JAW_HINGE.z + dy * s + dz * c - JAW_RETRACT * jaw;
  }

  // From here on the jaw has already moved, so the tests below have to read
  // the CURRENT position. Using the pre-rotation values instead was what
  // flattened the entire lower face into a plate the first time round.
  const py = _p.y, pz = _p.z;

  // ---- 2. the lips meet ---------------------------------------------------
  // A closed hinge is not a closed mouth: the aperture is still an oval a
  // sixth of the face tall. The rim of that oval — and only the rim, which is
  // why this region is so tight — is drawn together onto one seam line.
  const lip = smoothstep(0.115, 0.075, ax)
    * smoothstep(-0.080, -0.030, py) * smoothstep(0.190, 0.140, py)
    * smoothstep(0.105, 0.160, pz);   // the whole rim, not just its front lip
  if (lip > 0) _p.y += (SEAL_Y - py) * lip * LIP_SEAL;

  // ---- 3. the mouth lining goes behind the seam ---------------------------
  // Whatever the artist painted as tooth or gum is, by definition, the inside
  // of the mouth. Rather than guess at the cavity geometrically — the attempt
  // that swallowed the chin — take the paint at its word and put all of it on
  // the seam plane and slightly behind it. The throat further back needs no
  // help: once the lips meet it is occluded.
  if (kind === TOOTH || kind === GUM) {
    const inMouth = smoothstep(0.165, 0.120, ax)
      * smoothstep(-0.150, -0.100, py) * smoothstep(0.260, 0.200, py);
    if (inMouth > 0) {
      const w = inMouth * CAVITY_SEAL;
      _p.y += (SEAL_Y - _p.y) * w;
      _p.z += (LIP_Z - _p.z) * w;
      if (kind === TOOTH) { _p.z -= TOOTH_RECESS * w; _p.x *= 1 - 0.10 * w; }
      else _p.z -= TOOTH_RECESS * 0.6 * w;
    }
  }

  // ---- 4. the eye sockets fill in ----------------------------------------
  // The sockets are cut deep enough to read as empty holes in anything but
  // flat light. Pushing the recessed floor forward leaves eyes that sit in
  // shadow — which is what an eye in a socket looks like — rather than gaps.
  const socket = smoothstep(0.055, 0.115, ax) * smoothstep(0.245, 0.195, ax)
    * smoothstep(0.105, 0.150, py) * smoothstep(0.245, 0.195, py);
  if (socket > 0 && pz > 0.02) {
    // Only the back of the recess moves; the brow and cheek edges stay put.
    const depth = smoothstep(0.20, 0.09, pz);
    _p.z += SOCKET_FILL * depth * socket * 0.080;
  }

  // ---- 5. the ears come in ------------------------------------------------
  // They stand off far enough to break the line of a helmet.
  const ear = smoothstep(0.185, 0.245, ax) * smoothstep(0.30, 0.20, py)
    * smoothstep(-0.20, -0.10, pz) * smoothstep(0.16, 0.06, pz);
  if (ear > 0) {
    _p.x -= Math.sign(x) * (ax - 0.175) * EAR_TUCK * ear;
  }

  // ---- 6. the brow unclenches ---------------------------------------------
  // The heavy shelf over the sockets is most of what reads as a snarl.
  const brow = smoothstep(0.185, 0.225, py) * smoothstep(0.310, 0.255, py)
    * smoothstep(0.28, 0.19, ax);
  if (brow > 0 && pz > 0.05) _p.y += BROW_SOFTEN * brow * 0.022;
}

// ---------------------------------------------------------------------------
// geometry surgery
// ---------------------------------------------------------------------------

const _cache = new WeakMap();

/**
 * Give a cloned soldier rig a human face.
 *
 * Call AFTER SkeletonUtils.clone() and BEFORE anything measures the rig. Each
 * distinct source geometry is reshaped once and the result shared by every
 * soldier, so a full lobby costs one extra position buffer.
 *
 * @param {THREE.Object3D} inner  the cloned rig
 * @returns {number} how many meshes were reshaped (0 means nothing changed)
 */
export function humaniseSoldierFace(inner) {
  let done = 0;
  inner.traverse((mesh) => {
    if (!mesh.isSkinnedMesh || !mesh.geometry || !mesh.skeleton) return;
    const source = mesh.geometry;
    let reshaped = _cache.get(source);
    if (reshaped === undefined) {
      reshaped = buildReshaped(mesh, source);
      _cache.set(source, reshaped);
    }
    if (reshaped) { mesh.geometry = reshaped; done++; }
  });
  return done;
}

function buildReshaped(mesh, source) {
  const bones = mesh.skeleton.bones;
  const headIndex = bones.findIndex((b) => b.name === 'Head');
  if (headIndex < 0) return null;
  const position = source.attributes.position;
  const uv = source.attributes.uv;
  const skinIndex = source.attributes.skinIndex;
  const skinWeight = source.attributes.skinWeight;
  if (!position || !skinIndex || !skinWeight) return null;

  // Head-bone space, so the measurements at the top of this file mean what
  // they say whatever the rig is currently scaled to.
  const toHead = mesh.skeleton.boneInverses[headIndex].clone().multiply(mesh.bindMatrix);
  const fromHead = toHead.clone().invert();
  const pix = atlasPixels(mesh.material?.map);

  // Clone so the shipped geometry — the one every zombie in the horde is
  // drawing — is left exactly as it was.
  const out = source.clone();
  const dst = out.attributes.position;

  // ---- pass 1: gather the head, grouped by the swatch each vertex samples --
  // The socket has to be identified before anything is written, because the
  // choice is made from the whole group's extent, not from one vertex.
  const head = [];                       // vertex indices skinned to the head
  const groups = pix && uv ? new Map() : null;
  for (let i = 0; i < position.count; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w > bw) { bw = w; best = skinIndex.getComponent(i, k); }
    }
    if (bones[best]?.name !== 'Head') continue;
    head.push(i);
    if (!groups) continue;
    const u = uv.getX(i), v = uv.getY(i);
    const key = `${Math.round(u * 2048)},${Math.round(v * 2048)}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        n: 0, lum: atlasLum(pix, u, v), verts: [],
        minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
        maxZ: -Infinity, maxAx: 0,
      };
      groups.set(key, g);
    }
    _p.fromBufferAttribute(position, i).applyMatrix4(toHead);
    g.n++;
    g.verts.push(i);
    g.minX = Math.min(g.minX, _p.x); g.maxX = Math.max(g.maxX, _p.x);
    g.minY = Math.min(g.minY, _p.y); g.maxY = Math.max(g.maxY, _p.y);
    g.maxZ = Math.max(g.maxZ, _p.z);
    g.maxAx = Math.max(g.maxAx, Math.abs(_p.x));
  }
  if (!head.length) { out.dispose(); return null; }

  const eye = groups ? findEyeSwatch(groups) : null;
  const isEye = eye ? new Set(eye.verts) : null;

  // ---- pass 2: reshape, remembering where the sockets ended up -------------
  // The socket UVs are laid out against the RESHAPED face, not the sculpted
  // one, so retuning SOCKET_FILL or BROW_SOFTEN slides the paint with the
  // geometry instead of drifting off it.
  const eyeXY = isEye ? new Float32Array(position.count * 2) : null;
  let ax0 = Infinity, ax1 = -Infinity, ey0 = Infinity, ey1 = -Infinity;
  for (const i of head) {
    _p.fromBufferAttribute(position, i).applyMatrix4(toHead);
    reshapeVertex(uv ? classify(pix, uv.getX(i), uv.getY(i)) : SKIN);
    if (isEye && isEye.has(i)) {
      const ax = Math.abs(_p.x);
      eyeXY[i * 2] = ax; eyeXY[i * 2 + 1] = _p.y;
      if (ax < ax0) ax0 = ax;
      if (ax > ax1) ax1 = ax;
      if (_p.y < ey0) ey0 = _p.y;
      if (_p.y > ey1) ey1 = _p.y;
    }
    _p.applyMatrix4(fromHead);
    dst.setXYZ(i, _p.x, _p.y, _p.z);
  }
  dst.needsUpdate = true;

  // ---- pass 3: send the sockets to the eye patch ---------------------------
  // A flat projection onto the front of the face, which is the right one here:
  // the socket is a shallow recess seen head-on, and the whole point is that
  // the painted lids line up with the sculpted ones.
  //
  // |x| runs from the tear duct outward on BOTH sides, so one painted eye
  // serves both and they mirror. The mapping is inset by a texel and a half so
  // that bilinear filtering at the rim never reaches outside the patch.
  const outUV = out.attributes.uv;
  if (isEye && outUV && ax1 - ax0 > 1e-5 && ey1 - ey0 > 1e-5) {
    const INSET = 1.5 / 512;
    const u0 = EYE_PATCH.u0 + INSET, u1 = EYE_PATCH.u1 - INSET;
    const v0 = EYE_PATCH.v0 + INSET, v1 = EYE_PATCH.v1 - INSET;
    for (const i of eye.verts) {
      const s = (eyeXY[i * 2] - ax0) / (ax1 - ax0);
      const t = (ey1 - eyeXY[i * 2 + 1]) / (ey1 - ey0);   // v runs downward
      outUV.setXY(i, u0 + s * (u1 - u0), v0 + t * (v1 - v0));
    }
    outUV.needsUpdate = true;
  }

  out.computeVertexNormals();
  return out;
}

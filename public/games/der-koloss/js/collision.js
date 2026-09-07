// 2D (x/z) circle-vs-AABB collision, the layer every moving body in the game
// stands on. Kept free of Three.js and the DOM — like js/map-layout.js — so CI
// can import it and assert on real behaviour instead of on the shape of the
// source. See scripts/validate-movement-feel.mjs.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function makeBox(cx, cz, w, d, h = 3, y0 = 0) {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, y0, h };
}
export function pointInBox(x, z, b) { return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ; }

// Push a circle (x,z,r) out of an AABB. Returns corrected [x,z].
// Shared result buffer. Every caller destructures the return value on the same
// line, so a single reused pair is safe — and it matters: with environment
// props the world now has ~310 colliders, and a horde of two dozen zombies
// resolving against all of them was allocating tens of thousands of throwaway
// arrays per frame.
const _rcbOut = [0, 0];
function rcb(x, z) { _rcbOut[0] = x; _rcbOut[1] = z; return _rcbOut; }

/**
 * @param {number} fromX where the circle was before this move step
 * @param {number} fromZ ditto
 */
export function resolveCircleBox(x, z, r, b, fromX = x, fromZ = z) {
  const cx = clamp(x, b.minX, b.maxX);
  const cz = clamp(z, b.minZ, b.maxZ);
  const dx = x - cx, dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return rcb(x, z);
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return rcb(cx + (dx / d) * r, cz + (dz / d) * r);
  }
  // Centre inside the box: leave by the side it came IN by, not by the
  // nearest face.
  //
  // A wall run is WALL_T (0.4m) thick and the player radius is 0.35m, so a
  // centre only 0.2m past the near face is already closer to the far one.
  // "Smallest penetration axis" then hands the player the far side and they
  // step out through the brick. That is not a theoretical case: props are
  // deliberately embedded in the walls they stand against (perk machines, wall
  // buys, pipe and cable runs), and it is the PROP's own depenetration that
  // shoves the centre those 0.2m in — which is how you could walk out of the
  // Generator Room through the Animal Lab wall beside Teleporter A.
  //
  // Only when the mover was already inside the box when the step began — a
  // genuinely stuck state, e.g. geometry that moved onto it — is there no
  // came-from side to honour, and the shallowest face is the best exit.
  const pl = x - b.minX, pr = b.maxX - x, pt = z - b.minZ, pb = b.maxZ - z;
  let pen = Infinity, ex = x, ez = z;
  const face = (p, fx, fz, cameFrom) => {
    if (!cameFrom || p >= pen) return;
    pen = p; ex = fx; ez = fz;
  };
  for (const honourEntrySide of [true, false]) {
    face(pl, b.minX - r, z, honourEntrySide ? fromX <= b.minX : true);
    face(pr, b.maxX + r, z, honourEntrySide ? fromX >= b.maxX : true);
    face(pt, x, b.minZ - r, honourEntrySide ? fromZ <= b.minZ : true);
    face(pb, x, b.maxZ + r, honourEntrySide ? fromZ >= b.maxZ : true);
    if (pen < Infinity) break;
  }
  return rcb(ex, ez);
}

// Move a player-sized circle in short collision-resolved increments. Resolving
// only the final frame position lets a fast sprint or a brief frame hitch jump
// completely across a thin wall/door without ever overlapping it.
export function moveCircleWithColliders(x, z, dx, dz, r, colliders, maxStep = Math.max(0.05, r * 0.45)) {
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / maxStep));
  const stepX = dx / steps;
  const stepZ = dz / steps;
  for (let step = 0; step < steps; step++) {
    // Where this sub-step began — and therefore which side of every wall the
    // mover is still entitled to be on when it ends. See resolveCircleBox.
    const fromX = x, fromZ = z;
    x += stepX;
    z += stepZ;
    // Corners, and props embedded in the wall they stand against, take more
    // than one pass to settle: each collider's correction re-penetrates the
    // other. Two iterations left a residual overlap for the next frame to
    // deepen, which is how a squeeze built up in the first place.
    for (let iter = 0; iter < 4; iter++) {
      for (const collider of colliders) [x, z] = resolveCircleBox(x, z, r, collider, fromX, fromZ);
    }
  }
  return [x, z];
}

// Segment vs AABB (2D) — used for bullet raycasts against walls.
export function segmentHitsBox(x0, z0, x1, z1, b) {
  let tmin = 0, tmax = 1;
  const dx = x1 - x0, dz = z1 - z0;
  const axes = [[x0, dx, b.minX, b.maxX], [z0, dz, b.minZ, b.maxZ]];
  for (const [o, d, mn, mx] of axes) {
    if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) return -1; }
    else {
      let t1 = (mn - o) / d, t2 = (mx - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

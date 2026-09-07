function segmentHitsCollider(x0, z0, x1, z1, collider) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  let tmin = 0;
  let tmax = 1;
  const axes = [
    [x0, dx, collider.minX, collider.maxX],
    [z0, dz, collider.minZ, collider.maxZ],
  ];
  for (const [origin, delta, min, max] of axes) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return -1;
      continue;
    }
    let t1 = (min - origin) / delta;
    let t2 = (max - origin) / delta;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

export function interactionLineClear(origin, target, colliders, endpointTolerance = 0.9) {
  if (!origin || !target || !Array.isArray(colliders)) return false;
  const values = [origin.x, origin.y, origin.z, target.x, target.y, target.z];
  if (!values.every(Number.isFinite)) return false;
  for (const collider of colliders) {
    if (collider.noRaycast) continue;
    const cx = (collider.minX + collider.maxX) / 2;
    const cz = (collider.minZ + collider.maxZ) / 2;
    // A usable machine's own body is expected at the endpoint. Structural
    // walls are never ignored, even when a box or perk sits close behind one.
    if (collider.prop && Math.hypot(cx - target.x, cz - target.z) < 1.35) continue;
    const t = segmentHitsCollider(origin.x, origin.z, target.x, target.z, collider);
    if (t < 0 || t >= endpointTolerance) continue;
    const yAt = origin.y + (target.y - origin.y) * t;
    const y0 = collider.y0 || 0;
    if (yAt >= y0 && yAt <= y0 + (collider.h || 3)) return false;
  }
  return true;
}

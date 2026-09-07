// Pure combat contracts used by both local simulation and host validation.

export const MAX_BULLET_PENETRATION = 8;
export const DG2_FLOOR_TRIGGER_RADIUS = 2.25;
export const FRAG_BLAST = Object.freeze({ radius: 4, maxDamage: 700, minDamage: 80 });
export const MELEE_DAMAGE = Object.freeze({ knife: 150, bowie: 1000 });

// How much damage a round keeps after passing through a body.
const RETENTION_BY_CLASS = Object.freeze({
  pistol: 0.62,
  smg: 0.58,
  shotgun: 0.50,
  rifle: 0.68,
  lmg: 0.74,
  sniper: 0.84,
  wonder: 0.85,
});

// How many bodies a round passes through, BY CLASS.
//
// This used to default to 1, and only 17 of 31 weapons set `penetrate`
// explicitly — which meant every SMG (MP40, PPSh, Thompson, Type 100, UMP45,
// AK74u) and the pistol could not collateral at all. Those are exactly the
// guns a player holds for most of a match, so lining up a horde and firing did
// nothing. Every ballistic weapon now penetrates by default and a per-weapon
// `penetrate` value still overrides this.
const PENETRATION_BY_CLASS = Object.freeze({
  pistol: 2,
  smg: 2,
  shotgun: 2,     // per pellet, and shotgun retention is the lowest
  rifle: 2,
  lmg: 3,
  sniper: 4,
  wonder: 3,
  launcher: 1,    // explosives use blast radius, not penetration
  melee: 1,
  tactical: 1,
});

const finitePoint = (point) => point
  && Number.isFinite(Number(point.x))
  && Number.isFinite(Number(point.y))
  && Number.isFinite(Number(point.z));

export function penetrationProfile(stats = {}) {
  const classDefault = PENETRATION_BY_CLASS[stats.cls] ?? 1;
  const maxTargets = Math.max(1, Math.min(MAX_BULLET_PENETRATION,
    Math.floor(Number(stats.penetrate) || classDefault)));
  const defaultRetention = RETENTION_BY_CLASS[stats.cls] ?? 0.6;
  const retention = Math.max(0.35, Math.min(1,
    Number(stats.penetrationRetention) || defaultRetention));
  return { maxTargets, retention };
}

export function hitscanDamage(stats = {}, distance = 0, penetrationIndex = 0) {
  const base = Math.max(0, Number(stats.dmg) || 0);
  let distanceMultiplier = 1;
  if (Number(stats.falloff) > 0) {
    const falloff = Number(stats.falloff);
    distanceMultiplier = Math.max(0.25, Math.min(1, 1 - (Number(distance) - falloff) / falloff));
  }
  const { retention } = penetrationProfile(stats);
  const bodyMultiplier = Math.max(0.35, retention ** Math.max(0, Math.floor(Number(penetrationIndex) || 0)));
  return Math.round(base * distanceMultiplier * bodyMultiplier);
}

export function shotClaimBudget(stats = {}) {
  const rays = Math.max(1, Math.min(16, Math.floor(Number(stats.pellets) || 1)));
  return rays * penetrationProfile(stats).maxTargets;
}

// One authoritative blast curve is shared by solo/host simulation and guest
// validation. A modest quadratic falloff keeps a frag lethal near its center
// without turning the full radius into an unconditional crowd wipe.
export function explosionDamage(distance, {
  radius = FRAG_BLAST.radius,
  maxDamage = FRAG_BLAST.maxDamage,
  minDamage = FRAG_BLAST.minDamage,
} = {}) {
  radius = Math.max(0.01, Number(radius) || 0.01);
  const d = Math.max(0, Number(distance) || 0);
  if (d >= radius) return 0;
  const t = Math.min(1, d / radius);
  return Math.max(0, Math.round(maxDamage + (minDamage - maxDamage) * t * t));
}

export function meleeDamage(hasBowie = false) {
  return hasBowie ? MELEE_DAMAGE.bowie : MELEE_DAMAGE.knife;
}

export function floorArcTargetAllowed({ impact, target, visible = true, radius = DG2_FLOOR_TRIGGER_RADIUS } = {}) {
  if (!visible || !finitePoint(impact) || !finitePoint(target)) return false;
  const horizontal = Math.hypot(target.x - impact.x, target.z - impact.z);
  const vertical = Math.abs(target.y - impact.y);
  return horizontal <= radius && vertical <= 1.35;
}

export function chainArcTargetAllowed({ from, target, visible = true, radius = 8 } = {}) {
  if (!visible || !finitePoint(from) || !finitePoint(target)) return false;
  return Math.hypot(target.x - from.x, target.z - from.z) <= Math.max(0, Number(radius) || 0);
}

// The rendered procedural hound is about 1.55m nose-to-rump and 1.2m tall.
// These zones mirror its skull/snout, chest, hips and animated legs. Local and
// host-side guest validation both consume this exact silhouette.
export function dogHitZones(dog = {}, { interpolationAllowance = 0 } = {}) {
  const x = Number(dog.x) || 0, y = Number(dog.y) || 0, z = Number(dog.z) || 0;
  const yaw = Number(dog.yaw) || 0;
  const phase = Number(dog.anim) || 0;
  const attacking = dog.state === 5;
  const attackT = Math.max(0, Number(dog.stateT) || 0);
  const lean = attacking
    ? -0.22 + Math.sin(Math.min(1, attackT / 0.38) * Math.PI) * 0.3
    : Math.sin(phase * 0.5) * 0.07;
  // Gameplay hounds use the planted-paw director rig, whose root bob is kept
  // to 1.8cm; the legacy lightweight rig may still opt out explicitly.
  const directorRig = dog.directorRig !== false;
  const rootBob = attacking ? 0.06 : Math.abs(Math.sin(phase * 0.5)) * (directorRig ? 0.018 : 0.12);
  const forwardX = Math.sin(yaw), forwardZ = Math.cos(yaw);
  const allowance = Math.max(0, Math.min(0.16, Number(interpolationAllowance) || 0));
  const cos = Math.cos(lean), sin = Math.sin(lean);
  const zone = (name, longitudinal, height, radius, head = false) => {
    const posedForward = longitudinal * cos - height * sin;
    const posedHeight = longitudinal * sin + height * cos;
    return {
      name, head,
      x: x + forwardX * posedForward,
      y: y + rootBob + posedHeight,
      z: z + forwardZ * posedForward,
      r: radius + allowance,
    };
  };
  return [
    zone('head', 0.88, 1.01, 0.31, true),
    zone('chest', 0.14, 0.77, 0.45),
    zone('hips', -0.42, 0.61, 0.37),
    zone('front_legs', 0.31, 0.31, 0.27),
    zone('rear_legs', -0.40, 0.27, 0.26),
  ];
}

export function rayHitZones({ origin, dir, zones = [], maxDistance = Infinity, head = null } = {}) {
  if (!finitePoint(origin) || !finitePoint(dir)) return null;
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len < 0.7) return null;
  const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len;
  let nearest = null;
  for (const zone of zones) {
    if (!finitePoint(zone) || !(Number(zone.r) > 0)) continue;
    if (typeof head === 'boolean' && !!zone.head !== head) continue;
    const ox = zone.x - origin.x, oy = zone.y - origin.y, oz = zone.z - origin.z;
    const projected = ox * dx + oy * dy + oz * dz;
    if (projected < 0 || projected > maxDistance) continue;
    const perpendicularSq = ox * ox + oy * oy + oz * oz - projected * projected;
    const radiusSq = zone.r * zone.r;
    if (perpendicularSq > radiusSq) continue;
    const surface = Math.max(0, projected - Math.sqrt(Math.max(0, radiusSq - perpendicularSq)));
    if (surface > maxDistance) continue;
    if (!nearest || surface < nearest.distance || (surface === nearest.distance && zone.head)) {
      nearest = { zone, distance: surface, centerDistance: projected, head: !!zone.head };
    }
  }
  return nearest;
}

export function shouldSpawnDogRoundReward({ dogRound = false, victimDog = false, remaining = 0, alreadySpawned = false } = {}) {
  return !!dogRound && !!victimDog && Number(remaining) === 0 && !alreadySpawned;
}

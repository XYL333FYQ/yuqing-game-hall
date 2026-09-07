// Maps a world position to an acoustic zone and a footstep surface.
//
// The map topology lives in `map-layout.js`, which is a pure data module with
// no DOM/Three.js dependency, so audio can import it directly. That means the
// reverb zones work with zero cooperation from game.js — `audio.setZone()` /
// `audio.setListenerRoom()` are available for the game to be authoritative,
// but the position fallback below is always live underneath them.

import { MAP_ROOMS } from '../map-layout.js';

// room id -> acoustic zone (see ir.js ZONE_SPECS)
const ROOM_ZONE = {
  upstairsa: 'corridor',
  upstairsg: 'corridor',
  bridge: 'corridor',
  leftcorridor: 'corridor',
  garageentrance: 'corridor',
  chemtesting: 'lab',
  animallab: 'lab',
  genroom: 'lab',
  catwalk: 'hall',
  autogarage: 'hall',
  factory: 'hall',
  mainframe: 'courtyard',
  courtyard: 'courtyard',
};

// room id -> footstep surface
const ROOM_SURFACE = {
  upstairsa: 'metal',
  upstairsg: 'metal',
  bridge: 'metal',
  catwalk: 'metal',
  leftcorridor: 'concrete',
  garageentrance: 'concrete',
  chemtesting: 'metal',
  animallab: 'concrete',
  genroom: 'metal',
  autogarage: 'concrete',
  factory: 'concrete',
  mainframe: 'gravel',
  courtyard: 'gravel',
};

export const DEFAULT_ZONE = 'courtyard';
export const DEFAULT_SURFACE = 'concrete';

/** Room lookup mirroring map.js `roomAt` (stacked rooms come first, yMin gates). */
export function roomIdAt(x, z, y = 0) {
  for (const r of MAP_ROOMS) {
    const t = r.rect;
    if (x < t.minX || x > t.maxX || z < t.minZ || z > t.maxZ) continue;
    if (r.yMin != null && y < r.yMin - 0.6) continue;
    return r.id;
  }
  return null;
}

export function zoneForRoom(roomId) {
  return ROOM_ZONE[roomId] || DEFAULT_ZONE;
}

export function surfaceForRoom(roomId) {
  return ROOM_SURFACE[roomId] || DEFAULT_SURFACE;
}

export function zoneAt(x, z, y = 0) {
  return zoneForRoom(roomIdAt(x, z, y));
}

export function surfaceAt(x, z, y = 0) {
  return surfaceForRoom(roomIdAt(x, z, y));
}

/**
 * Blend weights across zones so a listener near a doorway hears both spaces.
 * Samples the room a couple of metres out along +/-X and +/-Z and averages.
 * Cheap (4 rectangle scans) and only ever called a few times a second.
 */
const PROBE = [[0, 0, 3], [2.6, 0, 1], [-2.6, 0, 1], [0, 2.6, 1], [0, -2.6, 1]];
export function zoneWeightsAt(x, z, y = 0, out = {}) {
  for (const k in out) out[k] = 0;
  let total = 0;
  for (const [dx, dz, w] of PROBE) {
    const zone = zoneAt(x + dx, z + dz, y);
    out[zone] = (out[zone] || 0) + w;
    total += w;
  }
  if (total > 0) for (const k in out) out[k] /= total;
  return out;
}

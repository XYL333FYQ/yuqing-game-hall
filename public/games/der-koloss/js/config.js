// Global game configuration & balance constants
export const CFG = {
  MAX_PLAYERS: 4,
  MAX_ALIVE: 24,            // classic zombie cap
  PLAYER_RADIUS: 0.35,
  PLAYER_HEIGHT: 1.7,
  EYE_HEIGHT: 1.62,
  WALK_SPEED: 4.4,
  SPRINT_SPEED: 7.0,
  ADS_SPEED: 2.6,
  JUMP_VEL: 4.6,
  GRAVITY: 13.5,
  BASE_HP: 165, // 3 zombie hits (55 dmg) before going down
  JUG_HP: 250,
  REGEN_DELAY: 4.5,
  REGEN_RATE: 45,           // hp per second after delay
  ZOMBIE_DMG: 55,           // per swipe (2 hits without Juggernog)
  ZOMBIE_ATK_CD: 1.0,
  BLEEDOUT_TIME: 45,
  REVIVE_TIME: 3.0,
  QR_REVIVE_TIME: 1.5,
  START_POINTS: 500,
  POINTS_HIT: 10,
  POINTS_KILL: 60,
  POINTS_HEADSHOT: 100,
  POINTS_KNIFE_KILL: 130,
  POINTS_BOARD: 10,
  NUKE_POINTS: 400,
  INTERACT_DIST: 2.6,
  SNAPSHOT_HZ: 15,
  INPUT_HZ: 20,
  INTERP_DELAY: 0.12,       // seconds of interpolation buffer for remote entities
  COLORS: ['#f2f2f2', '#6ea8ff', '#7dd87d', '#ffb347'], // player score colors
};

// Wave structure (World at War style scaling)
export function roundZombieCount(round, players) {
  const mult = 1 + 0.6 * (players - 1);
  return Math.floor(Math.min(6 + (round - 1) * 4, 90) * mult);
}
export function roundZombieHealth(round) {
  if (round <= 1) return 150;
  if (round <= 9) return 150 + (round - 1) * 100; // 250..950 (classic ramp)
  // past round 9 health grows LINEARLY (~100/round) instead of exponentially —
  // Pack-a-Punched guns + headshots stay meaningfully lethal even at round 40
  return 950 + (round - 9) * 100;
}
export function roundSpawnDelay(round) {
  return Math.max(0.35, 2.0 * Math.pow(0.9, round - 1));
}
export function nextDogRound(lastDogRound, anchorRound = 1, random = Math.random) {
  if (lastDogRound === 0) {
    if (anchorRound <= 5) return 5;                              // classic: first hounds on round 5
    return anchorRound + 3 + Math.floor(random() * 3);           // late start cheat: 3-5 rounds later
  }
  return lastDogRound + 5 + Math.floor(random() * 3);            // then every 5-7 rounds
}
export function dogCount(round, players) {
  return Math.min(4 + Math.floor(round / 3) * players, 18);
}

export const STORE_KEY = 'dr_options_v1';
export const NAME_KEY = 'dr_player_name';

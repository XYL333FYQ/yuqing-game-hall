// Pure gameplay rules shared by the live systems and deterministic validators.

export const ROUND_INTERMISSION_SECONDS = 8;
export const PAP_PROCESS_SECONDS = 4;
export const PAP_READY_TIMEOUT_SECONDS = 30;

export function papLifecyclePhase(state) {
  if (!state?.busy) return 'idle';
  return state.ready ? 'ready' : 'processing';
}

// Reliable PaP events are still checked against the active owner and weapon.
// This prevents a delayed ready/take packet from completing a newer cycle.
export function papEventMatches(state, pid, weapon) {
  return !!state?.busy && state.owner === pid && state.weapon === weapon;
}

// One authoritative timeline keeps the perk grant, first-person animation,
// remote cosmetic, bottle impact, and belch in the same order on every peer.
export const PERK_DRINK_TIMELINE = Object.freeze({
  raiseEnd: 0.58,
  gulpEnd: 1.72,
  grantAt: 1.56,
  throwAt: 2.18,
  breakAt: 2.72,
  // Leave the glass transient room to decay so the burp reads as a separate,
  // deliberately sequenced beat instead of being masked by the impact.
  belchAt: 3.12,
  duration: 4.15,
});

export const PERK_IDS = Object.freeze(['jug', 'speed', 'dtap', 'qr']);

export function isPerkId(id) { return PERK_IDS.includes(id); }

export function perkDrinkPhase(elapsed) {
  const t = Math.max(0, Number(elapsed) || 0);
  if (t < PERK_DRINK_TIMELINE.raiseEnd) return 'raise';
  if (t < PERK_DRINK_TIMELINE.gulpEnd) return 'drink';
  if (t < PERK_DRINK_TIMELINE.throwAt) return 'lower';
  if (t < PERK_DRINK_TIMELINE.breakAt) return 'throw';
  if (t < PERK_DRINK_TIMELINE.duration) return 'finish';
  return 'done';
}

// The first two completed Mystery Box spins must always resolve to a weapon.
// A Teddy may therefore appear no earlier than the third use.
export const MIN_BOX_WEAPON_RESULTS_BEFORE_TEDDY = 2;

export function mysteryBoxTeddyChance(completedWeaponSpins) {
  const completed = Math.max(0, Math.floor(Number(completedWeaponSpins) || 0));
  if (completed < MIN_BOX_WEAPON_RESULTS_BEFORE_TEDDY) return 0;
  const currentUse = completed + 1;
  return Math.min(0.28, 0.06 + currentUse * 0.02);
}

export function createConcurrencyGate(maxConcurrent) {
  const max = Math.max(1, Math.floor(Number(maxConcurrent) || 1));
  let active = 0;
  return {
    tryAcquire() {
      if (active >= max) return false;
      active++;
      return true;
    },
    release() { active = Math.max(0, active - 1); },
    get active() { return active; },
    get max() { return max; },
  };
}

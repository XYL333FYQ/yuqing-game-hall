// Shell-casing behaviour.
//
// Whether a weapon throws brass — and what that brass sounds like when it hits
// the floor — is a property of the WEAPON, not of how loud its shot is. The
// engine used to decide this with `CONCUSSIVE`, the set of shots that shake the
// player's ears, which is a different question with a different answer: the Ray
// Gun and the Wunderwaffe DG-2 have no cartridge at all, yet one of them was in
// that set and one was not, so the Ray Gun clattered empty cases onto the
// concrete after every shot.
//
// js/weapons.js now carries an explicit `casing` field per weapon and publishes
// `CASING_BY_SFX` off the definitions themselves, so a new weapon cannot
// silently inherit someone else's ejection behaviour. This module holds the
// play-time shaping for each kind; it deliberately has no imports so the audio
// engine can read it without dragging the view-model graph in with it.

/**
 * kind -> play-time shaping.
 *
 *   sample  procedural/recorded family, suffixed with the floor surface
 *   vol     play gain. A cartridge case is a 12-gram object two metres away:
 *           it is meant to be a detail under the shot, not an event. These read
 *           high next to the rest of the engine's gains because the takes are
 *           mastered to -31 LUFS rather than the library's -26 (a short dry
 *           clatter cannot reach -26 without being limited flat); net of that,
 *           a case now plays about 2.5 dB under where it used to.
 *   rate    playback-rate window (per-shot variety, and size within the kind)
 *   fall    seconds between the case leaving the port and the first bounce
 */
export const CASING_KINDS = Object.freeze({
  // small, thin-walled, bright: .45 ACP, 9x19, 7.62x25, .30 Carbine
  pistol: Object.freeze({ sample: 'casing_pistol', vol: 0.36, rate: [1.00, 1.14], fall: [0.24, 0.34] }),
  // longer and heavier, so lower and slower to settle: 7.92x57, .30-06, 5.45x39
  rifle: Object.freeze({ sample: 'casing_rifle', vol: 0.42, rate: [0.94, 1.06], fall: [0.28, 0.40] }),
  // a 12-gauge hull is a plastic tube with a brass head — it thuds and stops
  shell: Object.freeze({ sample: 'casing_shell', vol: 0.46, rate: [0.93, 1.05], fall: [0.30, 0.44] }),
  // belt guns throw a disintegrating link with every case: two objects, more clutter
  link: Object.freeze({ sample: 'casing_link', vol: 0.32, rate: [0.98, 1.12], fall: [0.22, 0.32] }),
});

/** Every legal value of a weapon's `casing` field. `none` ejects nothing. */
export const CASING_KIND_NAMES = Object.freeze(['none', ...Object.keys(CASING_KINDS)]);

/**
 * A bolt gun holds its case until the shooter works the bolt, so the clatter
 * belongs to the bolt cycle rather than to the shot. This matches the moment
 * game.js schedules `bolt_*_out`.
 */
export const BOLT_EJECT_DELAY = 0.19;

/** Listener's footstep surface -> the surface the case lands on. */
export const CASING_SURFACE = Object.freeze({
  concrete: 'concrete', metal: 'metal', gravel: 'concrete', water: 'concrete',
});

/**
 * FILE_MAP also exposes generic per-class shot names (`shot_rifle`, `shot_smg`,
 * ...) that no weapon definition owns; they are the fallback game.js reaches for
 * when a weapon has no sound of its own. Give them the ejection behaviour of
 * their class so the fallback path does not fall back to silence.
 */
export const GENERIC_CASING = Object.freeze({
  shot_smg: Object.freeze({ kind: 'pistol', bolt: false, ping: false }),
  shot_rifle: Object.freeze({ kind: 'rifle', bolt: false, ping: false }),
  shot_sniper: Object.freeze({ kind: 'rifle', bolt: true, ping: false }),
  shot_shotgun: Object.freeze({ kind: 'shell', bolt: false, ping: false }),
  shot_lmg: Object.freeze({ kind: 'link', bolt: false, ping: false }),
});

/** Sample names the bank must provide: one family per kind per surface. */
export const CASING_SAMPLE_NAMES = Object.freeze(
  Object.values(CASING_KINDS).flatMap((k) => ['concrete', 'metal'].map((s) => `${k.sample}_${s}`)),
);

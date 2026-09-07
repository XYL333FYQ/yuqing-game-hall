// Asset pipeline: loads CC0 GLB models, CC0 PBR textures, and generated audio.
// Reports progress for the loading screen. Audio decodes lazily after user gesture.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';

// Every prop, machine and weapon in the game is generated in code; these are the
// only meshes loaded from disk. Barrel.gltf was in this manifest with no consumer,
// so it cost a blocking load job and a loading-bar slot for nothing. Blood_1/2
// left the same way once the map's floor blood became the same splat decal the
// FX pool stamps (js/map.js). Both files are still in assets/models/props.
const MODELS = {
  zombie1: 'assets/models/zombies/Zombie_Basic.gltf',
  zombie2: 'assets/models/zombies/Zombie_Chubby.gltf',
};

const TEXSETS = {
  brick: 'assets/tex/brick__Bricks075A',
  concrete: 'assets/tex/concrete__Concrete034',
  rust: 'assets/tex/rusted_metal__Rust004',
  wood: 'assets/tex/wood_planks__Planks037A',
  plate: 'assets/tex/metal_floor_plate__DiamondPlate008C',
  dirt: 'assets/tex/dirt_road__Ground048',
};

// Same-origin models are required presentation assets. A short retry recovers
// transient fetch/decode failures; persistent failures stay visible in
// `modelFailures` while gameplay uses the identity-safe procedural fallback.
const MODEL_LOAD_ATTEMPTS = 2;
const MODEL_RETRY_DELAY_MS = 150;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadModelWithRetry(loader, key, url) {
  let lastError;
  for (let attempt = 1; attempt <= MODEL_LOAD_ATTEMPTS; attempt++) {
    try {
      return await loader.loadAsync(url);
    } catch (error) {
      lastError = error;
      if (attempt < MODEL_LOAD_ATTEMPTS) {
        console.warn(`[assets] model "${key}" failed attempt ${attempt}; retrying`, error);
        await delay(MODEL_RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}

const SOUNDS = [
  'shot_pistol',
  'shot_magnum',
  'shot_raygun',
  'shot_dg2',
  'shot_rocket',
  'shot_kar98',
  'shot_gewehr43',
  'shot_m1a1',
  'shot_mp40',
  'shot_thompson',
  'shot_type100',
  'shot_dbshotgun',
  'shot_trench',
  'shot_stg44',
  'shot_fg42',
  'shot_bar',
  'shot_mg42',
  'shot_browning',
  'shot_ptrs41',
  'shot_panzerschreck',
  // Generic weapon-class fallbacks. These files already ship but were never
  // decoded, so `audio.play(s.sfx || 'shot_rifle')` fell through to synth.
  'shot_rifle',
  'shot_smg',
  'shot_lmg',
  'shot_sniper',
  'shot_shotgun',
  'explosion',
  'dry',
  'melee',
  'rel_magout',
  'rel_magin',
  'rel_boltopen',
  'rel_boltclose',
  'rel_slide',
  'rel_charge',
  'rel_shell',
  'rel_clip',
  'rel_open',
  'rel_close',
  'rel_cellout',
  'rel_cellin',
  'rel_belt',
  'rel_cover',
  'rel_rocket',
  'rel_pump',
  'shot_m1garand',
  'shot_mosin',
  'shot_springfield',
  'shot_ppsh',
  'shot_ump45',
  'shot_acr',
  'shot_famas',
  'shot_ak74u',
  'shot_galil',
  'shot_commando',
  'rel_ping',
  'ann_insta',
  'ann_double',
  'ann_maxammo',
  'ann_nuke',
  'ann_dogs',
  'monkey_windup',
  'monkey_cymbal',
  'groan1',
  'groan2',
  'groan3',
  'groan4',
  'groan5',
  'groan6',
  'groan7',
  'groan8',
  'groan9',
  'groan10',
  'snarl1',
  'snarl2',
  'snarl3',
  'snarl4',
  'zdeath1',
  'zdeath2',
  'zdeath3',
  'zdeath4',
  'dog_growl',
  'dog_growl2',
  'dog_howl',
  'dog_death',
  'board_tear',
  'board_build',
  'door_open',
  'buy',
  'deny',
  'drink',
  'bottle_break',
  'belch',
  'power',
  'teleporter',
  'pap',
  'box_spin',
  'teddy',
  'round_start',
  'round_end',
  'gameover',
  'nuke',
  'maxammo',
  'double',
  'insta',
  'hurt',
  'hurt1',
  'hurt2',
  'hurt3',
  'bolt_kar98_out',
  'bolt_kar98_in',
  'bolt_mosin_out',
  'bolt_mosin_in',
  'bolt_springfield_out',
  'bolt_springfield_in',
  'count_tick',
  'count_go',
  'knuckles',
  'inspect_rifle',
  'inspect_smg',
  'inspect_pistol',
  'inspect_sniper',
  'inspect_lmg',
  'inspect_shotgun',
  'inspect_wonder',
  'inspect_launcher',
  'revive',
  'step1',
  'step2',
  'step3',
  'step4',
  'hitmarker',
  'grenade',
  'perk_jug',
  'perk_speed',
  'perk_dtap',
  'perk_qr',
  'music_box',
  'ambience',
  'menu_music',
  'trap',
  'pap_done',
  'ui',
  'pap_insert',
  'tele_zap',
  'pap_zap',
  'shot_kar98_pap',
  'shot_gewehr43_pap',
  'shot_m1a1_pap',
  'shot_mp40_pap',
  'shot_thompson_pap',
  'shot_type100_pap',
  'shot_dbshotgun_pap',
  'shot_trench_pap',
  'shot_stg44_pap',
  'shot_fg42_pap',
  'shot_bar_pap',
  'shot_mg42_pap',
  'shot_browning_pap',
  'shot_ptrs41_pap',
  'shot_panzerschreck_pap',
  'shot_m1garand_pap',
  'shot_mosin_pap',
  'shot_springfield_pap',
  'shot_ppsh_pap',
  'shot_ump45_pap',
  'shot_acr_pap',
  'shot_famas_pap',
  'shot_ak74u_pap',
  'shot_galil_pap',
  'shot_commando_pap',
  'shot_raygun_pap',
  'shot_dg2_pap',
  'shot_pistol_pap',
  'shot_magnum_pap',
  'vox_dempsey_take1',
  'vox_dempsey_take2',
  'vox_dempsey_take3',
  'vox_dempsey_take_wonder1',
  'vox_nikolai_take1',
  'vox_nikolai_take2',
  'vox_nikolai_take3',
  'vox_nikolai_take_wonder1',
  'vox_takeo_take1',
  'vox_takeo_take2',
  'vox_takeo_take3',
  'vox_takeo_take_wonder1',
  'vox_richtofen_take1',
  'vox_richtofen_take2',
  'vox_richtofen_take3',
  'vox_richtofen_take_wonder1',
  'vox_dempsey_start1',
  'vox_dempsey_round1',
  'vox_dempsey_round2',
  'vox_dempsey_reload1',
  'vox_dempsey_reload2',
  'vox_dempsey_kill1',
  'vox_dempsey_kill2',
  'vox_dempsey_kill3',
  'vox_dempsey_down1',
  'vox_dempsey_revive1',
  'vox_dempsey_power1',
  'vox_dempsey_tele1',
  'vox_dempsey_pap1',
  'vox_dempsey_dog1',
  'vox_nikolai_start1',
  'vox_nikolai_round1',
  'vox_nikolai_round2',
  'vox_nikolai_reload1',
  'vox_nikolai_reload2',
  'vox_nikolai_kill1',
  'vox_nikolai_kill2',
  'vox_nikolai_kill3',
  'vox_nikolai_down1',
  'vox_nikolai_revive1',
  'vox_nikolai_power1',
  'vox_nikolai_tele1',
  'vox_nikolai_pap1',
  'vox_nikolai_dog1',
  'vox_takeo_start1',
  'vox_takeo_round1',
  'vox_takeo_round2',
  'vox_takeo_reload1',
  'vox_takeo_kill1',
  'vox_takeo_kill2',
  'vox_takeo_kill3',
  'vox_takeo_down1',
  'vox_takeo_revive1',
  'vox_takeo_power1',
  'vox_takeo_tele1',
  'vox_takeo_pap1',
  'vox_takeo_dog1',
  'vox_richtofen_start1',
  'vox_richtofen_round1',
  'vox_richtofen_round2',
  'vox_richtofen_reload1',
  'vox_richtofen_kill1',
  'vox_richtofen_kill2',
  'vox_richtofen_kill3',
  'vox_richtofen_down1',
  'vox_richtofen_revive1',
  'vox_richtofen_power1',
  'vox_richtofen_tele1',
  'vox_richtofen_pap1',
  'vox_richtofen_dog1',

  // --- ElevenLabs-generated combat/foley layers -----------------------------
  // Mono, 96 kbps, peak-normalised to -3 dBFS, silence-trimmed so the transient
  // sits on sample 0. audio.js falls back to an identically-named procedural
  // render (js/audio/synth.js) for any of these that fails to decode.
  'impact_concrete1', 'impact_concrete2', 'impact_concrete3',
  'impact_metal1', 'impact_metal2', 'impact_metal3',
  'impact_wood1', 'impact_wood2', 'impact_wood3',
  'impact_dirt1', 'impact_dirt2', 'impact_dirt3',
  'impact_glass1', 'impact_glass2', 'impact_glass3',
  'impact_flesh1', 'impact_flesh2', 'impact_flesh3',
  'ricochet1', 'ricochet2', 'ricochet3',
  'whizby1', 'whizby2', 'whizby3',
  // Shell casings are per casing KIND per floor surface: a 12-gauge hull does
  // not sound like a .45 case, and neither of them sounds like a belt link.
  // See js/audio/casings.js for which weapon throws which.
  'casing_pistol_concrete1', 'casing_pistol_concrete2', 'casing_pistol_concrete3',
  'casing_pistol_metal1', 'casing_pistol_metal2', 'casing_pistol_metal3',
  'casing_rifle_concrete1', 'casing_rifle_concrete2', 'casing_rifle_concrete3',
  'casing_rifle_metal1', 'casing_rifle_metal2', 'casing_rifle_metal3',
  'casing_shell_concrete1', 'casing_shell_concrete2', 'casing_shell_concrete3',
  'casing_shell_metal1', 'casing_shell_metal2', 'casing_shell_metal3',
  'casing_link_concrete1', 'casing_link_concrete2', 'casing_link_concrete3',
  'casing_link_metal1', 'casing_link_metal2', 'casing_link_metal3',
  'step_concrete1', 'step_concrete2',
  'step_metal1', 'step_metal2',
  'step_gravel1', 'step_gravel2',
  'step_water1', 'step_water2',
  'foley_sling', 'foley_cloth', 'foley_raise', 'foley_lower', 'foley_slide',
  'sub_impact', 'explosion_tail',
  'stinger_round_start', 'stinger_round_end',
  'amb_metal1', 'amb_metal2',
  'amb_drip1', 'amb_drip2',
  'amb_buzz',
  'amb_artillery1', 'amb_artillery2',
];

// Every mp3 in assets/audio was re-mastered in the `mix-1` pass: the gunshots
// were re-cut with a real transient and the whole library was normalised to
// per-family loudness targets under a -1 dBTP ceiling. A returning player's
// edge/browser cache still holds the old, wildly uneven takes, so the whole set
// moves behind one build token rather than the per-file tokens used before.
const AUDIO_BUILD = 'mix-1';
// Per-file revision tokens survive alongside it: they identify a specific take
// (the ElevenLabs perk shatter/belch that the perk-drink timeline is synced to)
// and are composed with the build token rather than replaced by it.
const AUDIO_REVISIONS = Object.freeze({
  bottle_break: 'perk-v4', belch: 'perk-v4',
  // The empty-mag ping was a 6.6 kHz sine bell; it is now a struck steel clip.
  rel_ping: 'ping-v2',
});
const audioUrl = (name, extension) =>
  `assets/audio/${name}.${extension}?v=${AUDIO_BUILD}${AUDIO_REVISIONS[name] ? `-${AUDIO_REVISIONS[name]}` : ''}`;

class Assets {
  constructor() {
    this.models = {};
    this.modelFailures = {};
    this.textures = {};
    this.audioBuffers = {};
    this.ready = false;
    this.audioReady = false;
  }

  async load(onProgress) {
    const gl = new GLTFLoader();
    const tl = new THREE.TextureLoader();
    const jobs = [];
    let done = 0;
    const total = Object.keys(MODELS).length + Object.keys(TEXSETS).length * 3;
    const tick = () => { done++; onProgress?.(done / total); };

    this.modelFailures = {};
    for (const [key, url] of Object.entries(MODELS)) {
      jobs.push(loadModelWithRetry(gl, key, url)
        .then((g) => { this.models[key] = g; })
        .catch((error) => {
          this.modelFailures[key] = {
            url,
            message: error?.message || String(error),
          };
          console.error(`[assets] model "${key}" unavailable after ${MODEL_LOAD_ATTEMPTS} attempts; using safe fallback`, error);
        })
        .finally(tick));
    }
    for (const [key, base] of Object.entries(TEXSETS)) {
      const load = (suffix, srgb) => tl.loadAsync(`${base}_1K_${suffix}.jpg`).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        // Ground planes are viewed almost edge-on across tens of metres; 8x
        // is not enough anisotropy to keep them out of moire at that angle.
        t.anisotropy = 16;
        this.textures[key + '_' + suffix] = t;
        tick();
      }).catch(() => tick());
      jobs.push(load('Color', true), load('NormalGL', false), load('Roughness', false));
    }
    await Promise.all(jobs);
    this.ready = true;
  }

  // Decode with a small worker pool. Hundreds of parallel fetch/decode jobs
  // caused request storms and long main-thread stalls on lower-end browsers.
  async loadAudio(ctx) {
    let next = 0;
    const worker = async () => {
      while (next < SOUNDS.length) {
        const name = SOUNDS[next++];
        try {
          let response = await fetch(audioUrl(name, 'mp3'));
          if (!response.ok) response = await fetch(audioUrl(name, 'm4a'));
          if (!response.ok) continue;
          this.audioBuffers[name] = await ctx.decodeAudioData(await response.arrayBuffer());
        } catch (e) {}
      }
    };
    await Promise.all(Array.from({ length: Math.min(8, SOUNDS.length) }, worker));
    this.audioReady = true;
  }

  sound(name) { return this.audioBuffers[name] || null; }

  tex(key, rx = 1, ry = 1) {
    const c = this.textures[key + '_Color'];
    if (c) { const t = c.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; }
    return null;
  }
  texSet(key, rx = 1, ry = 1) {
    const out = {};
    for (const [suffix, prop] of [['Color', 'map'], ['NormalGL', 'normalMap'], ['Roughness', 'roughnessMap']]) {
      const t = this.textures[key + '_' + suffix];
      if (t) { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; out[prop] = c; }
    }
    return out;
  }
}

export const assets = new Assets();

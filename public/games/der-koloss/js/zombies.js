// Zombies: animated CC0 models (Quaternius, CC0) driven by the AI state machine,
// classic round structure with health scaling, hellhounds, crawlers.
import * as THREE from 'three';
import { clone as skClone } from '../vendor/SkeletonUtils.js';
import { CFG, roundZombieCount, roundZombieHealth, roundSpawnDelay, nextDogRound, dogCount } from './config.js';
import { clamp, lerp, rand, choice, resolveCircleBox, moveCircleWithColliders, dist2D } from './utils.js';
import { assets } from './assets.js';
import { elevationAwareRiseCandidate, roomDepthsToPlayers } from './map-layout.js';
import { getNavGrid, NAV_RADIUS } from './navmesh.js';
import { enhanceCreatureMaterial, randomCreatureLook, setCreatureUniform } from './render/CreatureShading.js';
import { attachZombieDetail, setZombieDetailVisible } from './render/ZombieDetail.js';
import { buildHellhound, setHellhoundLOD, prewarmHellhounds, HOUND_VARIANTS } from './render/HellhoundModel.js';

// How far below the floor a zombie starts. Deep enough that the torso is
// genuinely hidden until it heaves clear, not just the feet.
const RISE_DEPTH = 2.05;
// Share of a wave that may rise out of the ground instead of climbing in
// through a boarded window. Windows are the rule; a rise is an occasional
// punctuation, not a fallback for "all the windows are busy".
const RISER_SHARE = 0.06;
// Last-resort escape hatch. Only reachable if every window somehow stays
// occupied forever, which occupancy release on kill and on climb-through
// should already prevent. Exists so a round can never hard-stall.
const SPAWN_QUEUE_PATIENCE = 60;
// How long a zombie keeps drifting after the horde goes dormant. Cutting the
// root to zero on the same frame the run blends into an idle reads as a pause
// button; half a second of decaying drift reads as a body losing interest.
const DORMANT_SETTLE = 0.5;
// How close a body has to get to a navigation waypoint before it commits to the
// next one. Slightly wider than a grid cell, so a fast hound taking a shallow
// corner does not orbit a waypoint it has already effectively passed.
const WAYPOINT_R = 0.7;
// ...and how far below or above it the body may be and still count as there.
// Generous enough to absorb a ramp's slope between two cells, tight enough that
// a waypoint one deck up is never satisfied from the floor underneath it.
const WAYPOINT_Y = 1.0;
// Headings, in degrees off the desired one, tried when a straight step is
// blocked. This is what walks a body around the corner of a crate or a stair
// stringer instead of grinding into it. Both signs of each are probed.
const DEFLECT = [28, 55, 82, 110];
// Whole paths any single frame may compute. Close-quarters routes cost ~0.03ms,
// but a body on the far side of the map planning its way to the mainframe costs
// a few, and a whole wave doing that on the frame a round starts is a visible
// hitch. Two per frame clears a 24-strong wave in about a fifth of a second, and
// the ones still waiting keep walking the route they already have — which is why
// deferring costs nothing the player can see.
const PATHS_PER_FRAME = 2;
const ZSTATES = { RISE: 0, APPROACH: 1, TEAR: 2, CLIMB: 3, CHASE: 4, ATTACK: 5, DIE: 6, CRAWLER: 7 };

// The Teleporter C catwalk is a destination, never a spawn surface. Enemies
// must enter from the factory floor and use the physical west stair flight.
export function isZombieSpawnRoomAllowed(room) {
  return room !== 'catwalk';
}

// ---------- procedural hellhound ----------
// The hound's geometry, materials and rig live in render/HellhoundModel.js:
// it is a merged, bone-parented build shared across every instance, so a pack
// of eight costs a handful of draw calls instead of ~90 loose meshes each.
const fallbackZombieClothMat = new THREE.MeshStandardMaterial({ color: 0x444b4d, roughness: 1 });
const fallbackZombieSkinMat = new THREE.MeshStandardMaterial({ color: 0x879078, roughness: 1 });

function dpart(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

// ---- proportion presets: longer limbs, slim torso, small head, hunch ----
// [sx, sy, sz] per bone name. Chained down the hierarchy, so limbs read longer.
const PROP_PRESETS = [
  { // "shambler" — average but de-cartooned
    hunch: 0.08,
    scale: {
      Head: [0.7, 0.7, 0.7], Neck: [0.9, 1.12, 0.9],
      Torso: [0.9, 1.03, 0.86], Abdomen: [0.88, 1.0, 0.85], Hips: [0.92, 1.0, 0.9],
      'Shoulder.L': [0.9, 0.95, 0.9], 'Shoulder.R': [0.9, 0.95, 0.9],
      'UpperArm.L': [0.8, 1.1, 0.8], 'UpperArm.R': [0.8, 1.1, 0.8],
      'LowerArm.L': [0.78, 1.12, 0.78], 'LowerArm.R': [0.78, 1.12, 0.78],
      'UpperLeg.L': [0.84, 1.05, 0.84], 'UpperLeg.R': [0.84, 1.05, 0.84],
      'LowerLeg.L': [0.84, 1.05, 0.84], 'LowerLeg.R': [0.84, 1.05, 0.84],
    },
  },
  { // "cadaver" — gaunt, long-armed, deep hunch
    hunch: 0.13,
    scale: {
      Head: [0.66, 0.66, 0.66], Neck: [0.85, 1.18, 0.85],
      Torso: [0.82, 1.05, 0.78], Abdomen: [0.8, 1.0, 0.76], Hips: [0.86, 1.0, 0.84],
      'Shoulder.L': [0.85, 0.9, 0.85], 'Shoulder.R': [0.85, 0.9, 0.85],
      'UpperArm.L': [0.72, 1.16, 0.72], 'UpperArm.R': [0.72, 1.16, 0.72],
      'LowerArm.L': [0.7, 1.18, 0.7], 'LowerArm.R': [0.7, 1.18, 0.7],
      'UpperLeg.L': [0.8, 1.07, 0.8], 'UpperLeg.R': [0.8, 1.07, 0.8],
      'LowerLeg.L': [0.8, 1.07, 0.8], 'LowerLeg.R': [0.8, 1.07, 0.8],
    },
  },
  { // "brute" — heavy shoulders/arms, forward lean
    hunch: 0.10,
    scale: {
      Head: [0.68, 0.68, 0.68], Neck: [0.95, 1.05, 0.95],
      Torso: [1.04, 1.02, 0.98], Abdomen: [0.95, 1.0, 0.9], Hips: [0.95, 1.0, 0.92],
      'Shoulder.L': [1.12, 1.05, 1.1], 'Shoulder.R': [1.12, 1.05, 1.1],
      'UpperArm.L': [0.95, 1.14, 0.95], 'UpperArm.R': [0.95, 1.14, 0.95],
      'LowerArm.L': [0.9, 1.14, 0.9], 'LowerArm.R': [0.9, 1.14, 0.9],
      'UpperLeg.L': [0.9, 1.04, 0.9], 'UpperLeg.R': [0.9, 1.04, 0.9],
      'LowerLeg.L': [0.9, 1.04, 0.9], 'LowerLeg.R': [0.9, 1.04, 0.9],
    },
  },
];

export function createZombieModel(dog = false, { directorRig = false, variant = null } = {}) {
  if (dog) {
    // Merged, bone-parented hellhound. `directorRig` is now implicit — the
    // planted-paw hip -> knee -> paw chain is the only rig there is, and both
    // gameplay and the cinematic director consume the same one.
    return buildHellhound(variant == null ? Math.floor(Math.random() * HOUND_VARIANTS) : variant);
  }
  const g = new THREE.Group();
  // A normal zombie model failing to load must never turn into a hellhound.
  // This low-poly humanoid is deliberately simple, but it preserves the entity's
  // silhouette and audio/behavior identity while the match remains playable.
  const torso = dpart(0.48, 0.72, 0.26, fallbackZombieClothMat); torso.position.y = 1.12;
  const head = dpart(0.3, 0.34, 0.28, fallbackZombieSkinMat); head.position.y = 1.68;
  const armL = dpart(0.15, 0.72, 0.15, fallbackZombieSkinMat); armL.position.set(-0.34, 1.12, 0);
  const armR = dpart(0.15, 0.72, 0.15, fallbackZombieSkinMat); armR.position.set(0.34, 1.12, 0);
  const legL = dpart(0.19, 0.82, 0.2, fallbackZombieClothMat); legL.position.set(-0.13, 0.42, 0);
  const legR = dpart(0.19, 0.82, 0.2, fallbackZombieClothMat); legR.position.set(0.13, 0.42, 0);
  g.add(torso, head, armL, armR, legL, legR);
  g.userData = { dog: false, fallbackZombie: true, torso, head, armL, armR, legL, legR };
  return g;
}

function enforceEnemyVisualIdentity(z) {
  const renderedAsDog = z.model?.userData?.dog === true;
  if (renderedAsDog === !!z.dog) return;

  // Self-heal if a future asset/fallback refactor mismatches gameplay identity.
  // A basic fallback is preferable to corrupting the wave or lying to the player
  // about what enemy they are fighting.
  console.error('Enemy visual identity mismatch; replacing with safe fallback', {
    id: z.id,
    gameplayDog: !!z.dog,
    renderedAsDog,
  });
  z.visual = null;
  z.model = createZombieModel(!!z.dog, { directorRig: !!z.dog });
}

// ---------- GLB zombie visual wrapper ----------
// Recolor the shared atlas toward decayed corpse tones: the cartoony green
// skin becomes gray-green decay, clothes become field-gray rags. Cached once.
let _corpseAtlas = null;
function corpseAtlas() {
  if (_corpseAtlas) return _corpseAtlas;
  const src = assets.models.zombie1;
  const srcTex = src?.scene?.getObjectByProperty('isSkinnedMesh', true)?.material?.map;
  if (!srcTex?.image) return null;
  const img = srcTex.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  // Corpse palette. These used to be lifted well above life so zombies stayed
  // visible in a dark scene, which made them read as pale glowing dolls. Auto
  // exposure and the rim light now handle visibility, so the flesh can go back
  // to where it belongs: ashen, jaundiced and desaturated, with the uniform
  // nearly black. This is the Waffenfabrik corpse, not a ghost.
  const skin = new THREE.Color(0x6c6a55);  // ashen, slightly jaundiced
  const cloth = new THREE.Color(0x24272a); // near-black field grey
  const tmp = new THREE.Color();
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
    const lum = 0.3 * r + 0.55 * gg + 0.15 * b;
    if (gg > r * 1.12 && gg > b * 1.12) {
      // Flesh: compress the range hard so highlights never approach white,
      // then push a little red into the mid-tones for bruising.
      const t = Math.min(1.0, lum * 1.6);
      tmp.copy(skin).multiplyScalar(0.45 + t * 0.55);
      tmp.r = Math.min(1, tmp.r * (1.0 + (1.0 - t) * 0.22));
      tmp.b *= 0.88;
    } else if (lum > 0.78) {
      tmp.setRGB(0.62, 0.60, 0.55);   // was pure white — bone/teeth, not paper
    } else {
      tmp.copy(cloth).multiplyScalar(0.5 + lum * 1.15);
    }
    px[i] = tmp.r * 255; px[i + 1] = tmp.g * 255; px[i + 2] = tmp.b * 255;
  }
  g.putImageData(d, 0, 0);
  // Dried blood and grime, stamped over the whole atlas. Uniform decay reads
  // as a paint job; irregular staining reads as something that has been dead
  // in a factory for a while.
  g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r0 = c.width * (0.004 + Math.random() * 0.03);
    const grad = g.createRadialGradient(x, y, 0, x, y, r0);
    const blood = Math.random() < 0.45;
    grad.addColorStop(0, blood ? 'rgba(120,44,34,0.85)' : 'rgba(96,88,72,0.8)');
    grad.addColorStop(1, blood ? 'rgba(150,90,80,0)' : 'rgba(130,124,110,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r0, 0, 7); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  _corpseAtlas = new THREE.CanvasTexture(c);
  _corpseAtlas.colorSpace = THREE.SRGBColorSpace;
  _corpseAtlas.flipY = false;
  return _corpseAtlas;
}

const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
// Eyes are authored ABOVE the bloom threshold (~1.15 luminance) so they
// actually bloom in the HDR stack instead of sitting flat.
const eyeGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa830).multiplyScalar(1.9), toneMapped: false });
// Per-zombie tint. Kept below 0.62 luminance: anything brighter multiplied the
// atlas back up toward the pale doll look this palette exists to avoid.
const zombieTints = [0x9a9184, 0x8d8578, 0x847d72, 0x968c7c, 0x7d776d];

// ---- height contract -------------------------------------------------------
// A zombie is a man. Whatever the skinned measurement returns, the rendered
// corpse must stand between these bounds — a 2.8m zombie towering over the
// horde is a bug the player reads instantly, so it is clamped, not trusted.
const ZOMBIE_MIN_H = 1.60;
const ZOMBIE_MAX_H = 2.00;
// Sanity band for the RAW measurement, relative to the source model's own
// native standing height. Anything outside it is a broken sample (degenerate
// pose, skeleton not yet filled) and is discarded in favour of the cache.
const CAL_SANE_LO = 0.5;
const CAL_SANE_HI = 2.0;

// Native standing height per SOURCE model. Every clone of a model shares it,
// so this is measured once per GLTF and never per zombie — calibration stays
// O(1) per instance, which co-op cannot afford otherwise.
const _nativeStandingH = new WeakMap();
function nativeStandingHeight(src) {
  if (!src?.scene) return null;
  if (_nativeStandingH.has(src)) return _nativeStandingH.get(src);
  let h = null;
  try {
    const probe = skClone(src.scene);
    probe.position.set(0, 0, 0);
    probe.rotation.set(0, 0, 0);
    probe.scale.setScalar(1);
    const mixer = new THREE.AnimationMixer(probe);
    let idle = null, walk = null;
    for (const clip of src.animations || []) {
      if (clip.name === 'Idle') idle = mixer.clipAction(clip);
      else if (clip.name === 'Walk') walk = mixer.clipAction(clip);
    }
    const m = measureStandingBounds(probe, mixer, idle || walk);
    if (m && m.h > 0.1) h = m.h;
    mixer.uncacheRoot(probe);
  } catch (e) {
    h = null;
  }
  _nativeStandingH.set(src, h);
  return h;
}

export class ZombieVisual {
  constructor(variant) {
    const src = variant === 1 ? assets.models.zombie2 : assets.models.zombie1;
    this.src = src; // kept for the cached native-height fallback in calibrate()
    this.inner = skClone(src.scene);
    // rough initial scale — precisely calibrated on first animated frame
    this.inner.scale.setScalar(1.0);
    this.group = new THREE.Group();
    this.group.add(this.inner);
    this._calibrated = false;
    this._targetH = rand(1.72, 1.86); // human-sized
    this.mixer = new THREE.AnimationMixer(this.inner);
    this.actions = {};
    for (const clip of src.animations) {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }
    this.current = null;
    this.mats = [];
    const atlas = corpseAtlas();
    const tint = choice(zombieTints);
    // Rim is a hint of moonlight catching an edge, not a halo. The default in
    // randomCreatureLook is tuned for readability; corpses want it far lower.
    const look = randomCreatureLook();
    look.rimStrength = 0.42 + Math.random() * 0.16;
    look.rimPower = 3.6;
    look.wrap = 0.22;
    look.sssStrength = 0.13;
    look.fleshAmount = 0.62 + Math.random() * 0.22;
    look.grime = 0.42 + Math.random() * 0.32;
    look.wet = 0.10 + Math.random() * 0.14;
    look.tintA = 0x8e8676; look.tintB = 0x6f6a5e;
    this.inner.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.frustumCulled = false; // skinned bounds are unreliable
        if (o.material) {
          o.material = o.material.clone();
          if (atlas) { o.material.map = atlas; o.material.color = new THREE.Color(tint); }
          o.material.roughness = 0.95;
          // Shading-only fidelity pass: moon-keyed rim light, wrapped diffuse,
          // triplanar necrotic detail and per-instance variation. Nothing here
          // touches the skeleton, so it cannot desync an animation.
          enhanceCreatureMaterial(o.material, look);
          this.mats.push(o.material);
        }
      }
    });
    // glowing eyes on the head bone
    this.headBone = null;
    this.inner.traverse((o) => { if (!this.headBone && o.isBone && /head/i.test(o.name)) this.headBone = o; });
    if (this.headBone) {
      for (const s of [-1, 1]) {
        const e = new THREE.Mesh(eyeGeo, eyeGlowMat);
        e.position.set(0.055 * s, 0.065, 0.115);
        e.scale.setScalar(1.0);
        this.headBone.add(e);
      }
    }
    this.hitFlash = 0;
    // ---- de-cartoon surgery: per-zombie proportion preset + hunched posture ----
    // Rotation offsets must only ADD to bones the current clip actually writes —
    // on untracked bones they would accumulate forever (the "rolling head" bug).
    this.bones = {};
    this.restPose = {}; // bone name -> rest quaternion (captured at clone time)
    this.inner.traverse((o) => {
      if (o.isBone) { this.bones[o.name] = o; this.restPose[o.name] = o.quaternion.clone(); }
    });
    this._tracked = new Set(); // bone names written by the current action's clip
    this.prop = choice(PROP_PRESETS);
    this.tongueOut = Math.random() < 0.35 && this.bones.Tongue1;
    this.hunch = this.prop.hunch;
  }

  play(name, { loop = true, fade = 0.18, timeScale = 1 } = {}) {
    const a = this.actions[name];
    if (!a || this.current === name && loop) { if (this.current === name) { const act = this.actions[name]; act.timeScale = timeScale; } return; }
    const prev = this.current ? this.actions[this.current] : null;
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
    a.clampWhenFinished = !loop;
    a.timeScale = timeScale;
    if (prev && prev !== a) { a.crossFadeFrom(prev, fade, false); }
    a.play();
    this.current = name;
    // remember which bones THIS clip writes (rotation-offset safety)
    this._tracked.clear();
    for (const tr of a.getClip().tracks) {
      const boneName = tr.name.split('.')[0];
      if (this.bones[boneName]) this._tracked.add(boneName);
    }
  }

  flash() { this.hitFlash = 0.09; }

  // Measure skinned-pose bounds once and normalize height/grounding (in the
  // GROUP's own space) — never in world space.
  //
  // World space is what produced 2.8m zombies. animate() pitches a rising
  // corpse's group forward by up to 0.95rad (and rolls it) on the very frame
  // calibration runs, and the world bbox of a body pitched 54 degrees is far
  // shorter than the body, so targetH/h came out roughly double. Only ground
  // risers were affected — about 6% of a wave — which is exactly why it read
  // as "some zombies are huge".
  //
  // Three independent guards, because a wrong scale here is permanent:
  //   1. measure in parent space, so no group transform can distort it;
  //   2. reject a raw height outside a sane band around the model's cached
  //      native standing height;
  //   3. clamp the applied factor, then re-measure and assert the rig really
  //      lands inside the height contract, falling back to a deterministic
  //      scale derived from the cached native height if it does not.
  calibrate() {
    const idle = this.actions.Idle || this.actions.Walk;
    if (!idle) return;
    // force the standing pose on the skeleton right now
    this.mixer.stopAllAction();
    idle.reset();
    idle.setLoop(THREE.LoopOnce, 1);
    idle.clampWhenFinished = true;
    idle.play();
    idle.time = 0.35; // mid idle, feet planted
    this.mixer.update(0);
    // Unit-scale, transform-free bounds: comparable to the cached native height
    // and unchanged by anything animate() has done to the group this frame.
    const bb = measureNeutralBounds(this.inner, this.group);
    const measuredH = bb ? bb.max.y - bb.min.y : 0;
    const measuredMinY = bb ? bb.min.y : 0;
    // hand control back to the animator: clear pose + let animate() re-issue play()
    this.mixer.stopAllAction();
    this.current = null;

    const native = nativeStandingHeight(this.src);
    const sane = measuredH > 0.1 && (!native
      || (measuredH >= native * CAL_SANE_LO && measuredH <= native * CAL_SANE_HI));
    const h = sane ? measuredH : native;
    if (!(h > 0.1)) return;         // nothing trustworthy to fall back to — retry next frame

    const target = clamp(this._targetH, ZOMBIE_MIN_H, ZOMBIE_MAX_H);
    // The rendered height is exactly h * scale, so clamping the scale into this
    // window is what makes the contract unconditional. setScalar, never
    // multiplyScalar: a measurement taken at unit scale must not be compounded
    // with whatever scale the rig is already carrying.
    const scale = clamp(target / h, ZOMBIE_MIN_H / h, ZOMBIE_MAX_H / h);
    this.inner.scale.setScalar(scale);
    // Ground the feet at the group origin. Only re-derived from a measurement
    // we actually trusted.
    this.inner.position.y = sane ? -measuredMinY * scale : 0;

    // Hard post-condition: re-measure the posed rig and prove the height it
    // will render at lands inside the contract. Never assume it.
    const after = measureNeutralBounds(this.inner, this.group);
    const finalH = after ? (after.max.y - after.min.y) * this.inner.scale.x : 0;
    if (!(finalH >= ZOMBIE_MIN_H && finalH <= ZOMBIE_MAX_H)) {
      const safe = native > 0.1
        ? clamp(target / native, ZOMBIE_MIN_H / native, ZOMBIE_MAX_H / native)
        : 1;
      this.inner.scale.setScalar(safe);
      this.inner.position.y = 0;
      console.warn('[zombies] calibration post-condition failed; using cached native scale', { measuredH, finalH });
    }
    this._calibrated = true;
  }

  update(dt) {
    this.mixer.update(dt);
    // de-cartoon surgery, re-applied every frame. Scale is safe (clips don't
    // write scale here); rotation offsets: reset untracked bones to rest pose
    // FIRST so offsets never accumulate, then tilt via quaternion multiply.
    const B = this.bones, S = this.prop.scale;
    for (const name in S) { const b = B[name]; if (b) b.scale.set(S[name][0], S[name][1], S[name][2]); }
    // constant-set (never accumulates, never rolls — overrides clip pose deterministically)
    const setTilt = (name, dx) => {
      const b = B[name];
      if (!b || !dx) return;
      b.quaternion.copy(this.restPose[name]);
      b.rotateX(dx);
    };
    setTilt('Torso', this.hunch);
    setTilt('Neck', this.hunch * 0.7);
    setTilt('Head', -this.hunch * 0.85); // face stays up at the prey
    if (this.tongueOut) {
      for (let i = 1; i <= 5; i++) setTilt('Tongue' + i, 0.32);
    }
    if (!this._calibrated && this.current) this.calibrate();
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      const on = this.hitFlash > 0;
      for (const m of this.mats) m.emissive?.setHex(on ? 0x661111 : 0x000000);
    }
  }
}

export function createZombieVisual() {
  const hasBasic = !!assets.models.zombie1;
  const hasChubby = !!assets.models.zombie2;
  if (!hasBasic && !hasChubby) return null;

  // Partial asset availability must remain safe: never select a missing
  // variant merely because the other zombie model loaded successfully.
  const variant = hasChubby && (!hasBasic || Math.random() >= 0.75) ? 1 : 0;
  const visual = new ZombieVisual(variant);
  // Bone-attached damage geometry: torn coat, exposed ribs, hanging flesh.
  // Parented to bones the rig already animates, so it follows the pose without
  // touching the skeleton — see js/render/ZombieDetail.js for why that matters.
  visual.detail = attachZombieDetail(visual);
  return visual;
}

// Scratch for the bounds sampler. Reused, not allocated per call: this runs
// once per zombie on a spawn frame, and spawn frames are already the spikiest
// ones in a wave.
const _boundsBox = new THREE.Box3();
const _boundsVec = new THREE.Vector3();
const _neutralPos = new THREE.Vector3();
const _neutralScale = new THREE.Vector3();
const _neutralGPos = new THREE.Vector3();
const _neutralGScale = new THREE.Vector3();
const _neutralGQuat = new THREE.Quaternion();

/**
 * Bounds of the skin AS CURRENTLY POSED, measured with every transform between
 * the skeleton and the ruler set to identity: `inner`'s own offset and scale,
 * and the whole `group` placement.
 *
 * This neutralisation IS the fix. The shipped sampler measured in world space
 * and only zeroed the group's position and YAW. `animate()` pitches a rising
 * corpse's group up to 0.95rad forward (`m.rotation.x = 0.95 * lean`) and rolls
 * it, on the very frame calibration runs — and because `getVertexPosition`
 * skins through `bone.matrixWorld`, which already carries that pitch, the extra
 * `applyMatrix4(o.matrixWorld)` applied it a SECOND time. A body folded ~1.9rad
 * measured 0.70m instead of 1.23m, so `targetH / h` came out roughly double and
 * the corpse was permanently 2.4-2.9m tall. Only ground risers were pitched —
 * about 6% of a wave — which is exactly why it read as "some zombies are huge"
 * rather than "all zombies are huge".
 *
 * Measuring at unit scale also makes the result a pure property of the posed
 * skeleton, so it means the same thing before and after a scale is applied.
 *
 * Returns a SHARED Box3 — read what you need before calling again.
 */
// Exported so the soldier avatars can post-condition their own calibration
// against the same ruler the zombies use, rather than keeping a third copy of
// a skinned-bounds sweep. See _measureBody() in js/player.js.
export function measureNeutralBounds(inner, group) {
  _neutralPos.copy(inner.position);
  _neutralScale.copy(inner.scale);
  inner.position.set(0, 0, 0);
  inner.scale.setScalar(1);
  if (group) {
    _neutralGPos.copy(group.position);
    _neutralGScale.copy(group.scale);
    _neutralGQuat.copy(group.quaternion);
    group.position.set(0, 0, 0);
    group.scale.setScalar(1);
    group.quaternion.identity();      // quaternion, so rotation.order cannot matter
  }
  (group || inner).updateWorldMatrix(true, true);

  const bb = _boundsBox.makeEmpty();
  const v = _boundsVec;
  let found = false;
  inner.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton?.update(); // renderer hasn't run yet — fill boneMatrices ourselves
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 500));
    for (let i = 0; i < pos.count; i += step) {
      o.getVertexPosition(i, v);      // skinned
      v.applyMatrix4(o.matrixWorld);  // -> the (now identity) rig frame
      bb.expandByPoint(v);
    }
    found = true;
  });

  inner.position.copy(_neutralPos);
  inner.scale.copy(_neutralScale);
  if (group) {
    group.position.copy(_neutralGPos);
    group.scale.copy(_neutralGScale);
    group.quaternion.copy(_neutralGQuat);
  }
  (group || inner).updateWorldMatrix(true, true);
  return found && !bb.isEmpty() ? bb : null;
}

// Force a neutral standing pose on a cloned rig and measure accurate skinned
// bounds. Shared by ZombieVisual and SoldierVisual — never call this while an
// animation you care about is playing (it stops all actions).
export function measureStandingBounds(inner, mixer, idleAction) {
  if (!idleAction) return null;
  mixer.stopAllAction();
  idleAction.reset();
  idleAction.setLoop(THREE.LoopOnce, 1);
  idleAction.clampWhenFinished = true;
  idleAction.play();
  idleAction.time = 0.35;
  mixer.update(0);
  const bb = measureNeutralBounds(inner, inner.parent);
  mixer.stopAllAction();
  if (!bb) return null;
  return { h: bb.max.y - bb.min.y, minY: bb.min.y, maxY: bb.max.y };
}

// Pure, capture-safe pose selection shared by the live zombie manager and the
// isolated cinematic director. `deterministic` is deliberately opt-in: normal
// gameplay keeps its existing run-clip variation, while frame-addressed trailer
// capture never depends on seek order or Math.random().
export function zombiePoseForState({
  state,
  speed = 0,
  crawler = false,
  current = null,
  deterministic = false,
  variant = 0,
  riseT = 0,
  dormant = false,
} = {}) {
  if (state === ZSTATES.DIE) return { action: 'Death', loop: false, fade: 0.08, timeScale: 1 };
  // Nobody left to hunt (game over): the horde has no prey and no reason to
  // sprint, and a run cycle with the root frozen is just running on the spot.
  // Stand and breathe instead — slightly off-tempo per body so the crowd never
  // idles in lockstep. Risers keep their staged climb-out below; a corpse left
  // half in the floor reads far worse than one standing over you.
  if (dormant && state !== ZSTATES.RISE) {
    if (crawler) return { action: 'Crawl', loop: true, fade: 0.5, timeScale: 0.22 };
    return { action: 'Idle', loop: true, fade: 0.5, timeScale: 0.55 + (variant % 7) * 0.04 };
  }
  if (crawler) return { action: 'Crawl', loop: true, fade: 0.18, timeScale: 0.6 };
  if (state === ZSTATES.TEAR) return { action: 'Idle_Attack', loop: true, fade: 0.18, timeScale: 1.15 };
  if (state === ZSTATES.ATTACK) {
    const action = current === 'Idle_Attack' ? 'Idle_Attack' : 'Punch';
    return { action, loop: false, fade: 0.08, timeScale: 1.3 };
  }
  if (state === ZSTATES.CLIMB) return { action: 'Jump', loop: false, fade: 0.1, timeScale: 1 };
  if (state === ZSTATES.RISE) {
    // The whole rise used to play Crawl — a PRONE, on-the-stomach clip — while
    // the body translated straight up out of the ground. That is why risers
    // read as floating out of the floor lying down: the pose never changed
    // from prone to standing at any point.
    //
    // Staged instead, using only clip selection and playback rate. Both are
    // safe: neither touches the skeleton, retargets, or blends anything the
    // mixer does not already do for an ordinary clip change.
    const t = clamp(riseT, 0, 1);
    if (t < 0.42) {
      // Clawing at the ground, chest barely clear. Fast punch out, then a
      // near-stall while it fights for purchase.
      return { action: 'Crawl', loop: true, fade: 0.14, timeScale: t < 0.22 ? 1.5 : 0.35 };
    }
    if (t < 0.72) {
      // Heaving the torso out. Jump_Land is the rig's crouched recovery pose,
      // which is exactly the shape of a body getting its knees under it.
      return { action: 'Jump_Land', loop: false, fade: 0.24, timeScale: 0.55 };
    }
    return { action: 'Idle', loop: true, fade: 0.3, timeScale: 0.9 };
  }
  if (state === ZSTATES.APPROACH) return { action: 'Walk', loop: true, fade: 0.18, timeScale: clamp(speed, 0.8, 1.4) };
  if (speed > 3) {
    const arms = current === 'Run_Arms' || (deterministic ? (variant & 1) === 1 : Math.random() < 0.5);
    return { action: arms ? 'Run_Arms' : 'Run', loop: true, fade: 0.18, timeScale: clamp(speed / 3.4, 0.9, 1.4) };
  }
  return { action: 'Walk', loop: true, fade: 0.18, timeScale: clamp(speed / 1.1, 0.9, 2.0) };
}

// The procedural hound rig has no AnimationMixer. Keeping its deterministic
// pose calculation here lets gameplay and the director use the exact same leg,
// spine, head, jaw and tail grammar without instantiating zombie AI.
export function applyHellhoundPose(model, {
  state = ZSTATES.CHASE,
  phase = 0,
  stateT = 0,
  deadT = 0,
  headshotDeath = false,
  groundY = model?.position?.y || 0,
  dormant = false,
} = {}) {
  if (!model?.userData?.dog) return;
  const u = model.userData;
  model.rotation.x = 0;
  model.rotation.z = 0;
  model.position.y = groundY;
  if (state === ZSTATES.DIE) {
    const t = Math.min(1, deadT / 0.45);
    model.rotation.x = headshotDeath ? -t * 1.5 : t * 1.5;
    model.position.y = groundY - Math.max(0, deadT - 1.6) * 0.4;
    return;
  }
  const attacking = !dormant && state === ZSTATES.ATTACK;
  const rising = !dormant && state === ZSTATES.RISE;
  // Dormant is a standing hound, not a stalled one: the gait stops, but the
  // ribcage still rises and falls and the head still drifts.
  const amp = dormant ? 0.05 : attacking ? 0.35 : 0.62;
  const rootBob = dormant ? Math.abs(Math.sin(phase * 0.5)) * 0.02
    : attacking ? 0.06 : Math.abs(Math.sin(phase * 0.5)) * (u.directorRig ? 0.018 : 0.12);
  model.position.y = groundY + rootBob;
  if (u.directorRig && u.legChains?.length) {
    for (const chain of u.legChains) {
      const cycle = ((((phase + chain.phase) / (Math.PI * 2)) % 1) + 1) % 1;
      // A deterministic two-link gait: during stance the endpoint travels
      // backward in model space at nearly the same rate the root advances,
      // then recovers forward with a lifted swing. This is true planted-paw
      // motion on the real hip -> knee -> paw hierarchy, not visual scissoring.
      const stance = dormant || (!attacking && cycle >= 0.5);
      const strideHalf = 0.37;
      let gaitT, targetX, lift = 0;
      if (dormant) {
        // Squared up under its own hips: planted, no stride to travel through.
        targetX = 0;
      } else if (stance) {
        gaitT = (cycle - 0.5) * 2;
        targetX = THREE.MathUtils.lerp(strideHalf, -strideHalf, gaitT);
      } else {
        gaitT = cycle * 2;
        const recover = THREE.MathUtils.smoothstep(gaitT, 0, 1);
        targetX = THREE.MathUtils.lerp(-strideHalf, strideHalf, recover);
        lift = Math.sin(gaitT * Math.PI) * 0.18;
      }
      // Root bob is already applied, so the planted endpoint compensates it
      // instead of inheriting a visible 12 cm vertical float above the floor.
      const targetY = -chain.hip.position.y - rootBob + lift;
      const l1 = chain.upperLen, l2 = chain.lowerLen;
      const rawD = Math.hypot(targetX, targetY);
      const d = THREE.MathUtils.clamp(rawD, Math.abs(l1 - l2) + 0.001, l1 + l2 - 0.001);
      const x = targetX * d / Math.max(rawD, 0.001), y = targetY * d / Math.max(rawD, 0.001);
      const bend = chain.front ? -1 : 1;
      const cosKnee = THREE.MathUtils.clamp((d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
      const kneeAngle = bend * Math.acos(cosKnee);
      const firstAngle = Math.atan2(y, x) - Math.atan2(l2 * Math.sin(kneeAngle), l1 + l2 * Math.cos(kneeAngle));
      chain.hip.rotation.z = firstAngle + Math.PI * 0.5;
      chain.knee.rotation.z = kneeAngle;
      chain.paw.rotation.z = -(chain.hip.rotation.z + chain.knee.rotation.z) * 0.72;
      chain.paw.userData.directorStance = stance;
    }
  } else {
    for (const l of u.legs || []) l.mesh.rotation.z = l.base + Math.sin(phase + l.phase) * amp;
  }
  model.rotation.z = dormant ? Math.sin(phase * 0.5) * 0.02
    : u.directorRig && !attacking ? 0 : attacking
    ? -0.22 + Math.sin(Math.min(1, stateT / 0.38) * Math.PI) * 0.3
    : rising ? Math.sin(stateT * 22) * 0.08 * (1 - stateT / 1.6)
    : Math.sin(phase * 0.5) * 0.07;
  // The neck carries most of the head motion and the skull counter-rotates a
  // little, which is how a running dog keeps its eyes level on its target.
  // Attacking, the whole thing drives forward and down into the bite.
  if (u.neck) {
    const sway = Math.sin(phase * 0.23) * 0.16;
    u.neck.rotation.y = attacking ? 0 : sway;
    u.neck.rotation.z = attacking
      ? -0.30 + Math.sin(Math.min(1, stateT / 0.34) * Math.PI) * 0.22
      : -0.05 + Math.sin(phase * 0.5) * 0.045;
  }
  if (u.head) {
    u.head.rotation.y = attacking ? 0 : Math.sin(phase * 0.23) * 0.2 - (u.neck ? Math.sin(phase * 0.23) * 0.08 : 0);
    u.head.rotation.z = attacking ? 0.10 : 0.04 - Math.sin(phase * 0.5) * 0.03;
    u.head.rotation.x = attacking ? 0 : Math.sin(phase * 0.19 + 1.1) * 0.06;
  }
  if (u.jaw) {
    const bite = attacking ? Math.abs(Math.sin(stateT * 14)) : (Math.sin(phase * 0.5) * 0.5 + 0.5) * 0.25;
    // The jaw is hinged to the skull now, so this is a pure rotation about the
    // condyle. Writing an absolute world height here is what used to leave the
    // lower jaw hanging in mid-air a third of a metre below the muzzle.
    u.jaw.rotation.z = -bite * 0.55;
    if (u.jawRestY != null) u.jaw.position.y = u.jawRestY - bite * 0.008;
  }
  if (u.tailSegs?.length) {
    // A whip, not a plank: each link lags the one before it, so the tail
    // trails the body instead of swinging as one rigid stick.
    const raise = attacking ? 0.55 : 0.0;
    for (let i = 0; i < u.tailSegs.length; i++) {
      const seg = u.tailSegs[i];
      const lag = phase * 0.31 - i * 0.85;
      seg.rotation.z = seg.userData.baseZ + raise * (i === 0 ? 1 : 0.3)
        + Math.sin(lag) * (0.09 + i * 0.055);
      seg.rotation.y = (seg.userData.baseY || 0)
        + (attacking ? 0 : Math.sin(phase * 0.24 - i * 0.7) * (0.07 + i * 0.06));
    }
  } else if (u.tail) u.tail.rotation.z = attacking ? 1.15 : 0.7 + Math.sin(phase * 0.31) * 0.15;
  if (u.directorRig && u.legChains?.length) {
    // Keep the procedural hierarchy physically above its authored floor after
    // all body bob and roll have been applied. The former disconnected boxes
    // could pass through the slab unnoticed; the opt-in director rig raises
    // the body only by the amount its lowest real paw endpoint requires.
    model.updateMatrixWorld(true);
    const pawPoint = new THREE.Vector3();
    let minPawY = Infinity;
    for (const chain of u.legChains) {
      chain.paw.getWorldPosition(pawPoint);
      minPawY = Math.min(minPawY, pawPoint.y);
    }
    if (Number.isFinite(minPawY) && minPawY < groundY + 0.01) {
      model.position.y += groundY + 0.01 - minPawY;
      model.updateMatrixWorld(true);
    }
  }
}

// ------------------------------------------------------------------
export class ZombieManager {
  constructor(scene, map, cbs, authority = true) {
    this.scene = scene;
    this.map = map;
    this.cb = cbs; // {onKilled, onPlayerDamaged, onBoardTorn, onSpawned, onRiseDirt, onRiseDone}
    this.authority = authority;
    this.zombies = new Map();
    this.nextId = 1;
    this.round = 0;
    this.time = 0;
    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.spawnDelay = 2;
    this.dogRound = false;
    this.lastDogRound = 0;
    this.nextDogRound = null;
    this.instakill = false;
    this.monkey = null; // {x,z,t}
    this.dormant = false; // game over: the horde stops hunting and just stands
    this.group = new THREE.Group();
    scene.add(this.group);
    // Navigation grid over the map's real colliders (js/navmesh.js). Only the
    // authority runs AI, so a guest never pays for the build. If it ever throws
    // the horde must still function: every nav call site is guarded, and the
    // fallback is the old steer-at-the-target behaviour.
    this.nav = null;
    if (authority) {
      try {
        this.nav = getNavGrid(map);
      } catch (e) {
        console.error('[zombies] navigation grid unavailable; falling back to direct steering', e);
      }
    }
    this._colBuf = [];
  }

  // Everyone is down or dead. Stop the AI — no spawns, no pathing, no swings —
  // but leave the bodies in the world so the death cam still looks at a horde
  // rather than a freeze-frame. Clients call this off the 'gameover' message,
  // so remote hordes settle the same way the host's does.
  setDormant(on = true) {
    const next = !!on;
    if (this.dormant === next) return;
    this.dormant = next;
    if (!next) return;
    for (const z of this.zombies.values()) {
      if (z.state === ZSTATES.DIE) continue;
      // A half-played swing would land its damage on a corpse; drop back to the
      // neutral state and let the coast-down carry the momentum off.
      if (z.state === ZSTATES.ATTACK) { z.state = ZSTATES.CHASE; z.stateT = 0; z.hitApplied = true; }
      z.settleT = DORMANT_SETTLE;
    }
  }

  get aliveCount() { let n = 0; for (const z of this.zombies.values()) if (z.state !== ZSTATES.DIE) n++; return n; }
  get roundInProgress() { return this.toSpawn > 0 || this.aliveCount > 0; }
  get dogRemaining() {
    let n = this.authority ? this.toSpawn : 0;
    for (const z of this.zombies.values()) if (z.dog && z.state !== ZSTATES.DIE) n++;
    return n;
  }

  startRound(round, playerCount) {
    this.round = round;
    // anchor the hound cadence to the round this game STARTED on, so a
    // startRound cheat past round 5 still gets real dog rounds (3-5 rounds in)
    if (this.anchorRound === undefined) this.anchorRound = round;
    if (this.nextDogRound == null) this.nextDogRound = nextDogRound(this.lastDogRound, this.anchorRound);
    this.dogRound = round >= this.nextDogRound;
    if (this.dogRound) {
      this.lastDogRound = round;
      this.nextDogRound = nextDogRound(this.lastDogRound, this.anchorRound);
      this.toSpawn = dogCount(round, playerCount);
      this.spawnDelay = 2.2;
      // Build the shared hound geometry during the round transition rather
      // than on the frame the first hound erupts out of the floor.
      prewarmHellhounds();
      this.cb.onDogRound?.();
    } else {
      this.toSpawn = roundZombieCount(round, playerCount);
      this.spawnDelay = roundSpawnDelay(round);
    }
    this.spawnTimer = 1.5;
    // Per-wave allowance for ground risers. Everything else comes in through
    // a boarded window.
    // floor(), not max(1,...): the early rounds should be pure windows.
    this._riserBudget = Math.floor(this.toSpawn * RISER_SHARE);
    this._blockedSpawns = 0;
  }

  activeSpawnRooms(players) {
    return new Set(this.activeSpawnRoomDepths(players).keys());
  }

  /** Reachable spawn rooms, keyed by how many rooms away the nearest player is. */
  activeSpawnRoomDepths(players) {
    const playerRooms = players.map((p) => this.map.roomAt(p.x, p.z, p.y)).filter(Boolean);
    return roomDepthsToPlayers(
      playerRooms,
      this.map.doors.filter((door) => door.open),
      this.map.navLinks || [],
    );
  }

  spawnOne(players) {
    // Release windows whose claimant no longer exists. Occupancy is normally
    // cleared by kill() and by climbing through, but a zombie can also leave
    // the map by a route that does not run either — the co-op sync prune and
    // clear() both delete straight out of the map. A single leaked claim locks
    // that window for the rest of the session, and once every window is locked
    // the whole wave falls back to rising out of the floor, which is exactly
    // the failure this spawn rework exists to prevent. Self-heal instead of
    // trusting every future caller to remember.
    for (const b of this.map.barriers) {
      if (b.occupant != null && !this.zombies.has(b.occupant)) b.occupant = null;
    }
    const depth = this.activeSpawnRoomDepths(players);
    // Boarded windows are the RULE and rising out of the ground is the
    // exception, exactly as in the games this is a tribute to. These used to
    // be pooled together with equal weight, so roughly half of every wave
    // erupted from the floor in the middle of a room, which reads as enemies
    // materialising rather than breaking in.
    //
    // Strict preference order, first non-empty tier wins:
    //   1. windows in a room a player is standing in
    //   2. windows one room away, then two, then three... (see below)
    //   3. ground risers in a player's room
    //   4. ground risers anywhere reachable, nearest ring first
    //   5. a rise near a player (failsafe only)
    //
    // "Elsewhere" is RINGED by hop count rather than pooled flat. Flat, tier 2
    // was one unranked bag of every window on the map picked uniformly, so the
    // tail of a wave was regularly born at the opposite shell: a player in the
    // Factory on round one drew a spawn from a Mainframe window 76m away, 80s of
    // walking at shambler speed, and spent the round unable to find the last
    // zombie. Ringing costs nothing and holds the overflow next door.
    //
    // Round 1 in Mainframe, where every game starts, measured 62s with a 52s
    // straggler flat, against 37s with a 27s straggler ringed.
    const barrierRings = [];
    const riserRings = [];
    // Hounds do not tear/climb window boards. Spawning one in a barrier alcove
    // puts it outside a collider it can never legally cross, so dedicated dog
    // rounds use only in-room risers (or the clear near-player fallback below).
    if (!this.dogRound) {
      for (const b of this.map.barriers) {
        const d = depth.get(b.room);
        if (d === undefined || !isZombieSpawnRoomAllowed(b.room) || b.occupant) continue;
        (barrierRings[d] ||= []).push({ type: 'barrier', b });
      }
    }
    for (const r of this.map.risers) {
      const d = depth.get(r.room);
      if (d === undefined || !isZombieSpawnRoomAllowed(r.room)) continue;
      (riserRings[d] ||= []).push({ type: 'riser', r });
    }
    // Sparse arrays: find() skips holes, so the nearest non-empty ring wins.
    let tier = barrierRings.find((t) => t && t.length);
    if (!tier) {
      // Every reachable window is already busy. The horde QUEUES at the
      // windows rather than giving up and erupting from the floor — that
      // queueing is what makes waves arrive as a stream through the breaches
      // instead of appearing behind you. Ground risers are held back until
      // waiting has clearly stalled the round.
      const windowsExist = !this.dogRound && this.map.barriers.some(
        (b) => depth.has(b.room) && isZombieSpawnRoomAllowed(b.room));
      // Spend from this wave's small riser quota; once it is gone, WAIT for a
      // window rather than falling back to the floor. A counter that only
      // resets on success inevitably trips over a long round, which is how the
      // floor ended up supplying 40% of the wave.
      const quotaLeft = (this._riserBudget || 0) > 0;
      if (windowsExist && !quotaLeft
          && (this._blockedSpawns = (this._blockedSpawns || 0) + 1) < SPAWN_QUEUE_PATIENCE) {
        return false;                      // try again on the next spawn tick
      }
      tier = riserRings.find((t) => t && t.length);
      if (tier) this._riserBudget = (this._riserBudget || 0) - 1;
    }
    this._blockedSpawns = 0;
    if (!tier) {
      // Failsafe: every window is occupied and no riser is reachable (players
      // camping a windowless room). Classic games never let a round stall.
      const p = choice(players.filter((pl) => !pl.dead));
      if (!p) return false;
      const spot = this.riseSpotNear(p);
      if (!spot) return false;
      tier = [{ type: 'riser', r: { ...spot, exact: true } }];
    }
    const pick = choice(tier);
    // Hellhounds belong only to scheduled hellhound rounds. Keeping this tied to
    // one round-level flag prevents stray dogs from leaking into normal waves.
    const makeDog = this.dogRound;
    const hp = makeDog ? Math.min(100 + this.round * 15, 500) : roundZombieHealth(this.round);
    const z = {
      id: this.nextId++, dog: makeDog,
      x: 0, z: 0, y: 0, yaw: 0,
      hp, maxHp: hp,
      state: ZSTATES.RISE, stateT: 0, riseT: 0, riseDur: 0, riseLurchX: 0, riseLurchZ: 0, riseYaw: 0,
      speed: 0, targetId: null, retarget: 0,
      navPath: null, navIdx: 0, navGoalX: undefined, navGoalZ: undefined, repath: 0, slideSide: 0,
      attackT: 0, hitApplied: false,
      anim: rand(10), barrier: null, deadT: 0,
      model: null, crawler: false,
      stepT: 0, lastX: 0, lastZ: 0, repoT: 0, stuckT: 0, age: 0, nearT: 0, lastD: 1e9, groanT: rand(4, 14),
      riseFloor: 0,
    };
    if (makeDog) {
      z.speed = rand(6.0, 6.8);
    } else {
      // classic pacing: rounds 1-2 are all slow shamblers; runners join from round 3
      const runChance = clamp((this.round - 3) * 0.09, 0, 0.65);
      if (this.round <= 2) z.speed = rand(0.85, 1.35);
      else z.speed = Math.random() < runChance ? rand(3.4, 4.4) : rand(1.1, 2.3);
    }
    if (pick.type === 'barrier' && !makeDog) {
      const b = pick.b;
      b.occupant = z.id;
      z.barrier = b;
      z.x = b.alcove.x; z.z = b.alcove.z;
      z.room = b.room;
      z.state = ZSTATES.APPROACH;
      z.stateT = 0;
    } else {
      const r = pick.r || pick.b && { x: pick.b.alcove.x, z: pick.b.alcove.z, room: pick.b.room };
      const jitter = r.exact ? 0 : 0.8;
      z.x = r.x + rand(-jitter, jitter); z.z = r.z + rand(-jitter, jitter);
      z.riseFloor = Number.isFinite(r.y) ? r.y : this.map.floorY(z.x, z.z, 0);
      z.y = z.riseFloor - 1.5;
      z.room = r.room || this.map.roomAt(z.x, z.z, z.riseFloor);
      z.state = ZSTATES.RISE;
    }
    z.room ||= this.map.roomAt(z.x, z.z, z.riseFloor) || (z.barrier ? z.barrier.room : null);
    if (z.dog) {
      z.model = createZombieModel(true, { directorRig: true }); // real IK legs for the hellhounds
      z.visual = null;
    } else {
      z.visual = createZombieVisual();
      z.model = z.visual ? z.visual.group : createZombieModel(false);
    }
    enforceEnemyVisualIdentity(z);
    z.model.position.set(z.x, z.y, z.z);
    this.group.add(z.model);
    this.zombies.set(z.id, z);
    this.toSpawn--;
    this.cb.onSpawned?.(z);
    return true;
  }

  // ---------- combat ----------
  damage(zid, dmg, { head = false, by = null, explosive = false, weapon = null } = {}) {
    const z = this.zombies.get(zid);
    if (!z || z.state === ZSTATES.DIE) return { ok: false };
    let real = dmg;
    if (this.instakill) real = 999999;
    if (head) real *= weapon?.headMult || 2;
    z.hp -= real;
    if (z.visual) z.visual.flash();
    this.cb.onZombieHit?.(z, { head, by, dmg: real });
    if (z.hp <= 0) {
      this.kill(z, { head, by, weapon });
      return { ok: true, killed: true, head };
    }
    // crawler conversion from explosives (rare — too many read as a visual bug)
    if (explosive && !z.dog && !z.crawler && z.hp < z.maxHp * 0.35 && Math.random() < 0.22) {
      z.crawler = true;
      z.state = ZSTATES.CHASE;
      z.speed = 0.6;
      if (z.visual) z.visual.play('Crawl', { timeScale: 0.6 }); // slow drag, not a glide
      this.cb.onCrawler?.(z);
    }
    return { ok: true, killed: false };
  }

  kill(z, { head = false, by = null, weapon = null, silent = false } = {}) {
    if (z.state === ZSTATES.DIE) return;
    z.state = ZSTATES.DIE;
    z.deadT = 0;
    z.headshotDeath = head;
    if (z.barrier) { const b = z.barrier; if (b.occupant === z.id) b.occupant = null; z.barrier = null; }
    if (!silent) this.cb.onKilled?.(z, { head, by, weapon });
  }

  nukeAll(by = null) {
    const list = [...this.zombies.values()].filter((z) => z.state !== ZSTATES.DIE);
    list.forEach((z, i) => setTimeout(() => this.kill(z, { by }), i * 90));
    return list.length;
  }

  // ---------- helpers ----------
  nearestPlayer(z, players) {
    let best = null, bd = 1e9;
    for (const p of players) {
      if (p.down) continue;
      // strongly prefer same-elevation targets (catwalk vs factory floor etc.)
      const d = dist2D(z.x, z.z, p.x, p.z) + Math.abs((p.y || 0) - z.y) * 6;
      if (d < bd) { bd = d; best = p; }
    }
    const result = this._nearestResult || (this._nearestResult = { p: null, d: 1e9 });
    result.p = best;
    result.d = bd;
    return result;
  }

  /**
   * Colliders that can stop THIS body at its current height, taken from the
   * navigation grid's spatial hash.
   *
   * The old loop tested all ~310 map colliders, twice, for every enemy every
   * frame. Bucketed lookup makes it about ten, which is what pays for the
   * deflection probing below.
   *
   * Returns a SHARED buffer — consume it before the next call.
   */
  _colliders(z) {
    const out = this._colBuf;
    if (this.nav) this.nav.activeColliders(z.x, z.z, z.y, out);
    else {
      out.length = 0;
      for (const c of this.map.colliders) {
        if (c.shootOk || c.playerOnly) continue;
        if (c.y0 !== undefined && (c.y0 > z.y + 1.1 || c.y0 + c.h < z.y + 0.25)) continue;
        out.push(c);
      }
    }
    // A zombie working a boarded window is legitimately inside the frame it is
    // tearing apart, so the window panel cannot be solid to it in those states.
    if (z.state === ZSTATES.CLIMB || z.state === ZSTATES.TEAR || z.state === ZSTATES.APPROACH) {
      let w = 0;
      for (let i = 0; i < out.length; i++) if (!out[i].window) out[w++] = out[i];
      out.length = w;
    }
    return out;
  }

  /**
   * Step a body along (dirX, dirZ) and return how far it actually got.
   *
   * Two things changed here, and between them they are most of this bug.
   *
   * First, the move is resolved with `moveCircleWithColliders` — the same
   * sub-stepped, four-iteration, entry-side-honouring routine the player uses —
   * instead of a bare two-pass depenetration. A hound covers 6.8 m/s; at a long
   * frame the old single shove could jump it clean through a stringer or wedge
   * it inside a corner that then took several frames to settle out of.
   *
   * Second, the failed-move recovery is real. The old code tried ONE
   * perpendicular direction and only took it if a 1m probe was clear of every
   * collider — which in a corner, beside a stair flight, or between two crates
   * is essentially never, so the body simply stopped and ground its run cycle
   * against the geometry. That is the "stuck on nothing" the player sees. Now a
   * blocked body fans out through progressively wider deflections and takes the
   * one that makes the most real progress toward its goal, which is how a body
   * walks around the corner of an obstacle rather than into it.
   */
  moveZombie(z, dirX, dirZ, dt) {
    if (z.state === ZSTATES.ATTACK) return 0;
    const step = z.speed * dt;
    if (!(step > 1e-6)) return 0;
    const cols = this._colliders(z);
    const ox = z.x, oz = z.z;
    [z.x, z.z] = moveCircleWithColliders(ox, oz, dirX * step, dirZ * step, NAV_RADIUS, cols);
    const moved = Math.hypot(z.x - ox, z.z - oz);
    if (moved >= step * 0.55) { z.slideSide = 0; return moved; }

    // Blocked. Probe deflected headings from the ORIGINAL position — never from
    // the half-resolved one, which is already pressed into the obstacle.
    const gx = z.goalX !== undefined ? z.goalX : ox + dirX * 8;
    const gz = z.goalZ !== undefined ? z.goalZ : oz + dirZ * 8;
    let bestX = z.x, bestZ = z.z, bestScore = -Infinity;
    let bestSide = 0;
    for (const deg of DEFLECT) {
      for (const s of [1, -1]) {
        const a = deg * s * (Math.PI / 180);
        const ca = Math.cos(a), sa = Math.sin(a);
        const dx = dirX * ca - dirZ * sa, dz = dirX * sa + dirZ * ca;
        const [nx, nz] = moveCircleWithColliders(ox, oz, dx * step, dz * step, NAV_RADIUS, cols);
        const adv = Math.hypot(nx - ox, nz - oz);
        if (adv < step * 0.3) continue;
        // Closing on the goal is what counts, but commit to whichever way round
        // the obstacle this body already chose — without that hysteresis it
        // reverses every frame at the obstacle's centre line and stands still.
        let score = adv * 0.5 - Math.hypot(gx - nx, gz - nz);
        if (s === z.slideSide) score += 0.35;
        if (score > bestScore) { bestScore = score; bestX = nx; bestZ = nz; bestSide = s; }
      }
      if (bestScore > -Infinity) break;   // shallowest deflection that works wins
    }
    z.x = bestX; z.z = bestZ;
    if (bestSide) z.slideSide = bestSide;
    return Math.hypot(z.x - ox, z.z - oz);
  }

  /**
   * Crowd separation, resolved against the world.
   *
   * The push used to be written straight onto x/z with no collision pass, so a
   * dense knot of bodies at a doorway or against a wall shoved its neighbours
   * INTO the geometry. Once inside, depenetration and the crowd push fought each
   * other and the body stayed wedged — one of the ways an enemy ended up stuck
   * with nothing visibly in front of it. Routing the push through the same
   * resolver as ordinary movement means crowding can never place a body
   * somewhere it is not allowed to stand.
   */
  separate(z, dt) {
    let px = 0, pz = 0;
    for (const o of this.zombies.values()) {
      if (o === z || o.state === ZSTATES.DIE) continue;
      const dx = z.x - o.x, dz = z.z - o.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.45 * 0.45 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (0.45 - d) * 2.2 * dt;
        px += (dx / d) * push; pz += (dz / d) * push;
      }
    }
    if (px === 0 && pz === 0) return;
    [z.x, z.z] = moveCircleWithColliders(z.x, z.z, px, pz, NAV_RADIUS, this._colliders(z));
  }

  // Find a clear spawn/respawn spot. Upper rooms normally keep their elevation,
  // but Teleporter C's catwalk is deliberately destination-only: enemies rise
  // on the factory floor and navigate up the declared catwalk stairs.
  riseSpotNear(target) {
    const targetY = Number.isFinite(Number(target?.y)) ? Number(target.y) : 0;
    const targetRoom = this.map.roomAt(target.x, target.z, targetY);
    const riseTarget = targetRoom === 'catwalk'
      ? { x: target.x, y: 0, z: target.z }
      : target;
    // The height a body emerging here would actually stand at.
    const riseY = Number.isFinite(Number(riseTarget?.y)) ? Number(riseTarget.y) : 0;
    const candidates = [];
    const addCandidate = (x, z) => {
      let nx = x, nz = z;
      for (const c of this.map.colliders) {
        if (c.window || c.shootOk || c.playerOnly) continue;
        // Height is not optional here, and leaving it out was a softlock.
        //
        // The Bridge DECK is a collider (y0 2.65, h 0.25) and so is its railing
        // (y0 2.9, h 1.1). Flattened to 2D they cover the whole bridge, so every
        // probe was shoved off the very surface it was meant to land on:
        // elevationAwareRiseCandidate then found nothing in the player's room and
        // riseSpotNear returned null for anyone standing there — 200/200 probes,
        // against 200/200 successes in all twelve other rooms.
        //
        // That made respawnNear a silent no-op, which disables ALL THREE
        // guarantees that a round ends: the 25s no-progress watchdog, the
        // stuckT > 9 last resort, and the spawner's near-player failsafe. One
        // zombie wedged on a doorway jamb — jittering just enough that stuckT
        // never reached 9 — then held the wave open indefinitely. Measured 181.7s
        // average for round 1 on the bridge against 60-70s elsewhere, and runs
        // still going at the 400s cap; 60.5s on the same seed once filtered.
        //
        // Same band _colliders() and navmesh.blocksEnemy() already use.
        if (c.y0 !== undefined && (c.y0 > riseY + 1.1 || c.y0 + c.h < riseY + 0.25)) continue;
        [nx, nz] = resolveCircleBox(nx, nz, 0.32, c);
      }
      candidates.push({ x: nx, z: nz });
    };
    // Deterministic same-axis probes guarantee a candidate on narrow upper
    // connectors such as the two-metre bridge and catwalk. Random rings alone
    // could miss those strips and stall a wave even after dozens of samples.
    for (const [dx, dz] of [[3.2, 0], [-3.2, 0], [4.2, 0], [-4.2, 0], [0, 3.2], [0, -3.2]]) {
      addCandidate(riseTarget.x + dx, riseTarget.z + dz);
    }
    for (let i = 0; i < 48; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(3.0, 5.0);
      addCandidate(riseTarget.x + Math.sin(a) * r, riseTarget.z + Math.cos(a) * r);
    }
    const spot = elevationAwareRiseCandidate({
      target: riseTarget, candidates,
      roomAt: (x, z, y) => this.map.roomAt(x, z, y),
      floorY: (x, z, y) => this.map.floorY(x, z, y),
    });
    return spot && isZombieSpawnRoomAllowed(spot.room) ? spot : null;
  }

  // classic failsafe: a wedged zombie rises out of the ground near its target
  // (guarantees every zombie can always reach a player, so rounds always end)
  respawnNear(z, target) {
    if (!target) return;
    const spot = this.riseSpotNear(target);
    if (!spot) return;
    // Hand the window back. A relocated body re-enters the chase and never
    // touches its barrier again, so the claim would sit on a LIVE zombie —
    // which spawnOne's self-heal cannot reclaim, since that only releases
    // claims held by claimants who no longer exist. The window would stay out
    // of the spawn pool for the rest of the round.
    if (z.barrier) {
      if (z.barrier.occupant === z.id) z.barrier.occupant = null;
      z.barrier = null;
    }
    z.x = spot.x; z.z = spot.z;
    z.riseFloor = spot.y;
    z.y = spot.y - 1.2;
    z.state = ZSTATES.RISE; z.stateT = 0;
    z.room = spot.room;
    z.navPath = null; z.navGoalX = undefined; z.navGoalZ = undefined; z.repath = 0; z.retarget = 0;
    z.stuckT = 0; z.repoT = 0; z.lastX = z.x; z.lastZ = z.z; z.lastY = z.y; z.nearT = 0; z.lastD = 1e9; z.bestD = undefined;
    this.cb.onSpawned?.(z);
  }

  // ---------- authority update ----------
  update(dt, players) {
    this.time += dt;
    // spawner
    if (this.authority && !this.dormant && this.toSpawn > 0 && this.aliveCount < CFG.MAX_ALIVE) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnDelay * rand(0.7, 1.3);
        if (this.dogRound) this.spawnTimer *= 0.6;
        this.spawnOne(players.filter((p) => !p.dead));
      }
    }
    // tasteful ambient groans (WaW-style: sparse, quiet, never the same zombie twice in a row)
    this.groanTimer -= dt;
    if (this.groanTimer <= 0) {
      this.groanTimer = rand(9, 14);
      const cands = [...this.zombies.values()].filter((z) => z.state !== ZSTATES.DIE && !z.dog && (z.groanT || 0) < this.time);
      if (cands.length) {
        const z = choice(cands);
        z.groanT = this.time + rand(26, 42); // this zombie stays quiet for a while
        this.cb.onGroan?.(z);
      }
    }
    if (this.monkey) {
      this.monkey.t -= dt;
      if (this.monkey.t <= 0) this.monkey = null;
    }

    this._af = ((this._af || 0) + 1) | 0;
    this._pathBudget = PATHS_PER_FRAME;
    for (const z of this.zombies.values()) {
      this.stepZombie(z, dt, players);
      // animation LOD: distant zombies pose-update at reduced rate (MP perf)
      const np = players.length ? players[0] : null;
      const d2 = np ? (z.x - np.x) ** 2 + (z.z - np.z) ** 2 : 0;
      const every = d2 < 625 ? 1 : d2 < 2025 ? 2 : 3;
      // Damage detail is silhouette dressing — past ~45m it is a few pixels
      // wide and costs up to five draw calls per corpse, so drop it there.
      if (z.visual?.detail) {
        const want = d2 < 2025;
        if (z._detailVis !== want) { setZombieDetailVisible(z.visual.detail, want); z._detailVis = want; }
      } else if (z.dog && z.model) {
        // Hounds pay for their silhouette in the shadow pass, not the colour
        // pass. Distance tiers drop shadow casting long before they drop mass.
        setHellhoundLOD(z.model, d2);
      }
      this.animate(z, dt, ((this._af + z.id) % every) !== 0);
    }
    // cleanup dead
    for (const [id, z] of this.zombies) {
      if (z.state === ZSTATES.DIE && z.deadT > 2.6) {
        this.group.remove(z.model);
        this.zombies.delete(id);
      }
    }
  }

  stepZombie(z, dt, players) {
    const dormant = this.dormant && z.state !== ZSTATES.DIE;
    z.stateT += dt;
    // Idle sway, not a gait: the procedural rigs read z.anim as their stride
    // phase, so the same slowdown that stops the legs also slows the head.
    z.anim += dt * (dormant ? 0.9 : (z.dog ? 11 : (z.speed > 3 ? 8 : z.speed > 2 ? 5 : 3)));
    if (!this.authority) return;

    // Dormant: no targeting, no barriers, no watchdog respawns. Risers are the
    // one exception — they finish hauling themselves out and then stand.
    if (dormant && z.state !== ZSTATES.RISE) {
      if (z.settleT > 0) {
        z.settleT = Math.max(0, z.settleT - dt);
        const k = z.settleT / DORMANT_SETTLE;
        this.moveZombie(z, Math.sin(z.yaw), Math.cos(z.yaw), dt * k * k);
      }
      return;
    }

    // global watchdog (ANY state): a zombie that can never get near a player must
    // not hold the round hostage — classic games teleport stragglers to you.
    if (z.state !== ZSTATES.DIE && z.state !== ZSTATES.RISE) {
      z.age += dt;
      const { p: np, d: nd } = this.nearestPlayer(z, players);
      // Progress, not proximity.
      //
      // This timer only ever reset when a body got within 3.5m of somebody, so a
      // round-one shambler at 1.1 m/s walking the length of the map — a
      // legitimate forty-second journey — was teleported at twenty-five seconds
      // every single time, whether or not anything was ever in its way. That
      // masked the real navigation failure for a long time: the horde appeared
      // to arrive, so nothing looked broken, and the bodies that were genuinely
      // wedged were rescued by the same cheat as the ones simply walking.
      //
      // Closing the gap on its own best-ever approach is proof a body is working,
      // and that is what keeps it alive now. `bestD` is a CHECKPOINT, not a
      // running minimum — updating it every frame would make the gain since the
      // last frame the thing being measured, which is a few centimetres and
      // never clears the bar. A body that keeps beating its record walks as long
      // as it needs to; one whose record stops improving for twenty-five seconds
      // is either wedged or being kited, and both of those are what this failsafe
      // is for.
      const best = z.bestD ?? Infinity;
      if (nd < 3.5 || nd < best - 0.5) { z.nearT = 0; z.bestD = Math.min(best, nd); }
      else z.nearT += dt;
      if (z.age > 10 && z.nearT > 25 && np) this.respawnNear(z, np);
    }

    switch (z.state) {
      case ZSTATES.RISE: {
        const fb = this.map.floorY(z.x, z.z, z.riseFloor ?? 0);
        z.riseFloor = fb;
        const dur = z.riseDur || (z.riseDur = rand(1.9, 2.5));
        const t = Math.min(1, z.stateT / dur);
        z.riseT = t;

        // A corpse hauling itself out of the ground does not glide up at a
        // constant rate, which is exactly what the old linear lerp looked
        // like. This is a four-beat struggle: an arm punches clear, it hangs
        // there scrabbling for purchase, heaves the torso out, then drags the
        // legs free. The curve is piecewise so each beat has a distinct
        // velocity, and the sub-beat easing keeps it from looking stepped.
        let h;                                     // 0..1 height out of the ground
        if (t < 0.18) {                            // burst: hand and forearm
          const k = t / 0.18;
          h = 0.26 * (1 - (1 - k) * (1 - k));
        } else if (t < 0.42) {                     // stall: clawing, sinks a little
          const k = (t - 0.18) / 0.24;
          h = 0.26 - 0.04 * Math.sin(k * Math.PI);
        } else if (t < 0.74) {                     // heave: torso clears
          const k = (t - 0.42) / 0.32;
          h = 0.22 + 0.58 * k * k * (3 - 2 * k);
        } else {                                   // drag the legs out and stand
          const k = (t - 0.74) / 0.26;
          h = 0.80 + 0.20 * (1 - (1 - k) * (1 - k) * (1 - k));
        }
        z.y = fb - RISE_DEPTH * (1 - h);

        // Lurch: the body twists and rocks as it fights the ground. Amplitude
        // decays as it gets free so it settles rather than stopping dead.
        const struggle = (1 - t) * (1 - t);
        z.riseLurchX = Math.sin(z.stateT * 11.3 + z.id) * 0.10 * struggle;
        z.riseLurchZ = Math.cos(z.stateT * 8.7 + z.id * 1.7) * 0.075 * struggle;
        z.yaw = (z.riseYaw ?? z.yaw) + Math.sin(z.stateT * 6.1 + z.id) * 0.22 * struggle;

        // Dirt keeps coming while it fights, heaviest on the two heaves.
        const burst = (t < 0.2) || (t > 0.44 && t < 0.62);
        z.riseFxAcc = (z.riseFxAcc || 0) + dt * (burst ? 34 : 9);
        while (z.riseFxAcc >= 1) {
          z.riseFxAcc -= 1;
          this.cb.onRiseDirt?.(z, fb, t);
        }

        if (t >= 1) {
          z.state = ZSTATES.CHASE;
          z.y = fb;
          z.riseLurchX = 0; z.riseLurchZ = 0; z.riseT = 1;
          z.room = this.map.roomAt(z.x, z.z, z.y);
          this.cb.onRiseDone?.(z, fb);
        }
        break;
      }
      case ZSTATES.APPROACH: {
        const b = z.barrier;
        if (!b) { z.state = ZSTATES.CHASE; break; }
        const dx = b.x - z.x, dz = b.z - z.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.35) {
          this.moveZombie(z, dx / d, dz / d, dt);
          z.yaw = Math.atan2(dx, dz);
        } else { z.state = ZSTATES.TEAR; z.stateT = 0; z.tearAcc = 0; }
        break;
      }
      case ZSTATES.TEAR: {
        const b = z.barrier;
        if (!b) { z.state = ZSTATES.CHASE; break; }
        z.yaw = Math.atan2(b.x - z.x, b.z - z.z) || z.yaw;
        z.tearAcc += dt;
        if (z.tearAcc >= 1.35) {
          z.tearAcc = 0;
          if (b.boards > 0) {
            b.boards--;
            this.cb.onBoardTorn?.(b);
          }
          if (b.boards <= 0) { z.state = ZSTATES.CLIMB; z.stateT = 0; }
        }
        break;
      }
      case ZSTATES.CLIMB: {
        const b = z.barrier;
        if (!b) { z.state = ZSTATES.CHASE; break; }
        const t = Math.min(1, z.stateT / 0.9);
        z.x = b.x - b.nx * 0.6 * (1 - t) + b.nx * 0.7 * t;
        z.z = b.z - b.nz * 0.6 * (1 - t) + b.nz * 0.7 * t;
        z.y = Math.sin(t * Math.PI) * 0.85;
        z.yaw = Math.atan2(b.nx, b.nz);
        if (t >= 1) {
          z.y = 0;
          if (b.occupant === z.id) b.occupant = null;
          z.barrier = null;
          z.room = this.map.roomAt(z.x, z.z);
          z.state = ZSTATES.CHASE;
        }
        break;
      }
      case ZSTATES.CHASE: {
        // elevation: track floors, fall off ledges, haul up through high windows
        {
          const fy = this.map.floorY(z.x, z.z, z.y);
          if (z.y > fy + 0.05) { z.velY = (z.velY || 0) - 18 * dt; z.y = Math.max(fy, z.y + z.velY * dt); }
          else if (fy - z.y > 0.3) { z.y = Math.min(fy, z.y + 3.2 * dt); } // hauling up a high window
          else { z.y = fy; z.velY = 0; }
        }
        z.retarget -= dt;
        if (z.retarget <= 0) {
          z.retarget = 1.2;
          const { p } = this.monkey ? { p: this.monkey } : this.nearestPlayer(z, players);
          const newId = p ? (p.id ?? 'monkey') : null;
          if (newId !== z.targetId) z.navPath = null; // keep the current route if the target didn't change
          z.targetId = newId;
        }
        const target = this.monkey || players.find((p) => p.id === z.targetId && !p.down) || this.nearestPlayer(z, players).p;
        if (!target) break;
        z.room = this.map.roomAt(z.x, z.z, z.y) || z.room;
        const ty = target.y || 0;
        const directD = dist2D(z.x, z.z, target.x, target.z);
        const dyT = Math.abs(ty - z.y);

        // ---- navigation ----
        // Routes now come from the collider-derived grid (js/navmesh.js), and
        // crucially they come from it INSIDE a single room too. The old code only
        // pathed when the target stood in a different room, so anything between
        // an enemy and a player in the same space was never routed around: a
        // crate, a generator, the mystery box — or the balcony stair flight,
        // which to an enemy is a solid 4.4m block standing in an 8m corridor.
        // Straight-line steering walked into it and stayed there.
        const nav = this.nav;
        z.repath -= dt;
        if (nav) {
          const drift = z.navGoalX === undefined
            ? Infinity : dist2D(z.navGoalX, z.navGoalZ, target.x, target.z);
          if (z.repath <= 0 || drift > 2.5) {
            if (this._pathBudget > 0) {
              this._pathBudget--;
              z.repath = rand(0.55, 0.9);          // staggered; never a whole-wave spike
              z.navGoalX = target.x; z.navGoalZ = target.z;
              // A clear run on the same deck needs no route at all. Going
              // straight at the prey is cheaper and reads better than tracking a
              // lattice, so the grid is only consulted when something is in the way.
              z.navPath = (dyT < 0.4 && directD < 26 && nav.losClear(z.x, z.z, target.x, target.z, z.y))
                ? null
                : nav.findPath(z.x, z.y, z.z, target.x, ty, target.z);
              z.navIdx = 0;
            } else {
              z.repath = 0.12;                     // frame is full; come back shortly
            }
          }
        }

        let gx = target.x, gz = target.z;
        if (z.navPath && z.navPath.length) {
          // Reaching a waypoint means reaching it in THREE dimensions.
          //
          // Testing only x/z is wrong wherever the map stacks surfaces, and it
          // fails worst on exactly the routes that need a route: a body on the
          // factory floor underneath the catwalk stairs sits within a waypoint
          // radius, horizontally, of every step of the flight above it. It would
          // swallow the entire climb in one frame without gaining a centimetre,
          // decide it had arrived, walk back toward the target, re-plan, and
          // oscillate at the foot of the stairs forever. Same story under any
          // balcony. The height test is what makes a climb a climb.
          while (z.navIdx < z.navPath.length) {
            const wp = z.navPath[z.navIdx];
            if (dist2D(z.x, z.z, wp.x, wp.z) >= WAYPOINT_R
                || Math.abs(z.y - wp.y) >= WAYPOINT_Y) break;
            z.navIdx++;
          }
          if (z.navIdx < z.navPath.length) { const wp = z.navPath[z.navIdx]; gx = wp.x; gz = wp.z; }
          else z.navPath = null;                   // route walked out; close on the prey
        }
        const dx = gx - z.x, dz = gz - z.z;
        const d = Math.hypot(dx, dz);
        z.goalX = gx; z.goalZ = gz;                // what deflection steering aims at
        const attackRange = z.dog ? 1.5 : 1.35;
        // A target on the deck above used to force a repath every 0.2s, back when
        // the only route information was "which room" and standing underneath
        // someone genuinely told the AI nothing. Against the grid it is actively
        // harmful: the route to the catwalk stairs leads AWAY from the player, so
        // re-planning five times a second restarted the body at waypoint zero
        // before it had walked far enough to leave the pool of bodies milling
        // underneath — and with a per-frame path budget shared across the wave, a
        // dozen enemies doing that starve each other of searches. The normal
        // cadence already re-plans often enough to follow someone moving around
        // up there.
        if (!this.monkey && directD < attackRange && dyT < 1.7 && !target.down) {
          z.state = ZSTATES.ATTACK; z.stateT = 0; z.hitApplied = false;
          this.cb.onSnarl?.(z);
        } else if (d > 0.05) {
          this.moveZombie(z, dx / d, dz / d, dt);
          this.separate(z, dt);
          z.yaw = Math.atan2(dx, dz);
          z.stepT -= dt;
          if (z.stepT <= 0) { z.stepT = z.dog ? 0.28 : (z.speed > 3 ? 0.34 : 0.55); this.cb.onStep?.(z); }
        }

        // ---- stuck escalation ----
        // Progress means MOVEMENT, not closing distance. The old test also tripped
        // whenever `closing < 0.05`, which is true of every enemy correctly taking
        // the long way around an obstacle — so the failsafe fired hardest on
        // exactly the bodies that were doing the right thing, and the answer it
        // gave them was a teleport.
        z.repoT += dt;
        if (z.repoT >= 0.5) {
          const travelled = Math.hypot(z.x - z.lastX, z.z - z.lastZ, (z.y - (z.lastY ?? z.y)) * 1.6);
          if (travelled < z.speed * z.repoT * 0.22 && directD > 1.5) z.stuckT += z.repoT;
          else z.stuckT = 0;
          z.lastX = z.x; z.lastZ = z.z; z.lastY = z.y; z.repoT = 0; z.lastD = directD;
        }
        // 1. Re-route from wherever the body has actually ended up.
        if (z.stuckT > 0.6 && z.repath > 0.1) z.repath = 0;
        // 2. Genuinely wedged inside geometry — crowded into a wall, caught by a
        //    door closing, or spawned into a pocket. Walk it back onto the nearest
        //    cell the grid says is standable. Bounded to the body's own
        //    neighbourhood, so this frees an enemy under its own power instead of
        //    relocating it somewhere it never walked to.
        if (z.stuckT > 1.6 && nav) {
          const node = nav.nearestNode(z.x, z.z, z.y);
          if (node >= 0) {
            const nx = nav.nodeX(node), nz = nav.nodeZ(node);
            const back = dist2D(z.x, z.z, nx, nz);
            if (back > 0.05 && back < 2.5) {
              const k = Math.min(1, dt * 3.5);
              // Through the collision resolver, never straight onto x/z. The
              // nearest standable cell can be on the far side of a wall from a
              // body pressed against it, and a raw assignment would walk it
              // through the brick — trading a stuck enemy for one that phases
              // through geometry, which is a worse bug than the one being fixed.
              [z.x, z.z] = moveCircleWithColliders(
                z.x, z.z, (nx - z.x) * k, (nz - z.z) * k, NAV_RADIUS, this._colliders(z));
            }
          }
        }
        // 3. Last resort, and now genuinely last.
        //
        //    Gated on real distance, because most bodies that stop moving are not
        //    stuck at all: they are at the back of the crowd already pressed
        //    around a stationary player, and there is physically nowhere for them
        //    to go. Relocating one of those achieves nothing — it is already next
        //    to its target — while costing it its route and its footing. The
        //    failsafe exists so a ROUND can never stall, and a corpse two metres
        //    from the player is not stalling anything; the player just has to
        //    shoot it. Steps 1 and 2 still run at any distance, so a body genuinely
        //    wedged close in still frees itself.
        if (z.stuckT > 9 && directD > 5) this.respawnNear(z, target);
        break;
      }
      case ZSTATES.ATTACK: {
        const target = players.find((p) => p.id === z.targetId) || this.nearestPlayer(z, players).p;
        if (target) z.yaw = Math.atan2(target.x - z.x, target.z - z.z);
        if (!z.hitApplied && z.stateT > 0.38) {
          z.hitApplied = true;
          // no phantom hits through floors/catwalks — must actually be on their level
          if (target && !target.down && dist2D(z.x, z.z, target.x, target.z) < 1.9 && Math.abs((target.y || 0) - z.y) < 1.7) {
            this.cb.onPlayerDamaged?.(target.id, z.dog ? 45 : CFG.ZOMBIE_DMG, z.x, z.z, z);
          }
        }
        if (z.stateT > CFG.ZOMBIE_ATK_CD) { z.state = ZSTATES.CHASE; z.stateT = 0; z.retarget = 0; }
        break;
      }
      case ZSTATES.DIE: {
        z.deadT += dt;
        break;
      }
    }
  }

  // ---------- shared animation ----------
  animate(z, dt, lite = false) {
    const m = z.model;
    if (!m) return;
    m.position.set(z.x, z.y, z.z);
    // YXZ so pitch and roll are applied AFTER yaw, i.e. about the body's own
    // axes. Under the default XYZ order a rise pitch would tip the corpse
    // toward world north regardless of which way it is facing.
    m.rotation.order = 'YXZ';
    // The procedural hound is authored nose-first along local +X while the AI
    // yaw convention faces local +Z. Rotate it into the same forward axis used
    // by navigation and dogHitZones; otherwise the rendered dog is sideways to
    // its authoritative hit silhouette.
    m.rotation.y = z.yaw - (z.dog ? Math.PI / 2 : 0);
    m.rotation.x = 0;
    m.rotation.z = 0;
    if (!z.dog && z.state === ZSTATES.RISE) {
      // Rotate from near-prone to upright across the rise. Without this the
      // body stays bolt vertical the whole way, which is the other half of why
      // risers looked like they were floating up out of the floor.
      const t = Math.min(1, Math.max(0, z.riseT || 0));
      const upright = t <= 0.35 ? 0 : Math.min(1, (t - 0.35) / 0.5);
      const lean = 1 - upright * upright * (3 - 2 * upright);   // smoothstep out
      m.rotation.x = 0.95 * lean;
      // Rocking shoulder-to-shoulder while it fights, settling as it stands.
      m.rotation.z = Math.sin(z.stateT * 7.3 + z.id) * 0.17 * lean;
      m.position.x += z.riseLurchX || 0;
      m.position.z += z.riseLurchZ || 0;
    }
    if (lite) return; // LOD: position-only frame (skip mixer/pose work)
    const dormant = !!this.dormant && z.state !== ZSTATES.DIE;
    if (z.visual) {
      const v = z.visual;
      const pose = zombiePoseForState({
        state: z.state, speed: z.speed, crawler: z.crawler, current: v.current,
        riseT: z.riseT || 0, dormant, variant: z.id,
      });
      if (pose.loop || v.current !== pose.action) v.play(pose.action, pose);
      if (z.state === ZSTATES.DIE) {
        if (z.deadT > 1.7) m.position.y = z.y - (z.deadT - 1.7) * 1.2; // sink away
      } else if (z.crawler) {
        // dragging side-to-side roll so it reads as hauling itself, not sliding
        m.rotation.z = Math.sin(z.anim * 0.35) * 0.12;
      }
      v.update(dt);
      return;
    }
    // procedural fallback models
    const u = m.userData;
    if (u.dog) {
      applyHellhoundPose(m, { state: z.state, phase: z.anim, stateT: z.stateT, deadT: z.deadT, headshotDeath: z.headshotDeath, groundY: z.y, dormant });
      return;
    }
    if (u.fallbackZombie) {
      const stride = Math.sin(z.anim) * (dormant ? 0.06 : z.state === ZSTATES.CHASE ? 0.5 : 0.22);
      u.armL.rotation.x = -0.75 + stride;
      u.armR.rotation.x = -0.75 - stride;
      u.legL.rotation.x = stride;
      u.legR.rotation.x = -stride;
      u.torso.rotation.x = z.crawler ? -0.9 : 0.12;
      if (z.state === ZSTATES.DIE) {
        m.rotation.z = Math.min(Math.PI / 2, z.deadT * 1.8) * (z.headshotDeath ? -1 : 1);
        if (z.deadT > 1.7) m.position.y = z.y - (z.deadT - 1.7) * 1.2;
      }
      return;
    }
    m.rotation.z = 0;
  }

  // ---------- networking ----------
  serialize() {
    const arr = [];
    for (const z of this.zombies.values()) {
      arr.push([z.id, Math.round(z.x * 100), Math.round(z.z * 100), Math.round(z.y * 100), Math.round(z.yaw * 100), z.state, Math.round(z.hp), z.dog ? 1 : 0, z.crawler ? 1 : 0]);
    }
    return arr;
  }

  applySnapshot(arr, now) {
    const seen = this._snapshotSeen || (this._snapshotSeen = new Set());
    seen.clear();
    for (const [id, x, z2, y, yaw, state, hp, dog, crawler] of arr) {
      seen.add(id);
      let z = this.zombies.get(id);
      if (!z) {
        const visual = dog ? null : createZombieVisual();
        z = {
          id, dog: !!dog, crawler: !!crawler,
          x: x / 100, z: z2 / 100, y: y / 100, yaw: yaw / 100,
          hp, state, stateT: 0, anim: rand(10), deadT: 0,
          model: visual ? visual.group : createZombieModel(!!dog, { directorRig: !!dog }), visual,
          prev: null, next: null,
          speed: 2,
        };
        enforceEnemyVisualIdentity(z);
        z.model.position.set(z.x, z.y, z.z);
        this.group.add(z.model);
        this.zombies.set(id, z);
      }
      // interpolation buffer (objects reused — no per-snapshot allocation churn)
      if (!z.next) z.next = { x: z.x, z: z.z, y: z.y, yaw: z.yaw, t: now };
      if (!z.prev) z.prev = { x: z.x, z: z.z, y: z.y, yaw: z.yaw, t: now };
      else { z.prev.x = z.next.x; z.prev.z = z.next.z; z.prev.y = z.next.y; z.prev.yaw = z.next.yaw; z.prev.t = z.next.t; }
      z.next.x = x / 100; z.next.z = z2 / 100; z.next.y = y / 100; z.next.yaw = yaw / 100;
      z.next.t = now + (window.__snapInterval || 66) / 1000;
      const newState = state;
      if (z.state !== newState) { z.state = newState; z.stateT = 0; if (newState === ZSTATES.DIE) z.deadT = 0; }
      z.hp = hp;
      z.dog = !!dog;
      z.crawler = !!crawler; // crawler conversions must sync or they look like plain zombies elsewhere
    }
    for (const [id, z] of this.zombies) {
      if (!seen.has(id)) { this.group.remove(z.model); this.zombies.delete(id); }
    }
  }

  interpolate(now) {
    for (const z of this.zombies.values()) {
      if (!z.prev || !z.next) continue;
      const span = Math.max(1e-3, z.next.t - z.prev.t);
      const t = clamp((now - z.prev.t) / span, 0, 1.25);
      z.x = lerp(z.prev.x, z.next.x, Math.min(t, 1));
      z.z = lerp(z.prev.z, z.next.z, Math.min(t, 1));
      z.y = lerp(z.prev.y, z.next.y, Math.min(t, 1));
      let dy = z.next.yaw - z.prev.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      z.yaw = z.prev.yaw + dy * Math.min(t, 1);
      z.anim += 0.016 * (this.dormant && z.state !== ZSTATES.DIE ? 0.9 : z.state === ZSTATES.CHASE ? 5 : 3);
    }
  }

  clear() {
    for (const [, z] of this.zombies) this.group.remove(z.model);
    this.zombies.clear();
    this.dormant = false;
    // Hand every window back, or a restart inherits the old game's claims.
    for (const b of this.map.barriers) b.occupant = null;
    this.toSpawn = 0;
    this.round = 0;
    this.dogRound = false;
    this.lastDogRound = 0;
    this.nextDogRound = null;
    this.anchorRound = undefined;
  }
}

export { ZSTATES };

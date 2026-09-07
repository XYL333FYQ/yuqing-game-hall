// Game orchestrator: rendering, loop, shooting, economy, rounds, interactions,
import * as THREE from 'three';

import { CFG } from './config.js';
import { clamp, lerp, damp, rand, choice, segmentHitsBox, dist2D } from './utils.js';
import { interactionLineClear } from './interaction-rules.js';
import { teleporterPromptState } from './map-layout.js';
import { input, lockPointer, endFrame, isAimDown } from './input.js';
import { audio } from './audio.js';
import { assets } from './assets.js';
import { PERSONAS, lineFor, variantCount } from './personas.js';
import { buildMap } from './map.js';
import {
  getStats, WEAPONS, BOX_POOL, buildViewmodel, buildMonkey,
  buildPapDisplayWeapon, updatePapDisplayWeapon, disposePapDisplayWeapon,
} from './weapons.js';
import { WeaponRig } from './weapons.js';
import { ZombieManager, ZSTATES } from './zombies.js';
import { LocalPlayer, RemotePlayer } from './player.js';
import { FX } from './fx.js';
import { PostFX } from './render/PostFX.js';
import { CameraRig } from './render/CameraRig.js';
import { LightPool, SlotBank } from './render/LightPool.js';
import { HellhoundFX } from './render/HellhoundFX.js';

// Render layers. The world camera draws LAYER_WORLD; a second pass draws
// LAYER_VIEWMODEL on a cleared depth buffer with its own field of view.
const LAYER_WORLD = 0;
const LAYER_VIEWMODEL = 1;
// Viewmodel FOV is deliberately fixed and narrow: it is the "lens" the weapon
// is filmed with, and decoupling it from the player's world FOV is what keeps
// a 110-degree world view from distorting the gun.
const VIEWMODEL_FOV = 75;
// The rig's part positions were authored against the 110-degree world lens.
// Filming them at 75 degrees would make the weapon fill roughly twice the
// screen, so shrink it by the ratio of the two half-angle tangents (with a
// little extra presence, because a weapon that reads large is the point) and
// push it forward by the amount the shrink pulled it in — same distance from
// the eye, same framing, far less wide-angle distortion.
const VIEWMODEL_REF_FOV = 110;
const VIEWMODEL_PRESENCE = 1.28;
const VIEWMODEL_PIVOT_Z = 0.4;   // authored hip distance, metres
// How much of a shot's view disturbance a full cheek weld takes off. Vertical
// climb is the half of recoil the player reads and answers, so it is trimmed
// rather than removed — an aimed burst still has to be walked down. The lateral
// half has no direction to read: it flips sign every round, and under a
// narrowed ADS field it is indistinguishable from the screen shaking. See the
// note in fireWeapon(), and ADS_KICK_* in weapons.js for the viewmodel's half
// of the same bargain.
const ADS_RECOIL_CLIMB = 0.4;
const ADS_RECOIL_SCATTER = 0.85;
// Where the mystery box floats its prize. Open, the lid stands as a panel
// from y 0.86 to 1.76, so the prize hangs level with the MIDDLE of that panel
// and reads against the boards — not hovering in the sky above the crate.
// Two numbers buy that height, because the display yaws a full turn and sweeps
// a 0.95 m weapon about its own centre:
//   BOX_LID_OPEN — 1.5 rad stands the lid up rather than leaning it 21 degrees
//     out over the crate mouth, which is what used to occupy this airspace.
//   BOX_DISPLAY_Z — a nudge toward the player, so the far end of that sweep
//     stops in front of the lid boards instead of passing through them.
// Verified end-on (worst case): prize spans z -0.27..0.68, lid front face
// sits at -0.31. Do not raise Y or drop Z without re-checking that gap.
const BOX_LID_OPEN = 1.5;        // radians at the hinge, fully open
const BOX_DISPLAY_Y = 1.32;
const BOX_DISPLAY_Z = 0.20;
// The prize comes UP OUT OF the crate: it starts down inside, below the rim,
// and rises to BOX_DISPLAY_Y as the lid finishes opening. The rise waits on
// the lid because the swinging panel sweeps the airspace above the mouth —
// by 0.5 open the lid can no longer reach the display plane, so that is when
// the prize is free to climb. Cycling weapons are broadside (see below), so
// down inside the crate they clear the boards on every side.
const BOX_DISPLAY_Y_LOW = 0.55;
const BOX_LID_RISE = 0.5;        // fraction open at which the prize starts up
// The cycling weapons are presented dead level and parallel to the crate's
// long axis — same pose for every one, so the reel reads as one rack of guns
// rather than a jumble of angles. Only the FINAL weapon takes the display
// tilt and the slow turn.
const BOX_CYCLE_PITCH = 0;
const BOX_DISPLAY_PITCH = 0.10;
const BOX_DISPLAY_ROLL = 0.06;
// Scratch for the remote muzzle lookup, so a firefight allocates nothing.
const _shotMuzzle = new THREE.Vector3();
import {
  acceptPendingCredit,
  boundedPelletDirectionAllowed,
  consumeBoardCredit,
  consumeCreditClaim,
  killCreditPresentation,
  multiplayerExitDestination,
  remoteShotTargetAllowed,
  remoteSwapSource,
  remoteWeaponClaimAllowed,
  SYNCED_PERK_IDS,
} from './multiplayer-contracts.js';
import {
  isPerkId, mysteryBoxTeddyChance, papEventMatches, papLifecyclePhase,
  PAP_PROCESS_SECONDS, PAP_READY_TIMEOUT_SECONDS,
  PERK_DRINK_TIMELINE, ROUND_INTERMISSION_SECONDS,
} from './gameplay-rules.js';
import {
  chainArcTargetAllowed,
  floorArcTargetAllowed,
  dogHitZones,
  explosionDamage,
  FRAG_BLAST,
  hitscanDamage,
  meleeDamage,
  penetrationProfile,
  rayHitZones,
  shouldSpawnDogRoundReward,
  shotClaimBudget,
} from './combat-rules.js';

const INTERACT_HOLD = { power: 0.8, tele: 0.8, pap: 0.5, revive: 3, barrier: 0 };
// Frozen zero-shake, shared so the down/dead camera path allocates nothing.
const NO_SHAKE = Object.freeze({ yaw: 0, pitch: 0, roll: 0 });
// Shutter weight at the slider's 100%. This governs how quickly a given camera
// speed reaches the length clamp — not how long the smear gets, which is the
// slider's other half (PostFX.setMotionBlurScale). Tuned so an ordinary look-
// around already carries some smear rather than only whip-turns tripping it.
const MB_BASE_STRENGTH = 1.0;

export class Game {
  constructor({ mode, net, options, hud, myName, lobbyPlayers, onExit, cheats }) {
    this.mode = mode; // 'solo' | 'host' | 'client'
    this.net = net;
    this.options = options;
    this.cheats = cheats || {};
    this.godMode = false;
    this.hud = hud;
    this.onExit = onExit;
    this.myName = myName || 'Player';
    this.lobbyPlayers = lobbyPlayers || [{ id: 'local', name: this.myName, color: 0 }];
    this.time = 0;
    this.paused = false;
    this.over = false;
    this.round = 0;
    this.phase = 'pre'; // pre | active | intermission
    this.phaseT = 0;
    this.killsThisGame = 0;
    this.projectiles = [];
    this.grenades = [];
    this.monkeyEntities = [];
    this.doubleT = 0;
    this.instaT = 0;
    this.qrSelfRevives = this.mode === 'solo' ? 3 : 0;
    this.teleLinks = 0;
    this.papState = { busy: false, t: 0, ready: false, weapon: null, owner: null, slot: null };
    this._papWhirr = null;        // the one-shot cycle loop, held so it can be cut
    this._papWhirrStarted = false;
    this._papOutput = null;
    this.boxState = { state: 'idle', t: 0, weapon: null, completedWeaponSpins: 0 };
    this._dogRoundReward = null;
    this.holdF = 0;
    this.currentInteract = null;
    this.snapTimer = 0;
    this.inputTimer = 0;
    this.remotePlayers = new Map();
    this._remoteShots = new Map();
    this._remoteGrenades = new Map();
    this._remoteActionAt = new Map();
    this._remoteCreditClaims = new Map();
    this._pendingHitClaims = new Map();
    this._nextCreditId = 1;
    this._nextBoardCreditId = 1;
    this._seenBoardCredits = new Set();
    this._playerStateCache = [];
    this._playerStateById = new Map();
    this._snapshotPlayerIds = new Set();
    this._rigFrameState = { ads: false, moving: false, sprinting: false, sliding: false, mouseX: 0, mouseY: 0 };
    this._dropTimerState = { insta: 0, double: 0 };
    this._aimEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._aimDir = new THREE.Vector3(0, 0, -1);
    this._projectileOrigin = new THREE.Vector3();
    this._projectileDir = new THREE.Vector3();
    this._speakingNames = [];
    this.myColor = 0;
    this.personaIdx = 0;
    this.barkCd = 0;
    this.localPerkDrink = null;
    this.disposed = false;
  }

  get isAuthority() { return this.mode !== 'client'; }

  init(canvas) {
    this.canvas = canvas;
    // Anti-aliasing, tone mapping and color conversion all happen inside PostFX
    // now: the world is rendered into an HDR buffer, so the backbuffer itself
    // must stay a plain linear surface that the composite pass writes sRGB into.
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    this._qualityTier = this._resolveQualityTier(r);
    r.shadowMap.enabled = this._qualityTier !== 'low';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    // The shadow pass re-renders every caster in the map, which is the single
    // biggest chunk of the frame's draw calls. Nothing in this game moves fast
    // enough for a one-frame-old shadow to read as wrong, so it runs at half
    // rate and the saved calls go back into the frame budget.
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    this.renderer = r;
    this.postfx = new PostFX(r, { quality: this._qualityTier });
    // Seeded here so the per-frame camera path has a value even if it somehow
    // runs before applyQuality; applyQuality is the one that reads the slider.
    this._mbUserStrength = MB_BASE_STRENGTH;
    this.exposureScale = 1;

    this.scene = new THREE.Scene();
    // Deliberately null: the shader skybox covers every pixel the world pass
    // does not, and a Color background sets forceClear inside WebGLBackground,
    // which would wipe the HDR buffer at the start of the viewmodel pass even
    // with autoClear disabled.
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(0x0a0d14, 0.028);
    this.fogNormal = { color: new THREE.Color(0x0a0d14), d: 0.028 };
    this.fogDog = { color: new THREE.Color(0x190c08), d: 0.05 };

    // Near plane is bounded by the player's collision radius, not by depth
    // precision. The camera can be pressed to CFG.PLAYER_RADIUS (0.35m) from a
    // wall, and the near plane's CORNER reaches `near * tan(fov/2) * aspect`
    // sideways — at near 0.15 and a 110 degree FOV that is 0.44m, so the
    // frustum poked through the wall and you could see the room beyond it.
    // 0.075 keeps the corner at 0.22m with margin for view bob and sway.
    // Precision is not the constraint it would normally be: the depth buffer
    // here is a FloatType texture, not 24-bit integer.
    this.camera = new THREE.PerspectiveCamera(clamp(Number(this.options.fov) || 90, 70, 110), innerWidth / innerHeight, 0.075, 400);
    this.camera.rotation.order = 'YXZ';
    this.camera.layers.set(LAYER_WORLD);
    this.scene.add(this.camera);

    // Viewmodel pass: same transform, its own (narrower, fixed) FOV and its own
    // depth range, drawn after the world with the depth buffer cleared. This is
    // why a 110-degree world FOV does not stretch the weapon into a fisheye,
    // and why the gun can never clip through a wall it is pressed against.
    this.viewCamera = new THREE.PerspectiveCamera(VIEWMODEL_FOV, innerWidth / innerHeight, 0.012, 8);
    this.viewCamera.rotation.order = 'YXZ';
    this.viewCamera.layers.set(LAYER_VIEWMODEL);
    this._drawViewmodel = (target) => this.renderViewmodel(target);
    // weapon-mounted flashlight (T toggles) — warm beam with soft falloff
    this.flashlight = new THREE.SpotLight(0xffe8c0, 0, 34, 0.46, 0.55, 1.1);
    this.flashlight.position.set(0.14, -0.12, -0.1);
    this.flashlight.target.position.set(0.02, -0.06, -8);
    this.camera.add(this.flashlight, this.flashlight.target);

    this.map = buildMap(this.scene, { mode: this.mode });
    // Prefilter the sky into a radiance probe. Every MeshStandardMaterial in
    // the map now gets directional ambient and a real specular horizon instead
    // of a flat hemisphere constant — this is most of the "PBR" look.
    this.scene.environment = this.map.sky.buildEnvironment(this.renderer, 256);
    this.scene.environmentIntensity = 1.0;
    this.applyQuality();

    // players
    const myIdx = Math.max(0, this.lobbyPlayers.findIndex((p) => p.id === (this.net?.myId ?? 'local')));
    this.myColor = this.lobbyPlayers[myIdx]?.color ?? myIdx;
    {
      const PIDS = ['dempsey', 'nikolai', 'takeo', 'richtofen'];
      const me = this.lobbyPlayers.find((l) => l.id === (this.net?.myId ?? 'local'));
      const pid = me?.persona || localStorage.getItem('der-riese-persona') || 'dempsey';
      this.personaIdx = Math.max(0, PIDS.indexOf(pid));
    }
    const spawnBase = this.map.playerSpawns[0];
    // co-op: everyone spawns together at the mainframe platform (small ring offsets,
    // radius keeps everyone clear of the mainframe machine collider)
    const ringOff = (i) => i === 0 ? { x: 0, z: 0 } : { x: Math.cos(i * 2.1) * 1.0, z: Math.sin(i * 2.1) * 1.0 };
    const myOff = ringOff(myIdx);
    const spawn = { x: spawnBase.x + myOff.x, z: spawnBase.z + myOff.z };
    this.player = new LocalPlayer(this.net?.myId ?? 'local', this.myName, this.myColor, spawn);
    this.player.y = this.map.floorY(spawn.x, spawn.z, 2); // stand ON the platform, not inside it
    this.player.yaw = 0; // -Z from the mainframe spawn faces the courtyard
    for (const lp of this.lobbyPlayers) {
      if (lp.id === this.player.id) continue;
      const rp = new RemotePlayer(this.scene, { id: lp.id, name: lp.name, c: lp.color, persona: Math.max(0, ['dempsey', 'nikolai', 'takeo', 'richtofen'].indexOf(lp.persona || 'dempsey')) });
      const o = ringOff(this.lobbyPlayers.indexOf(lp));
      rp.x = spawnBase.x + o.x; rp.z = spawnBase.z + o.z;
      rp.y = this.map.floorY(rp.x, rp.z, 2);
      this.remotePlayers.set(lp.id, rp);
    }

    this.bots = []; // CPU squad bots removed (never worked well enough)
    // Footsteps fire off the camera's stride phase so audio lands exactly on
    // the visual footfall, and slide/mantle get their own foley.
    this.cameraRig = new CameraRig();
    this.cameraRig.onFootstep = (strength) => {
      if (!this.player?.grounded || this.player.down || this.player.dead) return;
      audio.play('step', { vol: 0.55 * strength });
    };
    // The slide used to borrow a footstep at each end, which gave the motion a
    // beginning and an end but no middle. `slide` is one 1.05 s scrape built to
    // the same deceleration curve the player actually runs.
    this.player.onSlideStart = () => {
      this._slideSfx = audio.play('slide');
      this.fx.shake(0.12);
    };
    this.player.onSlideEnd = (intoCrouch) => {
      // A slide cut short — a wall, a ledge, aiming out of it — must not leave
      // the floor still scraping under a body that has stopped moving. A slide
      // that runs its full length has already finished, so this is a no-op.
      audio.fadeOut(this._slideSfx, 0.14);
      this._slideSfx = null;
      // Gear settling as you come up (or drop the rest of the way into cover).
      audio.play('foley_cloth', { vol: intoCrouch ? 0.5 : 0.36 });
    };
    this.player.onMantle = () => { audio.play('step', { vol: 0.8 }); };
    this.weaponRig = new WeaponRig(this.camera);
    this.weaponRig.equip('m1911', false);
    // Re-parent the rig under a compensation node so the narrower viewmodel
    // lens does not double the weapon's apparent size (see VIEWMODEL_* above).
    {
      const half = (f) => Math.tan(f * Math.PI / 360);
      const k = (half(VIEWMODEL_FOV) / half(VIEWMODEL_REF_FOV)) * VIEWMODEL_PRESENCE;
      this.vmRoot = new THREE.Group();
      this.vmRoot.scale.setScalar(k);
      this.vmRoot.position.z = -(1 - k) * VIEWMODEL_PIVOT_Z;
      this.camera.add(this.vmRoot);
      this.vmRoot.add(this.weaponRig.root);
      // The ADS pose solves for eye relief and buttstock clearance, both
      // measured from the lens — so the rig needs this transform to convert.
      this.weaponRig.setViewLens(k, this.vmRoot.position.z);
    }
    this.fx = new FX(this.scene);
    this.houndFX = new HellhoundFX(this.scene, this.fx);
    this.fx.postActive = !!this.postfx;
    this.fx.onDamageFlash = (amount) => { this._postDamage = Math.min(1, (this._postDamage || 0) + 0.75 * amount); };
    this.fx.onScreenFlash = (color, ms, opacity) => { this._postFlash = Math.min(3, (this._postFlash || 0) + opacity * 1.6); };
    this._syncPostFxScene();
    this.zombies = new ZombieManager(this.scene, this.map, {
      onKilled: (z, info) => this.onZombieKilled(z, info),
      onPlayerDamaged: (pid, dmg, x, z) => this.onZombieDamagePlayer(pid, dmg, x, z),
      onBoardTorn: (b) => this.onBoardTorn(b),
      onGroan: (z) => { if (!z.dog) audio.play('groan', { pos: z }); }, // hounds never moan like zombies
      onSnarl: (z) => { if (z.dog) audio.play('dog', { pos: z }); else audio.play('snarl', { pos: z, vol: 0.6 }); },
      onStep: (z) => {
        // zombies are SILENT (no groans, no shuffles) — hellhounds growl sparsely
        if (z.dog && Math.random() < 0.14) audio.play('dog', { pos: z, vol: 0.4 });
      },
      onSpawned: (z) => {
        // Ground spawns are an emergence, not an appearance. Hounds tear the
        // ground open with hellfire; zombies claw up through dirt and dust.
        if (!z) return;
        if (z.dog) this.houndFX?.houndSpawn(z.x, z.y, z.z);
        else {
          this.houndFX?.zombieRise(z.x, z.y, z.z);
          audio.play('board_tear', { pos: z, vol: 0.5, rate: rand(0.7, 0.85) });
        }
      },
      // Dirt keeps being thrown while the corpse fights its way out, heaviest
      // on the two heaves — see the RISE case in zombies.js.
      onRiseDirt: (z, floorY, t) => this.houndFX?.riseDirt(z.x, floorY, z.z, t),
      onRiseDone: (z, floorY) => {
        this.houndFX?.riseSettle(z.x, floorY, z.z);
        // Dog rounds skip the window barriers entirely, so every hound spawns
        // through a ground riser and finishes here — the moan that sells a
        // corpse hauling itself free must never come out of a hellhound.
        if (!z.dog) audio.play('groan', { pos: z, vol: 0.7 });
      },
      onDogRound: () => this.onDogRound(),
      onZombieHit: (z, info) => {},
      onCrawler: (z) => audio.play('snarl', { pos: z, vol: 0.5 }),
    }, this.isAuthority);

    this.phaseT = 4.5;
    this.hud.setPoints(this.player.points);
    this.hud.setGrenades(4, 0);
    this.hud.setPerks(this.player.perks);
    this.hud.setRound(null);
    this.applyCheats();
    this._configureRemoteSpawnLoadouts();
    this._resize = () => this.onResize();
    addEventListener('resize', this._resize);
    this._visualViewport = window.visualViewport || null;
    this._visualViewport?.addEventListener('resize', this._resize);
    this.onResize();
    // Pointer-lock/fullscreen browser chrome can change the visual viewport one
    // frame after the match appears. Re-measure after layout settles so the
    // first round cannot inherit a cropped or stretched canvas.
    requestAnimationFrame(() => { if (!this.disposed) this.onResize(); });

    if (this.net) {
      this.wireNet();
      // Reliable initial equip removes the race where the first shot arrives
      // before an unreliable snapshot, while the host still validates it
      // against the lobby's configured spawn-loadout allowance.
      if (!this.isAuthority && this.player.weapon) {
        this.netSend({ t: 'swap', w: this.player.weapon.id, pap: !!this.player.weapon.pap, spawn: 1 });
      }
    }
    // Lights must illuminate both the world pass and the viewmodel pass, so
    // they are the one object type that belongs to every layer.
    this.scene.traverse((o) => { if (o.isLight) o.layers.enableAll(); });

    // Forward rendering evaluates every enabled point light per pixel. The map
    // authors ~65 of them; a fixed-size pool mirrors only the ones that matter
    // from where the camera is, keeping NUM_POINT_LIGHTS constant so nothing
    // recompiles. See js/render/LightPool.js.
    this.lightPool = new LightPool(this.scene, this._lightBudget());
    this.lightPool.rescan();

    // Real occlusion: reuse the same swept-box test the weapons use, so a
    // closed paid door or a stack of crates muffles what is behind it. The
    // audio engine throttles and caches these calls itself.
    audio.setOcclusionTest((ex, ey, ez, lx, ly, lz) => {
      const dx = lx - ex, dy = ly - ey, dz = lz - ez;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 0.25) return 0;
      let blocked = 0;
      for (const c of this.map.colliders) {
        if (c.noRaycast || c.shootOk || c.bulletPass) continue;
        const t = segmentHitsBox(ex, ez, lx, lz, c);
        if (t < 0) continue;
        const yAt = ey + (ly - ey) * t;
        const y0 = c.y0 || 0;
        if (yAt < y0 || yAt > y0 + (c.h || 3)) continue;
        blocked += c.prop ? 0.35 : 1;
        if (blocked >= 1) return 1;
      }
      return Math.min(1, blocked);
    });

    audio.startAmbience();
    // voice chat: streams/analysers/mute live on net (shared with the lobby UI);
    // mic is normally already live from the lobby — this is just the fallback.
    this.micMuted = !!this.net?.micMuted;
    if (this.net?.lobbyVoiceEnabled) this.net.enableVoice();
    // mic level for own indicator
    this._micLevel = 0;
    this.clock = performance.now() / 1000;
    const frame = () => { if (this.disposed) return; this._raf = requestAnimationFrame(frame); this.tick(); };
    this._raf = requestAnimationFrame(frame);
    // keep simulation & netcode alive if the tab is backgrounded (rAF throttled)
    this._watchdog = setInterval(() => {
      if (this.disposed) return;
      if (performance.now() / 1000 - this.clock > 0.2) this.tick(false);
      this._healHiddenCanvas();
    }, 100);
  }

  // ---------------- cheat codes (menu toggles) ----------------
  applyCheats() {
    const c = this.cheats, p = this.player;
    if (!c || !p) return;
    if (c.warbond) { p.points = 50000; this.hud.setPoints(p.points); }
    if (c.perkaholic) {
      for (const k of ['jug', 'speed', 'dtap', 'qr']) p.perks.add(k);
      // Buying Jugg raises hp as well as maxHp (see the drink handler). Granting
      // the perk alone left the player spawning at 165/250 — a red health bar
      // and a damage pulse on frame one, for a cheat that is meant to be a gift.
      p.hp = p.maxHpNow;
      this.hud.setPerks(p.perks);
    }
    // Set BEFORE anything equips a weapon. equip() decides the finish at build
    // time — gold for a stock gun, diamond for a Pack-a-Punched one — so a flag
    // raised after the spawn guns were built used to leave them gold, breaking
    // the "Pack-a-Punch turns it to diamond" promise and stacking a second set
    // of material clones on top of the first.
    if (c.goldguns) {
      this.weaponRig.alwaysGold = true;
      this.weaponRig.setKnifeGold(true);
    }
    if (c.opensesame) {
      for (const d of this.map.doors) {
        if (!d.open && (d.cost != null || d.auto)) this.openDoor(d);
      }
    }
    if (c.papguns) {
      p.bowie = true;
      this.weaponRig.setKnifeGold(true);
      const pool = BOX_POOL.filter((id) => id !== 'panzerschreck' && id !== 'bowie' && id !== 'monkey');
      const picks = new Set();
      // Bounded by the pool as well as the target. choice([]) returns undefined,
      // so a pool that ever shrank below 2 would spin this loop forever — a hard
      // tab freeze with no error to point at. It is 22 today; the guard is free.
      while (picks.size < 2 && picks.size < pool.length) picks.add(choice(pool));
      p.weapons = [...picks].map((id) => {
        const s = getStats(id, true);
        return { id, pap: true, mag: s.mag, reserve: s.reserve };
      });
      p.cur = 0;
      this.weaponRig.equip(p.weapon.id, p.weapon.pap);
      this.hud.setAmmo(p.weapon.mag, p.weapon.reserve, getStats(p.weapon.id, true).displayName);
    }
    if (c.wunder) {
      // WUNDERWAFFEN: Ray Gun + DG-2 in hand, two monkeys on the belt
      p.weapons = ['raygun', 'dg2'].map((id) => {
        const s = getStats(id, c.papguns ? true : false);
        return { id, pap: !!c.papguns, mag: s.mag, reserve: s.reserve };
      });
      p.cur = 0;
      p.monkeys = 2;
      p.ownsMonkeys = true;
      this.hud.setGrenades(p.grenades, p.monkeys);
      this.weaponRig.equip(p.weapon.id, p.weapon.pap);
      this.hud.setAmmo(p.weapon.mag, p.weapon.reserve, getStats(p.weapon.id, p.weapon.pap).displayName);
      this.hud.banner('WUNDERWAFFEN', '#7ec8e3', 'Ray Gun + DG-2 · X throws Monkey Bombs');
    }
    // A loadout is persisted in localStorage and can also arrive from the host,
    // so it can name a weapon this build does not have. Drop unknown ids here
    // rather than spawning a gun with no model.
    const loadoutIds = [c.loadout?.p1, c.loadout?.p2].filter((id) => id && WEAPONS[id]);
    if (!c.papguns && !c.wunder && loadoutIds.length) {
      // CUSTOM LOADOUT: spawn with exactly the chosen guns
      const ids = loadoutIds;
      p.weapons = ids.map((id) => {
        const s = getStats(id, false);
        return { id, pap: false, mag: s.mag, reserve: s.reserve };
      });
      p.cur = 0;
      this.weaponRig.equip(p.weapon.id, false);
      this.hud.setAmmo(p.weapon.mag, p.weapon.reserve, getStats(p.weapon.id, false).displayName);
      this.hud.banner('CUSTOM LOADOUT', '#7ec8e3', p.weapons.map((w) => WEAPONS[w.id]?.name).filter(Boolean).join(' + '));
    }
    // Only the starting M1911 needs dressing by hand — it was equipped during
    // init, before alwaysGold was raised. Every branch above re-equips, and
    // equip() applies the right finish itself.
    if (c.goldguns && !c.papguns && !c.wunder && !loadoutIds.length) this.weaponRig.applyGoldCamo(true);
    if (c.god) this.godMode = true;
    if (c.power) setTimeout(() => { if (!this.disposed) this.setPower(true); }, 300); // staggered: not everything at t=0
    if (c.tele) {
      for (const tp of this.map.teleporters) tp.linked = true;
      this.teleLinks = 3;
      this.hud.banner('TELEPORTERS LINKED', '#7ec8e3');
    }
    // spawn config: start round + area. Non-default starts are testing/explore
    // shortcuts, so open the smallest route back to Mainframe as well. Without
    // this, spawning behind the normal progression doors can strand the player.
    // Clamped to the same 1-40 the menu spinner allows. In co-op these cheats
    // are the HOST's, so this value arrives over the wire and is only bounded by
    // the generic payload validator (|n| <= 1e7) — round 1e7 is not a crash, but
    // zombie health scales past 1e9 and the run is unplayable on arrival.
    const startRound = Math.max(1, Math.min(40, Math.trunc(Number(c.startRound)) || 1));
    if (startRound > 1) this.round = startRound - 1;
    const AREAS = {
      courtyard: { x: 0, z: -32, route: ['d_pwrR', 'd_mainR'] },
      factory: { x: 0, z: -48, route: ['d_fact', 'd_pwrR', 'd_mainR'] },
      teleA: { x: -38, z: -13, route: ['d_gen', 'd_mainL'] },
      chem: { x: 17, z: -30, y: 2.9, route: ['d_chem', 'd_mainR'] },
    };
    if (c.startArea && AREAS[c.startArea]) {
      const a = AREAS[c.startArea];
      p.x = a.x; p.z = a.z; p.y = a.y || 0;
      for (const id of a.route) {
        const door = this.map.doors.find((d) => d.id === id);
        if (door && !door.open) this.openDoor(door);
      }
    }
  }

  /** Real point lights kept alive at once. Each one costs every lit pixel. */
  _resolveQualityTier(renderer = this.renderer) {
    const requested = this.options.quality || 'auto';
    if (requested !== 'auto') return requested;
    let label = '';
    try {
      const gl = renderer?.getContext();
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      label = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    } catch (_) { /* privacy-restricted browsers may hide adapter details */ }
    const integrated = /intel|swiftshader|llvmpipe|software|mali|adreno/i.test(label);
    document.documentElement.dataset.gpuClass = integrated ? 'integrated' : (label ? 'discrete-or-fast' : 'unknown');
    // Auto never removes rendering features. Integrated GPUs start from a lower
    // internal resolution below, but keep the same complete High visual stack.
    this._autoIntegrated = integrated;
    return 'high';
  }

  _lightBudget() {
    const q = this._qualityTier || this.options.quality;
    return q === 'low' ? 4 : q === 'medium' ? 6 : 8;
  }

  applyQuality() {
    const q = this._qualityTier = this._resolveQualityTier();
    // Post runs at buffer resolution, so the pixel ratio ceiling is lower than
    // it was for forward rendering — 1.5 already costs 20 fullscreen passes.
    const pr = q === 'low' ? 1 : q === 'medium' ? Math.min(devicePixelRatio, 1.15) : Math.min(devicePixelRatio, 1.5);
    this._qualityPixelRatio = pr;
    // Avoid several seconds of overloaded native-resolution frames on an iGPU,
    // while preserving every High-tier effect. Resolution is the only automatic
    // compromise; Low/Medium remain explicit player choices.
    const initialPr = this.options.quality === 'auto' && this._autoIntegrated ? Math.min(pr, 0.8) : pr;
    this._dynamicPixelRatio = Math.min(this._dynamicPixelRatio || initialPr, pr);
    this.renderer.setPixelRatio(this._dynamicPixelRatio);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.postfx?.setQuality(q === 'low' ? 'low' : q === 'medium' ? 'medium' : 'high');
    if (this.postfx) this.postfx.enabled = q !== 'low';
    // Player control over motion blur. It is deliberate art direction and on by
    // default, but it is also the effect people are most likely to be sensitive
    // to, so it gets a slider that reaches zero rather than being locked on.
    // setQuality resets the preset, so this has to be applied after it.
    if (this.postfx) {
      const mb = this.options.motionBlur;
      const scale = mb == null ? 1 : Math.max(0, mb);
      // Slider position -> sampled length (and the taps that keep it clean).
      this.postfx.setMotionBlurScale(scale);
      // ...and -> shutter strength, cached because updateCamera rewrites
      // motionBlurStrength every frame for the ADS falloff. Writing the option
      // straight onto postfx here instead would last exactly one frame: that
      // was the bug that made this whole slider inert, including Off.
      this._mbUserStrength = MB_BASE_STRENGTH * scale;
    }
    this.lightPool?.setSize(this._lightBudget());
    if (this.map?.moonLight) {
      this.map.moonLight.castShadow = q !== 'low';
      const size = q === 'high' ? 2048 : 1024;
      // Resize through SunShadow, never straight at the light. SunShadow snaps
      // the box centre to the shadow map's texel grid, and the size of that
      // grid IS the map size — a resize it does not see leaves it quantising to
      // the wrong grid, which is shadow crawl: precisely the artifact the
      // snapping exists to remove. (SunShadow now also re-reads the size every
      // frame, so this is belt and braces rather than the only defence.)
      if (this.map.sunShadow) {
        this.map.sunShadow.setResolution(size);
      } else if (this.map.moonLight.shadow.mapSize.x !== size) {
        this.map.moonLight.shadow.mapSize.set(size, size);
        if (this.map.moonLight.shadow.map) { this.map.moonLight.shadow.map.dispose(); this.map.moonLight.shadow.map = null; }
      }
    }
    this._syncPostFxScene();
    this.onResize?.();
  }

  /**
   * Feed the four brightest nearby practicals to the volumetric raymarch so
   * lamps, fires and the muzzle flash actually cast visible cones through the
   * haze. The candidate list is gathered once; only the per-frame pick is hot.
   *
   * These four slots are ranked from the camera, so they reorder as you walk —
   * and a volumetric cone is a large, soft, high-contrast thing, so swapping
   * one hard is far more visible than swapping a point light. The original pick
   * had no incumbency and no fade at all: measured along a running path through
   * the courtyard and the factory it changed slot owners 11 times a second and
   * cut a cone dead 7 times a second, against zero of either standing still.
   * It shares the pool's slot machinery now, so a cone ramps in and out instead
   * of snapping, and near-equal sources stop trading places.
   */
  _updateVolumetricLights(dt) {
    const fx = this.postfx;
    if (!fx || !this.map) return;
    if (!this._volCandidates) {
      const list = [];
      for (const l of this.map.lamps || []) list.push(l.pl);
      for (const f of this.map.fires || []) if (f.light) list.push(f.light);
      for (const l of this.map.props?.lights || []) list.push(l.light);
      if (this.fx?.muzzleLight) list.push(this.fx.muzzleLight);
      for (const b of this.fx?.boomLights || []) list.push(b.light);
      this._volCandidates = list;
      this._volSlots = Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, intensity: 0, radius: 1 }));
      this._volBank = new SlotBank(4);
      this._volWp = new THREE.Vector3();
    }
    const cam = this.camera.position;
    const bank = this._volBank, wp = this._volWp;
    bank.begin();
    // Insertion into a four-slot ranking: cheaper than sorting ~30 lights, and
    // the shift loop is at most three steps.
    for (const L of this._volCandidates) {
      if (!L) continue;
      // Rank on the peak-held intensity the light pool already computed this
      // frame, not the instantaneous one. The old `intensity < 1` gate was a
      // hard cutoff, so a deliberately flickering tube dipping through it
      // dropped its cone for two frames and brought it straight back.
      const smooth = L.userData.poolSmooth ?? L.intensity;
      if (smooth < 1) continue;
      wp.setFromMatrixPosition(L.matrixWorld);
      const dx = wp.x - cam.x, dy = wp.y - cam.y, dz = wp.z - cam.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      // Same hysteresis band on the cull as the point-light pool, and for the
      // same reason: the cull is a `continue`, so without it an incumbent that
      // grazes the boundary is dropped before incumbency can protect it.
      const reach = ((L.distance || 12) + 6) * (bank.holds(L) ? 1.25 : 1);
      if (d2 > reach * reach) continue;
      // Rank by how much a light can actually contribute here, not just range.
      bank.offer(L, smooth / (d2 + 1));
    }
    bank.commit(dt);
    const slots = this._volSlots;
    for (let i = 0; i < 4; i++) {
      const sl = bank.slots[i];
      const L = sl.source;
      const s = slots[i];
      if (!L || sl.weight <= 0) { s.intensity = 0; continue; }
      wp.setFromMatrixPosition(L.matrixWorld);
      s.x = wp.x; s.y = wp.y; s.z = wp.z;
      s.r = L.color.r; s.g = L.color.g; s.b = L.color.b;
      s.radius = L.distance || 12;
      // Three.js point-light intensity is in candela; scale it into the
      // scatter integral's units so lamps read without blowing out. The slot
      // weight only cross-fades the cone in and out — the light's own authored
      // flicker still comes through at full strength.
      s.intensity = L.intensity * sl.weight * 0.006;
    }
    fx.volLights = slots;
  }

  // Keep the post stack pointed at whatever the map currently calls the sun.
  _syncPostFxScene() {
    const fx = this.postfx;
    if (!fx || !this.map) return;
    const sun = this.map.moonLight;
    if (sun) {
      fx.shadowLight = sun;
      fx.sunDir.copy(sun.position).sub(sun.target.position).normalize();
      fx.sunColor.copy(sun.color).multiplyScalar(Math.min(1, sun.intensity * 0.35));
    }
    const grade = this.map.grade;
    if (grade) {
      fx.volDensity = grade.volDensity;
      fx.volHeightFalloff = grade.volHeightFalloff;
      fx.volFogBase = grade.volFogBase;
      fx.volAnisotropy = grade.volAnisotropy;
      fx.volAmbient = grade.volAmbient;
      fx.volAmbientColor.copy(grade.volAmbientColor);
      fx.lift.copy(grade.lift);
      fx.gain.copy(grade.gain);
      fx.gamma.copy(grade.gamma);
      fx.saturation = grade.saturation;
      fx.contrast = grade.contrast;
      fx.bloomStrength = grade.bloomStrength;
      fx.bloomThreshold = grade.bloomThreshold;
      fx.baseExposure = grade.exposure;
    }
  }

  onResize() {
    const w = Math.max(1, this.canvas?.clientWidth || document.documentElement.clientWidth || innerWidth);
    const h = Math.max(1, this.canvas?.clientHeight || document.documentElement.clientHeight || innerHeight);
    this.camera.clearViewOffset?.();
    this.camera.filmOffset = 0;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.viewCamera) {
      this.viewCamera.aspect = w / h;
      this.viewCamera.updateProjectionMatrix();
    }
    // CSS owns the fixed full-viewport size; writing inline dimensions caused
    // stale browser-toolbar measurements to crop/pan the first gameplay frames.
    this.renderer.setSize(w, h, false);
    this.postfx?.setSize(w, h, this._dynamicPixelRatio || 1);
    // gl_PointSize is in device pixels, so particles must be told the buffer
    // height or they change world size whenever the render scale moves.
    this.fx?.setViewportHeight(h * (this._dynamicPixelRatio || 1));
  }

  // ================= net =================
  wireNet() {
    this.net.onEvent = (msg, from) => this.onNetEvent(msg, from);
    this.net.onSnap = (snap) => this.applySnapshot(snap);
    this.net.onPlayerState = (state, from) => {
      const rp = this.remotePlayers.get(from);
      if (rp) {
        // Movement is client-predicted, but lifecycle flags are changed only by
        // validated reliable events. Bound cosmetic scoreboard/loadout fields.
        state.down = rp.down ? 1 : 0;
        state.dead = rp.dead ? 1 : 0;
        state.hp = Number.isFinite(rp.hp) ? rp.hp : 100;
        state.points = clamp(Number(state.points) || 0, 0, 1e7);
        state.kills = clamp(Number(state.kills) || 0, 0, 1e6);
        state.downs = clamp(Number(state.downs) || 0, 0, 1e6);
        state.revives = clamp(Number(state.revives) || 0, 0, 1e6);
        state.perks = Array.isArray(state.perks) ? state.perks.filter((id) => ['jug', 'speed', 'dtap', 'qr'].includes(id)).slice(0, 4) : [];
        // Loadout is reliable host-owned state. Never let a high-frequency
        // cosmetic/movement snapshot smuggle a different gun or PaP flag.
        state.w = rp.weaponId;
        state.pap = rp.weaponPap ? 1 : 0;
        rp.applyState(state, this.time);
      }
      if (msgIsPlayerState(state)) this.hostPlayerStates.set(from, state);
    };
    this.net.onPeerLeave = (id, name = 'Player') => {
      const rp = this.remotePlayers.get(id);
      if (rp) { rp.dispose(this.scene); this.remotePlayers.delete(id); }
      this.hostPlayerStates?.delete(id);
      this._remoteShots.delete(id);
      this._remoteGrenades.delete(id);
      this._remoteCreditClaims.delete(id);
      this.remotePaused?.delete(id);
      this.lobbyPlayers = this.lobbyPlayers.filter((player) => player.id !== id);
      if (this.isAuthority && this.papState.busy && this.papState.owner === id) {
        // Tell the squad BEFORE clearing. Guests who are neither the owner nor
        // the authority have no exit from the ready branch of their own state
        // machine — they wait on this message — so a host that silently reset
        // left every other client stuck on "Upgrading…" with a dead
        // Pack-a-Punch for the rest of the match.
        this.netSend({ t: 'pap_take', pid: id, w: this.papState.weapon });
        this._resetPapState();
        this._syncPapPresentation(0);
      }
      this.hud.banner(`${String(name).toUpperCase()} LEFT THE GAME`, '#ff9944', 'Their soldier was removed');
    };
    this.hostPlayerStates = new Map();
  }

  netSend(msg) { if (this.net) this.net.sendRel(msg); }

  beginLocalPerkDrink(perk) {
    if (!perk || !isPerkId(perk.id) || this.localPerkDrink || !this.weaponRig.startPerkDrink(perk.id)) return false;
    this.localPerkDrink = { id: perk.id, elapsed: 0, granted: false, broke: false, belched: false };
    audio.play('drink');
    this.sendPerkDrinkAnimation(perk.id);
    return true;
  }

  updatePerkDrinks(dt) {
    const drink = this.localPerkDrink;
    if (!drink) return;
    const p = this.player;
    drink.elapsed += dt;
    if ((p.down || p.dead) && !drink.granted) {
      if (this.weaponRig.perkBottle) this.weaponRig.perkBottle.visible = false;
      this.weaponRig.perkDrinkT = 0;
      this.localPerkDrink = null;
      return;
    }
    if (!drink.granted && drink.elapsed >= PERK_DRINK_TIMELINE.grantAt) {
      drink.granted = true;
      p.perks.add(drink.id);
      if (drink.id === 'jug') p.hp = CFG.JUG_HP;
      this.hud.setPerks(p.perks);
      // No screen flash here. The grant lands at 1.56s, mid-gulp, so a white
      // full-screen blowout read as a random glitch rather than as feedback —
      // and the post path drives uFlash, which has no colour to tint toward the
      // perk. The HUD chip, the belch and the bottle smash carry the beat.
      this.netSend({ t: 'perk', id: drink.id });
    }
    if (!drink.broke && drink.elapsed >= PERK_DRINK_TIMELINE.breakAt) {
      drink.broke = true;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const x = p.x + fx * 1.2 - rx * 0.65, z = p.z + fz * 1.2 - rz * 0.65;
      const y = Math.max(0.08, this.map.floorY(x, z, p.y + 1) + 0.08);
      audio.play('bottle_break', { pos: { x, y, z } });
      this.fx.spawnParticles(x, y, z, { count: 18, color: [0.65, 0.88, 0.75], speed: 2.2, spread: 0.8, life: 0.55, grav: 8, size: 0.85 });
    }
    if (!drink.belched && drink.elapsed >= PERK_DRINK_TIMELINE.belchAt) {
      drink.belched = true;
      audio.play('belch', { pos: { x: p.x, y: p.y + 1.55, z: p.z } });
    }
    if (drink.elapsed >= PERK_DRINK_TIMELINE.duration) this.localPerkDrink = null;
  }

  sendPerkDrinkAnimation(perkId) {
    if (!this.net || !SYNCED_PERK_IDS.includes(perkId)) return false;
    // Host-originated events are already authoritative; guest identity is added
    // by Net from the authenticated connection, never from this payload.
    this.netSend(this.isAuthority
      ? { t: 'perk_anim', pid: this.player.id, id: perkId }
      : { t: 'perk_anim', id: perkId });
    return true;
  }

  _configureRemoteSpawnLoadouts() {
    if (!this.isAuthority) return;
    const localLoadout = this.player.weapons.map((weapon) => ({ id: weapon.id, pap: !!weapon.pap }));
    for (const [, remote] of this.remotePlayers) {
      remote.bowie = !!this.cheats.papguns;
      if (this.cheats.papguns && !this.cheats.wunder) {
        // ARMED TO THE TEETH intentionally randomizes independently on each
        // machine. The host permits two authenticated selections from the
        // configured pool, but production/default matches get no such latitude.
        remote.setAuthoritativeLoadout([]);
        remote.ownedWeapons.clear();
        remote.spawnWeaponAllowance = new Map(BOX_POOL
          .filter((id) => !['panzerschreck', 'bowie', 'monkey'].includes(id))
          .map((id) => [id, true]));
      } else {
        remote.setAuthoritativeLoadout(localLoadout);
        remote.spawnWeaponAllowance = new Map(localLoadout.map((weapon) => [weapon.id, weapon.pap]));
      }
    }
  }

  _newHitClaim() {
    let cid = this._nextCreditId++;
    if (this._nextCreditId > 0x7fffffff) this._nextCreditId = 1;
    while (this._pendingHitClaims.has(cid)) {
      cid = this._nextCreditId++;
      if (this._nextCreditId > 0x7fffffff) this._nextCreditId = 1;
    }
    const now = performance.now();
    this._pendingHitClaims.set(cid, { at: now, hit: false, kill: false });
    for (const [id, claim] of this._pendingHitClaims) {
      if (now - claim.at > 8000 || this._pendingHitClaims.size > 512) this._pendingHitClaims.delete(id);
    }
    return cid;
  }

  _acceptLocalCredit(cid, kind) {
    return acceptPendingCredit(this._pendingHitClaims, cid, kind, performance.now());
  }

  _consumeRemoteCredit(from, cid) {
    let ledger = this._remoteCreditClaims.get(from);
    if (!ledger) { ledger = new Set(); this._remoteCreditClaims.set(from, ledger); }
    return consumeCreditClaim(ledger, cid);
  }

  startRemotePerkDrink(pid, perkId) {
    if (pid === this.player.id || !SYNCED_PERK_IDS.includes(perkId)) return false;
    const remote = this.remotePlayers.get(pid);
    if (!remote) return false;
    // RemotePlayer.startPerkDrink(perkId) is the actor-animation integration
    // point. The callback also lets a future cosmetic system observe the event.
    if (typeof remote.startPerkDrink === 'function') remote.startPerkDrink(perkId);
    this.onRemotePerkDrink?.(remote, perkId);
    return true;
  }

  _remoteNear(from, pos, radius = 3) {
    const rp = this.remotePlayers.get(from);
    return !!(rp && pos && Number.isFinite(pos.x) && Number.isFinite(pos.z)
      && dist2D(rp.x, rp.z, pos.x, pos.z) <= radius);
  }

  _remoteNearVisible(from, pos, radius = 3) {
    const rp = this.remotePlayers.get(from);
    if (!rp || !this._remoteNear(from, pos, radius)) return false;
    return this.interactionVisibleFrom(rp.x, rp.y + 1.25, rp.z, pos);
  }

  _remoteActionReady(from, action, cooldownMs) {
    const key = `${from}:${action}`;
    const now = performance.now();
    const last = this._remoteActionAt.get(key) || 0;
    if (now - last < cooldownMs) return false;
    this._remoteActionAt.set(key, now);
    return true;
  }

  _remoteShotTargetAllowed(claim, zombie, head, claimedRay = null) {
    if (!claim || !zombie) return false;
    const targetY = zombie.y + (head ? (zombie.dog ? 1.02 : zombie.crawler ? 0.45 : 1.5) : (zombie.dog ? 0.72 : zombie.crawler ? 0.28 : 1.0));
    const target = { x: zombie.x, y: targetY, z: zombie.z };
    if (claim.s.fire === 'arc') {
      if (claim.accepted.includes(zombie)) return false;
      if (claim.accepted.length) {
        const previous = claim.accepted[claim.accepted.length - 1];
        const fromPoint = this._arcTargetPoint(previous);
        return chainArcTargetAllowed({
          from: fromPoint, target, radius: claim.s.chainRadius || 8,
          visible: this._arcHasLineOfSight(fromPoint, target),
        });
      }
      const directDelta = new THREE.Vector3(
        target.x - claim.origin.x, target.y - claim.origin.y, target.z - claim.origin.z,
      );
      const directDistance = directDelta.length();
      const directWall = directDistance ? this.wallDist(claim.origin, directDelta.normalize(), directDistance + 1.2) : 0;
      if (remoteShotTargetAllowed({
        origin: claim.origin, dir: claim.dir, target,
        baseSpread: Math.max(claim.s.spreadHip || 0, claim.s.spreadAds || 0, 0.01),
        wallDistance: directWall,
      })) return true;
      return floorArcTargetAllowed({
        impact: claim.floorImpact, target,
        visible: !!claim.floorImpact && this._arcHasLineOfSight(claim.floorImpact, target),
      });
    }
    let validationDir = claim.dir;
    if (claim.s.pellets) {
      if (!claimedRay || !boundedPelletDirectionAllowed(claim.dir, claimedRay,
        Math.max(claim.s.spreadHip || 0, claim.s.spreadAds || 0) + 0.035)) return false;
      validationDir = claimedRay;
    }
    if (zombie.dog) {
      // Validate against the same pose-aware anatomy as the guest rendered.
      // A small bounded allowance covers one snapshot/interpolation interval;
      // head claims still require the skull zone specifically.
      const hit = rayHitZones({
        origin: claim.origin,
        dir: validationDir,
        zones: dogHitZones(zombie, { interpolationAllowance: 0.16 }),
        maxDistance: 125,
        head: !!head,
      });
      if (!hit) return false;
      const wall = this.wallDist(claim.origin, validationDir, hit.distance + 0.5);
      return wall >= hit.distance - 0.25;
    }
    const vx = zombie.x - claim.origin.x, vy = targetY - claim.origin.y, vz = zombie.z - claim.origin.z;
    const distance = Math.hypot(vx, vy, vz);
    const wall = distance
      ? this.wallDist(claim.origin, new THREE.Vector3(vx, vy, vz).normalize(), distance + 1.2)
      : 0;
    return remoteShotTargetAllowed({
      origin: claim.origin,
      dir: validationDir,
      target,
      baseSpread: Math.max(claim.s.spreadHip || 0, claim.s.spreadAds || 0, 0.01),
      pellet: !!claim.s.pellets,
      wallDistance: wall,
    });
  }

  applySnapshot(snap) {
    this.zombies.applySnapshot(snap.z, this.time);
    const connected = this._snapshotPlayerIds;
    connected.clear();
    for (const player of this.lobbyPlayers) connected.add(player.id);
    for (const ps of snap.pl) {
      if (ps.id === this.player.id) continue;
      // A final in-flight unreliable packet can arrive after the reliable lobby
      // departure notice. Never resurrect a disconnected soldier from it.
      if (!connected.has(ps.id) && !String(ps.id).startsWith('bot-')) continue;
      let rp = this.remotePlayers.get(ps.id);
      if (!rp) { rp = new RemotePlayer(this.scene, { id: ps.id, name: ps.name, c: ps.c }); this.remotePlayers.set(ps.id, rp); }
      rp.applyState(ps, this.time);
    }
    if (snap.round !== this.round && snap.phase === 'active') {
      // round already announced via reliable event; this is a fallback
    }
  }

  // Is there anyone left for the horde to hunt? Solo bleedout counts as no:
  // the player is down with nobody coming, so the run is already over even
  // though the game-over banner is still a few seconds away. Every peer can
  // answer this from state it already has, so guests settle their local horde
  // at the same moment the host settles the authoritative one.
  hordeHasPrey() {
    if (this.zombies?.monkey) return true;
    if (!this.player.dead && !this.player.down) return true;
    for (const [, rp] of this.remotePlayers) if (!rp.dead && !rp.down) return true;
    for (const b of this.bots || []) if (!b.dead && !b.down) return true;
    return false;
  }

  packCentroid(excludeId) {
    const ps = this.allPlayerStates().filter((p) => p.id !== excludeId && !p.dead && !p.down);
    if (!ps.length) return null;
    return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, z: ps.reduce((a, p) => a + p.z, 0) / ps.length };
  }

  allPlayerStates() {
    // host: own + remote player states (latest) for zombie targeting
    const list = this._playerStateCache;
    list.length = 0;
    this._appendPlayerState(list, this.player.id, this.player);
    if (this.mode === 'host') {
      for (const [id, rp] of this.remotePlayers) this._appendPlayerState(list, id, rp);
    }
    for (const b of this.bots || []) this._appendPlayerState(list, b.id, b);
    return list;
  }

  _appendPlayerState(list, id, source) {
    if (source.dead) return;
    let state = this._playerStateById.get(id);
    if (!state) {
      state = { id, x: 0, z: 0, y: 0, down: false, dead: false };
      this._playerStateById.set(id, state);
    }
    state.x = source.x; state.z = source.z; state.y = source.y;
    state.down = !!source.down; state.dead = !!source.dead;
    list.push(state);
  }

  // ================= main loop =================
  tick(shouldRender = true) {
    const now = performance.now() / 1000;
    let dt = Math.min(0.05, now - this.clock);
    this.clock = now;
    if (shouldRender && !document.hidden) this._tuneRenderScale(dt, now);
    // co-op pause rule: world halts only when EVERY player is paused
    const total = Math.max(1, this.lobbyPlayers.length);
    const pausedCount = (this.paused ? 1 : 0) + (this.remotePaused ? this.remotePaused.size : 0);
    const worldPaused = this.mode === 'solo' ? this.paused : pausedCount >= total;
    if (!worldPaused) {
      this.time += dt;
      // A throw out of update() used to take the rest of the frame with it, and
      // the frame loop queues its next rAF BEFORE calling tick(), so it threw
      // again forever. Two things made that a hang rather than a hiccup: render()
      // below never ran, so the picture froze on the last good frame; and
      // update()'s trailing endFrame() never ran, so edge-triggered keys stayed
      // latched and every held interaction — papTake() among them — re-fired on
      // every frame. Contain it: clear the input edges, report it once, and let
      // the frame finish drawing.
      try {
        this.update(dt);
      } catch (e) {
        endFrame();
        if (!this._updateFailed) { this._updateFailed = true; console.error('game update failed', e); }
      }
    }
    // Post overlays decay on wall-clock time so they still clear while paused.
    this._postDamage = Math.max(0, (this._postDamage || 0) - dt * 3.2);
    this._postFlash = Math.max(0, (this._postFlash || 0) - dt * 7);
    if (shouldRender) this.render(dt);
  }

  /**
   * Last-resort recovery from a laid-out-to-nothing canvas.
   *
   * A live match whose canvas is display:none renders every frame into a
   * hidden element: the HUD still updates, audio still plays, input still
   * works, and the player sees pure black with no way out but a reload. That
   * is the single worst failure this game can produce, and it is reachable
   * from any ordering slip in the screen code, so it gets a watchdog rather
   * than only a fix at the one call site that caused it.
   *
   * Deliberately narrow: it only ever REMOVES the utility class, only while a
   * match is actually running, and only when the canvas has no layout box at
   * all. It cannot fight a legitimate hide (menu, lobby), because those states
   * dispose or pause the game rather than leaving it live.
   */
  _healHiddenCanvas() {
    const c = this.canvas;
    if (!c || !c.isConnected || this.paused) return;
    if (c.clientWidth > 0 && c.clientHeight > 0) return;
    if (!c.classList.contains('hidden')) return;   // hidden by layout, not us
    c.classList.remove('hidden');
    c.setAttribute('aria-hidden', 'false');
    console.warn('[render] game canvas was hidden mid-match; restored it');
    this.onResize();
  }

  /**
   * Dynamic resolution.
   *
   * A resolution change is NOT free and it is NOT invisible: it rebuilds every
   * render target in the post stack and the whole image resamples. So the
   * controller's job is not merely to track the frame budget, it is to change
   * as rarely as it possibly can while still rescuing a machine that is
   * genuinely too slow.
   *
   * This used to be pure bang-bang: drop 0.15 above 20ms, raise 0.10 below
   * 16.95ms, re-evaluated every 2s with nothing in between. That is a loop with
   * positive feedback, because dropping the resolution is exactly what pushes
   * the frame time back under the raise threshold, which then pushes it back
   * over the drop threshold. A machine sitting anywhere near 60fps — which is
   * the machine we are targeting — oscillates forever on a 2-second period,
   * and every cycle costs a full target rebuild and a visible resample. Moving
   * is what pushes frame time over the line, so it presented as the whole
   * screen flickering while walking around.
   *
   * Three things make it stable now: a wide neutral band that both thresholds
   * sit outside of, a requirement that several consecutive checks agree before
   * anything moves, and a long cooldown after any change so a rebuild can
   * never be followed immediately by another.
   */
  _tuneRenderScale(dt, now) {
    if (dt <= 0 || dt > 0.1 || !this.renderer) return;
    this._frameEma = this._frameEma == null ? dt : this._frameEma * 0.94 + dt * 0.06;
    if (now < (this._nextScaleCheck || 0)) return;
    this._nextScaleCheck = now + 2;
    const target = this._qualityPixelRatio || 1;
    const cur = this._dynamicPixelRatio || target;
    const floor = Math.min(target, 0.6);

    // Wide neutral band. Dropping below ~46fps is a real problem worth a
    // rebuild; anything from there up to a comfortable 90fps margin is left
    // alone. The old thresholds were 3ms apart, which is less than the frame
    // time a single extra zombie costs.
    const DROP_ABOVE = 1 / 55;    // ~18.2ms — protect a real 60fps frame budget
    const RAISE_BELOW = 1 / 80;   // ~12.5ms — restore detail only with clear headroom
    let want = 0;
    if (this._frameEma > DROP_ABOVE && cur > floor) want = -1;
    else if (this._frameEma < RAISE_BELOW && cur < target) want = 1;
    const emergency = want < 0 && this._frameEma > 1 / 35;

    // Require consecutive agreeing checks before acting. A burst of zombies, a
    // teleporter effect or one long GC pause must not resize the world.
    if (want === 0) { this._scaleVote = 0; this._scaleVotes = 0; return; }
    if (want !== this._scaleVote) { this._scaleVote = want; this._scaleVotes = 1; if (!emergency) return; }
    else this._scaleVotes = (this._scaleVotes || 0) + 1;
    // Coming down is a rescue, so it needs less convincing than going up.
    if (this._scaleVotes < (emergency ? 1 : (want < 0 ? 2 : 4))) return;
    this._scaleVote = 0; this._scaleVotes = 0;

    let next = want < 0 ? Math.max(floor, cur - (emergency ? 0.2 : 0.15)) : Math.min(target, cur + 0.1);
    if (Math.abs(next - cur) < 0.01) return;
    // Cooldown: after any change, hold for a while regardless of what the EMA
    // does. The EMA needs time to reflect the new cost before it is trustworthy,
    // and this is the backstop that makes an oscillation impossible even if the
    // thresholds are ever retuned badly.
    this._nextScaleCheck = now + (emergency ? 3 : 8);
    this._dynamicPixelRatio = next;
    document.documentElement.dataset.renderScale = String(Math.round(next / Math.max(1, devicePixelRatio || 1) * 100));
    this.renderer.setPixelRatio(next);
    const w = Math.max(1, this.canvas?.clientWidth || innerWidth);
    const h = Math.max(1, this.canvas?.clientHeight || innerHeight);
    this.renderer.setSize(w, h, false);
    // The post stack owns the buffers the scene is actually rendered into, so
    // dynamic resolution has to resize those too — without this the scaler
    // only changed the backbuffer and did nothing for the cost that matters.
    this.postfx?.setSize(w, h, next);
    this.fx?.setViewportHeight(h * next);
  }

  update(dt) {
    const p = this.player;
    // In co-op the world keeps simulating while THIS player is paused,
    // but the paused player's own body/input/camera must freeze.
    if (!this.paused) {
      // timers
      this.doubleT = Math.max(0, this.doubleT - dt);
      this.instaT = Math.max(0, this.instaT - dt);
      this.zombies.instakill = this.instaT > 0;

      // player
      p.update(dt, this);
      this.updateCamera(dt);
      const scopedNow = !!(p.stats?.scope && this.player.adsT > 0.6 && !p.down && !p.dead);
      if (scopedNow !== this._scoped) { this._scoped = scopedNow; this.hud.scope(scopedNow); }
      // never let the view-model leak into the scope picture (rig re-shows it each frame otherwise)
      this.weaponRig.rigHidden = scopedNow;
      // PaP ritual finished -> pull the other weapon (never the one in the machine)
      if (this._papSwapPending && this.weaponRig.knuckleT <= 0) {
        this._papSwapPending = false;
        if (p.weapons.length > 1 && p.weapon.upgrading) {
          this.weaponRig.papHide = false;
          this.switchWeapon(1 - p.cur);
        } else {
          // With only one weapon there is nothing to draw while it is inside
          // the machine. Keep the viewmodel empty until papTake() equips the
          // upgraded output (or a rejected request restores the original).
          this.weaponRig.papHide = !!p.weapon?.upgrading;
        }
      }
      const rigState = this._rigFrameState;
      rigState.ads = isAimDown() && !p.down && !p.dead && !this.weaponRig.isReloading;
      rigState.moving = !!p.moving;
      rigState.sprinting = p.sprinting;
      rigState.sliding = !!p.sliding;
      rigState.mouseX = p.mdx || 0;
      rigState.mouseY = p.mdy || 0;
      this.weaponRig.update(dt, rigState);
      this.updatePerkDrinks(dt);

      // shooting inputs
      if (!this.over && input.locked) this.handleCombatInput(dt);

      // interactions
      this.updateInteract(dt);
    }

    // zombies
    // Nothing to chase means nothing to chase toward: stand and breathe rather
    // than sprint on the spot at a body. Re-evaluated every frame, so a revive
    // puts the horde straight back on the hunt.
    this.zombies.setDormant(!this.hordeHasPrey());
    if (this.isAuthority) {
      this.zombies.update(dt, this.allPlayerStates());
      this.updateRounds(dt);
      this.updateDrops(dt);
      this.updateTraps(dt);
      this.updateMonkeyHost(dt);
    } else {
      this.zombies.interpolate(this.time);
      // The host announces intermission once. Clients run the same visible
      // countdown locally; respawning is no longer coupled to the next round.
      if (this.phase === 'intermission') {
        this.phaseT = Math.max(0, this.phaseT - dt);
        if (this.player.dead) this.respawnSelf();
      }
      // animation LOD: nearby zombies animate every frame, far ones at reduced rate
      this._animFrame = ((this._animFrame || 0) + 1) | 0;
      const px = this.player.x, pz = this.player.z;
      for (const [, z] of this.zombies.zombies) {
        const d2 = (z.x - px) ** 2 + (z.z - pz) ** 2;
        const every = d2 < 625 ? 1 : d2 < 2025 ? 2 : 3;
        this.zombies.animate(z, dt, ((this._animFrame + z.id) % every) !== 0);
      }
    }

    // projectiles & grenades
    this.updateProjectiles(dt);
    this.updateGrenades(dt);

    // remote players
    for (const [, rp] of this.remotePlayers) rp.interpolate(this.time, dt, this.camera);

    // box / pap state machines (authority drives; clients mirror via events)
    this.updateBox(dt);
    this.updatePap(dt);

    // map & fx
    // The shadow box follows the player, biased forward so the visible half of
    // the frustum is the half they are actually looking into.
    this._shadowFocus = this._shadowFocus || new THREE.Vector3();
    this._shadowFocus.set(
      p.x - Math.sin(p.yaw) * 9,
      Math.max(0, p.y) + 1,
      p.z - Math.cos(p.yaw) * 9,
    );
    this.map.update(dt, this.map.power.on, this._shadowFocus);
    this.houndFX?.update(dt, this.zombies.zombies, this.camera.position);
    this.lightPool?.update(dt, this.camera.position);
    // After the pool, which is what refreshes each source's peak-held intensity.
    this._updateVolumetricLights(dt);
    this.fx.update(dt, this.camera, this.time);

    // How pressed the player is right now: closest enemy inside 12m, weighted
    // by how many are in that ring. Drives the mix's tension state.
    {
      let nearest = 1e9, crowd = 0;
      for (const [, z] of this.zombies.zombies) {
        if (z.dead) continue;
        const d2 = (z.x - p.x) ** 2 + (z.z - p.z) ** 2;
        if (d2 < 144) { crowd++; if (d2 < nearest) nearest = d2; }
      }
      const prox = nearest < 1e9 ? 1 - Math.sqrt(nearest) / 12 : 0;
      this._nearThreat = clamp(prox * 0.7 + Math.min(1, crowd / 8) * 0.3, 0, 1);
    }

    // audio listener + jingles
    audio.updateListener(p.x, p.y + 1.6, p.z, p.yaw);
    // Room drives reverb zone selection; health and nearby threat drive the
    // ducking/low-pass/heartbeat state of the mix.
    audio.setListenerRoom(this.map.roomAt(p.x, p.z, p.y)?.id || null);
    audio.setIntensity({
      health: clamp(p.hp / Math.max(1, p.maxHpNow), 0, 1),
      threat: clamp(this._nearThreat || 0, 0, 1),
    });
    for (const perk of this.map.perks) {
      const d = dist2D(p.x, p.z, perk.x, perk.z);
      if (d < 26) {
        audio.startJingle(perk.jingleId, perk.id);
        const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
        audio.setJingleProximity(perk.jingleId, d, ((perk.x - p.x) * rx + (perk.z - p.z) * rz) / Math.max(1, d));
      }
    }

    // net sync
    if (this.net) this.updateNet(dt);

    // HUD
    this.updateHUD(dt);
    endFrame(); // consume edge-triggered inputs at end of the frame
  }

  updateCamera(dt) {
    const p = this.player;
    // Down or dead is not a moment for the camera to editorialise. Trauma keeps
    // decaying in fx so nothing accumulates and slams you on revive — it just
    // stops being applied. Gated here rather than in fx.getShakeOffset() because
    // fx has no player-state knowledge and validate-performance-invariants
    // asserts the offset-reuse shape of that method.
    const sh = (p.down || p.dead) ? NO_SHAKE : this.fx.getShakeOffset();
    if (this.spectateTarget) {
      const rp = this.remotePlayers.get(this.spectateTarget);
      if (rp && !rp.dead && !rp.down) {
        // true first-person of the teammate: their eye height, their aim
        this.camera.position.set(rp.x, rp.y + 1.62, rp.z);
        this.camera.rotation.set(rp.pitch, rp.yaw, 0);
        if (Math.abs(this.camera.fov - this.options.fov) > 0.1) {
          this.camera.fov = damp(this.camera.fov, this.options.fov, 12, dt);
          this.camera.updateProjectionMatrix();
        }
        return;
      }
      this.pickSpectate(); // they went down too — ride with someone else
      if (!this.spectateTarget) {
        this.camera.position.set(p.x, p.y + 0.8, p.z);
        this.camera.rotation.set(-0.4, p.yaw, 0);
      }
      return;
    }
    // Dead and not riding with a teammate (solo, or nobody left to spectate):
    // hold the last pose. The rig would otherwise keep breathing — and it
    // breathes harder the lower your health, so a corpse would sway more than
    // a healthy player.
    if (p.dead) {
      if (!this._deathCamHeld) {
        this._deathCamHeld = true;
        this.camera.position.set(p.x, p.y + 0.45, p.z);
        this.camera.rotation.set(-0.35, p.yaw, 0);
      }
      return;
    }
    // ---- procedural camera layer: bob, sway, roll, landing, recoil ----
    const rig = this.cameraRig;
    if (p.landImpact > 0) {
      const k = rig.addLanding(p.landImpact);
      if (k > 0.12) {
        this.fx.shake(k * 0.35);
        audio.play('step', { vol: 0.6 + k * 0.9 });
      }
      p.landImpact = 0;
    }
    const rigState = this._camState || (this._camState = {});
    rigState.speed = p.speed2D || 0;
    rigState.maxSpeed = p.maxSpeed || CFG.WALK_SPEED;
    rigState.sprinting = !!p.sprinting;
    rigState.grounded = !!p.grounded;
    rigState.crouching = !!p.crouched;
    rigState.sliding = !!p.sliding;
    rigState.ads = p.adsT;
    rigState.strafe = p.strafeInput || 0;
    rigState.mdx = p.mdx || 0;
    rigState.mdy = p.mdy || 0;
    // While down the health term would sit at zero and drive the breathing to
    // its deepest, which reads as camera shake — exactly what we just removed.
    // The down overlay already communicates the state; keep the camera still.
    rigState.health01 = p.down ? 1 : clamp(p.hp / Math.max(1, p.maxHpNow), 0, 1);
    rig.update(dt, rigState);

    // Eye height is smoothed so stairs and ramps glide instead of stepping.
    const eyeY = rig.smoothEye(p.y + p.eyeHeight, dt, p.grounded);

    // Bob/lean are authored in the camera's own frame, so rotate them into
    // world space along the current view basis before applying.
    const yaw = p.yaw + sh.yaw + rig.yaw;
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    this.camera.position.set(
      p.x + rightX * rig.offsetX,
      eyeY + rig.offsetY,
      p.z + rightZ * rig.offsetX,
    );
    this.camera.rotation.set(
      p.pitch + sh.pitch + rig.pitch,
      yaw,
      sh.roll + rig.roll,
    );

    // fov: base * ads zoom * sprint/slide stretch
    const s = p.stats;
    const zoom = s ? lerp(1, s.zoom, p.adsT) : 1;
    const targetFov = this.options.fov * zoom + rig.fovAdd;
    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      // ADS must snap; sprint stretch can breathe.
      this.camera.fov = damp(this.camera.fov, targetFov, p.adsT > 0.02 ? 20 : 11, dt);
      this.camera.updateProjectionMatrix();
    }

    // Post reacts to the state of the body: motion blur eases off when aiming
    // (you want a readable sight picture), and ADS racks focus onto the target.
    const fxp = this.postfx;
    if (fxp) {
      fxp.motionBlurStrength = this._mbUserStrength * (1.0 - p.adsT * 0.55);
      // Focus racks onto the sight line when aiming, but gently: this is a
      // wave shooter, and blurring an enemy at five metres to look cinematic
      // would cost the player the shot.
      fxp.dofMaxBlur = p.adsT > 0.45 ? lerp(0, 5.5, (p.adsT - 0.45) / 0.55) : 0;
      fxp.dofFocus = 14;
      fxp.dofRange = 30;
      // Sprinting narrows the tunnel a little; low health closes it further.
      const hurt = 1 - rigState.health01;
      fxp.vignette = 0.34 + rig.sprintT * 0.12 + hurt * 0.3;
      fxp.chromatic = 0.11 + rig.sprintT * 0.05 + hurt * 0.16;
      fxp.saturation = (this.map?.grade?.saturation ?? 1.1) * (1 - hurt * 0.35);
    }
  }

  // ================= combat input =================
  handleCombatInput(dt) {
    const p = this.player;
    const s = p.stats;
    if (!s) return;
    if (this.localPerkDrink) {
      this._mouseClicked = false;
      this._burstLeft = 0;
      return;
    }
    // fire
    const wantFire = s.auto ? input.mouseDown : input.pressed && this._mouseClicked;
    if (input.mouseDown && !this._wasMouseDown) this._mouseClicked = true;
    this._wasMouseDown = input.mouseDown;
    const firePressed = s.auto ? input.mouseDown : this._mouseClicked;
    if (firePressed && p.canFire(this)) {
      this.fireWeapon();
      // burst weapons: schedule the rest of the burst
      if (s.burst && p.weapon.mag > 0) {
        this._burstLeft = s.burst - 1;
        this._burstT = 60 / s.rpm;
      }
    }
    if (this._burstLeft > 0) {
      this._burstT -= dt;
      if (this._burstT <= 0 && p.canFire(this) && p.weapon.mag > 0) {
        this.fireWeapon();
        this._burstLeft--;
        this._burstT = 60 / s.rpm;
        if (p.weapon.mag <= 0) this._burstLeft = 0;
      }
      if (this._burstT < -0.5) this._burstLeft = 0;
    }
    this._mouseClicked = false;
    // auto-reload the moment the mag runs dry (if there's reserve to draw from)
    // Reloading is allowed while down — the down pistol carries the spawn
    // reserve, and eight rounds with no way to top up would be a formality.
    if (p.weapon.mag === 0 && p.weapon.reserve > 0 && !this.weaponRig.isReloading && !p.dead) this.startReload();
    // reload
    if (input.pressed['KeyR'] && !this.weaponRig.isReloading && p.weapon.mag < s.mag && p.weapon.reserve > 0 && !p.dead) {
      this.startReload();
    }
    // weapon switch — never while down; goDown() leaves exactly one slot, and
    // this guard keeps that true if a stash ever restores early.
    if ((input.pressed['Digit1'] || input.pressed['Digit2']) && p.weapons.length > 1 && !p.down) {
      const idx = input.pressed['Digit1'] ? 0 : 1;
      if (idx !== p.cur) this.switchWeapon(idx);
    }
    if (input.pressed['KeyQ'] && p.weapons.length > 1 && !p.down) this.switchWeapon(1 - p.cur);
    // melee
    if (input.pressed['KeyV'] && p.meleeCooldown <= 0 && !p.down) this.melee();
    // inspect weapon (I) — per-class handling foley
    if (input.pressed['KeyI'] && !this.weaponRig.isReloading && this.weaponRig.inspectT <= 0 && !p.down && !p.dead) {
      this.weaponRig.startInspect();
      const cls = p.stats?.cls;
      if (cls && cls !== 'melee' && cls !== 'tactical') audio.play(`inspect_${cls}`);
    }
    // grenade (G) / monkey bomb (X) — separate throws, you can hold both
    if (input.pressed['KeyG'] && p.grenadeCooldown <= 0 && !p.down) this.throwGrenade();
    if (input.pressed['KeyX'] && p.grenadeCooldown <= 0 && !p.down) this.throwMonkey();
    // flashlight toggle (T)
    if (input.pressed['KeyT'] && !p.down && !p.dead) {
      this.flashlight.intensity = this.flashlight.intensity > 0 ? 0 : 26;
      audio.play('ui');
    }
  }

  switchWeapon(idx) {
    const p = this.player;
    if (!p.weapons[idx] || this.weaponRig.knuckleT > 0) return;
    if (p.weapons[idx].upgrading) { audio.play('deny'); return; } // it's inside the Pack-a-Punch
    // Cancel every delayed reload stage/completion owned by the old slot.
    this._reloadToken = (this._reloadToken || 0) + 1;
    p.cur = idx;
    p.switchCooldown = 0.4;
    this.weaponRig.papHide = false;
    this.weaponRig.swapTo(p.weapon.id, p.weapon.pap);
    if (p.weapon.gold && !p.weapon.pap) this.weaponRig.applyGoldCamo(true);
    audio.play('swap');
    this.netSend({ t: 'swap', w: p.weapon.id, pap: !!p.weapon.pap });
  }

  // ---------------- persona voice barks ----------------
  bark(event, { force = false, chance = 1 } = {}) {
    if (this.over || this.disposed) return;
    if (this.barkCd > 0 && !force) return;
    if (!force && Math.random() > chance) return;
    const n = variantCount(this.personaIdx, event);
    if (!n) return;
    const v = Math.floor(Math.random() * n);
    this.barkCd = force ? 5 : 16;
    this.playBark(this.personaIdx, event, v);
    this.netSend({ t: 'bark', p: this.personaIdx, e: event, v, pid: this.player.id });
  }

  playBark(pIdx, event, variant, pos = null) {
    const line = lineFor(pIdx, event, variant);
    if (!line) return;
    const buf = assets.sound(line.file);
    if (buf) {
      // character speech rides the SFX bus at full presence — a spoken line is
      // ALWAYS heard (never gated by the zombie-voices slider); teammates positional
      audio.playBuffer(buf, 'vox', { bus: 'sfx', vol: 1.8, pos, refDist: 10, maxDist: 70 });
      if (!pos) this.barkCd = Math.max(this.barkCd, buf.duration + 4); // only my own lines throttle me
    }
    this.hud.voxSub(`${line.persona.label}: ${line.text}`);
  }

  startReload() {
    const p = this.player, s = p.stats;
    const weapon = p.weapon;
    const token = this._reloadToken = (this._reloadToken || 0) + 1;
    const dur = s.reload * p.reloadMult;
    this.weaponRig.startReload(dur);
    this.bark('reload', { chance: 0.12 });
    // per-gun staged reload foley — each stage synced to the rig's sub-animation
    for (const [st, name] of (s.reloadStages || [[0.1, 'rel_magin']])) {
      setTimeout(() => {
        if (this.disposed || p.down || p.dead || token !== this._reloadToken
            || p.weapon !== weapon || !this.weaponRig.isReloading) return;
        audio.play(name, { rate: s.relRate || 1 });
      }, st * dur * 1000);
    }
    setTimeout(() => {
      if (this.disposed || p.down || p.dead || token !== this._reloadToken || p.weapon !== weapon) return;
      const cap = getStats(weapon.id, weapon.pap).mag;
      const need = Math.max(0, cap - weapon.mag);
      const take = Math.min(need, weapon.reserve);
      weapon.mag += take;
      weapon.reserve -= take;
    }, dur * 1000 - 120);
  }

  fireWeapon() {
    const p = this.player, s = p.stats;
    const w = p.weapon;
    if (this.weaponRig.knuckleT > 0 || this.weaponRig.papHide) return; // hands busy (PaP ritual)
    if (w.mag <= 0) {
      audio.play('dry');
      if (w.reserve > 0 && !this.weaponRig.isReloading) this.startReload();
      p.fireCooldown = 0.25;
      return;
    }
    w.mag--;
    // Lets the audio engine give the last round in a magazine its own
    // treatment (pitched down, with the bright bolt-lock ping).
    audio.setAmmoState(w.mag, s.mag);
    p.fireCooldown = 60 / (s.rpm * p.rpmMult);
    // recoil & bloom
    //
    // Aiming buys recoil discipline, and it buys it unevenly on purpose. What a
    // shouldered weapon gives you is not less kick so much as more READABLE
    // kick: the muzzle still climbs, so a burst still has to be walked back
    // down, but the part of recoil that has no direction — the sideways scatter
    // that flips sign every round — is what a cheek weld actually removes.
    // Leaving it in was why aimed automatic fire read as the screen convulsing
    // instead of as the gun climbing, and it got worse the tighter the zoom,
    // since a narrower field magnifies every one of those degrees.
    const aim = p.adsT;
    const climb = 1 - aim * ADS_RECOIL_CLIMB;    // vertical: trimmed
    const scatter = 1 - aim * ADS_RECOIL_SCATTER; // lateral: nearly gone
    p.recoilPitch += s.kick * rand(0.8, 1.2) * climb; // recoil climbs UP, damps back
    p.yaw += rand(-0.3, 0.3) * s.kick * 0.5 * scatter;
    p.spreadBloom = Math.min(0.03, p.spreadBloom + (s.bloomKick ?? s.kick) * 0.35);
    // Visual kick is a separate spring from the aim recoil above: it snaps the
    // whole view and settles back, so the sight picture jolts on every round
    // without permanently moving where the player is actually aiming.
    const heavy = s.cls === 'shotgun' || s.cls === 'sniper' || s.cls === 'launcher';
    const kickScale = (heavy ? 2.2 : 1) * climb;
    const lateralScale = (heavy ? 2.2 : 1) * scatter;
    this.cameraRig?.addRecoil(
      s.kick * 26 * kickScale * rand(0.85, 1.2),
      rand(-1, 1) * s.kick * 16 * lateralScale,
      rand(-1, 1) * s.kick * 22 * lateralScale,
    );
    this.weaponRig.fire();
    // Muzzle trauma is suppressed while down so it cannot pile up during a
    // crawl and discharge into the camera the frame you are revived.
    //
    // Trauma is noise, not motion — three detuned sines per axis, sampled at
    // 30Hz, which is above the frame rate and therefore aliases. That reads as
    // grit behind a hip-fired burst and as flicker behind an aimed one, so
    // aiming takes most of it off.
    if (!p.down) this.fx.shake((heavy ? 0.22 : 0.08) * scatter);
    // A frame of extra exposure sells the flash lighting up the room.
    this._postFlash = Math.min(3, (this._postFlash || 0) + (heavy ? 0.16 : 0.07));
    // PaP weapons sound upgraded: pap-variant file if present, else base (slower) + energy zap layer
    if (w.pap) {
      const papSfx = s.sfx + '_pap';
      if (assets.sound(papSfx)) {
        audio.play(papSfx, { pos: { x: p.x, y: p.y + 1.5, z: p.z } });
      } else {
        audio.play(s.sfx, { pos: { x: p.x, y: p.y + 1.5, z: p.z }, rate: 0.9 });
        audio.play('pap_zap', { pos: { x: p.x, y: p.y + 1.5, z: p.z }, vol: 0.5 });
      }
    } else {
      audio.play(s.sfx, { pos: { x: p.x, y: p.y + 1.5, z: p.z } });
    }
    const mw = this.weaponRig.muzzleWorld;
    {
      // Point the flash down the barrel so gas and powder throw forward.
      const fwdX = -Math.sin(p.yaw) * Math.cos(p.pitch);
      const fwdY = Math.sin(p.pitch);
      const fwdZ = -Math.cos(p.yaw) * Math.cos(p.pitch);
      const scale = s.cls === 'shotgun' || s.cls === 'launcher' ? 1.7
        : s.cls === 'sniper' || s.cls === 'lmg' ? 1.3
        : s.cls === 'pistol' ? 0.8 : 1;
      this.fx.muzzleFlash(mw.x, mw.y, mw.z, fwdX, fwdY, fwdZ, scale);
    }
    if (s.cls !== 'wonder') this.fx.shell(mw.x, mw.y, mw.z, Math.cos(p.yaw), -Math.sin(p.yaw));
    // bolt-action rifles: work the bolt between shots (unique foley per rifle)
    if (s.bolt) {
      setTimeout(() => { if (!this.disposed && !p.down) audio.play(`bolt_${w.id}_out`); }, 190);
      setTimeout(() => { if (!this.disposed && !p.down) audio.play(`bolt_${w.id}_in`); }, 500);
    }

    const dir = this.getAimDir(s);
    const origin = new THREE.Vector3(p.x, p.y + p.eyeHeight, p.z);
    // `pid` names the shooter. The host stamps guests' relays with the
    // sender's id; it has to stamp its own here, because a guest receiving a
    // reliable message only ever learns that it came from 'host'.
    this.netSend({ t: 'shoot', pid: p.id, x: p.x, y: p.y + 1.5, z: p.z, dx: dir.x, dy: dir.y, dz: dir.z, w: w.id, pap: w.pap, sfx: s.sfx });

    if (s.fire === 'hitscan') {
      const pellets = s.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const d = pellets > 1 ? this.getAimDir(s, true) : dir;
        this.hitscan(origin, d, s, w, mw);
      }
    } else if (s.fire === 'projectile') {
      this.spawnProjectile(mw, dir, s, w);
    } else if (s.fire === 'arc') {
      // Reuse the exact direction sent to the host. Rolling spread again here
      // made valid guest DG-2 hits disagree with host validation.
      this.fireArc(mw, s, w, dir);
    }
    if (w.mag === 0 && w.reserve > 0) setTimeout(() => { if (!this.weaponRig.isReloading && !this.disposed) this.startReload(); }, 220);
  }

  getAimDir(s, pellet = false) {
    const p = this.player;
    const spread = lerp(s.spreadHip + p.spreadBloom, s.spreadAds, p.adsT) * (pellet ? 1 : (p.sprinting ? 1.7 : 1));
    this._aimEuler.set(
      p.pitch + rand(-spread, spread),
      p.yaw + rand(-spread, spread), 0, 'YXZ',
    );
    return this._aimDir.set(0, 0, -1).applyEuler(this._aimEuler);
  }

  wallDist(origin, dir, maxDist = 120) {
    const x1 = origin.x + dir.x * maxDist, z1 = origin.z + dir.z * maxDist;
    const y1 = origin.y + dir.y * maxDist;
    let best = maxDist;
    for (const c of this.map.colliders) {
      // Window aperture guards keep players from jumping through a boarded
      // opening, but they are not physical cover: bullets still pass through.
      // `bulletPass` is the same idea for the reverse case — scaffolding that
      // holds bodies but that the player cannot see, so it must not stop a shot.
      if (c.noRaycast || c.bulletPass) continue;
      const t = segmentHitsBox(origin.x, origin.z, x1, z1, c);
      if (t < 0) continue;
      const yAt = origin.y + (y1 - origin.y) * t;
      const y0 = c.y0 || 0;
      if (yAt >= y0 && yAt <= y0 + (c.h || 3)) {
        const d = t * maxDist;
        if (d < best) best = d;
      }
    }
    if (y1 < 0) { // floor
      const t = -origin.y / (y1 - origin.y);
      if (t * maxDist < best) best = t * maxDist;
    }
    return best;
  }

  /**
   * Like wallDist, but also reports which face was struck and what it is made
   * of, so impacts can spawn the right debris. Colliders carry no material, so
   * the surface is inferred from the collider's gameplay role — good enough to
   * make concrete, wood and steel read as three different hits.
   */
  wallHit(origin, dir, maxDist = 120) {
    const x1 = origin.x + dir.x * maxDist, z1 = origin.z + dir.z * maxDist;
    const y1 = origin.y + dir.y * maxDist;
    const out = this._wallHitOut || (this._wallHitOut = { dist: 0, nx: 0, ny: 1, nz: 0, surface: 'concrete', hit: false });
    out.dist = maxDist; out.hit = false;
    out.nx = -dir.x; out.ny = -dir.y; out.nz = -dir.z; out.surface = 'concrete';
    let bestCollider = null;
    for (const c of this.map.colliders) {
      if (c.noRaycast || c.bulletPass) continue;
      const t = segmentHitsBox(origin.x, origin.z, x1, z1, c);
      if (t < 0) continue;
      const yAt = origin.y + (y1 - origin.y) * t;
      const y0 = c.y0 || 0;
      if (yAt < y0 || yAt > y0 + (c.h || 3)) continue;
      const d = t * maxDist;
      if (d >= out.dist) continue;
      out.dist = d; bestCollider = c;
    }
    if (y1 < 0) {
      const t = -origin.y / (y1 - origin.y);
      if (t * maxDist < out.dist) {
        out.dist = t * maxDist; bestCollider = null;
        out.nx = 0; out.ny = 1; out.nz = 0; out.hit = true;
        const hx = origin.x + dir.x * out.dist, hz = origin.z + dir.z * out.dist;
        out.surface = this.map.roomAt(hx, hz, 0)?.outdoor ? 'dirt' : 'concrete';
        return out;
      }
    }
    if (bestCollider) {
      out.hit = true;
      const c = bestCollider;
      const hx = origin.x + dir.x * out.dist, hz = origin.z + dir.z * out.dist;
      // Nearest face wins: the smallest distance to a slab plane is the one
      // the ray came through.
      const dxMin = Math.abs(hx - c.minX), dxMax = Math.abs(hx - c.maxX);
      const dzMin = Math.abs(hz - c.minZ), dzMax = Math.abs(hz - c.maxZ);
      const m = Math.min(dxMin, dxMax, dzMin, dzMax);
      out.nx = 0; out.ny = 0; out.nz = 0;
      if (m === dxMin) out.nx = -1;
      else if (m === dxMax) out.nx = 1;
      else if (m === dzMin) out.nz = -1;
      else out.nz = 1;
      out.surface = c.window || c.board ? 'wood'
        : c.boxCollider ? 'wood'
        : c.prop ? 'metal'
        : 'concrete';
    }
    return out;
  }

  _arcTargetPoint(zombie) {
    return {
      x: zombie.x,
      y: zombie.y + (zombie.dog ? 0.76 : zombie.crawler ? 0.42 : 0.9),
      z: zombie.z,
    };
  }

  _arcHasLineOfSight(from, to) {
    if (!from || !to) return false;
    const origin = new THREE.Vector3(from.x, from.y + 0.22, from.z);
    const delta = new THREE.Vector3(to.x - origin.x, to.y - origin.y, to.z - origin.z);
    const distance = delta.length();
    if (distance < 0.05) return true;
    const wall = this.wallDist(origin, delta.normalize(), distance + 0.15);
    return wall >= distance - 0.25;
  }

  _dg2FloorImpact(origin, dir, maxDist = 60) {
    // Ray-march against map.floorY so ground, catwalks and raised rooms are all
    // valid surfaces. A wall collider shortens the scan before selection.
    if (!origin || !dir || dir.y >= -0.035) return null;
    const limit = this.wallDist(origin, dir, maxDist);
    const step = 0.12;
    for (let d = step; d <= limit + step; d += step) {
      const distance = Math.min(d, limit);
      const point = {
        x: origin.x + dir.x * distance,
        y: origin.y + dir.y * distance,
        z: origin.z + dir.z * distance,
      };
      const floor = this.map.floorY(point.x, point.z, point.y + 0.8, 2);
      if (point.y <= floor + 0.1) return { x: point.x, y: floor, z: point.z, distance };
      if (distance >= limit) break;
    }
    return null;
  }

  zombieHitTest(origin, dir, maxDist) {
    // returns array of {z, dist, head} sorted by dist
    const hits = [];
    for (const [, z] of this.zombies.zombies) {
      if (z.state === ZSTATES.DIE) continue;
      if (z.dog) {
        const hit = rayHitZones({ origin, dir, zones: dogHitZones(z), maxDistance: maxDist });
        if (hit) hits.push({ z, dist: hit.centerDistance, head: hit.head });
        continue;
      }
      const spheres = z.crawler
          ? [{ x: z.x, y: z.y + 0.45, z: z.z, r: 0.22, head: true }, { x: z.x, y: z.y + 0.28, z: z.z, r: 0.36, head: false }]
          : [{ x: z.x, y: z.y + 1.5, z: z.z, r: 0.23, head: true },
             { x: z.x, y: z.y + 1.05, z: z.z, r: 0.36, head: false },
             { x: z.x, y: z.y + 0.5, z: z.z, r: 0.33, head: false }];
      for (const sp of spheres) {
        const ox = sp.x - origin.x, oy = sp.y - origin.y, oz = sp.z - origin.z;
        const tca = ox * dir.x + oy * dir.y + oz * dir.z;
        if (tca < 0 || tca > maxDist) continue;
        const d2 = ox * ox + oy * oy + oz * oz - tca * tca;
        if (d2 < sp.r * sp.r) {
          hits.push({ z, dist: tca, head: sp.head });
          break; // one hit per zombie per ray
        }
      }
    }
    hits.sort((a, b) => a.dist - b.dist);
    return hits;
  }

  hitscan(origin, dir, s, w, muzzleWorld) {
    const maxDist = 120;
    const wDist = this.wallDist(origin, dir, maxDist);
    const hits = this.zombieHitTest(origin, dir, wDist);
    const pen = penetrationProfile(s).maxTargets;
    const endDist = hits.length ? hits[Math.min(hits.length, pen) - 1].dist : wDist;
    this.fx.tracer(muzzleWorld.x, muzzleWorld.y, muzzleWorld.z,
      origin.x + dir.x * Math.min(endDist, wDist), origin.y + dir.y * Math.min(endDist, wDist), origin.z + dir.z * Math.min(endDist, wDist));
    let anyHit = false;
    for (let i = 0; i < Math.min(hits.length, pen); i++) {
      const { z, dist, head } = hits[i];
      const dmg = hitscanDamage(s, dist, i);
      anyHit = true;
      const hx = z.x;
      const hy = z.y + (z.dog ? (head ? 1.02 : 0.72) : (head ? 1.5 : 1.0));
      const hz = z.z;
      this.hitFX(z, hx, hy, hz, head);
      this.applyZombieDamage(z, dmg, head, w, s, false, dir);
    }
    if (!anyHit && wDist < maxDist) {
      const h = this.wallHit(origin, dir, maxDist);
      const ix = origin.x + dir.x * h.dist, iy = origin.y + dir.y * h.dist, iz = origin.z + dir.z * h.dist;
      this.fx.impact(ix, iy, iz, h.nx, h.ny, h.nz, h.surface);
      audio.bulletImpact({ x: ix, y: iy, z: iz }, h.surface);
    }
  }

  /**
   * Impact feedback on a hit. Hounds burn rather than bleed — they get embers
   * and ash, never a spray or a pool, so nothing of them is left on the floor.
   */
  hitFX(z, x, y, zz, big) {
    if (z.dog) this.houndFX?.houndHit(x, y, zz, big);
    else this.fx.blood(x, y, zz, big);
  }

  applyZombieDamage(z, dmg, head, w, s, explosive, claimDir = null) {
    if (this.isAuthority) {
      const res = this.zombies.damage(z.id, dmg, { head, by: this.player.id, explosive, weapon: s });
      if (res.ok) {
        this.awardPoints(CFG.POINTS_HIT, z);
        this.hud.hitmarker(res.killed, head);
        audio.play(res.killed ? 'hitmarker_kill' : 'hitmarker');
        if (head && !res.killed) audio.play('headshot', { pos: z });
        if (res.killed) this.onKillConfirm(z, head);
      }
    } else {
      // Blood/tracers remain responsive, but scoring and hit-confirm feedback
      // arrive only after the host accepts this single-use claim.
      const cid = this._newHitClaim();
      this.netSend({
        t: 'zhit', cid, z: z.id, dmg, head, wid: w.id, pap: w.pap,
        exp: explosive ? 1 : 0,
        ray: claimDir ? [claimDir.x, claimDir.y, claimDir.z] : undefined,
      });
    }
  }

  onKillConfirm(z, head, knife = false) {
    const p = this.player;
    p.kills++; this.bark('kill', { chance: 0.07 });
    if (head) p.headshots++;
    const reward = killCreditPresentation({ head, knife, doubleActive: this.doubleT > 0 });
    this.awardPoints(reward.basePoints, z);
    this.fx.popup(z.x, z.y + 1.6, z.z, `+${reward.displayedPoints}`, reward.color);
  }

  onZombieKilled(z, info) {
    // authority side: death audio/fx + drops + broadcast
    if (z.dog) {
      // hellhounds go out with a yelp + a fireball — never a zombie death moan
      audio.play('dog_death', { pos: z, vol: 0.9 });
      this.houndFX?.houndDeath(z.x, z.y, z.z);
      audio.play('explosion', { pos: z, vol: 0.7 });
    } else {
      audio.play('zdeath', { pos: z, vol: 0.5 });
      const hy = z.y + (info.head ? 1.5 : 1);
      this.fx.blood(z.x, hy, z.z, true);
      // A kill should have direction and weight: spray carries along the shot,
      // a headshot pops rather than seeps, and the body kicks dust off the
      // floor as it goes down.
      const dir = info.dir || this._aimDir;
      if (info.head) {
        audio.play('headshot', { pos: z });
        this.fx.impact(z.x, hy, z.z, -(dir?.x || 0), 0.55, -(dir?.z || 0), 'concrete');
        this.fx.blood(z.x + rand(-0.2, 0.2), hy + 0.1, z.z + rand(-0.2, 0.2), true);
        this.fx.shake(0.09);
      }
      this.fx.spawnParticles(z.x, z.y + 0.06, z.z, {
        count: 9, color: [0.34, 0.30, 0.24], speed: 1.3, spread: 1,
        life: 0.9, grav: 1.2, size: 2.4, up: 0.35, additive: false,
      });
    }
    const dogReward = this._dogRoundReward;
    if (this.isAuthority && dogReward?.round === this.round && shouldSpawnDogRoundReward({
      dogRound: this.zombies.dogRound,
      victimDog: z.dog,
      remaining: this.zombies.dogRemaining,
      alreadySpawned: dogReward.spawned,
    })) {
      // Mark first so duplicate callbacks or simultaneous final-hit processing
      // cannot produce a second guaranteed drop.
      dogReward.spawned = true;
      const drop = this.fx.spawnDrop('maxammo', z.x, z.z);
      this.netSend({ t: 'drop', type: 'maxammo', x: z.x, z: z.z, id: dropId(drop) });
    }
    if (this.net) this.netSend({ t: 'zkill', z: z.id, by: info.by, head: info.head, x: z.x, y: z.y, zz: z.z, dog: z.dog ? 1 : 0 });
    // drops
    if (this.isAuthority && !z.dog && Math.random() < 0.032 && this.round >= 2) {
      const type = choice(['maxammo', 'maxammo', 'insta', 'double', 'double', 'nuke']);
      const drop = this.fx.spawnDrop(type, z.x, z.z);
      this.netSend({ t: 'drop', type, x: z.x, z: z.z, id: dropId(drop) });
    }
  }

  awardPoints(n, atPos = null) {
    const p = this.player;
    const gained = p.addPoints(n, this.doubleT > 0);
    this.hud.setPoints(p.points, true);
  }

  // ---------------- projectiles (rocket / raygun) ----------------
  spawnProjectile(origin, dir, s, w) {
    const proj = {
      x: origin.x, y: origin.y, z: origin.z,
      vx: dir.x * s.projSpeed, vy: dir.y * s.projSpeed, vz: dir.z * s.projSpeed,
      life: 4, s, w, mine: true,
    };
    this.projectiles.push(proj);
  }

  updateProjectiles(dt) {
    for (let projectileIndex = 0; projectileIndex < this.projectiles.length;) {
      const pr = this.projectiles[projectileIndex];
      const steps = 2;
      let hit = false;
      for (let i = 0; i < steps && !hit; i++) {
        const nx = pr.x + pr.vx * dt / steps, ny = pr.y + pr.vy * dt / steps, nz = pr.z + pr.vz * dt / steps;
        // wall check
        const wd = this.wallDist(
          this._projectileOrigin.set(pr.x, pr.y, pr.z),
          this._projectileDir.set(pr.vx, pr.vy, pr.vz).normalize(),
          0.6,
        );
        // zombie proximity
        let zHit = null;
        for (const [, z] of this.zombies.zombies) {
          if (z.state === ZSTATES.DIE) continue;
          const rr = z.dog ? 0.5 : 0.55;
          const cy = z.y + (z.dog ? 0.68 : z.crawler ? 0.35 : 1.0);
          if ((z.x - nx) ** 2 + (cy - ny) ** 2 + (z.z - nz) ** 2 < rr * rr) { zHit = z; break; }
        }
        if (zHit || wd < 0.5 || ny <= 0.03) {
          this.explodeProjectile(pr, nx, Math.max(0.05, ny), nz, zHit);
          hit = true;
        } else {
          pr.x = nx; pr.y = ny; pr.z = nz;
          if (pr.s.tracerColor) {
            this.fx.tracer(pr.x - pr.vx * 0.012, pr.y - pr.vy * 0.012, pr.z - pr.vz * 0.012, pr.x, pr.y, pr.z, pr.s.tracerColor);
          } else {
            this.fx.spawnParticles(pr.x, pr.y, pr.z, { count: 1, color: [0.6, 0.55, 0.5], speed: 0.2, life: 0.5, grav: -0.5, size: 1.6 });
          }
        }
      }
      pr.life -= dt;
      if (hit || pr.life <= 0) this.projectiles.splice(projectileIndex, 1);
      else projectileIndex++;
    }
  }

  explodeProjectile(pr, x, y, z, directZombie) {
    const s = pr.s;
    const splash = s.splash || { radius: 2, dmg: s.dmg * 0.5 };
    this.fx.explosion(x, y, z, splash.radius);
    audio.play('explosion', { pos: { x, y, z }, blastRadius: splash.radius });
    const ids = [];
    let anyHit = false, anyKill = false;
    for (const [, zb] of this.zombies.zombies) {
      if (zb.state === ZSTATES.DIE) continue;
      const d = Math.hypot(zb.x - x, zb.y + 1 - y, zb.z - z);
      if (zb === directZombie || d < splash.radius) {
        const dmg = zb === directZombie ? s.dmg : Math.round(lerp(splash.dmg, splash.dmg * 0.3, d / splash.radius));
        if (this.isAuthority) {
          const res = this.zombies.damage(zb.id, dmg, { head: false, by: this.player.id, explosive: true, weapon: s });
          if (res.ok) { anyHit = true; anyKill = anyKill || res.killed; this.awardPoints(CFG.POINTS_HIT, zb); if (res.killed) this.onKillConfirm(zb, false); }
        } else {
          ids.push([zb.id, dmg, this._newHitClaim()]);
          this.hitFX(zb, zb.x, zb.y + 1, zb.z, true);
          anyHit = true;
        }
      }
    }
    if (!this.isAuthority && ids.length) this.netSend({ t: 'zsplash', ids, wid: pr.w.id, pap: pr.w.pap, x, y, z });
    // hitmarker ONLY when the blast actually connected (was firing on every shot)
    if (anyHit && this.isAuthority) { this.hud.hitmarker(anyKill, false); audio.play(anyKill ? 'hitmarker_kill' : 'hitmarker'); }
    // self damage
    const pd = Math.hypot(this.player.x - x, this.player.y + 1 - y, this.player.z - z);
    if (pd < splash.radius * 0.9) this.player.damage(Math.round(lerp(70, 15, pd / splash.radius)), this);
  }

  // ---------------- DG2 chain lightning ----------------
  fireArc(muzzleWorld, s, w, shotDir = null) {
    const p = this.player;
    const origin = new THREE.Vector3(p.x, p.y + p.eyeHeight, p.z);
    const dir = shotDir || this.getAimDir(s);
    const wDist = this.wallDist(origin, dir, 60);
    const direct = this.zombieHitTest(origin, dir, wDist)[0];
    const floorImpact = direct ? null : this._dg2FloorImpact(origin, dir, 60);
    let firstZombie = direct?.z || null;
    if (!firstZombie && floorImpact) {
      let nearest = Infinity;
      for (const [, zombie] of this.zombies.zombies) {
        if (zombie.state === ZSTATES.DIE) continue;
        const target = this._arcTargetPoint(zombie);
        if (!floorArcTargetAllowed({
          impact: floorImpact, target,
          visible: this._arcHasLineOfSight(floorImpact, target),
        })) continue;
        const distance = dist2D(floorImpact.x, floorImpact.z, zombie.x, zombie.z);
        if (distance < nearest) { nearest = distance; firstZombie = zombie; }
      }
    }
    const chainPts = [{ x: muzzleWorld.x, y: muzzleWorld.y, z: muzzleWorld.z }];
    if (floorImpact && firstZombie) chainPts.push({ x: floorImpact.x, y: floorImpact.y + 0.06, z: floorImpact.z });
    if (firstZombie) {
      const chain = [firstZombie];
      let cur = firstZombie;
      for (let i = 1; i < (s.chain || 10); i++) {
        let best = null, bd = s.chainRadius || 8;
        for (const [, zb] of this.zombies.zombies) {
          if (zb.state === ZSTATES.DIE || chain.includes(zb)) continue;
          const d = dist2D(cur.x, cur.z, zb.x, zb.z);
          if (d >= bd) continue;
          const fromPoint = this._arcTargetPoint(cur);
          const target = this._arcTargetPoint(zb);
          if (!chainArcTargetAllowed({
            from: fromPoint, target, radius: s.chainRadius || 8,
            visible: this._arcHasLineOfSight(fromPoint, target),
          })) continue;
          bd = d; best = zb;
        }
        if (!best) break;
        chain.push(best);
        cur = best;
      }
      for (const zb of chain) {
        chainPts.push({ x: zb.x, y: zb.y + (zb.dog ? 0.78 : 1.1), z: zb.z });
        if (this.isAuthority) {
          const res = this.zombies.damage(zb.id, s.dmg, { head: false, by: p.id, weapon: s });
          if (res.ok) {
            this.awardPoints(CFG.POINTS_HIT, zb);
            if (res.killed) this.onKillConfirm(zb, false);
          }
        } else {
          this.netSend({ t: 'zhit', cid: this._newHitClaim(), z: zb.id, dmg: s.dmg, head: 0, wid: w.id, pap: w.pap });
        }
        this.fx.spawnParticles(zb.x, zb.y + 1, zb.z, { count: 8, color: [0.5, 0.75, 1], speed: 2, life: 0.4, size: 1.4 });
      }
      if (this.isAuthority) { this.hud.hitmarker(true, false); audio.play('hitmarker'); }
    } else {
      chainPts.push(floorImpact
        ? { x: floorImpact.x, y: floorImpact.y + 0.06, z: floorImpact.z }
        : { x: origin.x + dir.x * Math.min(wDist, 25), y: origin.y + dir.y * Math.min(wDist, 25), z: origin.z + dir.z * Math.min(wDist, 25) });
    }
    this.fx.lightning(chainPts);
    this.fx.shake(0.3);
  }

  // ---------------- bot actions (authority) ----------------
  botFire(bot, z) {
    const s = bot.stats;
    if (!s || bot.weapon.mag <= 0) return;
    bot.weapon.mag--;
    audio.play(s.sfx, { pos: { x: bot.x, y: bot.y + 1.5, z: bot.z }, vol: 0.8 });
    const d = dist2D(bot.x, bot.z, z.x, z.z);
    const acc = clamp(0.9 - d * 0.011, 0.3, 0.9) * (this.zombies.instakill ? 1 : 1);
    if (Math.random() > acc) { this.fx.tracer(bot.x, bot.y + 1.45, bot.z, z.x + rand(-1, 1), z.y + 1.2, z.z + rand(-1, 1), 0xffd9a0); return; }
    const head = Math.random() < 0.22;
    const dmg = s.dmg * (head ? s.headMult : 1) * (this.zombies.instakill ? 100 : 1);
    this.fx.tracer(bot.x, bot.y + 1.45, bot.z, z.x, z.y + (head ? 1.5 : 1.0), z.z, 0xffd9a0);
    const res = this.zombies.damage(z.id, dmg, { head, by: bot.id, weapon: s, pap: bot.weapon.pap });
    if (res.ok && res.killed) { bot.kills++; bot.points += head ? 100 : 60; }
  }

  botMelee(bot, z) {
    if ((bot.meleeCd || 0) > this.time) return;
    bot.meleeCd = this.time + 0.7;
    audio.play('melee');
    const res = this.zombies.damage(z.id, bot.bowie ? 1000 : 150, { head: false, by: bot.id, weapon: { headMult: 1 } });
    if (res.ok && res.killed) { bot.kills++; bot.points += 130; }
  }

  botRevive(bot, target) {
    const pl = this.allPlayerStates().find((p) => p.id === target.id);
    if (!pl || !pl.down) return;
    if (target.id === this.player.id) {
      this.player.down = false; this.player.hp = this.player.maxHpNow;
    } else {
      const rp = this.remotePlayers.get(target.id);
      if (rp) { rp.down = false; }
      const b2 = this.bots.find((b) => b.id === target.id);
      if (b2) { b2.down = false; b2.hp = b2.maxHp; }
    }
    bot.revives++;
    audio.play('revive');
    this.netSend({ t: 'revive', pid: target.id });
  }

  botUsePower(bot) {
    if (this.map.power.on) return;
    this.setPower(true);
    this.netSend({ t: 'power' });
    this.botBark(bot, 'power', 0.9);
  }

  botUseBox(bot) {
    const bs = this.boxState;
    if (bs.state !== 'idle' || !bot.spend(950)) return;
    audio.play('buy');
    this.boxStartSpin(bot.weapons.map((w) => w.id));
    // bot takes whatever comes up when ready
    bot._takeBoxT = 4.6;
  }

  botLinkTele(bot, tele) {
    if (this.teleLinks >= 3) return;
    this.linkTeleporter(tele);
    this.botBark(bot, 'tele', 0.8);
  }

  botThrowMonkey(bot) {
    audio.play('monkey_windup');
    const dir = { x: Math.sin(bot.yaw), z: Math.cos(bot.yaw) };
    const e = {
      kind: 'monkey', x: bot.x, y: bot.y + 1.4, z: bot.z,
      vx: dir.x * 10, vy: 4, vz: dir.z * 10, fuse: 8, mesh: null, by: bot.id,
    };
    e.mesh = buildMonkey();
    e.mesh.scale.setScalar(1.15);
    e.clashT = 0;
    e.mesh.position.set(e.x, e.y, e.z);
    this.scene.add(e.mesh);
    this.grenades.push(e);
  }

  botDied(bot) {
    this.netSend({ t: 'dead', pid: bot.id });
  }

  botBark(bot, event, chance = 1) {
    if (Math.random() > chance) return;
    const n = variantCount(bot.personaIdx, event);
    if (!n) return;
    this.playBark(bot.personaIdx, event, Math.floor(Math.random() * n), { x: bot.x, y: bot.y + 1.5, z: bot.z });
    this.netSend({ t: 'bark', p: bot.personaIdx, e: event, v: Math.floor(Math.random() * n), pid: bot.id });
  }

  // ---------------- melee ----------------
  melee() {
    const p = this.player;
    p.meleeCooldown = 0.45;
    this.weaponRig.meleeT = 1;
    audio.play('melee');
    setTimeout(() => {
      if (this.disposed || p.down) return;
      const dir = this.getAimDir({ spreadHip: 0, spreadAds: 0 });
      const origin = new THREE.Vector3(p.x, p.y + p.eyeHeight, p.z);
      const hits = this.zombieHitTest(origin, dir, 2.0);
      if (hits.length) {
        const { z } = hits[0];
        audio.play('melee_hit', { pos: z });
        this.hitFX(z, z.x, z.y + 1.1, z.z, false);
        if (this.isAuthority) {
          const res = this.zombies.damage(z.id, meleeDamage(p.bowie), { head: false, by: p.id, weapon: { headMult: 1 } });
          if (res.ok) {
            this.awardPoints(CFG.POINTS_HIT, z);
            if (res.killed) this.onKillConfirm(z, false, true);
            this.hud.hitmarker(res.killed, false);
            audio.play(res.killed ? 'hitmarker_kill' : 'hitmarker');
          }
        } else {
          this.netSend({ t: 'zhit', cid: this._newHitClaim(), z: z.id, dmg: meleeDamage(p.bowie), head: 0, knife: 1 });
        }
      }
    }, 120);
  }

  // ---------------- grenades & monkey ----------------
  throwGrenade() {
    const p = this.player;
    if (p.grenades <= 0) { audio.play('deny'); return; }
    p.grenades--;
    p.grenadeCooldown = 0.7;
    this.hud.setGrenades(p.grenades, p.monkeys);
    this.throwEntity('frag');
  }

  throwMonkey() {
    const p = this.player;
    if (p.monkeys <= 0) { audio.play('deny'); return; }
    p.monkeys--;
    p.grenadeCooldown = 1.0;
    this.hud.setGrenades(p.grenades, p.monkeys);
    // wind up the monkey, then throw it
    this.weaponRig.monkeyWindup();
    audio.play('monkey_windup');
    setTimeout(() => { if (!this.disposed && !p.down) this.throwEntity('monkey'); }, 780);
  }

  throwEntity(kind) {
    const p = this.player;
    const dir = this.getAimDir({ spreadHip: 0, spreadAds: 0 });
    const e = {
      kind, x: p.x, y: p.y + p.eyeHeight - 0.1, z: p.z,
      vx: dir.x * 11, vy: dir.y * 11 + 3.2, vz: dir.z * 11,
      fuse: kind === 'frag' ? 3.6 : 8, mesh: null, by: p.id,
    };
    if (kind === 'frag') {
      e.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x4a3b22, roughness: 0.7 }));
    } else {
      e.mesh = buildMonkey();
      e.mesh.scale.setScalar(1.15);
      e.clashT = 0;
    }
    e.mesh.position.set(e.x, e.y, e.z);
    this.scene.add(e.mesh);
    this.grenades.push(e);
    audio.play('swap');
    if (kind === 'frag' && !this.isAuthority) this.netSend({ t: 'grenade', x: e.x, y: e.y, z: e.z });
    if (kind === 'monkey') this.netSend({ t: 'monkey', x: e.x, z: e.z, dur: e.fuse });
  }

  updateGrenades(dt) {
    for (let grenadeIndex = 0; grenadeIndex < this.grenades.length;) {
      const g = this.grenades[grenadeIndex];
      let grenadeRemoved = false;
      g.vy -= 12 * dt;
      let nx = g.x + g.vx * dt, ny = g.y + g.vy * dt, nz = g.z + g.vz * dt;
      if (ny < 0.08) { ny = 0.08; g.vy *= -0.42; g.vx *= 0.7; g.vz *= 0.7; }
      for (const c of this.map.colliders) {
        if (c.shootOk || (c.y0 || 0) > 1.2) continue;
        if (nx > c.minX - 0.08 && nx < c.maxX + 0.08 && nz > c.minZ - 0.08 && nz < c.maxZ + 0.08 && ny < (c.h || 3)) {
          // reflect on smallest axis
          const dxl = Math.abs(nx - (c.minX - 0.08)), dxr = Math.abs((c.maxX + 0.08) - nx);
          const dzl = Math.abs(nz - (c.minZ - 0.08)), dzr = Math.abs((c.maxZ + 0.08) - nz);
          const m = Math.min(dxl, dxr, dzl, dzr);
          if (m === dxl || m === dxr) { g.vx *= -0.5; nx = g.x; } else { g.vz *= -0.5; nz = g.z; }
        }
      }
      g.x = nx; g.y = ny; g.z = nz;
      g.mesh.position.set(nx, ny, nz);
      g.fuse -= dt;
      if (g.kind === 'monkey') {
        const landed = ny <= 0.1 && Math.abs(g.vy) < 0.6;
        if (!landed) {
          g.mesh.rotation.x += dt * 6; g.mesh.rotation.z += dt * 4;
        } else {
          // sit upright, bang the cymbals, wind-up key spins
          g.mesh.rotation.set(0, g.mesh.rotation.y + dt * 0.5, 0);
          g.clashT += dt * 7;
          const clash = Math.sin(g.clashT) * 0.55;
          g.mesh.userData.armL.rotation.z = -0.5 + clash;
          g.mesh.userData.armR.rotation.z = 0.5 - clash;
          g.mesh.userData.key.rotation.z += dt * 14;
          g.cymT = (g.cymT || 0) - dt;
          if (g.cymT <= 0) { g.cymT = 0.78; audio.play('monkey_cymbal', { pos: g }); }
        }
        if (Math.random() < dt * 8) this.fx.spawnParticles(g.x, g.y + 0.2, g.z, { count: 2, color: [1, 0.8, 0.3], speed: 1, life: 0.25, size: 0.8 });
      } else {
        g.mesh.rotation.x += dt * 6; g.mesh.rotation.z += dt * 4;
      }
      if (g.fuse <= 0) {
        this.scene.remove(g.mesh);
        this.grenades.splice(grenadeIndex, 1);
        grenadeRemoved = true;
        if (g.kind === 'monkey' && !this.isAuthority) continue; // host applies monkey damage
        const blast = g.kind === 'monkey'
          ? { radius: 4, maxDamage: 400, minDamage: 40 }
          : FRAG_BLAST;
        const radius = blast.radius;
        this.fx.explosion(g.x, g.y, g.z, radius);
        audio.play('explosion', { pos: g, blastRadius: radius });
        const ids = [];
        let localBlastHit = false, localBlastKill = false;
        for (const [, zb] of this.zombies.zombies) {
          if (zb.state === ZSTATES.DIE) continue;
          // Measure toward the lower torso rather than an arbitrary y=1 point;
          // this keeps a floor grenade effective while still respecting floors.
          const d = Math.hypot(zb.x - g.x, zb.y + (zb.dog ? 0.45 : 0.55) - g.y, zb.z - g.z);
          const dmg = explosionDamage(d, blast);
          if (dmg > 0) {
            if (this.isAuthority) {
              const res = this.zombies.damage(zb.id, dmg, { head: false, by: g.by, explosive: true, weapon: { headMult: 1 } });
              if (res.ok && g.by === this.player.id) {
                localBlastHit = true;
                localBlastKill = localBlastKill || res.killed;
                this.awardPoints(CFG.POINTS_HIT, zb);
                if (res.killed) this.onKillConfirm(zb, false);
              }
            } else ids.push([zb.id, dmg, this._newHitClaim()]);
          }
        }
        if (!this.isAuthority && ids.length) this.netSend({ t: 'zsplash', ids, gren: 1, x: g.x, y: g.y, z: g.z });
        if (localBlastHit) {
          this.hud.hitmarker(localBlastKill, false);
          audio.play(localBlastKill ? 'hitmarker_kill' : 'hitmarker');
        }
        const pd = Math.hypot(this.player.x - g.x, this.player.z - g.z);
        if (pd < radius * 0.8) this.player.damage(Math.round(lerp(75, 10, pd / radius)), this);
        if (g.kind === 'monkey' && this.isAuthority) this.netSend({ t: 'monkey_end' });
      }
      if (!grenadeRemoved) grenadeIndex++;
    }
  }

  updateMonkeyHost(dt) {
    // host: zombies target monkey entities
    const active = this.grenades.find((g) => g.kind === 'monkey');
    this.zombies.monkey = active ? { x: active.x, z: active.z, t: active.fuse, id: 'monkey' } : null;
  }

  // ---------------- rounds (authority) ----------------
  updateRounds(dt) {
    // GHOST TOWN cheat: no waves, no zombies — the factory is yours to explore
    if (this.cheats.zero) {
      if (!this._zeroBannered) {
        this._zeroBannered = true;
        this.hud.banner('GHOST TOWN', '#7ec8e3', 'No zombies — explore freely');
      }
      // Still check for death. You can kill yourself with your own splash even
      // with nothing hunting you, and with no wave to clear there is no
      // intermission to respawn into — so skipping this left the player dead on
      // the floor forever, with no GAME OVER and no way out of the round.
      this._checkGameOver();
      return;
    }
    this.phaseT -= dt;
    switch (this.phase) {
      case 'pre':
        if (this.phaseT <= 0) this.beginRound(this.round + 1);
        break;
      case 'intermission':
        // Also covers an unusual late bleed-out during the intermission.
        if (this.player.dead) this.respawnSelf();
        if (this.phaseT <= 0) this.beginRound(this.round + 1);
        break;
      case 'active':
        if (!this.zombies.roundInProgress && this.phaseT <= 0) {
          this.phase = 'intermission';
          this.phaseT = ROUND_INTERMISSION_SECONDS;
          // Dead players return as soon as the wave is cleared so the entire
          // intermission is usable for buying, rebuilding and regrouping.
          if (this.player.dead) this.respawnSelf();
          this.netSend({ t: 'intermission', seconds: ROUND_INTERMISSION_SECONDS });
          audio.play('round_end');
        }
        break;
    }
    this._checkGameOver();
  }

  /** End the match once nobody is left standing. */
  _checkGameOver() {
    if (!this.over) {
      const all = this.allPlayerStates();
      const alive = all.filter((pl) => !pl.dead && !pl.down);
      const anyAlive = this.mode === 'solo'
        ? !this.player.dead
        : (alive.length > 0 || all.some((pl) => !pl.dead));
      let remoteStanding = false;
      for (const [, rp] of this.remotePlayers) {
        if (!rp.dead && !rp.down) { remoteStanding = true; break; }
      }
      // No `all.length > 0` guard. allPlayerStates() DROPS any source that is
      // already dead, so the moment the last two players die in the same frame
      // the list is empty — and that made this condition false at exactly the
      // point it should be true. The state was unrecoverable: nobody standing
      // means the horde goes dormant, so the wave never finishes, so the phase
      // never reaches intermission and respawnSelf is never called. No banner,
      // no lobby, no respawn. Empty means everybody is gone, which is precisely
      // game over, and `every` on an empty list is vacuously true.
      const everyoneDead = this.mode === 'solo'
        ? this.player.dead
        : (all.every((pl) => pl.dead || pl.down) && !remoteStanding && (this.player.dead || this.player.down));
      if (everyoneDead) this.gameOver();
    }
  }

  beginRound(n) {
    this.round = n;
    this.phase = 'active';
    this.phaseT = 0.5;
    this.zombies.startRound(n, Math.max(1, this.lobbyPlayers.length));
    this._dogRoundReward = this.zombies.dogRound ? { round: n, spawned: false } : null;
    // classic resupply: +2 grenades every round, up to 4
    const p = this.player;
    // Browser chrome/fullscreen and respawn transitions can land between resize
    // events. Reassert a centered full-canvas projection at the round boundary.
    this.onResize();
    if (!p.dead) {
      p.grenades = Math.min(4, p.grenades + 2);
      this.hud.setGrenades(p.grenades, p.monkeys);
    }
    this.hud.setRound(n, this.zombies.dogRound);
    // round 1: let the world settle before the battle cry (no spawn cacophony)
    if (n === 1) setTimeout(() => { if (!this.disposed) this.bark('start', { force: true }); }, 1400);
    else this.bark('round', { chance: 0.35 });
    if (this.zombies.dogRound) {
      this.hud.banner('HELLHOUNDS', '#ff7733', 'They come for your blood');
      audio.play('ann_dogs');
      audio.play('dog_howl');
      this.bark('dog', { force: true });
      this.netSend({ t: 'round', n, dog: 1 });
    } else {
      this.hud.banner(`ROUND ${n}`, n >= 10 ? '#ff4444' : '#c33', '');
      audio.setRound(this.round);
      audio.play('round_start');
      this.netSend({ t: 'round', n, dog: 0 });
    }
  }

  onDogRound() {}

  gameOver() {
    if (this.over) return;
    this.over = true;
    // There is nobody left to hunt. The horde stops mid-stride and stands over
    // the bodies instead of sprinting at a player who can no longer be reached.
    this.zombies.setDormant(true);
    audio.play('gameover');
    this.hud.banner('GAME OVER', '#ff3333', `You survived ${this.round} round${this.round === 1 ? '' : 's'}`);
    this.netSend({ t: 'gameover', round: this.round });
    const destination = multiplayerExitDestination({ mode: this.mode, gameOver: true });
    setTimeout(() => { if (!this.disposed) this.exit(destination); }, 6000);
  }

  // ---------------- drops ----------------
  updateDrops(dt) {
    const players = this.allPlayerStates();
    for (let i = 0; i < this.fx.drops.length;) {
      const d = this.fx.drops[i];
      let taken = false;
      for (const pl of players) {
        if (pl.down || pl.dead) continue;
        if (dist2D(pl.x, pl.z, d.x, d.z) < 1.2) {
          this.takeDrop(d, pl.id);
          taken = true;
          break;
        }
      }
      if (!taken) i++;
    }
  }

  takeDrop(d, pid) {
    this.fx.removeDrop(d);
    audio.play('pickup', { pos: d });
    this.applyDrop(d.type, pid);
    this.netSend({ t: 'drop_take', type: d.type, pid, id: dropId(d) });
  }

  applyDrop(type, pid) {
    switch (type) {
      case 'maxammo': {
        if (pid === this.player.id || true) { // max ammo applies to everyone
          this.player.refillAmmo();
          this.hud.setGrenades(this.player.grenades, this.player.monkeys);
        }
        audio.play('maxammo');
        this.hud.banner('MAX AMMO', '#8dff8d');
        break;
      }
      case 'insta':
        this.instaT = 30;
        audio.play('instakill');
        this.hud.banner('INSTA-KILL', '#ff6a5a');
        break;
      case 'double':
        this.doubleT = 30;
        audio.play('doublepoints');
        this.hud.banner('DOUBLE POINTS', '#ffd24a');
        break;
      case 'nuke': {
        audio.play('nuke');
        this.fx.screenFlash('#fff', 400, 0.8);
        this.fx.shake(0.7);
        if (this.isAuthority) {
          const n = this.zombies.nukeAll(pid);
          if (pid === this.player.id) this.awardPoints(CFG.NUKE_POINTS);
        } else if (pid === this.player.id) {
          this.awardPoints(CFG.NUKE_POINTS);
        }
        this.hud.banner('NUKE', '#c8b6ff');
        break;
      }
    }
  }

  // ---------------- traps ----------------
  updateTraps(dt) {
    for (const trap of this.map.traps) {
      trap.cd = Math.max(0, trap.cd - dt);
      if (trap.active) {
        trap.t -= dt;
        if (Math.random() < dt * 10) {
          this.fx.lightning([
            { x: trap.x - 1.1, y: rand(0.5, 2.2), z: trap.z },
            { x: trap.x + 1.1, y: rand(0.5, 2.2), z: trap.z },
          ]);
          audio.play('trap', { pos: { x: trap.x, y: 1.2, z: trap.z }, refDist: 4, maxDist: 18, vol: 0.82 });
        }
        for (const [, z] of this.zombies.zombies) {
          if (z.state === ZSTATES.DIE) continue;
          if (z.x > trap.zone.minX && z.x < trap.zone.maxX && z.z > trap.zone.minZ && z.z < trap.zone.maxZ) {
            this.zombies.kill(z, { by: null });
            this.fx.spawnParticles(z.x, z.y + 1, z.z, { count: 10, color: [0.5, 0.75, 1], speed: 2.5, life: 0.4, size: 1.4 });
          }
        }
        // players take heavy damage in trap
        if (this.player.x > trap.zone.minX && this.player.x < trap.zone.maxX && this.player.z > trap.zone.minZ && this.player.z < trap.zone.maxZ && !this.player.down) {
          if (!this._trapHurtT || this.time - this._trapHurtT > 0.8) { this._trapHurtT = this.time; this.player.damage(60, this); }
        }
        if (trap.t <= 0) { trap.active = false; trap.cd = 45; this.netSend({ t: 'trap_off', id: trap.id }); }
      }
    }
  }

  // ---------------- interactions ----------------
  interactionVisibleFrom(x, y, z, target, endpointTolerance = 0.9) {
    if (!target) return false;
    return interactionLineClear(
      { x: Number(x), y: Number(y), z: Number(z) },
      { x: Number(target.x), y: Number(target.y ?? 1.1), z: Number(target.z) },
      this.map.colliders,
      endpointTolerance,
    );
  }

  // What the DOWNED player knows about their own rescue. A single revive_start
  // packet carries the reviver and how long they need; progress is estimated
  // locally from there rather than streamed, which keeps one message per
  // attempt instead of ~10/s against the reliable-channel cap. The timeout is
  // the safety net: if the reviver's stop packet is dropped, the bar must not
  // sit there full forever promising a rescue that is not coming.
  beingRevivedState() {
    const b = this._beingRevived;
    if (!b) return null;
    const elapsed = this.time - b.at;
    if (elapsed > b.need + 0.75) { this._beingRevived = null; return null; }
    return { by: b.by, frac: clamp(elapsed / b.need, 0, 1) };
  }

  // Tell the target we have stopped, whatever the reason we stopped.
  _endReviveAnnounce() {
    if (!this._reviveAnnounced) return;
    this.netSend({ t: 'revive_stop', pid: this._reviveAnnounced, by: this.player.id });
    this._reviveAnnounced = null;
  }

  updateInteract(dt) {
    const p = this.player;
    if (p.dead) { this._endReviveAnnounce(); this.hud.prompt(null); this.hud.reviveUI(false); return; }

    // downed: show bleedout / self revive / who is picking you up
    if (p.down) {
      this._endReviveAnnounce();
      this.hud.prompt(null);
      const selfR = this.mode === 'solo' && p.selfReviveAvailable && this.qrSelfRevives > 0;
      const br = this.beingRevivedState();
      this.hud.downUI(true, p.bleedout / CFG.BLEEDOUT_TIME, br ? `BEING REVIVED BY ${br.by.toUpperCase()}` : false, selfR, this.mode !== 'solo');
      // The overlay headline already names the reviver; this bar carries the
      // progress, so it gets a complementary label rather than the same words.
      if (selfR) this.hud.reviveUI(true, 'REVIVING YOURSELF…', p.selfReviveT / 8);
      else if (br) this.hud.reviveUI(true, 'HOLD STILL', br.frac);
      else this.hud.reviveUI(false);
      return;
    }
    this.hud.downUI(false);
    if (this.localPerkDrink) {
      this._endReviveAnnounce();
      this.holdF = 0;
      this.hud.prompt(null);
      this.hud.reviveUI(false);
      return;
    }

    // revive nearby downed teammates
    let reviveTarget = null;
    for (const [, rp] of this.remotePlayers) {
      if (rp.down && dist2D(p.x, p.z, rp.x, rp.z) < 2.2
          && this.interactionVisibleFrom(p.x, p.y + 1.25, p.z, { x: rp.x, y: rp.y + 0.7, z: rp.z })) { reviveTarget = rp; break; }
    }
    if (reviveTarget) {
      const need = this.player.perks.has('qr') ? CFG.QR_REVIVE_TIME : CFG.REVIVE_TIME;
      if (input.keys['KeyF']) {
        // Announce once, on the rising edge, so the player on the floor can
        // see that help has actually arrived. Without this they get no signal
        // at all until the revive either lands or silently doesn't.
        if (this._reviveAnnounced !== reviveTarget.id) {
          this._endReviveAnnounce();
          this._reviveAnnounced = reviveTarget.id;
          this.netSend({ t: 'revive_start', pid: reviveTarget.id, by: p.id, need });
        }
        this.holdF += dt;
        if (this.holdF >= need) {
          this.holdF = 0;
          this._reviveAnnounced = null; // revive_done implies the hold ended
          this.netSend({ t: this.isAuthority ? 'revive_done' : 'revive_req', pid: reviveTarget.id, by: p.id });
          if (this.isAuthority) this.applyRevive(reviveTarget.id, p.id);
        }
      } else { this._endReviveAnnounce(); this.holdF = 0; }
      // The dedicated revive UI owns progress. Keep the interaction prompt as
      // text-only so the same revive action never renders two progress bars.
      this.hud.prompt(`Hold <b>F</b> — revive ${escapeHtml(reviveTarget.name)}`);
      this.hud.reviveUI(this.holdF > 0, `REVIVING ${reviveTarget.name.toUpperCase()}`, this.holdF / need);
      return;
    } else if (!p.down) {
      this._endReviveAnnounce(); // walked away mid-hold
      this.hud.reviveUI(false);
    }

    // barrier rebuild
    let barrier = null, bd = 2.4;
    for (const b of this.map.barriers) {
      if (b.boards >= b.maxBoards) continue;
      const d = dist2D(p.x, p.z, b.x, b.z);
      if (d < bd && this.interactionVisibleFrom(p.x, p.y + 1.25, p.z, { x: b.x, y: b.y ?? 1.2, z: b.z })) { bd = d; barrier = b; }
    }

    // scan interactables
    let best = null, bestD = 1e9;
    for (const it of this.map.interact) {
      const d = dist2D(p.x, p.z, it.pos.x, it.pos.z);
      if (d > it.radius) continue;
      if (it.pos.y !== undefined && Math.abs((p.y + 1.2) - it.pos.y) > 2.4) continue; // different level
      if (it.kind !== 'door' && !this.interactionVisibleFrom(p.x, p.y + 1.25, p.z, it.pos)) continue;
      if (d < bestD) { bestD = d; best = it; }
    }

    // choose barrier vs interactable
    if (barrier && (!best || bd < bestD)) {
      if (input.keys['KeyF'] && this.player.points >= 0) {
        this.holdF += dt;
        if (this.holdF >= 0.4) {
          this.holdF = 0;
          this.rebuildBoard(barrier);
        }
      } else this.holdF = 0;
      this.hud.prompt(`Hold <b>F</b> — rebuild barrier <span class="pts">+10</span>`, this.holdF / 0.4);
      return;
    }

    if (!best) { this.hud.prompt(null); this.holdF = 0; return; }
    const info = this.interactInfo(best);
    if (!info) { this.hud.prompt(null); this.holdF = 0; return; }
    this.hud.prompt(info.text, info.hold ? this.holdF / info.hold : null);
    if (info.hold) {
      if (input.keys['KeyF']) {
        this.holdF += dt;
        if (this.holdF >= info.hold) { this.holdF = 0; this.doInteract(best); }
      } else this.holdF = 0;
    } else {
      if (input.pressed['KeyF']) this.doInteract(best);
    }
  }

  interactInfo(it) {
    const p = this.player;
    const pts = (n) => `<span class="pts">[${n}]</span>`;
    switch (it.kind) {
      case 'door': {
        if (it.door.open) return null;
        if (it.door.id === 'd_pap') {
          return this.teleLinks >= 3 ? null : { text: 'This door is sealed by a strange mechanism…' };
        }
        return { text: `Press <b>F</b> — open door ${pts(it.door.cost)}`, hold: null };
      }
      case 'wallbuy': {
        const wb = it.wb;
        const s = getStats(wb.weapon, false);
        const owned = p.weapons.find((w) => w.id === wb.weapon);
        if (owned) {
          const cost = Math.floor(wb.price / 2);
          const full = owned.reserve >= s.reserve;
          return full ? { text: `${s.name} — ammo full` } : { text: `Press <b>F</b> — buy ammo ${pts(cost)}` };
        }
        return { text: `Press <b>F</b> — buy ${s.name} ${pts(wb.price)}` };
      }
      case 'perk': {
        const perk = it.perk;
        if (p.perks.has(perk.id) || this.localPerkDrink) return null;
        if (perk.id !== 'qr' && !this.map.power.on) return { text: `${perk.name} — no power` };
        if (perk.id === 'qr' && this.mode === 'solo') {
          if (this.qrSelfRevives <= 0) return { text: 'Quick Revive is depleted' };
          return { text: `Press <b>F</b> — Quick Revive ${pts(500)} <span class="dim">(${this.qrSelfRevives} left)</span>` };
        }
        return { text: `Press <b>F</b> — ${perk.name} ${pts(perk.price)}` };
      }
      case 'box': {
        const bs = this.boxState;
        if (bs.state === 'idle') return { text: `Press <b>F</b> — mystery box ${pts(950)}` };
        if (bs.state === 'ready') return { text: `Press <b>F</b> — take ${getStats(bs.weapon, false).name}` };
        return { text: '…' };
      }
      case 'pap': {
        if (this.teleLinks < 3) return { text: 'The machine is dormant…' };
        if (this.papState.busy) return { text: this.papState.ready && this.papState.owner === p.id ? 'Press <b>F</b> — take upgraded weapon' : 'Upgrading…' };
        // Offering an upgrade you cannot buy is a worse prompt than no prompt:
        // the player presses F, nothing happens, and the machine looks broken.
        if (p.weapon?.pap) return { text: `${getStats(p.weapon.id, true).name} is already upgraded` };
        return { text: `Hold <b>F</b> — Pack-a-Punch ${pts(5000)}`, hold: 0.4 };
      }
      case 'power': {
        if (this.map.power.on) return null;
        return { text: 'Hold <b>F</b> — turn on the power', hold: INTERACT_HOLD.power };
      }
      case 'tele': {
        const t = it.tele;
        const state = teleporterPromptState({ powerOn: this.map.power.on, charging: t.charging, cooldown: t.cooldown });
        if (state === 'no-power') return { text: 'The teleporter has no power' };
        if (state === 'charging') return { text: 'Teleporter charging… stand on the pad' };
        if (state === 'recharging') return { text: `Teleporter recharging… ${Math.ceil(t.cooldown)}s` };
        return { text: `Hold <b>F</b> — use teleporter`, hold: INTERACT_HOLD.tele };
      }
      case 'trap': {
        const t = it.trap;
        if (!this.map.power.on) return { text: 'No power' };
        if (t.active) return { text: 'Trap active!' };
        if (t.cd > 0) return { text: `Trap recharging… ${Math.ceil(t.cd)}s` };
        return { text: `Press <b>F</b> — activate electro-shock defense ${pts(1000)}` };
      }
      case 'song': {
        return { text: audio.songPlaying ? 'Press <b>F</b> — stop the record' : 'Press <b>F</b> — play the record' };
      }
      case 'radio': {
        return { text: 'Press <b>F</b> — play the old radio' };
      }
    }
    return null;
  }

  doInteract(it) {
    const p = this.player;
    switch (it.kind) {
      case 'door': {
        if (it.door.open || it.door.id === 'd_pap') return;
        if (!p.spend(it.door.cost)) { audio.play('deny'); return; }
        audio.play('buy');
        this.hud.setPoints(p.points);
        this.openDoor(it.door);
        this.netSend({ t: this.isAuthority ? 'door' : 'door_req', id: it.door.id });
        break;
      }
      case 'wallbuy': {
        const wb = it.wb;
        const owned = p.weapons.find((w) => w.id === wb.weapon);
        if (owned) {
          const cost = Math.floor(wb.price / 2);
          const s = getStats(owned.id, owned.pap);
          if (owned.reserve >= s.reserve) return;
          if (!p.spend(cost)) { audio.play('deny'); return; }
          owned.reserve = s.reserve;
          audio.play('buy');
        } else {
          if (!p.spend(wb.price)) { audio.play('deny'); return; }
          audio.play('buy');
          p.giveWeapon(wb.weapon, false);
          this.weaponRig.equip(wb.weapon, false);
          this._revealAcquiredWeapon();
          this.netSend({ t: 'swap', w: wb.weapon, pap: false });
        }
        this.hud.setPoints(p.points);
        break;
      }
      case 'perk': {
        const perk = it.perk;
        if (p.perks.has(perk.id) || this.localPerkDrink) return;
        if (perk.id !== 'qr' && !this.map.power.on) return;
        const price = perk.id === 'qr' && this.mode === 'solo' ? 500 : perk.price;
        if (!p.spend(price)) { audio.play('deny'); return; }
        audio.play('buy');
        this.beginLocalPerkDrink(perk);
        this.hud.setPoints(p.points);
        break;
      }
      case 'box': this.boxUse(); break;
      case 'pap': this.papUse(); break;
      case 'power': {
        if (this.map.power.on) return;
        this.setPower(true);
        this.netSend({ t: this.isAuthority ? 'power' : 'power_req' });
        break;
      }
      case 'tele': this.teleUse(it.tele); break;
      case 'trap': {
        const t = it.trap;
        if (!this.map.power.on || t.active || t.cd > 0) return;
        if (!p.spend(1000)) { audio.play('deny'); return; }
        audio.play('buy');
        this.activateTrap(t);
        this.netSend({ t: this.isAuthority ? 'trap_on' : 'trap_req', id: t.id });
        this.hud.setPoints(p.points);
        break;
      }
      case 'song': {
        const songPos = this.map.interact.find((i) => i.kind === 'song')?.pos || null;
        if (audio.songPlaying) {
          audio.stopSong();
          this.netSend({ t: this.isAuthority ? 'song' : 'song_req', on: 0 });
        } else {
          audio.playSong(songPos);
          this.netSend({ t: this.isAuthority ? 'song' : 'song_req', on: 1 });
          this.hud.banner('BEAUTY OF ANNIHILATION', '#c8402f', '♪');
        }
        break;
      }
      case 'radio': {
        const radioPos = it.pos || null;
        if (this._radioOn) { audio.stopMusicBox(); this._radioOn = false; }
        else { audio.playMusicBox(radioPos); this._radioOn = true; }
        this.netSend({ t: this.isAuthority ? 'radio' : 'radio_req', on: this._radioOn ? 1 : 0 });
        break;
      }
    }
  }

  openDoor(door) {
    this.map.openDoor(door);
    audio.play('door', { pos: { x: door.x, y: 1.5, z: door.z } });
    this.fx.spawnParticles(door.x, 0.5, door.z, { count: 10, color: [0.5, 0.45, 0.4], speed: 1.5, life: 0.8, size: 2 });
  }

  rebuildBoard(b) {
    if (this.isAuthority) {
      if (b.boards >= b.maxBoards) return;
      b.boards++;
      this.setBoards(b, b.boards);
      this.netSend({ t: 'barrier', id: b.id, n: b.boards });
      this.awardPoints(CFG.POINTS_BOARD, b);
    } else {
      this.netSend({ t: 'barrier_req', id: b.id });
      b.boards = Math.min(b.maxBoards, b.boards + 1);
      this.setBoards(b, b.boards);
    }
    audio.play('board_build', { pos: b });
  }

  setBoards(b, n) {
    b.boards = n;
    b.boardsMesh.children.forEach((m, i) => { m.visible = i < n; });
  }

  onBoardTorn(b) {
    this.setBoards(b, b.boards);
    audio.play('board_tear', { pos: b });
    if (this.net) this.netSend({ t: 'barrier', id: b.id, n: b.boards });
  }

  // ---------------- box ----------------
  boxUse() {
    const bs = this.boxState;
    const p = this.player;
    if (bs.state === 'idle') {
      if (!p.spend(950)) { audio.play('deny'); return; }
      audio.play('buy');
      this.hud.setPoints(p.points);
      const owned = p.weapons.map((w) => w.id);
      if (this.isAuthority) {
        this.boxStartSpin(owned);
      } else {
        this.netSend({ t: 'box_spin_req', owned });
      }
    } else if (bs.state === 'ready') {
      // take weapon
      const wid = bs.weapon;
      if (wid === 'bowie') {
        p.bowie = true;
        this.weaponRig.setKnifeGold(true);
        this.hud.banner('BOWIE KNIFE', '#ffd24a', 'One slash, one kill');
      } else if (wid === 'monkey') {
        p.ownsMonkeys = true;
        p.monkeys = Math.min(2, p.monkeys + 2);
        this.hud.setGrenades(p.grenades, p.monkeys);
        this.hud.banner('MONKEY BOMB', '#ffd24a', 'Press X to throw — zombies chase it, then BOOM');
      } else {
        // rare golden finish straight out of the box
        const goldLucky = Math.random() < 0.08;
        p.giveWeapon(wid, false);
        if (goldLucky && p.weapon) { p.weapon.gold = true; this.hud.banner('GOLDEN GUN', '#ffd24a', 'A rare finish! Pack-a-Punch it for DIAMOND'); }
      }
      if (wid === 'monkey') { /* handled below via giveMonkey path */ }
      this.weaponRig.equip(p.weapon.id, p.weapon.pap);
      this._revealAcquiredWeapon();
      if (p.weapon?.gold && !p.weapon.pap) this.weaponRig.applyGoldCamo(true); // equip() resets camos — reapply
      audio.play('buy');
      this.netSend({ t: 'swap', w: p.weapon.id, pap: !!p.weapon.pap });
      if (this.isAuthority) this.boxSetIdle();
      else this.netSend({ t: 'box_take', w: wid });
      bs.state = 'idle';
      this.map.box.state = 'idle';
      this.hud.setPoints(p.points);
    }
  }

  boxStartSpin(ownedIds = []) {
    const bs = this.boxState;
    bs.state = 'spin';
    bs.t = 4;
    this.map.box.state = 'spin';
    this.map.box.uses++;
    // never give a gun the spinner already owns (unless they own the whole pool)
    const avail = BOX_POOL.filter((id) => !ownedIds.includes(id));
    bs.pool = avail.length ? avail : [...BOX_POOL];
    bs.cycleT = 0;
    audio.play('box_spin', { pos: this.map.box.pos });
    this.netSend({ t: 'box_state', state: 'spin' });
  }

  boxSetIdle() {
    this.boxState.state = 'idle';
    this.map.box.state = 'idle';
    this.netSend({ t: 'box_state', state: 'idle' });
  }

  updateBox(dt) {
    const bs = this.boxState;
    const box = this.map.box;
    // lid anim
    // Full open the moment it is bought: a half-open lid leans out over the
    // crate mouth, right through where the prize is presented.
    const openAmt = bs.state === 'idle' ? 0 : 1;
    box.lid.rotation.x = damp(box.lid.rotation.x, -openAmt * BOX_LID_OPEN, 8, dt);
    // Prize height follows the lid: down in the crate while the panel is still
    // swinging through the airspace above the mouth, then up into view.
    const lidOpen = clamp(-box.lid.rotation.x / BOX_LID_OPEN, 0, 1);
    const risen = THREE.MathUtils.smoothstep(lidOpen, BOX_LID_RISE, 1);
    const displayY = lerp(BOX_DISPLAY_Y_LOW, BOX_DISPLAY_Y, risen);
    if (this.isAuthority) {
      if (bs.state === 'spin') {
        bs.t -= dt;
        if (bs.t <= 0) {
          // teddy?
          const teddyChance = mysteryBoxTeddyChance(bs.completedWeaponSpins);
          if (Math.random() < teddyChance) {
            bs.state = 'teddy'; bs.t = 1.6;
            audio.play('teddy', { pos: this.map.box.pos });
            this.netSend({ t: 'box_state', state: 'teddy' });
          } else {
            // Count resolved weapon results, not paid uses. This survives box
            // moves and guarantees two real weapons before Teddy is eligible.
            bs.completedWeaponSpins++;
            bs.state = 'ready'; bs.t = 11;
            bs.weapon = choice(bs.pool || BOX_POOL);
            audio.play('box_ready', { pos: this.map.box.pos });
            this.netSend({ t: 'box_state', state: 'ready', w: bs.weapon });
          }
        }
      } else if (bs.state === 'ready') {
        bs.t -= dt;
        if (bs.t <= 0) { this.boxSetIdle(); }
      } else if (bs.state === 'teddy') {
        bs.t -= dt;
        if (bs.t <= 0) {
          const others = box.locations.map((_, i) => i).filter((i) => i !== box.locIdx);
          const idx = choice(others);
          this.map.moveBox(idx);
          this.boxSetIdle();
          this.netSend({ t: 'box_move', idx });
          this.hud.banner('THE BOX HAS MOVED', '#ffd24a');
        }
      }
    }
    // spin: cycle through pool weapons rapidly above the box (all clients)
    if (bs.state === 'spin') {
      bs.cycleT = (bs.cycleT ?? 0) - dt;
      if (bs.cycleT <= 0) {
        bs.cycleT = 0.12;
        this._boxCycleShow(choice(bs.pool || BOX_POOL));
      }
      if (this._boxGun) this._boxGun.position.set(0, displayY, BOX_DISPLAY_Z);
    }
    // teddy: rises and spins into the sky — and ONLY a teddy, no gun
    if (bs.state === 'teddy') {
      if (this._boxGun) { this.map.box.group.remove(this._boxGun); this._boxGun = null; this._boxGunW = null; }
      if (!this._boxTeddy) this._boxTeddy = this._makeTeddy();
      if (!this._boxTeddy.parent) this.map.box.group.add(this._boxTeddy);
      const tt = 1 - Math.max(0, bs.t) / 1.6;
      this._boxTeddy.position.y = 1.1 + tt * tt * 26;
      this._boxTeddy.rotation.y += dt * 7;
      this._boxTeddy.rotation.z = Math.sin(this.time * 9) * 0.2;
    } else if (this._boxTeddy && this._boxTeddy.parent) {
      this.map.box.group.remove(this._boxTeddy);
    }
    // floating weapon above box when ready
    if (bs.state === 'ready' && bs.weapon) {
      if (!this._boxGun || this._boxGunW !== bs.weapon) {
        if (this._boxGun) this.map.box.group.remove(this._boxGun);
        this._boxGun = this._buildDisplayWeapon(bs.weapon, false);
        this._boxGun.position.set(0, displayY, BOX_DISPLAY_Z);
        this._boxGunW = bs.weapon;
        this.map.box.group.add(this._boxGun);
      }
      // The won weapon is the only one that turns; it also takes the display
      // tilt back, which the flat cycling pose above clears off the mesh.
      this._boxGun.rotation.x = BOX_DISPLAY_PITCH;
      this._boxGun.rotation.z = BOX_DISPLAY_ROLL;
      this._boxGun.rotation.y += dt * 1.6;
      this._boxGun.position.set(0, displayY + Math.sin(this.time * 2.2) * 0.05, BOX_DISPLAY_Z);
    } else if (this._boxGun && bs.state === 'idle') {
      // cleanup only once the box has gone idle — never during spin/teddy
      this.map.box.group.remove(this._boxGun);
      this._boxGun = null; this._boxGunW = null;
    }
  }

  /**
   * Build a weapon for DISPLAY IN THE WORLD (mystery box, Pack-a-Punch).
   *
   * `buildViewmodel` returns the FIRST-PERSON model — which includes gloved
   * hands, forearms and a sleeve, because in the player's view those are the
   * hands holding it. Presenting that above the crate floated a pair of
   * disembodied hands next to the gun. It was also scaled 1.6x and centred on
   * the crate, so long weapons speared straight through the lid.
   *
   * This strips the hands, measures what is left, and returns a group that is
   * normalised to a fixed presentation length and pivots about its own centre
   * — so a pistol and a Panzerschreck both hover cleanly, broadside to the
   * player, at the same readable size, clear of the box.
   */
  _buildDisplayWeapon(wid, pap = false) {
    const src = buildViewmodel(wid, pap);
    // The gloves already live outside the returned tree (userData.handsGroup);
    // dropping the container is all that is needed, and it cannot take weapon
    // parts with it. Never strip by name here — `handguard` and `handle` are
    // wood and steel, not flesh.
    src.userData.handsGroup = null;
    const strip = [];
    src.traverse((o) => { if (o.userData?.isGlove) strip.push(o); });
    for (const o of strip) o.parent?.remove(o);

    // Normalise: longest axis becomes DISPLAY_LEN, recentred on its own bounds.
    const holder = new THREE.Group();
    const box = new THREE.Box3().setFromObject(src);
    if (box.isEmpty()) { holder.add(src); return holder; }
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z, 1e-4);
    const DISPLAY_LEN = 0.95;                 // metres, tuned to the crate width
    // Cap the enlargement. Normalising the longest axis suits guns, which are
    // all roughly a metre, but the pool also holds a 0.36 m Monkey Bomb and a
    // 0.3 m Bowie knife — blowing those up to 0.95 m made them read as absurd
    // giant props rather than as the small items they are.
    const MAX_DISPLAY_UPSCALE = 1.7;
    const k = Math.min(DISPLAY_LEN / longest, MAX_DISPLAY_UPSCALE);
    src.position.sub(centre);                 // pivot about the weapon's centre
    src.scale.multiplyScalar(k);
    src.position.multiplyScalar(k);
    // Present broadside: the viewmodel points down -Z, so yaw it side-on and
    // give it a slight nose-down tilt the way a display rack would.
    holder.rotation.set(0.10, Math.PI / 2, 0.06);
    holder.add(src);
    holder.userData.displayHeight = size.y * k;
    return holder;
  }

  _boxCycleShow(wid) {
    if (this._boxGunW === wid && this._boxGun) { this._boxGun.visible = true; return; }
    if (this._boxGun) { this._boxGun.visible = false; }
    this._boxCycle = this._boxCycle || new Map();
    let m = this._boxCycle.get(wid);
    if (!m) {
      m = this._buildDisplayWeapon(wid, false);
      m.position.set(0, BOX_DISPLAY_Y, BOX_DISPLAY_Z);
      this.map.box.group.add(m);
      this._boxCycle.set(wid, m);
    }
    // Re-parent a cached mesh. Going idle REMOVES the current prize from the
    // crate group but leaves it in this cache, so the next spin that landed on
    // the same weapon found it, made it visible, and presented nothing at all —
    // "take Thompson" over an empty crate, spreading to more weapons as the run
    // went on.
    if (!m.parent) this.map.box.group.add(m);
    m.visible = true;
    this._boxGun = m;
    this._boxGunW = wid;
  }

  _makeTeddy() {
    const fur = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
    const fur2 = new THREE.MeshStandardMaterial({ color: 0x8a6438, roughness: 0.9 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), fur);
    body.scale.y = 1.25; body.position.y = 0.16;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), fur);
    head.position.y = 0.42;
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), fur2);
    snout.position.set(0, 0.4, 0.1);
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), fur); earL.position.set(0.09, 0.52, 0);
    const earR = earL.clone(); earR.position.x = -0.09;
    const armL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), fur); armL.scale.y = 1.8; armL.position.set(0.18, 0.2, 0); armL.rotation.z = -0.4;
    const armR = armL.clone(); armR.position.x = -0.18; armR.rotation.z = 0.4;
    const legL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), fur); legL.scale.y = 1.5; legL.position.set(0.09, 0.0, 0.02);
    const legR = legL.clone(); legR.position.x = -0.09;
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), eyeMat); eyeL.position.set(0.045, 0.44, 0.105);
    const eyeR = eyeL.clone(); eyeR.position.x = -0.045;
    g.add(body, head, snout, earL, earR, armL, armR, legL, legR, eyeL, eyeR);
    g.scale.setScalar(1.4);
    return g;
  }

  // ---------------- pack-a-punch ----------------
  papUse() {
    const p = this.player;
    if (this.teleLinks < 3 || this.papState.busy) return;
    if (p.weapon.pap) { audio.play('deny'); return; }
    if (!p.spend(5000)) { audio.play('deny'); return; }
    audio.play('buy');
    this.hud.setPoints(p.points);
    if (this.isAuthority) {
      this.papStart(p.id, p.weapon.id);
      this.netSend({ t: 'pap_start', pid: p.id, w: p.weapon.id });
    } else {
      this.netSend({ t: 'pap_req', w: p.weapon.id });
      this.papState = { busy: true, t: PAP_PROCESS_SECONDS, ready: false, weapon: p.weapon.id, owner: p.id, mine: true };
    }
    // hand the gun to the machine — hands come up EMPTY for the knuckle crack,
    // THEN you reach for your other weapon (never fists + gun at once)
    this.papState.slot = p.weapon; // exact slot, so a duplicate pull cannot shadow it
    p.weapon.upgrading = true;
    this.weaponRig.papHide = true; // hides the view-model entirely
    this._papSwapPending = true;   // swap fires the moment the ritual actually ends
    audio.play('pap_insert');
    // the ritual: slow, smooth, high-class knuckle crack while it starts cooking
    this.weaponRig.knuckleCrack();
    setTimeout(() => { if (!this.disposed) audio.play('knuckles'); }, 620);
    setTimeout(() => { if (!this.disposed) audio.play('knuckles', { rate: 0.94 }); }, 1180);
  }

  papStart(pid, wid) {
    this.papState = { busy: true, t: PAP_PROCESS_SECONDS, ready: false, weapon: wid, owner: pid };
  }

  updatePap(dt) {
    const ps = this.papState;
    if (ps.busy && !ps.ready) {
      ps.t -= dt;
      // pap.mp3 decodes to exactly 4.000s = PAP_PROCESS_SECONDS. Start it once at
      // the top of the cycle and its last sample lands on the frame pap_done rings.
      // The old 2.4s retrigger stacked a second whirr over the first instead.
      if (!this._papWhirrStarted) {
        this._papWhirrStarted = true;
        this._papWhirr = audio.play('pap_whirr', { pos: this.map.pap.pos }) || null;
      }
      // Clients never complete a cycle on their own clock. Only the authority
      // emits pap_ready, preventing divergent ready weapons under latency.
      if (ps.t <= 0 && this.isAuthority) {
        ps.t = 0;
        ps.ready = true;
        audio.play('pap_done', { pos: this.map.pap.pos });
        this.netSend({ t: 'pap_ready', pid: ps.owner, w: ps.weapon });
        if (ps.owner === this.player.id || ps.mine) this.hud.papNotice('Your weapon is ready');
      }
    } else if (ps.busy) {
      // owner takes on proximity + F; authority auto-grants after the ready timeout
      ps.t -= dt;
      const ownerIsMe = ps.owner === this.player.id || ps.mine;
      if (ownerIsMe) {
        const d = dist2D(this.player.x, this.player.z, this.map.pap.pos.x, this.map.pap.pos.z);
        if (d < 2.6 && input.pressed['KeyF']) {
          this.papTake();
          this._syncPapPresentation(dt);
          return;
        }
      }
      if (ps.t < -PAP_READY_TIMEOUT_SECONDS) { // timeout: grant to owner automatically
        if (ownerIsMe) this.papTake();
        else if (this.isAuthority) {
          const remote = this.remotePlayers.get(ps.owner);
          if (remote?.ownedWeapons.has(ps.weapon)) {
            remote.ownedWeapons.set(ps.weapon, true);
            remote.weaponId = ps.weapon;
            remote.weaponPap = true;
          }
          this.netSend({ t: 'pap_take', pid: ps.owner, w: ps.weapon });
          this._resetPapState();
        } else if (ps.t < -(PAP_READY_TIMEOUT_SECONDS + 10)) {
          // Neither the owner nor the authority: this client can only be
          // released by the host's `pap_take`. If that never arrives — dropped
          // message, or an owner who disconnected before the host noticed — the
          // branch above re-evaluates every frame forever and the machine is
          // dead for this client. Ten seconds past the grant deadline, let go.
          this._resetPapState();
        }
      }
    }
    this._syncPapPresentation(dt);
  }

  _showPapOutputWeapon(id) {
    if (!WEAPONS[id] || this._papOutput?.id === id) return;
    this._clearPapOutputWeapon();
    const group = buildPapDisplayWeapon(id);
    const slot = this.map.pap.slot;
    const baseY = slot.position.y + 0.03;
    // Standoff from the machine face. The furthest the cabinet reaches forward
    // across the band of Y the prize floats in is the brass mouth ring and its
    // rivets, at local z = 0.69 (js/props/packAPunch.js) — not the z = 0.62
    // mouth plane. The weapon spins about Y, so it sweeps its own half-length
    // in Z; at PAP_DISPLAY_LEN the widest of them (the ray gun) still passes
    // ~0.10 clear of that ring, so it reads as just-handed-out without ever
    // grazing the collar. It cannot be offset in the builder instead: a baked
    // Z offset would make the weapon orbit the machine rather than sit in
    // front of it.
    group.position.set(slot.position.x, baseY, slot.position.z + 0.60);
    group.rotation.set(0.05, Math.PI / 2, -0.05);
    slot.parent.add(group);
    this._papOutput = { id, group, baseY };
  }

  _clearPapOutputWeapon() {
    if (!this._papOutput) return;
    disposePapDisplayWeapon(this._papOutput.group);
    this._papOutput = null;
  }

  _syncPapPresentation(dt) {
    if (!this.map?.pap) return;
    const phase = papLifecyclePhase(this.papState);
    this.map.pap.busy = phase !== 'idle';
    this.map.pap.processing = phase === 'processing';
    this.map.pap.ready = phase === 'ready';
    if (phase !== 'ready') {
      this._clearPapOutputWeapon();
      return;
    }
    this._showPapOutputWeapon(this.papState.weapon);
    const output = this._papOutput;
    if (!output) return;
    output.group.position.y = output.baseY + Math.sin(this.time * 2.4) * 0.035;
    output.group.rotation.y += dt * 0.42;
    updatePapDisplayWeapon(output.group, dt);
  }

  // The whirr is a one-shot the length of a whole cycle, so a cycle that ends
  // early (reject/refund, host takeover) has to cut it — otherwise the machine
  // keeps grinding over an idle table.
  // A gun acquired while your only other gun is inside the machine still has to
  // appear in your hands. papHide is cleared by switchWeapon(), which giveWeapon()
  // bypasses — without this the purchase stays invisible AND fireWeapon() refuses
  // to shoot it until the cycle completes.
  _revealAcquiredWeapon() {
    if (this.player.weapon?.upgrading) return;
    this._papSwapPending = false;
    this.weaponRig.papHide = false;
  }

  _stopPapWhirr() {
    if (this._papWhirr) { try { this._papWhirr.stop(); } catch (e) {} }
    this._papWhirr = null;
    this._papWhirrStarted = false;
  }

  // The weapon in the machine is tracked by slot reference, not by id: the box
  // can hand you a second copy of the same gun mid-cycle, and an id lookup would
  // then upgrade the fresh copy and leave the real one flagged `upgrading`
  // forever — a slot switchWeapon() refuses for the rest of the game.
  _papSlot() {
    const slot = this.papState.slot;
    if (slot && this.player.weapons.includes(slot)) return slot;
    return this.player.weapons.find((entry) => entry.id === this.papState.weapon) || null;
  }

  _resetPapState() {
    this.papState.busy = false;
    this.papState.ready = false;
    this.papState.mine = false;
    this.papState.t = 0;
    this.papState.weapon = null;
    this.papState.owner = null;
    this.papState.slot = null;
    this._stopPapWhirr();
    this._clearPapOutputWeapon();
  }

  _cancelLocalPapAttempt(refund = false) {
    if (!this.papState.mine) return;
    // Same trap as papTake: the recorded slot may have been moved out of
    // p.weapons by goDown, and leaving `upgrading` set makes that slot
    // permanently unselectable.
    const weapon = this._papSlot() || this.papState.slot;
    if (weapon) weapon.upgrading = false;
    if (refund) {
      this.player.points += 5000;
      this.hud.setPoints(this.player.points);
    }
    this._papSwapPending = false;
    this.weaponRig.papHide = false;
    this._resetPapState();
  }

  papTake(notifyAuthority = true) {
    const wonder = ['raygun', 'dg2'].includes(this.papState.weapon);
    this.bark(wonder ? 'take_wonder' : 'take', { force: true });
    const p = this.player;
    // NO `|| p.weapon` fallback. _papSlot() returning null means the gun that
    // went into the machine is not in the player's hands any more — going down
    // moves the whole loadout into _stashedWeapons and hands you a fresh m1911
    // (see Player.goDown) — and substituting whatever you happen to be holding
    // upgraded the DOWN PISTOL, which is discarded on revive. The paid-for
    // weapon stayed in the stash with `upgrading` still true, and switchWeapon
    // refuses to select an upgrading slot, so the gun was unreachable for the
    // rest of the run and the 5000 points were gone. Clear the flag on the slot
    // we actually recorded, wherever it now lives.
    const w = this._papSlot();
    if (!w) {
      // The machine finished its cycle and you paid for it, so the upgrade still
      // lands — on the stashed slot, wherever goDown put it. Applied in full
      // (pap + refilled magazines) rather than merely unlocked, so the gun you
      // bought is waiting, upgraded, when you are back on your feet. Nothing
      // touches the rig or the ammo HUD here: this weapon is not in your hands.
      const stashed = this.papState.slot;
      if (stashed) {
        const s = getStats(stashed.id, true);
        stashed.pap = true;
        stashed.upgrading = false;
        stashed.mag = s.mag;
        stashed.reserve = s.reserve;
      }
      this.weaponRig.papHide = false;
      this._resetPapState();
      this.hud.papNotice(null);
      return;
    }
    w.pap = true;
    w.upgrading = false;
    const wi = p.weapons.indexOf(w);
    if (wi >= 0) p.cur = wi; // HUD + hands show the gun you just took
    const s = getStats(w.id, true);
    w.mag = s.mag; w.reserve = s.reserve;
    // After the upgrade, not before it: the HUD used to be handed the old mag and
    // the new name, and nothing refreshes ammo again until you fire, so an
    // upgraded gun spent its first moments claiming its old capacity.
    this.hud.setAmmo(w.mag, w.reserve, s.displayName);
    this._resetPapState();
    if (w.gold || this.cheats.goldguns) this.weaponRig.diamondNext = true; // PaP a gold gun -> DIAMOND
    this.weaponRig.papHide = false;
    // equip() poses the new model at the bottom of its raise on this very frame,
    // so it comes up out of the holster like any other draw. Visibility is left to
    // the rig's own gate — forcing it here also forced the view-model into the
    // sniper scope picture on the frame you took a scoped gun out of the machine.
    this.weaponRig.equip(w.id, true);
    this.weaponRig.startInspect();
    this.hud.papNotice(null);
    // No screen flash on collection.
    //
    // This used to call fx.screenFlash('#c9a2ff', 420, 0.1) to read as the
    // machine's glow washing out. It cannot: the post path drives uFlash, which
    // is COLOURLESS, so the purple never arrives and what actually renders is a
    // white blink. The 420ms duration is not honoured either -- onScreenFlash
    // just adds opacity * 1.6 to _postFlash, which then decays at 7/s, so 0.1
    // becomes 0.16 and is gone in about one and a half frames.
    //
    // A sub-two-frame colourless lift, on the exact frame a new view-model is
    // being built, is indistinguishable from a rendering glitch -- and that is
    // precisely how it was reported: "something flashes right when you take the
    // finished upgraded gun out of the machine". Earlier passes tuned the
    // strength down rather than removing it, which made it subtler without
    // making it read as anything.
    //
    // The event already has feedback that works: the pap_done cue below, the
    // upgraded camo on the weapon, and the draw animation. Note this is separate
    // from the one-frame dark unposed-model frame fixed by priming
    // advancePapLivingFinish in equip() -- that was a DARK frame, this is the
    // bright one.
    audio.play('pap_done', { pos: this.map.pap.pos });
    if (notifyAuthority) this.netSend({ t: 'pap_take', pid: p.id, w: w.id });
  }

  // ---------------- power / teleporters ----------------
  setPower(on) {
    this.map.power.on = on;
    if (on) {
      audio.play('power', { pos: this.map.power.pos, maxDist: 60 });
      this.map.power.lever.rotation.x = 0.7;
      // Ramp the practicals up rather than snapping them. Ten lamps going
      // 0 -> 9 in a single frame is a hard step for the light pool to absorb
      // and it reads as a pop; over a few hundred milliseconds it reads as
      // current reaching the building. Staggered so they do not all strike at
      // once, which is also how a real sub-station comes back.
      const lamps = this.map.perks.map((perk) => perk.lamp);
      this._perkLampRamp = { lamps, t: 0, delays: lamps.map((_, i) => i * 0.11) };
      for (const lamp of lamps) lamp.intensity = 0;
      // power-sealed doors (corridor shortcuts + balcony bridge) open automatically
      for (const d of this.map.doors) if (d.auto && !d.open) this.openDoor(d);
      this.hud.banner('POWER ON', '#ffd24a');
      this.bark('power', { force: true });
    }
  }

  teleUse(tele) {
    if (!this.map.power.on || tele.charging || tele.cooldown > 0) return;
    // Charging and cooldown are different states. The old implementation set
    // the recharge timer before the 2.5s use animation even began, so the first
    // successful activation immediately (and incorrectly) read RECHARGING.
    tele.charging = true;
    if (!this.isAuthority) this.netSend({ t: 'tele_req', id: tele.id });
    audio.play('tele_charge', { pos: tele });
    // swirl particles during charge
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        if (this.disposed) return;
        this.fx.spawnParticles(tele.x + rand(-1, 1), tele.y + rand(0.2, 2.2), tele.z + rand(-1, 1), { count: 2, color: [0.4, 0.7, 1], speed: 0.6, life: 0.5, grav: -2, size: 1.2 });
      }, i * 80);
    }
    setTimeout(() => {
      if (this.disposed) return;
      tele.charging = false;
      tele.cooldown = 18;
      // teleport all players on the pad
      const onPad = [{ me: true, x: this.player.x, z: this.player.z }].filter((pl) => dist2D(pl.x, pl.z, tele.x, tele.z) < 2.0);
      if (onPad.length) {
        this.player.x = this.map.mainframe.x + rand(-1, 1);
        this.player.z = this.map.mainframe.z + rand(0, 1);
        this.player.y = this.map.floorY(this.player.x, this.player.z, 2); // arrive ON the pad platform
        this.fx.screenFlash('#bfd9ff', 300, 0.8);
        audio.play('teleport', { pos: tele });
        this.fx.shake(0.3);
      }
      this.fx.spawnParticles(tele.x, tele.y + 1.5, tele.z, { count: 24, color: [0.5, 0.8, 1], speed: 3, life: 0.6, grav: -1, size: 1.6 });
      this.fx.spawnParticles(this.map.mainframe.x, 1.5, this.map.mainframe.z, { count: 24, color: [0.5, 0.8, 1], speed: 3, life: 0.6, grav: -1, size: 1.6 });
      if (this.isAuthority) {
        this.linkTeleporter(tele);
        this.netSend({ t: 'tele', id: tele.id });
      }
    }, 2500);
  }

  linkTeleporter(tele) {
    if (tele.linked) return;
    tele.linked = true;
    this.teleLinks++; this.bark('tele', { chance: 0.9 });
    if (this.teleLinks >= 3) {
      this.hud.banner('PACK-A-PUNCH AVAILABLE', '#c9a2ff', 'All three teleporters are linked');
      audio.play('pap_done');
      this.netSend({ t: 'pap_door' });
    } else {
      this.hud.banner(`TELEPORTER LINKED ${this.teleLinks}/3`, '#7ec8e3');
    }
    this.netSend({ t: 'tele_link', id: tele.id });
  }

  // ---------------- zombie->player damage ----------------
  onZombieDamagePlayer(pid, dmg, x, z) {
    if (pid === this.player.id) {
      this.player.damage(dmg, this);
      return;
    }
    const bot = this.bots?.find((b) => b.id === pid);
    if (bot && !bot.down && !bot.dead) {
      bot.hp -= dmg;
      audio.play('hurt');
      if (bot.hp <= 0) {
        bot.hp = 0; bot.down = true; bot.downs++;
        bot.bleedout = CFG.BLEEDOUT_TIME;
        this.botBark(bot, 'down', 0.9);
        this.netSend({ t: 'down', pid: bot.id });
      }
      return;
    }
    this.netSend({ t: 'pdmg', pid, dmg, x, z });
  }

  onPlayerDown(player) {
    this.netSend({ t: 'down', pid: player.id });
    if (player === this.player) {
      this._beingRevived = null; // fresh down — nobody is coming for you yet
      this.bark('down', { force: true });
    }
    if (this.mode === 'solo' && !player.selfReviveAvailable) {
      // solo without quick revive = instant death
      setTimeout(() => { if (player.down && !this.disposed) player.die(this); }, 1200);
    }
  }

  onPlayerDead(player) {
    this.netSend({ t: 'dead', pid: player.id });
    if (player === this.player) this._beingRevived = null;
    if (this.mode !== 'solo') this.pickSpectate();
  }

  pickSpectate() {
    this.spectateTarget = null;
    for (const [id, rp] of this.remotePlayers) {
      if (!rp.dead && !rp.down) { this.spectateTarget = id; break; }
    }
    this.syncSpectateView();
  }

  syncSpectateView() {
    // hide the model of whoever we're riding with — you're looking THROUGH
    // their eyes, not through the inside of their skull
    for (const [id, rp] of this.remotePlayers) {
      const hide = id === this.spectateTarget;
      if (rp.group) rp.group.visible = !hide;
    }
    const rp = this.spectateTarget ? this.remotePlayers.get(this.spectateTarget) : null;
    this.hud.papNotice(rp ? `SPECTATING — ${rp.name.toUpperCase()}` : null);
  }

  respawnSelf() {
    // back from the dead at the new round: full hp, starting pistol, perks gone
    const p = this.player;
    p.dead = false; p.down = false;
    p.bleedout = 0;
    p.weapons = [{ id: 'm1911', pap: false, mag: 8, reserve: 80 }];
    p.cur = 0;
    p.perks.clear();
    p.hp = p.maxHpNow; // after the perk wipe — plain 100, no leftover Jug health
    p.grenades = 2; p.monkeys = 0; p.ownsMonkeys = false;
    p.adsT = 0; p.recoilPitch = 0; p.spreadBloom = 0; p.sprinting = false;
    p.downEase = 0; // stand up instantly here — the teleport hides the cut
    this._deathCamHeld = false; // release the frozen death pose
    this._beingRevived = null;
    this.spectateTarget = null;
    this.syncSpectateView();
    const spawnBase = this.map.playerSpawns[0];
    p.x = spawnBase.x + rand(-1, 1); p.z = spawnBase.z + rand(-1, 1);
    p.y = this.map.floorY(p.x, p.z, 2); // settle onto the platform surface
    p.yaw = 0;
    this.weaponRig.papHide = false;
    this.weaponRig.equip('m1911', false);
    this.camera.fov = clamp(Number(this.options.fov) || 90, 70, 110);
    this.onResize();
    this.hud.downUI(false);
    this.hud.setPerks(p.perks);
    this.hud.setGrenades(p.grenades, p.monkeys);
    this.hud.banner('BACK IN THE FIGHT', '#7ee38a', 'Make it count this time');
    audio.play('revive');
    this.netSend({ t: 'respawn', pid: p.id });
  }

  applyRevive(pid, byPid) {
    const bot = this.bots?.find((b) => b.id === pid);
    if (bot) { bot.down = false; bot.hp = bot.maxHp; return; }
    if (pid === this.player.id) {
      this.player.revive(true, this);
      this._beingRevived = null;
      this.hud.downUI(false);
      this.hud.reviveUI(false);
      this.spectateTarget = null;
      this.syncSpectateView();
    }
    const rp = this.remotePlayers.get(pid);
    if (rp) {
      rp.down = false;
      // hand the real loadout back to the authoritative record
      if (rp._downStash) { rp.authorizeWeapon(rp._downStash.id, rp._downStash.pap, false); rp._downStash = null; }
    }
    if (byPid === this.player.id) {
      this.player.revives++; this.bark('revive', { force: true });
      this.awardPoints(0);
    }
  }

  perkCount(id) { return this.player.perks.has(id) ? 1 : 0; }

  // ---------------- net update ----------------
  updateNet(dt) {
    if (this.mode === 'host') {
      this.snapTimer -= dt;
      if (this.snapTimer <= 0) {
        this.snapTimer = 1 / CFG.SNAPSHOT_HZ;
        const pl = [this.player.serialize()];
        for (const [, rp] of this.remotePlayers) {
          pl.push({ id: rp.id, name: rp.name, c: rp.colorIdx, x: rp.x, y: rp.y, z: rp.z, yaw: rp.yaw, pitch: rp.pitch, hp: rp.hp, down: rp.down ? 1 : 0, dead: rp.dead ? 1 : 0, points: rp.points, kills: rp.kills, downs: rp.downs, revives: rp.revives, w: rp.weaponId, pap: rp.weaponPap ? 1 : 0, perks: rp.perks, crouch: rp.crouch, sprint: rp.sprint, bleed: rp.bleed });
        }
        for (const b of this.bots || []) pl.push(b.serialize());
        this.net.sendUnrel({ t: 'snap', pl, z: this.zombies.serialize(), round: this.round });
      }
    } else {
      this.inputTimer -= dt;
      if (this.inputTimer <= 0) {
        this.inputTimer = 1 / CFG.INPUT_HZ;
        this.net.sendUnrel(this.player.serialize());
      }
    }
  }

  onNetEvent(msg, from) {
    const p = this.player;
    switch (msg.t) {
      case 'shoot': {
        if (!WEAPONS[msg.w]) break;
        if (![msg.x, msg.y, msg.z, msg.dx, msg.dy, msg.dz]
          .every((n) => Number.isFinite(n) && Math.abs(n) <= 500)) break;
        // WHO FIRED. On the host `from` is the sender's peer id and that is the
        // shooter. On a guest every reliable message arrives labelled 'host',
        // so `from` identifies the relay and not the shooter — which is why a
        // guest used to see no muzzle flash at all, from anybody. The host
        // stamps `pid` (its own id on its own shots, the sender's id on a
        // relay) and that is the field both sides resolve.
        const shooterId = msg.pid || from;
        if (shooterId === p.id) break;               // our own shot, relayed back
        const rp = this.remotePlayers.get(shooterId);
        if (!rp || Math.hypot(msg.x - rp.x, msg.y - (rp.y + 1.5), msg.z - rp.z) > 4) break;
        if (!remoteWeaponClaimAllowed(rp, msg.w, msg.pap)) break;
        const s = getStats(msg.w, !!msg.pap);
        if (!this._remoteActionReady(shooterId, 'shoot', Math.max(30, (60000 / Math.max(1, s.rpm)) * 0.72))) break;
        const dir = new THREE.Vector3(msg.dx, msg.dy, msg.dz);
        if (dir.lengthSq() < 0.5) break;
        dir.normalize();
        const origin = new THREE.Vector3(msg.x, msg.y, msg.z);
        // Damage arbitration is the authority's job alone. A guest running it
        // would build claim ledgers nobody ever redeems.
        if (this.isAuthority) {
          const now = performance.now();
          let remoteClaims = this._remoteShots.get(shooterId);
          if (!remoteClaims) { remoteClaims = []; this._remoteShots.set(shooterId, remoteClaims); }
          for (let i = remoteClaims.length - 1; i >= 0; i--) {
            if (now - remoteClaims[i].at >= 5000) remoteClaims.splice(i, 1);
          }
          remoteClaims.push({
            at: now, origin, dir, s,
            wid: msg.w, pap: !!msg.pap,
            remaining: s.fire === 'arc' ? (s.chain || 10) : s.fire === 'hitscan' ? shotClaimBudget(s) : 32,
            accepted: [], usedSplash: false,
            floorImpact: s.fire === 'arc'
              ? this._dg2FloorImpact(origin, dir, 60)
              : null,
          });
          while (remoteClaims.length > 8) remoteClaims.shift();
        }
        // Everything below is cosmetic and runs identically on host and guest.
        // Fire it from the barrel of the weapon he is actually holding rather
        // than from half a metre in front of his chest — on a PTRS-41 or a
        // Panzerschreck that guess was most of a metre short of the muzzle.
        const flash = rp.muzzleWorld(_shotMuzzle);
        const ox = flash ? flash.x : msg.x + msg.dx * 0.5;
        const oy = flash ? flash.y : msg.y + msg.dy * 0.5;
        const oz = flash ? flash.z : msg.z + msg.dz * 0.5;
        audio.play(s.sfx || 'shot_rifle', { pos: { x: msg.x, y: msg.y, z: msg.z } });
        this.fx.muzzleFlash(ox, oy, oz, dir.x, dir.y, dir.z);
        if (s.fire === 'hitscan') {
          const wd = this.wallDist(origin, dir, 120);
          const hits = this.zombieHitTest(origin, dir, wd);
          const maxTargets = penetrationProfile(s).maxTargets;
          const endD = hits.length ? hits[Math.min(hits.length, maxTargets) - 1].dist : wd;
          this.fx.tracer(ox, oy, oz,
            msg.x + dir.x * endD, msg.y + dir.y * endD, msg.z + dir.z * endD);
        }
        break;
      }
      case 'grenade': {
        if (!this.isAuthority || !this._remoteNear(from, msg, 4) || !this._remoteActionReady(from, 'grenade', 600)) break;
        this._remoteGrenades.set(from, { at: performance.now(), x: msg.x, y: msg.y, z: msg.z, used: false });
        break;
      }
      case 'zhit': {
        if (!this.isAuthority) break;
        if (!this._consumeRemoteCredit(from, msg.cid)) break;
        const zombie = this.zombies.zombies.get(msg.z);
        if (!zombie || zombie.state === ZSTATES.DIE) break;
        let s = null, damage = 0, head = false;
        if (msg.knife) {
          const rp = this.remotePlayers.get(from);
          if (!rp || dist2D(rp.x, rp.z, zombie.x, zombie.z) > 2.8 || !this._remoteActionReady(from, 'knife', 380)) break;
          damage = meleeDamage(rp.bowie);
        } else {
          let claimedRay = null;
          if (Array.isArray(msg.ray) && msg.ray.length === 3 && msg.ray.every(Number.isFinite)) {
            claimedRay = new THREE.Vector3(msg.ray[0], msg.ray[1], msg.ray[2]);
            if (claimedRay.lengthSq() < 0.5 || claimedRay.lengthSq() > 1.7) break;
            claimedRay.normalize();
          }
          const claims = this._remoteShots.get(from) || [];
          const claimNow = performance.now();
          let claim = null;
          for (let i = claims.length - 1; i >= 0; i--) {
            const candidate = claims[i];
            if (claimNow - candidate.at <= 650 && candidate.wid === msg.wid
              && candidate.pap === !!msg.pap && candidate.remaining > 0
              && (candidate.s.pellets || !candidate.accepted.includes(zombie))
              && candidate.s.fire !== 'projectile'
              && this._remoteShotTargetAllowed(candidate, zombie, !!msg.head, claimedRay)) {
              claim = candidate;
              break;
            }
          }
          if (!claim) break;
          const penetrationIndex = claim.s.fire === 'hitscan' && !claim.s.pellets ? claim.accepted.length : 0;
          const distance = Math.hypot(
            zombie.x - claim.origin.x,
            zombie.y + 1 - claim.origin.y,
            zombie.z - claim.origin.z,
          );
          claim.remaining--;
          claim.accepted.push(zombie);
          s = claim.s;
          damage = s.fire === 'hitscan'
            ? hitscanDamage(s, distance, penetrationIndex)
            : Number(s.dmg) || 0;
          head = !!msg.head;
        }
        if (damage <= 0) break;
        const res = this.zombies.damage(msg.z, damage, { head, by: from, explosive: false, weapon: msg.knife ? { headMult: 1 } : s });
        if (res.ok) {
          this.netSend({
            t: 'hitcredit', pid: from, cid: msg.cid, head, killed: !!res.killed,
            x: zombie.x, y: zombie.y, z: zombie.z,
          });
          if (res.killed) {
            this.netSend({
              t: 'killcredit', pid: from, cid: msg.cid, head, knife: !!msg.knife,
              x: zombie.x, y: zombie.y, z: zombie.z,
            });
          }
        }
        break;
      }
      case 'zsplash': {
        if (!this.isAuthority) break;
        if (!Array.isArray(msg.ids) || msg.ids.length > 32 || [msg.x, msg.y, msg.z].some((n) => !Number.isFinite(n))) break;
        const now = performance.now();
        const grenade = msg.gren ? this._remoteGrenades.get(from) : null;
        const claim = msg.gren ? null : (this._remoteShots.get(from) || []).find((candidate) => {
          if (candidate.s.fire !== 'projectile' || candidate.wid !== msg.wid || candidate.pap !== !!msg.pap || candidate.usedSplash) return false;
          const elapsed = (now - candidate.at) / 1000;
          return elapsed >= 0 && elapsed <= 4.6
            && Math.hypot(msg.x - candidate.origin.x, msg.y - candidate.origin.y, msg.z - candidate.origin.z)
              <= candidate.s.projSpeed * elapsed + 6;
        });
        let radius = 0, directDamage = 0, splashDamage = 0;
        if (grenade) {
          const elapsed = now - grenade.at;
          if (elapsed < 2400 || elapsed > 6500 || grenade.used || Math.hypot(msg.x - grenade.x, msg.y - grenade.y, msg.z - grenade.z) > 60) break;
          grenade.used = true;
          radius = FRAG_BLAST.radius;
          directDamage = FRAG_BLAST.maxDamage;
          splashDamage = FRAG_BLAST.maxDamage;
        } else {
          if (!claim || claim.s.fire !== 'projectile' || claim.wid !== msg.wid || claim.pap !== !!msg.pap || claim.usedSplash) break;
          const elapsed = (now - claim.at) / 1000;
          if (elapsed < 0 || elapsed > 4.6) break;
          claim.usedSplash = true;
          radius = claim.s.splash?.radius || 2;
          directDamage = Number(claim.s.dmg) || 0;
          splashDamage = Number(claim.s.splash?.dmg) || directDamage * 0.5;
        }
        for (const hit of msg.ids) {
          if (!Array.isArray(hit) || hit.length !== 3) continue;
          const [zid, , cid] = hit;
          if (!this._consumeRemoteCredit(from, cid)) continue;
          const zombie = this.zombies.zombies.get(zid);
          if (!zombie || zombie.state === ZSTATES.DIE) continue;
          const distance = Math.hypot(
            zombie.x - msg.x,
            zombie.y + (zombie.dog ? 0.45 : 0.55) - msg.y,
            zombie.z - msg.z,
          );
          if (distance > radius + 0.8) continue;
          const dmg = msg.gren
            ? explosionDamage(distance, FRAG_BLAST)
            : distance < 0.8
              ? directDamage
              : Math.round(lerp(splashDamage, splashDamage * 0.3, clamp(distance / radius, 0, 1)));
          if (dmg <= 0) continue;
          const res = this.zombies.damage(zid, dmg, { head: false, by: from, explosive: true, weapon: { headMult: 1 } });
          if (res.ok) {
            this.netSend({
              t: 'hitcredit', pid: from, cid, head: false, killed: !!res.killed,
              x: zombie.x, y: zombie.y, z: zombie.z,
            });
            if (res.killed) {
              this.netSend({
                t: 'killcredit', pid: from, cid, head: false,
                x: zombie.x, y: zombie.y, z: zombie.z,
              });
            }
          }
        }
        break;
      }
      case 'hitcredit': {
        if (msg.pid !== p.id || !this._acceptLocalCredit(msg.cid, 'hit')) break;
        this.awardPoints(CFG.POINTS_HIT);
        const pos = [msg.x, msg.y, msg.z].every(Number.isFinite)
          ? { x: msg.x, y: msg.y, z: msg.z }
          : { x: p.x, y: p.y, z: p.z };
        if (!msg.killed) {
          this.hud.hitmarker(false, !!msg.head);
          audio.play('hitmarker');
          if (msg.head) audio.play('headshot', { pos });
        }
        break;
      }
      case 'killcredit': {
        if (msg.pid === p.id && this._acceptLocalCredit(msg.cid, 'kill')) {
          const reward = killCreditPresentation({
            head: !!msg.head,
            knife: !!msg.knife,
            doubleActive: this.doubleT > 0,
          });
          p.kills++;
          if (msg.head) p.headshots++;
          this.awardPoints(reward.basePoints);
          this.hud.hitmarker(true, msg.head);
          audio.play('hitmarker_kill');
          const pos = [msg.x, msg.y, msg.z].every(Number.isFinite)
            ? { x: msg.x, y: msg.y, z: msg.z }
            : { x: p.x, y: p.y, z: p.z };
          if (msg.head) audio.play('headshot', { pos });
          this.fx.popup(pos.x, pos.y + 1.6, pos.z, `+${reward.displayedPoints}`, reward.color);
        }
        break;
      }
      case 'zkill': {
        // visual only (authority already handled locally)
        if (!this.isAuthority) {
          if (msg.dog) {
            this.fx.explosion(msg.x, msg.y + 0.4, msg.zz, 1.5);
            audio.play('dog_death', { pos: { x: msg.x, y: msg.y, z: msg.zz }, vol: 0.9 });
            audio.play('explosion', { pos: { x: msg.x, y: msg.y, z: msg.zz } });
          } else {
            audio.play('zombie_hit', { pos: { x: msg.x, y: msg.y, z: msg.zz } });
            this.fx.blood(msg.x, msg.y + (msg.head ? 1.5 : 1), msg.zz, true);
          }
        }
        break;
      }
      case 'round': {
        this.round = msg.n;
        this.phase = 'active';
        this.zombies.dogRound = !!msg.dog; // clients need this for fog + hound counter
        if (!this.player.dead) { // +2 grenades per round (max 4), same as host
          this.player.grenades = Math.min(4, this.player.grenades + 2);
          this.hud.setGrenades(this.player.grenades, this.player.monkeys);
        }
        this.hud.setRound(msg.n, !!msg.dog);
        if (msg.dog) { this.hud.banner('HELLHOUNDS', '#ff7733', 'They come for your blood'); audio.play('dog_howl'); }
        else { this.hud.banner(`ROUND ${msg.n}`, msg.n >= 10 ? '#ff4444' : '#c33', ''); audio.setRound(msg.n); audio.play('round_start'); }
        break;
      }
      case 'intermission': {
        if (this.isAuthority) break;
        this.phase = 'intermission';
        this.phaseT = Math.max(0, Number(msg.seconds) || ROUND_INTERMISSION_SECONDS);
        if (this.player.dead) this.respawnSelf();
        audio.play('round_end');
        break;
      }
      case 'pause': {
        this.remotePaused = this.remotePaused || new Set();
        if (msg.on) this.remotePaused.add(msg.pid || from); else this.remotePaused.delete(msg.pid || from);
        break;
      }
      case 'song': {
        const songPos = this.map.interact.find((i) => i.kind === 'song')?.pos || null;
        if (msg.on) audio.playSong(songPos); else audio.stopSong();
        break;
      }
      case 'bark': {
        const rp = msg.pid ? this.remotePlayers.get(msg.pid) : null;
        if (msg.pid && !rp) break; // unknown source — never a full-volume phantom line
        const pos = rp ? { x: rp.x, y: rp.y + 1.5, z: rp.z } : null;
        this.playBark(msg.p ?? 0, msg.e, msg.v ?? 0, pos);
        break;
      }
      case 'door': {
        const d = this.map.doors.find((dd) => dd.id === msg.id);
        if (d && !d.open) this.openDoor(d);
        break;
      }
      case 'door_req': {
        if (!this.isAuthority) break;
        const d = this.map.doors.find((dd) => dd.id === msg.id);
        if (d && !d.open && d.id !== 'd_pap' && this._remoteNear(from, d, 3.2)) {
          this.openDoor(d);
          this.netSend({ t: 'door', id: d.id });
        }
        break;
      }
      case 'barrier': {
        const b = this.map.barriers.find((bb) => bb.id === msg.id);
        if (b) {
          // Clamped to the window's real capacity. The generic payload validator
          // bounds magnitude at 1e7, and a board count that large is untearable:
          // TEAR removes one board every 1.35s and only completes at zero, so the
          // zombie working it would be immortal and the round could never end.
          const n = clamp(Math.trunc(Number(msg.n)) || 0, 0, b.maxBoards);
          const torn = n < b.boards;
          this.setBoards(b, n);
          audio.play(torn ? 'board_tear' : 'board_build', { pos: b });
        }
        break;
      }
      case 'barrier_req': {
        if (!this.isAuthority) break;
        const b = this.map.barriers.find((bb) => bb.id === msg.id);
        if (b && b.boards < b.maxBoards && this._remoteNearVisible(from, b, 3)) {
          b.boards++;
          this.setBoards(b, b.boards);
          this.netSend({ t: 'barrier', id: b.id, n: b.boards });
          this.netSend({ t: 'boardpoints', pid: from, cid: `${b.id}:${this._nextBoardCreditId++}` });
        }
        break;
      }
      case 'boardpoints': {
        if (msg.pid !== p.id || !consumeBoardCredit(this._seenBoardCredits, msg.cid)) break;
        this.awardPoints(CFG.POINTS_BOARD);
        break;
      }
      case 'power': this.setPower(true); break;
      case 'power_req': {
        if (this.isAuthority && !this.map.power.on && this._remoteNearVisible(from, this.map.power.pos, 3)) {
          this.setPower(true);
          this.netSend({ t: 'power' });
        }
        break;
      }
      case 'perk_anim': {
        // Sanitized host relay. The purchaser already started its first-person
        // animation locally, so ignore the echoed event for that same player.
        if (typeof msg.pid === 'string' && msg.pid !== p.id) this.startRemotePerkDrink(msg.pid, msg.id);
        break;
      }
      case 'perk': break; // legacy perk ownership cosmetic; animation uses perk_anim
      case 'drop': {
        if (!this.isAuthority) {
          const drop = this.fx.spawnDrop(msg.type, msg.x, msg.z);
          drop.netId = msg.id;
        }
        break;
      }
      case 'drop_take': {
        if (!this.isAuthority) {
          const d = this.fx.drops.find((dd) => dd.netId === msg.id) || this.fx.drops[0];
          if (d) this.fx.removeDrop(d);
          this.applyDrop(msg.type, msg.pid);
        }
        break;
      }
      case 'pdmg': {
        if (msg.pid === p.id) p.damage(msg.dmg, this);
        break;
      }
      case 'down': {
        const rp = this.remotePlayers.get(msg.pid);
        if (rp) {
          rp.down = true; rp.perks = [];
          // A downed player fights with the starting sidearm only. Record that
          // here rather than trusting a swap packet: the host validates shot
          // claims against this, so without it a player who had traded the
          // M1911 away would fire a pistol locally and do nothing in co-op.
          rp._downStash = { id: rp.weaponId, pap: rp.weaponPap };
          rp.authorizeWeapon('m1911', false, false);
        }
        if (msg.pid !== p.id) this.hud.banner(`${(this.remotePlayers.get(msg.pid)?.name || 'TEAMMATE').toUpperCase()} IS DOWN`, '#ff9944');
        break;
      }
      case 'dead': {
        const rp = this.remotePlayers.get(msg.pid);
        if (rp) { rp.dead = true; rp.down = false; rp._downStash = null; }
        if (msg.pid === p.id) this._beingRevived = null;
        break;
      }
      case 'revive_start': {
        // Cosmetic-only state, but still worth a sanity check so a peer cannot
        // paint a phantom rescue on someone who is not even down.
        const target = msg.pid === p.id ? p : this.remotePlayers.get(msg.pid);
        if (!target?.down || target.dead) break;
        if (msg.pid === p.id) {
          const known = this.remotePlayers.get(msg.by)?.name;
          this._beingRevived = {
            by: known || 'A TEAMMATE',
            at: this.time,
            need: clamp(Number(msg.need) || CFG.REVIVE_TIME, 0.5, 10),
          };
          audio.play('ui');
        }
        if (this.isAuthority) this.netSend(msg); // relay to the rest of the squad
        break;
      }
      case 'revive_stop': {
        if (msg.pid === p.id) this._beingRevived = null;
        if (this.isAuthority) this.netSend(msg);
        break;
      }
      case 'respawn': {
        const rp = this.remotePlayers.get(msg.pid);
        if (rp) {
          rp.dead = false; rp.down = false;
          if (this.isAuthority) {
            rp.setAuthoritativeLoadout([{ id: 'm1911', pap: false }]);
            rp.spawnWeaponAllowance = new Map([['m1911', false]]);
            rp.bowie = false;
          }
        }
        // A client announces its own respawn to the host; the host must relay
        // that authoritative identity to every other client as well.
        if (this.isAuthority) this.netSend(msg);
        break;
      }
      case 'revive_done': {
        this.applyRevive(msg.pid, msg.by);
        if (this.isAuthority) this.netSend(msg); // relay to others
        break;
      }
      case 'revive_req': {
        if (!this.isAuthority || msg.pid === from) break;
        const reviver = this.remotePlayers.get(from);
        const target = msg.pid === p.id ? p : this.remotePlayers.get(msg.pid);
        if (!reviver || reviver.down || reviver.dead || !target?.down || target.dead
            || !this._remoteNearVisible(from, target, 2.8)) break;
        this.applyRevive(msg.pid, from);
        this.netSend({ t: 'revive_done', pid: msg.pid, by: from });
        break;
      }
      case 'revive_self': {
        const rp = this.remotePlayers.get(msg.pid);
        if (rp) rp.down = false;
        break;
      }
      case 'gameover': {
        if (!this.over) {
          this.over = true;
          this.zombies.setDormant(true);
          audio.play('gameover');
          this.hud.banner('GAME OVER', '#ff3333', `You survived ${msg.round} round${msg.round === 1 ? '' : 's'}`);
          setTimeout(() => { if (!this.disposed) this.exit('lobby'); }, 6000);
        }
        break;
      }
      case 'return_lobby': {
        if (!this.isAuthority) this.exit('lobby', String(msg.reason || 'The host ended the match.').slice(0, 120));
        break;
      }
      case 'box_spin_req': if (this.isAuthority && this.boxState.state === 'idle' && this._remoteNearVisible(from, this.map.box.pos, 3)) this.boxStartSpin(Array.isArray(msg.owned) ? msg.owned.filter((id) => WEAPONS[id]).slice(0, 2) : []); break;
      case 'box_take': {
        if (!this.isAuthority || this.boxState.state !== 'ready' || msg.w !== this.boxState.weapon
            || !this._remoteNearVisible(from, this.map.box.pos, 3)) break;
        if (msg.w === 'bowie') {
          const remote = this.remotePlayers.get(from);
          if (remote) remote.bowie = true;
        }
        this.boxSetIdle();
        break;
      }
      case 'box_state': {
        if (this.isAuthority) break;
        this.boxState.state = msg.state;
        if (msg.state === 'ready') { this.boxState.weapon = msg.w; audio.play('box_ready', { pos: this.map.box.pos }); }
        if (msg.state === 'spin') audio.play('box_spin', { pos: this.map.box.pos });
        if (msg.state === 'teddy') audio.play('teddy', { pos: this.map.box.pos });
        break;
      }
      case 'box_move': {
        // The only index in this switch that reached the map unvalidated. The
        // generic payload validator bounds magnitude, not range.
        const boxIdx = Number(msg.idx);
        if (!Number.isInteger(boxIdx) || boxIdx < 0 || boxIdx >= this.map.box.locations.length) break;
        this.map.moveBox(boxIdx);
        if (!this.isAuthority) { this.boxState.state = 'idle'; this.hud.banner('THE BOX HAS MOVED', '#ffd24a'); }
        break;
      }
      case 'pap_req': {
        const remote = this.remotePlayers.get(from);
        const accepted = this.isAuthority && !this.papState.busy && WEAPONS[msg.w]
            && remoteWeaponClaimAllowed(remote, msg.w, false)
            && this.teleLinks >= 3 && this._remoteNearVisible(from, this.map.pap.pos, 3);
        if (accepted) {
          this.papStart(from, msg.w);
          this.netSend({ t: 'pap_start', pid: from, w: msg.w });
        } else if (this.isAuthority) {
          this.netSend({ t: 'pap_reject', pid: from, w: msg.w });
        }
        break;
      }
      case 'pap_start': {
        if (!this.isAuthority && WEAPONS[msg.w]) {
          // The authority echoes our own request back. That echo must not re-ring
          // the insert a round-trip later, and it must carry the slot forward.
          const echoOfMine = this.papState.mine && msg.pid === p.id && this.papState.weapon === msg.w;
          const slot = echoOfMine ? this.papState.slot : null;
          if (this.papState.mine && !echoOfMine) this._cancelLocalPapAttempt(true);
          this.papState = {
            busy: true, t: PAP_PROCESS_SECONDS, ready: false,
            weapon: msg.w, owner: msg.pid, mine: msg.pid === p.id, slot,
          };
          if (!echoOfMine) audio.play('pap_insert', { pos: this.map.pap.pos });
        }
        break;
      }
      case 'pap_reject': {
        if (!this.isAuthority && msg.pid === p.id
            && this.papState.mine && this.papState.weapon === msg.w) {
          this._cancelLocalPapAttempt(true);
          this.hud.banner('PACK-A-PUNCH BUSY', '#ff9944', 'Your points were refunded');
        }
        break;
      }
      case 'pap_ready': {
        if (!this.isAuthority && papEventMatches(this.papState, msg.pid, msg.w)) {
          this.papState.ready = true;
          this.papState.t = 0;
          audio.play('pap_done', { pos: this.map.pap.pos });
          if (msg.pid === p.id) this.hud.papNotice('Your weapon is ready');
        }
        break;
      }
      case 'pap_take': {
        if (this.isAuthority) {
          if (this.papState.owner === from && this.papState.ready && this._remoteNearVisible(from, this.map.pap.pos, 3)) {
            const remote = this.remotePlayers.get(from);
            if (remote?.ownedWeapons.has(this.papState.weapon)) {
              remote.ownedWeapons.set(this.papState.weapon, true);
              remote.weaponId = this.papState.weapon;
              remote.weaponPap = true;
              const weapon = this.papState.weapon;
              this._resetPapState();
              this.netSend({ t: 'pap_take', pid: from, w: weapon });
            }
          }
        } else if (papEventMatches(this.papState, msg.pid, msg.w)) {
          if (msg.pid === p.id) this.papTake(false);
          else this._resetPapState();
        }
        break;
      }
      case 'pap_door': {
        this.hud.banner('PACK-A-PUNCH AVAILABLE', '#c9a2ff', 'All three teleporters are linked');
        audio.play('pap_done');
        this.teleLinks = 3;
        break;
      }
      case 'tele': {
        const tele = this.map.teleporters.find((t) => t.id === msg.id);
        if (tele) {
          tele.charging = false;
          tele.cooldown = 18;
          audio.play('teleport', { pos: tele });
        }
        break;
      }
      case 'tele_req': {
        if (!this.isAuthority || !this.map.power.on) break;
        const tele = this.map.teleporters.find((t) => t.id === msg.id);
        if (!tele || tele.charging || tele.cooldown > 0 || !this._remoteNearVisible(from, tele, 3)) break;
        tele.charging = true;
        audio.play('tele_charge', { pos: tele });
        setTimeout(() => {
          if (this.disposed) return;
          tele.charging = false;
          tele.cooldown = 18;
          this.linkTeleporter(tele);
          this.netSend({ t: 'tele', id: tele.id });
        }, 2500);
        break;
      }
      case 'tele_link': {
        const tele = this.map.teleporters.find((t) => t.id === msg.id);
        if (tele && !tele.linked) {
          tele.linked = true;
          this.teleLinks = this.map.teleporters.filter((t) => t.linked).length;
          if (this.teleLinks < 3) this.hud.banner(`TELEPORTER LINKED ${this.teleLinks}/3`, '#7ec8e3');
        }
        break;
      }
      case 'trap_on': {
        const t = this.map.traps.find((tt) => tt.id === msg.id);
        if (t) this.activateTrap(t);
        break;
      }
      case 'trap_req': {
        if (!this.isAuthority || !this.map.power.on) break;
        const trap = this.map.traps.find((t) => t.id === msg.id);
        if (trap && !trap.active && trap.cd <= 0 && this._remoteNearVisible(from, trap, 3)) {
          this.activateTrap(trap);
          this.netSend({ t: 'trap_on', id: trap.id });
        }
        break;
      }
      case 'trap_off': {
        const t = this.map.traps.find((tt) => tt.id === msg.id);
        if (t) { t.active = false; t.cd = 45; }
        break;
      }
      case 'monkey': {
        if (!this.isAuthority) this.zombies.monkey = null; // host owns monkey logic
        break;
      }
      case 'radio': {
        const radioIt = this.map.interact.find((i) => i.kind === 'radio');
        if (msg.on) audio.playMusicBox(radioIt?.pos || null); else audio.stopMusicBox();
        break;
      }
      case 'song_req': {
        if (!this.isAuthority) break;
        const songIt = this.map.interact.find((i) => i.kind === 'song');
        if (!this._remoteNearVisible(from, songIt?.pos, 3)) break;
        const songPos = songIt?.pos || null;
        if (msg.on) audio.playSong(songPos); else audio.stopSong();
        this.netSend({ t: 'song', on: msg.on ? 1 : 0 });
        break;
      }
      case 'radio_req': {
        if (!this.isAuthority) break;
        const radioIt = this.map.interact.find((i) => i.kind === 'radio');
        if (!this._remoteNearVisible(from, radioIt?.pos, 3)) break;
        if (msg.on) audio.playMusicBox(radioIt?.pos || null); else audio.stopMusicBox();
        this.netSend({ t: 'radio', on: msg.on ? 1 : 0 });
        break;
      }
      case 'swap': {
        if (!this.isAuthority || !WEAPONS[msg.w]) break;
        const remote = this.remotePlayers.get(from);
        if (!remote) break;
        const wallbuy = this.map.wallbuys.find((wb) => wb.weapon === msg.w && this._remoteNearVisible(from, wb.pos, 3));
        const source = remoteSwapSource({
          weaponId: msg.w,
          claimedPap: msg.pap,
          ownedWeapons: remote.ownedWeapons,
          spawnWeaponAllowance: remote.spawnWeaponAllowance,
          nearMatchingWallbuy: !!wallbuy,
          readyBoxWeapon: this.boxState.state === 'ready' && this._remoteNearVisible(from, this.map.box.pos, 3)
            ? this.boxState.weapon : null,
        });
        if (source === 'owned') {
          // PaP is read from host-owned inventory, never from msg.pap.
          remote.equipAuthorizedWeapon(msg.w);
          break;
        }
        const spawnPap = remote.spawnWeaponAllowance?.get(msg.w);
        if (source === 'spawn') {
          remote.authorizeWeapon(msg.w, spawnPap, false);
          break;
        }
        if (source === 'wallbuy') {
          remote.authorizeWeapon(msg.w, false, true);
          break;
        }
        if (source === 'box') {
          remote.authorizeWeapon(msg.w, false, true);
        }
        break;
      }
    }
  }

  activateTrap(t) {
    t.active = true;
    t.t = 25;
    audio.play('trap', { pos: { x: t.x, y: 1.2, z: t.z }, refDist: 4, maxDist: 18, vol: 0.9 });
  }

  // ---------------- HUD ----------------
  updateHUD(dt) {
    const p = this.player;
    const s = p.stats;
    this.hud.setAmmo(p.weapon ? p.weapon.mag : 0, p.weapon ? p.weapon.reserve : 0, s ? s.displayName : '');
    this._dropTimerState.insta = this.instaT;
    this._dropTimerState.double = this.doubleT;
    this.hud.setDropTimers(this._dropTimerState);
    this.hud.healthPulse(p.hp / p.maxHpNow);
    const spreadPx = s ? (lerp(s.spreadHip + p.spreadBloom, s.spreadAds, p.adsT) * 900) : 10;
    // crosshair only for hip fire — ADS means you're on the sights/optic/scope
    // The crosshair stays up while down — you can still shoot, so firing blind
    // would just be a bug wearing a costume.
    this.hud.setCrosshair(spreadPx, input.locked && p.adsT < 0.5 && !p.dead && !this.over && !this._scoped, p.adsT);
    const showScores = !!input.keys['Tab'];
    this.hud.scoreboard(showScores, showScores ? this.scoreRows() : null);
    const speaking = this._computeSpeaking();
    this.hud.micIndicator(speaking);
    // The always-visible co-op strip is intentionally fed from the same
    // synchronized player state as the Tab scoreboard. Keep it at 10Hz so
    // voice/points feel immediate without rebuilding presentation data every
    // render frame; HUD performs a second signature-based DOM no-op check.
    this._rosterT = (this._rosterT || 0) - dt;
    if (this._rosterT <= 0) {
      this._rosterT = 0.1;
      this.hud.multiplayerRoster(this.mode !== 'solo', this.multiplayerRosterRows());
    }
    // minimap at 10Hz (canvas ops every frame are wasteful in 4-player lobbies)
    this._mmT = (this._mmT || 0) - dt;
    if (this._mmT <= 0) { this._mmT = 0.1; this.hud.drawMinimap(this); }
    if (p.down && this.mode !== 'solo') {
      const br = this.beingRevivedState();
      this.hud.downUI(true, p.bleedout / CFG.BLEEDOUT_TIME,
        br ? `BEING REVIVED BY ${br.by.toUpperCase()}` : false, false);
    }
    if (this.phase === 'intermission') {
      this.hud.waveProgress(true, `Next round in ${Math.ceil(this.phaseT)}`);
    } else if (this.zombies.dogRound && this.phase === 'active') {
      this.hud.waveProgress(true, `HOUNDS REMAINING: ${this.zombies.dogRemaining}`);
    } else this.hud.waveProgress(false);
    this.barkCd = Math.max(0, this.barkCd - dt);
    // Perk lamps striking one after another as the power comes up.
    if (this._perkLampRamp) {
      const r = this._perkLampRamp;
      r.t += dt;
      let done = true;
      for (let i = 0; i < r.lamps.length; i++) {
        const k = Math.min(1, Math.max(0, (r.t - r.delays[i]) / 0.45));
        r.lamps[i].intensity = 9 * (k * k * (3 - 2 * k));
        if (k < 1) done = false;
      }
      if (done) this._perkLampRamp = null;
    }
    // gramophone song + radio music box follow your ears
    if (audio.songPlaying) audio.updateSongSpatial();
    audio.updateMusicBoxSpatial();
    // fog for dog rounds
    const dog = this.zombies.dogRound && this.phase === 'active';
    const fogT = dog ? this.fogDog : this.fogNormal;
    this.scene.fog.color.lerp(fogT.color, dt * 1.5);
    this.scene.fog.density = damp(this.scene.fog.density, fogT.d, 1.5, dt);
    // The sky closes onto the fog colour at the horizon so the two sides of the
    // skyline meet at one value; that only holds if it follows the fog when the
    // fog moves.
    this.map.sky?.setFogColor?.(this.scene.fog.color);
  }

  minimapPlayers() {
    const out = [{ x: this.player.x, z: this.player.z, yaw: this.player.yaw, me: true, color: '#fff', down: false }];
    for (const [, rp] of this.remotePlayers) {
      // A dead teammate's last transform stops being updated, so leaving the
      // blip up pins a stale marker on the map for the rest of the round.
      if (rp.dead) continue;
      out.push({ x: rp.x, z: rp.z, yaw: rp.yaw || 0, me: false, color: CFG.COLORS[(rp.colorIdx ?? 0) % 4], down: !!rp.down });
    }
    return out;
  }

  _computeSpeaking() {
    // up to 4 speaker names (Xbox 360 lobby style); net owns streams + ducking
    const names = this._speakingNames;
    names.length = 0;
    if (!this.net) return names;
    this.net.updateVoiceSpeaking();
    for (const [id, vs] of this.net.voiceStreams) {
      if (vs.speaking && !this.net.mutedPeers.has(id) && names.length < 4) names.push(this.remotePlayers.get(id)?.name || 'TEAMMATE');
    }
    return names;
  }

  multiplayerRosterRows() {
    const roster = [];
    const myId = this.player?.id || this.net?.myId || 'local';
    const localLobby = this.lobbyPlayers.find((entry) => entry.id === myId);
    roster.push({
      id: myId,
      name: this.player?.name || this.myName,
      persona: localLobby?.persona || PERSONAS[this.personaIdx]?.id || 'dempsey',
      c: this.myColor,
      points: this.player?.points || 0,
      micEnabled: !!this.net?.myStream && !this.net?.micMuted,
      speaking: !!this.net?.mySpeaking,
    });
    for (const [id, rp] of this.remotePlayers) {
      const lobby = this.lobbyPlayers.find((entry) => entry.id === id);
      const voice = this.net?.voiceStreams?.get(id);
      roster.push({
        id,
        name: rp.name || lobby?.name || 'Player',
        persona: lobby?.persona || PERSONAS[rp.personaIdx]?.id || 'dempsey',
        c: rp.colorIdx ?? lobby?.color ?? 0,
        points: rp.points || 0,
        micEnabled: !!voice && !this.net?.mutedPeers?.has(id),
        speaking: !!voice?.speaking && !this.net?.mutedPeers?.has(id),
      });
    }
    return roster;
  }

  setMicMuted(m) {
    this.micMuted = m;
    this.net?.setMicMuted(m);
  }

  scoreRows() {
    const rows = [{ name: this.player.name, c: this.myColor, kills: this.player.kills, downs: this.player.downs, revives: this.player.revives, points: this.player.points, down: this.player.down, dead: this.player.dead }];
    for (const [, rp] of this.remotePlayers) rows.push({ name: rp.name, c: rp.colorIdx, kills: rp.kills, downs: rp.downs, revives: rp.revives, points: rp.points, down: rp.down, dead: rp.dead });
    return rows;
  }

  /**
   * Second pass: the first-person weapon, on a cleared depth buffer with its
   * own camera. Runs inside the HDR target before any post pass, so the gun
   * still receives bloom, grain, grading and AA — but contributes nothing to
   * SSAO or the volumetric raymarch, which would otherwise see a wall of
   * geometry 5cm from the lens and darken the entire screen.
   */
  renderViewmodel(target) {
    const rig = this.weaponRig;
    if (!rig?.root || rig.rigHidden) return;
    const vc = this.viewCamera;
    vc.position.copy(this.camera.position);
    vc.quaternion.copy(this.camera.quaternion);
    // ADS pulls the viewmodel lens in, which is what makes irons feel like they
    // magnify slightly even on weapons with no optic.
    const ads = this.player?.adsT || 0;
    const wantFov = VIEWMODEL_FOV * (1 - ads * 0.22);
    if (Math.abs(vc.fov - wantFov) > 0.01) { vc.fov = wantFov; vc.updateProjectionMatrix(); }
    vc.updateMatrixWorld(true);

    this.renderer.setRenderTarget(target);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, vc);
  }

  /**
   * Put every viewmodel mesh on the viewmodel layer.
   *
   * This MUST run before anything is drawn. `WeaponRig.equip()` rebuilds the
   * weapon's meshes, and a fresh Object3D defaults to layer 0 — the world
   * layer. Re-tagging lazily inside the viewmodel pass meant that for exactly
   * one frame after every weapon swap the new meshes were still on layer 0
   * when the WORLD camera ran, so a full-detail gun was rendered at point
   * blank across the whole screen: the "weird flash" when changing guns.
   */
  _tagViewmodelLayer() {
    const rig = this.weaponRig;
    if (!rig?.root) return;
    if (this._vmCurrent === rig.current && this._vmCount === rig.root.children.length) return;
    this._vmCurrent = rig.current;
    this._vmCount = rig.root.children.length;
    rig.root.traverse((o) => { if (o.isLight) o.layers.enableAll(); else o.layers.set(LAYER_VIEWMODEL); });
  }

  render(dt = 1 / 60) {
    this._tagViewmodelLayer();
    // Half-rate shadow refresh (see the shadowMap.autoUpdate note in init).
    this._shadowFrame = ((this._shadowFrame || 0) + 1) & 1;
    this.renderer.shadowMap.needsUpdate = this._shadowFrame === 0;

    const fx = this.postfx;
    // Low quality deliberately skips the expensive fullscreen post stack, but
    // the first-person weapon is a separate camera/layer and still has to be
    // drawn after the world. Returning after the world pass made Auto-on-iGPU
    // hide the player's gun and hands entirely.
    if (!fx || !fx.enabled) {
      const prevAutoClear = this.renderer.autoClear;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      this.renderer.autoClear = false;
      try {
        this.renderViewmodel(null);
      } finally {
        this.renderer.autoClear = prevAutoClear;
        this.renderer.setRenderTarget(null);
      }
      return;
    }
    fx.exposure = (fx.baseExposure ?? 1) * this.exposureScale
      * clamp(Number(this.options.brightness ?? 1), 0.5, 1.6);
    fx.damage = this._postDamage || 0;
    fx.flash = this._postFlash || 0;
    // The post chain draws the world into an offscreen HDR target and only
    // unbinds it in its last statement. A throw anywhere in between therefore
    // leaves the renderer pointed at that target FOREVER: every later frame
    // lands offscreen and the canvas stays black even though the loop, the
    // netcode and the DOM HUD all keep running — which is exactly what a
    // "blank screen" / "frozen game" report looks like from the outside. One
    // bad material should cost a frame, not the session, so the unbind is
    // unconditional.
    try {
      fx.render(this.scene, this.camera, dt, this._drawViewmodel);
    } finally {
      this.renderer.setRenderTarget(null);
    }
  }

  setPaused(v) {
    if (this.paused === v) return;
    this.paused = v;
    this.netSend({ t: 'pause', on: v ? 1 : 0, pid: this.player?.id });
  }

  endMatchToLobby() {
    if (this.mode !== 'host') return false;
    const reason = 'The host ended the match — everyone returned to the lobby.';
    this.netSend({ t: 'return_lobby', reason });
    this.exit('lobby', reason);
    return true;
  }

  exit(destination = 'menu', message = '') {
    this.dispose();
    this.onExit?.(destination, message);
  }

  dispose() {
    try { this.net?.disableVoice(); } catch (e) {} // stops mic + detaches every voice element
    if (this.disposed) return;
    this.disposed = true;
    if (this.net) {
      this.net.onEvent = null;
      this.net.onSnap = null;
      this.net.onPlayerState = null;
      this.net.onPeerLeave = null;
    }
    cancelAnimationFrame(this._raf);
    clearInterval(this._watchdog);
    removeEventListener('resize', this._resize);
    this._visualViewport?.removeEventListener('resize', this._resize);
    audio.stopAllJingles();
    audio.stopAmbience();
    audio.stopMusicBox();
    audio.stopSong(); // Beauty of Annihilation must not outlive the match
    this._clearPapOutputWeapon();
    this.hud?.multiplayerRoster(false, []);
    this.houndFX?.dispose();
    this.lightPool?.dispose();
    this.postfx?.dispose();
    this.renderer?.dispose();
  }
}

function msgIsPlayerState(s) { return s && typeof s.x === 'number' && typeof s.yaw === 'number'; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let __dropId = 1;
function dropId(d) { if (!d.__nid) d.__nid = __dropId++; return d.__nid; }

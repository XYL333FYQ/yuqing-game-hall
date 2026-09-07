// Local player controller (FPS) + remote player avatar rendering.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp, damp, moveCircleWithColliders, textTexture } from './utils.js';
import { input, consumeMouse, isAimDown } from './input.js';
import { audio } from './audio.js';
import { platformSideBlocksAtFeet } from './map-layout.js';
import { buildPerkBottle, getStats } from './weapons.js';
import { PERK_DRINK_TIMELINE, perkDrinkPhase } from './gameplay-rules.js';

export class LocalPlayer {
  constructor(id, name, colorIdx, spawn) {
    this.id = id;
    this.name = name;
    this.colorIdx = colorIdx;
    this.x = spawn.x; this.z = spawn.z; this.y = 0;
    this.velY = 0; this.grounded = true; this._airOriginY = null;
    // View and movement both define yaw 0 as -Z (toward the courtyard from
    // the mainframe spawn). Keep the constructor aligned with respawns/init.
    this.yaw = 0; this.pitch = 0;
    this.hp = CFG.BASE_HP;
    this.maxHp = CFG.BASE_HP;
    this.down = false; this.dead = false;
    this.downEase = 0;          // 0 on your feet, 1 collapsed — eases the eye down
    this.bleedout = 0; this.selfReviveT = 0;
    this.selfReviveAvailable = false;
    this._stashedWeapons = null; this._stashedCur = 0;
    this.points = CFG.START_POINTS;
    this.kills = 0; this.downs = 0; this.revives = 0; this.headshots = 0;
    this.weapons = [{ id: 'm1911', pap: false, mag: 8, reserve: 80 }];
    this.cur = 0;
    this.grenades = 4; this.monkeys = 0; this.ownsMonkeys = false;
    this.perks = new Set();
    this.crouched = false;
    this.sprinting = false;
    this.stance = 0; // 0 stand, 1 crouch, 2 prone
    this.stanceY = 1; // lerped stance factor (1 = full height)
    this._stanceKeyT = 0;
    this.lastDamageT = -99;
    this.stepAcc = 0;
    this.fireCooldown = 0;
    this.reloadEnd = 0;
    this.switchCooldown = 0;
    this.meleeCooldown = 0;
    this.grenadeCooldown = 0;
    this.adsT = 0;
    this.recoilPitch = 0;
    this.spreadBloom = 0;
    this.alive = true;

    // ---- momentum-based movement ----
    // Movement used to be `position += direction * speed * dt`, which starts and
    // stops instantly and feels weightless. These carry actual velocity so the
    // body accelerates, keeps momentum into a slide, and settles on release.
    this.vx = 0; this.vz = 0;
    this.speed2D = 0;
    this.sliding = false;
    this.slideT = 0;
    this.slideCooldown = 0;
    this.slideDirX = 0; this.slideDirZ = 0;
    this.mantling = null;       // {t, dur, fromX/Y/Z, toX/Y/Z}
    this.landImpact = 0;        // set on touchdown, consumed by the camera rig
    this.fallSpeed = 0;
    this._coyote = 0;           // grace window for jumping just after a ledge
    this._jumpBuffer = 0;       // grace window for pressing jump just before landing
    this.surface = 'concrete';
  }

  get weapon() { return this.weapons[this.cur]; }
  get stats() { const w = this.weapon; return w ? getStats(w.id, w.pap) : null; }
  get maxHpNow() { return this.perks.has('jug') ? CFG.JUG_HP : CFG.BASE_HP; }
  get reloadMult() { return this.perks.has('speed') ? 0.5 : 1; }
  get rpmMult() { return this.perks.has('dtap') ? 1.33 : 1; }
  get eyeHeight() {
    const stand = CFG.EYE_HEIGHT * this.stanceY;
    // Collapsing used to be a one-frame cut from eye height to the floor, and
    // getting up the same cut in reverse. Riding the ease makes it read as the
    // body going down rather than as the camera being re-parented.
    return this.downEase > 0.0005 ? lerp(stand, 0.5, this.downEase) : stand;
  }
  get stanceTargetY() { return [1, 0.66, 0.3][this.stance]; }

  addPoints(n, doubleActive) {
    if (n > 0 && doubleActive) n *= 2;
    this.points = Math.max(0, this.points + n);
    return n;
  }
  spend(n) {
    if (this.points < n) return false;
    this.points -= n;
    return true;
  }

  giveWeapon(id, pap = false) {
    const s = getStats(id, pap);
    const slot = { id, pap, mag: s.mag, reserve: s.reserve };
    let idx;
    if (this.weapons.length < 2) idx = this.weapons.length === 0 ? 0 : 1;
    else idx = this.cur;
    this.weapons[idx] = slot;
    this.cur = idx; // auto-switch to the new weapon
    return slot;
  }

  refillAmmo() {
    // A Max Ammo must not top up the down pistol — being downed is supposed to
    // cost you something. The real loadout is stashed and refills on revive.
    if (this.down) return;
    for (const w of this.weapons) { const s = getStats(w.id, w.pap); w.reserve = s.reserve; }
    this.grenades = 4;
    if (this.ownsMonkeys) this.monkeys = 2;
  }

  damage(dmg, game) {
    if (game.godMode) return; // GOD MODE cheat
    if (this.down || this.dead) return;
    this.hp -= dmg;
    this.lastDamageT = game.time;
    audio.play('hurt');
    game.fx.damageFlash();
    game.fx.shake(0.35);
    if (this.hp <= 0) {
      this.hp = 0;
      this.goDown(game);
    }
  }

  goDown(game) {
    // Perks are lost at the down transition regardless of whether the player
    // is later revived, bleeds out, or respawns. Preserve only the already-
    // earned solo Quick Revive charge as down-state—not as an active perk.
    this.selfReviveAvailable = game.mode === 'solo'
      && this.perks.has('qr') && game.qrSelfRevives > 0;
    this.perks.clear();
    game.hud.setPerks(this.perks);
    this.down = true;
    this.downs++;
    this.bleedout = CFG.BLEEDOUT_TIME;
    this.selfReviveT = 0;
    // Park the body. update() returns early for the whole time you are down, so
    // every motion field keeps whatever value it held the instant you fell — and
    // the camera rig and the viewmodel read them every frame regardless. Going
    // down mid-sprint left the view bobbing through a full stride and the gun
    // walking for the entire bleedout, which reads as camera shake coming from a
    // body that is lying still.
    this.vx = 0; this.vz = 0;
    this.speed2D = 0;
    this.moving = false;
    this.sprinting = false;
    this.strafeInput = 0;
    this.landImpact = 0;
    // A slide interrupted by going down never reached its own exit, so it would
    // hold the rig's slide dip and bank — and keep the floor scraping under you.
    if (this.sliding) {
      this.sliding = false;
      this.slideCooldown = 0.55;
      this.onSlideEnd?.(false);
    }
    // You keep fighting from the floor, but only with the sidearm you started
    // the match with — not the Ray Gun you were holding a second ago. The real
    // loadout is stashed whole (slot objects included, so a weapon sitting in
    // the Pack-a-Punch survives) and comes back on revive.
    this._stashedWeapons = this.weapons;
    this._stashedCur = this.cur;
    this.weapons = [{ id: 'm1911', pap: false, mag: 8, reserve: 80 }];
    this.cur = 0;
    if (game) {
      // cancel any reload still in flight for the slot we just swapped out
      game._reloadToken = (game._reloadToken || 0) + 1;
      if (game.weaponRig) {
        game.weaponRig.papHide = false;
        game.weaponRig.equip('m1911', false);
      }
    }
    audio.play('down');
    game.onPlayerDown?.(this);
  }

  revive(full = false, game = null) {
    this.down = false;
    this.hp = full ? this.maxHpNow : this.maxHpNow;
    this.selfReviveAvailable = false;
    if (this._stashedWeapons?.length) {
      this.weapons = this._stashedWeapons;
      this.cur = Math.min(this._stashedCur || 0, this.weapons.length - 1);
    }
    this._stashedWeapons = null; this._stashedCur = 0;
    if (game) {
      game._reloadToken = (game._reloadToken || 0) + 1;
      if (game.weaponRig && this.weapon) {
        game.weaponRig.papHide = false;
        game.weaponRig.equip(this.weapon.id, !!this.weapon.pap);
      }
    }
    audio.play('revive');
  }

  die(game) {
    this.dead = true;
    this.down = false;
    // respawnSelf() rebuilds the loadout from scratch; drop the stash so a
    // revive that races the death cannot resurrect it.
    this._stashedWeapons = null; this._stashedCur = 0;
    game.onPlayerDead?.(this);
  }

  _activeMapColliders(game) {
    const feet = this.y + 0.02;
    const head = this.y + Math.max(0.5, CFG.PLAYER_HEIGHT * this.stanceY);
    const active = this._activeColliders || (this._activeColliders = []);
    active.length = 0;
    for (const c of game.map.colliders) {
      if (c.shootOk) continue;
      if (c.vault && !this.grounded) continue;
      if (c.y0 !== undefined && (c.y0 > head || c.y0 + c.h < feet)) continue;
      if (!platformSideBlocksAtFeet(c, feet, this._airOriginY ?? this.y)) continue;
      active.push(c);
    }
    return active;
  }

  _moveAndCollide(game, dx, dz) {
    [this.x, this.z] = moveCircleWithColliders(
      this.x, this.z, dx, dz, CFG.PLAYER_RADIUS, this._activeMapColliders(game),
    );
  }

  update(dt, game) {
    const opts = game.options;
    // Magazine capacity belongs to the exact base/PaP variant. Clamp before
    // input and firing so a stale asynchronous reload can never turn the base
    // three-shot DG-2 into its six-shot upgraded variant (or any other gun).
    if (this.weapon) {
      const cap = getStats(this.weapon.id, this.weapon.pap).mag;
      this.weapon.mag = clamp(Math.trunc(Number(this.weapon.mag) || 0), 0, cap);
    }
    // Collapse/stand-up ease. Runs before the down branch's early return so it
    // keeps settling while you are on the floor. Down is quicker than up: you
    // drop, then you have to push yourself back onto your feet.
    this.downEase = damp(this.downEase, this.down ? 1 : 0, this.down ? 11 : 7, dt);

    // --- look ---
    this.mdx = 0; this.mdy = 0;
    if (!this.down && !this.dead) {
      const [mdx, mdy] = consumeMouse();
      this.mdx = mdx; this.mdy = mdy;
      const sens = 0.0021 * opts.sensitivity * (this.adsT > 0.5 ? 0.7 : 1);
      this.yaw -= mdx * sens;
      this.pitch -= mdy * sens * (opts.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.45, 1.45);
      // recoil recovery
      this.pitch += this.recoilPitch * Math.min(1, dt * 8);
      this.recoilPitch = damp(this.recoilPitch, 0, 8, dt);
    }

    // --- regen ---
    if (!this.down && this.hp < this.maxHpNow && game.time - this.lastDamageT > CFG.REGEN_DELAY) {
      this.hp = Math.min(this.maxHpNow, this.hp + CFG.REGEN_RATE * dt);
    }

    // --- down / bleedout ---
    if (this.down) {
      this.bleedout -= dt;
      if (game.mode === 'solo' && this.selfReviveAvailable && game.qrSelfRevives > 0) {
        this.selfReviveT += dt;
        if (this.selfReviveT >= 8) {
          game.qrSelfRevives--;
          this.revive(true, game);
          game.hud.banner('REVIVED', '#7ec8e3');
          game.netSend({ t: 'revive_self', pid: this.id });
        }
      }
      if (this.bleedout <= 0) this.die(game);
      return; // no movement while down
    }
    if (this.dead) return;

    // --- ADS state ---
    const wantAds = isAimDown() && !this.reloading(game) && this.switchCooldown <= 0;
    this.adsT = damp(this.adsT, wantAds ? 1 : 0, 14, dt);

    // --- mantle: plays out as a scripted arc, ignoring normal movement ---
    if (this.mantling) {
      const m = this.mantling;
      m.t += dt;
      const k = clamp(m.t / m.dur, 0, 1);
      // Ease out on the vertical, ease in on the horizontal: you rise onto the
      // ledge first and are carried forward over it second.
      const kv = 1 - (1 - k) * (1 - k);
      const kh = k * k * (3 - 2 * k);
      this.x = m.fromX + (m.toX - m.fromX) * kh;
      this.z = m.fromZ + (m.toZ - m.fromZ) * kh;
      this.y = m.fromY + (m.toY - m.fromY) * kv;
      this.velY = 0; this.vx = 0; this.vz = 0;
      this.grounded = false;
      this.moving = true;
      if (k >= 1) {
        this.mantling = null;
        this.grounded = true;
        this._wasGrounded = true;
        this._airOriginY = null;
      }
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      this.switchCooldown = Math.max(0, this.switchCooldown - dt);
      this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
      this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
      return;
    }

    // --- move ---
    let fx = 0, fz = 0;
    if (input.keys['KeyW']) fz += 1;
    if (input.keys['KeyS']) fz -= 1;
    if (input.keys['KeyA']) fx -= 1;
    if (input.keys['KeyD']) fx += 1;
    const inputting = fx !== 0 || fz !== 0;
    this.strafeInput = fx;

    // --- slide: press crouch while sprinting. Checked on the key DOWN edge,
    // before the stance machine, so the slide starts the instant the key is
    // hit rather than waiting for release, and the same press never also
    // toggles crouch.
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    let slideStarted = false;
    if (input.pressed['KeyC'] && this.sprinting && this.grounded
      && this.slideCooldown <= 0 && this.speed2D > CFG.WALK_SPEED * 1.1) {
      this.sliding = true;
      this.slideT = 0;
      this.stance = 0;
      slideStarted = true;
      this._slideAtePress = true;
      const len = Math.hypot(this.vx, this.vz) || 1;
      this.slideDirX = this.vx / len; this.slideDirZ = this.vz / len;
      // Launch a little faster than the sprint that fed into it.
      const boost = CFG.SPRINT_SPEED * 1.28;
      this.vx = this.slideDirX * boost; this.vz = this.slideDirZ * boost;
      this.onSlideStart?.();
    }

    // Stance is LATCHED, the way it is in Call of Duty: tap crouch to toggle
    // crouch, hold it to drop prone, and stay prone until you deliberately get
    // up. Releasing the key must never stand you back up — the previous
    // behaviour popped you out of prone the instant you let go, which made
    // prone unusable as cover.
    //
    //   stand  --tap-->  crouch  --tap-->  stand
    //   any    --hold--> prone
    //   prone  --tap-->  crouch
    //   prone  --jump / sprint --> stand   (handled below)
    const stanceKey = !!input.keys['KeyC'];
    const stanceKeyHeld = stanceKey;   // read again when the slide ends, below
    const stanceTapped = !stanceKey && this._stanceKeyT > 0 && this._stanceKeyT <= 0.4;
    if (stanceKey) {
      this._stanceKeyT += dt;
      if (this._stanceKeyT > 0.4 && this.stance !== 2 && !this.sprinting && !this.sliding) {
        this.stance = 2;
        this._stanceKeyT = -999;   // consumed: the release must not also toggle
      }
    } else {
      if (stanceTapped && !this._slideAtePress) {
        this.stance = this.stance === 2 ? 1 : (this.stance === 0 ? 1 : 0);
      }
      this._stanceKeyT = 0;
      this._slideAtePress = false;
    }
    // Getting up: sprinting or jumping breaks prone, as it does in CoD.
    if (this.stance === 2 && (input.pressed['Space'] || (input.keys['ShiftLeft'] && fz > 0))) {
      this.stance = 0;
    }

    this.crouched = this.stance >= 1;
    this.stanceY = damp(this.stanceY, this.sliding ? 0.52 : this.stanceTargetY, 8, dt);
    const wantSprint = !!input.keys['ShiftLeft'] && fz > 0 && this.stance === 0 && this.adsT < 0.3 && !this.sliding;
    this.sprinting = wantSprint;
    const s = this.stats;
    let speed = this.sprinting ? CFG.SPRINT_SPEED : this.adsT > 0.5 ? CFG.ADS_SPEED : CFG.WALK_SPEED;
    speed *= s?.move ?? 1;
    if (this.stance === 1) speed *= 0.55;
    else if (this.stance === 2) speed *= 0.22;
    if (this.reloading(game) && this.sprinting) speed = CFG.WALK_SPEED; // can't sprint-reload

    if (this.sliding && !slideStarted) {
      this.slideT += dt;
      const stopped = Math.hypot(this.vx, this.vz) < CFG.WALK_SPEED * 0.55;
      if (this.slideT > 1.05 || stopped || !this.grounded || this.adsT > 0.5) {
        this.sliding = false;
        this.slideCooldown = 0.55;
        // Come out of it CROUCHED if the key is still down, standing if not.
        // A slide that always dumped you upright threw away the cover it just
        // bought you; one that always left you crouched fought the player.
        // Holding the key through the slide is the natural way to say which.
        if (stanceKeyHeld && this.stance === 0) {
          this.stance = 1;
          // Mark the hold as already spent. Without this the same uninterrupted
          // press keeps feeding the hold-to-prone timer and you slide straight
          // through crouch onto your face — you have to release and press again
          // to go prone, which is what the stance machine means everywhere else.
          this._stanceKeyT = -999;
        }
        this.onSlideEnd?.(this.stance === 1);
      }
    }

    // --- acceleration model ---
    // Ground: strong accel toward the wish velocity plus friction when idle.
    // Air: much weaker control, so a jump commits you to your trajectory.
    let wishX = 0, wishZ = 0;
    if (inputting && !this.sliding) {
      const len = Math.hypot(fx, fz);
      const nx = fx / len, nz = fz / len;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      wishX = (nx * cos - nz * sin) * speed;
      wishZ = (-nx * sin - nz * cos) * speed;
    }
    const accel = this.sliding ? 0 : (this.grounded ? 62 : 9);
    // Slide friction RAMPS. A flat 4.6 scrubbed 8.3 m/s down to walking pace in
    // a quarter of a second, so the slide was over before it read as one — the
    // camera dipped and you were already standing. Starting low and building
    // gives the launch its glide and still lands a definite scrubbing stop,
    // which is the shape of the move in the games this is imitating. Tuned so
    // a slide runs a little under a second and covers roughly five metres.
    const slideFriction = 0.5 + this.slideT * 0.9;
    const friction = this.sliding ? slideFriction : (this.grounded ? (inputting ? 0 : 15) : 0.35);
    if (accel > 0) {
      this.vx += (wishX - this.vx) * Math.min(1, accel * dt);
      this.vz += (wishZ - this.vz) * Math.min(1, accel * dt);
    } else if (this.sliding && inputting) {
      // A little steering authority. A slide with none is a rail you regret
      // committing to; full control makes it a free speed boost. This bends
      // the path without adding speed: the steer is applied perpendicular to
      // travel only, so you can curve around a corner but never accelerate.
      const len = Math.hypot(fx, fz);
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const wx = ((fx / len) * cos - (fz / len) * sin);
      const wz = (-(fx / len) * sin - (fz / len) * cos);
      const sp = Math.hypot(this.vx, this.vz) || 1;
      const dx = this.vx / sp, dz = this.vz / sp;
      const perpX = -dz, perpZ = dx;                     // left of travel
      const steer = (wx * perpX + wz * perpZ) * 5.2 * dt;
      this.vx += perpX * steer * sp;
      this.vz += perpZ * steer * sp;
      // Renormalise so curving never changes how fast the slide is going.
      const after = Math.hypot(this.vx, this.vz) || 1;
      this.vx *= sp / after; this.vz *= sp / after;
    }
    if (friction > 0) {
      const f = Math.max(0, 1 - friction * dt);
      this.vx *= f; this.vz *= f;
    }
    if (Math.abs(this.vx) < 0.01) this.vx = 0;
    if (Math.abs(this.vz) < 0.01) this.vz = 0;

    this.speed2D = Math.hypot(this.vx, this.vz);
    this.maxSpeed = Math.max(0.1, speed);
    this.moving = this.speed2D > 0.35;

    if (this.speed2D > 0) {
      // Swept/sub-stepped movement prevents sprinting through any thin wall,
      // closed paid door, or player-blocking window aperture between frames.
      const beforeX = this.x, beforeZ = this.z;
      this._moveAndCollide(game, this.vx * dt, this.vz * dt);
      // Colliders resolve the move; fold the correction back into velocity so
      // running into a wall bleeds momentum instead of pressing through it.
      if (dt > 1e-5) {
        this.vx = (this.x - beforeX) / dt;
        this.vz = (this.z - beforeZ) / dt;
        this.speed2D = Math.hypot(this.vx, this.vz);
      }
    }
    // Footsteps are driven by the camera rig's stride phase (see game.js), so
    // they land exactly on the visual footfall instead of on a separate timer.

    // jump & gravity (elevation-aware: floors, ramps, ledges)
    // tight 0.55 snap-up tolerance: you must actually step/jump onto platforms
    const fl = game.map.floorY(this.x, this.z, this.y, 0.55);
    this._coyote = this.grounded ? 0.12 : Math.max(0, this._coyote - dt);
    this._jumpBuffer = input.pressed['Space'] ? 0.16 : Math.max(0, this._jumpBuffer - dt);
    if (this._jumpBuffer > 0 && !this.crouched && !this.sliding) {
      const mantle = this._findMantle(game);
      if (mantle) {
        this._jumpBuffer = 0;
        this.mantling = mantle;
        this.onMantle?.();
      } else if (this._coyote > 0) {
        this._jumpBuffer = 0; this._coyote = 0;
        this._airOriginY = this.y;
        this.velY = CFG.JUMP_VEL;
        this.grounded = false;
      }
    }
    this.velY -= CFG.GRAVITY * dt;
    // stick to ground on stairs/ramps, but falls feel like falls (no moon-float)
    if (this._wasGrounded && this.velY < 0) this.velY = Math.max(this.velY, -9);
    this.fallSpeed = Math.max(this.fallSpeed, -this.velY);
    this.y += this.velY * dt;
    if (this.y <= fl + 0.001 && this.velY <= 0) {
      if (!this._wasGrounded) this.landImpact = this.fallSpeed;
      this.fallSpeed = 0;
      this.y = fl; this.velY = 0; this.grounded = true; this._airOriginY = null;
    } else {
      if (this._wasGrounded && this._airOriginY == null) this._airOriginY = this.y;
      this.grounded = false;
    }
    this._wasGrounded = this.grounded;

    // Preserve a known-good location before resolving movement. Geometry is
    // the primary boundary, while this room-union guard is the map-wide safety
    // net: a missed wall segment can never become an explorable exterior void.
    const safeX = game.map.roomAt(this.x, this.z, this.y) ? this.x : (this._safeMapX ?? this.x);
    const safeZ = game.map.roomAt(this.x, this.z, this.y) ? this.z : (this._safeMapZ ?? this.z);

    // Re-resolve after vertical movement because landing/crouching can activate
    // a collider that was outside the player's vertical span before gravity.
    this._moveAndCollide(game, 0, 0);
    const b = game.map.bounds;
    this.x = clamp(this.x, b.minX, b.maxX);
    this.z = clamp(this.z, b.minZ, b.maxZ);
    if (!game.map.roomAt(this.x, this.z, this.y)) {
      this.x = safeX;
      this.z = safeZ;
    }
    this._safeMapX = this.x;
    this._safeMapZ = this.z;

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.switchCooldown = Math.max(0, this.switchCooldown - dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
    this.spreadBloom = damp(this.spreadBloom, 0, 6, dt);
  }

  /**
   * Is there room for the player's whole body to stand at (x, z) with its feet
   * at `top`? Tested as the 0.35m circle the player actually is, against every
   * collider that spans the space they would occupy.
   */
  _standingClear(game, x, z, top, headroom) {
    for (const c of game.map.colliders) {
      if (c.shootOk) continue;
      const cx = clamp(x, c.minX, c.maxX);
      const cz = clamp(z, c.minZ, c.maxZ);
      if (Math.hypot(x - cx, z - cz) >= CFG.PLAYER_RADIUS) continue;
      // A collider with no vertical span is solid at every height.
      if (c.y0 === undefined) return false;
      // Below the feet is the surface being climbed onto, not an obstruction.
      if (c.y0 + c.h <= top + 0.12 || c.y0 >= top + headroom) continue;
      return false;
    }
    return true;
  }

  /**
   * Ledge detection for mantling. Looks a short step ahead for a surface
   * between shin and chest height that has standing room above it, and
   * returns a scripted arc onto it. Returns null when there is nothing to
   * climb, in which case the jump behaves normally.
   */
  _findMantle(game) {
    if (!this.grounded && this.velY < -1.5) return null;   // no mid-fall grabs
    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    const feet = this.y;
    const MIN_RISE = 0.55;      // below this the step-up handles it
    const MAX_RISE = 1.7;       // above this it is a wall, not a ledge
    const HEADROOM = 1.35;

    // Probe outward: the near probe finds the ledge face, the far probe
    // confirms there is actually a landing surface to stand on.
    for (const reach of [CFG.PLAYER_RADIUS + 0.45, CFG.PLAYER_RADIUS + 0.95]) {
      const tx = this.x + fwdX * reach;
      const tz = this.z + fwdZ * reach;
      // Ask for the floor as if we were already up there.
      const top = game.map.floorY(tx, tz, feet + MAX_RISE + 0.5, MAX_RISE + 0.6);
      const rise = top - feet;
      if (rise < MIN_RISE || rise > MAX_RISE) continue;

      if (!game.map.roomAt(tx, tz, top)) continue;

      // The mantle arc is scripted: it ignores collision for its whole
      // duration, so wherever it ends is wherever the player ends up. That
      // makes both checks below load-bearing.
      //
      // They used to be one point test at the PROBE, while the player was
      // actually set down 0.35m further along the same heading. A crate or
      // drum standing against a wall — which is exactly where the room dresser
      // puts them — gave a legal probe whose landing was 0.35m deeper, i.e.
      // inside 0.4m of brick, and the arc walked you straight into it. That is
      // the Generator Room wall by Teleporter A, and it moved between sessions
      // because the props that set it up are placed at random.
      //
      // A point test was also wrong on its own terms: the player is a 0.35m
      // circle, so a sample that threads between two colliders clears a gap the
      // body does not fit through.
      const landX = this.x + fwdX * (reach + 0.35);
      const landZ = this.z + fwdZ * (reach + 0.35);
      if (!game.map.roomAt(landX, landZ, top)) continue;
      if (!this._standingClear(game, tx, tz, top, HEADROOM)) continue;
      if (!this._standingClear(game, landX, landZ, top, HEADROOM)) continue;
      return {
        t: 0,
        dur: 0.34 + rise * 0.11,
        fromX: this.x, fromY: this.y, fromZ: this.z,
        toX: landX, toY: top, toZ: landZ,
      };
    }
    return null;
  }

  reloading(game) {
    return game.weaponRig.isReloading;
  }

  canFire(game) {
    // Firing while down is allowed on purpose — goDown() has already swapped
    // the loadout for the starting sidearm, so this can only ever be a pistol.
    return this.fireCooldown <= 0 && !this.reloading(game) && this.switchCooldown <= 0 && this.meleeCooldown <= 0 && !this.dead;
  }

  serialize() {
    return {
      id: this.id, name: this.name, c: this.colorIdx,
      x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100, z: Math.round(this.z * 100) / 100,
      yaw: Math.round(this.yaw * 1000) / 1000, pitch: Math.round(this.pitch * 1000) / 1000,
      hp: Math.round(this.hp), down: this.down ? 1 : 0, dead: this.dead ? 1 : 0,
      points: this.points, kills: this.kills, downs: this.downs, revives: this.revives,
      w: this.weapon ? this.weapon.id : 'm1911', pap: this.weapon?.pap ? 1 : 0,
      perks: [...this.perks], crouch: this.stance, sprint: this.sprinting ? 1 : 0,
      bleed: Math.round(this.bleedout),
    };
  }
}

// ---------------- remote avatar (animated soldier, CC0 rig, per-player uniform) ----------------
import { clone as skClone } from '../vendor/SkeletonUtils.js';
import { assets } from './assets.js';
import { measureStandingBounds, measureNeutralBounds } from './zombies.js';
import { buildDisplayWeapon } from './weapons.js';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';
import { humaniseSoldierFace, EYE_PATCH } from './render/SoldierFace.js';
import {
  attachSoldierGear, detachSoldierGear, setSoldierGearLOD,
  SOLDIER_LOOKS, HEAD_SCALE, HEAD_SHAPE, HAND_SCALE, FOOT_SCALE, LIMB_SHAPE, SPINE_FIX,
} from './render/SoldierGear.js';

// How tall a marine stands, measured on the skinned body with the head brought
// down to human proportion. Headgear is allowed above this.
const SOLDIER_HEIGHT = 1.78;
// Human band for the calibration post-condition below. Deliberately tighter
// than the zombies' [1.60, 2.00]: every marine is authored to one height, so
// any spread at all is a bug rather than variation.
const SOLDIER_MIN_H = 1.70;
const SOLDIER_MAX_H = 1.86;

/**
 * Recolour the shared corpse atlas into a living man.
 *
 * The body underneath the uniform is the shipped humanoid, so this is what
 * makes the face, neck and hands read as skin rather than as a green corpse.
 * Only the surfaces the uniform does not cover are actually seen, which is why
 * the skin branch gets all the care and the cloth branch just needs to be a
 * plausible dark undershirt.
 */
/**
 * Iris colour per persona. The four are meant to stay distinguishable at any
 * range, and this is the cheapest axis left: the silhouette work is done by the
 * headgear, the coat and the pack, so the eyes only have to avoid being four
 * copies of the same eye when someone is being revived at arm's length.
 * Deliberately muted — 1945, a dark map, and men who have not slept.
 */
const IRIS = {
  dempsey: 0x4e6f8a,      // pale cold blue
  nikolai: 0x6b4a29,      // warm brown
  takeo: 0x46331f,        // near-black brown
  richtofen: 0x74855e,    // washed-out hazel green
};

/**
 * Paint one eye into the atlas patch that SoldierFace re-mapped the sockets to.
 *
 * Everything here is in patch-normalised coordinates: (0,0) is the brow corner
 * nearest the nose, (1,1) the cheek corner nearest the temple. Both sockets
 * sample this one patch through |x|, so it is drawn as a right eye and the left
 * eye comes out mirrored, which is what a face does anyway.
 *
 * Restraint is the whole job. A wide bright eye on a low-poly head at 1945
 * light levels reads as a cartoon; what has to survive to 20 m is only this —
 * a socket that is darker than the cheek, a pale sliver inside it, and one dark
 * point in the middle of the sliver. The catchlight and the limbal ring are for
 * the two metres where somebody is bleeding out and you are stood over them.
 */
function paintSoldierEye(g, size, look, face) {
  const { u0, v0, u1, v1 } = EYE_PATCH;
  const x0 = u0 * size, y0 = v0 * size;
  const S = (u1 - u0) * size, T = (v1 - v0) * size;
  const px = (sx) => x0 + sx * S;
  const py = (sy) => y0 + sy * T;
  const css = (c, a) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;

  const mix = (a, b, t) => new THREE.Color().copy(a).lerp(b, t);
  const BLACK = new THREE.Color(0, 0, 0);
  const shadow = mix(face, BLACK, 0.62);
  const hair = new THREE.Color(look.hair);
  const lash = mix(hair, BLACK, 0.45);
  // Warm bone, never white: a white sclera on a face this dark reads as a doll.
  const sclera = mix(new THREE.Color(0xcdc6b8), face, 0.22);
  const iris = new THREE.Color(IRIS[look.id] ?? look.hair);

  // A margin of plain face tone around the patch, so that once the head is a
  // dozen pixels tall and the sampler is deep in the mip chain, what bleeds in
  // is cheek rather than the blank white the rest of this atlas is.
  g.fillStyle = css(face, 1);
  g.fillRect(x0 - S * 0.5, y0 - T * 0.5, S * 2, T * 2);

  g.save();
  g.beginPath(); g.rect(x0, y0, S, T); g.clip();

  // ---- the socket ---------------------------------------------------------
  // A recess, not a hole: the cheek tone dropped toward shadow, deepest just
  // under the brow where a real orbit is deepest.
  let grd = g.createRadialGradient(px(0.5), py(0.46), S * 0.06, px(0.5), py(0.5), S * 0.66);
  grd.addColorStop(0, css(shadow, 0.92));
  grd.addColorStop(0.62, css(shadow, 0.55));
  grd.addColorStop(1, css(shadow, 0));
  g.fillStyle = grd;
  g.fillRect(x0, y0, S, T);

  // ---- the brow -----------------------------------------------------------
  // The top of this swatch is brow ridge in the sculpt, so it is brow here.
  grd = g.createLinearGradient(0, py(0), 0, py(0.30));
  grd.addColorStop(0, css(hair, 0.96));
  grd.addColorStop(0.45, css(hair, 0.80));
  grd.addColorStop(1, css(hair, 0));
  g.fillStyle = grd;
  g.fillRect(x0, y0, S, T * 0.32);

  // ---- the eye opening ----------------------------------------------------
  const opening = () => {
    g.beginPath();
    g.moveTo(px(0.10), py(0.545));
    g.quadraticCurveTo(px(0.51), py(0.285), px(0.92), py(0.500));
    g.quadraticCurveTo(px(0.51), py(0.725), px(0.10), py(0.545));
    g.closePath();
  };

  opening();
  g.fillStyle = css(sclera, 1);
  g.fill();

  g.save();
  opening(); g.clip();

  // The upper lid throws a shadow across the top of the eyeball. Without it
  // the sclera reads as a flat sticker no matter how well the iris is drawn.
  grd = g.createLinearGradient(0, py(0.28), 0, py(0.62));
  grd.addColorStop(0, css(shadow, 0.85));
  grd.addColorStop(0.55, css(shadow, 0.22));
  grd.addColorStop(1, css(shadow, 0.05));
  g.fillStyle = grd;
  g.fillRect(x0, y0, S, T);
  // and a much fainter one off the lower lid
  grd = g.createLinearGradient(0, py(0.74), 0, py(0.60));
  grd.addColorStop(0, css(shadow, 0.45));
  grd.addColorStop(1, css(shadow, 0));
  g.fillStyle = grd;
  g.fillRect(x0, y0, S, T);

  // Iris: lighter toward the middle, so the limbal ring reads as a rim rather
  // than an outline drawn round a disc.
  const ix = px(0.50), iy = py(0.505), ir = S * 0.155;
  grd = g.createRadialGradient(ix, iy - ir * 0.22, ir * 0.12, ix, iy, ir);
  grd.addColorStop(0, css(mix(iris, new THREE.Color(0xffffff), 0.30), 1));
  grd.addColorStop(0.72, css(iris, 1));
  grd.addColorStop(1, css(mix(iris, BLACK, 0.55), 1));
  g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2);
  g.fillStyle = grd; g.fill();
  g.lineWidth = S * 0.014;
  g.strokeStyle = css(mix(iris, BLACK, 0.72), 0.9);
  g.stroke();

  g.beginPath(); g.arc(ix, iy, ir * 0.38, 0, Math.PI * 2);
  g.fillStyle = 'rgba(9,9,12,1)'; g.fill();

  // One catchlight, high and off to the nose side, matching a key light that
  // comes from above. Two would be a mistake; none reads as a corpse.
  grd = g.createRadialGradient(px(0.452), py(0.437), 0, px(0.452), py(0.437), S * 0.040);
  grd.addColorStop(0, 'rgba(255,255,250,0.92)');
  grd.addColorStop(0.55, 'rgba(255,255,250,0.45)');
  grd.addColorStop(1, 'rgba(255,255,250,0)');
  g.fillStyle = grd;
  g.fillRect(x0, y0, S, T);
  g.restore();

  // ---- lids ---------------------------------------------------------------
  // The lash line is what actually holds the eye in the socket at range: it is
  // the darkest thing on the face and it is exactly where the sculpt creases.
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(px(0.10), py(0.545));
  g.quadraticCurveTo(px(0.51), py(0.285), px(0.92), py(0.500));
  g.lineWidth = S * 0.055;
  g.strokeStyle = css(lash, 0.95);
  g.stroke();

  g.beginPath();
  g.moveTo(px(0.11), py(0.552));
  g.quadraticCurveTo(px(0.51), py(0.720), px(0.90), py(0.508));
  g.lineWidth = S * 0.022;
  g.strokeStyle = css(lash, 0.55);
  g.stroke();

  // The lid crease above, and the wet line of the lower lid below — both faint.
  g.beginPath();
  g.moveTo(px(0.14), py(0.455));
  g.quadraticCurveTo(px(0.52), py(0.215), px(0.90), py(0.420));
  g.lineWidth = S * 0.020;
  g.strokeStyle = css(shadow, 0.42);
  g.stroke();

  g.beginPath();
  g.moveTo(px(0.16), py(0.775));
  g.quadraticCurveTo(px(0.52), py(0.815), px(0.88), py(0.740));
  g.lineWidth = S * 0.018;
  g.strokeStyle = css(mix(face, new THREE.Color(0xffffff), 0.22), 0.30);
  g.stroke();

  g.restore();
}

const _atlasCache = new Map();
function soldierAtlas(variant) {
  const src = assets.models.zombie1;
  const srcTex = src?.scene?.getObjectByProperty('isSkinnedMesh', true)?.material?.map;
  if (!srcTex?.image) return null;
  const look = SOLDIER_LOOKS[variant % SOLDIER_LOOKS.length];
  if (_atlasCache.has(look.id)) return _atlasCache.get(look.id);
  const img = srcTex.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  const skin = new THREE.Color(look.skin);
  const hair = new THREE.Color(look.hair);
  const under = new THREE.Color(look.clothDark);
  const tmp = new THREE.Color();
  // The eye patch has to start from the exact tone the FACE ends up, or it
  // reads as a sticker pasted on the cheek. Rather than hardcode that tone,
  // count which skin-branch source colour covers the most of the atlas — that
  // is the face swatch by a wide margin — and run it through the same branch.
  const skinCount = new Map();
  let faceKey = -1, faceBest = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
    const lum = 0.3 * r + 0.55 * gg + 0.15 * b;
    if (gg > r * 1.12 && gg > b * 1.12) {
      // Corpse green is the skin channel. Keep its shading via luminance so
      // the sculpted brow, cheekbones and knuckles survive the recolour.
      const t = Math.min(1.2, lum * 2.05);
      tmp.copy(skin).multiplyScalar(0.58 + t * 0.52);
      const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      const n = (skinCount.get(key) || 0) + 1;
      skinCount.set(key, n);
      if (n > faceBest) { faceBest = n; faceKey = key; }
    } else if (lum > 0.78) {
      tmp.setRGB(1, 1, 1);                 // eyes and teeth stay white
    } else if (lum < 0.16) {
      tmp.copy(hair).multiplyScalar(0.7 + lum * 2.0);   // brows, lashes, scalp
    } else {
      tmp.copy(under).multiplyScalar(0.5 + lum * 1.5);  // undershirt
    }
    px[i] = tmp.r * 255; px[i + 1] = tmp.g * 255; px[i + 2] = tmp.b * 255;
  }
  g.putImageData(d, 0, 0);

  // Give him eyes. This is the last thing that happens to the canvas, so the
  // recolour above cannot walk over it, and it lands in a corner of the atlas
  // no vertex of the shipped model samples — the zombies go on sampling the
  // flat black texel their sockets have always sampled, which is right for
  // them. See js/render/SoldierFace.js for the UVs that reach this patch.
  if (faceKey >= 0 && c.width === c.height) {
    const fl = (0.3 * ((faceKey >> 16) & 255) + 0.55 * ((faceKey >> 8) & 255)
      + 0.15 * (faceKey & 255)) / 255;
    const face = new THREE.Color().copy(skin)
      .multiplyScalar(0.58 + Math.min(1.2, fl * 2.05) * 0.52);
    paintSoldierEye(g, c.width, look, face);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // GLTF convention
  _atlasCache.set(look.id, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// pose helpers
// ---------------------------------------------------------------------------

const _pv = new THREE.Vector3();
const _pv2 = new THREE.Vector3();
const _pv3 = new THREE.Vector3();
const _pq = new THREE.Quaternion();
const _pm = new THREE.Matrix4();
const _bx = new THREE.Vector3();
const _by = new THREE.Vector3();
const _bz = new THREE.Vector3();
const _wm = new THREE.Matrix4();

/**
 * Point a bone's own +Y axis (every joint in this rig runs +Y toward its child)
 * along a world direction, keeping the bone's +Z as close to `ref` as it can.
 * Writes the LOCAL quaternion, so the result still rides the parent.
 */
function aimBoneY(bone, dirWorld, ref) {
  _by.copy(dirWorld).normalize();
  _bz.copy(ref).addScaledVector(_by, -ref.dot(_by));
  if (_bz.lengthSq() < 1e-8) _bz.set(0, 0, 1).addScaledVector(_by, -_by.z);
  _bz.normalize();
  _bx.crossVectors(_by, _bz);
  _pm.makeBasis(_bx, _by, _bz);
  _pq.setFromRotationMatrix(_pm);
  bone.parent.updateWorldMatrix(true, false);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(_pq);
  bone.updateWorldMatrix(false, false);
}

/**
 * Two-bone IK, used ONCE at build time to derive the rifle-carry arm pose from
 * hand positions rather than from guessed Euler angles. Solving it means the
 * pose stays correct if the spine correction is ever retuned, which hand-typed
 * angles emphatically would not.
 */
function solveArm(upper, lower, hand, target, pole, lengths = null) {
  upper.updateWorldMatrix(true, false);
  const S = upper.getWorldPosition(new THREE.Vector3());
  const E0 = lower.getWorldPosition(new THREE.Vector3());
  const l1 = lengths ? lengths[0] : S.distanceTo(E0);
  const l2 = lengths ? lengths[1]
    : E0.distanceTo(hand.getWorldPosition(new THREE.Vector3()));
  if (l1 < 1e-4 || l2 < 1e-4) return;
  _pv.copy(target).sub(S);
  const d = clamp(_pv.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  _pv.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _pv2.copy(pole).sub(S);
  _pv2.addScaledVector(_pv, -_pv2.dot(_pv));
  if (_pv2.lengthSq() < 1e-8) _pv2.set(0, -1, 0).addScaledVector(_pv, -(-_pv.y));
  _pv2.normalize();
  const E = new THREE.Vector3().copy(S).addScaledVector(_pv, a).addScaledVector(_pv2, h);
  aimBoneY(upper, _pv3.copy(E).sub(S), _pv2);
  aimBoneY(lower, _pv3.copy(target).sub(E), _pv2);
}

/**
 * Collapse a built weapon into one mesh per material.
 *
 * The viewmodels are assembled from sixty-odd individually placed parts, which
 * is exactly right in the player's own hands — the rig animates the bolt, the
 * magazine, the charging handle. On a teammate across the room none of that
 * moves and none of it is legible, so it is sixty-odd draw calls for nothing:
 * three armed teammates cost more than the entire rest of the frame. Flattened
 * once at build time and cached, a held weapon costs a handful of calls.
 *
 * The muzzle anchor is re-created afterwards, because remote fire effects are
 * placed on it and it must survive the flatten.
 */
function flattenWeapon(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const muzzle = group.userData.muzzle;
  let muzzleLocal = null;
  if (muzzle) {
    muzzle.updateWorldMatrix(true, false);
    muzzleLocal = new THREE.Vector3().setFromMatrixPosition(muzzle.matrixWorld).applyMatrix4(inv);
  }
  const byMaterial = new Map();
  const keep = [];
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (Array.isArray(o.material)) { keep.push(o); return; }   // rare; leave alone
    const geo = o.geometry.clone();
    geo.applyMatrix4(_wm.multiplyMatrices(inv, o.matrixWorld));
    let list = byMaterial.get(o.material);
    if (!list) { list = []; byMaterial.set(o.material, list); }
    list.push(geo);
  });
  const out = new THREE.Group();
  out.userData = { ...group.userData };
  for (const [material, list] of byMaterial) {
    // mergeGeometries refuses a set whose attributes differ, so reduce every
    // member to the attributes they all share before merging.
    let common = null;
    for (const g of list) {
      const names = new Set(Object.keys(g.attributes));
      common = common ? new Set([...common].filter((n) => names.has(n))) : names;
    }
    for (const g of list) {
      for (const name of Object.keys(g.attributes)) if (!common.has(name)) g.deleteAttribute(name);
      if (g.index && !list.every((x) => x.index)) g.setIndex(null);
    }
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (list.length > 1) for (const g of list) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    out.add(mesh);
  }
  for (const o of keep) out.add(o);
  if (muzzleLocal) {
    const anchor = new THREE.Object3D();
    anchor.position.copy(muzzleLocal);
    out.add(anchor);
    out.userData.muzzle = anchor;
  }
  return out;
}

/** Rotate about the bone's own X axis, which is the world X axis at rest for
 *  every bone this is used on (the spine and the legs). */
function tiltX(bone, radians) {
  if (bone && radians) bone.rotateX(radians);
}

/**
 * How far the pelvis is lifted out of the shipped rig's permanent half-crouch,
 * in the skeleton's own root units (so it survives both height calibrations).
 * The legs are IK'd back down onto the clip's foot bones afterwards.
 */
const HIP_LIFT = 0.100;

/**
 * Leg proportions. The shipped rig is built to cartoon proportions — short
 * legs under a long broad torso, which is most of what reads as "toy soldier"
 * once the figure is standing upright.
 *
 * The thigh is lengthened by MOVING THE KNEE BONE, not by scaling it: a
 * non-uniform scale on a parent shears every rotated child below it, and the
 * knee is rotated in every frame of every locomotion clip. The ankle is then
 * dropped by the matching amount, and because the legs are IK'd onto the
 * ankles the shin follows and the foot still plants where the animator put it.
 */
const LEG_STRETCH = 1.45;       // multiplies the hip-to-knee bone offset
const FOOT_DROP = 0.190;        // root-space units the ankle is lowered by

const _footTarget = new THREE.Vector3();
const _kneePole = new THREE.Vector3();

/** The knuckle joints — scaling these scales the whole digit. */
const FINGER_ROOTS = [];
/** Every finger joint, both hands. Curled into a fist at build time. */
const FINGER_BONES = [];
for (const side of ['L', 'R']) {
  for (const digit of ['Index', 'Middle', 'Pinky', 'Thumb']) FINGER_ROOTS.push(`${digit}1${side}`);
  for (const digit of ['Index', 'Middle', 'Pinky']) {
    for (let j = 1; j <= 3; j++) FINGER_BONES.push(`${digit}${j}${side}`);
  }
  for (let j = 1; j <= 2; j++) FINGER_BONES.push(`Thumb${j}${side}`);
}

/** Every bone SoldierVisual writes to. Their pure clip rotations are cached
 *  each frame and put back before the next mixer update — see _applyRig. */
const POSED_BONES = [
  'Hips', 'Abdomen', 'Torso', 'Neck', 'Head',
  'UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR',
  'UpperArmL', 'UpperArmR', 'LowerArmL', 'LowerArmR',
  ...FINGER_BONES,
];

export class SoldierVisual {
  constructor(variant = 0, { gear = true } = {}) {
    const src = assets.models.zombie1;
    this.ok = false;
    this.variant = variant | 0;
    this.look = SOLDIER_LOOKS[this.variant % SOLDIER_LOOKS.length];
    this.group = new THREE.Group();
    this.inner = skClone(src.scene);
    // Close the mouth, bury the teeth, tuck the ears. Runs on a CLONE of the
    // geometry, so the horde keeps its scream — see js/render/SoldierFace.js.
    if (gear) humaniseSoldierFace(this.inner);
    this.group.add(this.inner);
    this.mixer = new THREE.AnimationMixer(this.inner);
    this.actions = {};
    for (const clip of src.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null;
    // Kept for callers that used to hide the old box rifle. The real weapon
    // now lives on `weaponGroup` and is only built when one is equipped.
    this.gun = null;
    this.aimPitch = 0;
    this.crouch = 0;
    this.armWeight = 1;
    this._armTarget = 1;
    this.lod = 0;

    const tex = soldierAtlas(this.variant);
    this.inner.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        o.material = o.material.clone();
        if (tex) { o.material.map = tex; o.material.color = new THREE.Color(0xffffff); }
        o.material.roughness = 0.92;
      }
    });

    // Pass one: normalise the shipped rig off a neutral standing pose. This
    // leaves the skeleton holding Idle, which is the pose the gear is fitted
    // against below.
    const m = measureStandingBounds(this.inner, this.mixer, this.actions.Idle || this.actions.Walk);
    if (!(m && m.h > 0.1)) return;
    const f = SOLDIER_HEIGHT / m.h;
    this.inner.scale.setScalar(f);
    this.inner.position.y -= m.minY * f;
    this.ok = true;

    this.bones = {};
    this.inner.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    // Segment lengths, measured on the untouched rig. The foot is an IK bone
    // parented to the root rather than to the shin, so the shin's length has
    // to be measured to it explicitly.
    this.legLengths = null;
    this._restKneeY = this.bones.LowerLegL ? this.bones.LowerLegL.position.y : null;

    // Straighten the shambler and bring the cartoon skull down to human
    // proportion BEFORE fitting anything, so the gear is measured against the
    // silhouette that will actually be on screen.
    this.group.updateMatrixWorld(true);
    this._applyRig(0, 1);
    this.inner.updateMatrixWorld(true);

    // The rifle-carry arm pose, solved from where the hands need to be rather
    // than authored as angles. Captured as local quaternions and blended in
    // every frame, so the legs keep running while the upper body holds a gun.
    this.armPose = null;
    if (gear) this._buildArmPose();

    // Pass two: the corrections above changed the standing height (a straighter
    // spine is taller, a human-sized head is shorter). Re-normalise so a marine
    // is 1.78 m whatever the corrections end up being.
    this.inner.updateMatrixWorld(true);
    const m2 = this._measureBody();
    if (m2 && m2.h > 0.1) {
      const f2 = SOLDIER_HEIGHT / m2.h;
      this.inner.scale.multiplyScalar(f2);
      this.inner.position.y = (this.inner.position.y - m2.minY) * f2;
      this.group.updateMatrixWorld(true);
      this.inner.updateMatrixWorld(true);
    }

    // Post-condition on the height, measured with the SHARED neutral sampler
    // rather than with _measureBody's world-space sweep.
    //
    // This exists because the two passes above cannot verify themselves.
    // _measureBody() double-applies the rig's transform (see the hazard note on
    // it), so its `h` is inflated by whatever scale pass one had already
    // applied, and pass two's multiplyScalar then divides that back out. The
    // two errors cancel and a marine does land at 1.78 m — but by cancellation,
    // not by construction, and nothing downstream would notice if they stopped
    // cancelling. This is the same shape of bug that shipped ground-riser
    // zombies at 2.4-2.8 m, silent until someone measured a horde.
    //
    // So: measure the finished rig on a ruler that is independent of both
    // passes, and if it is outside a human band, discard the compounded result
    // and derive the scale directly from the neutral height. That is a strictly
    // better fallback than the pair of factors that produced the failure.
    const check = measureNeutralBounds(this.inner, this.group);
    if (check) {
      const nativeH = check.max.y - check.min.y;
      const finalH = nativeH * this.inner.scale.y;
      if (nativeH > 0.1 && !(finalH >= SOLDIER_MIN_H && finalH <= SOLDIER_MAX_H)) {
        const s = clamp(SOLDIER_HEIGHT / nativeH, SOLDIER_MIN_H / nativeH, SOLDIER_MAX_H / nativeH);
        this.inner.scale.setScalar(s);
        this.inner.position.y = -check.min.y * s;
        this.group.updateMatrixWorld(true);
        this.inner.updateMatrixWorld(true);
        console.warn(`[soldier] calibration produced ${finalH.toFixed(2)}m; fell back to ${(nativeH * s).toFixed(2)}m`);
      }
    }

    // Leg segment lengths, measured LAST — after the height calibration above,
    // because that rescales the whole rig and the IK solves in world metres.
    // Measuring before it leaves the solver reaching for targets in the wrong
    // units, and the knees splay out sideways looking for them.
    if (this.bones.UpperLegL && this.bones.LowerLegL && this.bones.FootL) {
      const hip = this.bones.UpperLegL.getWorldPosition(new THREE.Vector3());
      const knee = this.bones.LowerLegL.getWorldPosition(new THREE.Vector3());
      const ankle = this.bones.FootL.getWorldPosition(new THREE.Vector3());
      this.legLengths = [hip.distanceTo(knee), knee.distanceTo(ankle)];
    }

    // Uniform, webbing, headgear — merged geometry parented to the bones that
    // already animate. See js/render/SoldierGear.js.
    this.gear = gear ? attachSoldierGear(this, this.variant) : null;

    // Where a held weapon hangs. Parented to the right forearm at the hand
    // joint, so it inherits the arm exactly and cannot drift off it.
    this._buildWeaponMount();
    this.mixer.stopAllAction();
    this.current = null;
  }

  /** Skinned-body bounds in group space, with the current corrections applied. */
  /**
   * HAZARD — this sweep is correct only by accident. Do not copy it.
   *
   * It measures skinned bounds straight into world space: getVertexPosition()
   * skins the vertex, and then matrixWorld is applied on top. Whether that is
   * a DOUBLE application of the ancestor chain depends on whether the rig's
   * transform is identity at the moment of the call, and it is silent when it
   * is. That exact pattern is what produced the giant-zombie bug: a ground
   * riser was measured while animate() had pitched the group up to 54 degrees,
   * the chain got squared, a folded body measured 0.70 m against a true 1.23 m,
   * and the resulting scale factor locked in permanently. 68 of 260 rigs came
   * out between 2.0 m and 2.85 m. See js/zombies.js, where measureNeutralBounds()
   * is the fixed sampler: it zeroes inner.position/scale AND the group's
   * position, scale and full QUATERNION (not just yaw) before sampling, so the
   * frame is genuinely identity and the second application is a no-op.
   *
   * Why this call site survives today: it runs inside the constructor, and both
   * the group and inner are still untouched at that point. But it is called at
   * pass TWO, after pass one has already done inner.scale.setScalar(f) — so it
   * is one stale updateMatrixWorld, or one reordering of these passes, away
   * from the same failure. It is load-bearing that nothing moves this call.
   *
   * The proper fix is to route this through the shared neutralising sampler
   * rather than keep a second copy of the sweep. That was deliberately NOT done
   * in the same pass that fixed the zombies, because SoldierGear.js fits its
   * merged gear against the calibration this produces, and changing the
   * calibration and the gear fitting simultaneously would make a regression in
   * either one impossible to attribute.
   */
  _measureBody() {
    const bb = new THREE.Box3();
    const v = new THREE.Vector3();
    let found = false;
    this.inner.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.skeleton?.update();
      const pos = o.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 600));
      for (let i = 0; i < pos.count; i += step) {
        o.getVertexPosition(i, v);
        v.applyMatrix4(o.matrixWorld);
        bb.expandByPoint(v);
      }
      found = true;
    });
    if (!found || bb.isEmpty()) return null;
    return { h: bb.max.y - bb.min.y, minY: bb.min.y };
  }

  _buildArmPose() {
    const B = this.bones;
    const need = ['UpperArmL', 'LowerArmL', 'Middle1L', 'UpperArmR', 'LowerArmR', 'Middle1R', 'Torso', 'Neck'];
    if (!need.every((n) => B[n])) return;
    B.Torso.updateWorldMatrix(true, false);
    const chest = B.Neck.getWorldPosition(new THREE.Vector3());
    // Both hands forward of the chest, right on the grip and left across on
    // the fore-end — the low-ready every rifleman in the period photographs
    // stands in, and the pose the weapon mount below is aligned to.
    const rightHand = new THREE.Vector3(chest.x - 0.17, chest.y - 0.30, chest.z + 0.20);
    const leftHand = new THREE.Vector3(chest.x + 0.06, chest.y - 0.24, chest.z + 0.40);
    const poleR = new THREE.Vector3(chest.x - 0.62, chest.y - 0.72, chest.z - 0.10);
    const poleL = new THREE.Vector3(chest.x + 0.62, chest.y - 0.68, chest.z - 0.10);
    solveArm(B.UpperArmR, B.LowerArmR, B.Middle1R, rightHand, poleR);
    solveArm(B.UpperArmL, B.LowerArmL, B.Middle1L, leftHand, poleL);
    this.armPose = {
      UpperArmR: B.UpperArmR.quaternion.clone(),
      LowerArmR: B.LowerArmR.quaternion.clone(),
      UpperArmL: B.UpperArmL.quaternion.clone(),
      LowerArmL: B.LowerArmL.quaternion.clone(),
    };
    // Close the hands. The shipped rig's fingers are splayed open like claws,
    // which is right for a corpse reaching for you and completely wrong for a
    // man holding a rifle — it was the single loudest remaining zombie tell.
    // Curling them costs nothing: the finger bones are already in the rig.
    for (const s of ['L', 'R']) {
      for (const digit of ['Index', 'Middle', 'Pinky']) {
        for (let j = 1; j <= 3; j++) {
          const bone = B[`${digit}${j}${s}`];
          if (bone) bone.rotateX(j === 1 ? 1.05 : 1.25);
        }
      }
      for (let j = 1; j <= 2; j++) {
        const bone = B[`Thumb${j}${s}`];
        if (bone) bone.rotateX(j === 1 ? 0.45 : 0.75);
      }
    }
    this.handPose = {};
    for (const name of FINGER_BONES) {
      if (B[name]) this.handPose[name] = B[name].quaternion.clone();
    }
  }

  _buildWeaponMount() {
    const fore = this.bones?.LowerArmR;
    const hand = this.bones?.Middle1R;
    if (!fore || !hand) return;
    const anchor = new THREE.Object3D();
    anchor.position.copy(hand.position);       // the hand joint, in forearm space
    fore.updateWorldMatrix(true, false);
    // The viewmodels are authored with the bore down -Z; the avatar faces +Z.
    const want = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    anchor.quaternion.copy(fore.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(want);
    fore.add(anchor);
    // A separate node carries aim pitch, so the weapon can lead the spine
    // without the spine correction having to fight it.
    const pitchNode = new THREE.Object3D();
    anchor.add(pitchNode);
    this.weaponAnchor = anchor;
    this.weaponPitch = pitchNode;
    this.weaponGroup = null;
    this.weaponId = null;
    this.weaponPap = null;
    this.muzzle = null;
  }

  /**
   * Show the weapon the player is actually carrying.
   *
   * Uses buildDisplayWeapon, which is the hands-free build — a viewmodel would
   * drag first-person gloves into the world and put a second pair of hands on
   * every teammate. Cached per id+PaP so swapping back and forth is free.
   */
  setWeapon(id, pap = false) {
    if (!this.weaponPitch) return;
    if (this.weaponId === id && this.weaponPap === !!pap) return;
    if (this.weaponGroup) this.weaponPitch.remove(this.weaponGroup);
    this.weaponId = id;
    this.weaponPap = !!pap;
    this.muzzle = null;
    this.weaponGroup = null;
    if (!id) return;
    this._weaponCache = this._weaponCache || new Map();
    const key = id + (pap ? '+' : '');
    let g = this._weaponCache.get(key);
    if (!g) {
      try { g = buildDisplayWeapon(id, !!pap); } catch (e) { g = null; }
      if (!g) return;
      // buildDisplayWeapon presents the gun broadside on a rack. Undo that:
      // held weapons want their own authored metres and their own axes.
      const view = g.userData.viewNode;
      if (view) { view.position.set(0, 0, 0); view.rotation.set(0, 0, 0); view.scale.setScalar(1); }
      g = flattenWeapon(g);
      // Sit the grip in the fist. Authored viewmodels put the trigger group
      // near the origin, so the offset is small and the same for every class;
      // the long guns only need dropping a little to clear the forearm.
      // The anchor's +Z runs backwards in world (the weapon's bore is -Z and
      // the avatar faces +Z), so a positive `back` pulls the gun in toward the
      // body. Long guns need more of it than a pistol to keep the receiver in
      // the fist rather than out past the fingertips.
      const cls = g.userData.cls || 'rifle';
      const drop = cls === 'pistol' ? -0.005 : -0.02;
      const back = cls === 'pistol' ? 0.0 : 0.15;
      g.position.set(0, drop, back);
      this._weaponCache.set(key, g);
    }
    if (g.parent) g.parent.remove(g);
    this.weaponPitch.add(g);
    this.weaponGroup = g;
    this.muzzle = g.userData?.muzzle || null;
  }

  /** World position of the equipped weapon's muzzle, for remote fire effects. */
  muzzleWorld(out = new THREE.Vector3()) {
    if (this.muzzle) {
      this.muzzle.updateWorldMatrix(true, false);
      return out.setFromMatrixPosition(this.muzzle.matrixWorld);
    }
    if (this.weaponAnchor) {
      this.weaponAnchor.updateWorldMatrix(true, false);
      return out.setFromMatrixPosition(this.weaponAnchor.matrixWorld);
    }
    return out.set(0, 0, 0);
  }

  /** Aim pitch in radians, positive looking up. */
  setAim(pitch) { this.aimPitch = clamp(pitch || 0, -1.3, 1.3); }

  /** 0 stand, 1 crouch, 2 prone. Blended, not snapped, by the caller. */
  setCrouch(amount) { this.crouch = clamp(amount || 0, 0, 1); }

  /**
   * Distance LOD. A teammate across the courtyard does not need his puttees.
   */
  setLOD(distance) {
    const level = distance > 34 ? 2 : distance > 15 ? 1 : 0;
    if (level === this.lod) return;
    this.lod = level;
    setSoldierGearLOD(this.gear, level);
    if (this.weaponGroup) this.weaponGroup.visible = level < 2;
  }

  play(name, { loop = true, fade = 0.18, timeScale = 1 } = {}) {
    const a = this.actions[name];
    if (!a) return;
    if (this.current === name) { a.timeScale = timeScale; return; }
    const prev = this.current ? this.actions[this.current] : null;
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
    a.clampWhenFinished = !loop;
    a.timeScale = timeScale;
    if (prev && prev !== a) a.crossFadeFrom(prev, fade, false);
    a.play();
    this.current = name;
    // The carry pose is a lie during a death, a crawl or a melee — those clips
    // need their arms. Everything else keeps the rifle up.
    this._armTarget = /Death|Crawl|HitReact|Punch|Wave|Jump/.test(name) ? 0 : 1;
  }

  /**
   * Re-apply every correction the animation overwrote.
   *
   * THE TRAP: it is not enough that every clip here keys every bone.
   * three's PropertyMixer only writes a bone when the value it just
   * accumulated differs from the value it wrote last time. Post-multiply an
   * offset onto a bone whose clip value happens to be momentarily still — the
   * chest during an idle, say — and the mixer sees "no change", skips the
   * write, and the offset lands on top of the previous frame's offset. Within
   * a couple of seconds the spine has rolled through 180 degrees.
   *
   * So the pure clip pose is snapshotted here and restored in update() before
   * the mixer next runs. That keeps the mixer's change detection honest while
   * still letting the clip drive every one of these bones.
   */
  _applyRig(dt, armWeight) {
    const B = this.bones;
    if (!B) return;
    const clip = this._clipQ || (this._clipQ = {});
    for (const name of POSED_BONES) {
      const b = B[name];
      if (!b) continue;
      (clip[name] || (clip[name] = new THREE.Quaternion())).copy(b.quaternion);
    }
    // The pelvis carries root motion, so its position is cached and restored
    // for exactly the same reason the rotations are.
    // Ankles are keyed by the locomotion clips, so their offsets are cached and
    // restored exactly like the rotations are.
    for (const s of ['L', 'R']) {
      const foot = B['Foot' + s];
      if (!foot) continue;
      (this._clipFootY ??= {})[s] = foot.position.y;
      foot.position.y -= FOOT_DROP;
    }
    // The knee offset is a constant set, so it cannot accumulate whether the
    // mixer writes it or not.
    if (this._restKneeY) {
      for (const s of ['L', 'R']) {
        const knee = B['LowerLeg' + s];
        if (knee) knee.position.y = this._restKneeY * LEG_STRETCH;
      }
    }
    if (B.Body) {
      (this._clipBodyY ??= { y: 0 }).y = B.Body.position.y;
      // Stand him up out of the corpse's permanent half-crouch. The legs are
      // then IK'd back down onto the clip's own footfalls below, so the feet
      // still land where the animator put them — they just do it on straighter
      // legs, which is most of the difference between a marine and a gnome.
      B.Body.position.y += HIP_LIFT;
    }
    if (B.Head) B.Head.scale.set(HEAD_SCALE * HEAD_SHAPE[0], HEAD_SCALE * HEAD_SHAPE[1], HEAD_SCALE * HEAD_SHAPE[2]);
    for (const name in LIMB_SHAPE) {
      const b = B[name];
      if (b) b.scale.set(LIMB_SHAPE[name][0], LIMB_SHAPE[name][1], LIMB_SHAPE[name][2]);
    }
    for (const name of FINGER_ROOTS) {
      const b = B[name];
      if (b) b.scale.setScalar(HAND_SCALE);
    }
    // The tongue is its own five-bone chain and it hangs out of the mouth. No
    // amount of reshaping the head geometry touches it, and a marine with his
    // tongue lolling is not a marine. Collapsing the root collapses the chain.
    if (B.Tongue1) B.Tongue1.scale.setScalar(0.001);
    for (const s of ['L', 'R']) {
      const foot = B['Foot' + s];
      if (foot) foot.scale.setScalar(FOOT_SCALE);
    }
    // Posture: undo the shamble.
    tiltX(B.Abdomen, SPINE_FIX.Abdomen);
    tiltX(B.Torso, SPINE_FIX.Torso);
    tiltX(B.Neck, SPINE_FIX.Neck);
    tiltX(B.Head, SPINE_FIX.Head);
    // Aim: a teammate shooting at the catwalk should visibly be looking up.
    // Split down the chain so the whole upper body leads the shot.
    const p = this.aimPitch;
    if (p) {
      tiltX(B.Abdomen, -p * 0.10);
      tiltX(B.Torso, -p * 0.32);
      tiltX(B.Neck, -p * 0.30);
      tiltX(B.Head, -p * 0.28);
    }
    // Crouch: bend at the hip and knee rather than squashing the model, which
    // is what the old scale.y trick did and why crouching teammates looked
    // like they were being stood on.
    const c = this.crouch;
    if (c > 0.01) {
      tiltX(B.Hips, c * 0.30);
      tiltX(B.Torso, -c * 0.16);
      for (const s of ['L', 'R']) {
        tiltX(B['UpperLeg' + s], c * 0.55);
        tiltX(B['LowerLeg' + s], -c * 0.95);
      }
    }
    // Rifle carry, blended so a dying man drops his arms.
    if (this.armPose && armWeight > 0.001) {
      for (const name in this.armPose) {
        const bone = B[name];
        if (bone) bone.quaternion.slerp(this.armPose[name], armWeight);
      }
    }
    // Fists stay closed a little longer than the arms do — a hand only opens
    // when he is genuinely letting go.
    if (this.handPose) {
      const w = Math.max(armWeight, 0.55);
      for (const name in this.handPose) {
        const bone = B[name];
        if (bone) bone.quaternion.slerp(this.handPose[name], w);
      }
    }
    // Legs last: the hips have moved, so re-solve knee and ankle to put the
    // feet back exactly where the clip's own foot bones are. Skipped while
    // crawling or dead, where the clip owns the whole body.
    if (this.legLengths && armWeight > 0.5) {
      this.inner.updateMatrixWorld(true);
      for (const s of ['L', 'R']) {
        const upper = B['UpperLeg' + s], lower = B['LowerLeg' + s], foot = B['Foot' + s];
        if (!upper || !lower || !foot) continue;
        foot.updateWorldMatrix(true, false);
        _footTarget.setFromMatrixPosition(foot.matrixWorld);
        upper.updateWorldMatrix(true, false);
        // Knees point forward, always. Without a pole the solver is free to
        // fold the leg sideways and occasionally does.
        _kneePole.setFromMatrixPosition(upper.matrixWorld);
        _kneePole.z += 2.0;
        _kneePole.y -= 0.6;
        solveArm(upper, lower, null, _footTarget, _kneePole, this.legLengths);
      }
    }
    // The weapon leads the rest of the aim the spine did not take.
    if (this.weaponPitch) this.weaponPitch.rotation.x = this.aimPitch * 0.30 * armWeight;
  }

  update(dt) {
    // Hand the skeleton back exactly as the clip left it, then animate, then
    // re-pose. See _applyRig for why the restore is not optional.
    const clip = this._clipQ;
    if (clip) {
      for (const name in clip) {
        const b = this.bones[name];
        if (b) b.quaternion.copy(clip[name]);
      }
    }
    if (this._clipBodyY && this.bones.Body) this.bones.Body.position.y = this._clipBodyY.y;
    if (this._clipFootY) {
      for (const s of ['L', 'R']) {
        const foot = this.bones['Foot' + s];
        if (foot) foot.position.y = this._clipFootY[s];
      }
    }
    this.mixer.update(dt);
    this.armWeight = damp(this.armWeight, this._armTarget, 9, dt || 0.016);
    this._applyRig(dt, this.armWeight);
  }

  dispose() {
    detachSoldierGear(this.gear);
    this.gear = null;
    if (this.weaponGroup) this.weaponPitch?.remove(this.weaponGroup);
    for (const g of this._weaponCache?.values() || []) {
      g.traverse((o) => { if (o.isMesh) { o.geometry?.dispose?.(); } });
    }
    this._weaponCache = null;
    this.weaponGroup = null;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.inner);
  }
}

export class RemotePlayer {
  constructor(scene, info) {
    this.id = info.id;
    this.name = info.name;
    this.colorIdx = info.c || 0;
    this.personaIdx = (info.persona >= 0 ? info.persona : this.colorIdx);
    const g = new THREE.Group();
    this.visual = null;
    try {
      if (assets.models.zombie1) {
        this.visual = new SoldierVisual(this.personaIdx);
        if (this.visual.ok) g.add(this.visual.group);
        else this.visual = null;
      }
    } catch (e) { this.visual = null; }
    if (!this.visual) {
      // fallback: minimal capsule figure
      const mat = new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.95 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.1, 0.26), mat); torso.position.y = 0.95;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), new THREE.MeshStandardMaterial({ color: 0xc9a486 })); head.position.y = 1.62;
      g.add(torso, head);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    // name tag (small, subtle)
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(info.name, { w: 256, h: 64, bg: 'rgba(0,0,0,0)', fg: CFG.COLORS[this.colorIdx % 4], font: 'bold 34px Arial' }), transparent: true, depthTest: false, opacity: 0.85 }));
    tag.scale.set(1.15, 0.29, 1);
    tag.position.y = 2.1;
    g.add(tag);
    this.group = g;
    this.x = info.x || 0; this.z = info.z || 0; this.y = 0; this.yaw = 0; this.pitch = 0;
    this.prev = null; this.next = null;
    this.down = false; this.dead = false;
    this.anim = 0; this.speed = 0;
    this.hp = 100; this.points = 500; this.kills = 0; this.downs = 0; this.revives = 0;
    this.perks = []; this.weaponId = 'm1911'; this.weaponPap = false; this.bowie = false;
    // On the host this is the authoritative remote loadout. Unreliable player
    // snapshots may choose movement/cosmetics, but never add weapons or PaP.
    this.ownedWeapons = new Map([['m1911', false]]);
    this.bleed = 0; this.crouch = 0; this.sprint = 0;
    this.perkDrink = null;
    scene.add(g);
  }

  startPerkDrink(perkId) {
    if (this.perkDrink) return false;
    const bottle = buildPerkBottle(perkId);
    // Raise-start pose before the first render: an unposed bottle sits at the
    // actor's origin, so it pops from between their boots on frame one.
    bottle.position.set(0.34, 0.7, -0.1);
    bottle.rotation.set(0, 0, -0.25);
    this.group.add(bottle);
    this.perkDrink = { id: perkId, bottle, elapsed: 0, broke: false, belched: false };
    audio.play('drink', { pos: { x: this.x, y: this.y + 1.5, z: this.z } });
    return true;
  }

  setAuthoritativeLoadout(loadout) {
    const entries = Array.isArray(loadout) ? loadout.slice(0, 2) : [];
    this.ownedWeapons = new Map(entries
      .filter((weapon) => weapon && typeof weapon.id === 'string')
      .map((weapon) => [weapon.id, !!weapon.pap]));
    if (!this.ownedWeapons.size) this.ownedWeapons.set('m1911', false);
    const first = this.ownedWeapons.entries().next().value;
    this.weaponId = first[0];
    this.weaponPap = first[1];
  }

  authorizeWeapon(id, pap = false, replaceCurrent = true) {
    if (typeof id !== 'string') return false;
    if (!this.ownedWeapons.has(id) && this.ownedWeapons.size >= 2 && replaceCurrent) {
      this.ownedWeapons.delete(this.weaponId);
    }
    this.ownedWeapons.set(id, !!pap);
    this.weaponId = id;
    this.weaponPap = !!pap;
    return true;
  }

  equipAuthorizedWeapon(id) {
    if (!this.ownedWeapons.has(id)) return false;
    this.weaponId = id;
    this.weaponPap = !!this.ownedWeapons.get(id);
    return true;
  }

  updatePerkDrink(dt) {
    const drink = this.perkDrink;
    if (!drink) return;
    drink.elapsed += dt;
    const t = drink.elapsed, b = drink.bottle, phase = perkDrinkPhase(t);
    const ease = (v) => { const x = clamp(v, 0, 1); return x * x * (3 - 2 * x); };
    if (phase === 'raise') {
      const q = ease(t / PERK_DRINK_TIMELINE.raiseEnd);
      b.position.set(lerp(0.34, 0.12, q), lerp(0.7, 1.56, q), lerp(-0.1, 0.04, q));
      b.rotation.set(lerp(0, 1.15, q), 0, lerp(-0.25, 0.1, q));
    } else if (phase === 'drink') {
      const q = (t - PERK_DRINK_TIMELINE.raiseEnd) / (PERK_DRINK_TIMELINE.gulpEnd - PERK_DRINK_TIMELINE.raiseEnd);
      b.position.set(0.12, 1.56 + Math.sin(q * 14) * 0.015, 0.04);
      b.rotation.set(1.15 + Math.sin(q * Math.PI) * 0.18, 0, 0.1);
    } else if (phase === 'lower') {
      const q = ease((t - PERK_DRINK_TIMELINE.gulpEnd) / (PERK_DRINK_TIMELINE.throwAt - PERK_DRINK_TIMELINE.gulpEnd));
      b.position.set(lerp(0.12, 0.45, q), lerp(1.56, 1.05, q), lerp(0.04, 0.24, q));
      b.rotation.set(lerp(1.15, 0, q), 0, lerp(0.1, -0.4, q));
    } else if (phase === 'throw') {
      const q = (t - PERK_DRINK_TIMELINE.throwAt) / (PERK_DRINK_TIMELINE.breakAt - PERK_DRINK_TIMELINE.throwAt);
      b.position.set(0.45 + q * 0.8, 1.05 + q * 0.35 - q * q * 1.25, 0.24 + q * 0.65);
      b.rotation.set(q * 8, q * 5, -0.4 - q * 4);
    } else b.visible = false;
    if (!drink.broke && t >= PERK_DRINK_TIMELINE.breakAt) {
      drink.broke = true;
      const pos = b.getWorldPosition(new THREE.Vector3());
      audio.play('bottle_break', { pos });
    }
    if (!drink.belched && t >= PERK_DRINK_TIMELINE.belchAt) {
      drink.belched = true;
      audio.play('belch', { pos: { x: this.x, y: this.y + 1.55, z: this.z } });
    }
    if (t >= PERK_DRINK_TIMELINE.duration) {
      this.group.remove(b);
      this.perkDrink = null;
    }
  }

  applyState(s, now) {
    if (!this.next) {
      this.prev = { x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, t: now };
      this.next = { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, t: now + (window.__snapInterval || 66) / 1000 };
    } else {
      const prev = this.prev;
      prev.x = this.next.x; prev.y = this.next.y; prev.z = this.next.z;
      prev.yaw = this.next.yaw; prev.pitch = this.next.pitch; prev.t = this.next.t;
      this.next.x = s.x; this.next.y = s.y; this.next.z = s.z;
      this.next.yaw = s.yaw; this.next.pitch = s.pitch;
      this.next.t = now + (window.__snapInterval || 66) / 1000;
    }
    this.down = !!s.down; this.dead = !!s.dead;
    this.hp = s.hp; this.points = s.points; this.kills = s.kills; this.downs = s.downs; this.revives = s.revives;
    this.perks = s.perks || []; this.weaponId = s.w; this.weaponPap = !!s.pap; this.bleed = s.bleed;
    this.crouch = s.crouch; this.sprint = s.sprint;
    this.name = s.name; this.colorIdx = s.c;
  }

  interpolate(now, dt, camera) {
    const step = dt || 0.016;
    if (this.prev && this.next) {
      const span = Math.max(1e-3, this.next.t - this.prev.t);
      const t = clamp((now - this.prev.t) / span, 0, 1);
      this.x = lerp(this.prev.x, this.next.x, t);
      this.y = lerp(this.prev.y, this.next.y, t);
      this.z = lerp(this.prev.z, this.next.z, t);
      let dy = this.next.yaw - this.prev.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw = this.prev.yaw + dy * t;
      this.pitch = lerp(this.prev.pitch, this.next.pitch, t);
      const moved = Math.hypot(this.next.x - this.prev.x, this.next.z - this.prev.z);
      this.speed = lerp(this.speed, clamp(moved / Math.max(1e-3, span), 0, 8), 0.3);
      if (moved > 0.002) this.anim += step * (this.sprint ? 10 : 6);
    }
    const g = this.group;
    g.position.set(this.x, this.y, this.z);
    g.rotation.y = this.yaw + Math.PI; // model faces +z; forward is -z at yaw 0
    this.updatePerkDrink(step);
    const stance = this.crouch | 0;
    if (!this.visual) {
      if (this.down || this.dead) {
        g.rotation.x = 0;
        g.position.y = this.y - 0.9;
        g.rotation.z = 1.4;
      } else {
        g.rotation.z = 0;
        g.position.y = this.y - (this.crouch ? 0.5 : 0);
      }
      return;
    }

    const v = this.visual;
    // Show what he is actually carrying. `w`/`pap` come straight off the wire,
    // so host and guest resolve the same weapon from the same field.
    v.setWeapon(this.weaponId, this.weaponPap);
    // Aim and stance are transmitted and were previously thrown away. Damped,
    // never snapped, because snapshots land at 15 Hz and the eye reads a jump
    // in a head or a barrel instantly.
    this._aim = damp(this._aim ?? 0, this.down || this.dead ? 0 : this.pitch, 12, step);
    this._crouchBlend = damp(this._crouchBlend ?? 0, this.down || this.dead ? 0 : (stance >= 1 ? 1 : 0), 8, step);
    v.setAim(this._aim);
    v.setCrouch(this._crouchBlend);
    if (camera) {
      v.setLOD(Math.hypot(camera.position.x - this.x, camera.position.y - this.y, camera.position.z - this.z));
    }

    if (this.dead) {
      v.play('Death', { loop: false, fade: 0.12 });
    } else if (this.down) {
      v.play('Crawl', { timeScale: 0.45 });
    } else if (stance === 2) {
      v.play('Crawl', { timeScale: clamp(this.speed / 1.2, 0.4, 1.4) });
    } else if (this.sprint && this.speed > 3.2) {
      // Sprinting drops the rifle out of the shoulder and swings the arms —
      // Run_Arms is the clip with the arm swing, and the carry pose stands
      // aside for it (see SoldierVisual.play).
      v.play('Run_Arms', { timeScale: clamp(this.speed / 6.4, 0.85, 1.45) });
    } else if (this.speed > 4.2) {
      v.play('Run', { timeScale: clamp(this.speed / 5.5, 0.9, 1.4) });
    } else if (this.speed > 0.4) {
      v.play('Walk', { timeScale: clamp(this.speed / 1.6, 0.7, 2) });
    } else {
      v.play('Idle', { timeScale: 1 });
    }
    v.update(step);
    // A crouched man is lower, but he is lower because his knees are bent —
    // the bend is in the pose, so only the residual hip drop belongs here.
    g.position.y = this.y - this._crouchBlend * 0.16;
  }

  /** World position of this player's weapon muzzle, or null if he has no rig. */
  muzzleWorld(out) {
    if (!this.visual?.ok) return null;
    this.group.updateMatrixWorld(true);
    return this.visual.muzzleWorld(out);
  }

  dispose(scene) {
    if (this.perkDrink?.bottle) this.group.remove(this.perkDrink.bottle);
    this.perkDrink = null;
    this.visual?.dispose?.();
    this.visual = null;
    scene.remove(this.group);
  }
}

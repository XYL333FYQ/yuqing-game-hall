// Hellhound presentation: burning hide, ember trail, hellfire spawn and a
// fiery death. Plus the emergence effect for ordinary zombies.
//
// Everything here is particles, lights and material uniforms driven from the
// outside. It never touches a zombie's state machine, transform or skeleton —
// the pathing, damage and round logic are untouched, so a hound behaves exactly
// as before and merely looks and reads like something that came out of hell.
import * as THREE from 'three';
import { rand, clamp } from '../utils.js';
import { SlotBank } from './LightPool.js';

const HOUND_LIGHTS = 4;      // real lights shared between the nearest hounds
// Past this a hound's own fire pool is smaller than a pixel of floor, so it
// stops being a candidate at all.
const LIGHT_REACH = 22;
// How much further out an incumbent stays a candidate. Matches the pool's own
// band; see the comment at the cull below for why the cull needs one.
const CULL_KEEP = 1.25;
// Squared distance beyond which a source's single-frame move must be a
// gameplay teleport, not locomotion. A hound tops out around 5 m/s, so even a
// 100 ms hitch moves it half a metre; one metre cannot be walked.
const TELEPORT_M2 = 1.0 * 1.0;

export class HellhoundFX {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../fx.js').FX} fx pooled particle/decal system
   */
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.time = 0;

    // A small set of real lights follows the nearest hounds. They are ordinary
    // point lights, so the game's LightPool adopts them automatically and they
    // compete for a slot on merit like every other light in the map.
    this.lights = [];
    for (let i = 0; i < HOUND_LIGHTS; i++) {
      const l = new THREE.PointLight(0xff5a18, 0, 7.0, 2);
      l.layers.enableAll();
      scene.add(l);
      this.lights.push(l);
    }
    // Which hound owns which of those four lights. The same SlotBank the
    // LightPool uses, for the same reason: without it, reassigning a light
    // from one hound to another teleports a LIT source across the map on a
    // single frame, and hound lights change owner constantly because both the
    // sources and the camera are sprinting.
    this._bank = new SlotBank(HOUND_LIGHTS, { fadeIn: 0.22, fadeOut: 0.16, hysteresis: 1.7 });
    this._wp = new THREE.Vector3();
  }

  // ---------------------------------------------------------------- spawning
  /** Hellfire eruption: the ground tears open and something climbs out. */
  houndSpawn(x, y, z) {
    const fx = this.fx;
    // Column of fire
    for (let i = 0; i < 34; i++) {
      const a = rand(Math.PI * 2), r = rand(0, 0.75);
      fx.sparks.emit({
        x: x + Math.cos(a) * r, y: y + 0.05, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * rand(0.4, 2.2), vy: rand(2.5, 7.5), vz: Math.sin(a) * rand(0.4, 2.2),
        grav: 1.6, drag: 2.0, life: rand(0.35, 0.95),
        size0: rand(0.14, 0.4), size1: rand(0.02, 0.08),
        color0: [5.5, 2.4, 0.5], color1: [1.4, 0.22, 0.03],
        alpha0: 1, alpha1: 0, rotV: rand(-4, 4),
      });
    }
    // Ember shrapnel thrown outward along the ground
    for (let i = 0; i < 26; i++) {
      const a = rand(Math.PI * 2);
      const sp = rand(3, 11);
      fx.sparks.emit({
        x, y: y + 0.1, z,
        vx: Math.cos(a) * sp, vy: rand(0.5, 4.5), vz: Math.sin(a) * sp,
        grav: 12, drag: 0.8, life: rand(0.5, 1.5),
        size0: rand(0.025, 0.06), size1: 0.006,
        color0: [4.5, 1.8, 0.35], color1: [1.0, 0.12, 0.02],
        alpha0: 1, alpha1: 0, floorY: y + 0.02, bounce: 0.4,
      });
    }
    // Sulphurous smoke
    for (let i = 0; i < 16; i++) {
      const a = rand(Math.PI * 2);
      fx.smoke.emit({
        x, y: y + 0.2, z,
        vx: Math.cos(a) * rand(0.3, 2.0), vy: rand(0.6, 2.4), vz: Math.sin(a) * rand(0.3, 2.0),
        grav: -0.8, drag: 1.6, life: rand(0.9, 2.2),
        size0: rand(0.2, 0.5), size1: rand(1.0, 2.2),
        color0: [0.22, 0.14, 0.11], color1: [0.07, 0.05, 0.04],
        alpha0: 0.6, alpha1: 0, rotV: rand(-1.2, 1.2),
      });
    }
    fx._flashLight(x, y + 0.9, z, 0xff5a18, 200, 0.5);
    fx.shake(0.28);
  }

  /** Ordinary zombie clawing up out of the ground. */
  zombieRise(x, y, z) {
    const fx = this.fx;
    for (let i = 0; i < 20; i++) {
      const a = rand(Math.PI * 2), r = rand(0, 0.6);
      fx.smoke.emit({
        x: x + Math.cos(a) * r, y: y + 0.05, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * rand(0.3, 1.8), vy: rand(0.5, 2.4), vz: Math.sin(a) * rand(0.3, 1.8),
        grav: 1.4, drag: 2.4, life: rand(0.6, 1.5),
        size0: rand(0.12, 0.34), size1: rand(0.5, 1.1),
        color0: [0.42, 0.36, 0.28], color1: [0.18, 0.16, 0.13],
        alpha0: 0.55, alpha1: 0, rotV: rand(-2, 2),
      });
    }
    // Clods of earth kicked out of the breach
    for (let i = 0; i < 14; i++) {
      const a = rand(Math.PI * 2);
      const sp = rand(1.5, 5);
      fx.smoke.emit({
        x, y: y + 0.08, z,
        vx: Math.cos(a) * sp, vy: rand(1.5, 4.5), vz: Math.sin(a) * sp,
        grav: 13, drag: 0.4, life: rand(0.5, 1.1),
        size0: rand(0.04, 0.1), size1: rand(0.02, 0.05),
        color0: [0.3, 0.25, 0.19], color1: [0.2, 0.17, 0.13],
        alpha0: 1, alpha1: 0.3, rotV: rand(-12, 12),
        floorY: y + 0.02, bounce: 0.2,
      });
    }
    fx.shake(0.06);
  }

  /** Dirt thrown out while a corpse is still fighting its way up. */
  riseDirt(x, y, z, t) {
    const fx = this.fx;
    const a = rand(Math.PI * 2), r = rand(0.05, 0.5);
    // Early on it is fine dust from the crack; later it is clods kicked clear.
    const heavy = t > 0.4;
    fx.smoke.emit({
      x: x + Math.cos(a) * r, y: y + 0.04, z: z + Math.sin(a) * r,
      vx: Math.cos(a) * rand(0.2, heavy ? 2.6 : 1.2),
      vy: rand(0.4, heavy ? 3.4 : 1.6),
      vz: Math.sin(a) * rand(0.2, heavy ? 2.6 : 1.2),
      grav: heavy ? 11 : 1.6, drag: heavy ? 0.5 : 2.6,
      life: rand(0.4, heavy ? 1.0 : 1.3),
      size0: heavy ? rand(0.03, 0.08) : rand(0.08, 0.22),
      size1: heavy ? rand(0.02, 0.04) : rand(0.35, 0.7),
      color0: heavy ? [0.30, 0.25, 0.19] : [0.40, 0.35, 0.28],
      color1: [0.17, 0.15, 0.12],
      alpha0: heavy ? 1 : 0.42, alpha1: 0,
      rotV: rand(-8, 8),
      floorY: y + 0.02, bounce: heavy ? 0.2 : 0,
    });
  }

  /** The breach settles once it is fully out. */
  riseSettle(x, y, z) {
    const fx = this.fx;
    for (let i = 0; i < 8; i++) {
      const a = rand(Math.PI * 2);
      fx.smoke.emit({
        x, y: y + 0.05, z,
        vx: Math.cos(a) * rand(0.4, 1.6), vy: rand(0.1, 0.7), vz: Math.sin(a) * rand(0.4, 1.6),
        grav: 0.7, drag: 3.4, life: rand(0.6, 1.3),
        size0: rand(0.1, 0.24), size1: rand(0.4, 0.9),
        color0: [0.36, 0.31, 0.25], color1: [0.16, 0.14, 0.12],
        alpha0: 0.34, alpha1: 0, rotV: rand(-2, 2),
      });
    }
  }

  // ------------------------------------------------------------------ damage
  /**
   * A hit on a hound. There is nothing in it to bleed: the round punches
   * through burning hide, so it throws embers and a puff of ash and leaves
   * nothing on the floor.
   */
  houndHit(x, y, z, big = false) {
    const fx = this.fx;
    const n = big ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 2), e = rand(-0.2, 1);
      const sp = rand(1.4, big ? 5.5 : 3.6);
      fx.sparks.emit({
        x, y, z,
        vx: Math.cos(a) * sp, vy: e * sp * 0.7 + 0.8, vz: Math.sin(a) * sp,
        grav: 7, drag: 2.8, life: rand(0.18, big ? 0.55 : 0.4),
        size0: rand(0.03, big ? 0.11 : 0.07), size1: rand(0.01, 0.03),
        color0: [4.6, 1.9, 0.4], color1: [1.0, 0.14, 0.02],
        alpha0: 1, alpha1: 0, rotV: rand(-5, 5),
      });
    }
    for (let i = 0; i < (big ? 6 : 3); i++) {
      const a = rand(Math.PI * 2);
      fx.smoke.emit({
        x, y, z,
        vx: Math.cos(a) * rand(0.2, 1.1), vy: rand(0.2, 0.9), vz: Math.sin(a) * rand(0.2, 1.1),
        grav: -0.4, drag: 2.6, life: rand(0.35, 0.8),
        size0: rand(0.07, 0.16), size1: rand(0.25, 0.5),
        color0: [0.22, 0.17, 0.14], color1: [0.07, 0.06, 0.05],
        alpha0: 0.4, alpha1: 0, rotV: rand(-2, 2),
      });
    }
  }

  // ------------------------------------------------------------------ deaths
  /** A hound does not fall over — it comes apart into fire and ash. */
  houndDeath(x, y, z) {
    const fx = this.fx;
    for (let i = 0; i < 40; i++) {
      const a = rand(Math.PI * 2), e = rand(-0.3, 1);
      const sp = rand(2, 9);
      fx.sparks.emit({
        x, y: y + 0.45, z,
        vx: Math.cos(a) * sp, vy: e * sp * 0.8 + 1.2, vz: Math.sin(a) * sp,
        grav: 6, drag: 2.6, life: rand(0.25, 0.8),
        size0: rand(0.1, 0.34), size1: rand(0.02, 0.07),
        color0: [5.0, 2.2, 0.45], color1: [1.2, 0.18, 0.02],
        alpha0: 1, alpha1: 0, rotV: rand(-5, 5),
      });
    }
    for (let i = 0; i < 30; i++) {
      const a = rand(Math.PI * 2);
      fx.sparks.emit({
        x, y: y + 0.5, z,
        vx: Math.cos(a) * rand(1, 7), vy: rand(1, 6), vz: Math.sin(a) * rand(1, 7),
        grav: 9, drag: 0.9, life: rand(0.7, 2.0),
        size0: rand(0.02, 0.05), size1: 0.005,
        color0: [4.0, 1.5, 0.3], color1: [0.8, 0.1, 0.02],
        alpha0: 1, alpha1: 0, floorY: y + 0.02, bounce: 0.35,
      });
    }
    // Ash cloud left behind
    for (let i = 0; i < 18; i++) {
      const a = rand(Math.PI * 2);
      fx.smoke.emit({
        x, y: y + 0.4, z,
        vx: Math.cos(a) * rand(0.4, 2.4), vy: rand(0.4, 2.0), vz: Math.sin(a) * rand(0.4, 2.4),
        grav: -0.5, drag: 1.7, life: rand(1.0, 2.4),
        size0: rand(0.15, 0.45), size1: rand(0.9, 1.9),
        color0: [0.2, 0.16, 0.14], color1: [0.06, 0.05, 0.045],
        alpha0: 0.55, alpha1: 0, rotV: rand(-1.4, 1.4),
      });
    }
    fx._flashLight(x, y + 0.6, z, 0xff6a20, 150, 0.42);
    fx.shake(0.16);
  }

  // ------------------------------------------------------------------ update
  /**
   * @param {number} dt
   * @param {Map} zombies live zombie map
   * @param {THREE.Vector3} cameraPos
   */
  update(dt, zombies, cameraPos) {
    this.time += dt;
    const fx = this.fx;
    const bank = this._bank;
    bank.begin();

    for (const [, z] of zombies) {
      if (!z.dog || z.dead) continue;

      // ---- ember trail ----
      // Rate scales with speed: a sprinting hound throws a visible wake, a
      // stalking one just smoulders.
      const speed = Math.hypot(z.vx || 0, z.vz || 0) || (z.speed || 0);
      const rate = 6 + speed * 5;
      // Clamped, because the drain below is inside the distance cull and this is
      // not. A hound held past 30m for a whole dog round banked ~20 embers/s and
      // then spent them all in the single frame the player closed the distance.
      z._emberAcc = Math.min((z._emberAcc || 0) + dt * rate, 4);
      const dx = cameraPos.x - z.x, dz = cameraPos.z - z.z;
      const d2 = dx * dx + dz * dz;
      // Distance culled: embers past 30m are below a pixel anyway.
      if (d2 < 900) {
        while (z._emberAcc >= 1) {
          z._emberAcc -= 1;
          const bx = z.x + rand(-0.28, 0.28);
          const by = z.y + rand(0.45, 1.0);
          const bz = z.z + rand(-0.28, 0.28);
          fx.sparks.emit({
            x: bx, y: by, z: bz,
            vx: rand(-0.5, 0.5), vy: rand(0.5, 2.0), vz: rand(-0.5, 0.5),
            grav: -1.4, drag: 2.2, life: rand(0.35, 1.0),
            size0: rand(0.02, 0.055), size1: 0.004,
            color0: [4.2, 1.7, 0.32], color1: [1.0, 0.14, 0.02],
            alpha0: 1, alpha1: 0, rotV: rand(-6, 6),
          });
        }
        // Occasional lick of flame off the hackles
        if (Math.random() < dt * 9) {
          fx.sparks.emit({
            x: z.x + rand(-0.2, 0.2), y: z.y + rand(0.75, 1.05), z: z.z + rand(-0.2, 0.2),
            vx: rand(-0.3, 0.3), vy: rand(1.2, 2.8), vz: rand(-0.3, 0.3),
            grav: -2.2, drag: 3.0, life: rand(0.2, 0.5),
            size0: rand(0.09, 0.2), size1: 0.02,
            color0: [5.0, 2.3, 0.5], color1: [1.3, 0.2, 0.02],
            alpha0: 0.9, alpha1: 0, rotV: rand(-3, 3),
          });
        }
        // Thin heat smoke
        if (Math.random() < dt * 3) {
          fx.smoke.emit({
            x: z.x + rand(-0.2, 0.2), y: z.y + rand(0.8, 1.1), z: z.z + rand(-0.2, 0.2),
            vx: rand(-0.2, 0.2), vy: rand(0.5, 1.4), vz: rand(-0.2, 0.2),
            grav: -0.6, drag: 1.8, life: rand(0.7, 1.6),
            size0: rand(0.08, 0.18), size1: rand(0.4, 0.9),
            color0: [0.18, 0.13, 0.11], color1: [0.06, 0.045, 0.04],
            alpha0: 0.3, alpha1: 0, rotV: rand(-1.5, 1.5),
          });
        }
      }

      // ---- offer this hound for a dynamic light ----
      // Irradiance-ish ranking, and the cull gets a hysteresis band for any
      // hound that already holds a slot: a bare `continue` at the boundary
      // removes it as a candidate entirely, so the incumbency bonus inside the
      // bank never gets the chance to protect it and the light chatters as the
      // player walks along that radius.
      const reach = LIGHT_REACH * (bank.holds(z) ? CULL_KEEP : 1);
      if (d2 > reach * reach) continue;
      bank.offer(z, 1 / (d2 + 1));
    }

    bank.commit(dt);

    // ---- drive the hound lights ----
    // These four are ordinary scene point lights, so the LightPool adopts them
    // as sources and mirrors their position and colour onto real hardware
    // lights every frame. That is exactly why the slot handover has to happen
    // HERE and not there: to the pool a hound light is one unchanging source,
    // so when this code used to reassign a light from one hound to another it
    // saw no owner change at all — just a source that had teleported across
    // the map while still emitting. Hound lights ride fast targets during the
    // rounds with the most camera motion, so that fired constantly.
    //
    // SlotBank fixes it the same way the pool does: a slot only ever changes
    // owner on a frame where its weight is exactly zero, so the light is dark
    // at the instant it moves.
    //
    // dispose() empties this array. A late update() after teardown is not a
    // path the rAF loop can take (it checks `disposed` first), but anything
    // else holding a reference to the effect would crash here on undefined,
    // and the cost of not crashing is one comparison.
    for (let i = 0; i < Math.min(HOUND_LIGHTS, this.lights.length); i++) {
      const l = this.lights[i];
      const sl = bank.slots[i];
      const z = sl.source;
      if (!z) { l.intensity = 0; l.userData.tracked = null; continue; }
      // A slot only changes owner while dark, but the SOURCE can still jump:
      // the round watchdog teleports a hound that has spent 25 s unable to
      // reach anybody, and a lit light following it would streak across the
      // map in one frame exactly as a bad handover does. Treat a move larger
      // than any hound could cover in a frame as a handover and restart the
      // fade, so the light is dark on the frame it moves.
      const tr = l.userData.tracked;
      const ty = z.y + 0.16;
      if (tr) {
        const jx = z.x - tr.x, jy = ty - tr.y, jz = z.z - tr.z;
        if (jx * jx + jy * jy + jz * jz > TELEPORT_M2) sl.k = 0;
      }
      l.userData.tracked = { x: z.x, y: ty, z: z.z };
      if (sl.k <= 0) sl.weight = 0;
      // Follow the hound even while the slot is DARK. This is the same defect
      // the pool had, fixed the same way (js/render/LightPool.js, and the
      // metric in RENDERING.md §2): both early-outs above used to skip the
      // POSITION write as well as the intensity, so on the handover frame the
      // light stayed parked at the OUTGOING hound and moved on the frame it
      // re-lit. The bank's "a slot only changes owner at weight 0" guarantee
      // was intact and the light still jumped while lit.
      //
      // It matters more here than in the pool: these four lights are themselves
      // pool SOURCES, so a hound light jumping while lit drags a pooled
      // hardware light across the map with it — and the pool's metric excludes
      // the HellhoundFX lights as genuinely-moving sources, so the pool's own
      // clean numbers cannot see it.
      //
      // A slot arriving out of nothing spends one frame at zero too: SlotBank's
      // `fresh` flag already does that for every empty-slot placement, so this
      // holds for both ways a slot can acquire a hound.
      const dark = sl.weight <= 0;
      // Sit the light low and slightly behind the shoulder: it should throw a
      // pool onto the ground and rim the legs, not flood-light the hide.
      //
      // Intensity matters far more than it looks. The light rides the hound,
      // so with inverse-square falloff the animal's own body is barely 0.3 m
      // from the source: at the old 15 the irradiance on its own belly was
      // roughly 80, which clipped the nearest hound in a pack to a featureless
      // white blob and wiped out the ember fissures this light exists to sell.
      // The hound's heat is carried by its emissive fissures and eyes; this
      // light's job is the pool it throws on the floor and the near walls.
      // Height is slewed rather than copied. A hound's `y` is its ground
      // height, which SNAPS by up to 0.3 m the frame it crosses a floor slab
      // boundary; copied straight through, the fire pool it throws jumps that
      // far vertically in one frame. Horizontal position is copied exactly —
      // the light must stay under the animal.
      //
      // While DARK the height SNAPS instead. Nothing is emitting, so there is
      // nothing to smooth, and slewing would mean arriving at the new hound
      // mid-travel and lighting up part-way there — the slew is a cosmetic
      // filter on a visible light, not a correction the position depends on.
      // Snapping leaves the light already correct on the frame it comes back.
      const settle = Math.min(1, dt * 14);
      l.position.x = z.x;
      l.position.z = z.z;
      l.position.y = (tr && !dark) ? l.position.y + (ty - l.position.y) * settle : ty;
      // Fire flicker: two detuned sines so it never reads as a loop. The slot
      // weight multiplies through it rather than replacing it, so a hound
      // arriving on a slot still flickers as it comes up.
      const t = this.time * 1.0 + i * 3.1;
      const flick = 0.72 + Math.sin(t * 13.3) * 0.18 + Math.sin(t * 31.7) * 0.1;
      l.intensity = dark ? 0 : clamp(3.4 * flick, 0, 6.5) * sl.weight;
    }
  }

  dispose() {
    for (const l of this.lights) { this.scene.remove(l); l.dispose?.(); }
    this.lights.length = 0;
    // Drop the slot assignments too, so nothing holds a reference to a zombie
    // from a torn-down round.
    this._bank.clear();
  }
}

// Camera feel: everything that makes an FPS camera read as a body carrying a
// weapon rather than a floating matrix.
//
// The old camera was `camera.position.set(x, y+eye, z)` plus a trauma shake.
// This layer adds distance-driven view bob, mouse-lag sway, strafe/sprint roll,
// a critically-damped landing spring, slide dip, breathing, and a spring-damper
// recoil kick that is separate from the aim pitch (so recoil recovers to where
// you were aiming, not to where recoil left you).
//
// All offsets are produced in the camera's LOCAL frame and composed by the
// caller, so nothing here needs to know about the world.
import * as THREE from 'three';
import { clamp, damp } from '../utils.js';

// Critically-damped spring, integrated ANALYTICALLY rather than with explicit
// Euler. `omega` is the natural frequency in rad/s: higher is snappier.
//
// The explicit form (v += (target-x)*w*w*dt - v*2*w*dt) goes unstable whenever
// 2*omega*dt > 1 — with omega = 22 for recoil that is any frame slower than
// ~44fps, and the camera detonates into a spin. The closed-form solution of
// x'' + 2*w*x' + w^2*x = 0 is stable for every dt, so a frame spike just makes
// the spring settle further instead of blowing up.
function spring(state, target, omega, dt) {
  const d = state.x - target;
  const e = Math.exp(-omega * dt);
  const c = state.v + omega * d;
  state.x = target + (d + c * dt) * e;
  state.v = (state.v - c * omega * dt) * e;
  return state.x;
}

/**
 * Clamp a spring's travel without leaving it wound up.
 *
 * Clamping `x` alone pins the position while `v` keeps accumulating behind it:
 * through a burst the spring sits on its stop looking still, then springs loose
 * the frame the firing stops. Dropping the velocity that is pushing INTO the
 * stop makes the limit read as something the view ran up against, rather than
 * as a number edited underneath the integrator. Velocity coming back off the
 * stop is left alone — that is the recovery.
 */
function clampSpring(state, lim) {
  if (state.x > lim) { state.x = lim; if (state.v > 0) state.v = 0; }
  else if (state.x < -lim) { state.x = -lim; if (state.v < 0) state.v = 0; }
  return state.x;
}

export class CameraRig {
  constructor() {
    // ---- outputs (local frame) ----
    this.offsetX = 0; this.offsetY = 0; this.offsetZ = 0;
    this.pitch = 0; this.yaw = 0; this.roll = 0;
    this.fovAdd = 0;

    // ---- internal state ----
    this.bobPhase = 0;
    this.bobAmp = 0;
    this.stepPhase = 0;
    this.swayX = 0; this.swayY = 0;
    this.strafeRoll = 0;
    this.sprintT = 0;
    this.slideT = 0;
    this.slideHit = 0;        // entry impulse, decays over the slide
    this._wasSliding = false;
    this.breathT = Math.random() * 100;
    this.land = { x: 0, v: 0 };
    this.kickPitch = { x: 0, v: 0 };
    this.kickYaw = { x: 0, v: 0 };
    this.kickRoll = { x: 0, v: 0 };
    this.eyeSmooth = null;   // smooths stair/ramp step-ups
    this.lastFootDown = 0;

    // ---- tuning ----
    this.bobScale = 1;
    this.swayScale = 1;
  }

  /** Fire a recoil impulse. Called once per shot. */
  addRecoil(pitch, yaw, roll = 0) {
    this.kickPitch.v += pitch;
    this.kickYaw.v += yaw;
    this.kickRoll.v += roll;
  }

  /** Fire a landing impulse. `speed` is the downward velocity at touchdown. */
  addLanding(speed) {
    // Below ~4 m/s this is a step, not a landing; above ~14 m/s it saturates.
    const k = clamp((speed - 3.5) / 10.5, 0, 1);
    if (k <= 0) return 0;
    this.land.v -= k * 9.0;
    this.addRecoil(-k * 0.9, (Math.random() - 0.5) * k * 0.5, (Math.random() - 0.5) * k * 0.8);
    return k;
  }

  /** Footstep impulse — a small vertical tick and roll on each footfall. */
  addFootstep(strength = 1) {
    this.land.v -= strength * 0.55;
    this.kickRoll.v += (Math.random() - 0.5) * strength * 0.5;
  }

  /**
   * @param {number} dt
   * @param {object} s state:
   *   speed, maxSpeed, sprinting, grounded, crouching, sliding, ads (0..1),
   *   strafe (-1..1), mdx, mdy, health01
   */
  update(dt, s) {
    // Sliding is a glide, not a stride: no footfalls, no bob.
    const moving = s.speed > 0.4 && s.grounded && !s.sliding;
    const speed01 = clamp(s.speed / Math.max(0.1, s.maxSpeed), 0, 1.4);

    // ---- sprint ramp (drives fov kick and bob character) ----
    this.sprintT = damp(this.sprintT, s.sprinting ? 1 : 0, s.sprinting ? 5.5 : 9, dt);
    this.slideT = damp(this.slideT, s.sliding ? 1 : 0, s.sliding ? 18 : 7, dt);
    // Entry punch. slideT alone is a flat plateau for the whole slide, which
    // reads as "the camera moved down" rather than as the shove of dropping
    // onto your hip at sprint speed. This rides on top of it and decays, so
    // the hit lands at the start and the rest of the slide settles out.
    if (s.sliding && !this._wasSliding) this.slideHit = 1;
    this._wasSliding = !!s.sliding;
    this.slideHit = damp(this.slideHit || 0, 0, 4.2, dt);

    // ---- view bob -------------------------------------------------------
    // Phase advances with distance travelled, not with time, so bob stays
    // locked to the stride whatever the framerate or the speed.
    const strideLen = s.sprinting ? 1.65 : s.crouching ? 0.95 : 1.35;
    this.bobPhase += (s.speed * dt) / strideLen * Math.PI;
    if (this.bobPhase > Math.PI * 4) this.bobPhase -= Math.PI * 4;

    // ADS collapses bob to a fraction; you can still feel it, but it never
    // moves the sight off target.
    const adsDamp = 1 - s.ads * 0.86;
    const targetAmp = moving ? speed01 * (s.sprinting ? 1.35 : 1) * adsDamp : 0;
    this.bobAmp = damp(this.bobAmp, targetAmp, 7, dt);

    const a = this.bobAmp * 0.042 * this.bobScale;
    // Lissajous 2:1 — horizontal sways once per stride, vertical twice
    // (once per footfall). That ratio is what reads as walking.
    const bobX = Math.sin(this.bobPhase) * a;
    const bobY = -Math.abs(Math.cos(this.bobPhase)) * a * 0.72;
    const bobRoll = Math.sin(this.bobPhase) * this.bobAmp * 0.011 * this.bobScale;
    const bobPitch = Math.cos(this.bobPhase * 2) * this.bobAmp * 0.006;

    // Footfall detection off the bob phase drives step audio + impulse.
    const foot = Math.floor(this.bobPhase / Math.PI);
    if (moving && foot !== this.lastFootDown) {
      this.lastFootDown = foot;
      this.onFootstep?.(s.sprinting ? 1.15 : s.crouching ? 0.5 : 0.85);
      this.addFootstep(this.bobAmp * (s.sprinting ? 0.9 : 0.5));
    }

    // ---- mouse-lag sway -------------------------------------------------
    // The head trails the aim slightly, then catches up. Scaled down under ADS.
    const swayK = 0.9 * this.swayScale * (1 - s.ads * 0.7);
    this.swayX = damp(this.swayX, clamp(-(s.mdx || 0) * 0.0022, -0.05, 0.05) * swayK, 9, dt);
    this.swayY = damp(this.swayY, clamp(-(s.mdy || 0) * 0.0018, -0.04, 0.04) * swayK, 9, dt);

    // ---- strafe roll ----------------------------------------------------
    const targetStrafeRoll = -(s.strafe || 0) * 0.021 * (1 - s.ads * 0.6);
    this.strafeRoll = damp(this.strafeRoll, targetStrafeRoll, 6.5, dt);

    // ---- landing spring -------------------------------------------------
    spring(this.land, 0, 15, dt);
    this.land.x = clamp(this.land.x, -0.42, 0.12);

    // ---- recoil springs -------------------------------------------------
    spring(this.kickPitch, 0, 22, dt);
    spring(this.kickYaw, 0, 20, dt);
    spring(this.kickRoll, 0, 17, dt);
    // Hard clamps: a burst of fast shots must never stack into a view spin.
    clampSpring(this.kickPitch, 0.11);
    clampSpring(this.kickYaw, 0.07);
    clampSpring(this.kickRoll, 0.09);

    // ---- breathing ------------------------------------------------------
    // Slow when healthy; faster and deeper as health drops (and while ADS,
    // because that is when a still camera would otherwise look dead).
    const hurt = 1 - clamp(s.health01 ?? 1, 0, 1);
    const breathRate = 0.85 + hurt * 2.4;
    this.breathT += dt * breathRate;
    const breathAmp = (0.0016 + hurt * 0.006) * (1 - this.bobAmp * 0.8) * (1 + s.ads * 0.7);
    const breathY = Math.sin(this.breathT) * breathAmp;
    const breathX = Math.sin(this.breathT * 0.63 + 1.2) * breathAmp * 0.8;

    // ---- compose --------------------------------------------------------
    this.offsetX = bobX + this.swayX + breathX;
    this.offsetY = bobY + this.swayY + this.land.x - this.slideT * 0.34 + breathY;
    this.offsetZ = 0;

    this.pitch = bobPitch + this.kickPitch.x + this.land.x * 0.28;
    this.yaw = this.kickYaw.x;
    // Roll into the slide, hardest at entry. The lean picks up the direction
    // you are steering, so curving a slide round a corner banks into it.
    const slideBank = this.slideT * (0.055 + this.slideHit * 0.075)
      + this.slideT * clamp(s.strafe ?? 0, -1, 1) * 0.05;
    this.roll = bobRoll + this.strafeRoll + this.kickRoll.x + slideBank;

    // Sprint stretches the FOV; sliding stretches it more. Both spring rather
    // than lerp so the snap back on stopping has a little overshoot.
    this.fovAdd = this.sprintT * 9 + this.slideT * 6 + this.slideHit * 5;
  }

  /** Smooth the eye height so stepping onto a ramp or stair does not snap. */
  smoothEye(targetY, dt, grounded) {
    if (this.eyeSmooth == null || !grounded) { this.eyeSmooth = targetY; return targetY; }
    const delta = targetY - this.eyeSmooth;
    // Only smooth small upward steps; falling should read instantly.
    if (delta > 0.6 || delta < -0.05) { this.eyeSmooth = targetY; return targetY; }
    this.eyeSmooth = damp(this.eyeSmooth, targetY, 14, dt);
    return this.eyeSmooth;
  }
}

// Reused by the caller so composing offsets allocates nothing.
export const _rigTmp = new THREE.Vector3();

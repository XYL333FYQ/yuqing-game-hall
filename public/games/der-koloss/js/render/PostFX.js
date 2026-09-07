// AAA post-processing stack for Der Koloss.
//
//   scene (HDR, MSAA) ─┬─> SAO ──> bilateral blur ─┐
//                      ├─> volumetric shafts ──────┼─> resolve (AO * color + scatter)
//                      └─> depth ──────────────────┘
//        └─> camera motion blur -> DOF -> bloom chain -> AgX composite -> FXAA -> screen
//
// Everything is pooled and resized in place; a frame allocates nothing.
import * as THREE from 'three';
import { FullScreenPass, makeRT } from './FullScreenPass.js';
import { SHADOW_EDGE_FADE } from './ShadowEdgeFade.js';
import {
  AO_FRAG, AO_BLUR_FRAG, VOLUMETRIC_FRAG, VOL_UPSAMPLE_FRAG,
  MOTION_BLUR_FRAG, BLOOM_PREFILTER_FRAG, BLOOM_DOWN_FRAG, BLOOM_UP_FRAG,
  COMPOSITE_FRAG, FXAA_FRAG, DOF_FRAG, SSR_FRAG, LUM_DOWN_FRAG, LUM_ADAPT_FRAG,
} from './shaders.js';

const BLOOM_MIPS = 6;

// Motion blur sampling contract. Streaking is undersampling, not length: at 2px
// between taps a high-contrast edge combs into discrete ghosts; it vanished by
// ~1.4px. So the blur LENGTH is never a free parameter — it is always tap count
// times this spacing, and anything that wants a longer smear has to buy the
// taps to keep it clean. `mbSamples` in each preset is the length at the slider
// default (100%); the slider scales taps and radius together through
// setMotionBlurScale so the spacing invariant survives every setting.
const MB_TAP_SPACING = 1.6;
const MB_TAPS_MIN = 6;
// Ceiling on the top tier at max slider. 32 taps is 64 texture fetches for a
// moving pixel, which is the most this pass can justify even on ultra.
const MB_TAPS_MAX = 32;

export const QUALITY_PRESETS = {
  low: {
    msaa: 0, aoScale: 0, volScale: 0, bloomMips: 4, motionBlur: false, dof: false,
    fxaa: true, aoSamples: 8, volSteps: 12, mbSamples: 8, sharpen: 0.25, ssr: false, ssrSteps: 12,
  },
  medium: {
    msaa: 0, aoScale: 0.5, volScale: 0.5, bloomMips: 5, motionBlur: true, dof: false,
    fxaa: true, aoSamples: 10, volSteps: 16, mbSamples: 12, sharpen: 0.3, ssr: false, ssrSteps: 14,
  },
  high: {
    msaa: 4, aoScale: 0.5, volScale: 0.5, bloomMips: 6, motionBlur: true, dof: true,
    fxaa: true, aoSamples: 12, volSteps: 24, mbSamples: 18, sharpen: 0.35, ssr: true, ssrSteps: 20,
  },
  ultra: {
    msaa: 4, aoScale: 1.0, volScale: 0.5, bloomMips: 6, motionBlur: true, dof: true,
    fxaa: true, aoSamples: 16, volSteps: 40, mbSamples: 22, sharpen: 0.35, ssr: true, ssrSteps: 32,
  },
};

export class PostFX {
  constructor(renderer, { quality = 'high' } = {}) {
    this.renderer = renderer;
    this.enabled = true;
    this.width = 1; this.height = 1;
    this.frame = 0;

    // ---- tunables the game drives per-frame ----
    this.exposure = 1.0;
    this.bloomStrength = 0.62;
    this.bloomThreshold = 1.05;
    this.chromatic = 0.11;
    this.vignette = 0.34;
    this.grain = 0.014;
    this.saturation = 1.06;
    this.contrast = 1.06;
    this.lift = new THREE.Vector3(0.012, 0.016, 0.030);   // cool shadows
    this.gamma = new THREE.Vector3(1.0, 1.0, 1.0);
    this.gain = new THREE.Vector3(1.03, 1.0, 0.96);       // warm highlights
    this.aoStrength = 0.85;
    this.aoRadius = 0.75;
    this.aoIntensity = 1.15;
    // Battlefield-grade shutter. This was briefly dialled almost off because
    // the near ground and ceiling beams smeared into hard parallel streaks —
    // but that was a BUG (taps leaving the frame sampled the clamped border
    // pixel), not the blur itself. With that fixed the blur can carry weight
    // again, which is a large part of the AAA feel.
    // Default tuned to the reference the user supplied: the WORLD smears
    // clearly while sprinting and turning, and the weapon stays readable. The
    // gun staying sharp is structural, not a tuning accident — the viewmodel
    // is drawn AFTER this pass, so it is never sampled by it.
    this.motionBlurStrength = 1.15;
    // The player's slider, 0..1.5, folded in through setMotionBlurScale. It is
    // NOT the same knob as motionBlurStrength: strength only decides how fast a
    // given camera speed reaches the length clamp, whereas this scales the
    // clamp itself — and the clamp is what you actually see, because any turn
    // brisker than roughly 150 deg/sec saturates it. Initialised before
    // setQuality runs at the end of the constructor.
    this._mbScale = 1;
    this._mbTaps = 0;
    this.damage = 0;
    this.flash = 0;
    this.dofFocus = 8;
    this.dofRange = 14;
    this.dofMaxBlur = 0;    // 0 disables the pass; ADS raises it

    // ---- auto-exposure ----
    // A single authored exposure cannot serve a moonlit courtyard and an
    // unpowered factory interior at once. This measures the frame and adapts,
    // scaling the authored baseline rather than replacing it.
    this.autoExposure = 1.0;      // 0..1 blend toward fully automatic
    this.keyValue = 0.105;        // target middle grey
    this.adaptUp = 2.6;           // rate when the scene gets brighter
    this.adaptDown = 1.1;         // slower going dark, like an eye
    this.minLum = 0.010;
    this.maxLum = 3.0;

    // ---- screen-space reflections (standing water only) ----
    this.ssrStrength = 0.85;
    this.ssrMaxDist = 9;      // view-space march length, metres
    this.ssrThickness = 0.55; // depth tolerance for a hit
    this.ssrWetScale = 0.30;  // MUST match the floor material's wetScale
    this.ssrWetHeight = 0.40; // MUST match the floor material's wetHeight

    // ---- volumetrics ----
    this.volDensity = 0.020;
    this.volHeightFalloff = 0.10;
    this.volFogBase = 0.0;
    this.volAnisotropy = 0.72;
    this.volAmbient = 0.35;
    this.volAmbientColor = new THREE.Color(0x2a3a5c);
    this.volMaxDist = 65;
    this.sunColor = new THREE.Color(0x93aad8);
    this.sunDir = new THREE.Vector3(0.5, 0.7, -0.5).normalize();
    this.shadowLight = null;

    this._prevViewProj = new THREE.Matrix4();
    this._curViewProj = new THREE.Matrix4();
    this._projInv = new THREE.Matrix4();
    this._viewInv = new THREE.Matrix4();
    this._camPos = new THREE.Vector3();
    this._identityShadow = new THREE.Matrix4();
    this._blackTex = null;

    this._buildPasses();
    this.setQuality(quality);
  }

  // ------------------------------------------------------------------ setup
  _buildPasses() {
    const V2 = () => new THREE.Vector2();
    const M4 = () => new THREE.Matrix4();

    this.aoPass = new FullScreenPass(AO_FRAG, {
      uDepth: { value: null }, uProjInv: { value: M4() }, uProj: { value: M4() },
      uResolution: { value: V2() }, uNear: { value: 0.1 }, uFar: { value: 400 },
      uRadius: { value: 0.75 }, uIntensity: { value: 1.15 }, uBias: { value: 0.02 },
      uFrame: { value: 0 },
    }, { AO_SAMPLES: 12 });

    this.aoBlurPass = new FullScreenPass(AO_BLUR_FRAG, {
      uAO: { value: null }, uTexel: { value: V2() }, uDir: { value: V2() },
      uNear: { value: 0.1 }, uFar: { value: 400 },
    });

    this.volPass = new FullScreenPass(VOLUMETRIC_FRAG, {
      uDepth: { value: null }, uShadow: { value: null }, uShadowMatrix: { value: M4() },
      uProjInv: { value: M4() }, uViewInv: { value: M4() }, uCamPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Vector3() },
      uNear: { value: 0.1 }, uFar: { value: 400 }, uDensity: { value: 0.02 },
      uHeightFalloff: { value: 0.1 }, uFogBase: { value: 0 }, uAnisotropy: { value: 0.7 },
      uFrame: { value: 0 }, uMaxDist: { value: 65 }, uAmbient: { value: 0.35 },
      uAmbientColor: { value: new THREE.Vector3() }, uShadowRadius: { value: 1 },
      // Mirrors the ramp ShadowEdgeFade.js patches into three's surface shader.
      // If these two ever disagree, the shafts and the ground they land on fade
      // at different rates and the boundary becomes MORE visible, not less.
      uShadowEdgeFade: { value: SHADOW_EDGE_FADE },
      uPointPos: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uPointColor: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
    }, { VOL_STEPS: 24, VOL_LIGHTS: 4 });

    this.resolvePass = new FullScreenPass(VOL_UPSAMPLE_FRAG, {
      uColor: { value: null }, uVolume: { value: null }, uAO: { value: null },
      uDepth: { value: null }, uTexelHalf: { value: V2() },
      uNear: { value: 0.1 }, uFar: { value: 400 }, uAOStrength: { value: 0.85 },
    });

    this.mbPass = new FullScreenPass(MOTION_BLUR_FRAG, {
      uColor: { value: null }, uDepth: { value: null }, uProjInv: { value: M4() },
      uViewInv: { value: M4() }, uPrevViewProj: { value: M4() }, uResolution: { value: V2() },
      uStrength: { value: 0.85 }, uMaxRadius: { value: 15 }, uFrame: { value: 0 },
    }, { MB_SAMPLES: 16 });

    this.dofPass = new FullScreenPass(DOF_FRAG, {
      uColor: { value: null }, uDepth: { value: null }, uTexel: { value: V2() },
      uNear: { value: 0.1 }, uFar: { value: 400 }, uFocusDist: { value: 8 },
      uFocusRange: { value: 14 }, uMaxBlur: { value: 0 }, uFrame: { value: 0 },
    });

    this.ssrPass = new FullScreenPass(SSR_FRAG, {
      uColor: { value: null }, uDepth: { value: null }, uProj: { value: M4() },
      uProjInv: { value: M4() }, uViewInv: { value: M4() }, uResolution: { value: V2() },
      uNear: { value: 0.1 }, uFar: { value: 400 }, uStrength: { value: 0.85 },
      uMaxDist: { value: 9 }, uThickness: { value: 0.55 },
      uWetScale: { value: 0.30 }, uWetHeight: { value: 0.40 }, uFrame: { value: 0 },
    }, { SSR_STEPS: 20 });

    this.bloomPre = new FullScreenPass(BLOOM_PREFILTER_FRAG, {
      uColor: { value: null }, uTexel: { value: V2() }, uThreshold: { value: 1.05 },
      uSoftKnee: { value: 0.7 }, uClamp: { value: 24 },
    });
    this.bloomDown = new FullScreenPass(BLOOM_DOWN_FRAG, { uColor: { value: null }, uTexel: { value: V2() } });
    this.bloomUp = new FullScreenPass(BLOOM_UP_FRAG, {
      uColor: { value: null }, uPrev: { value: null }, uTexel: { value: V2() }, uRadius: { value: 1.0 },
    });

    this.compositePass = new FullScreenPass(COMPOSITE_FRAG, {
      uColor: { value: null }, uBloom: { value: null }, uDepth: { value: null },
      uAdaptedLum: { value: null }, uAutoExposure: { value: 1 }, uKeyValue: { value: 0.105 },
      uResolution: { value: V2() }, uTime: { value: 0 }, uExposure: { value: 1 },
      uBloomStrength: { value: 0.62 }, uChromatic: { value: 0.11 }, uVignette: { value: 0.34 },
      uGrain: { value: 0.014 }, uSharpen: { value: 0.35 }, uSaturation: { value: 1.06 },
      uContrast: { value: 1.06 }, uLift: { value: new THREE.Vector3() },
      uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uDamage: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 400 },
      uDofStrength: { value: 0 }, uFlash: { value: 0 },
    });

    this.lumDownPass = new FullScreenPass(LUM_DOWN_FRAG, {
      uColor: { value: null }, uTexel: { value: V2() }, uIsFirst: { value: 1 },
    });
    this.lumAdaptPass = new FullScreenPass(LUM_ADAPT_FRAG, {
      uCurrent: { value: null }, uPrevious: { value: null }, uDt: { value: 0.016 },
      uSpeedUp: { value: 2.6 }, uSpeedDown: { value: 1.1 },
      uMinLum: { value: 0.01 }, uMaxLum: { value: 3.0 },
    });

    this.fxaaPass = new FullScreenPass(FXAA_FRAG, { uColor: { value: null }, uTexel: { value: V2() } });

    this.bloomRTs = [];
    this.bloomUpRTs = [];
  }

  setQuality(quality) {
    const p = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
    this.quality = quality;
    this.preset = p;
    this.aoPass.material.defines.AO_SAMPLES = p.aoSamples;
    this.aoPass.material.needsUpdate = true;
    this.volPass.material.defines.VOL_STEPS = p.volSteps;
    this.volPass.material.needsUpdate = true;
    // Re-derive taps and radius from the new preset, keeping the player's
    // slider position. Doing it here rather than inline means setQuality and
    // setMotionBlurScale can arrive in either order without disagreeing.
    this._applyMotionBlurTaps();
    this.ssrPass.material.defines.SSR_STEPS = p.ssrSteps;
    this.ssrPass.material.needsUpdate = true;
    this.compositePass.set('uSharpen', p.sharpen);
    // Force a rebuild so the MSAA sample count and buffer scales take effect.
    this._sizeKey = null;
    if (this.width > 1) this.setSize(this.width, this.height, this._pixelRatio || 1);
  }

  // The player's motion blur slider, 0..1.5, where 1 is the art-directed
  // default. It scales the sampled LENGTH, which is the only thing that reads
  // on screen once the camera is moving at combat speed — and it buys the taps
  // to pay for that length, so the 1.6px spacing that keeps the smear free of
  // combing holds identically at every setting.
  //
  // Deliberately NOT a per-frame knob: changing the tap count edits a #define
  // and recompiles the shader, so this is only safe to call on an options
  // change. The per-frame knob is motionBlurStrength.
  setMotionBlurScale(scale) {
    const s = Number.isFinite(scale) ? Math.max(0, scale) : 1;
    if (s === this._mbScale) return;
    this._mbScale = s;
    this._applyMotionBlurTaps();
  }

  _applyMotionBlurTaps() {
    const base = this.preset?.mbSamples || 0;
    // At zero the pass does not run at all, so leave the compiled tap count
    // alone: recompiling on the way to Off would cost a hitch to configure a
    // shader nothing is about to execute.
    if (!base || this._mbScale <= 0.001) return;
    const taps = Math.max(MB_TAPS_MIN, Math.min(MB_TAPS_MAX, Math.round(base * this._mbScale)));
    // Radius always follows taps. This is the invariant — never set one alone.
    this.mbPass.set('uMaxRadius', taps * MB_TAP_SPACING);
    if (taps === this._mbTaps) return;   // no recompile unless the count moved
    this._mbTaps = taps;
    this.mbPass.material.defines.MB_SAMPLES = taps;
    this.mbPass.material.needsUpdate = true;
  }

  setSize(cssWidth, cssHeight, pixelRatio = 1) {
    // FLOOR, not round — three's setSize does `Math.floor(css * pixelRatio)` for
    // the canvas and for the gl viewport it derives from it. Rounding here made
    // every buffer in this stack up to one row and one column LARGER than the
    // backbuffer it is finally blitted into, at any non-integer pixel ratio
    // (the tiers are 1 / 1.15 / 1.5, and the dynamic scaler lands on 1.2, 1.35,
    // ...). The final pass then maps [0,1] of an h+1 texture across h viewport
    // rows, so the whole image is resampled by a fraction of a pixel that drifts
    // from top to bottom, and FXAA's uTexel — 1/bufH — no longer matches the
    // pixels it is antialiasing. Matching three exactly costs nothing and makes
    // the blit one-to-one.
    const w = Math.max(1, Math.floor(cssWidth * pixelRatio));
    const h = Math.max(1, Math.floor(cssHeight * pixelRatio));
    const key = `${w}x${h}:${this.quality}`;
    if (key === this._sizeKey) return;
    this._sizeKey = key;
    this.width = cssWidth; this.height = cssHeight;
    this._pixelRatio = pixelRatio;
    this.bufW = w; this.bufH = h;

    this._disposeTargets();
    const p = this.preset;

    const depth = new THREE.DepthTexture(w, h, THREE.FloatType);
    depth.format = THREE.DepthFormat;
    depth.minFilter = THREE.NearestFilter;
    depth.magFilter = THREE.NearestFilter;

    this.sceneRT = makeRT(w, h, { depthBuffer: true, samples: p.msaa });
    this.sceneRT.depthTexture = depth;

    // The ping-pong HDR buffers carry their own depth RENDERBUFFER (not a
    // texture): the viewmodel pass draws into whichever buffer is current and
    // needs depth to sort its own parts, but must never touch the scene depth
    // TEXTURE that SSAO, volumetrics, motion blur and DOF sample.
    this.hdrA = makeRT(w, h, { depthBuffer: true });
    this.hdrB = makeRT(w, h, { depthBuffer: true });
    this.ldrRT = makeRT(w, h, { type: THREE.UnsignedByteType });

    const aos = p.aoScale || 0.5;
    this.aoW = Math.max(1, Math.round(w * aos));
    this.aoH = Math.max(1, Math.round(h * aos));
    this.aoRT = makeRT(this.aoW, this.aoH, { type: THREE.HalfFloatType });
    this.aoRT2 = makeRT(this.aoW, this.aoH, { type: THREE.HalfFloatType });

    const vs = p.volScale || 0.5;
    this.volW = Math.max(1, Math.round(w * vs));
    this.volH = Math.max(1, Math.round(h * vs));
    this.volRT = makeRT(this.volW, this.volH);

    // Luminance reduction chain: successive 4x downsamples to 1x1, plus two
    // 1x1 targets ping-ponged to hold the adapted value across frames. All of
    // it is a few thousand pixels total, and it never leaves the GPU.
    this.lumRTs = [];
    {
      let lw = Math.max(1, w >> 2), lh = Math.max(1, h >> 2);
      for (let i = 0; i < 8; i++) {
        this.lumRTs.push(makeRT(lw, lh, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter }));
        if (lw === 1 && lh === 1) break;
        lw = Math.max(1, lw >> 2); lh = Math.max(1, lh >> 2);
      }
      // The adapted-luminance pair is 1x1 and carries no resolution-dependent
      // state, so it deliberately SURVIVES a resize. It used to be rebuilt
      // here, which reset _adaptPrimed and fed the adapt pass a black
      // uPrevious; that shader treats a non-positive previous value as "first
      // frame" and snaps straight to the instantaneous scene luminance. Since
      // the whole point of adaptation is that the adapted value differs from
      // the instantaneous one, every resize produced a one-frame full-screen
      // brightness jump. Dynamic resolution resizes during play, so that fired
      // while walking around and read as the entire image flickering.
      if (!this.adaptRT) {
        this.adaptRT = [makeRT(1, 1, { type: THREE.HalfFloatType }), makeRT(1, 1, { type: THREE.HalfFloatType })];
        this.adaptIndex = 0;
        this._adaptPrimed = false;
      }
    }

    this.bloomRTs = [];
    this.bloomUpRTs = [];
    let bw = w, bh = h;
    for (let i = 0; i < Math.min(BLOOM_MIPS, p.bloomMips); i++) {
      bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1);
      this.bloomRTs.push(makeRT(bw, bh));
      this.bloomUpRTs.push(makeRT(bw, bh));
      if (bw <= 2 || bh <= 2) break;
    }
  }

  _disposeTargets() {
    for (const rt of this.lumRTs || []) rt.dispose();
    // adaptRT is intentionally NOT disposed here: _disposeTargets runs on every
    // resize, and the adapted exposure has to survive one. It is released in
    // dispose() instead, which is the only place the stack really goes away.
    this.lumRTs = [];
    for (const rt of [this.sceneRT, this.hdrA, this.hdrB, this.ldrRT, this.aoRT, this.aoRT2, this.volRT]) rt?.dispose();
    for (const rt of this.bloomRTs) rt.dispose();
    for (const rt of this.bloomUpRTs) rt.dispose();
    this.sceneRT?.depthTexture?.dispose();
    this.bloomRTs = []; this.bloomUpRTs = [];
  }

  get blackTexture() {
    if (!this._blackTex) {
      this._blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      this._blackTex.needsUpdate = true;
    }
    return this._blackTex;
  }

  // ----------------------------------------------------------------- render
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} dt
   * @param {Function} [drawViewmodel] optional callback rendering the weapon on
   *        top of the world into the same HDR target with its own FOV.
   */
  render(scene, camera, dt = 0.016, drawViewmodel = null) {
    const r = this.renderer;
    if (!this.enabled || !this.sceneRT) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    this.frame++;
    const p = this.preset;
    const near = camera.near, far = camera.far;

    // ---- 1. world into the HDR buffer ----
    const prevAutoClear = r.autoClear;
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);

    camera.updateMatrixWorld();
    this._projInv.copy(camera.projectionMatrixInverse);
    this._viewInv.copy(camera.matrixWorld);
    this._camPos.setFromMatrixPosition(camera.matrixWorld);
    this._curViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    const depthTex = this.sceneRT.depthTexture;

    // ---- 2. ambient occlusion (half res + bilateral blur) ----
    let aoTex = null;
    if (p.aoScale > 0 && this.aoStrength > 0.001) {
      const ao = this.aoPass;
      ao.set('uDepth', depthTex);
      ao.uniforms.uProjInv.value.copy(this._projInv);
      ao.uniforms.uProj.value.copy(camera.projectionMatrix);
      ao.uniforms.uResolution.value.set(this.aoW, this.aoH);
      ao.set('uNear', near).set('uFar', far).set('uFrame', this.frame % 64);
      ao.set('uRadius', this.aoRadius).set('uIntensity', this.aoIntensity);
      ao.render(r, this.aoRT);

      const bl = this.aoBlurPass;
      bl.set('uNear', near).set('uFar', far);
      bl.uniforms.uTexel.value.set(1 / this.aoW, 1 / this.aoH);
      bl.set('uAO', this.aoRT.texture);
      bl.uniforms.uDir.value.set(1, 0);
      bl.render(r, this.aoRT2);
      bl.set('uAO', this.aoRT2.texture);
      bl.uniforms.uDir.value.set(0, 1);
      bl.render(r, this.aoRT);
      aoTex = this.aoRT.texture;
    }

    // ---- 3. volumetric light shafts ----
    let volTex = null;
    if (p.volScale > 0 && this.volDensity > 1e-5) {
      const v = this.volPass;
      const light = this.shadowLight;
      const shadowMap = light?.shadow?.map?.texture || null;
      v.set('uDepth', depthTex);
      v.set('uShadow', shadowMap || this.blackTexture);
      if (shadowMap) v.uniforms.uShadowMatrix.value.copy(light.shadow.matrix);
      else v.uniforms.uShadowMatrix.value.copy(this._identityShadow);
      v.uniforms.uProjInv.value.copy(this._projInv);
      v.uniforms.uViewInv.value.copy(this._viewInv);
      v.uniforms.uCamPos.value.copy(this._camPos);
      v.uniforms.uSunDir.value.copy(this.sunDir);
      v.uniforms.uSunColor.value.set(this.sunColor.r, this.sunColor.g, this.sunColor.b);
      v.uniforms.uAmbientColor.value.set(this.volAmbientColor.r, this.volAmbientColor.g, this.volAmbientColor.b);
      v.set('uNear', near).set('uFar', far).set('uFrame', this.frame % 64);
      v.set('uDensity', shadowMap ? this.volDensity : this.volDensity * 0.6);
      v.set('uHeightFalloff', this.volHeightFalloff).set('uFogBase', this.volFogBase);
      v.set('uAnisotropy', this.volAnisotropy).set('uMaxDist', this.volMaxDist);
      v.set('uAmbient', this.volAmbient);
      // Nearest practicals, refreshed by the game each frame.
      const pp = v.uniforms.uPointPos.value;
      const pc = v.uniforms.uPointColor.value;
      const list = this.volLights;
      for (let i = 0; i < pp.length; i++) {
        const L = list && list[i];
        if (L) {
          pp[i].set(L.x, L.y, L.z, L.radius);
          pc[i].set(L.r, L.g, L.b, L.intensity);
        } else {
          pc[i].w = 0;
        }
      }
      v.render(r, this.volRT);
      volTex = this.volRT.texture;
    }

    // ---- 4. resolve AO + shafts onto the scene color ----
    let src = this.hdrA;
    {
      const rp = this.resolvePass;
      rp.set('uColor', this.sceneRT.texture);
      rp.set('uVolume', volTex || this.blackTexture);
      rp.set('uAO', aoTex || this.blackTexture);
      rp.set('uDepth', depthTex);
      rp.uniforms.uTexelHalf.value.set(1 / this.aoW, 1 / this.aoH);
      rp.set('uNear', near).set('uFar', far);
      rp.set('uAOStrength', aoTex ? this.aoStrength : 0);
      // The 1x1 black fallback has a = 1, so `col * vol.a + vol.rgb` is a no-op
      // when volumetrics are off — no branch or shader variant needed.
      rp.render(r, src);
    }

    // ---- 4b. screen-space reflections on standing water ----
    if (p.ssr && this.ssrStrength > 0.001) {
      const sp = this.ssrPass;
      sp.set('uColor', src.texture).set('uDepth', depthTex);
      sp.uniforms.uProj.value.copy(camera.projectionMatrix);
      sp.uniforms.uProjInv.value.copy(this._projInv);
      sp.uniforms.uViewInv.value.copy(this._viewInv);
      sp.uniforms.uResolution.value.set(this.bufW, this.bufH);
      sp.set('uNear', near).set('uFar', far).set('uFrame', this.frame % 64);
      sp.set('uStrength', this.ssrStrength).set('uMaxDist', this.ssrMaxDist);
      sp.set('uThickness', this.ssrThickness);
      sp.set('uWetScale', this.ssrWetScale).set('uWetHeight', this.ssrWetHeight);
      const dst = src === this.hdrA ? this.hdrB : this.hdrA;
      sp.render(r, dst);
      src = dst;
    }

    // ---- 5. camera motion blur ----
    // A teleport, respawn or spectator switch moves the camera metres in one
    // frame; reprojecting against the old matrix would smear the whole screen.
    // Treat any jump beyond a plausible single-frame step as a cut.
    const jumped = this._prevCamPos
      ? this._camPos.distanceToSquared(this._prevCamPos) > Math.max(0.25, (24 * dt) ** 2)
      : true;
    (this._prevCamPos || (this._prevCamPos = new THREE.Vector3())).copy(this._camPos);
    if (jumped) this._prevViewProj.copy(this._curViewProj);

    if (p.motionBlur && this.motionBlurStrength > 0.001 && this.frame > 2 && !jumped) {
      const mb = this.mbPass;
      mb.set('uColor', src.texture);
      mb.set('uDepth', depthTex);
      mb.uniforms.uProjInv.value.copy(this._projInv);
      mb.uniforms.uViewInv.value.copy(this._viewInv);
      mb.uniforms.uPrevViewProj.value.copy(this._prevViewProj);
      mb.uniforms.uResolution.value.set(this.bufW, this.bufH);
      // Normalize against frame time so blur length is shutter-based, not fps-based.
      mb.set('uStrength', this.motionBlurStrength * Math.min(2.5, (1 / 60) / Math.max(1e-4, dt)));
      mb.set('uFrame', this.frame % 64);
      const dst = src === this.hdrA ? this.hdrB : this.hdrA;
      mb.render(r, dst);
      src = dst;
    }

    // ---- 6. depth of field ----
    if (p.dof && this.dofMaxBlur > 0.5) {
      const dp = this.dofPass;
      dp.set('uColor', src.texture).set('uDepth', depthTex);
      dp.uniforms.uTexel.value.set(1 / this.bufW, 1 / this.bufH);
      dp.set('uNear', near).set('uFar', far);
      dp.set('uFocusDist', this.dofFocus).set('uFocusRange', this.dofRange);
      dp.set('uMaxBlur', this.dofMaxBlur).set('uFrame', this.frame % 64);
      const dst = src === this.hdrA ? this.hdrB : this.hdrA;
      dp.render(r, dst);
      src = dst;
    }

    // ---- 6b. viewmodel ----
    // Drawn once every depth-consuming pass has finished, straight into the
    // current HDR buffer. That order is deliberate: the weapon still picks up
    // bloom, tone mapping, grading, grain and AA, but it is excluded from
    // SSAO, volumetrics, motion blur and depth of field — a weapon welded to
    // the camera should neither smear when you turn nor cast a wall of
    // occlusion across the whole screen.
    if (drawViewmodel) {
      r.autoClear = false;
      // The weapon is one object in a frame that has already cost a world pass,
      // AO and volumetrics. If it fails to draw, finish the frame without it and
      // show the player the world, rather than losing the whole image to the gun.
      try {
        drawViewmodel(src);
      } catch (e) {
        if (!this._vmDrawFailed) { this._vmDrawFailed = true; console.error('viewmodel draw failed', e); }
        r.setRenderTarget(src);
      }
      r.autoClear = prevAutoClear;
    }

    // ---- 7. bloom chain ----
    let bloomTex = this.blackTexture;
    if (this.bloomRTs.length && this.bloomStrength > 0.001) {
      const pre = this.bloomPre;
      pre.set('uColor', src.texture).set('uThreshold', this.bloomThreshold);
      pre.uniforms.uTexel.value.set(1 / this.bufW, 1 / this.bufH);
      pre.render(r, this.bloomRTs[0]);

      for (let i = 1; i < this.bloomRTs.length; i++) {
        const from = this.bloomRTs[i - 1];
        this.bloomDown.set('uColor', from.texture);
        this.bloomDown.uniforms.uTexel.value.set(1 / from.width, 1 / from.height);
        this.bloomDown.render(r, this.bloomRTs[i]);
      }

      const last = this.bloomRTs.length - 1;
      let current = this.bloomRTs[last];
      for (let i = last - 1; i >= 0; i--) {
        const up = this.bloomUp;
        up.set('uColor', current.texture);
        up.set('uPrev', this.bloomRTs[i].texture);
        up.uniforms.uTexel.value.set(1 / current.width, 1 / current.height);
        up.set('uRadius', 1.25);
        up.render(r, this.bloomUpRTs[i]);
        current = this.bloomUpRTs[i];
      }
      bloomTex = current.texture;
    }

    // ---- 7b. auto-exposure measurement ----
    if (this.autoExposure > 0.001 && this.lumRTs.length && this.adaptRT) {
      const ld = this.lumDownPass;
      let from = src.texture, fromW = this.bufW, fromH = this.bufH;
      for (let i = 0; i < this.lumRTs.length; i++) {
        ld.set('uColor', from).set('uIsFirst', i === 0 ? 1 : 0);
        ld.uniforms.uTexel.value.set(1 / fromW, 1 / fromH);
        ld.render(r, this.lumRTs[i]);
        from = this.lumRTs[i].texture; fromW = this.lumRTs[i].width; fromH = this.lumRTs[i].height;
      }
      const prev = this.adaptRT[this.adaptIndex];
      const next = this.adaptRT[1 - this.adaptIndex];
      const ap = this.lumAdaptPass;
      ap.set('uCurrent', this.lumRTs[this.lumRTs.length - 1].texture);
      ap.set('uPrevious', this._adaptPrimed ? prev.texture : this.blackTexture);
      ap.set('uDt', Math.min(0.1, dt)).set('uSpeedUp', this.adaptUp).set('uSpeedDown', this.adaptDown);
      ap.set('uMinLum', this.minLum).set('uMaxLum', this.maxLum);
      ap.render(r, next);
      this.adaptIndex = 1 - this.adaptIndex;
      this._adaptPrimed = true;
      this._adaptedTex = next.texture;
    } else {
      this._adaptedTex = null;
    }

    // ---- 8. composite (tonemap + grade + grain) ----
    {
      const c = this.compositePass;
      c.set('uColor', src.texture).set('uBloom', bloomTex).set('uDepth', depthTex);
      c.set('uAdaptedLum', this._adaptedTex || this.blackTexture);
      c.set('uAutoExposure', this._adaptedTex ? this.autoExposure : 0);
      c.set('uKeyValue', this.keyValue);
      c.uniforms.uResolution.value.set(this.bufW, this.bufH);
      c.set('uTime', (this.frame % 4096) * 0.017);
      c.set('uExposure', this.exposure).set('uBloomStrength', this.bloomStrength);
      c.set('uChromatic', this.chromatic).set('uVignette', this.vignette);
      c.set('uGrain', this.grain).set('uSaturation', this.saturation).set('uContrast', this.contrast);
      c.uniforms.uLift.value.copy(this.lift);
      c.uniforms.uGamma.value.copy(this.gamma);
      c.uniforms.uGain.value.copy(this.gain);
      c.set('uDamage', this.damage).set('uFlash', this.flash);
      c.set('uNear', near).set('uFar', far);
      c.render(r, p.fxaa ? this.ldrRT : null);
    }

    // ---- 9. FXAA to the backbuffer ----
    if (p.fxaa) {
      this.fxaaPass.set('uColor', this.ldrRT.texture);
      this.fxaaPass.uniforms.uTexel.value.set(1 / this.bufW, 1 / this.bufH);
      this.fxaaPass.render(r, null);
    }

    r.setRenderTarget(null);
    this._prevViewProj.copy(this._curViewProj);
  }

  dispose() {
    this._disposeTargets();
    // _disposeTargets deliberately spares adaptRT so it survives a resize; this
    // is the one place it genuinely goes away.
    for (const rt of this.adaptRT || []) rt.dispose();
    this.adaptRT = null;
    this._adaptPrimed = false;
    for (const k of ['aoPass', 'aoBlurPass', 'volPass', 'resolvePass', 'ssrPass', 'mbPass',
      'dofPass', 'bloomPre', 'bloomDown', 'bloomUp', 'lumDownPass', 'lumAdaptPass',
      'compositePass', 'fxaaPass']) this[k]?.dispose();
    this._blackTex?.dispose();
  }
}

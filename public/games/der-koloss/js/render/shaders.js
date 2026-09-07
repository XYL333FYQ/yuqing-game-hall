// GLSL library for the deferred post stack.
// Every pass reads the scene depth buffer, so the reconstruction helpers live
// in one place and are string-concatenated into each fragment shader.

export const COMMON = /* glsl */`
precision highp float;
precision highp sampler2D;
varying vec2 vUv;

#define PI  3.14159265359
#define TAU 6.28318530718

// ---- depth ----------------------------------------------------------------
// uDepth stores window-space depth in [0,1]; uProjInv undoes the projection.
float rawDepth(sampler2D d, vec2 uv) { return texture2D(d, uv).x; }

float linearizeDepth(float d, float near, float far) {
  // Returns view-space Z (negative in front of the camera).
  return (near * far) / ((far - near) * d - far);
}

vec3 viewPosFromDepth(vec2 uv, float d, mat4 projInv) {
  vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = projInv * clip;
  return v.xyz / v.w;
}

// Min-difference normal reconstruction: picks the shorter of the two depth
// gradients on each axis so silhouettes do not smear a fake bevel.
vec3 normalFromDepth(sampler2D dTex, vec2 uv, vec2 texel, mat4 projInv) {
  float c  = rawDepth(dTex, uv);
  vec3  P  = viewPosFromDepth(uv, c, projInv);
  vec2 dx = vec2(texel.x, 0.0), dy = vec2(0.0, texel.y);
  vec3 pL = viewPosFromDepth(uv - dx, rawDepth(dTex, uv - dx), projInv);
  vec3 pR = viewPosFromDepth(uv + dx, rawDepth(dTex, uv + dx), projInv);
  vec3 pD = viewPosFromDepth(uv - dy, rawDepth(dTex, uv - dy), projInv);
  vec3 pU = viewPosFromDepth(uv + dy, rawDepth(dTex, uv + dy), projInv);
  vec3 hDeriv = abs(pR.z - P.z) < abs(P.z - pL.z) ? (pR - P) : (P - pL);
  vec3 vDeriv = abs(pU.z - P.z) < abs(P.z - pD.z) ? (pU - P) : (P - pD);
  vec3 n = normalize(cross(hDeriv, vDeriv));
  return n.z < 0.0 ? -n : n;
}

// ---- noise ----------------------------------------------------------------
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
// Interleaved gradient noise — the standard cheap dither for temporal passes.
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

// ---- NaN hygiene ----------------------------------------------------------
// clamp() and max() do NOT reject NaN: every comparison against NaN is false,
// so min(max(NaN, lo), hi) hands the NaN straight back. That is normally a
// cosmetic single-pixel problem, but auto-exposure feeds a 1x1 target back
// into itself every frame, so one NaN anywhere in the HDR buffer latches the
// adapted luminance to NaN forever and the whole screen goes black with no way
// out but a reload. Written as a ternary on "x > lo" so NaN falls through to
// the lo branch. (No backticks in this file: the GLSL lives in a JS template
// literal, so a stray backtick here ends the string and breaks the module.)
float safeVal(float x, float lo, float hi) {
  return (x > lo) ? ((x < hi) ? x : hi) : lo;
}
vec3 safeRGB(vec3 c) {
  const float HDR_MAX = 65504.0;   // largest finite half-float
  return vec3(safeVal(c.r, 0.0, HDR_MAX), safeVal(c.g, 0.0, HDR_MAX), safeVal(c.b, 0.0, HDR_MAX));
}

// ---- color ----------------------------------------------------------------
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 linearToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
`;

// ---------------------------------------------------------------------------
// Ambient occlusion — McGuire's Scalable Ambient Obscurance with a spiral tap
// pattern. Half resolution, then bilaterally upsampled.
// ---------------------------------------------------------------------------
export const AO_FRAG = COMMON + /* glsl */`
uniform sampler2D uDepth;
uniform mat4 uProjInv;
uniform mat4 uProj;
uniform vec2 uResolution;   // AO buffer resolution
uniform float uNear, uFar;
uniform float uRadius;      // world-space sample radius
uniform float uIntensity;
uniform float uBias;
uniform float uFrame;

#ifndef AO_SAMPLES
#define AO_SAMPLES 12
#endif
#define SPIRAL_TURNS 7.0

void main() {
  vec2 texel = 1.0 / uResolution;
  float d = rawDepth(uDepth, vUv);
  if (d >= 0.9999) { gl_FragColor = vec4(1.0, d, 0.0, 1.0); return; }

  vec3 P = viewPosFromDepth(vUv, d, uProjInv);
  // Reconstruct the normal over a DOUBLE-WIDTH tap cross, not the 1-texel one.
  //
  // normalFromDepth picks the shorter of the two depth gradients per axis. On a
  // floor running away from the camera the two sides are nearly equal, so which
  // one wins is decided by the last bits of the depth difference — and that
  // flips back and forth in bands of constant depth. On a floor, constant depth
  // is a horizontal line, so the normal tilts one way for a few rows and the
  // other way for the next few, AO follows it, and the result is dark horizontal
  // lines ruled across the ground near the bottom of the screen. They move with
  // the player, which is what made them read as a post-process artifact; they
  // are not. No pass toggle changes them because the defect is upstream of every
  // pass, in the normal this one derives from depth.
  //
  // Doubling the baseline makes the real gradient large compared to the noise
  // deciding the tie, so the choice stops oscillating. The taps are still narrow
  // enough that a genuine silhouette wins the comparison outright, which is the
  // property min-difference was chosen for. Measured on the courtyard floor: the
  // three banded rows go from -7.7/-5.7/-5.1% below their neighbours to
  // -1.0/-0.7/-0.6%, i.e. to the same level as AO switched off entirely, while
  // total AO darkening is retained (mean luma 106.0 vs 104.7 baseline, 108.5 with
  // AO off). Widening further (x3, x4) starts erasing real contact occlusion.
  //
  // Scoped to this call: SSR's puddle mask (below) wants the tight cross, since
  // it is masking small flat pools and runs at full resolution.
  vec3 n = normalFromDepth(uDepth, vUv, texel * 2.0, uProjInv);

  // Screen-space radius of the world-space sphere at this depth.
  float projScale = 0.5 * uResolution.y * uProj[1][1];
  float screenRadius = projScale * uRadius / max(0.15, -P.z);
  screenRadius = min(screenRadius, uResolution.y * 0.14); // cap the search cost

  float phi = hash12(gl_FragCoord.xy + uFrame * 7.13) * TAU;
  float r2 = uRadius * uRadius;
  float sum = 0.0;

  for (int i = 0; i < AO_SAMPLES; i++) {
    float alpha = (float(i) + 0.5) / float(AO_SAMPLES);
    float h = screenRadius * alpha;
    float theta = alpha * SPIRAL_TURNS * TAU + phi;
    vec2 uv2 = vUv + vec2(cos(theta), sin(theta)) * h * texel;
    if (uv2.x < 0.0 || uv2.x > 1.0 || uv2.y < 0.0 || uv2.y > 1.0) continue;

    float d2 = rawDepth(uDepth, uv2);
    if (d2 >= 0.9999) continue;
    vec3 Q = viewPosFromDepth(uv2, d2, uProjInv);
    vec3 v = Q - P;
    float vv = dot(v, v);
    float vn = dot(v, n);
    float f = max(r2 - vv, 0.0);
    sum += f * f * f * max((vn - uBias) / (0.015 + vv), 0.0);
  }

  float ao = max(0.0, 1.0 - sum * (5.0 * uIntensity) / (float(AO_SAMPLES) * pow(uRadius, 6.0)));
  // Fade AO out at distance: contact shadows past ~40m are noise, not detail.
  ao = mix(ao, 1.0, smoothstep(28.0, 60.0, -P.z));
  gl_FragColor = vec4(ao, d, 0.0, 1.0);
}
`;

// Depth-aware separable blur. .r = AO, .g = raw depth (carried for the filter).
export const AO_BLUR_FRAG = COMMON + /* glsl */`
uniform sampler2D uAO;
uniform vec2 uTexel;
uniform vec2 uDir;
uniform float uNear, uFar;

void main() {
  vec2 c = texture2D(uAO, vUv).rg;
  float centerZ = linearizeDepth(c.g, uNear, uFar);
  float sum = c.r, wsum = 1.0;
  for (int i = 1; i <= 4; i++) {
    float w0 = exp(-float(i * i) / 8.0);
    for (int s = -1; s <= 1; s += 2) {
      vec2 uv = vUv + uDir * uTexel * float(i * s);
      vec2 t = texture2D(uAO, uv).rg;
      float z = linearizeDepth(t.g, uNear, uFar);
      float w = w0 * exp(-abs(z - centerZ) * 2.2);
      sum += t.r * w; wsum += w;
    }
  }
  gl_FragColor = vec4(sum / wsum, c.g, 0.0, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Volumetric fog / light shafts. Raymarches the camera ray against the sun
// (moon) cascade shadow map, plus a height-falloff medium.
// ---------------------------------------------------------------------------
export const VOLUMETRIC_FRAG = COMMON + /* glsl */`
uniform sampler2D uDepth;
uniform sampler2D uShadow;
uniform mat4 uShadowMatrix;
uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform vec3 uCamPos;
uniform vec3 uSunDir;        // world-space direction TOWARD the light
uniform vec3 uSunColor;
uniform float uNear, uFar;
uniform float uDensity;
uniform float uHeightFalloff;
uniform float uFogBase;      // world Y where the medium is densest
uniform float uAnisotropy;
uniform float uFrame;
uniform float uMaxDist;
uniform float uAmbient;
uniform vec3 uAmbientColor;
uniform float uShadowRadius;
uniform float uShadowEdgeFade;   // must match SHADOW_EDGE_FADE

// Local practicals that also scatter into the medium. Four is enough: the game
// feeds the nearest active lamps each frame, and beyond that the contribution
// is below the dither floor anyway.
#ifndef VOL_LIGHTS
#define VOL_LIGHTS 4
#endif
uniform vec4 uPointPos[VOL_LIGHTS];    // xyz = world position, w = radius
uniform vec4 uPointColor[VOL_LIGHTS];  // rgb = colour, a = intensity

#ifndef VOL_STEPS
#define VOL_STEPS 28
#endif

const float PackUpscale = 256.0 / 255.0;
const float UnpackDownscale = 255.0 / 256.0;
const vec3 PackFactors = vec3(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0);
const vec4 UnpackFactors = vec4(UnpackDownscale / PackFactors, UnpackDownscale);
float unpackDepth(vec4 v) { return dot(v, UnpackFactors); }

// The raymarch samples the sun's shadow map itself, so it needs the same edge
// ramp the surface shader gets from ShadowEdgeFade.js. Without it the shaft
// geometry stays hard-edged at the box boundary even once the floor under it
// fades smoothly, and the mismatch is more obvious than either alone.
float sunVisibility(vec3 worldPos) {
  vec4 sc = uShadowMatrix * vec4(worldPos, 1.0);
  vec3 s = sc.xyz / sc.w;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0) return 1.0;
  float d = unpackDepth(texture2D(uShadow, s.xy));
  float vis = step(s.z - 0.0016, d);
  vec2 e = abs(s.xy - 0.5) * 2.0;
  float fade = 1.0 - smoothstep(1.0 - uShadowEdgeFade, 1.0, max(e.x, e.y));
  return mix(1.0, vis, fade);
}

// Henyey-Greenstein phase function.
float phaseHG(float cosT, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1e-4, 1.0 + g2 - 2.0 * g * cosT), 1.5));
}

void main() {
  float d = rawDepth(uDepth, vUv);
  vec3 viewP = viewPosFromDepth(vUv, d, uProjInv);
  vec3 worldP = (uViewInv * vec4(viewP, 1.0)).xyz;
  vec3 ray = worldP - uCamPos;
  float dist = min(length(ray), uMaxDist);
  vec3 dir = normalize(ray);

  float cosT = dot(dir, uSunDir);
  float phase = phaseHG(cosT, uAnisotropy);

  float jitter = ign(gl_FragCoord.xy + uFrame * 5.588238);
  float stepLen = dist / float(VOL_STEPS);

  vec3 scatter = vec3(0.0);
  float transmittance = 1.0;

  for (int i = 0; i < VOL_STEPS; i++) {
    float t = (float(i) + jitter) * stepLen;
    vec3 p = uCamPos + dir * t;
    // Exponential height fog: thick at the factory floor, thin overhead.
    float density = uDensity * exp(-max(0.0, p.y - uFogBase) * uHeightFalloff);
    if (density < 1e-5) continue;
    float sigma = density * stepLen;
    float vis = sunVisibility(p);
    vec3 inScatter = uSunColor * vis * phase * 4.0 + uAmbientColor * uAmbient;

    // Local practicals: unshadowed, but with the same phase function, so the
    // haze around a lamp brightens sharply when you look toward it. This is
    // what turns the hanging sodium bulbs into visible cones of light.
    for (int li = 0; li < VOL_LIGHTS; li++) {
      float intensity = uPointColor[li].a;
      if (intensity <= 0.0001) continue;
      vec3 toL = uPointPos[li].xyz - p;
      float d2 = dot(toL, toL);
      float radius = uPointPos[li].w;
      if (d2 > radius * radius) continue;
      float d = sqrt(max(d2, 1e-4));
      // Inverse-square with a windowed cutoff so a lamp's halo ends cleanly.
      float win = max(0.0, 1.0 - d2 / (radius * radius));
      float atten = win * win / (d2 + 0.25);
      float lPhase = phaseHG(dot(dir, toL / d), uAnisotropy * 0.55);
      inScatter += uPointColor[li].rgb * intensity * atten * lPhase * 5.0;
    }

    scatter += transmittance * inScatter * sigma;
    transmittance *= exp(-sigma);
    if (transmittance < 0.01) break;
  }

  gl_FragColor = vec4(scatter, transmittance);
}
`;

export const VOL_UPSAMPLE_FRAG = COMMON + /* glsl */`
uniform sampler2D uColor;      // full-res scene
uniform sampler2D uVolume;     // half-res scatter (rgb) + transmittance (a)
uniform sampler2D uAO;         // half-res AO in .r
uniform sampler2D uDepth;
uniform vec2 uTexelHalf;
uniform float uNear, uFar;
uniform float uAOStrength;

void main() {
  vec3 base = texture2D(uColor, vUv).rgb;
  float centerZ = linearizeDepth(rawDepth(uDepth, vUv), uNear, uFar);

  // Joint bilateral upsample, 3x3 over the half-res buffers.
  //
  // This does double duty: it upsamples AND denoises. The volumetric raymarch
  // is dithered per pixel, so a plain box upsample leaves a visible checkered
  // pattern, and a naive 1/|dz| weight collapses at a depth discontinuity —
  // when every tap sits on the far side of a near edge the weights are all
  // equally bad and the far-side scatter bleeds over the near surface as a
  // block of flicker. Weighting exponentially on RELATIVE depth error, and
  // falling back to the single closest-depth tap when nothing matches, keeps
  // silhouettes clean instead of blocky.
  vec4 vol = vec4(0.0);
  float ao = 0.0;
  float wsum = 0.0;
  vec4 bestVol = vec4(0.0, 0.0, 0.0, 1.0);
  float bestAO = 1.0;
  float bestErr = 1e20;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 uv = vUv + vec2(float(x), float(y)) * uTexelHalf;
      vec2 aoTap = texture2D(uAO, uv).rg;
      vec4 volTap = texture2D(uVolume, uv);
      float z = linearizeDepth(aoTap.g, uNear, uFar);
      // Relative error: a 20cm gap matters at 2m and is noise at 50m.
      float err = abs(z - centerZ) / max(1.0, abs(centerZ));
      if (err < bestErr) { bestErr = err; bestVol = volTap; bestAO = aoTap.r; }
      float spatial = (x == 0 && y == 0) ? 1.0 : ((x == 0 || y == 0) ? 0.62 : 0.34);
      float w = spatial * exp(-err * 55.0);
      vol += volTap * w;
      ao += aoTap.r * w;
      wsum += w;
    }
  }

  if (wsum > 0.02) {
    vol /= wsum; ao /= wsum;
  } else {
    vol = bestVol; ao = bestAO;   // every tap crossed an edge — take the nearest
  }

  float occ = mix(1.0, ao, uAOStrength);
  vec3 col = base * occ;
  col = col * vol.a + vol.rgb;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Screen-space reflections, restricted to standing water.
//
// A full SSR pass would need a roughness buffer this pipeline does not have.
// Instead it reproduces exactly the puddle mask the surface shader uses (same
// hash, same fbm, same thresholds in js/render/Materials.js) and only traces
// where that mask says there is water: up-facing, low in the world, inside a
// pool. That is cheap, and it is the only place a mirror-sharp reflection is
// physically justified anyway.
// ---------------------------------------------------------------------------
export const SSR_FRAG = COMMON + /* glsl */`
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform mat4 uProj;
uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform vec2 uResolution;
uniform float uNear, uFar;
uniform float uStrength;
uniform float uMaxDist;
uniform float uThickness;
uniform float uWetScale;
uniform float uWetHeight;
uniform float uFrame;

#ifndef SSR_STEPS
#define SSR_STEPS 20
#endif
#define SSR_REFINE 4

// --- must stay identical to the puddle mask in Materials.js ---
float sHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float sNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(sHash(i), sHash(i + vec3(1,0,0)), f.x), mix(sHash(i + vec3(0,1,0)), sHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(sHash(i + vec3(0,0,1)), sHash(i + vec3(1,0,1)), f.x), mix(sHash(i + vec3(0,1,1)), sHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float sFbm(vec3 p) {
  return sNoise(p) * 0.55 + sNoise(p * 2.07) * 0.28 + sNoise(p * 4.11) * 0.17;
}

void main() {
  vec4 base = texture2D(uColor, vUv);
  float d = rawDepth(uDepth, vUv);
  if (d >= 0.9999) { gl_FragColor = base; return; }

  vec2 texel = 1.0 / uResolution;
  vec3 P = viewPosFromDepth(vUv, d, uProjInv);
  vec3 N = normalFromDepth(uDepth, vUv, texel, uProjInv);
  vec3 worldN = normalize((uViewInv * vec4(N, 0.0)).xyz);
  vec3 worldP = (uViewInv * vec4(P, 1.0)).xyz;

  float up = smoothstep(0.62, 0.92, worldN.y);
  float low = 1.0 - smoothstep(uWetHeight, uWetHeight + 1.4, worldP.y);
  float damp = smoothstep(0.42, 0.60, sFbm(worldP * uWetScale));
  float pool = smoothstep(0.52, 0.68, sFbm(worldP * uWetScale * 3.7 + 51.0)) * damp * up * low;
  if (pool < 0.02) { gl_FragColor = base; return; }

  vec3 viewDir = normalize(P);
  vec3 R = reflect(viewDir, N);
  if (R.z > 0.0) { gl_FragColor = base; return; }   // reflecting back at the eye

  // Fresnel for water (F0 ~ 0.02): almost nothing head-on, near-total at a
  // glancing angle. This is what makes a wet floor read as wet.
  float fres = 0.02 + 0.98 * pow(1.0 - max(0.0, dot(-viewDir, N)), 5.0);

  float stepLen = uMaxDist / float(SSR_STEPS);
  float jitter = ign(gl_FragCoord.xy + uFrame * 11.13);
  vec3 hitColor = vec3(0.0);
  float hit = 0.0;
  vec3 prev = P;

  for (int i = 1; i <= SSR_STEPS; i++) {
    vec3 sp = P + R * (float(i) + jitter) * stepLen;
    vec4 clip = uProj * vec4(sp, 1.0);
    if (clip.w <= 0.0) break;
    vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;

    float sceneD = rawDepth(uDepth, uv);
    if (sceneD >= 0.9999) { prev = sp; continue; }
    vec3 sceneP = viewPosFromDepth(uv, sceneD, uProjInv);
    float delta = sceneP.z - sp.z;   // >0 means the ray went behind geometry

    if (delta > 0.0 && delta < uThickness) {
      // Binary refine between the last miss and this hit for a crisp contact.
      vec3 a = prev, b = sp;
      for (int j = 0; j < SSR_REFINE; j++) {
        vec3 mid = (a + b) * 0.5;
        vec4 mc = uProj * vec4(mid, 1.0);
        vec2 muv = mc.xy / mc.w * 0.5 + 0.5;
        vec3 mp = viewPosFromDepth(muv, rawDepth(uDepth, muv), uProjInv);
        if (mp.z - mid.z > 0.0) b = mid; else a = mid;
      }
      vec4 fc = uProj * vec4(b, 1.0);
      vec2 fuv = fc.xy / fc.w * 0.5 + 0.5;
      hitColor = texture2D(uColor, fuv).rgb;
      // Fade at the screen edges — the information simply is not there.
      vec2 edge = smoothstep(vec2(0.0), vec2(0.12), fuv) * (1.0 - smoothstep(vec2(0.88), vec2(1.0), fuv));
      hit = edge.x * edge.y;
      break;
    }
    prev = sp;
  }

  float k = hit * fres * pool * uStrength;
  gl_FragColor = vec4(mix(base.rgb, hitColor, clamp(k, 0.0, 1.0)), base.a);
}
`;

// ---------------------------------------------------------------------------
// Camera motion blur reconstructed from depth + the previous view-projection.
// ---------------------------------------------------------------------------
export const MOTION_BLUR_FRAG = COMMON + /* glsl */`
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform mat4 uPrevViewProj;
uniform vec2 uResolution;
uniform float uStrength;
uniform float uMaxRadius;   // in pixels
uniform float uFrame;

#ifndef MB_SAMPLES
#define MB_SAMPLES 10
#endif

void main() {
  float d = rawDepth(uDepth, vUv);
  vec3 viewP = viewPosFromDepth(vUv, d, uProjInv);
  vec4 worldP = uViewInv * vec4(viewP, 1.0);

  vec4 prevClip = uPrevViewProj * worldP;
  vec2 prevUv = (prevClip.xy / prevClip.w) * 0.5 + 0.5;
  vec2 velocity = (vUv - prevUv) * uStrength;

  // Clamp so a fast whip-turn smears instead of sampling the whole screen.
  vec2 px = velocity * uResolution;
  float len = length(px);
  if (len < 0.6) { gl_FragColor = texture2D(uColor, vUv); return; }
  if (len > uMaxRadius) velocity *= uMaxRadius / len;

  float jitter = ign(gl_FragCoord.xy + uFrame * 3.917);
  vec3 sum = texture2D(uColor, vUv).rgb;
  float wsum = 1.0;
  for (int i = 0; i < MB_SAMPLES; i++) {
    float t = (float(i) + jitter) / float(MB_SAMPLES) - 0.5;
    vec2 uv = vUv + velocity * t;
    // Reject taps that leave the frame. The colour target is clamp-to-edge, so
    // an out-of-range tap returns the border pixel over and over — which is
    // exactly what smeared dark streaks along the bottom of the screen while
    // running, where the near ground has the largest velocity.
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;
    // Reject taps on geometry substantially NEARER than this pixel. Those
    // belong to a different surface, and dragging them outward is what turned
    // the lit floor edge into a comb of bright streaks over the dark ground
    // while running. Smoothstep rather than step: a binary cutoff just moves
    // the artifact to wherever the threshold lands.
    float dz = rawDepth(uDepth, uv);
    float w = 1.0 - smoothstep(0.0002, 0.0022, d - dz);
    sum += texture2D(uColor, uv).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / max(1e-4, wsum), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Bloom — threshold + dual filter down/up chain (Call of Duty: AW style).
// ---------------------------------------------------------------------------
export const BLOOM_PREFILTER_FRAG = COMMON + /* glsl */`
uniform sampler2D uColor;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uSoftKnee;
uniform float uClamp;

vec3 karis(vec3 c) { return c / (1.0 + luma(c)); }

void main() {
  // 4-tap box with Karis average kills single-pixel fireflies before they bloom.
  // safeRGB on entry: the bloom chain is a cascade of blurs, so an unfiltered
  // NaN here would smear over a large part of the frame by the last mip.
  vec3 a = safeRGB(texture2D(uColor, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
  vec3 b = safeRGB(texture2D(uColor, vUv + uTexel * vec2( 1.0, -1.0)).rgb);
  vec3 c = safeRGB(texture2D(uColor, vUv + uTexel * vec2(-1.0,  1.0)).rgb);
  vec3 e = safeRGB(texture2D(uColor, vUv + uTexel * vec2( 1.0,  1.0)).rgb);
  vec3 col = (karis(a) + karis(b) + karis(c) + karis(e)) * 0.25;
  col = min(col, vec3(uClamp));

  float br = max(col.r, max(col.g, col.b));
  float knee = uThreshold * uSoftKnee + 1e-5;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
  gl_FragColor = vec4(col * contrib, 1.0);
}
`;

export const BLOOM_DOWN_FRAG = COMMON + /* glsl */`
uniform sampler2D uColor;
uniform vec2 uTexel;
void main() {
  // 13-tap partial Karis downsample (Jimenez, SIGGRAPH 2014).
  vec3 a = texture2D(uColor, vUv + uTexel * vec2(-2.0,  2.0)).rgb;
  vec3 b = texture2D(uColor, vUv + uTexel * vec2( 0.0,  2.0)).rgb;
  vec3 c = texture2D(uColor, vUv + uTexel * vec2( 2.0,  2.0)).rgb;
  vec3 d = texture2D(uColor, vUv + uTexel * vec2(-2.0,  0.0)).rgb;
  vec3 e = texture2D(uColor, vUv).rgb;
  vec3 f = texture2D(uColor, vUv + uTexel * vec2( 2.0,  0.0)).rgb;
  vec3 g = texture2D(uColor, vUv + uTexel * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture2D(uColor, vUv + uTexel * vec2( 0.0, -2.0)).rgb;
  vec3 i = texture2D(uColor, vUv + uTexel * vec2( 2.0, -2.0)).rgb;
  vec3 j = texture2D(uColor, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  vec3 k = texture2D(uColor, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  vec3 l = texture2D(uColor, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture2D(uColor, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  vec3 col = e * 0.125;
  col += (a + c + g + i) * 0.03125;
  col += (b + d + f + h) * 0.0625;
  col += (j + k + l + m) * 0.125;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const BLOOM_UP_FRAG = COMMON + /* glsl */`
uniform sampler2D uColor;   // the smaller mip being upsampled
uniform sampler2D uPrev;    // the larger mip it is added onto
uniform vec2 uTexel;
uniform float uRadius;
void main() {
  vec2 r = uTexel * uRadius;
  vec3 a = texture2D(uColor, vUv + vec2(-r.x,  r.y)).rgb;
  vec3 b = texture2D(uColor, vUv + vec2( 0.0,  r.y)).rgb;
  vec3 c = texture2D(uColor, vUv + vec2( r.x,  r.y)).rgb;
  vec3 d = texture2D(uColor, vUv + vec2(-r.x,  0.0)).rgb;
  vec3 e = texture2D(uColor, vUv).rgb;
  vec3 f = texture2D(uColor, vUv + vec2( r.x,  0.0)).rgb;
  vec3 g = texture2D(uColor, vUv + vec2(-r.x, -r.y)).rgb;
  vec3 h = texture2D(uColor, vUv + vec2( 0.0, -r.y)).rgb;
  vec3 i = texture2D(uColor, vUv + vec2( r.x, -r.y)).rgb;
  vec3 tent = (e * 4.0 + (b + d + f + h) * 2.0 + (a + c + g + i)) / 16.0;
  gl_FragColor = vec4(texture2D(uPrev, vUv).rgb + tent, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Auto-exposure.
//
// A fixed exposure cannot serve both a moonlit courtyard and an unpowered
// factory interior: tuned for the courtyard the interior is unnavigable, and
// tuned for the interior the courtyard blows out. These three passes measure
// the frame's average luminance on the GPU and adapt toward it over time, the
// way an eye does walking indoors.
//
// Everything stays on the GPU — a CPU readback of even one pixel would stall
// the pipeline every frame.
// ---------------------------------------------------------------------------

/** Pass 1: log-luminance, downsampled 4x in one step. */
export const LUM_DOWN_FRAG = COMMON + /* glsl */`
uniform sampler2D uColor;
uniform vec2 uTexel;
uniform float uIsFirst;
void main() {
  float sum = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 uv = vUv + (vec2(float(x), float(y)) - 1.5) * uTexel;
      vec3 c = texture2D(uColor, uv).rgb;
      // Average in log space: the geometric mean is far less swayed by a
      // single muzzle flash or lamp than the arithmetic mean.
      // safeVal, not max: this is the gate that keeps a NaN in the HDR buffer
      // out of the exposure feedback loop.
      sum += uIsFirst > 0.5
        ? log(safeVal(luma(c), 1e-4, 65504.0))
        : safeVal(c.r, -12.0, 12.0);   // later passes carry log values
    }
  }
  gl_FragColor = vec4(vec3(sum / 16.0), 1.0);
}
`;

/** Pass 2: 1x1 running adaptation, ping-ponged against the previous frame. */
export const LUM_ADAPT_FRAG = COMMON + /* glsl */`
uniform sampler2D uCurrent;    // 1x1 log-average of this frame
uniform sampler2D uPrevious;   // 1x1 adapted value from last frame
uniform float uDt;
uniform float uSpeedUp;        // adaptation rate when getting brighter
uniform float uSpeedDown;      // ...and when getting darker
uniform float uMinLum;
uniform float uMaxLum;
void main() {
  float target = safeVal(exp(safeVal(texture2D(uCurrent, vec2(0.5)).r, -12.0, 12.0)), uMinLum, uMaxLum);
  float prev = texture2D(uPrevious, vec2(0.5)).r;
  // safeVal both ends: this target is written back into itself next frame, so
  // anything that slips through here is permanent for the life of the page.
  if (!(prev > 0.0)) prev = target;           // first frame, or a poisoned prev
  prev = safeVal(prev, uMinLum, uMaxLum);
  // Adapting down (into the dark) is deliberately slower than adapting up,
  // which is both how eyes work and how it avoids a pumping look when a
  // muzzle flash briefly floods the frame.
  float speed = target > prev ? uSpeedUp : uSpeedDown;
  float adapted = prev + (target - prev) * (1.0 - exp(-uDt * speed));
  gl_FragColor = vec4(vec3(safeVal(adapted, uMinLum, uMaxLum)), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Final composite: bloom + lens dirt, exposure, AgX tonemap, grade, CA,
// vignette, grain, and contrast-adaptive sharpening.
// ---------------------------------------------------------------------------
export const COMPOSITE_FRAG = COMMON + /* glsl */`
uniform sampler2D uColor;
uniform sampler2D uBloom;
uniform sampler2D uDepth;
uniform sampler2D uAdaptedLum;
uniform vec2 uResolution;
uniform float uTime;
uniform float uExposure;
uniform float uAutoExposure;   // 0 = fixed, 1 = fully automatic
uniform float uKeyValue;       // target middle grey
uniform float uBloomStrength;
uniform float uChromatic;
uniform float uVignette;
uniform float uGrain;
uniform float uSharpen;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform float uDamage;        // red flash from taking a hit
uniform float uNear, uFar;
uniform float uDofStrength;
uniform float uFlash;

// ---- AgX (Troy Sobotka / Blender) ----------------------------------------
// Highlights desaturate toward white instead of clipping to a hue, which is
// what makes muzzle flashes and lamps read like film rather than like clipping.
const mat3 AgXInset = mat3(
  0.8567603, 0.0985376, 0.0447021,
  0.1373235, 0.7612162, 0.1010603,
  0.0058968, 0.1402462, 0.8542472
);
const mat3 AgXOutset = mat3(
   1.1271005, -0.1413297, -0.0141419,
  -0.1413297,  1.1578237, -0.1500961,
  -0.0141419, -0.0164928,  1.1642579
);

vec3 agxDefaultContrastApprox(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return + 15.5     * x4 * x2
         - 40.14    * x4 * x
         + 31.96    * x4
         - 6.868    * x2 * x
         + 0.4298   * x2
         + 0.1191   * x
         - 0.00232;
}

vec3 agx(vec3 col) {
  const float minEv = -12.47393;
  const float maxEv = 4.026069;
  col = AgXInset * max(col, vec3(0.0));
  col = clamp(log2(max(col, 1e-10)), minEv, maxEv);
  col = (col - minEv) / (maxEv - minEv);
  col = agxDefaultContrastApprox(col);
  col = AgXOutset * col;
  return pow(max(col, vec3(0.0)), vec3(2.2)); // back to linear for grading
}

vec3 grade(vec3 c) {
  c = c * uGain + uLift * (1.0 - c);
  c = pow(max(c, vec3(1e-5)), 1.0 / max(uGamma, vec3(1e-3)));
  float l = luma(c);
  c = mix(vec3(l), c, uSaturation);
  c = (c - 0.5) * uContrast + 0.5;
  return c;
}

void main() {
  vec2 uv = vUv;
  vec2 fromCenter = uv - 0.5;
  float r2 = dot(fromCenter, fromCenter);

  // ---- chromatic aberration (radial, stronger at the frame edge) ----
  float ca = uChromatic * (0.35 + r2 * 2.6);
  vec2 caOff = fromCenter * ca * 0.01;
  vec3 col;
  col.r = texture2D(uColor, uv + caOff).r;
  col.g = texture2D(uColor, uv).g;
  col.b = texture2D(uColor, uv - caOff).b;
  // Contain a bad pixel to itself: without this the sharpen and bloom taps
  // below spread a single NaN across a whole neighbourhood.
  col = safeRGB(col);

  // ---- RCAS-style sharpening in HDR ---------------------------------------
  // This used to be a raw unsharp mask:
  //     sharp = col * (1 + 4k) - (n + s + e + w) * k,   k = uSharpen * amp
  // with k per channel and the result only clamped at zero. Three consequences,
  // all of them visible in game and all of them fixed here:
  //
  //  1. UNBOUNDED UNDERSHOOT. On the dark side of a high-contrast edge the
  //     expression goes negative and max(.,0) pinned it to black. Measured at
  //     the factory wall's top edge against the moonlit sky: the row directly
  //     under the silhouette came out (7,21,57) with neighbours (30,57,77) above
  //     and (0,29,61) below — a one-pixel line darker than anything around it.
  //     That is the "horizontal black lines" that show up along wall tops,
  //     stair risers and catwalk lips, and slide around the frame as the camera
  //     moves because they follow whatever hard horizontal edge is on screen.
  //  2. PER-CHANNEL WEIGHTS. amp was a vec3, so on a blue-lit night edge green
  //     and blue undershot much harder than red and the halo was not grey, it
  //     was ORANGE. Measured on the same edge at the bright end: (123,74,97)
  //     between a sky of (129,153,171) and a wall of (70,95,118) — red above
  //     green and blue, i.e. a full-width orange line where none exists in the
  //     scene. The weight is now a single achromatic scalar, so sharpening can
  //     change local contrast but can never change hue.
  //  3. HDR-BLIND AMPLITUDE. min(mn, 2.0 - mx) collapses to zero the moment any
  //     channel passes 2.0, which in an HDR buffer is most of the moonlit sky,
  //     so the amplitude term was effectively random across the frame. It is
  //     now measured on a tone-mapped proxy that behaves the same at every
  //     exposure.
  //
  // The kernel is also normalised (÷ 1 - 4k) so a flat region is returned
  // exactly unchanged instead of being scaled, and the result is limited to the
  // 5-tap neighbourhood — the anti-ringing clamp AMD's RCAS uses. Sharpening
  // may steepen an edge, but it can no longer invent a pixel darker or brighter
  // than everything touching it, which is precisely what a halo line is.
  if (uSharpen > 0.001) {
    vec2 t = 1.0 / uResolution;
    vec3 cn = safeRGB(texture2D(uColor, uv + vec2(0.0, t.y)).rgb);
    vec3 cs = safeRGB(texture2D(uColor, uv - vec2(0.0, t.y)).rgb);
    vec3 ce = safeRGB(texture2D(uColor, uv + vec2(t.x, 0.0)).rgb);
    vec3 cw = safeRGB(texture2D(uColor, uv - vec2(t.x, 0.0)).rgb);
    vec3 mn = max(min(col, min(min(cn, cs), min(ce, cw))), vec3(0.0));
    vec3 mx = max(col, max(max(cn, cs), max(ce, cw)));
    float lmn = luma(mn), lmx = luma(mx);
    lmn = lmn / (1.0 + lmn);
    lmx = lmx / (1.0 + lmx);
    float amp = sqrt(clamp(min(lmn, 1.0 - lmx) / max(lmx, 1e-4), 0.0, 1.0));
    float k = amp * mix(0.125, 0.2, clamp(uSharpen, 0.0, 1.0));
    vec3 sharp = (col - k * (cn + cs + ce + cw)) / max(1.0 - 4.0 * k, 1e-3);
    col = clamp(sharp, mn, mx);
  }

  // ---- bloom + lens dirt ----
  vec3 bloom = texture2D(uBloom, uv).rgb;
  float dirt = 0.6 + 0.9 * hash12(floor(uv * 26.0)) * smoothstep(0.02, 0.35, r2);
  col += bloom * uBloomStrength * dirt;

  // ---- exposure, tonemap, grade ----
  // Auto-exposure scales the authored baseline rather than replacing it, so
  // the art direction still sets the look and adaptation only compensates for
  // how much light the player is actually standing in.
  float autoScale = 1.0;
  if (uAutoExposure > 0.001) {
    float adapted = safeVal(texture2D(uAdaptedLum, vec2(0.5)).r, 1e-4, 64.0);
    // Ceiling deliberately modest: adaptation should rescue a dark room, not
    // turn an unlit factory into daylight.
    autoScale = mix(1.0, clamp(uKeyValue / adapted, 0.6, 2.1), uAutoExposure);
  }
  col *= uExposure * autoScale;
  col += uFlash;
  col = agx(col);
  col = grade(col);

  // ---- damage / vignette ----
  col = mix(col, col * vec3(1.25, 0.22, 0.18), uDamage * smoothstep(0.02, 0.28, r2));
  float vig = 1.0 - uVignette * smoothstep(0.05, 0.75, r2);
  col *= vig;

  // ---- film grain (luminance-weighted, quieter in the highlights) ----
  float g = hash13(vec3(gl_FragCoord.xy, fract(uTime) * 1000.0)) - 0.5;
  col += g * uGrain * (0.25 + 0.75 * (1.0 - smoothstep(0.0, 0.85, luma(col))));

  gl_FragColor = vec4(linearToSRGB(max(col, vec3(0.0))), 1.0);
}
`;

// ---------------------------------------------------------------------------
// FXAA 3.11 (quality preset, trimmed). Runs last, on sRGB output.
// ---------------------------------------------------------------------------
export const FXAA_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uColor;
uniform vec2 uTexel;

#define EDGE_THRESHOLD_MIN 0.0312
#define EDGE_THRESHOLD_MAX 0.125
#define ITERATIONS 12
#define SUBPIXEL_QUALITY 0.75

float rgb2luma(vec3 rgb) { return sqrt(dot(rgb, vec3(0.299, 0.587, 0.114))); }
float quality(int i) {
  if (i < 5) return 1.0;
  if (i == 5) return 1.5;
  if (i < 10) return 2.0;
  if (i == 10) return 4.0;
  return 8.0;
}

void main() {
  vec3 colorCenter = texture2D(uColor, vUv).rgb;
  float lumaCenter = rgb2luma(colorCenter);
  float lumaDown  = rgb2luma(texture2D(uColor, vUv + vec2(0.0, -uTexel.y)).rgb);
  float lumaUp    = rgb2luma(texture2D(uColor, vUv + vec2(0.0,  uTexel.y)).rgb);
  float lumaLeft  = rgb2luma(texture2D(uColor, vUv + vec2(-uTexel.x, 0.0)).rgb);
  float lumaRight = rgb2luma(texture2D(uColor, vUv + vec2( uTexel.x, 0.0)).rgb);

  float lumaMin = min(lumaCenter, min(min(lumaDown, lumaUp), min(lumaLeft, lumaRight)));
  float lumaMax = max(lumaCenter, max(max(lumaDown, lumaUp), max(lumaLeft, lumaRight)));
  float lumaRange = lumaMax - lumaMin;

  if (lumaRange < max(EDGE_THRESHOLD_MIN, lumaMax * EDGE_THRESHOLD_MAX)) {
    gl_FragColor = vec4(colorCenter, 1.0);
    return;
  }

  float lumaDownLeft  = rgb2luma(texture2D(uColor, vUv + vec2(-uTexel.x, -uTexel.y)).rgb);
  float lumaUpRight   = rgb2luma(texture2D(uColor, vUv + vec2( uTexel.x,  uTexel.y)).rgb);
  float lumaUpLeft    = rgb2luma(texture2D(uColor, vUv + vec2(-uTexel.x,  uTexel.y)).rgb);
  float lumaDownRight = rgb2luma(texture2D(uColor, vUv + vec2( uTexel.x, -uTexel.y)).rgb);

  float lumaDownUp = lumaDown + lumaUp;
  float lumaLeftRight = lumaLeft + lumaRight;
  float lumaLeftCorners = lumaDownLeft + lumaUpLeft;
  float lumaDownCorners = lumaDownLeft + lumaDownRight;
  float lumaRightCorners = lumaDownRight + lumaUpRight;
  float lumaUpCorners = lumaUpRight + lumaUpLeft;

  float edgeHorizontal = abs(-2.0 * lumaLeft + lumaLeftCorners) + abs(-2.0 * lumaCenter + lumaDownUp) * 2.0 + abs(-2.0 * lumaRight + lumaRightCorners);
  float edgeVertical   = abs(-2.0 * lumaUp + lumaUpCorners) + abs(-2.0 * lumaCenter + lumaLeftRight) * 2.0 + abs(-2.0 * lumaDown + lumaDownCorners);
  bool isHorizontal = (edgeHorizontal >= edgeVertical);

  float luma1 = isHorizontal ? lumaDown : lumaLeft;
  float luma2 = isHorizontal ? lumaUp : lumaRight;
  float gradient1 = luma1 - lumaCenter;
  float gradient2 = luma2 - lumaCenter;
  bool is1Steepest = abs(gradient1) >= abs(gradient2);
  float gradientScaled = 0.25 * max(abs(gradient1), abs(gradient2));

  float stepLength = isHorizontal ? uTexel.y : uTexel.x;
  float lumaLocalAverage = 0.0;
  if (is1Steepest) { stepLength = -stepLength; lumaLocalAverage = 0.5 * (luma1 + lumaCenter); }
  else { lumaLocalAverage = 0.5 * (luma2 + lumaCenter); }

  vec2 currentUv = vUv;
  if (isHorizontal) currentUv.y += stepLength * 0.5;
  else currentUv.x += stepLength * 0.5;

  vec2 offset = isHorizontal ? vec2(uTexel.x, 0.0) : vec2(0.0, uTexel.y);
  vec2 uv1 = currentUv - offset;
  vec2 uv2 = currentUv + offset;

  float lumaEnd1 = rgb2luma(texture2D(uColor, uv1).rgb) - lumaLocalAverage;
  float lumaEnd2 = rgb2luma(texture2D(uColor, uv2).rgb) - lumaLocalAverage;
  bool reached1 = abs(lumaEnd1) >= gradientScaled;
  bool reached2 = abs(lumaEnd2) >= gradientScaled;
  bool reachedBoth = reached1 && reached2;
  if (!reached1) uv1 -= offset;
  if (!reached2) uv2 += offset;

  if (!reachedBoth) {
    for (int i = 2; i < ITERATIONS; i++) {
      if (!reached1) { lumaEnd1 = rgb2luma(texture2D(uColor, uv1).rgb) - lumaLocalAverage; reached1 = abs(lumaEnd1) >= gradientScaled; }
      if (!reached2) { lumaEnd2 = rgb2luma(texture2D(uColor, uv2).rgb) - lumaLocalAverage; reached2 = abs(lumaEnd2) >= gradientScaled; }
      if (!reached1) uv1 -= offset * quality(i);
      if (!reached2) uv2 += offset * quality(i);
      if (reached1 && reached2) break;
    }
  }

  float distance1 = isHorizontal ? (vUv.x - uv1.x) : (vUv.y - uv1.y);
  float distance2 = isHorizontal ? (uv2.x - vUv.x) : (uv2.y - vUv.y);
  bool isDirection1 = distance1 < distance2;
  float distanceFinal = min(distance1, distance2);
  float edgeThickness = (distance1 + distance2);
  float pixelOffset = -distanceFinal / edgeThickness + 0.5;

  bool isLumaCenterSmaller = lumaCenter < lumaLocalAverage;
  bool correctVariation = ((isDirection1 ? lumaEnd1 : lumaEnd2) < 0.0) != isLumaCenterSmaller;
  float finalOffset = correctVariation ? pixelOffset : 0.0;

  float lumaAverage = (1.0 / 12.0) * (2.0 * (lumaDownUp + lumaLeftRight) + lumaLeftCorners + lumaRightCorners);
  float subPixelOffset1 = clamp(abs(lumaAverage - lumaCenter) / lumaRange, 0.0, 1.0);
  float subPixelOffset2 = (-2.0 * subPixelOffset1 + 3.0) * subPixelOffset1 * subPixelOffset1;
  float subPixelOffsetFinal = subPixelOffset2 * subPixelOffset2 * SUBPIXEL_QUALITY;
  finalOffset = max(finalOffset, subPixelOffsetFinal);

  vec2 finalUv = vUv;
  if (isHorizontal) finalUv.y += finalOffset * stepLength;
  else finalUv.x += finalOffset * stepLength;
  gl_FragColor = vec4(texture2D(uColor, finalUv).rgb, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Depth of field — near/far CoC with a hexagonal-ish bokeh scatter. Used for
// ADS (world softens behind the sight) and for cinematics.
// ---------------------------------------------------------------------------
export const DOF_FRAG = COMMON + /* glsl */`
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uTexel;
uniform float uNear, uFar;
uniform float uFocusDist;
uniform float uFocusRange;
uniform float uMaxBlur;
uniform float uFrame;

#define DOF_TAPS 16

void main() {
  float d = rawDepth(uDepth, vUv);
  float z = -linearizeDepth(d, uNear, uFar);
  float coc = clamp((z - uFocusDist) / max(0.001, uFocusRange), -1.0, 1.0);
  float radius = abs(coc) * uMaxBlur;
  if (radius < 0.6) { gl_FragColor = texture2D(uColor, vUv); return; }

  float ang = ign(gl_FragCoord.xy + uFrame * 2.71) * TAU;
  vec3 sum = texture2D(uColor, vUv).rgb;
  float wsum = 1.0;
  for (int i = 0; i < DOF_TAPS; i++) {
    float a = ang + float(i) * (TAU / float(DOF_TAPS)) * 2.399963;
    float rr = sqrt((float(i) + 0.5) / float(DOF_TAPS)) * radius;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * rr * uTexel;
    float dz = -linearizeDepth(rawDepth(uDepth, uv), uNear, uFar);
    // Only pull in samples that are themselves at least as out of focus.
    float w = (dz > z - 0.3) ? 1.0 : 0.25;
    sum += texture2D(uColor, uv).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, 1.0);
}
`;

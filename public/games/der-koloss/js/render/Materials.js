// Surface-detail extension for MeshStandardMaterial.
//
// The map's 1K CC0 textures are tiled 18x over a 40m floor, so up close every
// surface is a smooth blur and from a distance the repeat is obvious. This
// injects three things into the stock physical shader:
//
//   1. a triplanar DETAIL normal at ~0.4m tiling, so surfaces keep micro-relief
//      right up to the camera regardless of the base UV scale;
//   2. MACRO variation — very low frequency albedo/roughness mottling that
//      breaks the tiling pattern at a distance;
//   3. optional WETNESS — puddle mask that darkens albedo, flattens the normal
//      and drops roughness, which is what sells wet concrete under moonlight.
//
// All of it is world-space, so it needs no UVs and works on merged geometry.
import * as THREE from 'three';

let _detailTex = null;

/**
 * Procedural roughcast/aggregate normal map. Generated once, shared.
 *
 * This is the one height->normal generator in the project that needs no blur
 * before its Sobel (the props get one per generator in props/materials.js, the
 * brick gets one in map.js). It is band-limited by construction: the noise is
 * four smoothstep-interpolated value-noise octaves whose finest, `octave(64)`
 * on a 256px map, still has a four-texel period, and the aggregate grains are
 * cosine-profile domes a texel or more in radius. Nothing here is a one-texel
 * rectangle, so there is no unresolvable step for a Sobel to turn into a
 * right-angle normal swing. It is also faded out past 13m, where minification
 * would start to matter.
 */
export function detailNormalTexture(size = 256) {
  if (_detailTex) return _detailTex;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');

  // Height field: layered value noise + sparse aggregate pits.
  const h = new Float32Array(size * size);
  const octave = (freq, amp) => {
    const n = freq;
    const grid = new Float32Array((n + 1) * (n + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n, fy = (y / size) * n;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = grid[y0 * (n + 1) + x0], b = grid[y0 * (n + 1) + x0 + 1];
        const cc = grid[(y0 + 1) * (n + 1) + x0], d = grid[(y0 + 1) * (n + 1) + x0 + 1];
        h[y * size + x] += (a + (b - a) * sx + ((cc + (d - cc) * sx) - (a + (b - a) * sx)) * sy) * amp;
      }
    }
  };
  octave(8, 0.5); octave(16, 0.26); octave(32, 0.14); octave(64, 0.07);
  // Aggregate: small round grains poking through the surface.
  for (let i = 0; i < size * 2; i++) {
    const px = Math.random() * size, py = Math.random() * size;
    const r = 1 + Math.random() * 3.2, amp = 0.18 + Math.random() * 0.3;
    for (let y = Math.max(0, (py - r) | 0); y < Math.min(size, py + r); y++) {
      for (let x = Math.max(0, (px - r) | 0); x < Math.min(size, px + r); x++) {
        const d = Math.hypot(x - px, y - py) / r;
        if (d < 1) h[y * size + x] += Math.cos(d * Math.PI * 0.5) * amp;
      }
    }
  }

  const img = g.createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  const strength = 1.55;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  _detailTex = new THREE.CanvasTexture(c);
  _detailTex.wrapS = _detailTex.wrapT = THREE.RepeatWrapping;
  _detailTex.colorSpace = THREE.NoColorSpace;
  _detailTex.anisotropy = 8;
  _detailTex.needsUpdate = true;
  return _detailTex;
}

const DETAIL_PARS = /* glsl */`
uniform sampler2D uDetailNormal;
uniform float uDetailScale;
uniform float uDetailStrength;
uniform float uDetailNear;
uniform float uDetailFar;
uniform float uMacroScale;
uniform float uMacroAmount;
uniform float uMacroRough;
uniform float uWetness;
uniform float uWetScale;
uniform float uWetHeight;
varying vec3 vWorldPosD;
varying vec3 vWorldNrmD;

float dHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float dNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x), mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x), mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float dFbm(vec3 p) {
  return dNoise(p) * 0.55 + dNoise(p * 2.07) * 0.28 + dNoise(p * 4.11) * 0.17;
}

// Triplanar detail normal in world space, whiteout-blended onto a base normal.
vec3 detailWorldNormal(vec3 wp, vec3 wn, float scale) {
  vec3 blend = pow(abs(wn), vec3(5.0));
  blend /= max(1e-4, blend.x + blend.y + blend.z);
  vec3 tx = texture2D(uDetailNormal, wp.zy * scale).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(uDetailNormal, wp.xz * scale).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(uDetailNormal, wp.xy * scale).xyz * 2.0 - 1.0;
  vec3 nx = vec3(0.0, tx.y, tx.x);
  vec3 ny = vec3(ty.x, 0.0, ty.y);
  vec3 nz = vec3(tz.x, tz.y, 0.0);
  return normalize(wn + nx * blend.x + ny * blend.y + nz * blend.z);
}
`;

// ===========================================================================
// Normal filtering: normal-map level of detail + geometric specular AA.
//
// This is ONE filter with two halves, and it is deliberately in one place
// because the two halves have to run in a fixed order (measure the roughness
// the relief is worth BEFORE fading the relief away) and because a duplicated
// GLSL patch drifts. Both the map's merged materials and the props' hero
// materials inject it; see `enhanceMaterial` and `applyNormalFilter`.
//
// --- half 1: normal-map level of detail ------------------------------------
// The artifact this exists to kill: short bright dashes crawling along the
// mortar lines of a brick wall seen at a glancing angle, and the same thing on
// the concrete soffits, the diamond-plate decks and the cast-iron door jambs.
//
// A normal map is a signal, and a pixel is a sampling kernel. Mipmapping
// filters the STORED normals, but three renormalises whatever it reads, so the
// averaging that should have flattened a half-resolved mortar groove instead
// hands back a full-length normal pointing in whichever direction the last
// surviving texel happened to face. Every sub-pixel step of the camera picks a
// different one, the surface's response to the sodium lamps swings with it, and
// the chromatic aberration downstream splits each of those one-pixel highlights
// into a coloured dash. Anisotropic filtering does not save it either: the
// aliasing is in the shading, not in the fetch.
//
// So measure the pixel's actual footprint in world space — which grows without
// bound at a glancing angle, exactly where the artifact lives — and fade the
// perturbation toward the geometric normal once one pixel covers more relief
// than it can possibly resolve. Up close the footprint is millimetres and the
// wall keeps every bit of its relief; that is the whole point, and it is why
// this is a fade rather than a reduction in strength.
//
// --- half 2: geometric specular antialiasing -------------------------------
// A high-frequency normal on a glossy surface produces a different microfacet
// direction in every pixel, and the specular lobe aliases into crawling white
// sparkles — the factory ceiling under the sodium lamps, and the 2cm rivets and
// flanges on the bridge doorway. Widen the roughness by the screen-space
// variance of the normal so the highlight is filtered instead of point-sampled.
//
// The widening term MUST be a local average. A first attempt scaled it by
// length(nW - wn) — the instantaneous perturbation, which is itself the
// high-frequency signal we are trying to filter. Flattening the normal then
// simply moved the same aliasing into the roughness, and measured WORSE than
// doing nothing at all (mean oscillation 1.58 against 1.36 for no normal map at
// all, at the same camera). The screen-space derivative is the average.
//
// `subtractGeometric` measures the variance of the normal-map PERTURBATION
// rather than of the shading normal itself. Three's own `lights_physical_
// fragment` already adds a geometryRoughness term from dFdx(nonPerturbedNormal),
// so on the props — which are assembled from hundreds of abutting boxes and
// faceted domes — the plain form double-counts every part seam and would sand
// the shine off the whole factory. Differencing leaves the geometric term to
// three and responds only to the map.
// ===========================================================================

/** Uniform block for the filter. Injected next to `#include <common>`. */
export const NORMAL_FILTER_PARS = /* glsl */`
uniform float uNormalLodStart;
uniform float uNormalLodEnd;
uniform float uNormalLodFloor;
uniform float uSpecAA;
uniform float uSpecAAMax;
`;

export function normalFilterUniforms({
  // Normal-map level of detail, in METRES OF WORLD SPACE PER PIXEL. Below
  // `start` a pixel is smaller than the relief it is shading and the normal map
  // is used at full strength; past `end` a single pixel covers many features and
  // the map is faded toward `floor`.
  normalLodStart = 0.0025,
  normalLodEnd = 0.014,
  normalLodFloor = 0.15,
  specAA = 2.0,             // normal variance -> squared-roughness, 0 disables
  specAAMax = 0.25,         // cap on the squared-roughness the filter may add
} = {}) {
  return {
    uNormalLodStart: { value: normalLodStart },
    uNormalLodEnd: { value: normalLodEnd },
    uNormalLodFloor: { value: normalLodFloor },
    uSpecAA: { value: specAA },
    uSpecAAMax: { value: specAAMax },
  };
}

/**
 * The single copy of the filter body. Reads and writes `roughnessFactor`, and
 * rewrites `shade` in place.
 * @param {string} pos   varying whose screen derivative is a WORLD distance
 * @param {string} geo   geometric (unperturbed) normal
 * @param {string} shade shading normal — same space as `geo`
 * @param {boolean} subtractGeometric measure variance of (shade - geo) only
 */
export function normalFilterGLSL({ pos, geo, shade, subtractGeometric = false }) {
  const src = subtractGeometric ? `${shade} - ${geo}` : shade;
  return /* glsl */`
{
  float nfFootprint = max(length(dFdx(${pos})), length(dFdy(${pos})));
  float nfLod = smoothstep(uNormalLodStart, uNormalLodEnd, nfFootprint);
  float nfKeep = mix(1.0, uNormalLodFloor, nfLod);
  if (uSpecAA > 0.0) {
    // Measured on the UNFADED normal on purpose, so the relief the fade below
    // is about to remove still contributes the roughness it was worth.
    vec3 nfSrc = ${src};
    vec3 nfDx = dFdx(nfSrc);
    vec3 nfDy = dFdy(nfSrc);
    float nfVar = 0.5 * (dot(nfDx, nfDx) + dot(nfDy, nfDy));
    float nfKernel = min(uSpecAA * nfVar, uSpecAAMax);
    roughnessFactor = clamp(sqrt(roughnessFactor * roughnessFactor + nfKernel), 0.045, 1.0);
  }
  ${shade} = normalize(mix(${geo}, ${shade}, nfKeep));
}`;
}

/**
 * Normal-map LOD + geometric specular AA on a stock MeshStandardMaterial, with
 * none of the map's triplanar detail/macro/wetness stack. This is what the
 * hero props get: they already carry authored colour/roughness/normal sets, so
 * all they need is the filtering.
 *
 * With `subtractGeometric` (the default here) a material with no normal map is
 * mathematically a no-op — the perturbation is identically zero and the LOD
 * fade mixes the geometric normal with itself — so those are skipped outright
 * rather than paying four derivatives per pixel for nothing.
 */
export function applyNormalFilter(mat, opts = {}) {
  if (!mat || mat.__normalFiltered) return mat;
  const subtractGeometric = opts.subtractGeometric !== false;
  if (subtractGeometric && !mat.normalMap && !mat.bumpMap) return mat;
  mat.__normalFiltered = true;

  const uniforms = normalFilterUniforms(opts);
  mat.userData.normalFilterUniforms = uniforms;
  const body = normalFilterGLSL({
    pos: 'vViewPosition',            // view space is rigid, so |dFdx| is metres
    geo: 'nonPerturbedNormal',
    shade: 'normal',
    subtractGeometric,
  });

  // See the note in enhanceMaterial: the injected source lives in a closure,
  // so the default cache key (onBeforeCompile.toString()) cannot distinguish
  // two shapes of this filter.
  mat.customProgramCacheKey = () => `nfilter:${body}`;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NORMAL_FILTER_PARS}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${body}`);
  };
  mat.needsUpdate = true;
  return mat;
}

/**
 * Injects the detail/macro/wetness stack into a MeshStandardMaterial.
 * Safe to call on shared materials; it patches onBeforeCompile once.
 */
export function enhanceMaterial(mat, {
  detailScale = 2.6,        // tiles per metre — 2.6 ≈ a 38cm feature
  detailStrength = 0.55,
  detailNear = 3.5,         // full strength inside this distance (metres)
  detailFar = 13,           // fully faded out beyond this
  macroScale = 0.055,       // ~18m features
  macroAmount = 0.16,
  macroRough = 0.12,
  wetness = 0,
  wetScale = 0.32,
  wetHeight = 0.35,         // world Y below which puddles can form
  // Normal-map LOD and specular-AA controls — see normalFilterUniforms.
  ...filterOpts
} = {}) {
  if (!mat || mat.__enhanced) return mat;
  mat.__enhanced = true;
  mat.__normalFiltered = true;
  const detail = detailNormalTexture();

  const uniforms = {
    uDetailNormal: { value: detail },
    uDetailScale: { value: detailScale },
    uDetailStrength: { value: detailStrength },
    uDetailNear: { value: detailNear },
    uDetailFar: { value: detailFar },
    uMacroScale: { value: macroScale },
    uMacroAmount: { value: macroAmount },
    uMacroRough: { value: macroRough },
    uWetness: { value: wetness },
    uWetScale: { value: wetScale },
    uWetHeight: { value: wetHeight },
    ...normalFilterUniforms(filterOpts),
  };
  mat.userData.detailUniforms = uniforms;
  mat.userData.normalFilterUniforms = uniforms;
  // World space here rather than view space: the detail/macro/wetness stack
  // already carries the world position as a varying, so the footprint is free.
  const filterBody = normalFilterGLSL({
    pos: 'vWorldPosD', geo: 'wn', shade: 'nW',
    subtractGeometric: filterOpts.subtractGeometric === true,
  });

  // three keys its program cache on onBeforeCompile.toString(), which is the
  // same string for every call here — the injected source varies through a
  // closure it cannot see. Key on the source that actually varies, or two
  // materials patched with different filter shapes would share one program.
  mat.customProgramCacheKey = () => `enhance:${filterBody}`;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vWorldPosD;
varying vec3 vWorldNrmD;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
vWorldPosD = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWorldNrmD = normalize(mat3(modelMatrix) * objectNormal);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${DETAIL_PARS}\n${NORMAL_FILTER_PARS}`)
      // --- albedo: low-frequency mottling breaks the visible tile repeat ---
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  float macro = dFbm(vWorldPosD * uMacroScale);
  diffuseColor.rgb *= 1.0 + (macro - 0.5) * 2.0 * uMacroAmount;
}`)
      // --- roughness: break the uniform sheen the same way ---
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{
  float rmacro = dFbm(vWorldPosD * uMacroScale * 3.1 + 17.0);
  roughnessFactor = clamp(roughnessFactor * (1.0 + (rmacro - 0.5) * 2.0 * uMacroRough), 0.04, 1.0);
}`)
      // --- normal: triplanar micro detail + puddle flattening ---
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 wn = normalize(vWorldNrmD);
  // View space -> world (viewMatrix rotation is orthonormal, so transpose).
  vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  // Detail normals are a close-range effect. Past a few metres one texel
  // covers many pixels and the perturbation aliases into a crawling lattice —
  // very visible across a large ceiling. Fade it out with distance so it only
  // ever adds relief where the eye can actually resolve it.
  float viewDist = length(vViewPosition);
  float detailFade = 1.0 - smoothstep(uDetailNear, uDetailFar, viewDist);
  float detailAmt = uDetailStrength * detailFade;
  if (detailAmt > 0.001) {
    vec3 dW = detailWorldNormal(vWorldPosD, wn, uDetailScale);
    nW = normalize(nW + (dW - wn) * detailAmt);
  }
  if (uWetness > 0.001) {
    // Puddles pool on up-facing surfaces low in the world.
    float up = smoothstep(0.55, 0.92, wn.y);
    float low = 1.0 - smoothstep(uWetHeight, uWetHeight + 1.4, vWorldPosD.y);
    // Two frequencies: broad damp patches with tighter standing water inside.
    float damp = smoothstep(0.42, 0.60, dFbm(vWorldPosD * uWetScale));
    float pool = smoothstep(0.52, 0.68, dFbm(vWorldPosD * uWetScale * 3.7 + 51.0)) * damp;
    damp *= up * low * uWetness;
    pool *= up * low * uWetness;
    nW = normalize(mix(nW, wn, pool * 0.85));
    roughnessFactor = mix(roughnessFactor, 0.28, damp);
    roughnessFactor = mix(roughnessFactor, 0.085, pool);
    diffuseColor.rgb *= mix(1.0, 0.72, damp) * mix(1.0, 0.62, pool);
  }

  // Normal-map LOD + geometric specular AA — the shared filter.
${filterBody}

  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}`);
  };
  mat.needsUpdate = true;
  return mat;
}

/** Live-tune a material patched by enhanceMaterial or applyNormalFilter. */
export function setDetailUniform(mat, name, value) {
  const u = mat?.userData?.detailUniforms?.[name] || mat?.userData?.normalFilterUniforms?.[name];
  if (u) u.value = value;
}

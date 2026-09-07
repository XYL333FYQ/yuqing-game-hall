// Shading for skinned creatures (zombies, hellhounds).
//
// Deliberately shading-ONLY. An earlier attempt to raise creature fidelity by
// layering additive animation, head-look and dismemberment onto the skeleton
// produced rolling heads and broken blends, and was reverted. Everything here
// runs in the fragment shader and cannot desync a skeleton, retarget a clip or
// touch a bone.
//
// Three things matter for readability in a dark scene, in order:
//   1. RIM LIGHT keyed to the moon — a bright edge on the silhouette. This is
//      the single biggest reason enemies read at all at night, and it is the
//      most recognisable part of the modern shooter look.
//   2. WRAPPED DIFFUSE — light bleeds a little past the terminator instead of
//      falling to pure black, so the unlit side of a face still has form.
//   3. DETAIL + VARIATION — necrotic mottling and per-instance tint so a horde
//      does not read as one model duplicated twenty times.
import * as THREE from 'three';

let _fleshTex = null;

/** Necrotic detail: blotching, bruising and pooled grime. Generated once. */
export function fleshDetailTexture(size = 256) {
  if (_fleshTex) return _fleshTex;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);

  // Broad necrotic blotches.
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 6 + Math.random() * 34;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() < 0.6;
    const v = dark ? 40 + Math.random() * 40 : 150 + Math.random() * 70;
    grad.addColorStop(0, `rgba(${v},${v},${v},${0.16 + Math.random() * 0.24})`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // Fine pore/scab speckle.
  const img = g.getImageData(0, 0, size, size);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    px[i] = Math.max(0, Math.min(255, px[i] + n));
    px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + n));
    px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + n));
  }
  g.putImageData(img, 0, 0);
  // Dried runs of grime.
  g.strokeStyle = 'rgba(45,38,32,0.30)';
  for (let i = 0; i < 40; i++) {
    g.lineWidth = 0.6 + Math.random() * 2.2;
    const x = Math.random() * size, y = Math.random() * size;
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 20, y + 12 + Math.random() * 46);
    g.stroke();
  }

  _fleshTex = new THREE.CanvasTexture(c);
  _fleshTex.wrapS = _fleshTex.wrapT = THREE.RepeatWrapping;
  _fleshTex.colorSpace = THREE.NoColorSpace;
  _fleshTex.anisotropy = 4;
  _fleshTex.needsUpdate = true;
  return _fleshTex;
}

const CREATURE_PARS = /* glsl */`
uniform vec3  uRimColor;
uniform vec3  uRimDir;        // world-space direction toward the key light
uniform float uRimStrength;
uniform float uRimPower;
uniform float uWrap;          // 0 = lambert, 0.5 = very soft terminator
uniform vec3  uSSSColor;
uniform float uSSSStrength;
uniform sampler2D uFlesh;
uniform float uFleshScale;
uniform float uFleshAmount;
uniform float uGrime;
uniform float uWet;
uniform float uHit;           // 0..1 white flash on taking damage
uniform vec3  uTintA;
uniform vec3  uTintB;
uniform float uTintMix;
varying vec3 vCreatureWorldNrm;
varying vec3 vCreatureWorldPos;
`;

/**
 * Injects rim light, wrapped diffuse, necrotic detail and per-instance
 * variation into a skinned MeshStandardMaterial.
 *
 * @param {THREE.Material} mat
 * @param {object} opts per-instance look; every value is exposed as a uniform
 *        on `mat.userData.creatureUniforms` for runtime tweaking.
 */
export function enhanceCreatureMaterial(mat, opts = {}) {
  if (!mat || mat.__creature) return mat;
  mat.__creature = true;

  const uniforms = {
    uRimColor: { value: new THREE.Color(opts.rimColor ?? 0x9fc0ff) },
    uRimDir: { value: (opts.rimDir || new THREE.Vector3(0.46, 0.60, -0.65)).clone().normalize() },
    uRimStrength: { value: opts.rimStrength ?? 1.5 },
    uRimPower: { value: opts.rimPower ?? 2.6 },
    uWrap: { value: opts.wrap ?? 0.42 },
    uSSSColor: { value: new THREE.Color(opts.sssColor ?? 0x7a2b22) },
    uSSSStrength: { value: opts.sssStrength ?? 0.30 },
    uFlesh: { value: fleshDetailTexture() },
    uFleshScale: { value: opts.fleshScale ?? 5.0 },
    uFleshAmount: { value: opts.fleshAmount ?? 0.55 },
    uGrime: { value: opts.grime ?? 0.35 },
    uWet: { value: opts.wet ?? 0.30 },
    uHit: { value: 0 },
    uTintA: { value: new THREE.Color(opts.tintA ?? 0xb9bfae) },
    uTintB: { value: new THREE.Color(opts.tintB ?? 0x8e9483) },
    uTintMix: { value: opts.tintMix ?? Math.random() },
  };
  mat.userData.creatureUniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vCreatureWorldNrm;
varying vec3 vCreatureWorldPos;`)
      // After <skinning_vertex>/<defaultnormal_vertex> the deformed position
      // and normal are final, so the world-space values here follow the pose.
      .replace('#include <fog_vertex>', `#include <fog_vertex>
vCreatureWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vCreatureWorldNrm = normalize(mat3(modelMatrix) * objectNormal);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${CREATURE_PARS}`)
      // --- albedo: necrotic detail, grime, per-instance tint ---
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 wn = normalize(vCreatureWorldNrm);
  // Triplanar so it needs no UVs and never stretches across a deforming limb.
  vec3 bl = pow(abs(wn), vec3(4.0));
  bl /= max(1e-4, bl.x + bl.y + bl.z);
  vec3 wp = vCreatureWorldPos * uFleshScale;
  float f = texture2D(uFlesh, wp.zy).r * bl.x
          + texture2D(uFlesh, wp.xz).r * bl.y
          + texture2D(uFlesh, wp.xy).r * bl.z;
  diffuseColor.rgb *= mix(1.0, 0.45 + f * 1.25, uFleshAmount);
  // Grime pools downward-facing surfaces and creases.
  float down = clamp(-wn.y * 0.5 + 0.5, 0.0, 1.0);
  diffuseColor.rgb *= mix(1.0, 0.55, uGrime * down * (1.0 - f));
  diffuseColor.rgb *= mix(uTintA, uTintB, uTintMix);
}`)
      // --- roughness: greasy where grime pools ---
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{
  vec3 wn = normalize(vCreatureWorldNrm);
  float down = clamp(-wn.y * 0.5 + 0.5, 0.0, 1.0);
  roughnessFactor = clamp(roughnessFactor - uWet * (0.35 + down * 0.25), 0.12, 1.0);
}`)
      // --- lighting: wrapped diffuse + subsurface + rim, then the hit flash ---
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
{
  vec3 wn = normalize(vCreatureWorldNrm);
  vec3 V = normalize(cameraPosition - vCreatureWorldPos);
  float ndl = dot(wn, uRimDir);

  // Wrapped diffuse: pushes the terminator past 90 degrees so the shadowed
  // side of a face keeps its form instead of reading as a flat silhouette.
  float wrapped = max(0.0, (ndl + uWrap) / (1.0 + uWrap));
  gl_FragColor.rgb += diffuseColor.rgb * uRimColor * wrapped * 0.16;

  // Cheap subsurface: light that entered the far side and scattered through.
  float back = pow(clamp(dot(V, -uRimDir) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  gl_FragColor.rgb += uSSSColor * back * uSSSStrength * (0.4 + 0.6 * (1.0 - abs(ndl)));

  // Rim: Fresnel-shaped edge, gated to the lit side so it reads as the moon
  // catching the silhouette rather than a uniform glow.
  float fres = pow(1.0 - clamp(dot(wn, V), 0.0, 1.0), uRimPower);
  float side = clamp(ndl * 0.65 + 0.45, 0.0, 1.0);
  gl_FragColor.rgb += uRimColor * fres * side * uRimStrength;

  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.6, 1.1, 1.0), uHit);
}`);
  };
  mat.needsUpdate = true;
  return mat;
}

/** Set a uniform on an enhanced creature material. Safe if not enhanced. */
export function setCreatureUniform(mat, name, value) {
  const u = mat?.userData?.creatureUniforms?.[name];
  if (!u) return;
  if (u.value && u.value.isColor && typeof value === 'number') u.value.setHex(value);
  else u.value = value;
}

/** Per-instance randomised look, so a horde never reads as clones. */
export function randomCreatureLook(rand01 = Math.random) {
  return {
    fleshScale: 3.5 + rand01() * 3.5,
    fleshAmount: 0.42 + rand01() * 0.3,
    grime: 0.2 + rand01() * 0.45,
    wet: 0.18 + rand01() * 0.3,
    tintMix: rand01(),
    rimStrength: 1.25 + rand01() * 0.6,
  };
}

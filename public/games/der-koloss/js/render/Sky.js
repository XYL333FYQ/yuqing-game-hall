// Procedural night sky + image-based lighting.
//
// The old sky was a 4x128 canvas gradient on a sphere: no moon glow, no cloud,
// no horizon haze, and nothing for PBR materials to reflect. This renders a
// real atmosphere in a shader and bakes it into a PMREM environment so every
// MeshStandardMaterial in the map picks up sky-colored ambient and specular.
import * as THREE from 'three';

const SKY_VERT = /* glsl */`
varying vec3 vWorldDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w; // pin to the far plane
}
`;

const SKY_FRAG = /* glsl */`
precision highp float;
varying vec3 vWorldDir;

uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform float uMoonSize;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform float uStarDensity;
uniform float uCloud;
uniform float uTime;
uniform float uExposure;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(mix(hash13(i + vec3(0,0,0)), hash13(i + vec3(1,0,0)), f.x),
        mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
        mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  return n;
}
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * noise3(p); p *= 2.03; a *= 0.5; }
  return s;
}

// Stars: quantise the direction into cells and light one point per cell, with a
// magnitude distribution so the sky has a few bright anchors, not uniform dots.
vec3 stars(vec3 dir) {
  vec3 p = dir * 260.0;
  vec3 cell = floor(p);
  float rnd = hash13(cell);
  if (rnd > uStarDensity) return vec3(0.0);
  vec3 offset = vec3(hash13(cell + 1.3), hash13(cell + 7.7), hash13(cell + 13.1));
  float d = length(fract(p) - offset);
  float mag = pow(hash13(cell + 41.0), 6.0);
  float twinkle = 0.75 + 0.25 * sin(uTime * (1.5 + rnd * 4.0) + rnd * 30.0);
  float i = smoothstep(0.22, 0.0, d) * mag * twinkle * 9.0;
  // Slight color spread: blue-white giants through to warm dwarfs.
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.86, 0.68), hash13(cell + 91.0));
  return tint * i;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  float h = dir.y;

  // ---- atmosphere gradient ----
  float t = pow(clamp(h * 0.5 + 0.5, 0.0, 1.0), 0.55);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.42, 0.95, t));
  // Thicker air near the horizon scatters more: lift and desaturate it.
  float haze = pow(1.0 - clamp(abs(h), 0.0, 1.0), 5.0);
  sky = mix(sky, uHorizon * 1.35, haze * 0.65);

  // ---- moon ----
  float cosMoon = dot(dir, uMoonDir);
  float disc = smoothstep(1.0 - uMoonSize, 1.0 - uMoonSize * 0.55, cosMoon);
  // Limb darkening keeps the disc from reading as a flat sticker.
  float limb = pow(clamp((cosMoon - (1.0 - uMoonSize)) / max(1e-5, uMoonSize), 0.0, 1.0), 0.35);
  vec3 moon = uMoonColor * disc * (0.55 + 0.45 * limb) * 14.0;
  // Broad forward-scattered halo, then a tight aureole.
  float halo = pow(max(0.0, cosMoon), 190.0) * 1.6 + pow(max(0.0, cosMoon), 12.0) * 0.14;
  moon += uMoonColor * halo;

  // ---- clouds: thin high stratus, silver-rimmed toward the moon ----
  if (uCloud > 0.001 && h > -0.02) {
    vec3 cp = dir / max(0.06, h) * 0.9;
    float c = fbm(cp * 0.5 + vec3(uTime * 0.004, 0.0, uTime * 0.002));
    float cover = smoothstep(0.52, 0.86, c) * smoothstep(-0.02, 0.22, h) * uCloud;
    float rim = pow(max(0.0, cosMoon), 6.0);
    vec3 cloudCol = mix(uHorizon * 1.4, uMoonColor * 1.5, 0.25 + rim * 0.65);
    sky = mix(sky, cloudCol, cover);
    // Clouds occlude the stars behind them.
    sky += stars(dir) * (1.0 - cover);
  } else {
    sky += stars(dir);
  }

  vec3 col = sky + moon;
  // Below the horizon the skybox has to read as dark ground haze, not sky.
  col = mix(col, uGroundColor, smoothstep(0.0, -0.12, h));
  // ---- horizon closure --------------------------------------------------
  // The skybox is drawn with fog:false, so it converged on uHorizon * 1.35
  // while every piece of distant geometry converged on the scene's FogExp2
  // colour. Those are two different values meeting along one line, so wherever
  // the far edge of the ground actually reaches the skyline (over a low wall,
  // from the catwalk, on the map's outer edge) the two sides met at a hard
  // step. Pulling the last few degrees of sky onto exactly the fog colour makes
  // the atmospheric term identical from both sides at h = 0: below it the sky
  // continues down into the darker ground haze, above it the horizon glow
  // returns over ~7 degrees, so the whole crossing is monotonic with no step.
  // uFogColor is divided by the exposure the last line multiplies back in, so
  // the value that lands in the HDR buffer is the fog colour and not a scaled
  // copy of it.
  float closure = 1.0 - smoothstep(0.0, 0.125, abs(h));
  col = mix(col, uFogColor / max(uExposure, 1e-3), closure * closure);
  gl_FragColor = vec4(col * uExposure, 1.0);
}
`;

export class Sky {
  constructor(opts = {}) {
    this.uniforms = {
      uMoonDir: { value: (opts.moonDir || new THREE.Vector3(0.5, 0.62, -0.6)).clone().normalize() },
      uMoonColor: { value: new THREE.Color(opts.moonColor ?? 0xcfe0ff) },
      uMoonSize: { value: opts.moonSize ?? 0.0022 },
      uZenith: { value: new THREE.Color(opts.zenith ?? 0x050912) },
      uHorizon: { value: new THREE.Color(opts.horizon ?? 0x1b2b46) },
      uGroundColor: { value: new THREE.Color(opts.ground ?? 0x05070b) },
      // Kept in lockstep with scene.fog.color by Sky.setFogColor(); the sky and
      // the fogged geometry have to agree on one horizon value or they seam.
      uFogColor: { value: new THREE.Color(opts.fog ?? 0x0a0d14) },
      uStarDensity: { value: opts.starDensity ?? 0.06 },
      uCloud: { value: opts.cloud ?? 0.55 },
      uTime: { value: 0 },
      uExposure: { value: opts.skyExposure ?? 1.0 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.material);
    this.mesh.scale.setScalar(2);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.name = 'sky';
    // The skybox is pinned to the far plane in the vertex shader, so it just
    // needs to follow the camera to stay centered.
    this.mesh.onBeforeRender = (renderer, scene, camera) => {
      this.mesh.position.copy(camera.position);
    };
  }

  update(time) { this.uniforms.uTime.value = time; }

  /**
   * Track the scene's fog colour. Dog rounds lerp the fog from cold blue to a
   * warm ember; if the sky did not follow, the horizon would seam again for
   * exactly as long as that round lasted.
   */
  setFogColor(color) { this.uniforms.uFogColor.value.copy(color); }

  /**
   * Bakes the sky into a prefiltered radiance environment. This is what gives
   * metal its sky reflection and gives every surface a directional ambient
   * term instead of a flat hemisphere constant.
   */
  buildEnvironment(renderer, resolution = 256) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const scene = new THREE.Scene();
    // A separate, non-camera-tracked copy so the bake is centred on the origin.
    const bakeMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), this.material);
    scene.add(bakeMesh);
    const rt = pmrem.fromScene(scene, 0.0, 0.1, 100);
    pmrem.dispose();
    bakeMesh.geometry.dispose();
    this.envMap?.dispose?.();
    this.envMap = rt.texture;
    return rt.texture;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.envMap?.dispose?.();
  }
}

// Fullscreen-triangle pass helper for the post pipeline.
// A single oversized triangle beats a quad: no diagonal seam, one less vertex,
// and the GPU never rasterizes the same 2x2 quad twice along the diagonal.
import * as THREE from 'three';

const _geo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 4);
  return g;
})();

const _cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export class FullScreenPass {
  constructor(fragmentShader, uniforms = {}, defines = {}) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader,
      uniforms,
      defines,
      depthTest: false,
      depthWrite: false,
      // Post passes fully cover the target; blending only costs bandwidth.
      blending: THREE.NoBlending,
    });
    this.mesh = new THREE.Mesh(_geo, this.material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
  }

  get uniforms() { return this.material.uniforms; }

  set(name, value) {
    const u = this.material.uniforms[name];
    if (u) u.value = value;
    return this;
  }

  render(renderer, target = null, clear = false) {
    renderer.setRenderTarget(target);
    if (clear) renderer.clear(true, false, false);
    renderer.render(this.scene, _cam);
    return this;
  }

  dispose() { this.material.dispose(); }
}

export function makeRT(w, h, opts = {}) {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    minFilter: opts.minFilter || THREE.LinearFilter,
    magFilter: opts.magFilter || THREE.LinearFilter,
    format: opts.format || THREE.RGBAFormat,
    type: opts.type || THREE.HalfFloatType,
    depthBuffer: opts.depthBuffer ?? false,
    stencilBuffer: false,
    generateMipmaps: false,
    samples: opts.samples || 0,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  return rt;
}

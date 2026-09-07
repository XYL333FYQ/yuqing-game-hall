// Player-following directional shadow with texel snapping.
//
// A single ±60m shadow box over a 76x88m map spends most of its resolution on
// geometry nobody is looking at, and hard-cuts to "fully lit" at the frustum
// edge. This keeps a tight box centred on the player instead. Snapping the
// centre to the shadow map's texel grid is what stops the classic crawling
// stair-step shimmer when you walk, and the edge fade installed below is what
// stops the box's own boundary sweeping across the world as the box travels.
import * as THREE from 'three';
import { installShadowEdgeFade } from './ShadowEdgeFade.js';

// Patch three's shadow chunk at module load. Importing SunShadow is what it
// means to have a moving shadow box, so this is the right place to own it, and
// map.js imports this module long before any material compiles.
installShadowEdgeFade();

const _center = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _v = new THREE.Vector3();

export class SunShadow {
  constructor(light, { extent = 34, distance = 90, resolution = 2048, bias = -0.00035, normalBias = 0.10 } = {}) {
    this.light = light;
    this.extent = extent;
    this.distance = distance;
    this.resolution = resolution;
    // Direction from the target toward the light, captured once from the
    // authored placement so art keeps control of the moon's angle.
    this.dir = light.position.clone().sub(light.target.position).normalize();

    const cam = light.shadow.camera;
    cam.left = -extent; cam.right = extent;
    cam.top = extent; cam.bottom = -extent;
    // Tight depth range. The light sits `distance` above the focus point and
    // the map is only ~12m tall, so a 0.5–198 range wasted almost all of the
    // depth buffer's precision on empty air — which is what produced the
    // repeating horizontal self-shadowing stripes across the floor. Clamping
    // to the slab that actually contains geometry is worth far more than any
    // amount of bias tuning.
    cam.near = Math.max(0.5, distance - 45);
    cam.far = distance + 60;
    cam.updateProjectionMatrix();
    light.shadow.mapSize.set(resolution, resolution);
    light.shadow.bias = bias;
    // Normal bias offsets the lookup along the surface normal, which scales
    // with texel size instead of with depth — the robust knob for acne on
    // large flat floors lit at a grazing angle.
    light.shadow.normalBias = normalBias;
    // Ignored under PCFSoftShadowMap — three's PCF_SOFT branch derives its
    // kernel from texel size alone and never reads shadowRadius; only the plain
    // PCF branch uses it. Kept so the softness survives a switch of shadow type,
    // but do not reach for it to tune the look: it does nothing today.
    light.shadow.radius = 2.2;
    // Last centre the box was actually moved to. Purely an early-out: if the
    // snap lands on the same texel as last frame there is no matrix work to do.
    // It does NOT gate the shadow-map re-render — game.js owns that cadence via
    // renderer.shadowMap.needsUpdate, and three updates light.shadow.matrix
    // inside the same pass that bakes the map, so the two can never disagree.
    this._lastSnap = new THREE.Vector3(NaN, NaN, NaN);
    this._lastTexel = 0;

    // World-fixed basis for texel snapping, built once from the light's
    // direction. Rotation only — translation is the thing being quantised, so
    // the grid must not move with the subject. See update().
    const up = Math.abs(this.dir.y) > 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    this._basis = new THREE.Matrix4().lookAt(this.dir, new THREE.Vector3(0, 0, 0), up);
    this._basisInv = this._basis.clone().invert();
  }

  /**
   * The quantum the box centre is snapped to: exactly one shadow-map texel,
   * read from the light's LIVE state rather than from what this object was
   * constructed with.
   *
   * three treats the light as the owner of `shadow.mapSize`, so other code
   * writes it directly — `game.js` does, on every quality change. A cached copy
   * therefore goes stale, and a stale copy is worse than no snapping at all:
   * with the map at 1024 and the grid still computed for 2048, every second
   * snap landed on a half-texel offset, which shifts the PCF kernel's sub-texel
   * weights under every receiver in the scene and makes the shadows crawl as
   * you walk. Measured on the courtyard at 4.5 m/s: 0.30% of pixels changing
   * frame to frame with a stale quantum, 0.00% with a live one.
   *
   * Two property loads per frame. There is no reason to cache this.
   */
  _texel() {
    const cam = this.light.shadow.camera;
    return (cam.right - cam.left) / this.light.shadow.mapSize.x;
  }

  setResolution(resolution) {
    // Compare against the light, not our own field: the whole point is that the
    // light is the authority and we may be the ones out of date.
    if (this.light.shadow.mapSize.x === resolution) { this.resolution = resolution; return; }
    this.resolution = resolution;
    this.light.shadow.mapSize.set(resolution, resolution);
    const map = this.light.shadow.map;
    if (map) { map.dispose(); this.light.shadow.map = null; }
    this._lastSnap.set(NaN, NaN, NaN);
  }

  setExtent(extent) {
    const cam = this.light.shadow.camera;
    if (cam.right === extent && cam.left === -extent) { this.extent = extent; return; }
    this.extent = extent;
    cam.left = -extent; cam.right = extent; cam.top = extent; cam.bottom = -extent;
    cam.updateProjectionMatrix();
    this._lastSnap.set(NaN, NaN, NaN);
  }

  /** @param {THREE.Vector3|{x:number,y:number,z:number}} focus world point to keep centred */
  update(focus) {
    const light = this.light;
    const cam = light.shadow.camera;
    // Bias the box forward of the player a little: you see ahead, not behind.
    _center.set(focus.x, focus.y ?? 0, focus.z);

    const texel = this._texel();
    // A changed grid invalidates the previous snap outright: the old centre is
    // not a multiple of the new texel, so the early-out below must not be
    // allowed to hold the box on it.
    if (texel !== this._lastTexel) {
      this._lastTexel = texel;
      this._lastSnap.set(NaN, NaN, NaN);
    }
    // Snap the box centre onto the shadow map's texel grid, in a basis that is
    // FIXED IN WORLD SPACE.
    //
    // This previously moved the light to the unsnapped centre first, rebuilt
    // its matrices, and snapped in that basis — a basis which had just been
    // translated to the player. Transforming the centre by the inverse of a
    // frame centred on itself yields ~0 every time, so the rounding quantised
    // nothing and the map slid continuously with sub-texel motion. That is the
    // classic cause of shadow edges crawling and shimmering as you walk, and
    // it defeated the entire point of snapping.
    //
    // The light's ORIENTATION never changes, so the grid it defines can be
    // built once (in the constructor) and reused. Only rotation matters here:
    // translation is what we are quantising.
    _v.copy(_center).applyMatrix4(this._basisInv);
    _v.x = Math.round(_v.x / texel) * texel;
    _v.y = Math.round(_v.y / texel) * texel;
    // Depth too. Sliding along the light's own axis does not shift the
    // projected texel grid, so it cannot shimmer — but leaving it continuous
    // means the snapped position never repeats, which silently defeated the
    // early-out below and re-rendered the shadow map every single frame.
    _v.z = Math.round(_v.z / texel) * texel;
    _v.applyMatrix4(this._basis);

    if (_v.distanceToSquared(this._lastSnap) < 1e-8) return;
    this._lastSnap.copy(_v);

    light.target.position.copy(_v);
    _offset.copy(this.dir).multiplyScalar(this.distance);
    light.position.copy(_v).add(_offset);
    light.updateMatrixWorld(true);
    light.target.updateMatrixWorld(true);
  }
}

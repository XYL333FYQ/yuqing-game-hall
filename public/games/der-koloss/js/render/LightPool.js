// Fixed-size point-light pool.
//
// Three.js is a forward renderer: every enabled point light is evaluated in the
// fragment shader for every lit pixel, and the light count is baked into the
// shader as `NUM_POINT_LIGHTS`. After the environment-art pass the map had 65
// active point lights — hanging lamps, wall lamps, fluorescents, emergency
// domes, fires, perk machines, teleporters, the mystery box, power-up drops and
// the muzzle flash — which meant 65 light evaluations on every pixel of a
// 1600x900 frame. That alone took the game from 60fps to 21.
//
// The fix is not to delete lights, it is to stop *all* of them being real at
// once. Every authored light stays exactly where it is and keeps animating its
// own intensity; it is simply hidden, and becomes pure data. A small pool of
// real lights then mirrors whichever sources matter most from where the camera
// is standing.
//
// Two properties make this safe:
//   - The pool size never changes, so `NUM_POINT_LIGHTS` is constant and no
//     material ever recompiles mid-frame (a recompile is a visible hitch).
//   - Selection is by contribution, not distance, so a bright fire across the
//     room still beats a dim bulb behind you.
import * as THREE from 'three';

/**
 * The slot half of the pool, split out because the volumetric raymarch has the
 * same problem with a different payload: a fixed number of slots, far more
 * candidates than slots, and a ranking that reorders as the camera moves.
 *
 * Everything here is O(slots), never O(candidates), apart from the caller's own
 * scan — with eight slots the inner loops are 64 comparisons a frame.
 *
 * Three rules, all of which exist because breaking any one of them reads as the
 * lights flickering while you walk:
 *
 *   1. INCUMBENCY. A source already holding a slot keeps it unless a challenger
 *      scores `hysteresis` times better. Two sources of near-equal score would
 *      otherwise trade the same slot every frame.
 *   2. NO POP. A slot's weight moves on a fixed-duration timer, so it reaches
 *      exactly 0 and exactly 1 rather than approaching them, and the owner is
 *      only ever exchanged on a frame where the weight is 0. A slot therefore
 *      never changes both its source and its output in the same frame. A slot
 *      arriving from empty spends one frame at zero for the same reason (see
 *      `fresh`), so this holds for every way a slot can acquire a source, and
 *      the pool writes the incoming transform on that zero frame — the
 *      hardware light's POSITION only ever moves while it is emitting nothing.
 *      RENDERING.md §2 defines the metric that tests this.
 *   3. RESERVATION. This is the one the first version got wrong. A slot losing
 *      its source used to hold it hostage for the whole fade-out, and an
 *      incoming source could only be placed once some slot had gone fully dark
 *      — so with 65 sources chasing 8 slots a light that was in the top eight
 *      by score contributed nothing at all on 57% of frames while running.
 *      Now the incoming source is bound to the slot the instant the outgoing
 *      one starts to die. It is spoken for, it cannot be dropped for want of a
 *      free slot, and it lights up the moment the crossover happens.
 */
export class SlotBank {
  /**
   * @param {number} size number of slots
   * @param {{fadeIn?:number, fadeOut?:number, hysteresis?:number}} [opts]
   */
  constructor(size, opts = {}) {
    this.size = size;
    // Fade-out is quicker than fade-in: it halves the handover latency, and a
    // light going away is far less noticeable than one arriving. Both are slow
    // enough that the largest single-frame step in the smoothstepped weight is
    // ~14% at 60fps, comfortably under the ~20% where a step becomes visible.
    this.fadeIn = opts.fadeIn ?? 0.25;
    this.fadeOut = opts.fadeOut ?? 0.18;
    this.hysteresis = opts.hysteresis ?? 1.7;
    this._cand = new Array(size).fill(null);
    this._score = new Array(size).fill(0);
    this.slots = makeSlots(size);
    // Held-ness lives here rather than on the sources, so two banks ranking the
    // same lights (the pool and the volumetric pass both rank the practicals)
    // cannot clobber each other's incumbency. Bounded by 2 * size.
    this._held = new Set();
  }

  /**
   * Whether `source` currently owns or is reserved against a slot. Callers use
   * it to widen their distance cull for incumbents: a cull applied before the
   * incumbency bonus is a hard cutoff that chatters when you walk along the
   * boundary, because the bonus never gets a chance to run.
   */
  holds(source) { return this._held.has(source); }

  /** Begin a frame's ranking. */
  begin() {
    const c = this._cand, s = this._score;
    for (let i = 0; i < this.size; i++) { c[i] = null; s[i] = 0; }
  }

  /**
   * Offer a source at `score` (higher wins). The incumbency bonus is applied
   * here so every caller gets it, and gets it consistently.
   */
  offer(source, score) {
    if (this._held.has(source)) score *= this.hysteresis;
    const n = this.size, c = this._cand, sc = this._score;
    if (score <= sc[n - 1]) return;
    let at = n - 1;
    while (at > 0 && sc[at - 1] < score) { c[at] = c[at - 1]; sc[at] = sc[at - 1]; at--; }
    c[at] = source; sc[at] = score;
  }

  /**
   * Resolve the ranking into slots and advance every cross-fade by `dt`.
   * Afterwards each slot exposes `.source` and `.weight` (0..1).
   */
  commit(dt) {
    const n = this.size, cand = this._cand, slots = this.slots;

    // 1. Incumbents keep the slot they are already in. Assignment is by source
    //    identity, never by rank order, so a source entering the list cannot
    //    shuffle every other source onto a different hardware light.
    for (let i = 0; i < n; i++) {
      const sl = slots[i];
      sl.wanted = false;
      if (!sl.source) continue;
      for (let j = 0; j < n; j++) {
        if (cand[j] === sl.source) { cand[j] = null; sl.wanted = true; break; }
      }
    }

    // 2. Existing reservations. A slot whose own source came back into the
    //    ranking no longer needs one, and releasing it returns that source to
    //    the pile so a genuinely free slot can light it immediately.
    for (let i = 0; i < n; i++) {
      const sl = slots[i];
      if (!sl.pending) continue;
      if (sl.wanted) { sl.pending = null; continue; }
      let still = false;
      for (let j = 0; j < n; j++) {
        if (cand[j] === sl.pending) { cand[j] = null; still = true; break; }
      }
      if (!still) sl.pending = null;
    }

    // 3. Place what is left. An empty slot can light a source this frame, so
    //    those go first; otherwise reserve against a slot that is on its way
    //    out. Only if neither exists is a candidate genuinely dropped, and that
    //    means every slot is already committed to something better.
    for (let j = 0; j < n; j++) {
      const c = cand[j];
      if (!c) continue;
      let placed = false;
      for (let i = 0; i < n; i++) {
        const sl = slots[i];
        if (sl.source || sl.pending) continue;
        sl.source = c; sl.k = 0; sl.wanted = true; sl.fresh = true; placed = true; break;
      }
      if (!placed) {
        for (let i = 0; i < n; i++) {
          const sl = slots[i];
          if (sl.pending || sl.wanted || !sl.source) continue;
          sl.pending = c; placed = true; break;
        }
      }
      if (placed) cand[j] = null;
    }

    // 4. Advance the fades. `k` is a duration timer, not an exponential
    //    approach: it lands on exactly 0 and exactly 1 instead of merely
    //    getting close. That matters because the old code freed a slot at
    //    `fade <= 0.02`, which for a 60-candela fire is still 1.2 candela of
    //    output being cut dead in a single frame.
    const up = dt / this.fadeIn, down = dt / this.fadeOut;
    this._held.clear();
    for (let i = 0; i < n; i++) {
      const sl = slots[i];
      const rising = !!sl.source && sl.wanted && !sl.pending;
      // A slot that was EMPTY and has just been handed a source spends this
      // one frame at zero before it starts to rise. Without it the only
      // handover that still moved a lit light was this one: an empty slot took
      // its source and reached weight 0.013 in the same commit, so the frame
      // that moved the hardware light to the new source was also the frame it
      // began emitting. The cost is 16.7ms of latency on a light arriving out
      // of darkness; the crossover path the reservation exists to serve does
      // not wait at all, because those slots are never `fresh`.
      if (sl.fresh) sl.fresh = false;
      else sl.k = rising ? Math.min(1, sl.k + up) : Math.max(0, sl.k - down);
      if (sl.k <= 0) {
        // The owner only ever changes on a frame where the slot emits nothing.
        if (sl.pending) { sl.source = sl.pending; sl.pending = null; sl.wanted = true; }
        else if (!sl.wanted) sl.source = null;
      }
      // Smoothstep, so the ramp has zero slope at both ends and neither the
      // departure from black nor the arrival at full reads as a corner.
      sl.weight = sl.k <= 0 ? 0 : sl.k * sl.k * (3 - 2 * sl.k);
      if (sl.source) this._held.add(sl.source);
      if (sl.pending) this._held.add(sl.pending);
    }
  }

  /** Drop every assignment (teardown, or a resize that rebuilds the slots). */
  clear() {
    for (const sl of this.slots) { sl.source = null; sl.pending = null; sl.k = 0; sl.weight = 0; sl.wanted = false; sl.fresh = false; }
    this._held.clear();
  }

  setSize(size) {
    if (size === this.size) return;
    this.size = size;
    this._cand = new Array(size).fill(null);
    this._score = new Array(size).fill(0);
    this.slots = makeSlots(size);
    this._held.clear();
  }
}

export class LightPool {
  /**
   * @param {THREE.Scene} scene
   * @param {number} size number of real point lights to keep alive
   */
  constructor(scene, size = 8) {
    this.scene = scene;
    this.size = size;
    this.sources = [];
    this.lights = [];
    this._rescanT = 0;
    this._bank = new SlotBank(size);

    for (let i = 0; i < size; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.name = `pooledPointLight${i}`;
      l.userData.pooled = true;      // rescan() must never adopt its own output
      l.layers.enableAll();          // must light the viewmodel pass too
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
  }

  /** The slot records, for instrumentation and for tests. */
  get _slots() { return this._bank.slots; }

  /**
   * Take ownership of every point light already in the scene: hide it (so it
   * costs nothing) and record it as a source. Safe to call repeatedly — new
   * lights added later (power-up drops, effects) are picked up automatically.
   */
  rescan() {
    const seen = this._seen || (this._seen = new Set());
    this.sources.length = 0;
    this.scene.traverse((o) => {
      if (!o.isPointLight) return;
      if (o.userData.pooled) return;              // one of ours
      if (!seen.has(o)) { seen.add(o); o.userData.poolManaged = true; }
      // Hidden lights are skipped entirely by three's render-list build, which
      // is the whole point — but they keep their transform and their intensity,
      // so the systems that animate them need no changes at all.
      o.visible = false;
      this.sources.push(o);
    });
  }

  /** @param {THREE.Vector3} cameraPos */
  update(dt, cameraPos) {
    // Rescan occasionally rather than every frame: drops and effects create
    // lights at runtime, but a scene traverse twice a second is free.
    this._rescanT -= dt;
    if (this._rescanT <= 0) { this._rescanT = 0.5; this.rescan(); }

    const bank = this._bank;
    bank.begin();

    // Ranking runs on a peak-hold of each source's intensity rather than its
    // instantaneous value. Half the map's practicals flicker on purpose, and a
    // lamp that dips to 12% for two frames must not lose its slot and come
    // back — that reads as the whole room strobing rather than one bad tube.
    const hold = Math.exp(-dt * 2.2);
    for (const s of this.sources) {
      const ud = s.userData;
      const smooth = ud.poolSmooth = Math.max(s.intensity, (ud.poolSmooth || 0) * hold);
      if (!(smooth > 0.02)) continue;
      // Rank on the WORLD position. Practicals that belong to a machine live
      // inside that machine's group, so their local position is a few
      // centimetres from the group origin — ranking on it put every perk
      // machine, the mystery box and the Pack-a-Punch light 15m from where they
      // actually are, which both starved them of a slot and made them flick in
      // and out as the bogus distance crossed the cull radius.
      // matrixWorld is one frame stale here, which no eye can see.
      _wp.setFromMatrixPosition(s.matrixWorld);
      const dx = _wp.x - cameraPos.x;
      const dy = _wp.y - cameraPos.y;
      const dz = _wp.z - cameraPos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      // The cull gets its own hysteresis band. It is a `continue`, so a source
      // that crosses the boundary is not merely outranked, it stops being a
      // candidate at all and the incumbency bonus below never runs — walking
      // along a lamp's reach radius made it chatter in and out.
      const reach = ((s.distance || 12) + 4) * (bank.holds(s) ? CULL_KEEP : 1);
      if (d2 > reach * reach) continue;
      // Irradiance-ish ranking: a bright light far away can still outrank a
      // dim one underfoot, which pure distance sorting gets wrong.
      bank.offer(s, smooth / (d2 + 1));
    }

    bank.commit(dt);

    // Bound by the ACTUAL light array, not by this.size. The two are rebuilt
    // separately in setSize() and cleared in dispose(), so any update landing
    // between those steps would index past the end and throw on undefined —
    // and this runs inside the frame loop, so a throw here stops rendering
    // entirely rather than degrading. The guard costs one comparison.
    const n = Math.min(this.size, this.lights.length);
    for (let i = 0; i < n; i++) {
      const sl = bank.slots[i];
      const l = this.lights[i];
      const s = sl.source;
      if (!s) { l.intensity = 0; continue; }
      // Follow the source even while the slot is DARK.
      //
      // The bank already guarantees a slot only changes owner on a frame whose
      // weight is exactly 0. But skipping the transform write on that frame
      // left the hardware light parked at the outgoing source's position for
      // one frame longer, so it moved on the frame it came back on at 1.3% of
      // full — not on the frame it was black. Nothing was ever visible either
      // way, and yet the honest question "can a lit pooled light jump?" had to
      // be answered yes. Two agents measuring this pool disagreed by 100
      // events a minute for exactly this reason, one counting the dark
      // handover frame and one counting the frame after it.
      //
      // Writing a transform onto a light of zero intensity is free: the pooled
      // lights are permanently `visible`, so three uploads all NUM_POINT_LIGHTS
      // uniforms every frame regardless of what we put in them.
      l.position.setFromMatrixPosition(s.matrixWorld);
      l.color.copy(s.color);
      l.distance = s.distance;
      l.decay = s.decay;
      // The source's own animation is untouched: the authored flicker of a
      // failing tube or a fire multiplies through the slot weight, it is not
      // replaced by it.
      l.intensity = sl.weight <= 0 ? 0 : s.intensity * sl.weight;
    }
  }

  setSize(size) {
    if (size === this.size) return;
    // Changing the pool size recompiles every material, so this is a settings
    // operation, never a per-frame one.
    for (const l of this.lights) { this.scene.remove(l); l.dispose?.(); }
    this.lights.length = 0;
    this.size = size;
    this._bank.setSize(size);
    for (let i = 0; i < size; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.name = `pooledPointLight${i}`;
      l.userData.pooled = true;
      l.layers.enableAll();
      l.castShadow = false;
      this.scene.add(l);
      this.lights.push(l);
    }
  }

  dispose() {
    for (const l of this.lights) { this.scene.remove(l); l.dispose?.(); }
    this.lights.length = 0;
    this._bank.clear();
    // Hand the authored lights back so a re-init starts from a clean slate.
    for (const s of this.sources) s.visible = true;
    this.sources.length = 0;
  }
}

const _wp = new THREE.Vector3();

// How much further out an incumbent stays a candidate before the distance cull
// drops it. Without a band the cull is a hard on/off edge.
const CULL_KEEP = 1.25;

function makeSlots(size) {
  const slots = new Array(size);
  for (let i = 0; i < size; i++) {
    slots[i] = { source: null, pending: null, k: 0, weight: 0, wanted: false, fresh: false };
  }
  return slots;
}

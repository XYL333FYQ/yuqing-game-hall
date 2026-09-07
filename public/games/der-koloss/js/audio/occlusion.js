// Occlusion: is the straight line from an emitter to the listener blocked?
//
// Two sources of truth, in priority order:
//   1. `audio.setOcclusionTest(fn)` — a hook game.js can install to use the real
//      collider set (see the report). It must return 0..1 (0 = clear).
//   2. The static wall shell derived from `map-layout.js` MAP_WALL_RUNS.
//      This is always available, needs no cooperation from game.js, and covers
//      the walls that actually matter for muffling a gunshot in another room.
//
// Every test is throttled (a hard budget of tests per second) and memoised on a
// coarse position grid, so a horde of thirty emitters costs a handful of cheap
// 2-D segment intersections per second — never a raycast per sound per frame.

import { MAP_WALL_RUNS } from '../map-layout.js';

// Ear height. Window sills stop at 0.9 m and window headers start at 2.2 m, so
// at 1.6 m every kind of gap (window aperture, doorway, passage) reads as open.
const OPEN_GAP_KINDS = new Set(['window', 'door', 'passage']);

/** Flatten MAP_WALL_RUNS into 2-D segments with a vertical extent. */
function buildSegments() {
  const segs = [];
  for (const run of MAP_WALL_RUNS) {
    const horiz = Math.abs(run.z2 - run.z1) < 0.001;
    const len = horiz ? run.x2 - run.x1 : run.z2 - run.z1;
    if (Math.abs(len) < 0.01) continue;
    const y0 = run.y0 || 0;
    const y1 = y0 + (run.h || 4.5);
    const gaps = [...(run.gaps || [])]
      .filter((g) => OPEN_GAP_KINDS.has(g.kind))
      .sort((a, b) => a.at - b.at);
    let cur = 0;
    const spans = [];
    for (const g of gaps) {
      spans.push([cur, g.at - g.w / 2, y0, y1]);
      // A window is only open between the 0.9 m sill and the 2.2 m header;
      // a door/passage opening is clear up to 3 m with solid lintel above.
      if (g.kind === 'window') {
        spans.push([g.at - g.w / 2, g.at + g.w / 2, y0, y0 + 0.9]);
        if (y1 > y0 + 2.2) spans.push([g.at - g.w / 2, g.at + g.w / 2, y0 + 2.2, y1]);
      } else if (y1 > y0 + 3) {
        spans.push([g.at - g.w / 2, g.at + g.w / 2, y0 + 3, y1]);
      }
      cur = g.at + g.w / 2;
    }
    spans.push([cur, len, y0, y1]);
    for (const [a, b, ya, yb] of spans) {
      if (b - a < 0.05 || yb - ya < 0.05) continue;
      segs.push(horiz
        ? { x1: run.x1 + a, z1: run.z1, x2: run.x1 + b, z2: run.z1, y0: ya, y1: yb }
        : { x1: run.x1, z1: run.z1 + a, x2: run.x1, z2: run.z1 + b, y0: ya, y1: yb });
    }
  }
  return segs;
}

const SEGMENTS = buildSegments();
export const WALL_SEGMENT_COUNT = SEGMENTS.length;

/**
 * How many wall segments the A->B line crosses, respecting each wall's height.
 * Returns a count (0, 1, 2, ...) rather than a boolean so "two rooms away"
 * muffles harder than "one wall away".
 */
export function wallsBetween(ax, ay, az, bx, by, bz) {
  const rx = bx - ax, rz = bz - az, ry = by - ay;
  let hits = 0;
  for (let i = 0; i < SEGMENTS.length; i++) {
    const s = SEGMENTS[i];
    const sx = s.x2 - s.x1, sz = s.z2 - s.z1;
    const denom = rx * sz - rz * sx;
    if (Math.abs(denom) < 1e-9) continue; // parallel
    const dx = s.x1 - ax, dz = s.z1 - az;
    const t = (dx * sz - dz * sx) / denom;      // along the A->B ray
    if (t <= 0.001 || t >= 0.999) continue;
    const u = (dx * rz - dz * rx) / denom;      // along the wall segment
    if (u < 0 || u > 1) continue;
    const y = ay + ry * t;
    if (y < s.y0 - 0.05 || y > s.y1 + 0.05) continue;
    hits++;
    if (hits >= 3) break;                       // saturated; stop early
  }
  return hits;
}

/**
 * Budgeted, memoised occlusion oracle.
 * `amountFor()` never blocks and never throws — when the budget is spent it
 * simply reuses the last known answer (or "clear" if there isn't one yet).
 */
export class OcclusionCache {
  constructor({ testsPerSecond = 15, cellSize = 2.0, ttlMs = 700, maxEntries = 256 } = {}) {
    this.testsPerSecond = testsPerSecond;
    this.cellSize = cellSize;
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.custom = null;       // installed via audio.setOcclusionTest()
    this.enabled = true;
    this.map = new Map();     // cellKey -> { amount, t }
    this._budget = testsPerSecond;
    this._budgetT = 0;
    this.tests = 0;           // lifetime counter, useful for assertions
  }

  setTest(fn) { this.custom = typeof fn === 'function' ? fn : null; }

  _key(ex, ez, lx, lz) {
    const c = this.cellSize;
    return `${Math.round(ex / c)},${Math.round(ez / c)}|${Math.round(lx / c)},${Math.round(lz / c)}`;
  }

  /** 0 = fully clear, 1 = heavily occluded. */
  amountFor(ex, ey, ez, lx, ly, lz, nowMs) {
    if (!this.enabled) return 0;
    const key = this._key(ex, ez, lx, lz);
    const hit = this.map.get(key);
    if (hit && nowMs - hit.t < this.ttlMs) return hit.amount;

    // refill the per-second test budget
    if (nowMs - this._budgetT >= 1000) { this._budget = this.testsPerSecond; this._budgetT = nowMs; }
    if (this._budget <= 0) return hit ? hit.amount : 0;
    this._budget--;
    this.tests++;

    let amount = 0;
    try {
      if (this.custom) {
        const v = this.custom(ex, ey, ez, lx, ly, lz);
        amount = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : (v ? 1 : 0);
      } else {
        const n = wallsBetween(ex, ey, ez, lx, ly, lz);
        amount = n === 0 ? 0 : n === 1 ? 0.62 : 0.9;
      }
    } catch (e) { amount = 0; } // a broken hook must never break playback

    if (this.map.size >= this.maxEntries) {
      // cheap eviction: drop the oldest inserted key
      const first = this.map.keys().next();
      if (!first.done) this.map.delete(first.value);
    }
    this.map.set(key, { amount, t: nowMs });
    return amount;
  }

  clear() { this.map.clear(); }
}

// Enemy navigation: a layered walkable grid over the real map colliders.
//
// WHY THIS EXISTS
// ---------------
// Enemy movement used to be "steer straight at the target, and if the room is
// different, follow a room-to-room BFS through doorways". That is a topology
// graph, not a navigation mesh, and it has two holes the player sees constantly:
//
//   1. Inside a single room there was NO routing at all. Every crate, barrel,
//      sandbag stack, generator, perk machine and pillar in this map is a
//      collider, and a zombie or hound whose target sat behind one walked into
//      it and stayed there. depenetration cancelled the move exactly, so the
//      body ground against a prop with a full run cycle playing — the "stuck on
//      nothing" the player reports. The old single-step wall-slide only fired
//      when a *perpendicular* 1m probe happened to be completely free of every
//      collider, which is almost never true in a corner or between two props.
//
//   2. The only recovery was a six-second timer that TELEPORTED the enemy next
//      to the player. That is both a long visible stall and a physics violation.
//
// This module replaces the guesswork with a real search space. It samples the
// map's own `floorY` and `colliders` — never a hand-authored parallel copy — so
// it can never disagree with what the movement code will actually permit.
//
// LAYERED, NOT FLAT
// -----------------
// Der Koloss stacks walkable surfaces: balconies over corridors, the bridge over
// the courtyard mouth, Chemical Testing over the garage, the catwalk over the
// factory floor. A flat 2D grid cannot express "the courtyard is walkable here
// AND the balcony is walkable 2.9m above here", so each grid COLUMN carries up
// to MAX_LEVELS distinct standing heights.
//
// Connectivity between columns is not guessed either. `floorY(x, z, curY)` is
// the game's own answer to "standing at height curY, what do I stand on if I
// step to (x,z)?" — including its 1.6m tolerance band, which is what lets a
// zombie clamber the mainframe lip but not levitate onto a 2.9m balcony. Links
// are built by ASKING that function, so stairs, ramps, ledges and drops all fall
// out of the map definition instead of being re-encoded here.

// Enemy body radius. Matches the circle `moveZombie` resolves with, so a cell
// this grid calls walkable is a cell the mover can actually hold.
export const NAV_RADIUS = 0.3;
// Cell size. Small enough that a 1.6m window gap and a 1.9m doorway both get
// several clear cells across; large enough that a full build stays in the tens
// of milliseconds. Do not raise this without re-running the reachability check
// in scripts/validate-enemy-navigation.mjs.
export const NAV_CELL = 0.45;
// Distinct standing heights a single column may carry. The map's deepest stack
// is ground -> balcony (2 levels); the mainframe steps make 3 in one column.
const MAX_LEVELS = 3;
// Vertical band a standing enemy occupies, relative to its feet. Identical to
// the filter `moveZombie` applies, so "blocked here" means the same thing to the
// grid and to the collision resolver.
const BODY_LOW = 0.25;
const BODY_HIGH = 1.1;
// How far an enemy may fall to reach a lower cell. The authored balcony drops
// are 2.9m and the catwalk is 3.1m; anything beyond this is a pit, not a route.
const MAX_DROP = 3.4;
// A height gain larger than this is a climb, not a step. `floorY`'s own 1.6m
// tolerance already refuses to hand back a surface further above the enemy than
// that, so this only has to agree with it.
const MAX_STEP_UP = 1.55;
const NO_LINK = 255;

// 8-connected, orthogonals first so a tie in the heap prefers a straight line.
const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
// Diagonal d requires both of these orthogonal neighbours to be traversable,
// otherwise the path cuts the corner of a wall or squeezes a body diagonally
// between two crates that touch.
const DIAG_GUARD = [null, null, null, null, [0, 2], [0, 3], [1, 2], [1, 3]];

function circleHitsBox(x, z, r, b) {
  const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
  const cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

// Does this collider stop an ENEMY whose feet are at `y`?
//
// `shootOk` panels sit above head height and exist only for bullets.
// `playerOnly` is the mainframe platform lip, which zombies are meant to clamber
// straight up — floorY already grants them the deck, so treating the lip as
// solid would wall off a route the game intends to be open.
function blocksEnemy(c, y) {
  if (c.shootOk || c.playerOnly) return false;
  if (c.y0 === undefined) return true;
  return !(c.y0 > y + BODY_HIGH || c.y0 + c.h < y + BODY_LOW);
}

// ---------------------------------------------------------------------------
// Collider spatial hash.
//
// The map carries ~310 colliders. Testing all of them per cell during a build,
// and per enemy per frame at runtime, is the difference between this system
// being free and being the frame budget. Bucketed lookup makes both ~10 tests.
// ---------------------------------------------------------------------------
const BUCKET = 4;

class ColliderHash {
  constructor(colliders, minX, minZ, maxX, maxZ) {
    this.minX = minX; this.minZ = minZ;
    this.cols = Math.max(1, Math.ceil((maxX - minX) / BUCKET));
    this.rows = Math.max(1, Math.ceil((maxZ - minZ) / BUCKET));
    this.cells = new Array(this.cols * this.rows);
    for (const c of colliders) this.insert(c);
  }

  insert(c) {
    const i0 = this._cx(c.minX - NAV_RADIUS), i1 = this._cx(c.maxX + NAV_RADIUS);
    const j0 = this._cz(c.minZ - NAV_RADIUS), j1 = this._cz(c.maxZ + NAV_RADIUS);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * this.cols + i;
        (this.cells[k] || (this.cells[k] = [])).push(c);
      }
    }
  }

  _cx(x) { return Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.minX) / BUCKET))); }
  _cz(z) { return Math.max(0, Math.min(this.rows - 1, Math.floor((z - this.minZ) / BUCKET))); }

  at(x, z) { return this.cells[this._cz(z) * this.cols + this._cx(x)]; }

  /** Append every collider near (x,z) that stops an enemy standing at `y`. */
  gather(x, z, y, out) {
    const list = this.at(x, z);
    if (!list) return out;
    for (const c of list) if (blocksEnemy(c, y)) out.push(c);
    return out;
  }
}

// ---------------------------------------------------------------------------
// Binary heap keyed on f-score. Typed arrays, reused across searches.
// ---------------------------------------------------------------------------
class Heap {
  constructor(cap) {
    this.node = new Int32Array(cap);
    this.f = new Float32Array(cap);
    this.n = 0;
    this.cap = cap;
  }

  clear() { this.n = 0; }

  push(node, f) {
    // GROW, never drop. A heap that silently discards pushes when it fills does
    // not slow the search down, it AMPUTATES it: the open set drains, the loop
    // exits with the frontier empty, and the caller is handed a partial route
    // that looks exactly like a genuinely unreachable target. That is worth
    // spelling out because it cost a debugging session — every long cross-map
    // path failed while every short one worked, which reads like a budget
    // problem and is not one. The open set holds one entry per g-improvement,
    // so it is legitimately larger than the node count.
    if (this.n >= this.cap) this._grow();
    let i = this.n++;
    this.node[i] = node; this.f[i] = f;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p] <= this.f[i]) break;
      this._swap(p, i); i = p;
    }
  }

  pop() {
    const top = this.node[0];
    if (--this.n > 0) {
      this.node[0] = this.node[this.n]; this.f[0] = this.f[this.n];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < this.n && this.f[l] < this.f[s]) s = l;
        if (r < this.n && this.f[r] < this.f[s]) s = r;
        if (s === i) break;
        this._swap(s, i); i = s;
      }
    }
    return top;
  }

  _swap(a, b) {
    const tn = this.node[a]; this.node[a] = this.node[b]; this.node[b] = tn;
    const tf = this.f[a]; this.f[a] = this.f[b]; this.f[b] = tf;
  }

  _grow() {
    this.cap *= 2;
    const node = new Int32Array(this.cap); node.set(this.node); this.node = node;
    const f = new Float32Array(this.cap); f.set(this.f); this.f = f;
  }
}

// ---------------------------------------------------------------------------

export class NavGrid {
  constructor(map, { cell = NAV_CELL, radius = NAV_RADIUS } = {}) {
    this.map = map;
    this.cell = cell;
    this.radius = radius;

    // Bounds: the union of every room rectangle, plus a margin wide enough to
    // include the wall thickness and the boarded-window alcoves that hang off
    // the outside of a room rect.
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const r of map.rooms) {
      minX = Math.min(minX, r.rect.minX); maxX = Math.max(maxX, r.rect.maxX);
      minZ = Math.min(minZ, r.rect.minZ); maxZ = Math.max(maxZ, r.rect.maxZ);
    }
    const MARGIN = 3;
    this.minX = minX - MARGIN; this.minZ = minZ - MARGIN;
    this.maxX = maxX + MARGIN; this.maxZ = maxZ + MARGIN;
    this.cols = Math.ceil((this.maxX - this.minX) / cell);
    this.rows = Math.ceil((this.maxZ - this.minZ) / cell);

    // Columns outside every room are pure cost during a build: they can never
    // be walkable, and there are a lot of them in the bounding box of an
    // L-shaped map. Pre-testing membership against slightly grown rects (so
    // thresholds and window alcoves survive) prunes roughly half the grid.
    this._roomRects = map.rooms.map((r) => ({
      minX: r.rect.minX - 1.0, maxX: r.rect.maxX + 1.0,
      minZ: r.rect.minZ - 1.0, maxZ: r.rect.maxZ + 1.0,
    }));

    const n = this.cols * this.rows;
    this.lvlCount = new Uint8Array(n);
    this.lvlY = new Float32Array(n * MAX_LEVELS);
    this.lvlOk = new Uint8Array(n * MAX_LEVELS);
    this.link = new Uint8Array(n * MAX_LEVELS * 8);

    // Height probes used to enumerate a column's standing levels. floorY only
    // hands back a raised surface when the query height is already within its
    // tolerance of it, so a ladder of probes is what discovers the upper decks.
    const heights = new Set([0]);
    for (const zn of map.floorZones || []) heights.add(zn.y);
    for (const r of map.ramps || []) { heights.add(r.y0); heights.add(r.y1); }
    let top = 0;
    for (const h of heights) top = Math.max(top, h);
    this._probes = [];
    for (let h = 0; h <= top + 0.4; h += 0.35) this._probes.push(h);
    for (const h of heights) if (!this._probes.includes(h)) this._probes.push(h);
    this._probes.sort((a, b) => a - b);

    this._scratch = [];
    this.epoch = 0;
    this.hash = null;
    this.rebuildAll();

    const nodes = n * MAX_LEVELS;
    this.g = new Float32Array(nodes);
    this.stamp = new Int32Array(nodes);
    this.closed = new Int32Array(nodes);
    this.from = new Int32Array(nodes);
    this.run = 0;
    this.heap = new Heap(8192);
  }

  // ---- indexing ----
  ci(x) { return Math.floor((x - this.minX) / this.cell); }
  cj(z) { return Math.floor((z - this.minZ) / this.cell); }
  cx(i) { return this.minX + (i + 0.5) * this.cell; }
  cz(j) { return this.minZ + (j + 0.5) * this.cell; }
  inside(i, j) { return i >= 0 && j >= 0 && i < this.cols && j < this.rows; }

  _inAnyRoom(x, z) {
    for (const r of this._roomRects) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
    }
    return false;
  }

  // ---- build ----
  rebuildAll() {
    this.hash = new ColliderHash(this.map.colliders, this.minX, this.minZ, this.maxX, this.maxZ);
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) this._levels(i, j);
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) this._links(i, j);
    this.epoch++;
  }

  /**
   * Recompute a rectangle of the grid after the world changed under it — a door
   * opening splices its collider out of the map, and the mystery box moves its
   * own. Rebuilding only the affected columns keeps a door open instantaneous
   * instead of costing a full grid sweep mid-round.
   *
   * Links reach one cell outward, so the link pass covers a ring wider than the
   * level pass; otherwise a neighbour outside the region keeps a stale link into
   * a cell whose walkability just changed.
   */
  rebuildRegion(minX, minZ, maxX, maxZ) {
    this.hash = new ColliderHash(this.map.colliders, this.minX, this.minZ, this.maxX, this.maxZ);
    const pad = this.cell * 2 + this.radius;
    const i0 = Math.max(0, this.ci(minX - pad)), i1 = Math.min(this.cols - 1, this.ci(maxX + pad));
    const j0 = Math.max(0, this.cj(minZ - pad)), j1 = Math.min(this.rows - 1, this.cj(maxZ + pad));
    if (i1 < i0 || j1 < j0) return;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this._levels(i, j);
    for (let j = j0 - 1; j <= j1 + 1; j++) {
      for (let i = i0 - 1; i <= i1 + 1; i++) if (this.inside(i, j)) this._links(i, j);
    }
    this.epoch++;
  }

  /** Enumerate the distinct standing heights of one column and test each. */
  _levels(i, j) {
    const col = j * this.cols + i;
    const base = col * MAX_LEVELS;
    this.lvlCount[col] = 0;
    this.lvlOk[base] = 0; this.lvlOk[base + 1] = 0; this.lvlOk[base + 2] = 0;
    const x = this.cx(i), z = this.cz(j);
    if (!this._inAnyRoom(x, z)) return;
    const floorY = this.map.floorY;
    let count = 0;
    for (const probe of this._probes) {
      const y = floorY(x, z, probe);
      let dup = false;
      for (let k = 0; k < count; k++) if (Math.abs(this.lvlY[base + k] - y) < 0.02) { dup = true; break; }
      if (dup) continue;
      if (count >= MAX_LEVELS) break;
      this.lvlY[base + count] = y;
      this.lvlOk[base + count] = this._clear(x, z, y) ? 1 : 0;
      count++;
    }
    this.lvlCount[col] = count;
  }

  /** Can a body of `radius` stand centred at (x,z) with its feet at y? */
  _clear(x, z, y) {
    const list = this.hash.at(x, z);
    if (!list) return true;
    for (const c of list) {
      if (!blocksEnemy(c, y)) continue;
      if (circleHitsBox(x, z, this.radius, c)) return false;
    }
    return true;
  }

  /**
   * Fill this column's outgoing links.
   *
   * The height an enemy lands on is not chosen here — `floorY(nx, nz, y)` is
   * asked, exactly as the movement code asks it every frame. Whatever surface it
   * names is the surface the link goes to, so ramps, stair flights, the
   * mainframe lip and the balcony drops all become links without this file
   * knowing any of them exist.
   */
  _links(i, j) {
    const col = j * this.cols + i;
    const base = col * MAX_LEVELS;
    const lbase = col * MAX_LEVELS * 8;
    const levels = this.lvlCount[col];
    for (let l = 0; l < MAX_LEVELS; l++) {
      const ok = l < levels && this.lvlOk[base + l];
      for (let d = 0; d < 8; d++) this.link[lbase + l * 8 + d] = NO_LINK;
      if (!ok) continue;
      const y = this.lvlY[base + l];
      for (let d = 0; d < 8; d++) {
        const ni = i + DIRS[d][0], nj = j + DIRS[d][1];
        if (!this.inside(ni, nj)) continue;
        const target = this._landing(ni, nj, y);
        if (target < 0) continue;
        // Diagonals may not clip a corner: both orthogonal components have to be
        // traversable from here too, or the body scrapes through geometry the
        // straight moves agree is solid.
        const guard = DIAG_GUARD[d];
        if (guard && (this.link[lbase + l * 8 + guard[0]] === NO_LINK
                   || this.link[lbase + l * 8 + guard[1]] === NO_LINK)) continue;
        this.link[lbase + l * 8 + d] = target;
      }
    }
  }

  /**
   * Which level of column (ni,nj) does a body standing at height `y` arrive on?
   * Returns the level index, or -1 if the step is illegal.
   */
  _landing(ni, nj, y) {
    const ncol = nj * this.cols + ni;
    const count = this.lvlCount[ncol];
    if (!count) return -1;
    const nbase = ncol * MAX_LEVELS;
    const nx = this.cx(ni), nz = this.cz(nj);
    const ny = this.map.floorY(nx, nz, y);
    const dy = ny - y;
    if (dy > MAX_STEP_UP || dy < -MAX_DROP) return -1;
    for (let k = 0; k < count; k++) {
      if (Math.abs(this.lvlY[nbase + k] - ny) > 0.02) continue;
      if (!this.lvlOk[nbase + k]) return -1;
      // Stepping off a ledge means passing through the destination column at the
      // height you left from, not only at the height you land on.
      if (dy < -0.5 && !this._clear(nx, nz, y)) return -1;
      return k;
    }
    return -1;
  }

  // ---- queries ----
  /** Node id for the walkable level of (x,z) closest to `y`, or -1. */
  nodeAt(x, z, y) {
    const i = this.ci(x), j = this.cj(z);
    if (!this.inside(i, j)) return -1;
    return this._nodeInColumn(i, j, y);
  }

  _nodeInColumn(i, j, y) {
    const col = j * this.cols + i;
    const count = this.lvlCount[col];
    const base = col * MAX_LEVELS;
    let best = -1, bd = Infinity;
    for (let k = 0; k < count; k++) {
      if (!this.lvlOk[base + k]) continue;
      const d = Math.abs(this.lvlY[base + k] - y);
      if (d < bd) { bd = d; best = base + k; }
    }
    // A level more than a storey away is a different deck, not this body's.
    return bd <= 2.0 ? best : -1;
  }

  /**
   * Nearest walkable node to a world point, searching outward in rings.
   *
   * This is what rescues a body that has been shoved inside geometry — by the
   * crowd separation push, by a door closing on it, or by spawning in a pocket.
   * Without it a wedged enemy has no node, therefore no path, and the old code's
   * only answer was the teleport.
   */
  nearestNode(x, z, y, maxRings = 7) {
    const direct = this.nodeAt(x, z, y);
    if (direct >= 0) return direct;
    const i0 = this.ci(x), j0 = this.cj(z);
    for (let r = 1; r <= maxRings; r++) {
      let best = -1, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = i0 + di, j = j0 + dj;
          if (!this.inside(i, j)) continue;
          const node = this._nodeInColumn(i, j, y);
          if (node < 0) continue;
          const dx = this.cx(i) - x, dz = this.cz(j) - z;
          const d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = node; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  nodeX(node) { const col = (node / MAX_LEVELS) | 0; return this.cx(col % this.cols); }
  nodeZ(node) { const col = (node / MAX_LEVELS) | 0; return this.cz((col / this.cols) | 0); }
  nodeY(node) { return this.lvlY[node]; }

  /**
   * Swept-circle line of sight between two points at the same standing height.
   * Used only to straighten a grid path — never to authorise a move the
   * collision resolver has not been asked about.
   */
  losClear(ax, az, bx, bz, y) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return true;
    const steps = Math.ceil(len / (this.cell * 0.5));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = ax + dx * t, z = az + dz * t;
      if (!this._clear(x, z, y)) return false;
      // The straightened segment must also stay on the same deck: a chord that
      // clips across a stairwell hole is clear of every collider and still a
      // two-storey fall.
      if (Math.abs(this.map.floorY(x, z, y) - y) > 0.35) return false;
    }
    return true;
  }

  /**
   * A* from (sx,sy,sz) to (tx,ty,tz). Returns an array of {x,y,z} waypoints
   * (already straightened), or null when no route exists.
   *
   * `budget` caps node expansions. It is set above the walkable node count on
   * purpose — the grid is only ~14k nodes, so even a pathological full sweep is
   * a few milliseconds, and a route that stops short because the search was
   * rationed is indistinguishable to the player from the stuck-on-nothing bug
   * this file exists to remove. On exhaustion the search still returns the best
   * partial found rather than nothing: a horde that gets most of the way to you
   * is correct behaviour, a horde that freezes is not.
   */
  findPath(sx, sy, sz, tx, ty, tz, budget = 20000) {
    const start = this.nearestNode(sx, sz, sy);
    if (start < 0) return null;
    const goal = this.nearestNode(tx, tz, ty);
    if (goal < 0) return null;
    if (start === goal) return [{ x: tx, y: this.lvlY[goal], z: tz }];

    const run = ++this.run;
    const { g, stamp, closed, from, heap } = this;
    heap.clear();
    g[start] = 0; stamp[start] = run; from[start] = -1;
    const gx = this.nodeX(goal), gz = this.nodeZ(goal), gy = this.lvlY[goal];
    heap.push(start, this._h(this.nodeX(start), this.nodeZ(start), this.lvlY[start], gx, gz, gy));

    let expanded = 0;
    let best = start;
    let bestH = this._h(this.nodeX(start), this.nodeZ(start), this.lvlY[start], gx, gz, gy);
    let found = false;

    while (heap.n > 0 && expanded < budget) {
      const node = heap.pop();
      if (node === goal) { found = true; break; }
      // Lazy deletion: a node whose g improved was pushed again, so the stale
      // copy still surfaces later. Expanding it a second time is pure waste.
      if (closed[node] === run) continue;
      closed[node] = run;
      expanded++;
      const col = (node / MAX_LEVELS) | 0;
      const l = node - col * MAX_LEVELS;
      const i = col % this.cols, j = (col / this.cols) | 0;
      const y = this.lvlY[node];
      const x = this.cx(i), z = this.cz(j);
      const h = this._h(x, z, y, gx, gz, gy);
      if (h < bestH) { bestH = h; best = node; }
      const lbase = node * 8;
      for (let d = 0; d < 8; d++) {
        const nl = this.link[lbase + d];
        if (nl === NO_LINK) continue;
        const ni = i + DIRS[d][0], nj = j + DIRS[d][1];
        const nnode = (nj * this.cols + ni) * MAX_LEVELS + nl;
        const ny = this.lvlY[nnode];
        const dy = ny - y;
        // Level ground is cheapest; a climb costs a little, a drop costs a lot,
        // so the horde prefers the stairs it was given and only steps off a
        // balcony when that really is the short way to you.
        let cost = (d < 4 ? this.cell : this.cell * 1.4142);
        if (dy > 0.05) cost += dy * 1.6;
        else if (dy < -0.5) cost += 1.5 - dy * 2.2;
        const tentative = g[node] + cost;
        if (stamp[nnode] === run && g[nnode] <= tentative) continue;
        stamp[nnode] = run; g[nnode] = tentative; from[nnode] = node;
        heap.push(nnode, tentative + this._h(this.cx(ni), this.cz(nj), ny, gx, gz, gy));
      }
    }

    const end = found ? goal : best;
    if (end === start) return null;
    return this._reconstruct(start, end, found ? tx : this.nodeX(end), found ? tz : this.nodeZ(end),
      this.lvlY[end], sx, sz, sy);
  }

  _h(x, z, y, gx, gz, gy) {
    // Octile in the plane (the grid is 8-connected, so straight-line under-
    // estimates badly) plus the vertical separation, which keeps the search from
    // exploring the whole deck below the one the target is standing on.
    const dx = Math.abs(x - gx), dz = Math.abs(z - gz);
    const lo = Math.min(dx, dz), hi = Math.max(dx, dz);
    return hi + lo * 0.4142 + Math.abs(y - gy) * 1.2;
  }

  _reconstruct(start, end, tailX, tailZ, tailY, sx, sz, sy) {
    const raw = [];
    for (let n = end; n !== -1 && n !== start; n = this.from[n]) {
      raw.push({ x: this.nodeX(n), y: this.lvlY[n], z: this.nodeZ(n) });
      if (raw.length > 4096) break;                       // corrupt chain guard
    }
    raw.reverse();
    if (!raw.length) return null;
    // Aim the last hop at the real target rather than at a cell centre, so the
    // final approach does not visibly kink toward the middle of a 45cm square.
    const last = raw[raw.length - 1];
    if (Math.abs(last.y - tailY) < 0.02) { last.x = tailX; last.z = tailZ; }

    // ---- straighten ----
    // A grid path is a staircase of 45-degree segments. Walking it verbatim is
    // the giveaway that a body is following a lattice. Keep a waypoint only when
    // the body cannot see past it: same deck, and a swept circle gets through.
    const out = [];
    let cx = sx, cz = sz, cy = sy;
    let i = 0;
    while (i < raw.length) {
      let j = i;
      for (let k = raw.length - 1; k > i; k--) {
        if (Math.abs(raw[k].y - cy) > 0.02) continue;
        if (this.losClear(cx, cz, raw[k].x, raw[k].z, cy)) { j = k; break; }
      }
      const wp = raw[j];
      out.push(wp);
      cx = wp.x; cz = wp.z; cy = wp.y;
      i = j + 1;
    }
    return out.length ? out : null;
  }

  /**
   * Colliders that can stop an enemy standing at (x,z,y). Written into `out`
   * (cleared first) so the caller can hand it straight to the shared circle
   * resolver without allocating per frame.
   */
  activeColliders(x, z, y, out) {
    out.length = 0;
    return this.hash.gather(x, z, y, out);
  }
}

// One grid per map instance. Rebuilt implicitly whenever a new map is built.
const _grids = new WeakMap();

export function getNavGrid(map) {
  let grid = _grids.get(map);
  if (!grid) { grid = new NavGrid(map); _grids.set(map, grid); }
  return grid;
}

/**
 * Tell the navigation grid that a rectangle of the world changed shape.
 * Safe to call before any grid exists — the first build will see the new state
 * anyway, so there is nothing to invalidate.
 */
export function navInvalidate(map, minX, minZ, maxX, maxZ) {
  const grid = _grids.get(map);
  if (grid) grid.rebuildRegion(minX, minZ, maxX, maxZ);
}

export { MAX_LEVELS as NAV_MAX_LEVELS, MAX_DROP as NAV_MAX_DROP, MAX_STEP_UP as NAV_MAX_STEP_UP };

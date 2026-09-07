/* Phase 0 perf rig: in ?perftest=1 mode, seed Math.random (mulberry32) so spawnWave/pickBiome/biome rolls
   are reproducible across cold runs — kills the ±~1s spawn/leveling noise the old PERF-FINDINGS doc flagged.
   Must run before any Math.random() call. ?seed=N overrides the default seed. No effect in normal play. */
(() => {
  if (typeof location === 'undefined' || !/[?&]perftest=1\b/.test(location.search)) return;
  let s = (parseInt((location.search.match(/[?&]seed=(\d+)/) || [])[1], 10) || 12345) >>> 0;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();
const choice = a => a[Math.floor(Math.random() * a.length)];

/* ================= AUDIO ================= */
const Audio2 = {
  ctx: null, master: null, muted: false,
  init() { if (this.ctx) return; try { const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination); } catch (e) { } },
  beep(freq, dur, type, vol, slideTo) { if (!this.ctx || this.muted) return; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type || 'sine'; o.frequency.value = freq; if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), this.ctx.currentTime + dur); g.gain.value = vol || 0.18; g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur); o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur); },
  noise(dur, vol) { if (!this.ctx || this.muted) return; const n = this.ctx.createBufferSource(); const buf = this.ctx.createBuffer(1, Math.max(1, this.ctx.sampleRate * dur), this.ctx.sampleRate); const data = buf.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2); n.buffer = buf; const g = this.ctx.createGain(); g.gain.value = vol || 0.18; n.connect(g); g.connect(this.master); n.start(); }
};
function sfx(t) {
  const A = Audio2; if (!A.ctx || A.muted || !SAVE._data.settings.sfx) return;
  if (t === 'melee') { A.noise(0.08, 0.14); A.beep(180, 0.08, 'square', 0.1, 90); }
  else if (t === 'fire') { A.beep(620, 0.25, 'sawtooth', 0.15, 160); }
  else if (t === 'frost') { A.beep(900, 0.25, 'triangle', 0.13, 420); }
  else if (t === 'nova') { A.beep(300, 0.3, 'square', 0.15, 120); }
  else if (t === 'chain') { A.beep(1300, 0.18, 'sawtooth', 0.15, 300); }
  else if (t === 'hurt') { A.beep(200, 0.18, 'square', 0.2, 70); A.noise(0.1, 0.12); }
  else if (t === 'gold') { A.beep(1200, 0.08, 'sine', 0.1, 1600); }
  else if (t === 'potion') { A.beep(500, 0.18, 'sine', 0.13, 820); }
  else if (t === 'death') { A.beep(160, 0.14, 'sawtooth', 0.1, 60); }
  else if (t === 'level') { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.beep(f, 0.18, 'triangle', 0.18), i * 90)); }
  else if (t === 'boss') { A.beep(90, 0.7, 'sawtooth', 0.25, 60); A.noise(0.5, 0.18); }
  else if (t === 'bossdie') { [400, 300, 200, 120].forEach((f, i) => setTimeout(() => { A.beep(f, 0.3, 'sawtooth', 0.2, f * 0.6); A.noise(0.2, 0.15); }, i * 120)); }
  else if (t === 'die') { [300, 240, 180, 120, 80].forEach((f, i) => setTimeout(() => A.beep(f, 0.3, 'sawtooth', 0.2), i * 150)); }
}
const MUSIC = {
  scale: [220, 261.63, 293.66, 329.63, 392, 440], timer: null,
  start() { if (this.timer || Audio2.muted || !Audio2.ctx || !SAVE._data.settings.music) return; this.timer = setInterval(() => { if (Audio2.muted || !Audio2.ctx) return; const f = choice(this.scale) * (Math.random() < 0.3 ? 0.5 : 1); const o = Audio2.ctx.createOscillator(), g = Audio2.ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.value = 0; g.gain.linearRampToValueAtTime(0.045, Audio2.ctx.currentTime + 0.6); g.gain.linearRampToValueAtTime(0.001, Audio2.ctx.currentTime + 2.6); o.connect(g); g.connect(Audio2.master); o.start(); o.stop(Audio2.ctx.currentTime + 2.7); }, 1900); },
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
};
/* Difficulty tiers change mechanics, not just multipliers: eliteAffixes = minimum affix count on elite packs,
   density = spawn-wave size multiplier, resistBonus = extra monster resist deepening, reqDepth = the dungeon
   depth a hero must reach before the tier unlocks (0 = always available). */
const DIFF = {
  Normal: { hp: 1, dmg: 1, xp: 1, eliteAffixes: 1, density: 1.0, resistBonus: 0, reqDepth: 0 },
  Hard: { hp: 1.6, dmg: 1.4, xp: 1.3, eliteAffixes: 1, density: 1.15, resistBonus: 0.05, reqDepth: 8 },
  Hell: { hp: 2.6, dmg: 2, xp: 1.8, eliteAffixes: 2, density: 1.3, resistBonus: 0.10, reqDepth: 20 },
  Inferno: { hp: 4, dmg: 3, xp: 2.5, eliteAffixes: 3, density: 1.5, resistBonus: 0.15, reqDepth: 35 },
};
const DIFF_ORDER = ['Normal', 'Hard', 'Hell', 'Inferno'];
/* A tier is earned, not toggled: unlocked once the LIVE hero has reached its reqDepth (in-game), or once any
   saved hero has (main menu, where no character is loaded yet). */
function diffUnlocked(name) {
  const req = (DIFF[name] && DIFF[name].reqDepth) || 0; if (!req) return true;
  let best = 0;
  if (typeof character !== 'undefined' && character) best = character.maxDepth || 0;
  else if (typeof SAVE !== 'undefined' && SAVE._data) { for (const s of SAVE._data.slots) { if (s && (s.maxDepth || 0) > best) best = s.maxDepth || 0; } }
  return best >= req;
}
// endgame depth scaling (data-driven; early floors stay ~linear, late floors ramp up via the quadratic terms)
const DSCALE = { hpLin: 0.4, hpQuad: 0.05, dmgLin: 0.28, dmgQuad: 0.04, xpLin: 0.5, xpQuad: 0.04, ilvlPerDepth: 2 };
const BOSS_SCALE = { hpBase: 380, hpLin: 0.5, hpQuad: 0.05, dmgBase: 14, dmgLin: 0.3, dmgQuad: 0.03, xpBase: 300, xpLin: 0.6 };
const COW_DEPTH = 999; // Secret Cow Level sentinel (Diablo II homage); never written to character.maxDepth
let shake = 0;
/* ================= DUNGEON LAYOUT (pure & browser-free — tests/layout.test.js loads this file) =================
   Coarse-grid room generator: the ±half hall is cut into a G×G grid of cells, adjacent cells merge into 6–9
   rooms (union-find), a randomized-Kruskal spanning tree over the room graph carves one door per tree edge
   (+~25% loop doors), and every remaining inter-room border becomes a wall segment. Connectivity is guaranteed
   by construction. The renderer (09-dungeon) stamps `walls` as instanced pieces + collider-circle chains;
   boss floors skip generation entirely (open arenas). */
function genDungeonLayout(half, depth) {
  const G = 5, cs = (2 * half) / G;
  const parent = []; for (let k = 0; k < G * G; k++) parent[k] = k;
  const find = k => { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; };
  const pairs = [];
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { if (i + 1 < G) pairs.push([i * G + j, (i + 1) * G + j]); if (j + 1 < G) pairs.push([i * G + j, i * G + (j + 1)]); }
  for (let k = pairs.length - 1; k > 0; k--) { const r = randi(0, k); const t = pairs[k]; pairs[k] = pairs[r]; pairs[r] = t; }
  let regions = G * G; const targetRooms = randi(6, 9);
  for (const [a, b] of pairs) { if (regions <= targetRooms) break; const ra = find(a), rb = find(b); if (ra !== rb) { parent[ra] = rb; regions--; } }
  const idMap = new Map(); const roomOf = [];
  for (let i = 0; i < G; i++) { roomOf[i] = []; for (let j = 0; j < G; j++) { const r = find(i * G + j); let v = idMap.get(r); if (v === undefined) { v = idMap.size; idMap.set(r, v); } roomOf[i][j] = v; } }
  const R = idMap.size; const rooms = [];
  for (let r = 0; r < R; r++) rooms.push({ id: r, cells: [], cx: 0, cz: 0 });
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) rooms[roomOf[i][j] || 0].cells.push([i, j]);
  for (const rm of rooms) { let sx = 0, sz = 0; for (const [i, j] of rm.cells) { sx += -half + (i + 0.5) * cs; sz += -half + (j + 0.5) * cs; } rm.cx = sx / rm.cells.length; rm.cz = sz / rm.cells.length; }
  const borders = []; // inter-room border cells: between (i,j) and its +x (vert) or +z neighbor
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    if (i + 1 < G && roomOf[i][j] !== roomOf[i + 1][j]) borders.push({ a: roomOf[i][j], b: roomOf[i + 1][j], vert: true, i, j });
    if (j + 1 < G && roomOf[i][j] !== roomOf[i][j + 1]) borders.push({ a: roomOf[i][j], b: roomOf[i][j + 1], vert: false, i, j });
  }
  for (let k = borders.length - 1; k > 0; k--) { const r = randi(0, k); const t = borders[k]; borders[k] = borders[r]; borders[r] = t; }
  const rp = []; for (let r = 0; r < R; r++) rp[r] = r;
  const rfind = k => { while (rp[k] !== k) { rp[k] = rp[rp[k]]; k = rp[k]; } return k; };
  const doorSet = new Set(); const doors = [];
  const addDoor = bd => { doorSet.add(bd); doors.push({ a: bd.a, b: bd.b, x: bd.vert ? -half + (bd.i + 1) * cs : -half + (bd.i + 0.5) * cs, z: bd.vert ? -half + (bd.j + 0.5) * cs : -half + (bd.j + 1) * cs }); };
  for (const bd of borders) { const ra = rfind(bd.a), rb = rfind(bd.b); if (ra !== rb) { rp[ra] = rb; addDoor(bd); } }
  for (const bd of borders) { if (!doorSet.has(bd) && Math.random() < 0.25) addDoor(bd); }
  const DOOR_W = 9, walls = [];
  for (const bd of borders) {
    const x0 = bd.vert ? -half + (bd.i + 1) * cs : -half + bd.i * cs;
    const z0 = bd.vert ? -half + bd.j * cs : -half + (bd.j + 1) * cs;
    if (!doorSet.has(bd)) { walls.push({ x1: x0, z1: z0, x2: bd.vert ? x0 : x0 + cs, z2: bd.vert ? z0 + cs : z0 }); continue; }
    const side = (cs - DOOR_W) / 2;
    if (bd.vert) { walls.push({ x1: x0, z1: z0, x2: x0, z2: z0 + side }); walls.push({ x1: x0, z1: z0 + cs - side, x2: x0, z2: z0 + cs }); }
    else { walls.push({ x1: x0, z1: z0, x2: x0 + side, z2: z0 }); walls.push({ x1: x0 + cs - side, z1: z0, x2: x0 + cs, z2: z0 }); }
  }
  const adj = []; for (let r = 0; r < R; r++) adj.push([]);
  for (const d of doors) { adj[d.a].push(d.b); adj[d.b].push(d.a); }
  const spawnRoom = roomOf[G >> 1][G >> 1]; // world (0,0) — the fixed player entry — is the center cell's room
  const dist = new Array(R).fill(-1); dist[spawnRoom] = 0; const q = [spawnRoom];
  while (q.length) { const r = q.shift(); for (const n of adj[r]) { if (dist[n] < 0) { dist[n] = dist[r] + 1; q.push(n); } } }
  let portalRoom = spawnRoom; for (let r = 0; r < R; r++) { if (dist[r] > dist[portalRoom]) portalRoom = r; }
  const pr = rooms[portalRoom]; let pc = pr.cells[0], pb = 1e9;
  for (const c of pr.cells) { const px = -half + (c[0] + 0.5) * cs, pz = -half + (c[1] + 0.5) * cs; const dd = Math.abs(px - pr.cx) + Math.abs(pz - pr.cz); if (dd < pb) { pb = dd; pc = c; } }
  return { G, cs, half, roomOf, rooms, doors, walls, spawnRoom, portalRoom, dist, portal: { x: -half + (pc[0] + 0.5) * cs, z: -half + (pc[1] + 0.5) * cs } };
}
function layoutRoomAt(lay, x, z) { if (!lay) return -1; const i = clamp(Math.floor((x + lay.half) / lay.cs), 0, lay.G - 1), j = clamp(Math.floor((z + lay.half) / lay.cs), 0, lay.G - 1); return lay.roomOf[i][j]; }
/* Room-aware spawn/placement point: inside the room at (px,pz) or a door-adjacent one, ≥12u away, with a cell
   margin so straight-line chase AI never starts wedged against a wall. Null when there is no layout. */
function layoutSpawnPoint(lay, px, pz) {
  if (!lay) return null;
  const pr = layoutRoomAt(lay, px, pz); const cands = [pr];
  for (const d of lay.doors) { if (d.a === pr) cands.push(d.b); else if (d.b === pr) cands.push(d.a); }
  for (let t = 0; t < 12; t++) {
    const rm = lay.rooms[cands[randi(0, cands.length - 1)]]; const c = rm.cells[randi(0, rm.cells.length - 1)];
    const x = -lay.half + c[0] * lay.cs + rand(5, lay.cs - 5), z = -lay.half + c[1] * lay.cs + rand(5, lay.cs - 5);
    if (Math.hypot(x - px, z - pz) > 12) return { x, z };
  }
  const rm = lay.rooms[pr]; return { x: rm.cx, z: rm.cz };
}
/* A random interior point of a SPECIFIC room (used for shrines/chests). */
function layoutRoomPoint(lay, roomId, margin) {
  const rm = lay.rooms[roomId]; const c = rm.cells[randi(0, rm.cells.length - 1)]; const m = margin || 6;
  return { x: -lay.half + c[0] * lay.cs + rand(m, lay.cs - m), z: -lay.half + c[1] * lay.cs + rand(m, lay.cs - m) };
}

'use strict';
/* cards.js — Dou Dizhu core engine: deck, combo detection, comparison.
   Pure logic on rank values; used by both the browser UI and Node tests.
   Ranks: 3..13 = 3..K, 14 = A, 15 = 2, 16 = small joker, 17 = big joker. */

const SUITS = ['♠', '♥', '♦', '♣'];
const RANK_LABELS = { 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' };

function makeDeck() {
  const d = [];
  let id = 0;
  for (let r = 3; r <= 15; r++) for (let s = 0; s < 4; s++) d.push({ id: id++, r, s });
  d.push({ id: 52, r: 16, s: -1 });
  d.push({ id: 53, r: 17, s: -1 });
  return d;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* "No-shuffle" deck: sorted by rank, then a few random segment moves.
   Dealt in chunks this keeps same-rank cards clumped -> lots of bombs.
   A final random cut keeps the tail (which becomes the bottom cards)
   from always being the 2s and jokers left there by the sort. */
function clumpedDeck() {
  const d = makeDeck();
  d.sort((a, b) => a.r - b.r || a.s - b.s);
  for (let i = 0; i < 7; i++) {
    const len = 2 + Math.floor(Math.random() * 6);
    const from = Math.floor(Math.random() * (d.length - len));
    const seg = d.splice(from, len);
    const to = Math.floor(Math.random() * (d.length + 1));
    d.splice(to, 0, ...seg);
  }
  const cut = Math.floor(Math.random() * d.length);
  return d.slice(cut).concat(d.slice(0, cut));
}

function counts(ranks) {
  const m = {};
  for (const r of ranks) m[r] = (m[r] || 0) + 1;
  return m;
}
function keysSorted(m) { return Object.keys(m).map(Number).sort((a, b) => a - b); }
function isConsec(a) {
  for (let i = 1; i < a.length; i++) if (a[i] !== a[i - 1] + 1) return false;
  return true;
}

function C(type, rank, len, n) { return { type, rank, len, n }; }
function hardBomb(r) { return Object.assign(C('bomb', r, 1, 4), { power: r * 2 + 1 }); }
function rocketCombo() { return Object.assign(C('rocket', 17, 1, 2), { power: 1e9 }); }

/* Consecutive runs of >=3-of-a-kind, length k, ranks 3..A. Returns start ranks. */
function trioRunStarts(m, k) {
  const res = [];
  for (let s = 3; s + k - 1 <= 14; s++) {
    let ok = true;
    for (let r = s; r < s + k; r++) if ((m[r] || 0) < 3) { ok = false; break; }
    if (ok) res.push(s);
  }
  return res;
}

/* Canonical detection of a lead play (no wild cards). Returns combo or null.
   combo = {type, rank, len, n}; len = #cards for straight, #pairs / #trios for
   the sequence types, 1 otherwise. */
function detectPlain(ranks) {
  const n = ranks.length;
  if (!n) return null;
  const m = counts(ranks), ks = keysSorted(m), kn = ks.length;
  if (n === 2 && m[16] === 1 && m[17] === 1) return rocketCombo();
  if (kn === 1) {
    const r = ks[0];
    if (n === 1) return C('single', r, 1, 1);
    if (r > 15) return null;
    if (n === 2) return C('pair', r, 1, 2);
    if (n === 3) return C('trio', r, 1, 3);
    if (n === 4) return hardBomb(r);
    return null;
  }
  if (n >= 5 && kn === n && ks[kn - 1] <= 14 && isConsec(ks)) return C('straight', ks[kn - 1], n, n);
  if (n >= 6 && n % 2 === 0 && kn === n / 2 && ks.every(k => m[k] === 2) && ks[kn - 1] <= 14 && isConsec(ks))
    return C('pair_straight', ks[kn - 1], kn, n);
  if (n >= 6 && n % 3 === 0 && kn === n / 3 && ks.every(k => m[k] === 3) && ks[kn - 1] <= 14 && isConsec(ks))
    return C('plane', ks[kn - 1], kn, n);
  if (n === 4 && kn === 2) {
    const t = ks.find(k => m[k] === 3 && k <= 15);
    if (t !== undefined) return C('trio_single', t, 1, 4);
  }
  if (n === 5 && kn === 2) {
    const t = ks.find(k => m[k] === 3 && k <= 15);
    const p = ks.find(k => m[k] === 2 && k <= 15);
    if (t !== undefined && p !== undefined) return C('trio_pair', t, 1, 5);
  }
  if (n === 6) {
    const q = ks.find(k => m[k] === 4);
    if (q !== undefined) return C('four_two', q, 1, 6);
  }
  if (n === 8) {
    const c = matchType(ranks, { type: 'four_two_pairs', len: 1, n: 8 });
    if (c) return c;
  }
  if (n % 4 === 0 && n >= 8) {
    const c = matchType(ranks, { type: 'plane_single', len: n / 4, n });
    if (c) return c;
  }
  if (n % 5 === 0 && n >= 10) {
    const c = matchType(ranks, { type: 'plane_pair', len: n / 5, n });
    if (c) return c;
  }
  return null;
}

/* Can `ranks` be read as the same shape as `req`? Resolves ambiguous shapes
   (e.g. plane-with-wings vs pair straight) in favor of the required type. */
function matchType(ranks, req) {
  const n = ranks.length;
  if (!req || n !== req.n) return null;
  const m = counts(ranks), ks = keysSorted(m), kn = ks.length;
  const t = req.type, L = req.len;
  const mk = r => C(t, r, L, n);
  switch (t) {
    case 'single': return n === 1 ? mk(ks[0]) : null;
    case 'pair': return kn === 1 && ks[0] <= 15 && m[ks[0]] === 2 ? mk(ks[0]) : null;
    case 'trio': return kn === 1 && ks[0] <= 15 && m[ks[0]] === 3 ? mk(ks[0]) : null;
    case 'bomb': return kn === 1 && ks[0] <= 15 && m[ks[0]] === 4 ? hardBomb(ks[0]) : null;
    case 'rocket': return m[16] === 1 && m[17] === 1 ? rocketCombo() : null;
    case 'straight': return kn === n && ks[kn - 1] <= 14 && isConsec(ks) ? mk(ks[kn - 1]) : null;
    case 'pair_straight':
      return kn === L && ks.every(k => m[k] === 2) && ks[kn - 1] <= 14 && isConsec(ks) ? mk(ks[kn - 1]) : null;
    case 'plane':
      return kn === L && ks.every(k => m[k] === 3) && ks[kn - 1] <= 14 && isConsec(ks) ? mk(ks[kn - 1]) : null;
    case 'trio_single': {
      if (n !== 4 || kn !== 2) return null;
      const tr = ks.find(k => m[k] === 3 && k <= 15);
      return tr !== undefined ? mk(tr) : null;
    }
    case 'trio_pair': {
      if (n !== 5 || kn !== 2) return null;
      const tr = ks.find(k => m[k] === 3 && k <= 15);
      const pr = ks.find(k => m[k] === 2 && k <= 15);
      return tr !== undefined && pr !== undefined ? mk(tr) : null;
    }
    case 'plane_single': {
      let best = null;
      for (const s of trioRunStarts(m, L)) { const top = s + L - 1; if (best === null || top > best) best = top; }
      return best !== null ? mk(best) : null;
    }
    case 'plane_pair': {
      let best = null;
      for (const s of trioRunStarts(m, L)) {
        let ok = true;
        for (const k of ks) {
          const left = m[k] - (k >= s && k < s + L ? 3 : 0);
          if (left % 2 !== 0 || (left > 0 && k > 15)) { ok = false; break; }
        }
        if (ok) { const top = s + L - 1; if (best === null || top > best) best = top; }
      }
      return best !== null ? mk(best) : null;
    }
    case 'four_two': {
      if (n !== 6) return null;
      const qs = ks.filter(k => m[k] === 4);
      return qs.length ? mk(Math.max(...qs)) : null;
    }
    case 'four_two_pairs': {
      if (n !== 8) return null;
      const qs = ks.filter(k => m[k] === 4).sort((a, b) => b - a);
      for (const q of qs) if (ks.every(k => k === q || m[k] % 2 === 0)) return mk(q);
      return null;
    }
  }
  return null;
}

function bombOrRocket(ranks) {
  const c = detectPlain(ranks);
  return c && (c.type === 'bomb' || c.type === 'rocket') ? c : null;
}

function analyzePlain(ranks, prev) {
  if (!prev) return detectPlain(ranks);
  return matchType(ranks, prev) || bombOrRocket(ranks);
}

/* All multisets of k ranks in 3..15 (wild-card assignments). k <= 4. */
function wildAssignments(k) {
  const out = [];
  (function rec(start, acc) {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let r = start; r <= 15; r++) { acc.push(r); rec(r, acc); acc.pop(); }
  })(3, []);
  return out;
}

/* Used to pick the strongest interpretation of an ambiguous wild-card lead. */
function comboPriority(c) {
  if (c.type === 'rocket') return 1e6;
  if (c.type === 'bomb') return 1e5 + c.power;
  return c.rank + c.n * 0.01;
}

/* Full analysis: `ranks` played over `prev` (or a lead if prev is null), with
   optional wild rank `laizi`. Returns the combo (strongest interpretation)
   or null. Rules: a lone wild only counts as its natural rank; a bomb built
   with wilds is "soft" and loses to the natural bomb of the same rank;
   four wilds together are the top bomb (below only the rocket). */
function analyze(ranks, prev, laizi) {
  const n = ranks.length;
  if (!n) return null;
  if (!laizi || !ranks.includes(laizi)) {
    const c = analyzePlain(ranks, prev);
    return c ? Object.assign({}, c) : null;
  }
  const nats = ranks.filter(r => r !== laizi);
  const w = n - nats.length;
  if (w === 4 && nats.length === 0)
    return { type: 'bomb', rank: laizi, len: 1, n: 4, soft: true, laiziBomb: true, power: 1000 };
  let best = null;
  for (const asg of wildAssignments(w)) {
    const sub = nats.concat(asg);
    const soft = asg.some(r => r !== laizi);
    let c = analyzePlain(sub, prev);
    if (!c) continue;
    if (c.type === 'single' && soft) continue;
    if (c.type === 'rocket') continue;
    c = Object.assign({}, c);
    if (soft) c.soft = true;
    if (c.type === 'bomb') c.power = soft ? c.rank * 2 : c.rank * 2 + 1;
    if (prev && !beats(c, prev)) continue;
    if (!best || comboPriority(c) > comboPriority(best)) best = c;
  }
  return best;
}

function beats(c, p) {
  if (!c) return false;
  if (!p) return true;
  if (c.type === 'rocket') return true;
  if (p.type === 'rocket') return false;
  const cb = c.type === 'bomb', pb = p.type === 'bomb';
  if (cb && pb) return (c.power || 0) > (p.power || 0);
  if (cb) return true;
  if (pb) return false;
  return c.type === p.type && c.len === p.len && c.n === p.n && c.rank > p.rank;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUITS, RANK_LABELS, makeDeck, shuffle, clumpedDeck, counts, keysSorted, isConsec,
    trioRunStarts, detectPlain, matchType, analyzePlain, analyze, beats, comboPriority,
    wildAssignments, hardBomb, rocketCombo,
  };
}

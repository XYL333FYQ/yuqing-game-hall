'use strict';
/* moves.js — legal move generation, shared by the hint button and the AI.
   Works on rank arrays; wild (laizi) cards are spent as needed. */

if (typeof require !== 'undefined' && typeof window === 'undefined') {
  Object.assign(globalThis, require('./cards.js'));
}

/* Split a hand into natural counts + wild count. Natural counts never include
   the wild rank itself (those cards are all treated as wilds). */
function natCounts(handRanks, laizi) {
  const nat = {};
  let w = 0;
  for (const r of handRanks) {
    if (laizi && r === laizi) w++;
    else nat[r] = (nat[r] || 0) + 1;
  }
  return { nat, w };
}

/* Pick `count` wings of `size` cards each from natural cards, lowest first,
   avoiding breaking bombs unless nothing else is available.
   Returns a flat rank array or null. */
function pickWings(nat, exclude, size, count) {
  const ranks = Object.keys(nat).map(Number)
    .filter(r => !exclude.has(r) && (size === 1 || r <= 15))
    .sort((a, b) => (nat[a] - nat[b]) || (a - b));
  const units = [];
  for (const r of ranks) {
    const c = nat[r];
    if (c === 4) continue;
    const u = size === 1 ? c : Math.floor(c / size);
    for (let i = 0; i < u; i++) units.push(r);
  }
  if (units.length < count) {
    for (const r of ranks) {
      if (nat[r] !== 4) continue;
      const u = size === 1 ? 4 : 2;
      for (let i = 0; i < u && units.length < count; i++) units.push(r);
    }
  }
  if (units.length < count) return null;
  const out = [];
  for (let i = 0; i < count; i++) for (let j = 0; j < size; j++) out.push(units[i]);
  return out;
}

function seqWindow(s, e, per) {
  const out = [];
  for (let r = s; r <= e; r++) for (let i = 0; i < per; i++) out.push(r);
  return out;
}

function genFollow(nat, w, laizi, prev) {
  const out = [];
  const N = r => nat[r] || 0;
  const push = (ranks, wild) => out.push({ play: ranks, wild: wild || 0 });
  const t = prev.type;

  if (t === 'single') {
    for (let r = prev.rank + 1; r <= 17; r++) {
      if (N(r) > 0) push([r]);
      else if (laizi && r === laizi && w > 0) push([r], 1);
    }
  } else if (t === 'pair' || t === 'trio') {
    const c = t === 'pair' ? 2 : 3;
    for (let r = prev.rank + 1; r <= 15; r++) {
      if (laizi && r === laizi) {
        if (w >= c) push(Array(c).fill(r), c);
        continue;
      }
      if (N(r) >= c) push(Array(c).fill(r));
      else if (laizi && N(r) >= 1 && N(r) + w >= c) push(Array(c).fill(r), c - N(r));
    }
  } else if (t === 'straight' || t === 'pair_straight' || t === 'plane') {
    const per = t === 'straight' ? 1 : t === 'pair_straight' ? 2 : 3;
    const L = t === 'straight' ? prev.n : prev.len;
    for (let end = prev.rank + 1; end <= 14; end++) {
      const s = end - L + 1;
      if (s < 3) continue;
      let cost = 0;
      for (let r = s; r <= end; r++) cost += Math.max(0, per - N(r));
      if (laizi ? cost <= w : cost === 0) push(seqWindow(s, end, per), cost);
    }
  } else if (t === 'trio_single' || t === 'trio_pair') {
    const wingSize = t === 'trio_single' ? 1 : 2;
    for (let r = prev.rank + 1; r <= 15; r++) {
      let cost;
      if (laizi && r === laizi) { if (w < 3) continue; cost = 3; }
      else if (N(r) >= 3) cost = 0;
      else if (laizi && N(r) >= 1 && N(r) + w >= 3) cost = 3 - N(r);
      else continue;
      const wing = pickWings(nat, new Set([r]), wingSize, 1);
      if (!wing) continue;
      push([r, r, r, ...wing], cost);
    }
  } else if (t === 'plane_single' || t === 'plane_pair') {
    const wingSize = t === 'plane_single' ? 1 : 2;
    const L = prev.len;
    for (let end = prev.rank + 1; end <= 14; end++) {
      const s = end - L + 1;
      if (s < 3) continue;
      let cost = 0;
      const runSet = new Set();
      for (let r = s; r <= end; r++) { cost += Math.max(0, 3 - N(r)); runSet.add(r); }
      if (laizi ? cost > w : cost !== 0) continue;
      const wings = pickWings(nat, runSet, wingSize, L);
      if (!wings) continue;
      push([...seqWindow(s, end, 3), ...wings], cost);
    }
  } else if (t === 'four_two' || t === 'four_two_pairs') {
    const wingSize = t === 'four_two' ? 1 : 2;
    for (let r = prev.rank + 1; r <= 15; r++) {
      let cost;
      if (laizi && r === laizi) { if (w < 4) continue; cost = 4; }
      else if (N(r) === 4) cost = 0;
      else if (laizi && N(r) >= 1 && N(r) + w >= 4) cost = 4 - N(r);
      else continue;
      const wings = pickWings(nat, new Set([r]), wingSize, 2);
      if (!wings) continue;
      push([r, r, r, r, ...wings], cost);
    }
  }

  // Bombs and the rocket answer anything (power filtering happens in legalMoves).
  for (let r = 3; r <= 15; r++) {
    if (laizi && r === laizi) continue;
    if (N(r) === 4) push([r, r, r, r]);
    else if (laizi && N(r) >= 1 && N(r) + w >= 4) push([r, r, r, r], 4 - N(r));
  }
  if (laizi && w >= 4) push([laizi, laizi, laizi, laizi], 4);
  if (N(16) && N(17)) push([16, 17]);
  return out;
}

function genLead(nat, w, laizi) {
  const out = [];
  const N = r => nat[r] || 0;
  const avail = r => (laizi && r === laizi) ? w : N(r);
  const push = (ranks, wild) => out.push({ play: ranks, wild: wild || 0 });

  for (let r = 3; r <= 17; r++) if (N(r) >= 1) push([r]);
  if (laizi && w >= 1) push([laizi], 1);
  for (let r = 3; r <= 15; r++) {
    const c = avail(r), wild = (laizi && r === laizi) ? 1 : 0;
    if (c >= 2) push([r, r], wild * 2);
    if (c >= 3) {
      push([r, r, r], wild * 3);
      const w1 = pickWings(nat, new Set([r]), 1, 1);
      if (w1) push([r, r, r, ...w1], wild * 3);
      const w2 = pickWings(nat, new Set([r]), 2, 1);
      if (w2) push([r, r, r, ...w2], wild * 3);
    }
  }
  for (let L = 5; L <= 12; L++) {
    for (let s = 3; s + L - 1 <= 14; s++) {
      let ok = true;
      for (let r = s; r < s + L; r++) if (avail(r) < 1) { ok = false; break; }
      if (ok) push(seqWindow(s, s + L - 1, 1));
    }
  }
  for (let L = 3; L <= 10; L++) {
    for (let s = 3; s + L - 1 <= 14; s++) {
      let ok = true;
      for (let r = s; r < s + L; r++) if (avail(r) < 2) { ok = false; break; }
      if (ok) push(seqWindow(s, s + L - 1, 2));
    }
  }
  for (let k = 2; k <= 6; k++) {
    for (let s = 3; s + k - 1 <= 14; s++) {
      let ok = true;
      const runSet = new Set();
      for (let r = s; r < s + k; r++) { if (avail(r) < 3) { ok = false; break; } runSet.add(r); }
      if (!ok) continue;
      const run = seqWindow(s, s + k - 1, 3);
      push(run);
      const w1 = pickWings(nat, runSet, 1, k);
      if (w1) push([...run, ...w1]);
      const w2 = pickWings(nat, runSet, 2, k);
      if (w2) push([...run, ...w2]);
    }
  }
  for (let r = 3; r <= 15; r++) {
    if (laizi && r === laizi) { if (w === 4) push([r, r, r, r], 4); continue; }
    if (N(r) === 4) push([r, r, r, r]);
  }
  if (N(16) && N(17)) push([16, 17]);
  return out;
}

/* Convert an intended rank list into the ranks of the cards that will
   actually leave the hand: naturals first, shortfalls become wild cards
   (which keep their own rank). Mirrors materialize()/actPlay exactly. */
function realizeRanks(play, nat, laizi) {
  if (!laizi) return play;
  const want = counts(play);
  const out = [];
  for (const rs of Object.keys(want)) {
    const r = +rs;
    const supply = r === laizi ? 0 : (nat[r] || 0);
    const natural = Math.min(want[r], supply);
    for (let i = 0; i < natural; i++) out.push(r);
    for (let i = natural; i < want[r]; i++) out.push(laizi);
  }
  return out;
}

/* All legal plays for `handRanks` against `prev` (null = free lead).
   Every candidate is re-validated through analyze()+beats() on the real
   card ranks, so the generator can never emit an illegal move.
   Returns [{play, wild, combo}]. */
function legalMoves(handRanks, laizi, prev) {
  const { nat, w } = natCounts(handRanks, laizi);
  const cand = prev ? genFollow(nat, w, laizi, prev) : genLead(nat, w, laizi);
  const seen = new Set();
  const out = [];
  for (const mv of cand) {
    const key = mv.play.slice().sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const real = realizeRanks(mv.play, nat, laizi);
    const combo = analyze(real, prev || null, laizi);
    if (!combo) continue;
    if (prev && !beats(combo, prev)) continue;
    out.push({ play: mv.play, wild: mv.wild || 0, combo });
  }
  return out;
}

/* Map a rank list back to concrete cards from `handCards`.
   Naturals are used first; shortfalls are covered by wild cards. */
function materialize(handCards, play, laizi) {
  const used = new Set();
  const res = [];
  const want = counts(play);
  const shortfall = [];
  for (const rs of Object.keys(want)) {
    const r = +rs;
    let need = want[r];
    for (const card of handCards) {
      if (need <= 0) break;
      if (used.has(card.id)) continue;
      if (card.r !== r) continue;
      if (laizi && card.r === laizi && r !== laizi) continue;
      res.push(card);
      used.add(card.id);
      need--;
    }
    if (need > 0) shortfall.push([r, need]);
  }
  for (const [, need] of shortfall) {
    for (let i = 0; i < need; i++) {
      const card = handCards.find(c => !used.has(c.id) && laizi && c.r === laizi);
      if (!card) return null;
      res.push(card);
      used.add(card.id);
    }
  }
  return res;
}

/* Cost of tearing apart hand groups: using only part of a pair/trio/bomb
   is penalized by the group's size, so intact plays are always preferred
   (e.g. answer a pair with a loose pair, not two cards off a trio). */
function breakPenalty(play, handCounts, laizi) {
  const want = counts(play);
  let pen = 0;
  for (const rs of Object.keys(want)) {
    const r = +rs;
    if (laizi && r === laizi) continue; // wilds are individually flexible
    const h = handCounts[r] || 0;
    const used = Math.min(want[r], h);
    if (used > 0 && used < h && h >= 2) pen += h;
  }
  return pen;
}

/* All sensible plays for the hint button, best first: no bombs before
   normal answers, fewest wilds, least group-breaking, then lowest rank.
   The UI cycles through this list on repeated presses. */
function hintMoves(handRanks, laizi, prev) {
  const hc = counts(handRanks);
  const moves = legalMoves(handRanks, laizi, prev);
  const isBomb = m => m.combo.type === 'bomb' || m.combo.type === 'rocket';
  moves.sort((a, b) =>
    (isBomb(a) - isBomb(b)) || (a.wild - b.wild) ||
    (breakPenalty(a.play, hc, laizi) - breakPenalty(b.play, hc, laizi)) ||
    (a.combo.rank - b.combo.rank) || (a.play.length - b.play.length));
  return moves;
}

/* Cheapest sensible play (first hint). */
function pickHint(handRanks, laizi, prev) {
  return hintMoves(handRanks, laizi, prev)[0] || null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { natCounts, pickWings, realizeRanks, legalMoves, materialize, breakPenalty, hintMoves, pickHint };
}

'use strict';
/* ai.js — heuristic AI: bidding, doubling and play decisions.
   Casual-strength filler opponent/partner; runs on the host only. */

if (typeof require !== 'undefined' && typeof window === 'undefined') {
  Object.assign(globalThis, require('./cards.js'), require('./moves.js'));
}

function handStrength(handRanks, laizi) {
  const m = counts(handRanks);
  let s = 0;
  if (m[17]) s += 3;
  if (m[16]) s += 2;
  if (m[16] && m[17]) s += 2;
  s += (m[15] || 0) * 1.5;
  s += (m[14] || 0) * 0.5;
  for (let r = 3; r <= 15; r++) if (r !== laizi && m[r] === 4) s += 3;
  if (laizi) {
    const w = m[laizi] || 0;
    s += w * 2; // a wild outclasses a 2: it completes any combo
    let spare = w; // trios a spare wild upgrades to soft bombs
    for (let r = 3; r <= 15; r++)
      if (r !== laizi && m[r] === 3 && spare > 0) { s += 1; spare--; }
  }
  return s;
}

function aiBid(handRanks, currentBid, laizi) {
  const s = handStrength(handRanks, laizi);
  const want = s >= 9 ? 3 : s >= 6.5 ? 2 : s >= 4.5 ? 1 : 0;
  return want > currentBid ? want : 0;
}

function aiDouble(handRanks, isLandlord, laizi) {
  return handStrength(handRanks, laizi) >= (isLandlord ? 9 : 6.5);
}

/* Group-breaking cost comes from moves.js (breakPenalty). */

/* Decide a play. ctx = {hand, laizi, prev, prevSeat, mySeat, landlordSeat,
   cardCounts, nPlayers}. Returns a move {play, wild, combo} or null (pass). */
function aiPlay(ctx) {
  const { hand, laizi, prev, prevSeat, mySeat, landlordSeat, cardCounts, nPlayers } = ctx;
  const hc = counts(hand);
  const moves = legalMoves(hand, laizi, prev);
  const finish = moves.find(m => m.play.length === hand.length);
  if (finish) return finish;
  const isBomb = m => m.combo.type === 'bomb' || m.combo.type === 'rocket';

  if (!prev) {
    let best = null, bestScore = Infinity;
    for (const m of moves) {
      let s = m.combo.rank * 3 - m.play.length * 4 + m.wild * (hand.length <= 8 ? 12 : 40);
      if (isBomb(m)) s += hand.length <= 6 ? -40 : 1000;
      else s += breakPenalty(m.play, hc, laizi) * 30;
      if (m.combo.rank >= 15) s += 12;
      if (s < bestScore) { bestScore = s; best = m; }
    }
    return best;
  }

  // Sides: in 2v2 the landlord's opposite seat is an ally; 3P farmers ally.
  const side = s => (s === landlordSeat || (nPlayers === 4 && s === (landlordSeat + 2) % 4)) ? 1 : 0;
  const mySide = side(mySeat);
  const partnerLed = prevSeat !== null && prevSeat !== mySeat && side(prevSeat) === mySide;
  const normal = moves.filter(m => !isBomb(m));

  if (partnerLed) {
    if (prev.rank >= 12 || cardCounts[prevSeat] <= 3) return null;
    const mild = normal
      .filter(m => m.wild === 0 && m.combo.rank <= 11 && breakPenalty(m.play, hc, laizi) === 0)
      .sort((a, b) => a.combo.rank - b.combo.rank);
    return mild[0] || null;
  }

  const enemies = [];
  for (let s = 0; s < nPlayers; s++) if (side(s) !== mySide) enemies.push(s);
  const enemyMin = Math.min(...enemies.map(s => cardCounts[s]));

  if (normal.length) {
    normal.sort((a, b) =>
      (a.wild - b.wild) ||
      (breakPenalty(a.play, hc, laizi) - breakPenalty(b.play, hc, laizi)) ||
      (a.combo.rank - b.combo.rank));
    const best = normal[0];
    // Wilds are near-joker value: spend them only under endgame pressure or
    // to take a big trick; otherwise hold them for soft bombs / the finish.
    if (best.wild > 0 && enemyMin > 4 && hand.length > 8 && prev.rank < 12 && prev.n < 5) return null;
    return best;
  }
  if (enemyMin <= 5 || hand.length <= 6) {
    const bombs = moves.filter(isBomb).sort((a, b) => (a.combo.power || 0) - (b.combo.power || 0));
    return bombs[0] || null;
  }
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handStrength, aiBid, aiDouble, aiPlay };
}

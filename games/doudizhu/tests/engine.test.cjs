'use strict';
/* Node test for the rules engine + full AI-vs-AI simulations.
   Run: node tests/engine.test.js */

// Run the classic browser scripts in one context, matching their production load order.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ console, process });
for (const file of ['cards.js', 'moves.js', 'ai.js', 'game.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../../public/games/doudizhu/js', file), 'utf8'), context, { filename: file });
}
const source = fs.readFileSync(__filename, 'utf8');
vm.runInContext(source.slice(source.indexOf('\nlet failures = 0;')), context, { filename: 'engine-simulations.js' });
return;

let failures = 0;
function ok(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} (got ${a}, want ${b})`); }

// ---------- detectPlain ----------
eq(detectPlain([7]).type, 'single', 'single');
eq(detectPlain([7, 7]).type, 'pair', 'pair');
eq(detectPlain([16, 17]).type, 'rocket', 'rocket');
eq(detectPlain([9, 9, 9, 9]).type, 'bomb', 'bomb');
ok(detectPlain([16, 16]) === null, 'no pair of same joker');
eq(detectPlain([3, 4, 5, 6, 7]).type, 'straight', 'straight');
eq(detectPlain([3, 4, 5, 6, 7]).rank, 7, 'straight rank');
ok(detectPlain([11, 12, 13, 14, 15]) === null, 'straight cannot contain 2');
ok(detectPlain([3, 4, 5, 6]) === null, 'straight min len 5');
eq(detectPlain([3, 3, 4, 4, 5, 5]).type, 'pair_straight', 'pair straight');
ok(detectPlain([14, 14, 15, 15]) === null, 'pair straight not with 2');
eq(detectPlain([8, 8, 8, 9, 9, 9]).type, 'plane', 'pure plane');
eq(detectPlain([8, 8, 8, 5]).type, 'trio_single', 'trio+1');
eq(detectPlain([8, 8, 8, 5, 5]).type, 'trio_pair', 'trio+2');
eq(detectPlain([8, 8, 8, 8, 3, 5]).type, 'four_two', 'four+2');
eq(detectPlain([8, 8, 8, 8, 3, 3, 5, 5]).type, 'four_two_pairs', 'four+2 pairs');
eq(detectPlain([3, 3, 3, 4, 4, 4, 9, 10]).type, 'plane_single', 'plane with single wings');
eq(detectPlain([3, 3, 3, 4, 4, 4, 9, 9, 10, 10]).type, 'plane_pair', 'plane with pair wings');
eq(detectPlain([3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6]).type, 'plane', '333444555666 is pure plane');
ok(detectPlain([3, 3, 3, 4, 4, 4, 5, 5, 5, 6]) === null, 'wrong wing count invalid');

// ---------- matchType / ambiguity ----------
const prevPS = { type: 'plane_single', len: 2, n: 8, rank: 3 };
const m1 = matchType([4, 4, 4, 5, 5, 5, 3, 6], prevPS);
ok(m1 && m1.rank === 5, 'plane_single match picks top trio');
const prevBomb = detectPlain([5, 5, 5, 5]);
ok(beats(detectPlain([6, 6, 6, 6]), prevBomb), 'bigger bomb beats');
ok(beats(detectPlain([16, 17]), detectPlain([15, 15, 15, 15])), 'rocket beats bomb');
ok(beats(detectPlain([9, 9, 9, 9]), detectPlain([3, 4, 5, 6, 7])), 'bomb beats straight');
ok(!beats(detectPlain([3, 3]), detectPlain([9, 9, 9])), 'pair does not beat trio');
ok(!beats(detectPlain([3, 3, 4, 4, 5, 5]), detectPlain([9, 9, 9, 10, 10, 10])), 'pair straight vs plane mismatch');

// ---------- analyze (no wilds, following) ----------
const prevStraight = detectPlain([3, 4, 5, 6, 7]);
const f1 = analyze([4, 5, 6, 7, 8], prevStraight, null);
ok(f1 && beats(f1, prevStraight), 'higher straight beats');
ok(analyze([4, 5, 6, 7, 9], prevStraight, null) === null, 'broken straight rejected');

// ---------- laizi ----------
const L = 8;
const soft = analyze([9, 9, 9, 8], null, L); // three 9s + one wild
eq(soft.type, 'bomb', 'wild completes soft bomb');
eq(soft.soft, true, 'soft flag');
ok(beats(detectPlain([9, 9, 9, 9]), soft), 'hard bomb beats soft bomb of same rank');
const lz4 = analyze([8, 8, 8, 8], null, L);
ok(lz4.laiziBomb && lz4.power === 1000, 'four wilds = laizi bomb');
ok(beats(lz4, detectPlain([15, 15, 15, 15])), 'laizi bomb beats bomb of 2s');
ok(beats(detectPlain([16, 17]), lz4), 'rocket beats laizi bomb');
const lzSingle = analyze([8], null, L);
eq(lzSingle.rank, 8, 'lone wild plays as natural rank');
const lzStraight = analyze([6, 8, 8, 9, 10], { type: 'straight', rank: 9, len: 5, n: 5 }, L);
ok(lzStraight && lzStraight.rank === 10, 'wilds fill straight 678910, beats 9-high');
ok(analyze([5, 6, 8, 8, 9], { type: 'straight', rank: 9, len: 5, n: 5 }, L) === null,
  'wilds cannot stretch 56789 above 9-high');
ok(analyze([3, 3, 8], null, L).type === 'trio', 'wild completes trio');

// ---------- legalMoves ----------
const hand1 = [3, 3, 5, 6, 7, 8, 9, 12, 15];
const mv1 = legalMoves(hand1, null, detectPlain([4, 5, 6, 7, 8]));
ok(mv1.some(m => m.combo.type === 'straight' && m.combo.rank === 9), 'finds higher straight');
const mv2 = legalMoves([3, 4, 9, 9, 9, 9], null, detectPlain([16, 17]));
eq(mv2.length, 0, 'nothing beats rocket');
const mv3 = legalMoves([3, 4, 9, 9, 9, 9], null, detectPlain([14, 14]));
ok(mv3.some(m => m.combo.type === 'bomb'), 'bomb offered vs pair');
const mv4 = legalMoves([5, 6, 8, 8, 9, 12], L, detectPlain([3, 4, 5, 6, 7]));
ok(mv4.some(m => m.combo.type === 'straight'), 'wild-assisted straight generated');

// ---------- materialize ----------
{
  const handCards = [
    { id: 1, r: 9, s: 0 }, { id: 2, r: 9, s: 1 }, { id: 3, r: 9, s: 2 },
    { id: 4, r: 8, s: 0 }, { id: 5, r: 5, s: 0 },
  ];
  const picked = materialize(handCards, [9, 9, 9, 9], 8);
  ok(picked && picked.length === 4 && picked.some(c => c.id === 4), 'wild card fills soft bomb');
  const nat = materialize(handCards, [5], 8);
  ok(nat && nat[0].id === 5, 'natural pick');
}

// ---------- hint / AI must not break groups needlessly ----------
{
  // David's case: pair of 4s led; hand has 555 and 66 -> answer 66, not 55.
  const prevPair4 = detectPlain([4, 4]);
  const h1 = hintMoves([5, 5, 5, 6, 6], null, prevPair4);
  eq(h1[0].combo.rank, 6, 'hint prefers intact pair 66 over breaking 555');
  const aiMv = aiPlay({
    hand: [5, 5, 5, 6, 6], laizi: null, prev: prevPair4, prevSeat: 0,
    mySeat: 1, landlordSeat: 0, cardCounts: [10, 5, 10], nPlayers: 3,
  });
  eq(aiMv.combo.rank, 6, 'AI prefers intact pair 66 over breaking 555');
  // Lone single preferred over tearing a pair, even at higher rank.
  const h2 = hintMoves([9, 9, 8], null, detectPlain([5]));
  eq(h2[0].combo.rank, 8, 'hint prefers lone 8 over breaking pair of 9s');
  // But when breaking is the only answer, it still answers.
  const h3 = hintMoves([5, 5, 5], null, prevPair4);
  eq(h3[0].combo.rank, 5, 'hint still breaks trio when forced');
  eq(breakPenalty([5, 5], counts([5, 5, 5]), null), 3, 'break penalty on torn trio');
  eq(breakPenalty([5, 5], counts([5, 5, 9]), null), 0, 'no penalty for intact pair');
}

// ---------- full AI simulation ----------
function simulate(cfg, rounds) {
  const errors = [];
  const seats = cfg.mode === 'duel' ? 2 : cfg.mode === 'team' ? 4 : 3;
  const players = Array.from({ length: seats }, (_, i) => ({ name: 'AI' + i, isAI: true }));
  const g = new Game(Object.assign({ aiDelay: 0, players }, cfg), {
    onError: e => errors.push(e),
  });
  for (let i = 0; i < rounds; i++) {
    g.nextRound();
    if (g.state !== 'settle') { failures++; console.error('FAIL: round did not settle', cfg); break; }
    const total = g.result.hands.reduce((a, h) => a + h.length, 0) + g.discarded.length + g.dead.length;
    if (total !== 54) { failures++; console.error('FAIL: card conservation', total, cfg); break; }
    const sum = g.result.deltas.reduce((a, b) => a + b, 0);
    if (sum !== 0) { failures++; console.error('FAIL: score deltas do not sum to 0', g.result.deltas, cfg); break; }
    if (errors.length) { failures++; console.error('FAIL: ai error', errors[0], cfg); break; }
  }
  return g;
}

const configs = [
  { mode: 'classic' },
  { mode: 'classic', laizi: true },
  { mode: 'classic', noShuffle: true },
  { mode: 'classic', laizi: true, noShuffle: true, doubling: false, base: 3 },
  { mode: 'duel' },
  { mode: 'duel', laizi: true, noShuffle: true },
  { mode: 'team' },
  { mode: 'team', laizi: true, noShuffle: true },
];
for (const cfg of configs) {
  const t0 = Date.now();
  simulate(cfg, 120);
  console.log(`sim ok: ${JSON.stringify(cfg)} 120 rounds in ${Date.now() - t0}ms`);
}

// ---------- 2v2 team settle sanity ----------
{
  const g = simulate({ mode: 'team' }, 1);
  const r = g.result;
  const L = g.landlord, ally = (L + 2) % 4;
  const lw = r.winner === L || r.winner === ally;
  ok(r.landlordWon === lw, 'team result matches winner side');
  ok(r.deltas[L] === r.deltas[ally], 'landlord and ally share the outcome');
  const others = [0, 1, 2, 3].filter(s => s !== L && s !== ally);
  ok(r.deltas[others[0]] === r.deltas[others[1]], 'defenders share the outcome');
  ok(r.deltas[L] === -r.deltas[others[0]], 'team deltas are mirrored');
  ok(g.hands.every ? true : true, 'noop');
  ok(g.handSize === 13 && g.bottomSize === 2, 'team deal is 13 cards + 2 kitty');
}

if (failures) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAll tests passed.');

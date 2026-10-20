'use strict';

// Exercise the browser scripts with deterministic deals and controllable timers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEngine() {
  const timers = new Map();
  let timerId = 0;
  const context = vm.createContext({
    console,
    setTimeout(run, delay) {
      const id = ++timerId;
      timers.set(id, { run, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext(`
    let seed = 0x5eed1234;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
  `, context);
  for (const file of ['cards.js', 'moves.js', 'ai.js', 'game.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../../public/games/doudizhu/js', file), 'utf8'), context, { filename: file });
  }
  return { Game: vm.runInContext('Game', context), timers };
}

function players(firstHuman = false) {
  return Array.from({ length: 3 }, (_, i) => ({ name: 'Player ' + i, isAI: !(firstHuman && i === 0) }));
}

// Each zero-delay turn must finish before the next AI turn starts. Recursively
// dispatching turns grows the stack and can crash Node during ordinary rounds.
{
  const { Game, timers } = loadEngine();
  const errors = [], events = [], updates = [];
  const g = new Game({ aiDelay: 0, players: players() }, {
    onError: error => errors.push(error),
    onEvent: event => events.push({ event, seq: g.seq }),
    onUpdate: game => updates.push(game.seq),
  });
  const aiStep = g.aiStep;
  let active = 0, maxActive = 0;
  g.aiStep = function (seat) {
    active++;
    maxActive = Math.max(maxActive, active);
    try { return aiStep.call(this, seat); }
    finally { active--; }
  };
  g.nextRound();
  assert.equal(g.state, 'settle', 'zero-delay games settle before nextRound returns');
  assert.equal(errors.length, 0, 'a full AI round has no recovered engine errors');
  assert.equal(maxActive, 1, 'zero-delay AI turns do not recursively nest');
  assert.equal(timers.size, 0, 'zero-delay games do not schedule asynchronous turns');
  assert.equal(events[0].event, 'deal');
  assert.equal(events.at(-1).event, 'settle');
  assert.equal(g.seq, events.length, 'one sequence increment per event');
  assert.deepEqual(events.map(event => event.seq), Array.from({ length: events.length }, (_, i) => i + 1));
  assert.deepEqual(updates, events.map(event => event.seq), 'updates retain event sequence ordering');
}

// Start the next real round from the public settle hook, making a long,
// deterministic chain without enlarging hands or replacing the AI/rules.
{
  const { Game, timers } = loadEngine();
  const errors = [];
  let settled = 0;
  const g = new Game({ aiDelay: 0, players: players() }, {
    onError: error => errors.push(error),
    onEvent: event => {
      if (event !== 'settle') return;
      settled++;
      assert.equal(g.result.hands.reduce((sum, hand) => sum + hand.length, 0) + g.discarded.length + g.dead.length, 54);
      assert.equal(g.result.deltas.reduce((sum, delta) => sum + delta, 0), 0);
      if (settled < 300) g.nextRound();
    },
  });
  g.nextRound();
  assert.equal(settled, 300, 'a long chain of rounds completes synchronously');
  assert.equal(g.state, 'settle');
  assert.equal(errors.length, 0, 'stress rounds have no recovered stack overflows');
  assert.equal(timers.size, 0);
}

// Synchronous AI progression still stops when the next actor is human.
{
  const { Game, timers } = loadEngine();
  const errors = [];
  const g = new Game({ aiDelay: 0, players: players(true) }, {
    onError: error => errors.push(error),
  });
  g.nextRound();
  assert.equal(g.state, 'bidding');
  assert.equal(g.actorSeat(), 0);
  assert.equal(g.seq, 1);
  assert.equal(g.actBid(0, 3), true);
  assert.equal(g.state, 'doubling');
  assert.equal(g.actorSeat(), 0, 'AI opponents double, then wait for the human landlord');
  assert.equal(g.doubles[0], null);
  assert.notEqual(g.doubles[1], null);
  assert.notEqual(g.doubles[2], null);
  const seq = g.seq;
  g.pump();
  assert.equal(g.seq, seq, 'pumping a human turn has no side effects');
  assert.equal(errors.length, 0);
  assert.equal(timers.size, 0);
}

// Browser games retain delayed execution, replacement/cancellation, and the
// sequence guard that discards a callback captured before the game changed.
{
  const { Game, timers } = loadEngine();
  const g = new Game({ aiDelay: 25, players: players() });
  g.nextRound();
  assert.equal(g.seq, 1, 'positive-delay AI waits for its timer');
  assert.equal(timers.size, 1);
  const firstId = g._t;
  const first = timers.get(firstId);
  assert.ok(first.delay >= 25 && first.delay < 725);
  g.pump();
  assert.equal(timers.has(firstId), false, 'repumping cancels the previous timer');
  assert.equal(timers.size, 1);
  const nextId = g._t;
  const next = timers.get(nextId);
  timers.delete(nextId);
  next.run();
  assert.ok(g.seq > 1, 'a valid timer executes an AI action');
  assert.equal(timers.size, 1, 'the next delayed AI gets one timer');
  const stale = timers.get(g._t);
  g.emit('refresh');
  const seq = g.seq;
  stale.run();
  assert.equal(g.seq, seq, 'stale sequence callbacks do not act');
  g.stop();
  assert.equal(timers.size, 0, 'stop cancels the pending AI timer');
  assert.equal(g._t, null);
}

// A thrown hook/AI error must not leave the synchronous pump locked forever.
{
  const { Game } = loadEngine();
  const g = new Game({ aiDelay: 0, players: players(true) });
  g.nextRound();
  g.players[0].isAI = true;
  const aiStep = g.aiStep;
  g.aiStep = () => { throw new Error('injected step error'); };
  assert.throws(() => g.pump(), /injected step error/);
  g.aiStep = aiStep;
  g.pump();
  assert.equal(g.state, 'settle', 'AI progression can resume after a propagated error');
}

console.log('AI pump regression tests passed.');

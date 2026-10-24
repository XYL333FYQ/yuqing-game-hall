const { test } = require('node:test');
const assert = require('node:assert/strict');
const MahjongGame = require('../mahjong-game');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const tile = value => ({ value, type: 0 });

function claimGame() {
  const game = new MahjongGame();
  game.status = 2;
  game.hands = [
    [4, 5, 6, 7, 8, 12, 13, 14, 15, 16, 21, 22, 23, 24],
    [2, 3, 1, 5, 7, 9, 12, 14, 16, 18, 21, 23, 25],
    [4, 4, 0, 1, 2, 6, 8, 10, 12, 15, 17, 22, 24],
    [4, 0, 0, 0, 9, 10, 11, 18, 19, 20, 27, 27, 27],
  ].map(hand => hand.map(tile));
  game.wall = [tile(33), tile(32)];
  assert.equal(game.discard(0, tile(4)).status, true);
  assert(game.getTurnOptions(1).includes('chi'));
  assert(game.getTurnOptions(2).includes('peng'));
  assert(game.getTurnOptions(3).includes('hu'));
  return game;
}

test('麻将先报吃碰不能抢走其他玩家的胡牌，等待期间不修改手牌', () => {
  for (const first of [1, 2]) {
    const game = claimGame();
    const hands = JSON.stringify(game.hands);
    const ret = game.claim(first, first === 1 ? 'chi' : 'peng');
    assert.equal(ret.waiting, true);
    assert.equal(JSON.stringify(game.hands), hands);
    assert.equal(game.getCurrentAction(), 'claim');
    assert.deepEqual(game.claim(3, 'hu').result.winner, [3]);
  }
});

test('麻将胡牌者放弃后，先报的碰优先于吃且返回真实鸣牌座位', () => {
  for (const order of [[1, 2], [2, 1]]) {
    const game = claimGame();
    for (const pos of order) assert.equal(game.claim(pos, pos === 1 ? 'chi' : 'peng').waiting, true);
    const ret = game.passClaim(3);
    assert.equal(game.getContextPosId(), 2);
    assert.equal(ret.meld.posId, 2);
    assert.equal(ret.meld.type, 'peng');
    assert.equal(game.hands[1].length, 13);
    assert.equal(game.hands[2].length, 11);
    assert.equal(game.discards[0].length, 0);
    assert.equal(game.getPendingClaim(), null);
    assert.equal(game.wall.length, 2);
  }
});

test('麻将吃牌等待其他人放弃后执行，全部放弃则下家摸牌', () => {
  for (const takeChi of [false, true]) {
    const game = claimGame();
    assert.equal((takeChi ? game.claim(1, 'chi') : game.passClaim(1)).waiting, true);
    assert.equal(game.passClaim(2).waiting, true);
    const ret = game.passClaim(3);
    assert.equal(ret.status, true);
    assert.equal(game.getContextPosId(), 1);
    assert.equal(game.getCurrentAction(), 'discard');
    assert.equal(game.hands[1].length, takeChi ? 11 : 14);
    assert.equal(game.wall.length, takeChi ? 2 : 1);
    assert.equal(ret.meld?.posId, takeChi ? 1 : undefined);
    assert.equal(ret.drawCard?.value, takeChi ? undefined : 33);
  }
});

test('麻将多人可胡时按出牌方向选择最近者，不由消息到达顺序决定', () => {
  const game = claimGame();
  game.hands[2] = [4, 1, 1, 1, 12, 13, 14, 21, 22, 23, 28, 28, 28].map(tile);
  assert(game.getTurnOptions(2).includes('hu'));
  assert.equal(game.claim(3, 'hu').waiting, true);
  assert.deepEqual(game.claim(2, 'hu').result.winner, [2]);
});

test('麻将没有优先级竞争时直接鸣牌，无须等待只可吃的玩家', () => {
  const game = claimGame();
  game.passClaim(3);
  const ret = game.claim(2, 'peng');
  assert.equal(ret.waiting, undefined);
  assert.equal(ret.meld.posId, 2);
  assert.equal(game.getContextPosId(), 2);
});

test('麻将抢牌超时保留先前的吃牌，并广播给正确座位更新手牌', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const method = source.slice(source.indexOf('  broadcastMahjongState(deskId, options) {'), source.indexOf('  finishMahjongGame(deskId, result) {'));
  const timers = [];
  const broadcast = vm.runInNewContext(`({${method}}).broadcastMahjongState`, {
    MAHJONG_PLAY_TIMEOUT: 30, setTimeout: callback => { timers.push(callback); return timers.length; },
  });
  const game = claimGame();
  assert.equal(game.claim(1, 'chi').waiting, true);
  const messages = [];
  const room = {
    gameDatas: { 1: game }, mahjongClaimTimers: {}, getDesk: () => ({}), clearMahjongClaimTimer() {},
    clients: [0, 1, 2, 3, 'spec'].map(posId => ({ deskId: 1, posId, socket: { emit: (name, payload) => messages.push({ posId, payload }) } })),
    finishMahjongGame() { assert.fail('吃牌不应结束游戏'); }, scheduleBotAction() {}, broadcastMahjongState: broadcast,
  };
  broadcast.call(room, 1);
  messages.length = 0;
  timers[0]();
  assert.equal(game.getContextPosId(), 1);
  assert.equal(game.hands[1].length, 11);
  assert.equal(messages.length, 5);
  for (const { payload } of messages) {
    assert.equal(payload.meld.posId, 1);
    assert.equal(payload.meld.type, 'chi');
    assert.deepEqual(Array.from(payload.meld.taken, card => card.value), [3, 5]);
    assert.equal(payload.drawCard, undefined);
    assert.equal(payload.action, 'discard');
    assert.equal(payload.handCounts[1], 11);
  }
});

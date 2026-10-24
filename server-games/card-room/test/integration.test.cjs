const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createServer } = require('node:net');
const { io } = require('socket.io-client');
const path = require('node:path');

function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, receive); reject(new Error(`Missing ${name}`)); }, 8000);
    function receive(data) { clearTimeout(timer); resolve(data); }
    socket.once(name, receive);
  });
}
test('掼蛋和麻将的私人房间、好友入座、AI 开局及跨来源拒绝', async () => {
  const origin = process.env.BOARD_ORIGIN || 'https://games.example.com';
  let child;
  let url = process.env.CARD_ROOM_URL;
  const clients = [];
  if (!url) {
    const reservation = createServer();
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    url = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'production', ALLOWED_ORIGINS: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const connect = async (customOrigin = origin) => {
    const socket = io(url, { autoConnect: false, transports: ['websocket'], reconnection: false, extraHeaders: { Origin: customOrigin } });
    clients.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
    const ready = event(socket, 'LOGIN_SUCCESS');
    const id = randomUUID();
    socket.emit('LOGIN', { userName: 'test-' + id.slice(0, 6), guestId: id });
    await ready;
    return socket;
  };
  try {
    const deadline = Date.now() + 8000;
    while (true) {
      try { if ((await fetch(url + '/health')).ok) break; } catch {}
      if (Date.now() > deadline) throw new Error('Card room did not start');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal((await fetch(url + '/')).status, 404, 'Backend must not host static HTML');
    assert.equal((await fetch(url + '/health', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    await assert.rejects(connect('https://untrusted.example'));
    const anonymous = io(url, { autoConnect: false, transports: ['websocket'], reconnection: false, extraHeaders: { Origin: origin } });
    clients.push(anonymous);
    await new Promise((resolve, reject) => { anonymous.once('connect', resolve); anonymous.once('connect_error', reject); anonymous.connect(); });
    for (const data of [undefined, null, [], { score: {} }, { score: -1 }, { score: 4 }, { score: 1.5 }]) anonymous.emit('CALL_SCORE', data);
    const anonymousLogin = event(anonymous, 'LOGIN_SUCCESS');
    const anonymousId = randomUUID();
    anonymous.emit('LOGIN', { userName: 'test-' + anonymousId.slice(0, 6), guestId: anonymousId });
    await anonymousLogin;
    assert.equal((await fetch(url + '/health')).status, 200);
    anonymous.disconnect();
    for (const gameType of ['guandan', 'mahjong']) {
      const host = await connect();
      const guest = await connect();
      const created = event(host, 'ROOM_CREATED');
      const hostSeat = event(host, 'QUICK_JOIN');
      host.emit('CREATE_ROOM', { gameType, isPrivate: true });
      const room = await created;
      assert.equal(room.isPrivate, true);
      const sitHost = event(host, 'SITDOWN_SUCCESS');
      const seat = await hostSeat;
      host.emit('SITDOWN', { deskId: seat.deskId, posId: seat.posId });
      await sitHost;
      const guestSeat = event(guest, 'QUICK_JOIN');
      guest.emit('JOIN_ROOM', { roomCode: room.roomCode });
      const joined = await guestSeat;
      assert.equal(joined.deskId, room.deskId);
      const sitGuest = event(guest, 'SITDOWN_SUCCESS');
      guest.emit('SITDOWN', { deskId: joined.deskId, posId: joined.posId });
      const guestState = await sitGuest;
      assert.equal(guestState.gameType, gameType);
      host.emit('ADD_BOTS');
      await new Promise(resolve => setTimeout(resolve, 80));
      const hostStart = event(host, 'GAME_START');
      const guestStart = event(guest, 'GAME_START');
      let starts = 0;
      host.on('GAME_START', () => { starts += 1; });
      host.emit('PREPARE');
      guest.emit('PREPARE');
      const [a, b] = await Promise.all([hostStart, guestStart]);
      assert.equal(a.gameType, gameType);
      assert.equal(b.gameType, gameType);
      host.emit('PREPARE');
      guest.emit('PREPARE');
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(starts, 1, '准备消息不能重开正在进行的对局');
      host.disconnect();
      guest.disconnect();
    }
  } finally {
    clients.forEach(client => client.disconnect());
    child?.kill();
  }
});

test('斗地主手牌校验拒绝重复物理牌且不修改原手牌', () => {
  const Game = require('../game');
  const game = new Game();
  game.init();
  game.start();
  const posId = game.getContextPosId();
  const hand = game.getCardsByPosId(posId);
  const before = JSON.stringify(hand);
  assert.equal(game.validate(posId, Array(4).fill(hand[0])).status, false);
  assert.equal(game.checkExist(hand.slice(0, 3), posId), true);
  assert.equal(game.checkExist([{ value: 99, type: 0 }], posId), false);
  assert.equal(JSON.stringify(hand), before);
});

test('掼蛋上一手走完后，剩余玩家都必须有跟牌机会', () => {
  const GuandanGame = require('../guandan-game');
  const card = value => ({ value, type: 0, deck: 0 });
  for (let leader = 0; leader < 4; leader++) {
    const game = new GuandanGame();
    game.status = 2;
    game.contextPosId = leader;
    game.contextCards = [0, 1, 2, 3].map(id => ({ id, cards: id === leader ? [card(3)] : [card(4), card(5)] }));
    game.next(leader, [card(3)]);
    game.next((leader + 1) % 4, []);
    game.next((leader + 2) % 4, []);
    const lastResponder = (leader + 3) % 4;
    assert.equal(game.getContextPosId(), lastResponder, `座位 ${leader} 走完后不应跳过最后一位响应者`);
    assert.equal(game.lastCardInfo.len, 1);
    assert.equal(game.validate(lastResponder, [card(4)]).status, true);
    game.next(lastResponder, [card(4)]);
    assert.equal(game.getStatus(), 2);
    assert.equal(game.lastCardInfo.posId, lastResponder);
  }
});

test('掼蛋全员过牌后才重新领出，未走完的领出者不必响应自己', () => {
  const GuandanGame = require('../guandan-game');
  const card = value => ({ value, type: 0, deck: 0 });
  for (const finishes of [false, true]) {
    const game = new GuandanGame();
    game.status = 2;
    game.contextPosId = 0;
    game.contextCards = [0, 1, 2, 3].map(id => ({ id, cards: id === 0 && finishes ? [card(3)] : [card(3), card(4)] }));
    game.next(0, [card(3)]);
    for (const pos of [1, 2]) game.next(pos, []);
    assert.equal(game.lastCardInfo.len, 1);
    game.next(3, []);
    assert.equal(game.lastCardInfo.len, 0);
    assert.equal(game.getContextPosId(), finishes ? 1 : 0);
    assert.equal(game.validate(game.getContextPosId(), [game.getCardsByPosId(game.getContextPosId())[0]]).status, true);
  }
});

test('麻将可以吃被打出的八和九，但不能跨花色或吃字牌', () => {
  const MahjongGame = require('../mahjong-game');
  const game = new MahjongGame();
  const tile = value => ({ value, type: 0 });
  for (const base of [0, 9, 18]) {
    for (const rank of [7, 8]) {
      game.hands[1] = [tile(base + rank - 2), tile(base + rank - 1)];
      assert.ok(game.getClaimOptions(1, tile(base + rank), 1).includes('chi'));
    }
  }
  game.hands[1] = [tile(7), tile(8)];
  assert.equal(game.getClaimOptions(1, tile(9), 1).includes('chi'), false);
  game.hands[1] = [tile(25), tile(26)];
  assert.equal(game.getClaimOptions(1, tile(27), 1).includes('chi'), false);
});

test('麻将抢牌超时自动摸牌只向当前玩家发送具体牌，牌墙耗尽则结束', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const MahjongGame = require('../mahjong-game');
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  // Exercise the actual timer/broadcast method with a controlled clock and real model.
  const method = source.slice(source.indexOf('  broadcastMahjongState(deskId, options) {'), source.indexOf('  finishMahjongGame(deskId, result) {'));
  for (const exhausted of [false, true]) {
    const timers = [];
    const broadcast = vm.runInNewContext(`({${method}}).broadcastMahjongState`, {
      MAHJONG_PLAY_TIMEOUT: 30,
      setTimeout: callback => { timers.push(callback); return timers.length; },
    });
    const game = new MahjongGame();
    game.status = 2;
    game.hands[1] = [{ value: 0, type: 0 }, { value: 1, type: 0 }];
    game.wall = exhausted ? [] : [{ value: 20, type: 0 }];
    game.pendingClaim = { card: { value: 2, type: 0 }, discarder: 0, nextPos: 1, eligible: [1], responded: {} };
    game.currentAction = 'claim';
    const messages = [];
    let ended = false;
    const room = {
      gameDatas: { 1: game }, mahjongClaimTimers: {}, getDesk: () => ({}), clearMahjongClaimTimer() {},
      clients: [0, 1, 'spec'].map(posId => ({ deskId: 1, posId, socket: { emit: (name, payload) => messages.push({ posId, payload }) } })),
      finishMahjongGame: () => { ended = true; }, scheduleBotAction() {},
      broadcastMahjongState: broadcast,
    };
    broadcast.call(room, 1);
    messages.length = 0;
    assert.equal(timers.length, 1);
    timers[0]();
    assert.equal(ended, exhausted);
    if (!exhausted) {
      assert.equal(game.hands[1].length, 3);
      const own = messages.find(message => message.posId === 1).payload;
      assert.equal(own.action, 'discard');
      assert.equal(own.drawCard.value, 20);
      assert.equal(own.drawFor, 1);
      assert(messages.filter(message => message.posId !== 1).every(message => !message.payload.drawCard));
    }
  }
});

test('错阶段和错回合消息不破坏牌局，正常叫分和出牌仍可继续', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const Game = require('../game');
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const handlers = {};
  const emitted = [];
  const socket = { on: (name, handler) => { handlers[name] = handler; }, emit: (name, data) => emitted.push(name) };
  const game = new Game().start();
  const client = { deskId: 1, posId: (Number(game.getContextPosId()) + 1) % 3 };
  const moves = [];
  const room = { gameType: 'doudizhu' };
  const server = {
    getClient: () => client, gameDatas: { 1: game }, getDesk: () => room,
    recordRoundMove: (deskId, move) => moves.push(move), broadCastRoom() {}, scheduleBotAction() {},
  };
  const listeners = source.slice(source.indexOf("      socket.on('CALL_SCORE',"), source.indexOf("      socket.on('disconnect',"));
  const register = vm.runInNewContext(`(function () { ${listeners} })`, {
    socket, DOU_DIZHU_STEP_TIMEOUT: 30, DOU_DIZHU_PLAY_TIMEOUT: 30, GUANDAN_PLAY_TIMEOUT: 30,
  });
  register.call(server);
  handlers.CALL_SCORE({ score: 0 });
  assert.equal(game.getStatus(), 1);
  assert.equal(moves.length, 0);
  client.posId = game.getContextPosId();
  handlers.PLAY_CARD([]);
  assert.equal(game.getStatus(), 1);
  assert(emitted.includes('PLAY_CARD_ERROR'));
  handlers.CALL_SCORE({ score: 3 });
  assert.equal(game.getStatus(), 2);
  assert.equal(moves.length, 1);
  client.posId = (Number(game.getContextPosId()) + 1) % 3;
  handlers.PLAY_CARD([]);
  handlers.CALL_SCORE({ score: 1 });
  assert.equal(game.getStatus(), 2);
  assert.equal(moves.length, 1);
  client.posId = game.getContextPosId();
  const hand = game.getCardsByPosId(client.posId);
  const count = hand.length;
  handlers.PLAY_CARD([hand[0]]);
  assert.equal(game.getCardsByPosId(client.posId).length, count - 1);
  assert(emitted.includes('PLAY_CARD_SUCCESS'));
  assert.equal(moves.length, 2);
});

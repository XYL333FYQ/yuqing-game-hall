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
      host.emit('PREPARE');
      guest.emit('PREPARE');
      const [a, b] = await Promise.all([hostStart, guestStart]);
      assert.equal(a.gameType, gameType);
      assert.equal(b.gameType, gameType);
      host.disconnect();
      guest.disconnect();
    }
  } finally {
    clients.forEach(client => client.disconnect());
    child?.kill();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { createGobangService } from '../server.js';

test('好友落子、非法回合、胜负、观战、重连和来源限制', async () => {
  const origin = process.env.BOARD_ORIGIN || 'https://games.example.com';
  const service = process.env.GOBANG_URL ? null : createGobangService({ port: 0, production: true, allowedOrigins: [origin] });
  const url = process.env.GOBANG_URL || `ws://127.0.0.1:${await service.listen()}/socket`;
  const clients = [];
  const room = randomUUID().replaceAll('-', '');
  async function connect(id, customOrigin = origin) {
    const ws = new WebSocket(url, { origin: customOrigin });
    clients.push(ws);
    const messages = [];
    ws.on('message', bytes => messages.push(JSON.parse(bytes)));
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const next = async type => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const index = messages.findIndex(message => message.type === type);
        if (index >= 0) return messages.splice(index, 1)[0];
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error(`Missing ${type}: ${JSON.stringify(messages)}`);
    };
    ws.send(JSON.stringify({ type: 'EnterRoom', id, room }));
    return { ws, next, initial: await next('InitializeRoomState'), messages };
  }
  try {
    const health = await fetch(url.replace(/^ws/, 'http').replace('/socket', '/health'));
    assert.equal(health.status, 200);
    assert.equal((await fetch(url.replace(/^ws/, 'http').replace('/socket', '/'))).status, 404);
    const blackId = randomUUID();
    const black = await connect(blackId);
    const white = await connect(randomUUID());
    assert.equal(black.initial.black, true);
    assert.equal(white.initial.black, false);
    assert.equal((await black.next('AddPlayer')).ready, true);
    const observer = await connect(randomUUID());
    assert.equal(observer.initial.visiting, true);
    const move = (client, x, y) => client.ws.send(JSON.stringify({ type: 'DropPiece', x, y }));
    move(white, 0, 0);
    await white.next('Error');
    move(observer, 0, 0);
    await observer.next('Error');
    // A middle move completes stones on both sides; the old upstream missed this.
    for (const [index, x] of [3, 4, 6, 7, 5].entries()) {
      move(black, x, 5);
      assert.equal((await white.next('DropPiece')).x, x);
      await observer.next('DropPiece');
      if (index === 4) break;
      if (index === 0) { move(white, x, 5); await white.next('Error'); }
      move(white, index * 2, 0);
      await black.next('DropPiece');
      await observer.next('DropPiece');
    }
    move(white, 14, 14);
    await white.next('Error');
    black.ws.close();
    const resumed = await connect(blackId);
    assert.equal(resumed.initial.black, true);
    assert.equal(resumed.initial.visiting, false);
    assert.equal(resumed.initial.pieces.length, 9);
    assert.deepEqual(resumed.initial.pieces.at(-1), [5, 5]);
    await assert.rejects(connect(randomUUID(), 'https://untrusted.example'), /403/);
  } finally {
    clients.forEach(ws => ws.terminate());
    await service?.close();
  }
});

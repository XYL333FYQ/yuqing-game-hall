// Adapted from HullQin/gobang (MIT). Preserve its room/message protocol;
// the server now validates turns, occupied points and wins before broadcasting.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

export function createGobangService({ host = '127.0.0.1', port = 8792, allowedOrigins = [], production = false } = {}) {
  if (production && !allowedOrigins.length) throw new Error('ALLOWED_ORIGINS is required');
  const rooms = new Map();
  const http = createServer((request, response) => {
    response.writeHead(request.url === '/health' ? 200 : 404, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(request.url === '/health' ? { ok: true, service: 'gobang', rooms: rooms.size } : { error: 'Not found' }));
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  http.on('upgrade', (request, connection, head) => {
    const origin = request.headers.origin || '';
    const local = !production && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (request.url !== '/socket' || (origin && !allowedOrigins.includes(origin) && !local) || (production && !origin)) {
      connection.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    sockets.handleUpgrade(request, connection, head, socket => sockets.emit('connection', socket));
  });
  const send = (socket, message) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
  function snapshot(room, userId) {
    const visiting = userId !== room.black && userId !== room.white;
    return { type: 'InitializeRoomState', pieces: room.pieces, visiting, black: visiting ? !!(room.pieces.length % 2) : room.black === userId, ready: !!(room.black && room.white) };
  }
  sockets.on('connection', socket => {
    let room;
    let userId;
    let joinTimer = setTimeout(() => socket.close(1008, 'Join timeout'), 10000);
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('message', (bytes, binary) => {
      if (binary) return socket.close(1003, 'Text required');
      let data;
      try { data = JSON.parse(bytes.toString()); } catch { return socket.close(1008, 'Invalid JSON'); }
      if (!data || typeof data !== 'object') return socket.close(1008, 'Invalid message');
      if (!room) {
        if (data.type !== 'EnterRoom' || typeof data.id !== 'string' || !/^[\w-]{8,80}$/.test(data.id) || typeof data.room !== 'string' || !/^[\p{L}\p{N}_-]{1,32}$/u.test(data.room)) return socket.close(1008, 'Invalid room');
        if (!rooms.has(data.room)) {
          if (rooms.size >= 256) return socket.close(1013, 'Room limit');
          rooms.set(data.room, { black: null, white: null, pieces: [], board: new Map(), clients: new Map(), finished: false, updated: Date.now() });
        }
        room = rooms.get(data.room);
        userId = data.id;
        clearTimeout(joinTimer);
        const previous = room.clients.get(userId);
        if (previous) previous.close(4000, 'Joined in another window');
        const returning = room.black === userId || room.white === userId;
        if (!returning) {
          if (!room.black) room.black = userId;
          else if (!room.white) room.white = userId;
        }
        room.clients.set(userId, socket);
        room.updated = Date.now();
        send(socket, snapshot(room, userId));
        if (!returning && (room.black === userId || room.white === userId)) {
          for (const peer of room.clients.values()) if (peer !== socket) send(peer, { type: 'AddPlayer', ready: !!(room.black && room.white) });
        }
        return;
      }
      if (data.type !== 'DropPiece') return;
      const color = room.pieces.length % 2;
      const expected = color === 0 ? room.black : room.white;
      const { x, y } = data;
      if (!room.black || !room.white || room.finished || expected !== userId || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= 15 || y < 0 || y >= 15 || room.board.has(`${x},${y}`)) {
        send(socket, { type: 'Error', message: '这一步不能落子，请等待自己的回合。' });
        return;
      }
      room.pieces.push([x, y]);
      room.board.set(`${x},${y}`, color);
      room.updated = Date.now();
      room.finished = won(room.board, x, y, color) || room.pieces.length === 225;
      for (const peer of room.clients.values()) if (peer !== socket) send(peer, { type: 'DropPiece', x, y });
    });
    socket.on('close', () => {
      clearTimeout(joinTimer);
      if (room?.clients.get(userId) === socket) { room.clients.delete(userId); room.updated = Date.now(); }
    });
    socket.on('error', () => {});
  });
  const heartbeat = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!socket.isAlive) socket.terminate();
      else { socket.isAlive = false; socket.ping(); }
    }
    for (const [id, room] of rooms) if (!room.clients.size && Date.now() - room.updated > 30 * 60 * 1000) rooms.delete(id);
  }, 25000);
  heartbeat.unref();
  return {
    listen: () => new Promise((resolve, reject) => { http.once('error', reject); http.listen(port, host, () => resolve(http.address().port)); }),
    close: async () => {
      clearInterval(heartbeat);
      for (const socket of sockets.clients) socket.terminate();
      await new Promise(resolve => sockets.close(resolve));
      if (http.listening) await new Promise(resolve => http.close(resolve));
    },
  };
}

export function won(board, x, y, color) {
  return [[1, 0], [0, 1], [1, 1], [1, -1]].some(([dx, dy]) => {
    let count = 1;
    for (const sign of [-1, 1]) {
      let nx = x + dx * sign, ny = y + dy * sign;
      while (board.get(`${nx},${ny}`) === color) { count++; nx += dx * sign; ny += dy * sign; }
    }
    return count >= 5;
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const service = createGobangService({
    host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 8792),
    allowedOrigins: String(process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
    production: process.env.NODE_ENV === 'production',
  });
  console.log(`Gobang listening on ${await service.listen()}`);
}

// 迁移后的公网双客户端协议测试；不需要两台物理设备。
// 仅创建随机临时房间/会话，不修改部署配置。
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../server-games/sanctuarys-end/package.json", import.meta.url));
const WebSocket = require("ws");
const ORIGIN = "https://game.xyllovefyq.cc.cd";

function client(url) {
  const ws = new WebSocket(url, { headers: { Origin: ORIGIN } });
  const queue = [];
  const waiting = [];
  let error;
  const opened = new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  ws.on("error", (err) => {
    error = err;
    for (const item of waiting.splice(0)) { clearTimeout(item.timer); item.reject(err); }
  });
  ws.on("message", (buf) => {
    try {
      const message = JSON.parse(buf.toString());
      const index = waiting.findIndex((entry) => entry.predicate(message));
      if (index >= 0) {
        const entry = waiting.splice(index, 1)[0];
        clearTimeout(entry.timer);
        entry.resolve(message);
      } else {
        queue.push(message);
      }
    } catch (err) { error = err; }
  });
  return {
    opened,
    send(value) { assert.equal(ws.readyState, WebSocket.OPEN); ws.send(JSON.stringify(value)); },
    next(predicate, timeout = 10000) {
      if (error) return Promise.reject(error);
      const i = queue.findIndex(predicate);
      if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const entry = { predicate, resolve, reject, timer: null };
        entry.timer = setTimeout(() => {
          const at = waiting.indexOf(entry);
          if (at >= 0) waiting.splice(at, 1);
          reject(new Error("等待公网 WebSocket 消息超时"));
        }, timeout);
        waiting.push(entry);
      });
    },
    close() { ws.terminate(); },
  };
}

async function post(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(response.status, 201, `${url} 创建/加入房间失败 (${response.status})`);
  return response.json();
}

test("公网 Sanctuary 两个客户端双向通信", { timeout: 30000 }, async () => {
  const a = client("wss://sanctuary.xyllovefyq.cc.cd/socket");
  const b = client("wss://sanctuary.xyllovefyq.cc.cd/socket");
  try {
    await Promise.all([a.opened, b.opened]);
    const [wa, wb] = await Promise.all([
      a.next((m) => m.t === "welcome"),
      b.next((m) => m.t === "welcome"),
    ]);
    assert.notEqual(wa.id, wb.id);
    const tag = randomUUID();
    a.send({ t: "chat", name: "smoke-A", msg: tag });
    const received = await b.next((m) => m.t === "chat" && m.msg === tag);
    assert.equal(received.id, wa.id);
    b.send({ t: "chat", name: "smoke-B", msg: tag + "-reply" });
    const reply = await a.next((m) => m.t === "chat" && m.msg === tag + "-reply");
    assert.equal(reply.id, wb.id);
  } finally {
    a.close();
    b.close();
  }
});

test("公网 Fruit Party 创建房间、第二人加入、双 WebSocket、准备开局", { timeout: 45000 }, async () => {
  const base = "https://rooms.xyllovefyq.cc.cd";
  const tag = randomUUID().slice(0, 5);
  const host = await post(base + "/api/rooms", { mode: "score90", nickname: "A" + tag });
  assert.match(host.code, /^[A-Z0-9]+$/);
  const guest = await post(base + "/api/rooms/" + host.code + "/join", { nickname: "B" + tag });
  assert.equal(guest.code, host.code);
  assert.notEqual(guest.playerId, host.playerId);

  const urlFor = (p) => `wss://rooms.xyllovefyq.cc.cd/api/rooms/${host.code}/socket?player=${encodeURIComponent(p.playerId)}&token=${encodeURIComponent(p.token)}`;
  const a = client(urlFor(host));
  const b = client(urlFor(guest));
  try {
    await Promise.all([a.opened, b.opened]);
    const both = (m) => m.type === "snapshot" && m.players?.length === 2 && m.players.every((p) => p.connected);
    await Promise.all([a.next(both), b.next(both)]);
    a.send({ type: "ready", ready: true });
    b.send({ type: "ready", ready: true });
    const started = await b.next((m) => m.type === "snapshot" && ["countdown", "playing"].includes(m.phase));
    assert.equal(started.players.length, 2);
  } finally {
    a.close();
    b.close();
  }
});

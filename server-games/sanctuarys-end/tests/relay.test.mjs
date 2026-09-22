import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";

// 真正的通信 smoke test：验证 welcome / state / chat / leave 全链路。
// 只验证“进程活着”是不够的——协议坏了进程一样健康。
//
// 两种运行方式共用同一份断言：
//   1. 本地/CI 默认：自己把部署用的 server.js 拉起来（测试真实入口文件）。
//   2. 部署后验收：设置 RELAY_URL / RELAY_ORIGIN 指向正在运行的中继
//      （CI 里通过 SSH 隧道连 VPS 的 127.0.0.1:8787）。

const serverPath = fileURLToPath(new URL("../server.js", import.meta.url));
const origin = process.env.RELAY_ORIGIN || "https://games.example.com";
const externalUrl = (process.env.RELAY_URL || "").trim();

let relay;
let baseUrl;
let socketUrl;

before(async () => {
  if (externalUrl) {
    // 指向线上中继时必须同时给出被允许的 Origin，否则握手会被 403 掉，
    // 那样测出来的是“配置不对”而不是“协议坏了”。
    if (!process.env.RELAY_ORIGIN) {
      throw new Error("测试线上中继时必须设置 RELAY_ORIGIN（与 VPS .env 的 ALLOWED_ORIGINS 一致）");
    }
    const url = new URL(externalUrl);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    baseUrl = url.origin;
    socketUrl = externalUrl.replace(/\/+$/, "").endsWith("/socket")
      ? externalUrl
      : `${externalUrl.replace(/\/+$/, "")}/socket`;
    await waitForHealth(baseUrl);
    return;
  }

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  socketUrl = `ws://127.0.0.1:${port}/socket`;
  relay = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
      ALLOWED_ORIGINS: origin,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  relay.stdout.setEncoding("utf8");
  relay.stderr.setEncoding("utf8");
  await waitForHealth(baseUrl);
});

after(async () => {
  if (!relay || relay.exitCode !== null) return;
  const exited = new Promise((resolve) => relay.once("exit", resolve));
  relay.kill();
  await exited;
});

describe("sanctuary relay protocol", () => {
  it("answers the health endpoint", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, "sanctuary-relay");
    assert.equal(typeof body.clients, "number");
  });

  it("rejects an unapproved browser Origin at the upgrade step", async () => {
    const rejected = await connectExpectingFailure(socketUrl, "https://evil.example");
    assert.match(rejected, /403|Unexpected server response/i);
  });

  it("carries welcome, state, chat and leave between two clients", async () => {
    const a = await connect(socketUrl);
    const b = await connect(socketUrl);
    try {
      const welcomeA = await a.next("welcome");
      const welcomeB = await b.next("welcome");
      assert.ok(Number.isInteger(welcomeA.id) && welcomeA.id > 0);
      assert.ok(Number.isInteger(welcomeB.id) && welcomeB.id > 0);
      assert.notEqual(welcomeA.id, welcomeB.id);

      // A 发 state，B 必须收到，并且带上服务器认定的发送者 id。
      a.send(JSON.stringify({ t: "state", x: 1.5, z: -2.25, name: "A" }));
      const state = await b.next("state");
      assert.equal(state.id, welcomeA.id);
      assert.equal(state.x, 1.5);
      assert.equal(state.z, -2.25);

      // 中继只转发，不回声给发送者。
      await a.expectNothing("state");

      // A 发 chat，B 必须收到。
      a.send(JSON.stringify({ t: "chat", name: "A", msg: "hello" }));
      const chat = await b.next("chat");
      assert.equal(chat.id, welcomeA.id);
      assert.equal(chat.msg, "hello");

      // B 也能回话，A 收到。
      b.send(JSON.stringify({ t: "chat", name: "B", msg: "hi back" }));
      const reply = await a.next("chat");
      assert.equal(reply.id, welcomeB.id);
      assert.equal(reply.msg, "hi back");

      // A 离开，B 必须收到 leave。
      const closed = a.closed();
      a.close();
      const leave = await b.next("leave");
      assert.equal(leave.id, welcomeA.id);
      await closed;
    } finally {
      a.terminate();
      b.terminate();
    }
  });

  it("ignores malformed and unsupported messages instead of broadcasting them", async () => {
    const a = await connect(socketUrl);
    const b = await connect(socketUrl);
    try {
      await a.next("welcome");
      await b.next("welcome");

      a.send("not json at all");
      a.send(JSON.stringify({ t: "not-a-real-type" }));
      a.send(JSON.stringify([1, 2, 3]));
      // 只要没有把上面的垃圾广播出去，B 的队列里就不会出现任何消息。
      await b.expectNothing("state");
      await b.expectNothing("chat");

      // 连接仍然可用：后续正常消息照常送达。
      a.send(JSON.stringify({ t: "chat", name: "A", msg: "still alive" }));
      const chat = await b.next("chat");
      assert.equal(chat.msg, "still alive");
    } finally {
      a.terminate();
      b.terminate();
    }
  });
});

async function freePort() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function waitForHealth(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (relay && relay.exitCode !== null) throw new Error(`中继进程提前退出，退出码 ${relay.exitCode}`);
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      /* 还没起来，继续等 */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`中继服务在超时前没有就绪：${url}`);
}

function connect(url) {
  const socket = new WebSocket(url, { headers: { origin } });
  const queue = [];
  const waiters = [];

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString());
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(message);
    else queue.push(message);
  });
  socket.on("error", (error) => {
    for (const waiter of waiters.splice(0)) waiter.reject(error);
  });

  const take = (timeoutMs) => new Promise((resolve, reject) => {
    const existing = queue.shift();
    if (existing) { resolve(existing); return; }
    const waiter = { resolve, reject };
    waiters.push(waiter);
    const timer = setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index >= 0) waiters.splice(index, 1);
      reject(new Error("等待中继消息超时"));
    }, timeoutMs);
    timer.unref?.();
  });

  return {
    raw: socket,
    send: (payload) => socket.send(payload),
    close: () => socket.close(),
    terminate: () => socket.terminate(),
    closed: () => new Promise((resolve) => socket.once("close", resolve)),
    async next(type, timeoutMs = 4000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error(`没有收到 ${type} 消息`);
        const message = await take(remaining);
        if (message.t === type) return message;
      }
    },
    async expectNothing(type, timeoutMs = 400) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return;
        try {
          const message = await take(remaining);
          assert.notEqual(message.t, type, `不该收到 ${type} 消息：${JSON.stringify(message)}`);
        } catch {
          return;
        }
      }
    },
  };
}

function connectExpectingFailure(url, requestOrigin) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers: { origin: requestOrigin } });
    socket.on("open", () => { socket.terminate(); reject(new Error("不合法的 Origin 竟然连接成功了")); });
    socket.on("error", (error) => resolve(error.message));
  });
}

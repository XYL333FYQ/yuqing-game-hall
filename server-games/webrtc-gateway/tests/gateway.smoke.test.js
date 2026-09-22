import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

// WebRTC gateway 的协议级 smoke test：验证 /health、/rtc-config、PeerJS 信令端点，
// 以及“信令必须真的能签发 ID”这条曾经被挂载方式破坏的路径。
//
// 两种运行方式共用同一份断言：
//   1. 本地/CI 默认：拉起部署用的 server.js（真实入口文件）。
//   2. 部署后验收：设置 WEBRTC_GATEWAY_URL / WEBRTC_GATEWAY_ORIGIN 指向线上 gateway。

const serverPath = fileURLToPath(new URL("../server.js", import.meta.url));
const externalUrl = (process.env.WEBRTC_GATEWAY_URL || "").trim().replace(/\/+$/, "");
const origin = (process.env.WEBRTC_GATEWAY_ORIGIN || "https://games.example.com").trim();

let gateway;
let baseUrl;

before(async () => {
  if (externalUrl) {
    if (!process.env.WEBRTC_GATEWAY_ORIGIN) {
      throw new Error("测试线上 gateway 时必须设置 WEBRTC_GATEWAY_ORIGIN（与 VPS .env 的 ALLOWED_ORIGINS 一致）");
    }
    baseUrl = externalUrl;
    await waitForHealth(baseUrl);
    return;
  }

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  gateway = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
      ALLOWED_ORIGINS: origin,
      TURN_PUBLIC_HOST: "turn.example.com",
      TURN_PORT: "3478",
      TURN_SHARED_SECRET: randomBytes(32).toString("hex"),
      TURN_CREDENTIAL_TTL_SECONDS: "3600",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  gateway.stdout.setEncoding("utf8");
  gateway.stderr.setEncoding("utf8");
  await waitForHealth(baseUrl);
});

after(async () => {
  if (!gateway || gateway.exitCode !== null) return;
  const exited = new Promise((resolve) => gateway.once("exit", resolve));
  gateway.kill();
  await exited;
});

describe("WebRTC gateway protocol", () => {
  it("reports signaling and TURN wiring on /health", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, "webrtc-gateway");
    assert.equal(body.signalingPath, "/peerjs");
    assert.ok(body.turn?.host, "health 必须回报 TURN 主机，方便确认部署到底连到了哪台");
    assert.ok(Number.isInteger(body.turn.port));
  });

  it("issues short-lived TURN credentials and self-hosted ICE servers", async () => {
    const response = await fetch(`${baseUrl}/rtc-config`, { headers: { origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();

    // PeerJS 客户端会拼成 `<path>peerjs/id` 与 `<path>peerjs`，必须是根路径。
    assert.equal(body.peer.path, "/");
    assert.ok(body.peer.key);

    const stun = body.iceServers.find((server) => String(server.urls).includes("stun:"));
    assert.ok(stun, "必须提供自建 STUN");
    assert.ok(!String(stun.urls).includes("google"), "不能把公共 STUN 当成自建 STUN 返回");

    const turn = body.iceServers.find((server) => String(server.urls).includes("turn:"));
    assert.ok(turn, "必须提供自建 TURN");
    // 短期临时凭据：用户名带过期时间，凭据是 HMAC 而不是永久密码。
    assert.match(turn.username, /^\d+:[a-f0-9]+$/);
    assert.ok(turn.credential.length > 0);
    assert.ok(Number(turn.username.split(":")[0]) > Math.floor(Date.now() / 1000), "凭据不能是过期的");
    assert.ok(body.expiresAt > Math.floor(Date.now() / 1000));
  });

  it("really serves the PeerJS signaling endpoints", async () => {
    // 没有固定 ID 的 `new Peer()` 会先 GET /peerjs/id 取一个 ID。
    const idResponse = await fetch(`${baseUrl}/peerjs/id`);
    assert.equal(idResponse.status, 200);
    const id = (await idResponse.text()).trim();
    assert.match(id, /^[a-z0-9-]+$/i);

    // allow_discovery 关闭时 /peers 必须拒绝，否则等于对外暴露全部在线 ID。
    const peersResponse = await fetch(`${baseUrl}/peerjs/peers`);
    assert.equal(peersResponse.status, 401);
  });

  it("rejects unapproved browser Origins", async () => {
    const rejected = await fetch(`${baseUrl}/rtc-config`, { headers: { origin: "https://evil.example" } });
    assert.equal(rejected.status, 403);
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
    if (gateway && gateway.exitCode !== null) throw new Error(`gateway 进程提前退出，退出码 ${gateway.exitCode}`);
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      /* 还没起来，继续等 */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`gateway 在超时前没有就绪：${url}`);
}

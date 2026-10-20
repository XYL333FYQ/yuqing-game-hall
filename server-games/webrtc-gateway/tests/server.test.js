import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

// peer@1.0.2 的 PeerServer 会启动两个自我重排的 setTimeout（连接存活检查与
// 消息队列清理），且没有对外暴露停止方法，因此测试进程不会自己退出。
// 将服务放入独立子进程：关闭 HTTP 服务后结束该进程，让测试进程自然完成
// 客户端资源清理；Windows 下强退曾在断言全部通过后触发原生句柄错误。

const services = [];
const turnSharedSecret = "test-only-turn-secret-that-is-long-enough";
const allowedOrigin = "https://games.example.com";

function testConfig() {
  return {
    production: true,
    host: "127.0.0.1",
    port: 0,
    allowedOrigins: new Set([allowedOrigin]),
    turnPublicHost: "turn.example.com",
    turnPort: 3478,
    turnSharedSecret,
    credentialTtlSeconds: 900,
  };
}

function createTestGateway() {
  const config = testConfig();
  const gateway = spawn(process.execPath, [
    "--input-type=module",
    "--eval",
    `
      import { createWebRtcGateway } from ${JSON.stringify(new URL("../server.js", import.meta.url).href)};
      const config = JSON.parse(process.argv[1]);
      config.allowedOrigins = new Set(config.allowedOrigins);
      const service = createWebRtcGateway({ config });
      process.on("message", async (message) => {
        if (message !== "close") return;
        await service.close();
        process.exit(0);
      });
      process.send({ port: await service.listen() });
    `,
    JSON.stringify({ ...config, allowedOrigins: [...config.allowedOrigins] }),
  ], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
  let stderr = "";
  gateway.stderr.setEncoding("utf8");
  gateway.stderr.on("data", (chunk) => { stderr += chunk; });
  const ready = Promise.race([
    once(gateway, "message", { signal: AbortSignal.timeout(10000) }),
    once(gateway, "exit").then(([code, signal]) => {
      throw new Error(`gateway exited before readiness: ${code ?? signal}\n${stderr}`);
    }),
  ]);
  return {
    async listen() {
      const [{ port }] = await ready;
      assert.ok(Number.isInteger(port) && port > 0);
      return port;
    },
    async close() {
      if (gateway.exitCode !== null || gateway.signalCode !== null) {
        assert.equal(gateway.exitCode, 0, stderr);
        return;
      }
      const exited = once(gateway, "close", { signal: AbortSignal.timeout(10000) });
      try {
        gateway.send("close");
        const [code, signal] = await exited;
        assert.equal(signal, null, stderr);
        assert.equal(code, 0, stderr);
      } finally {
        if (gateway.exitCode === null && gateway.signalCode === null) {
          const stopped = once(gateway, "close");
          gateway.kill();
          await stopped;
        }
      }
    },
  };
}

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.close()));
});

describe("WebRTC gateway", () => {
  it("serves health, PeerJS signaling, and valid short-lived TURN credentials", async () => {
    const service = createTestGateway();
    services.push(service);
    const port = await service.listen();
    const base = `http://127.0.0.1:${port}`;

    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      service: "webrtc-gateway",
      signalingClients: 0,
      signalingPath: "/peerjs",
      turn: { host: "turn.example.com", port: 3478 },
    });

    const rtcResponse = await fetch(`${base}/rtc-config`, { headers: { origin: allowedOrigin } });
    assert.equal(rtcResponse.status, 200);
    assert.equal(rtcResponse.headers.get("access-control-allow-origin"), allowedOrigin);
    assert.equal(rtcResponse.headers.get("cache-control"), "no-store");
    const rtcConfig = await rtcResponse.json();
    // PeerJS 客户端会拼成 `<path>peerjs/id`（HTTP）与 `<path>peerjs`（WebSocket），
    // gateway 挂在根路径，所以 path 必须是 "/"。
    assert.deepEqual(rtcConfig.peer, { path: "/", key: "peerjs" });
    assert.deepEqual(rtcConfig.iceServers[0], { urls: ["stun:turn.example.com:3478"] });
    assert.deepEqual(rtcConfig.iceServers[1].urls, [
      "turn:turn.example.com:3478?transport=udp",
      "turn:turn.example.com:3478?transport=tcp",
    ]);
    assert.match(rtcConfig.iceServers[1].username, /^\d+:[a-f0-9]{16}$/);
    assert.equal(
      rtcConfig.iceServers[1].credential,
      createHmac("sha1", turnSharedSecret).update(rtcConfig.iceServers[1].username).digest("base64"),
    );
    assert.ok(rtcConfig.expiresAt > Math.floor(Date.now() / 1000));

    // 信令必须真的可用：没有固定 ID 的 `new Peer()` 会先请求 /peerjs/id 拿 ID。
    const signalingId = await fetch(`${base}/peerjs/id`);
    assert.equal(signalingId.status, 200);
    assert.match(await signalingId.text(), /^[a-z0-9-]+$/i);

    const discovery = await fetch(`${base}/peerjs/peers`);
    await discovery.text();
    assert.equal(discovery.status, 401);
  });

  it("rejects unapproved origins and originless production credential requests", async () => {
    const service = createTestGateway();
    services.push(service);
    const port = await service.listen();
    const base = `http://127.0.0.1:${port}`;

    const unapproved = await fetch(`${base}/rtc-config`, { headers: { origin: "https://evil.example" } });
    assert.deepEqual(await unapproved.json(), { error: "Origin is not allowed." });
    assert.equal(unapproved.status, 403);

    const originless = await fetch(`${base}/rtc-config`);
    assert.deepEqual(await originless.json(), { error: "Browser Origin is required." });
    assert.equal(originless.status, 403);
  });
});

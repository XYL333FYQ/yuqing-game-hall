import { createHmac, randomBytes } from "node:crypto";
import { realpathSync } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import express from "express";
import { ExpressPeerServer } from "peer";

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

// PeerJS 客户端会用 `path` 拼出 `<path>peerjs/id` 与 `<path>peerjs`。
const PEER_PATH = "/";
const PEER_KEY = "peerjs";

export function createWebRtcGateway(overrides = {}) {
  const config = overrides.config ?? readConfig(process.env);
  const app = express();
  const httpServer = createServer(app);
  let signalingClients = 0;

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const origin = normalizeOrigin(request.headers.origin || "");
    if (origin && !config.allowedOrigins.has(origin) && !config.allowedOrigins.has("*")) {
      response.status(403).set(JSON_HEADERS).json({ error: "Origin is not allowed." });
      return;
    }
    if (origin) {
      response.set("access-control-allow-origin", origin);
      response.set("vary", "Origin");
    }
    response.set("access-control-allow-methods", "GET, OPTIONS");
    response.set("access-control-allow-headers", "content-type");
    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }
    next();
  });

  app.get("/health", (_request, response) => {
    response.set(JSON_HEADERS).json({
      ok: true,
      service: "webrtc-gateway",
      signalingClients,
      signalingPath: "/peerjs",
      turn: { host: config.turnPublicHost, port: config.turnPort },
    });
  });

  app.get("/rtc-config", (request, response) => {
    const origin = normalizeOrigin(request.headers.origin || "");
    if (config.production && !origin) {
      response.status(403).set(JSON_HEADERS).json({ error: "Browser Origin is required." });
      return;
    }
    const expiresAt = Math.floor(Date.now() / 1000) + config.credentialTtlSeconds;
    const username = `${expiresAt}:${randomBytes(8).toString("hex")}`;
    const credential = createHmac("sha1", config.turnSharedSecret).update(username).digest("base64");
    const turnAuthority = `${config.turnPublicHost}:${config.turnPort}`;
    response.set(JSON_HEADERS).json({
      // peer.path 是直接交给 PeerJS 客户端 `path` 选项的值。
      // 客户端会拼成 `<path>peerjs/id`（HTTP）与 `<path>peerjs`（WebSocket），
      // 所以 gateway 必须挂在站点根路径上，这里恒为 "/"。
      peer: { path: PEER_PATH, key: PEER_KEY },
      iceServers: [
        { urls: [`stun:${turnAuthority}`] },
        {
          urls: [
            `turn:${turnAuthority}?transport=udp`,
            `turn:${turnAuthority}?transport=tcp`,
          ],
          username,
          credential,
        },
      ],
      expiresAt,
    });
  });

  // peer@1.x 的 ExpressPeerServer 返回的路由内部自带 `/:key/id` 前缀，
  // 必须挂在根路径上；否则 `/peerjs/id` 会 404（WebSocket 仍能连上，
  // 但所有不带固定 ID 的 `new Peer()` 都会拿不到 ID）。
  const peerServer = ExpressPeerServer(httpServer, {
    path: "/",
    proxied: true,
    allow_discovery: false,
  });
  peerServer.on("connection", () => { signalingClients += 1; });
  peerServer.on("disconnect", () => { signalingClients = Math.max(0, signalingClients - 1); });
  app.use(peerServer);

  return {
    config,
    async listen() {
      await new Promise((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(config.port, config.host, () => {
          httpServer.off("error", reject);
          resolve();
        });
      });
      const address = httpServer.address();
      return typeof address === "object" && address ? address.port : config.port;
    },
    async close() {
      // fetch() 默认使用 keep-alive，不主动断开空闲连接的话 httpServer.close()
      // 永远等不到回调，测试和优雅退出都会卡住。
      httpServer.closeIdleConnections?.();
      httpServer.closeAllConnections?.();
      await new Promise((resolve) => httpServer.close(() => resolve()));
    },
  };
}

export function readConfig(env) {
  const production = env.NODE_ENV === "production";
  const host = String(env.HOST || "127.0.0.1").trim();
  const port = integer(env.PORT || 9000, "PORT", 0, 65535);
  const allowedOrigins = new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map(normalizeOrigin)
      .filter(Boolean),
  );
  const turnPublicHost = String(env.TURN_PUBLIC_HOST || "").trim().toLowerCase();
  const turnPort = integer(env.TURN_PORT || 3478, "TURN_PORT", 1, 65535);
  const turnSharedSecret = String(env.TURN_SHARED_SECRET || "");
  const credentialTtlSeconds = integer(
    env.TURN_CREDENTIAL_TTL_SECONDS || 3600,
    "TURN_CREDENTIAL_TTL_SECONDS",
    300,
    86400,
  );

  if (production && allowedOrigins.size === 0) throw new Error("生产环境必须配置 ALLOWED_ORIGINS。");
  if (!/^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\d{1,3}(?:\.\d{1,3}){3})$/i.test(turnPublicHost)) {
    throw new Error("TURN_PUBLIC_HOST 必须是公开 DNS 主机名或 IPv4 地址。");
  }
  if (turnSharedSecret.length < 32) throw new Error("TURN_SHARED_SECRET 至少需要 32 个字符。");

  return {
    production,
    host,
    port,
    allowedOrigins,
    turnPublicHost,
    turnPort,
    turnSharedSecret,
    credentialTtlSeconds,
  };
}

function normalizeOrigin(value) {
  const trimmed = String(value).trim();
  if (trimmed === "*") return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

function integer(value, name, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} 必须是 ${minimum}–${maximum} 之间的整数。`);
  }
  return parsed;
}

// `node server.js` 直接启动；被 import（测试）时不启动。
// 不能拿 argv[1] 和 import.meta.url 的 pathname 直接比字符串：Windows 上是反斜杠，
// 而且路径里只要有中文（例如本仓库的本地目录）pathname 会被百分号编码，永远比不相等，
// 结果就是进程静默退出、健康检查永远不通过。
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const gateway = createWebRtcGateway();
  const port = await gateway.listen();
  console.log(`WebRTC gateway listening on http://${gateway.config.host}:${port}`);

  const shutdown = async () => {
    await gateway.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

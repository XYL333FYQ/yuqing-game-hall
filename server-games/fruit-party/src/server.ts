import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { isValidRoomCode } from "../../../games/fruit-party/src/shared/protocol";
import { loadServerConfig, resolveAllowedOrigin, type FruitPartyServerConfig } from "./config";
import { createRoomCode, MAX_SOCKET_MESSAGE_BYTES, normalizeMode, RoomError, RoomSession } from "./room";

const MAX_HTTP_BODY_BYTES = 16 * 1024;
const ROOM_TICK_MS = 250;
const SOCKET_HEARTBEAT_MS = 25_000;

export interface FruitPartyService {
  listen(): Promise<number>;
  close(): Promise<void>;
}

export function createFruitPartyService(config: FruitPartyServerConfig): FruitPartyService {
  const rooms = new Map<string, RoomSession>();
  const liveness = new WeakMap<WebSocket, boolean>();
  const webSockets = new WebSocketServer({ noServer: true, maxPayload: MAX_SOCKET_MESSAGE_BYTES, perMessageDeflate: false });
  const httpServer = createServer((request, response) => {
    void handleHttpRequest(request, response, rooms, config).catch((error) => {
      const status = error instanceof RoomError ? error.status : 400;
      const message = error instanceof Error ? error.message : "请求处理失败。";
      writeJson(response, status, { error: message }, resolveAllowedOrigin(request.headers.origin, config));
    });
  });

  httpServer.on("upgrade", (request, socket, head) => {
    const origin = resolveAllowedOrigin(request.headers.origin, config);
    if (origin === null) return rejectUpgrade(socket, 403, "Forbidden");
    const url = requestUrl(request);
    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/socket$/i);
    if (!match || !isValidRoomCode(match[1])) return rejectUpgrade(socket, 404, "Not Found");
    const room = rooms.get(match[1].toUpperCase());
    const playerId = url.searchParams.get("player") ?? "";
    const token = url.searchParams.get("token") ?? "";
    if (!room) return rejectUpgrade(socket, 404, "Not Found");
    if (!room.authorize(playerId, token)) return rejectUpgrade(socket, 401, "Unauthorized");

    webSockets.handleUpgrade(request, socket, head, (webSocket) => {
      liveness.set(webSocket, true);
      room.attach(webSocket, playerId);
      webSocket.on("pong", () => liveness.set(webSocket, true));
      webSocket.on("message", (payload, isBinary) => {
        if (isBinary) {
          webSocket.close(1003, "text messages only");
          return;
        }
        room.handleMessage(webSocket, payload.toString());
      });
      webSocket.on("close", () => room.detach(webSocket));
      webSocket.on("error", () => room.detach(webSocket));
    });
  });

  const roomTimer = setInterval(() => {
    for (const [code, room] of rooms) {
      room.tick();
      if (room.isExpired()) {
        room.close();
        rooms.delete(code);
      }
    }
  }, ROOM_TICK_MS);
  roomTimer.unref();

  const heartbeatTimer = setInterval(() => {
    for (const socket of webSockets.clients) {
      if (liveness.get(socket) === false) {
        socket.terminate();
        continue;
      }
      liveness.set(socket, false);
      socket.ping();
    }
  }, SOCKET_HEARTBEAT_MS);
  heartbeatTimer.unref();

  return {
    listen: () => new Promise((accept, reject) => {
      const onError = (error: Error): void => reject(error);
      httpServer.once("error", onError);
      httpServer.listen(config.port, config.host, () => {
        httpServer.off("error", onError);
        const address = httpServer.address();
        if (!address || typeof address === "string") return reject(new Error("无法读取监听端口。"));
        accept(address.port);
      });
    }),
    close: async () => {
      clearInterval(roomTimer);
      clearInterval(heartbeatTimer);
      for (const room of rooms.values()) room.close();
      rooms.clear();
      for (const socket of webSockets.clients) socket.terminate();
      webSockets.close();
      if (!httpServer.listening) return;
      await new Promise<void>((accept, reject) => httpServer.close((error) => error ? reject(error) : accept()));
    },
  };
}

async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  rooms: Map<string, RoomSession>,
  config: FruitPartyServerConfig,
): Promise<void> {
  const url = requestUrl(request);
  const apiRequest = url.pathname.startsWith("/api/");
  const origin = apiRequest ? resolveAllowedOrigin(request.headers.origin, config) : undefined;
  if (apiRequest && origin === null) {
    writeJson(response, 403, { error: "这个网站来源未获准连接果切多人服务。" }, origin);
    return;
  }
  if (apiRequest && request.method === "OPTIONS") {
    writeEmpty(response, 204, origin);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/health") {
    writeJson(response, 200, { ok: true, service: "fruit-party-multiplayer", rooms: rooms.size }, origin);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/rooms") {
    const input = await readJson(request);
    const code = createRoomCode(rooms);
    const room = new RoomSession(code, normalizeMode(input.mode), String(input.nickname ?? ""));
    rooms.set(code, room);
    writeJson(response, 201, room.hostCredentials(), origin);
    return;
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/join)?$/i);
  if (roomMatch && isValidRoomCode(roomMatch[1])) {
    const room = rooms.get(roomMatch[1].toUpperCase());
    if (!room) throw new RoomError(404, "房间不存在或已经过期。");
    if (request.method === "GET" && !roomMatch[2]) {
      writeJson(response, 200, room.snapshot(), origin);
      return;
    }
    if (request.method === "POST" && roomMatch[2] === "/join") {
      const input = await readJson(request);
      writeJson(response, 201, room.join(String(input.nickname ?? "")), origin);
      return;
    }
  }

  if (apiRequest) writeJson(response, 404, { error: "接口不存在。" }, origin);
  else writeJson(response, 404, { error: "这里只运行果切多人后端；请从 Cloudflare 上的游戏平台打开游戏。" });
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_HTTP_BODY_BYTES) throw new RoomError(413, "请求内容过大。");
    chunks.push(buffer);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new RoomError(400, "请求内容格式错误。");
  }
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
}

function writeJson(response: ServerResponse, status: number, value: unknown, origin?: string | null): void {
  const body = JSON.stringify(value);
  response.writeHead(status, corsHeaders(origin, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  }));
  response.end(body);
}

function writeEmpty(response: ServerResponse, status: number, origin?: string | null): void {
  response.writeHead(status, corsHeaders(origin));
  response.end();
}

function corsHeaders(origin?: string | null, extra: Record<string, string | number> = {}): Record<string, string | number> {
  const headers: Record<string, string | number> = {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extra,
  };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type";
    headers.vary = "Origin";
  }
  return headers;
}

function rejectUpgrade(socket: NodeJS.WritableStream & { destroy(): void }, status: number, label: string): void {
  socket.write(`HTTP/1.1 ${status} ${label}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

async function main(): Promise<void> {
  const config = loadServerConfig();
  const service = createFruitPartyService(config);
  const port = await service.listen();
  console.log(`果切多人服务已监听 http://${config.host}:${port}`);
  const shutdown = async (): Promise<void> => {
    await service.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

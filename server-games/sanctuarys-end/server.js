const { createServer } = require("node:http");
const WebSocket = require("ws");

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8787);
const production = process.env.NODE_ENV === "production";
const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean),
);
const maxClients = 64;
const maxPayload = 16 * 1024;

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT 必须是 1–65535 之间的整数。");
if (production && allowedOrigins.size === 0) throw new Error("生产环境必须配置 ALLOWED_ORIGINS。");

const httpServer = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    const body = JSON.stringify({ ok: true, service: "sanctuary-relay", clients: webSockets.clients.size });
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store",
    });
    response.end(body);
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Sanctuary's End relay only.\n");
});

const webSockets = new WebSocket.Server({ noServer: true, maxPayload, perMessageDeflate: false });
let nextId = 1;

httpServer.on("upgrade", (request, socket, head) => {
  const origin = normalizeOrigin(request.headers.origin || "");
  const localDevelopment = !production && origin && isLoopbackOrigin(origin);
  if (!origin || (!allowedOrigins.has(origin) && !allowedOrigins.has("*") && !localDevelopment)) {
    rejectUpgrade(socket, 403, "Forbidden");
    return;
  }
  const pathname = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`).pathname;
  if (pathname !== "/" && pathname !== "/socket") {
    rejectUpgrade(socket, 404, "Not Found");
    return;
  }
  if (webSockets.clients.size >= maxClients) {
    rejectUpgrade(socket, 503, "Service Unavailable");
    return;
  }
  webSockets.handleUpgrade(request, socket, head, (webSocket) => webSockets.emit("connection", webSocket));
});

webSockets.on("connection", (socket) => {
  const id = nextId++;
  socket.isAlive = true;
  socket.send(JSON.stringify({ t: "welcome", id }));

  socket.on("pong", () => { socket.isAlive = true; });
  socket.on("message", (data, isBinary) => {
    if (isBinary) {
      socket.close(1003, "text messages only");
      return;
    }
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!message || typeof message !== "object" || Array.isArray(message)) return;
    if (message.t !== "state" && message.t !== "chat") return;
    message.id = id;
    broadcast(JSON.stringify(message), socket);
  });
  socket.on("close", () => broadcast(JSON.stringify({ t: "leave", id }), socket));
  socket.on("error", () => undefined);
});

const heartbeat = setInterval(() => {
  for (const socket of webSockets.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 25_000);
heartbeat.unref();

httpServer.listen(port, host, () => console.log(`Sanctuary relay listening on http://${host}:${port}`));

function broadcast(payload, excluded) {
  for (const client of webSockets.clients) {
    if (client !== excluded && client.readyState === WebSocket.OPEN) client.send(payload);
  }
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

function isLoopbackOrigin(origin) {
  const hostname = new URL(origin).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function rejectUpgrade(socket, status, label) {
  socket.write(`HTTP/1.1 ${status} ${label}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

async function shutdown() {
  clearInterval(heartbeat);
  for (const socket of webSockets.clients) socket.terminate();
  webSockets.close();
  httpServer.close(() => process.exit(0));
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

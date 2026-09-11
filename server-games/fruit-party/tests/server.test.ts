import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createFruitPartyService, type FruitPartyService } from "../src/server";
import type { CreateRoomResponse, RoomSnapshot } from "../../../games/fruit-party/src/shared/protocol";

const services: FruitPartyService[] = [];

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.close()));
});

describe("果切 VPS 多人服务", () => {
  it("提供健康检查、建房、加入和 WebSocket 准备流程", async () => {
    const service = createFruitPartyService({
      host: "127.0.0.1",
      port: 0,
      production: true,
      allowedOrigins: new Set(["https://games.example.com"]),
    });
    services.push(service);
    const port = await service.listen();
    const base = `http://127.0.0.1:${port}`;
    const headers = { origin: "https://games.example.com", "content-type": "application/json" };

    const health = await fetch(`${base}/api/health`, { headers });
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, service: "fruit-party-multiplayer" });

    const host = await post<CreateRoomResponse>(`${base}/api/rooms`, { nickname: "玩家甲", mode: "score90" }, headers);
    const guest = await post<CreateRoomResponse>(`${base}/api/rooms/${host.code}/join`, { nickname: "玩家乙" }, headers);
    const hostSocket = await openSocket(port, host);
    const guestSocket = await openSocket(port, guest);
    const replaced = new Promise<number>((accept) => hostSocket.once("close", (code) => accept(code)));
    const replacementSocket = await openSocket(port, host);
    expect(await replaced).toBe(4001);
    const hostStarted = nextSnapshot(replacementSocket, (snapshot) => snapshot.phase === "countdown");
    replacementSocket.send(JSON.stringify({ type: "ready", ready: true }));
    guestSocket.send(JSON.stringify({ type: "ready", ready: true }));
    expect((await hostStarted).players).toHaveLength(2);
    replacementSocket.close();
    guestSocket.close();
  });

  it("拒绝不在白名单中的网页来源", async () => {
    const service = createFruitPartyService({
      host: "127.0.0.1",
      port: 0,
      production: true,
      allowedOrigins: new Set(["https://games.example.com"]),
    });
    services.push(service);
    const port = await service.listen();
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { origin: "https://evil.example" } });
    expect(response.status).toBe(403);
  });
});

async function post<T>(url: string, body: object, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  expect(response.status).toBe(201);
  return await response.json() as T;
}

function openSocket(port: number, credentials: CreateRoomResponse): Promise<WebSocket> {
  return new Promise((accept, reject) => {
    const query = new URLSearchParams({ player: credentials.playerId, token: credentials.token });
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/rooms/${credentials.code}/socket?${query}`, {
      origin: "https://games.example.com",
    });
    socket.once("open", () => accept(socket));
    socket.once("error", reject);
  });
}

function nextSnapshot(socket: WebSocket, predicate: (snapshot: RoomSnapshot) => boolean): Promise<RoomSnapshot> {
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => reject(new Error("等待房间快照超时")), 2_000);
    const onMessage = (payload: WebSocket.RawData): void => {
      const message = JSON.parse(payload.toString()) as RoomSnapshot;
      if (message.type !== "snapshot" || !predicate(message)) return;
      clearTimeout(timer);
      socket.off("message", onMessage);
      accept(message);
    };
    socket.on("message", onMessage);
  });
}

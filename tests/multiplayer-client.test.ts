import { afterEach, expect, it, vi } from "vitest";
import { MultiplayerClient } from "../games/fruit-party/src/network/MultiplayerClient";

vi.mock("../games/fruit-party/src/network/serviceConfig", () => ({
  waitForMultiplayerServiceConfig: async () => {}, multiplayerWebSocketUrl: () => "ws://localhost/socket",
}));

class Socket extends EventTarget {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  constructor() { super(); Socket.instances.push(this); }
  send() {}
  close() { this.readyState = 3; }
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); Socket.instances = []; });

it("does not notify a disposed room when its close or message events arrive late", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("window", { setInterval, clearInterval, setTimeout, clearTimeout });
  const onMessage = vi.fn();
  const onConnection = vi.fn();
  const client = new MultiplayerClient({ code: "ABC234", playerId: "p", token: "t", nickname: "玩家甲" }, onMessage, onConnection);
  client.connect();
  await Promise.resolve();
  const socket = Socket.instances[0];
  socket.dispatchEvent(new Event("open"));
  client.close();
  onMessage.mockClear();
  onConnection.mockClear();
  socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type: "error", message: "old message" }) }));
  socket.dispatchEvent(new Event("close"));
  expect(onMessage).not.toHaveBeenCalled();
  expect(onConnection).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("reports normal disconnects and reconnects while the room is active", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("window", { setInterval, clearInterval, setTimeout, clearTimeout });
  const states = vi.fn();
  const client = new MultiplayerClient({ code: "ABC234", playerId: "p", token: "t", nickname: "玩家甲" }, vi.fn(), states);
  client.connect();
  await Promise.resolve();
  Socket.instances[0].dispatchEvent(new Event("open"));
  Socket.instances[0].dispatchEvent(new Event("close"));
  expect(states).toHaveBeenLastCalledWith("reconnecting");
  await vi.advanceTimersByTimeAsync(1_200);
  expect(Socket.instances).toHaveLength(2);
  Socket.instances[1].dispatchEvent(new Event("open"));
  expect(states).toHaveBeenLastCalledWith("online");
  client.close();
});

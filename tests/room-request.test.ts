import { afterEach, describe, expect, it, vi } from "vitest";
import { roomRequest } from "../public/games/fruit-party/source/network/roomRequest";
import {
  multiplayerWebSocketUrl,
  resolveMultiplayerServiceUrl,
} from "../public/games/fruit-party/source/network/serviceConfig";
import { isRoomCredentials, isValidRoomCode } from "../public/games/fruit-party/source/server/protocol";

afterEach(() => vi.unstubAllGlobals());

describe("room API errors", () => {
  it("replaces a non-JSON backend response with a useful Chinese message", async () => {
    stubGameWindow();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(roomRequest("/api/rooms", {})).rejects.toThrow("没有返回房间 API");
  });

  it("distinguishes an unavailable backend from a client validation error", async () => {
    stubGameWindow("http://127.0.0.1:8790");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("connection refused"); }));
    await expect(roomRequest("/api/rooms", {})).rejects.toThrow("无法连接果切多人服务（http://127.0.0.1:8790）");
  });

  it("uses the configured service and returns valid room credentials", async () => {
    stubGameWindow("https://rooms.example/fruit-service");
    const payload = { code: "ABC234", playerId: "player", token: "token", nickname: "玩家甲" };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(roomRequest("/api/rooms", {})).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://rooms.example/fruit-service/api/rooms",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("multiplayer service URLs", () => {
  it("defaults to the game page origin", () => {
    expect(resolveMultiplayerServiceUrl(undefined, "https://games.example/sub/index.html").href).toBe("https://games.example/");
  });

  it("keeps an explicit path prefix and derives the WebSocket protocol", () => {
    stubGameWindow("https://rooms.example/fruit-service");
    expect(multiplayerWebSocketUrl("/api/rooms/ABC234/socket?player=p")).toBe(
      "wss://rooms.example/fruit-service/api/rooms/ABC234/socket?player=p",
    );
  });

  it("rejects non-HTTP service addresses", () => {
    expect(() => resolveMultiplayerServiceUrl("ftp://rooms.example", "https://games.example/")).toThrow("http:// 或 https://");
  });
});

describe("room code format", () => {
  it("matches the server generator and rejects ambiguous characters", () => {
    expect(isValidRoomCode("ABC234")).toBe(true);
    expect(isValidRoomCode("abc234")).toBe(true);
    expect(isValidRoomCode("ABC123")).toBe(false);
    expect(isValidRoomCode("ABCI23")).toBe(false);
    expect(isValidRoomCode("ABCO23")).toBe(false);
  });

  it("rejects corrupt or mismatched credential shapes", () => {
    expect(isRoomCredentials({ code: "ABC234", playerId: "p", token: "t", nickname: "玩家甲" })).toBe(true);
    expect(isRoomCredentials({ code: "ABC234", playerId: "", token: "t", nickname: "玩家甲" })).toBe(false);
    expect(isRoomCredentials({ code: "ABC123", playerId: "p", token: "t", nickname: "玩家甲" })).toBe(false);
    expect(isRoomCredentials({ code: "ABC234", playerId: "p", token: "t", nickname: "甲" })).toBe(false);
  });
});

function stubGameWindow(multiplayerServiceUrl = ""): void {
  vi.stubGlobal("window", {
    location: { href: "https://games.example/index.html" },
    FRUIT_PARTY_CONFIG: { multiplayerServiceUrl },
  });
}

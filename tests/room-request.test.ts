import { afterEach, describe, expect, it, vi } from "vitest";
import { roomRequest } from "../public/games/fruit-party/source/network/roomRequest";
import { isRoomCredentials, isValidRoomCode } from "../public/games/fruit-party/source/server/protocol";

afterEach(() => vi.unstubAllGlobals());

describe("room API errors", () => {
  it("replaces a non-JSON backend response with a useful Chinese message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(roomRequest("/api/rooms", {})).rejects.toThrow("请重新运行 corepack pnpm dev:cloudflare");
  });

  it("returns valid room credentials", async () => {
    const payload = { code: "ABC234", playerId: "player", token: "token", nickname: "玩家甲" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), {
      status: 201,
      headers: { "content-type": "application/json" },
    })));
    await expect(roomRequest("/api/rooms", {})).resolves.toEqual(payload);
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

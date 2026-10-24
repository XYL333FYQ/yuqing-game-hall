import { afterEach, describe, expect, it, vi } from "vitest";
import type WebSocket from "ws";
import { RoomSession } from "../src/room";
import { generateMatchSchedule } from "../../../games/fruit-party/src/shared/match";

afterEach(() => vi.restoreAllMocks());

describe("survival outcome uses actual miss times", () => {
  it.each(["neither", "host", "guest"])("settles late ticks fairly when %s saved the first fruit", (saved) => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const room = new RoomSession("ABC234", "survival", "玩家甲");
    const host = room.hostCredentials();
    const guest = room.join("玩家乙");
    const socket = () => ({ readyState: 1, send() {}, close() {} }) as unknown as WebSocket;
    const hostSocket = socket();
    const guestSocket = socket();
    room.attach(hostSocket, host.playerId);
    room.attach(guestSocket, guest.playerId);
    room.handleMessage(hostSocket, JSON.stringify({ type: "ready", ready: true }));
    room.handleMessage(guestSocket, JSON.stringify({ type: "ready", ready: true }));
    const state = (room as any).state;
    state.seed = 42;
    const fruit = generateMatchSchedule(42, state.durationMs).filter(item => !item.isBomb)
      .sort((a, b) => a.launchAtMs + a.flightMs - b.launchAtMs - b.flightMs);
    if (saved !== "neither") state.players[saved === "host" ? 0 : 1].slicedIds.push(fruit[0].id);
    now = state.startAt + fruit[5].launchAtMs + fruit[5].flightMs + 351;
    room.tick();
    const snapshot = room.snapshot();
    expect(snapshot.phase).toBe("finished");
    if (saved === "neither") {
      expect(snapshot.result).toMatchObject({ reason: "draw" });
      expect(snapshot.result?.winnerId).toBeUndefined();
    } else {
      expect(snapshot.result?.winnerId).toBe(saved === "host" ? host.playerId : guest.playerId);
    }
  });
});

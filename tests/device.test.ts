import { afterEach, describe, expect, it, vi } from "vitest";
import { canPlayGame, canPlayGames } from "../src/platform/device";

const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

function mockWindow(width: number, height: number, precisePointer: boolean): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      innerWidth: width,
      innerHeight: height,
      matchMedia: vi.fn().mockReturnValue({ matches: precisePointer }),
    },
  });
}

describe("desktop play gate", () => {
  it("allows a computer-sized viewport with any precise pointer", () => {
    mockWindow(1_280, 720, true);
    expect(canPlayGames()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith("(any-hover: hover) and (any-pointer: fine)");
  });

  it("blocks narrow screens and coarse-only devices", () => {
    mockWindow(390, 844, true);
    expect(canPlayGames()).toBe(false);
    mockWindow(1_280, 720, false);
    expect(canPlayGames()).toBe(false);
  });
});

describe("game-aware play gate", () => {
  it("allows touch and mobile games even on phone viewports without hover", () => {
    mockWindow(390, 844, false);
    expect(canPlayGame({ devices: ["mobile"], inputs: ["touch"] })).toBe(true);
    expect(canPlayGame({ devices: ["desktop", "mobile"], inputs: ["keyboard", "touch"] })).toBe(true);
    expect(canPlayGame({ inputs: ["touch"] })).toBe(true);
  });

  it("still enforces desktop gate for keyboard/mouse only games on phones", () => {
    mockWindow(390, 844, false);
    expect(canPlayGame({ devices: ["desktop"], inputs: ["keyboard", "mouse"] })).toBe(false);
    expect(canPlayGame(null)).toBe(false);
  });

  it("allows keyboard/mouse only games on computer viewports", () => {
    mockWindow(1_280, 720, true);
    expect(canPlayGame({ devices: ["desktop"], inputs: ["keyboard", "mouse"] })).toBe(true);
  });
});

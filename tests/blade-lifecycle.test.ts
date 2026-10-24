import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FruitNinjaEngine } from "../games/fruit-party/src/FruitNinjaEngine";
import { fruitTypeByName } from "../games/fruit-party/src/data/fruits";
import type { Fruit, FruitNinjaState } from "../games/fruit-party/src/types";

describe("blade samples between animation frames", () => {
  let engine: FruitNinjaEngine;
  let state: FruitNinjaState;
  let now: number;
  let nextFrame: FrameRequestCallback;

  beforeEach(() => {
    now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    vi.stubGlobal("Image", class { addEventListener() {} });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { nextFrame = callback; return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const canvas = {
      getContext: () => ({ setTransform() {} }), style: {},
      parentElement: { getBoundingClientRect: () => ({ width: 800, height: 450 }) },
    } as unknown as HTMLCanvasElement;
    engine = new FruitNinjaEngine(canvas);
    // Rendering is outside this input/physics test; run the real engine loop.
    vi.spyOn(engine as any, "render").mockImplementation(() => {});
    engine.beginGame({ mode: "endless", countdownMs: 0 });
    state = engine.getState() as FruitNinjaState;
    state.launchTimer = 1_000_000;
    state.nextBombAtMs = 1_000_000;
    engine.startLoop();
  });

  afterEach(() => {
    engine?.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function target(id = 1, x = 100): Fruit {
    const fruit: Fruit = {
      id, x, y: 200, type: fruitTypeByName("orange"), vx: 0, vy: 0,
      rotation: 0, rotationSpeed: 0, sliced: false, isBomb: false,
    };
    state.fruits.push(fruit);
    return fruit;
  }

  function stroke() {
    engine.setBladeActive("pointer-0", true, 40, 200, now);
    engine.updateBlade("pointer-0", 160, 200, now + 8, 15_000, 15_000, 0, true);
  }

  function frame() { now += 16; nextFrame(now); }

  it.each(["release", "hover", "hide", "repress"])("consumes a quick stroke once after %s before RAF", (ending) => {
    const fruit = target();
    const bridge = target(2, 300);
    stroke();
    engine.setBladeActive("pointer-0", false, 160, 200, now + 9);
    if (ending === "hover") engine.updateBlade("pointer-0", 400, 200, now + 10, 0, 0, 0, false);
    if (ending === "hide") engine.hideBlade("pointer-0");
    if (ending === "repress") engine.setBladeActive("pointer-0", true, 400, 200, now + 10);
    frame();
    expect(fruit.sliced).toBe(true);
    expect(bridge.sliced).toBe(false);
    const score = state.score;
    target(3);
    frame();
    expect(state.score).toBe(score);
  });

  it("preserves all coalesced segments without connecting separate strokes", () => {
    const first = target();
    const middle = target(2, 280);
    const last = target(3, 500);
    stroke();
    engine.setBladeActive("pointer-0", false, 160, 200, now + 9);
    engine.setBladeActive("pointer-0", true, 400, 200, now + 10);
    engine.updateBlade("pointer-0", 460, 200, now + 12, 15_000, 15_000, 0, true);
    engine.updateBlade("pointer-0", 560, 200, now + 14, 15_000, 15_000, 0, true);
    frame();
    expect([first.sliced, middle.sliced, last.sliced]).toEqual([true, false, true]);
  });

  it.each(["toggle", "explicit"])("discards pending and paused input when pausing via %s", (method) => {
    const fruit = target();
    stroke();
    if (method === "toggle") engine.togglePause(); else engine.setPaused(true);
    frame();
    expect(fruit.sliced).toBe(false);
    stroke();
    if (method === "toggle") engine.togglePause(); else engine.setPaused(false);
    frame();
    expect(fruit.sliced).toBe(false);
    stroke();
    frame();
    expect(fruit.sliced).toBe(true);
  });

  it("does not replay countdown gestures after the round starts", () => {
    const fruit = target();
    state.countdownTimer = 1;
    stroke();
    frame();
    frame();
    expect(fruit.sliced).toBe(false);
    stroke();
    frame();
    expect(fruit.sliced).toBe(true);
  });

  it("bounds retained hover samples", () => {
    for (let index = 0; index < 200; index++) {
      engine.updateBlade("pointer-0", index, 200, now + index, 0, 0, 0, false);
    }
    expect(state.blades[0].points.length).toBeLessThanOrEqual(72);
  });
});

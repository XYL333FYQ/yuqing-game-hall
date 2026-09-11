import { afterEach, describe, expect, it, vi } from "vitest";
import { fruitRadiusForInstance, fruitTypeByName } from "../games/fruit-party/src/data/fruits";
import { FruitSystem } from "../games/fruit-party/src/systems/FruitSystem";
import { initialBombDelayForSeed } from "../games/fruit-party/src/FruitNinjaEngine";
import type { Fruit, FruitNinjaState } from "../games/fruit-party/src/types";

function endlessState(): FruitNinjaState {
  return {
    fruits: [],
    halves: [],
    particles: [],
    wallSplatters: [],
    slashBursts: [],
    floatingLabels: [],
    blades: [],
    score: 20,
    highScore: 20,
    combo: 0,
    comboTimer: 0,
    lives: 3,
    gameOver: false,
    started: true,
    paused: false,
    nextId: 1,
    launchTimer: -1,
    nextBombAtMs: 8_000,
    bombsLaunched: 0,
    wavesLaunched: 5,
    endlessTier: 0,
    countdownTimer: 0,
    elapsedMs: 6_900,
    wave: 2,
    width: 1_280,
    height: 720,
    lastSliceLabel: "",
    lastSliceLabelTimer: 0,
    mode: "endless",
    rules: {
      startingLives: 3,
      missesCostLife: true,
      bombPenalty: 0,
      bombEndsGame: true,
    },
    seed: 42,
    schedule: [],
    nextScheduledIndex: 0,
    shake: 0,
  };
}

function activeFruit(
  id: number,
  x: number,
  y: number,
  options: { isBomb?: boolean; vx?: number; vy?: number } = {},
): Fruit {
  const isBomb = options.isBomb ?? false;
  return {
    id,
    type: fruitTypeByName(isBomb ? "bomb" : "orange"),
    x,
    y,
    vx: options.vx ?? 0,
    vy: options.vy ?? 0,
    rotation: 0,
    rotationSpeed: 0,
    sliced: false,
    isBomb,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("endless bomb placement and difficulty", () => {
  it("spreads opening bombs across a broad per-round time window", () => {
    const delays = Array.from({ length: 64 }, (_, seed) => initialBombDelayForSeed(seed + 1));
    expect(Math.min(...delays)).toBeLessThan(6_400);
    expect(Math.max(...delays)).toBeGreaterThan(12_800);
    expect(new Set(delays.map((delay) => Math.round(delay / 250))).size).toBeGreaterThan(20);
  });

  it("announces each twenty-five-second difficulty step without revealing bombs", () => {
    const state = endlessState();
    state.elapsedMs = 30_000;
    state.nextBombAtMs = 99_000;
    state.launchTimer = 1;
    new FruitSystem().update(state, 16);

    expect(state.endlessTier).toBe(1);
    expect(state.lastSliceLabel).toBe("难度 2  ·  加速");
    expect(state.lastSliceLabelTimer).toBeGreaterThan(1_400);
    expect(state.fruits.some((candidate) => candidate.isBomb)).toBe(false);
  });

  it("recycles moving half arrays in place during dense play", () => {
    const state = endlessState();
    state.launchTimer = 10;
    state.nextBombAtMs = 99_000;
    state.halves.push({
      type: fruitTypeByName("orange"),
      x: 400,
      y: 300,
      vx: 40,
      vy: -120,
      rotation: 0,
      rotationSpeed: 2,
      side: -1,
      alpha: 1,
    });
    const halves = state.halves;

    new FruitSystem().update(state, 16);

    expect(state.halves).toBe(halves);
    expect(state.halves).toHaveLength(1);
  });

  it("keeps normal fruit flowing before an unannounced bomb", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const state = endlessState();
    new FruitSystem().update(state, 16);

    expect(state.fruits.length).toBeGreaterThan(0);
    expect(state.fruits.some((fruit) => fruit.isBomb)).toBe(false);
  });

  it("can launch a bomb through the center without adding a scripted opposite-side wave", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const state = endlessState();
    state.elapsedMs = 8_000;
    new FruitSystem().update(state, 16);

    const bomb = state.fruits.find((fruit) => fruit.isBomb)!;
    expect(bomb).toBeDefined();
    expect(bomb.x / state.width).toBeCloseTo(0.5, 2);
    expect(state.fruits).toHaveLength(1);
    expect(state.bombsLaunched).toBe(1);
  });

  it("uses the full horizontal playfield instead of fixed bomb rails", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.08);
    const leftState = endlessState();
    leftState.elapsedMs = 8_000;
    new FruitSystem().update(leftState, 16);
    const leftBomb = leftState.fruits.find((fruit) => fruit.isBomb)!;

    random.mockReturnValue(0.92);
    const rightState = endlessState();
    rightState.elapsedMs = 8_000;
    new FruitSystem().update(rightState, 16);
    const rightBomb = rightState.fruits.find((fruit) => fruit.isBomb)!;

    expect(leftBomb.x / leftState.width).toBeLessThan(0.2);
    expect(rightBomb.x / rightState.width).toBeGreaterThan(0.8);
  });

  it("rejects an overlapping random path and retries elsewhere", () => {
    let calls = 0;
    vi.spyOn(Math, "random").mockImplementation(() => calls++ < 6 ? 0.5 : 0.08);
    const state = endlessState();
    state.elapsedMs = 8_000;
    state.fruits = [activeFruit(90, state.width * 0.5, state.height + 75, { vy: -1_150 })];
    new FruitSystem().update(state, 16);

    const bomb = state.fruits.find((fruit) => fruit.isBomb)!;
    expect(bomb).toBeDefined();
    expect(bomb.x / state.width).toBeLessThan(0.25);
  });

  it("delays the bomb if every sampled path would overlap", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const state = endlessState();
    state.elapsedMs = 8_000;
    state.fruits = [activeFruit(90, state.width * 0.5, state.height + 75, { vy: -1_150 })];
    new FruitSystem().update(state, 16);

    expect(state.fruits.some((fruit) => fruit.isBomb)).toBe(false);
    expect(state.nextBombAtMs).toBeGreaterThan(8_000);
    expect(state.nextBombAtMs).toBeLessThanOrEqual(8_420);
  });

  it("increases fruit density, horizontal speed, and spawn rate over survival time", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const early = endlessState();
    early.elapsedMs = 0;
    early.nextBombAtMs = 99_000;
    const late = endlessState();
    late.elapsedMs = 120_000;
    late.nextBombAtMs = 199_000;

    const system = new FruitSystem();
    system.update(early, 16);
    system.update(late, 16);

    expect(early.fruits).toHaveLength(2);
    expect(late.fruits).toHaveLength(6);
    expect(Math.abs(late.fruits[0].vx)).toBeGreaterThan(Math.abs(early.fruits[0].vx));
    expect(late.launchTimer).toBeLessThan(early.launchTimer);
  });

  it("keeps randomized bomb and fruit paths separated in a three-minute stress run", () => {
    let seed = 0x1a2b3c4d;
    vi.spyOn(Math, "random").mockImplementation(() => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed / 0x1_0000_0000;
    });
    const state = endlessState();
    state.elapsedMs = 0;
    state.nextBombAtMs = 7_000;
    state.launchTimer = 0;
    const system = new FruitSystem();
    const bombLaunchTimes: number[] = [];
    const bombStartRatios: number[] = [];
    let previousBombCount = 0;
    let closestGap = Number.POSITIVE_INFINITY;

    for (let frame = 0; frame < 9_000; frame += 1) {
      state.elapsedMs += 20;
      system.update(state, 20);
      if (state.bombsLaunched > previousBombCount) {
        const newestBomb = state.fruits.filter((fruit) => fruit.isBomb).at(-1)!;
        bombLaunchTimes.push(state.elapsedMs);
        bombStartRatios.push(newestBomb.x / state.width);
        previousBombCount = state.bombsLaunched;
      }
      const bombs = state.fruits.filter((fruit) => fruit.isBomb);
      const fruit = state.fruits.filter((candidate) => !candidate.isBomb);
      for (const bomb of bombs) {
        for (const target of fruit) {
          closestGap = Math.min(
            closestGap,
            Math.hypot(bomb.x - target.x, bomb.y - target.y)
              - fruitRadiusForInstance(bomb, state.width, state.height)
              - fruitRadiusForInstance(target, state.width, state.height),
          );
        }
      }
    }

    const intervals = bombLaunchTimes.slice(1).map((time, index) => time - bombLaunchTimes[index]);
    const midpoint = Math.floor(intervals.length / 2);
    const earlyAverage = intervals.slice(0, midpoint)
      .reduce((total, interval) => total + interval, 0) / midpoint;
    const lateAverage = intervals.slice(midpoint)
      .reduce((total, interval) => total + interval, 0) / (intervals.length - midpoint);
    expect(state.bombsLaunched).toBeGreaterThan(20);
    expect(closestGap).toBeGreaterThan(33);
    expect(bombStartRatios.some((ratio) => ratio < 0.35)).toBe(true);
    expect(bombStartRatios.some((ratio) => ratio >= 0.35 && ratio <= 0.65)).toBe(true);
    expect(bombStartRatios.some((ratio) => ratio > 0.65)).toBe(true);
    expect(new Set(intervals.map((interval) => Math.round(interval / 100))).size).toBeGreaterThan(8);
    expect(lateAverage).toBeLessThan(earlyAverage);
  });
});

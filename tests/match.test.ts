import { describe, expect, it } from "vitest";
import {
  fruitPosition,
  fruitRadius,
  generateMatchSchedule,
  getRoundRules,
  scheduledFruitClearance,
  validateSliceClaim,
} from "../public/games/fruit-party/source/server/match";
import { firstRelevantScheduleIndex } from "../public/games/fruit-party/source/FruitNinjaEngine";

describe("deterministic multiplayer schedule", () => {
  it("produces the same fruit stream for the same seed", () => {
    const first = generateMatchSchedule(20260828, 90_000);
    const second = generateMatchSchedule(20260828, 90_000);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(80);
  });

  it("changes the stream when the seed changes", () => {
    expect(generateMatchSchedule(1, 60_000)).not.toEqual(generateMatchSchedule(2, 60_000));
  });

  it("keeps fruit positions normalized and resolution independent", () => {
    const fruit = generateMatchSchedule(42, 20_000)[0];
    const position = fruitPosition(fruit, fruit.launchAtMs + fruit.flightMs / 2);
    expect(position).toBeDefined();
    expect(position!.x).toBeGreaterThanOrEqual(0);
    expect(position!.x).toBeLessThanOrEqual(1);
    expect(position!.y).toBeCloseTo(fruit.peakY, 5);
  });

  it("skips expired fruit when a player reconnects in the middle of a round", () => {
    const schedule = generateMatchSchedule(42, 90_000);
    const elapsedMs = 35_000;
    const index = firstRelevantScheduleIndex(schedule, elapsedMs);
    expect(schedule.slice(0, index).every((fruit) => fruit.launchAtMs + fruit.flightMs < elapsedMs)).toBe(true);
    expect(schedule[index].launchAtMs + schedule[index].flightMs).toBeGreaterThanOrEqual(elapsedMs);
  });

  it("keeps the first bomb out of the opening and increases hazard frequency later", () => {
    const schedule = generateMatchSchedule(20260828, 150_000);
    const bombs = schedule.filter((fruit) => fruit.isBomb);
    expect(bombs.length).toBeGreaterThanOrEqual(18);
    expect(bombs[0].launchAtMs).toBeGreaterThanOrEqual(8_000);
    expect(bombs[0].launchAtMs).toBeLessThanOrEqual(10_000);
    const intervals = bombs.slice(1).map((bomb, index) => bomb.launchAtMs - bombs[index].launchAtMs);
    const early = intervals.filter((_, index) => bombs[index].launchAtMs < 45_000);
    const late = intervals.filter((_, index) => bombs[index].launchAtMs >= 90_000);
    const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(Math.min(...intervals)).toBeGreaterThan(3_900);
    expect(Math.max(...intervals)).toBeLessThan(11_000);
    expect(average(late)).toBeLessThan(average(early));
  });

  it("keeps every random online bomb clear of fruit hit circles across seeds", () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const schedule = generateMatchSchedule(seed, 180_000);
      for (let firstIndex = 0; firstIndex < schedule.length; firstIndex += 1) {
        const first = schedule[firstIndex];
        for (let secondIndex = firstIndex + 1; secondIndex < schedule.length; secondIndex += 1) {
          const second = schedule[secondIndex];
          if (first.isBomb === second.isBomb) continue;
          if (second.launchAtMs > first.launchAtMs + first.flightMs) break;
          expect(scheduledFruitClearance(first, second, { width: 960, height: 540 })).toBeGreaterThanOrEqual(9.5);
          expect(scheduledFruitClearance(first, second, { width: 1_440, height: 900 })).toBeGreaterThanOrEqual(9.5);
        }
      }
    }
  });

  it("scales targets up for large playfields without unbounded growth", () => {
    expect(fruitRadius("orange", { width: 1280, height: 720 })).toBe(65);
    expect(fruitRadius("orange", { width: 1920, height: 1080 })).toBeCloseTo(79.3, 1);
    expect(fruitRadius("bomb", { width: 1280, height: 720 })).toBeGreaterThan(fruitRadius("orange", { width: 1280, height: 720 }));
  });
});

describe("server slice validation", () => {
  it("accepts a fast segment crossing the scheduled fruit", () => {
    const fruit = generateMatchSchedule(77, 30_000)[0];
    const atMs = fruit.launchAtMs + fruit.flightMs / 2;
    const position = fruitPosition(fruit, atMs)!;
    expect(validateSliceClaim(fruit, {
      fruitId: fruit.id,
      atMs,
      durationMs: 16,
      start: { x: position.x - 0.08, y: position.y },
      end: { x: position.x + 0.08, y: position.y },
    })).toBe(true);
  });

  it("rejects a slow or distant claim", () => {
    const fruit = generateMatchSchedule(77, 30_000)[0];
    const atMs = fruit.launchAtMs + fruit.flightMs / 2;
    expect(validateSliceClaim(fruit, {
      fruitId: fruit.id,
      atMs,
      durationMs: 120,
      start: { x: 0, y: 0 },
      end: { x: 0.01, y: 0.01 },
    })).toBe(false);
  });
});

describe("match rule presets", () => {
  it("implements all three agreed formats", () => {
    expect(getRoundRules("score90")).toMatchObject({ durationMs: 90_000, missesCostLife: false, bombPenalty: 10 });
    expect(getRoundRules("bestOf3")).toMatchObject({ durationMs: 60_000, missesCostLife: false, bombPenalty: 10 });
    expect(getRoundRules("survival")).toMatchObject({ durationMs: 300_000, missesCostLife: true, bombEndsRound: true });
    expect(getRoundRules("score90", true).durationMs).toBe(20_000);
  });
});

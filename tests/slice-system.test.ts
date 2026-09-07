import { describe, expect, it, vi } from "vitest";
import { BOMB_TYPE, fruitTypeByName } from "../public/games/fruit-party/source/data/fruits";
import { addMissFeedback, fastForwardScheduledState, firstRelevantScheduleIndex, scaleGameStateToViewport } from "../public/games/fruit-party/source/FruitNinjaEngine";
import { SliceSystem } from "../public/games/fruit-party/source/systems/SliceSystem";
import type { BladeState, Fruit, FruitNinjaState, GameEvent } from "../public/games/fruit-party/source/types";
import { generateMatchSchedule } from "../public/games/fruit-party/source/server/match";

const orange = fruitTypeByName("orange");

function fruit(id: number, x: number, type = orange): Fruit {
  return {
    id,
    type,
    x,
    y: 200,
    vx: 0,
    vy: 0,
    rotation: 0,
    rotationSpeed: 0,
    sliced: false,
    isBomb: type.name === "bomb",
  };
}

function blade(points: Array<{ x: number; time: number }>): BladeState {
  return {
    id: "pointer-0",
    color: "#fff",
    visible: true,
    active: true,
    lastSeen: 0,
    lastProcessedSequence: -1,
    nextSequence: points.length,
    targetX: 0,
    targetY: 0,
    renderX: 0,
    renderY: 0,
    velocityX: 0,
    velocityY: 0,
    targetSpeed: 2_000,
    sampleTime: points.at(-1)?.time ?? 0,
    sampleInterval: 8,
    initialized: true,
    points: points.map((point, sequence) => ({
      x: point.x,
      y: 200,
      time: point.time,
      speed: sequence === 0 ? 0 : 2_000,
      sequence,
      active: true,
    })),
  };
}

function state(
  fruits: Fruit[],
  input: Partial<FruitNinjaState> = {},
): FruitNinjaState {
  return {
    fruits,
    halves: [],
    particles: [],
    wallSplatters: [],
    slashBursts: [],
    floatingLabels: [],
    blades: [blade([{ x: 40, time: 0 }, { x: 360, time: 16 }])],
    score: 0,
    highScore: 0,
    combo: 0,
    comboTimer: 0,
    lives: 3,
    gameOver: false,
    started: true,
    paused: false,
    nextId: 10,
    launchTimer: 1,
    nextBombAtMs: 8_500,
    bombsLaunched: 0,
    wavesLaunched: 1,
    endlessTier: 0,
    countdownTimer: 0,
    elapsedMs: 2_000,
    wave: 0,
    width: 800,
    height: 450,
    lastSliceLabel: "",
    lastSliceLabelTimer: 0,
    mode: "endless",
    rules: {
      startingLives: 3,
      missesCostLife: true,
      bombPenalty: 0,
      bombEndsGame: true,
    },
    schedule: [],
    nextScheduledIndex: 0,
    shake: 0,
    ...input,
  };
}

describe("slice collision and scoring", () => {
  it("processes every raw segment once instead of skipping between frames", () => {
    const events: GameEvent[] = [];
    const game = state([fruit(1, 100), fruit(2, 280)], {
      blades: [blade([
        { x: 40, time: 0 },
        { x: 160, time: 8 },
        { x: 340, time: 16 },
      ])],
    });
    const system = new SliceSystem((event) => events.push(event));

    system.update(game, 16);
    expect(game.score).toBe(2);
    expect(events).toHaveLength(2);
    expect(game.blades[0].lastProcessedSequence).toBe(2);

    system.update(game, 16);
    expect(game.score).toBe(2);
    expect(events).toHaveLength(2);
  });

  it("applies the classic three-fruit multi-slice bonus", () => {
    const game = state([fruit(1, 100), fruit(2, 200), fruit(3, 300)]);
    new SliceSystem().update(game, 16);

    expect(game.score).toBe(9);
    expect(game.combo).toBe(3);
    expect(game.lastSliceLabel).toBe("3 连斩");
    expect(game.halves).toHaveLength(6);
  });

  it("separates cut halves across the actual blade normal", () => {
    const game = state([fruit(1, 180)]);
    new SliceSystem().update(game, 16);

    expect(game.halves).toHaveLength(2);
    expect(game.halves[0].vy).toBeLessThan(-100);
    expect(game.halves[1].vy).toBeGreaterThan(40);
    expect(game.halves[0].vy).not.toBe(game.halves[1].vy);
  });

  it("shows local score feedback and retires it without leaking labels", () => {
    const game = state([fruit(1, 180)]);
    const system = new SliceSystem();
    system.update(game, 16);

    expect(game.floatingLabels).toHaveLength(1);
    expect(game.floatingLabels[0].text).toBe("+1");
    system.update(game, 1_100);
    expect(game.floatingLabels).toHaveLength(0);
  });

  it("ends endless mode immediately when a bomb is cut", () => {
    const game = state([fruit(1, 180, BOMB_TYPE)]);
    new SliceSystem().update(game, 16);
    expect(game.gameOver).toBe(true);
    expect(game.gameOverReason).toBe("bomb");
  });

  it("deducts ten points without ending an online score match", () => {
    const onEvent = vi.fn();
    const game = state([fruit(1, 180, BOMB_TYPE)], {
      mode: "score90",
      score: 6,
      rules: {
        durationMs: 90_000,
        startingLives: 3,
        missesCostLife: false,
        bombPenalty: 10,
        bombEndsGame: false,
      },
    });
    new SliceSystem(onEvent).update(game, 16);

    expect(game.score).toBe(0);
    expect(game.gameOver).toBe(false);
    expect(onEvent.mock.calls[0][0].scoreDelta).toBe(-6);
  });
});

describe("viewport scaling", () => {
  it("keeps live objects and blade samples in the same normalized positions", () => {
    const game = state([fruit(1, 100)]);
    game.fruits[0].y = 120;
    game.fruits[0].vx = 40;
    game.fruits[0].vy = -80;
    game.floatingLabels.push({
      x: 200,
      y: 90,
      vy: -30,
      text: "+1",
      color: "#fff",
      life: 1,
      maxLife: 1,
      emphasis: 1,
    });

    scaleGameStateToViewport(game, 1_600, 900);

    expect(game.fruits[0]).toMatchObject({ x: 200, y: 240, vx: 80, vy: -160 });
    expect(game.blades[0].points.at(-1)).toMatchObject({ x: 720, y: 400 });
    expect(game.floatingLabels[0]).toMatchObject({ x: 400, y: 180, vy: -60 });
    expect(game.width).toBe(1_600);
    expect(game.height).toBe(900);
  });
});

describe("miss feedback", () => {
  it("coalesces a multi-miss into one honest warmup message", () => {
    const game = state([]);
    addMissFeedback(game, 300, 3, 0);
    expect(game.floatingLabels).toHaveLength(1);
    expect(game.floatingLabels[0].text).toBe("热身漏切 3 个  ·  不扣命");
  });

  it("does not show failure feedback for misses with no rule consequence", () => {
    const game = state([], {
      mode: "score90",
      rules: { durationMs: 90_000, startingLives: 0, missesCostLife: false, bombPenalty: 10, bombEndsGame: false },
    });
    addMissFeedback(game, 300, 2, 0);
    expect(game.floatingLabels).toEqual([]);
  });
});

describe("multiplayer clock recovery", () => {
  it("fast-forwards a throttled scheduled game without replaying expired fruit", () => {
    const schedule = generateMatchSchedule(42, 90_000);
    const game = state([fruit(999, 200)], {
      mode: "score90",
      elapsedMs: 2_000,
      rules: { durationMs: 90_000, startingLives: 0, missesCostLife: false, bombPenalty: 10, bombEndsGame: false },
      schedule,
      nextScheduledIndex: 1,
    });

    expect(fastForwardScheduledState(game, 35_000)).toBe(true);
    expect(game.elapsedMs).toBe(35_000);
    expect(game.fruits).toEqual([]);
    expect(game.nextScheduledIndex).toBe(firstRelevantScheduleIndex(schedule, 35_000));
    expect(fastForwardScheduledState(game, 35_150)).toBe(false);
  });
});

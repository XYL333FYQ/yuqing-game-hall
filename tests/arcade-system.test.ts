import { describe, expect, it, vi } from "vitest";
import { BOMB_TYPE, fruitRadiusForInstance, fruitTypeByName } from "../public/games/fruit-party/source/data/fruits";
import { applyMissPenalty } from "../public/games/fruit-party/source/FruitNinjaEngine";
import { ArcadeSystem, arcadePhaseForTime, createArcadeState, getArcadeGrade, recordArcadeMiss, recordArcadeSlice, selectArcadeEvents } from "../public/games/fruit-party/source/systems/ArcadeSystem";
import { SliceSystem } from "../public/games/fruit-party/source/systems/SliceSystem";
import type { BladeState, Fruit, FruitNinjaState } from "../public/games/fruit-party/source/types";

function makeFruit(id: number, x = 200, type = fruitTypeByName("orange")): Fruit {
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

function blade(time = 16): BladeState {
  return {
    id: "pointer-0",
    color: "#fff",
    visible: true,
    active: true,
    lastSeen: 0,
    lastProcessedSequence: -1,
    nextSequence: 2,
    targetX: 360,
    targetY: 200,
    renderX: 360,
    renderY: 200,
    velocityX: 20_000,
    velocityY: 0,
    targetSpeed: 20_000,
    sampleTime: time,
    sampleInterval: 16,
    initialized: true,
    points: [
      { x: 40, y: 200, time: time - 16, speed: 0, sequence: 0, active: true },
      { x: 360, y: 200, time, speed: 20_000, sequence: 1, active: true },
    ],
  };
}

function state(seed = 20260828, width = 800, height = 450): FruitNinjaState {
  return {
    fruits: [],
    halves: [],
    particles: [],
    wallSplatters: [],
    slashBursts: [],
    floatingLabels: [],
    blades: [],
    score: 0,
    highScore: 0,
    combo: 0,
    comboTimer: 0,
    lives: 0,
    gameOver: false,
    started: true,
    paused: false,
    nextId: 1,
    launchTimer: 0,
    nextBombAtMs: 0,
    bombsLaunched: 0,
    wavesLaunched: 0,
    endlessTier: 0,
    countdownTimer: 0,
    elapsedMs: 0,
    wave: 0,
    width,
    height,
    lastSliceLabel: "",
    lastSliceLabelTimer: 0,
    mode: "arcade",
    rules: {
      durationMs: 90_000,
      startingLives: 0,
      missesCostLife: false,
      bombPenalty: 10,
      bombEndsGame: false,
    },
    seed,
    schedule: [],
    nextScheduledIndex: 0,
    shake: 0,
    arcade: createArcadeState(seed, "2026-08-28"),
  };
}

describe("90-second arcade timeline", () => {
  it("maps every agreed boundary to the correct phase", () => {
    expect(arcadePhaseForTime(0).phase).toBe("warmup");
    expect(arcadePhaseForTime(12_000)).toMatchObject({ phase: "event", eventIndex: 0 });
    expect(arcadePhaseForTime(30_000).phase).toBe("transition");
    expect(arcadePhaseForTime(36_000)).toMatchObject({ phase: "event", eventIndex: 1 });
    expect(arcadePhaseForTime(54_000).phase).toBe("transition");
    expect(arcadePhaseForTime(60_000)).toMatchObject({ phase: "event", eventIndex: 2 });
    expect(arcadePhaseForTime(78_000).phase).toBe("boss-warning");
    expect(arcadePhaseForTime(80_000).phase).toBe("boss");
  });

  it("selects three unique reproducible events", () => {
    const first = selectArcadeEvents(42);
    expect(first).toEqual(selectArcadeEvents(42));
    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
  });

  it("spawns a reproducible stream across resolutions and a giant fruit at 80 seconds", () => {
    const small = state(77, 1280, 720);
    const large = state(77, 1600, 900);
    const system = new ArcadeSystem();
    system.update(small, 0);
    system.update(large, 0);
    small.elapsedMs = large.elapsedMs = 1_000;
    system.update(small, 16);
    system.update(large, 16);
    expect(small.fruits.map((fruit) => fruit.type.name)).toEqual(large.fruits.map((fruit) => fruit.type.name));

    const bossRound = state(77);
    bossRound.elapsedMs = 80_000;
    system.update(bossRound, 16);
    expect(bossRound.fruits).toHaveLength(1);
    expect(bossRound.fruits[0]).toMatchObject({ variant: "boss", bossMaxHits: 8, radiusScale: 2.25 });
  });

  it.each([[960, 600], [1_440, 900]])(
    "keeps the thread-gap target outside every bomb hit circle at %d×%d",
    (width, height) => {
      const game = state(77, width, height);
      game.elapsedMs = 12_000;
      game.arcade!.eventOrder[0] = "thread-gap";
      game.arcade!.nextSpawnAtMs = 0;
      const system = new ArcadeSystem();
      system.update(game, 0);
      game.elapsedMs = 12_180;
      system.update(game, 0);

      const target = game.fruits.find((candidate) => !candidate.isBomb)!;
      const bombs = game.fruits.filter((candidate) => candidate.isBomb);
      expect(target).toBeDefined();
      expect(bombs).toHaveLength(3);
      for (const bomb of bombs) {
        const laneDistance = Math.abs(bomb.y - target.y);
        const collisionDistance = (
          fruitRadiusForInstance(bomb, width, height)
          + fruitRadiusForInstance(target, width, height)
        ) * 1.12;
        expect(laneDistance - collisionDistance).toBeGreaterThanOrEqual(25);
      }
    },
  );

  it("rotates precision targets through separated lanes instead of stacking them", () => {
    const game = state(91, 1_440, 900);
    game.elapsedMs = 36_000;
    game.arcade!.eventOrder[1] = "precision";
    const system = new ArcadeSystem();
    system.update(game, 0);
    game.elapsedMs = 36_180;
    system.update(game, 0);
    expect(game.fruits).toHaveLength(1);
    const firstX = game.fruits[0].x;

    game.elapsedMs = game.arcade!.nextSpawnAtMs;
    system.update(game, 0);
    expect(game.fruits).toHaveLength(2);
    expect(Math.abs(game.fruits[1].x - firstX)).toBeGreaterThan(game.width * 0.16);
  });
});

describe("arcade scoring and objectives", () => {
  it("awards a +2 perfect-cut bonus at the required center and speed", () => {
    const game = state();
    game.fruits = [makeFruit(1)];
    game.blades = [blade()];
    const onEvent = vi.fn();
    new SliceSystem(onEvent).update(game, 16);
    expect(game.score).toBe(3);
    expect(game.arcade?.perfectSlices).toBe(1);
    expect(onEvent.mock.calls.find((call) => call[0].type === "slice")?.[0]).toMatchObject({ perfect: true, multiCount: 1 });
  });

  it("charges fever, reduces it on misses, and clears it on bombs", () => {
    const game = state();
    const target = makeFruit(1);
    game.arcade!.fever = 96;
    const outcome = recordArcadeSlice(game, {
      fruit: target,
      isBomb: false,
      perfect: false,
      multiCount: 1,
      countsMultiBonus: true,
    });
    expect(outcome.feverActivated).toBe(true);
    expect(game.arcade?.feverTimer).toBe(6_000);
    expect(game.arcade?.feverActivations).toBe(1);

    game.arcade!.feverTimer = 0;
    game.arcade!.fever = 40;
    recordArcadeMiss(game);
    expect(game.arcade?.fever).toBe(28);
    game.score = 15;
    game.fruits = [makeFruit(2, 200, BOMB_TYPE)];
    game.blades = [blade(32)];
    new SliceSystem().update(game, 16);
    expect(game.score).toBe(5);
    expect(game.gameOver).toBe(false);
    expect(game.arcade?.fever).toBe(0);
  });

  it("automatically chains a fully charged fever when the prior burst ends", () => {
    const game = state();
    game.arcade!.feverTimer = 16;
    game.arcade!.fever = 100;
    const onEvent = vi.fn();
    new ArcadeSystem(onEvent).update(game, 16);
    expect(game.arcade?.feverTimer).toBe(6_000);
    expect(game.arcade?.fever).toBe(0);
    expect(game.arcade?.feverActivations).toBe(1);
    expect(onEvent).toHaveBeenCalledWith({ type: "arcade-cue", cue: "fever" });
  });

  it("keeps a daily challenge completed after later score penalties", () => {
    const game = state();
    game.arcade!.dailyChallenge = {
      dateKey: "2026-08-28",
      kind: "score",
      target: 160,
      title: "今日高分",
      description: "街机模式达到 160 分",
    };
    game.score = 160;
    recordArcadeSlice(game, {
      fruit: makeFruit(1),
      isBomb: false,
      perfect: false,
      multiCount: 1,
      countsMultiBonus: true,
    });
    expect(game.arcade?.dailyCompleted).toBe(true);
    game.score = 150;
    recordArcadeSlice(game, {
      fruit: makeFruit(2, 200, BOMB_TYPE),
      isBomb: true,
      perfect: false,
      multiCount: 0,
      countsMultiBonus: false,
    });
    expect(game.arcade?.dailyCompleted).toBe(true);
  });

  it("never ends arcade on a miss while classic still uses three lives", () => {
    const arcade = state();
    arcade.arcade!.fever = 30;
    applyMissPenalty(arcade);
    expect(arcade.gameOver).toBe(false);
    expect(arcade.lives).toBe(0);
    expect(arcade.arcade?.fever).toBe(18);

    const classic = state();
    classic.mode = "endless";
    classic.arcade = undefined;
    classic.elapsedMs = 12_000;
    classic.lives = 1;
    classic.rules = {
      startingLives: 3,
      missesCostLife: true,
      bombPenalty: 0,
      bombEndsGame: true,
    };
    applyMissPenalty(classic);
    expect(classic.gameOverReason).toBe("lives");
  });

  it("counts event goals once per qualifying slash", () => {
    const game = state();
    game.arcade!.phase = "event";
    game.arcade!.activeEventId = "combo-array";
    const target = makeFruit(1);
    for (let index = 0; index < 3; index += 1) {
      recordArcadeSlice(game, {
        fruit: target,
        isBomb: false,
        perfect: false,
        multiCount: 3,
        countsMultiBonus: true,
      });
    }
    expect(game.arcade?.eventProgress["combo-array"]).toBe(3);
    expect(game.arcade?.completedEventIds).toEqual(["combo-array"]);
  });

  it("requires eight independently timed hits and awards the giant finish bonus", () => {
    const game = state();
    const boss = makeFruit(1, 200, fruitTypeByName("watermelon"));
    Object.assign(boss, {
      variant: "boss",
      motion: "hover",
      radiusScale: 2.25,
      bossHits: 0,
      bossMaxHits: 8,
      lastHitAtMs: -Infinity,
    });
    game.fruits = [boss];
    game.arcade!.phase = "boss";
    for (let index = 0; index < 8; index += 1) {
      game.elapsedMs = index * 150;
      game.blades = [blade(16 + index * 150)];
      new SliceSystem().update(game, 16);
    }
    expect(boss.bossHits).toBe(8);
    expect(boss.sliced).toBe(true);
    expect(game.arcade?.bossCompleted).toBe(true);
    expect(game.score).toBe(41);
    expect(game.halves).toHaveLength(4);
  });

  it("uses the agreed grade thresholds", () => {
    expect(getArcadeGrade(219)).toBe("A");
    expect(getArcadeGrade(220)).toBe("S");
    expect(getArcadeGrade(150)).toBe("A");
    expect(getArcadeGrade(90)).toBe("B");
    expect(getArcadeGrade(89)).toBe("C");
  });
});

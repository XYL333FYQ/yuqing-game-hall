import { createSeededRandom, hashSeed } from "../shared/match";
import { BOMB_TYPE, FRUIT_TYPES, fruitRadiusForViewport, fruitTypeByName } from "../data/fruits";
import type {
  ArcadeEventId,
  ArcadePhase,
  ArcadeState,
  DailyChallenge,
  Fruit,
  FruitNinjaState,
  GameEvent,
} from "../types";
import { GRAVITY } from "../types";

export const ARCADE_DURATION_MS = 90_000;
export const ARCADE_BOSS_HITS = 8;
export const ARCADE_EVENT_DEFINITIONS: Record<ArcadeEventId, { label: string; hint: string; goal: number }> = {
  "combo-array": { label: "连斩阵列", hint: "完成三次一刀多切", goal: 3 },
  precision: { label: "精准时刻", hint: "从中心完成六次完美切", goal: 6 },
  "fruit-rain": { label: "果雨来袭", hint: "切中十五颗下落水果", goal: 15 },
  "thread-gap": { label: "穿针引线", hint: "避开障碍，切中五颗目标", goal: 5 },
};

const ALL_EVENTS = Object.keys(ARCADE_EVENT_DEFINITIONS) as ArcadeEventId[];

export interface ArcadePhaseDescriptor {
  phase: ArcadePhase;
  startMs: number;
  endMs: number;
  eventIndex: number;
  token: string;
}

export interface ArcadeSliceOutcome {
  feverActivated: boolean;
  eventCompleted: boolean;
}

export class ArcadeSystem {
  constructor(private readonly onEvent?: (event: GameEvent) => void) {}

  update(state: FruitNinjaState, dt: number): void {
    const arcade = state.arcade;
    if (state.mode !== "arcade" || !arcade) return;

    const feverWasActive = arcade.feverTimer > 0;
    arcade.feverTimer = Math.max(0, arcade.feverTimer - dt);
    if (feverWasActive && arcade.feverTimer === 0 && arcade.fever >= 100) {
      arcade.fever = 0;
      arcade.feverTimer = 6_000;
      arcade.feverActivations += 1;
      arcade.announcement = "狂热续燃 · 再来 6 秒";
      arcade.announcementTimer = 1_400;
      this.onEvent?.({ type: "arcade-cue", cue: "fever" });
    }
    arcade.announcementTimer = Math.max(0, arcade.announcementTimer - dt);
    const descriptor = arcadePhaseForTime(state.elapsedMs);
    if (descriptor.token !== arcade.phaseToken) this.enterPhase(state, descriptor);

    if (descriptor.phase === "boss" && arcade.bossFruitId === undefined) this.spawnBoss(state);
    if (descriptor.phase === "boss-warning" || descriptor.phase === "boss") return;

    let safety = 0;
    while (state.elapsedMs >= arcade.nextSpawnAtMs && safety < 5) {
      this.spawnPattern(state, descriptor);
      const interval = this.spawnInterval(state, descriptor);
      arcade.nextSpawnAtMs += interval;
      if (arcade.nextSpawnAtMs < state.elapsedMs - interval * 2) arcade.nextSpawnAtMs = state.elapsedMs + interval;
      safety += 1;
    }
  }

  private enterPhase(state: FruitNinjaState, descriptor: ArcadePhaseDescriptor): void {
    const arcade = state.arcade!;
    arcade.phase = descriptor.phase;
    arcade.phaseStartedAtMs = descriptor.startMs;
    arcade.phaseToken = descriptor.token;
    arcade.activeEventIndex = descriptor.eventIndex;
    arcade.activeEventId = descriptor.phase === "event"
      ? arcade.eventOrder[descriptor.eventIndex]
      : undefined;
    arcade.patternIndex = 0;
    arcade.nextSpawnAtMs = Math.max(state.elapsedMs + 180, descriptor.startMs + 180);

    // Challenges read more clearly when stale hazards cannot leak into the next phase.
    state.fruits = state.fruits.filter((fruit) => fruit.variant === "boss");
    if (descriptor.phase === "event" && arcade.activeEventId) {
      const definition = ARCADE_EVENT_DEFINITIONS[arcade.activeEventId];
      arcade.announcement = `${definition.label} · ${definition.hint}`;
      arcade.announcementTimer = 1_900;
      this.onEvent?.({ type: "arcade-cue", cue: "event" });
    } else if (descriptor.phase === "warmup") {
      arcade.announcement = "热身阶段 · 先找准刀感";
      arcade.announcementTimer = 1_800;
    } else if (descriptor.phase === "transition") {
      arcade.announcement = "换气时间 · 普通水果";
      arcade.announcementTimer = 1_150;
    } else if (descriptor.phase === "boss-warning") {
      arcade.announcement = "巨型水果即将入场";
      arcade.announcementTimer = 2_000;
      state.shake = Math.max(state.shake, 0.45);
      this.onEvent?.({ type: "arcade-cue", cue: "boss-warning" });
    } else if (descriptor.phase === "boss") {
      arcade.announcement = "终局巨果 · 连切八刀";
      arcade.announcementTimer = 1_900;
    }
  }

  private spawnPattern(state: FruitNinjaState, descriptor: ArcadePhaseDescriptor): void {
    const arcade = state.arcade!;
    const eventId = arcade.activeEventId;
    if (descriptor.phase === "warmup" || descriptor.phase === "transition" || !eventId) {
      this.spawnFreeWave(state, descriptor.phase === "warmup" ? 1 : 2);
    } else if (eventId === "combo-array") {
      this.spawnComboArray(state);
    } else if (eventId === "precision") {
      this.spawnPrecisionTargets(state);
    } else if (eventId === "fruit-rain") {
      this.spawnFruitRain(state);
    } else {
      this.spawnThreadGap(state);
    }
    arcade.patternIndex += 1;
  }

  private spawnInterval(state: FruitNinjaState, descriptor: ArcadePhaseDescriptor): number {
    let interval = 1_180;
    if (descriptor.phase === "warmup") interval = 1_320;
    if (descriptor.phase === "transition") interval = 1_080;
    const eventId = state.arcade?.activeEventId;
    if (eventId === "combo-array") interval = 2_050;
    if (eventId === "precision") interval = 1_050;
    if (eventId === "fruit-rain") interval = 780;
    if (eventId === "thread-gap") interval = 2_250;
    return interval * ((state.arcade?.feverTimer ?? 0) > 0 ? 0.65 : 1);
  }

  private randomFor(state: FruitNinjaState, suffix: string): () => number {
    const arcade = state.arcade!;
    return createSeededRandom(`${state.seed}:${arcade.phaseToken}:${arcade.patternIndex}:${suffix}`);
  }

  private spawnFreeWave(state: FruitNinjaState, maximum: number): void {
    const random = this.randomFor(state, "free");
    const count = 1 + Math.floor(random() * maximum);
    for (let index = 0; index < count; index += 1) {
      this.pushBallistic(state, random, false);
    }
  }

  private spawnComboArray(state: FruitNinjaState): void {
    const random = this.randomFor(state, "combo");
    const pattern = state.arcade!.patternIndex % 3;
    const count = 4 + Math.floor(random() * 2);
    const bombIndex = pattern === 2
      || state.arcade!.feverTimer > 0
      || state.arcade!.patternIndex === 0
      ? -1
      : Math.floor(random() * count);
    for (let index = 0; index < count; index += 1) {
      const t = count === 1 ? 0.5 : index / (count - 1);
      const isBomb = index === bombIndex;
      if (pattern === 0) {
        this.pushBallistic(state, random, isBomb, {
          startX: 0.12 + t * 0.76,
          targetX: 0.14 + t * 0.72,
          peakY: 0.34,
          flightTime: 1.62,
        });
      } else if (pattern === 1) {
        this.pushBallistic(state, random, isBomb, {
          startX: 0.12 + t * 0.76,
          targetX: 0.14 + t * 0.72,
          peakY: 0.2 + Math.abs(t - 0.5) * 0.3,
          flightTime: 1.7,
        });
      } else {
        this.pushBallistic(state, random, isBomb, {
          startX: 0.47 + (random() - 0.5) * 0.06,
          targetX: 0.16 + t * 0.68,
          peakY: 0.18 + Math.abs(t - 0.5) * 0.2,
          flightTime: 1.58,
        });
      }
    }
  }

  private spawnPrecisionTargets(state: FruitNinjaState): void {
    const random = this.randomFor(state, "precision");
    const lanes = [0.13, 0.31, 0.5, 0.69, 0.87];
    const laneIndex = state.arcade!.patternIndex % lanes.length;
    const lane = lanes[laneIndex];
    const inwardDirection = lane < 0.5 ? 1 : lane > 0.5 ? -1 : (state.arcade!.patternIndex % 2 ? -1 : 1);
    this.pushBallistic(state, random, false, {
      startX: lane,
      targetX: Math.min(0.88, Math.max(0.12, lane + inwardDirection * (0.035 + random() * 0.025))),
      peakY: 0.17 + (laneIndex % 3) * 0.075,
      flightTime: 1.68 + random() * 0.12,
      eventId: "precision",
      perfectTarget: true,
    });
  }

  private spawnFruitRain(state: FruitNinjaState): void {
    const random = this.randomFor(state, "rain");
    const count = 3 + Math.floor(random() * 2);
    const laneWidth = 0.82 / count;
    for (let index = 0; index < count; index += 1) {
      const isBomb = state.arcade!.feverTimer <= 0 && random() < 0.09;
      const type = isBomb ? BOMB_TYPE : FRUIT_TYPES[Math.floor(random() * FRUIT_TYPES.length)];
      const radius = fruitRadiusForViewport(type, state.width, state.height);
      state.fruits.push({
        id: state.nextId++,
        type,
        x: state.width * (
          0.09
          + (index + 0.5) * laneWidth
          + (random() - 0.5) * laneWidth * 0.04
        ),
        y: -radius * (1.2 + random()),
        vx: (random() - 0.5) * 70,
        vy: 270 + random() * 150,
        rotation: random() * Math.PI * 2,
        rotationSpeed: (random() - 0.5) * 5,
        sliced: false,
        isBomb,
        motion: "rain",
        variant: isBomb ? "normal" : "event-target",
        eventId: "fruit-rain",
      });
    }
  }

  private spawnThreadGap(state: FruitNinjaState): void {
    const random = this.randomFor(state, "thread");
    const fromLeft = random() > 0.5;
    const targetType = FRUIT_TYPES[Math.floor(random() * FRUIT_TYPES.length)];
    const targetRadius = fruitRadiusForViewport(targetType, state.width, state.height);
    const bombRadius = fruitRadiusForViewport(BOMB_TYPE, state.width, state.height);
    const safeOffset = (targetRadius + bombRadius) * 1.12 + 26;
    const edgePadding = bombRadius + 12;
    const minimumGapY = edgePadding + safeOffset;
    const maximumGapY = state.height - edgePadding - safeOffset;
    const gapY = maximumGapY > minimumGapY
      ? minimumGapY + random() * (maximumGapY - minimumGapY)
      : state.height * 0.5;
    const direction = fromLeft ? 1 : -1;
    state.fruits.push({
      id: state.nextId++,
      type: targetType,
      x: fromLeft ? -80 : state.width + 80,
      y: gapY,
      vx: direction * (310 + random() * 90),
      vy: 0,
      rotation: random() * Math.PI * 2,
      rotationSpeed: direction * 2.5,
      sliced: false,
      isBomb: false,
      motion: "linear",
      variant: "event-target",
      eventId: "thread-gap",
      expiresAtMs: state.elapsedMs + 3_800,
    });

    if (state.arcade!.feverTimer > 0) return;
    const bombCount = 3;
    for (let index = 0; index < bombCount; index += 1) {
      const x = state.width * (0.28 + index * 0.22);
      const side = index % 2 === 0 ? -1 : 1;
      state.fruits.push({
        id: state.nextId++,
        type: BOMB_TYPE,
        x,
        y: gapY + side * safeOffset,
        vx: 0,
        vy: 0,
        rotation: random() * Math.PI * 2,
        rotationSpeed: side * 1.6,
        sliced: false,
        isBomb: true,
        motion: "hover",
        variant: "normal",
        expiresAtMs: state.elapsedMs + 2_650,
      });
    }
  }

  private pushBallistic(
    state: FruitNinjaState,
    random: () => number,
    requestedBomb: boolean,
    options: {
      startX?: number;
      targetX?: number;
      peakY?: number;
      flightTime?: number;
      eventId?: ArcadeEventId;
      perfectTarget?: boolean;
    } = {},
  ): void {
    const isBomb = requestedBomb && state.arcade!.feverTimer <= 0;
    const type = isBomb ? BOMB_TYPE : FRUIT_TYPES[Math.floor(random() * FRUIT_TYPES.length)];
    const radius = fruitRadiusForViewport(type, state.width, state.height);
    const startX = options.startX ?? 0.1 + random() * 0.8;
    const targetX = options.targetX ?? 0.2 + random() * 0.6;
    const x = startX * state.width;
    const y = state.height + radius * 1.15;
    const flightTime = options.flightTime ?? 1.38 + random() * 0.42;
    const peakY = state.height * (options.peakY ?? 0.15 + random() * 0.27);
    state.fruits.push({
      id: state.nextId++,
      type,
      x,
      y,
      vx: (targetX * state.width - x) / flightTime,
      vy: -(Math.sqrt(2 * GRAVITY * (y - peakY)) || 650),
      rotation: random() * Math.PI * 2,
      rotationSpeed: (random() - 0.5) * 6,
      sliced: false,
      isBomb,
      motion: "ballistic",
      variant: options.eventId ? "event-target" : "normal",
      eventId: options.eventId,
      perfectTarget: options.perfectTarget,
    });
  }

  private spawnBoss(state: FruitNinjaState): void {
    const arcade = state.arcade!;
    const boss: Fruit = {
      id: state.nextId++,
      type: fruitTypeByName("watermelon"),
      x: state.width * 0.5,
      y: state.height * 0.48,
      vx: 0,
      vy: 0,
      rotation: -0.12,
      rotationSpeed: 0.18,
      sliced: false,
      isBomb: false,
      motion: "hover",
      variant: "boss",
      radiusScale: 2.25,
      bossHits: 0,
      bossMaxHits: ARCADE_BOSS_HITS,
      lastHitAtMs: -Infinity,
    };
    arcade.bossFruitId = boss.id;
    arcade.bossHits = 0;
    state.fruits.push(boss);
    state.shake = Math.max(state.shake, 0.65);
  }
}

export function createArcadeState(seed: string | number, dateKey = localDateKey()): ArcadeState {
  const eventOrder = selectArcadeEvents(seed);
  return {
    phase: "warmup",
    phaseStartedAtMs: 0,
    phaseToken: "",
    eventOrder,
    activeEventIndex: -1,
    eventProgress: {
      "combo-array": 0,
      precision: 0,
      "fruit-rain": 0,
      "thread-gap": 0,
    },
    completedEventIds: [],
    nextSpawnAtMs: 0,
    patternIndex: 0,
    fever: 0,
    feverTimer: 0,
    feverActivations: 0,
    perfectSlices: 0,
    maxMultiSlice: 0,
    bombHits: 0,
    bossHits: 0,
    bossMaxHits: ARCADE_BOSS_HITS,
    bossCompleted: false,
    dailyChallenge: createDailyChallenge(dateKey),
    dailyCompleted: false,
    announcement: "",
    announcementTimer: 0,
  };
}

export function arcadePhaseForTime(elapsedMs: number): ArcadePhaseDescriptor {
  if (elapsedMs < 12_000) return phase("warmup", 0, 12_000, -1);
  if (elapsedMs < 30_000) return phase("event", 12_000, 30_000, 0);
  if (elapsedMs < 36_000) return phase("transition", 30_000, 36_000, 0);
  if (elapsedMs < 54_000) return phase("event", 36_000, 54_000, 1);
  if (elapsedMs < 60_000) return phase("transition", 54_000, 60_000, 1);
  if (elapsedMs < 78_000) return phase("event", 60_000, 78_000, 2);
  if (elapsedMs < 80_000) return phase("boss-warning", 78_000, 80_000, 2);
  return phase("boss", 80_000, ARCADE_DURATION_MS, 2);
}

export function selectArcadeEvents(seed: string | number): ArcadeEventId[] {
  const random = createSeededRandom(`${seed}:arcade-events`);
  const pool = [...ALL_EVENTS];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, 3);
}

export function recordArcadeSlice(
  state: FruitNinjaState,
  input: {
    isBomb: boolean;
    perfect: boolean;
    multiCount: number;
    countsMultiBonus: boolean;
    fruit: Fruit;
  },
): ArcadeSliceOutcome {
  const arcade = state.arcade;
  if (!arcade) return { feverActivated: false, eventCompleted: false };
  arcade.maxMultiSlice = Math.max(arcade.maxMultiSlice, input.multiCount);

  if (input.isBomb) {
    arcade.fever = 0;
    arcade.feverTimer = 0;
    arcade.bombHits += 1;
    arcade.announcement = "炸弹命中 · 狂热清空";
    arcade.announcementTimer = 950;
    arcade.dailyCompleted ||= evaluateDailyChallenge(state);
    return { feverActivated: false, eventCompleted: false };
  }

  arcade.fever = Math.min(
    100,
    arcade.fever + 4 + (input.perfect ? 4 : 0) + (input.countsMultiBonus && input.multiCount >= 3 ? 12 : 0),
  );
  if (input.perfect) arcade.perfectSlices += 1;

  let eventCompleted = false;
  const eventId = arcade.phase === "event" ? arcade.activeEventId : undefined;
  if (eventId) {
    let increment = 0;
    if (eventId === "combo-array" && input.countsMultiBonus && input.multiCount >= 3) increment = 1;
    if (eventId === "precision" && input.perfect && input.fruit.perfectTarget) increment = 1;
    if (eventId === "fruit-rain" && input.fruit.eventId === eventId) increment = 1;
    if (eventId === "thread-gap" && input.fruit.eventId === eventId) increment = 1;
    if (increment > 0) {
      const definition = ARCADE_EVENT_DEFINITIONS[eventId];
      arcade.eventProgress[eventId] = Math.min(definition.goal, arcade.eventProgress[eventId] + increment);
      if (
        arcade.eventProgress[eventId] >= definition.goal
        && !arcade.completedEventIds.includes(eventId)
      ) {
        arcade.completedEventIds.push(eventId);
        arcade.announcement = `${definition.label} · 挑战完成`;
        arcade.announcementTimer = 1_450;
        eventCompleted = true;
      }
    }
  }

  let feverActivated = false;
  if (arcade.fever >= 100 && arcade.feverTimer <= 0) {
    arcade.fever = 0;
    arcade.feverTimer = 6_000;
    arcade.feverActivations += 1;
    arcade.announcement = "狂热爆发 · 6 秒双倍";
    arcade.announcementTimer = 1_550;
    feverActivated = true;
  }
  arcade.dailyCompleted ||= evaluateDailyChallenge(state);
  return { feverActivated, eventCompleted };
}

export function recordArcadeMiss(state: FruitNinjaState): void {
  if (!state.arcade) return;
  state.arcade.fever = Math.max(0, state.arcade.fever - 12);
  state.arcade.dailyCompleted ||= evaluateDailyChallenge(state);
}

export function getArcadeGrade(score: number): "S" | "A" | "B" | "C" {
  if (score >= 220) return "S";
  if (score >= 150) return "A";
  if (score >= 90) return "B";
  return "C";
}

export function createDailyChallenge(dateKey: string): DailyChallenge {
  const kindIndex = hashSeed(`${dateKey}:daily`) % 5;
  if (kindIndex === 0) return { dateKey, kind: "score", target: 160, title: "今日高分", description: "街机模式达到 160 分" };
  if (kindIndex === 1) return { dateKey, kind: "perfect", target: 10, title: "中心猎手", description: "完成 10 次完美切" };
  if (kindIndex === 2) return { dateKey, kind: "events", target: 3, title: "全能选手", description: "完成本局全部 3 个事件" };
  if (kindIndex === 3) return { dateKey, kind: "fever", target: 2, title: "热力全开", description: "触发 2 次狂热爆发" };
  return { dateKey, kind: "clean-boss", target: 1, title: "干净收尾", description: "不碰炸弹并击破巨果" };
}

export function evaluateDailyChallenge(state: FruitNinjaState): boolean {
  const arcade = state.arcade;
  if (!arcade) return false;
  const challenge = arcade.dailyChallenge;
  if (challenge.kind === "score") return state.score >= challenge.target;
  if (challenge.kind === "perfect") return arcade.perfectSlices >= challenge.target;
  if (challenge.kind === "events") return arcade.completedEventIds.length >= challenge.target;
  if (challenge.kind === "fever") return arcade.feverActivations >= challenge.target;
  return arcade.bossCompleted && arcade.bombHits === 0;
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function phase(
  phaseName: ArcadePhase,
  startMs: number,
  endMs: number,
  eventIndex: number,
): ArcadePhaseDescriptor {
  return {
    phase: phaseName,
    startMs,
    endMs,
    eventIndex,
    token: `${phaseName}:${startMs}`,
  };
}


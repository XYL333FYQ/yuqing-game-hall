/**
 * Segment/circle slicing and fruit split physics adapted from
 * forinda/canvas-games (MIT). Pointer samples are processed individually so
 * high-frequency coalesced input cannot skip fruit between render frames.
 */
import { createSeededRandom } from "../server/match";
import { fruitRadiusForInstance } from "../data/fruits";
import { addJuiceImpact, MAX_JUICE_PARTICLES, updateJuiceEffects } from "../effects/JuiceEffects";
import {
  evaluateDailyChallenge,
  recordArcadeSlice,
} from "./ArcadeSystem";
import type {
  BladeState,
  Fruit,
  FruitHalf,
  FruitNinjaState,
  GameEvent,
  SlicePoint,
} from "../types";
import {
  COMBO_WINDOW,
  MIN_SLICE_SPEED,
  PARTICLE_COUNT,
  PERFECT_SLICE_SPEED,
} from "../types";

export class SliceSystem {
  private readonly hitBuffer: Fruit[] = [];

  constructor(private readonly onEvent?: (event: GameEvent) => void) {}

  update(state: FruitNinjaState, dt: number): void {
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) state.combo = 0;
    state.lastSliceLabelTimer = Math.max(0, state.lastSliceLabelTimer - dt);
    updateJuiceEffects(state, dt);
    const dtSec = dt / 1000;
    let burstWriteIndex = 0;
    for (let index = 0; index < state.slashBursts.length; index += 1) {
      const burst = state.slashBursts[index];
      burst.life -= dtSec;
      if (burst.life > 0) state.slashBursts[burstWriteIndex++] = burst;
    }
    state.slashBursts.length = burstWriteIndex;
    let labelWriteIndex = 0;
    for (let index = 0; index < state.floatingLabels.length; index += 1) {
      const label = state.floatingLabels[index];
      label.life -= dtSec;
      label.y += label.vy * dtSec;
      label.vy *= Math.pow(0.18, dtSec);
      if (label.life > 0) state.floatingLabels[labelWriteIndex++] = label;
    }
    state.floatingLabels.length = labelWriteIndex;

    for (const blade of state.blades) this.processBlade(state, blade);
  }

  private processBlade(state: FruitNinjaState, blade: BladeState): void {
    if (!blade.visible || blade.points.length < 2) return;
    for (let index = 1; index < blade.points.length; index += 1) {
      const start = blade.points[index - 1];
      const end = blade.points[index];
      if (end.sequence <= blade.lastProcessedSequence) continue;
      blade.lastProcessedSequence = end.sequence;
      if (!start.active || !end.active) continue;
      if (end.speed < MIN_SLICE_SPEED || end.time - start.time > 140) continue;
      this.processSegment(state, start, end);
    }
  }

  private processSegment(state: FruitNinjaState, start: SlicePoint, end: SlicePoint): void {
    const hits = this.hitBuffer;
    hits.length = 0;
    for (const fruit of state.fruits) {
      if (
        !fruit.sliced
        && segmentIntersectsCircle(
          start,
          end,
          fruit.x,
          fruit.y,
          fruitRadiusForInstance(fruit, state.width, state.height) * 1.12,
        )
      ) hits.push(fruit);
    }
    let multiSlice = 0;
    for (const fruit of hits) {
      if (!fruit.isBomb) multiSlice += 1;
    }
    let multiBonusAvailable = true;
    const durationMs = Math.max(1, end.time - start.time);
    const speed = Math.hypot(end.x - start.x, end.y - start.y) / (durationMs / 1000);

    for (const fruit of hits) {
      const radius = fruitRadiusForInstance(fruit, state.width, state.height);
      const perfect = !fruit.isBomb && isPerfectSlice(start, end, fruit, state.width, state.height);
      const impactIntensity = calculateImpactIntensity(speed, radius, state.width, state.height);
      const countsMultiBonus = !fruit.isBomb && multiBonusAvailable;
      if (!fruit.isBomb) multiBonusAvailable = false;

      if (fruit.variant === "boss") {
        if (state.elapsedMs - (fruit.lastHitAtMs ?? -Infinity) < 140) continue;
        const scoreDelta = this.sliceBoss(
          state,
          fruit,
          start,
          end,
          perfect,
          multiSlice,
          countsMultiBonus,
          speed,
          impactIntensity,
        );
        this.emitSlice(state, fruit, start, end, scoreDelta, perfect, multiSlice, impactIntensity);
        continue;
      }

      fruit.sliced = true;
      let scoreDelta = 0;
      if (fruit.isBomb) {
        if (state.rules.bombEndsGame) {
          state.gameOver = true;
          state.gameOverReason = "bomb";
        } else {
          const nextScore = Math.max(0, state.score - state.rules.bombPenalty);
          scoreDelta = nextScore - state.score;
          state.score = nextScore;
        }
        state.shake = 1;
        this.spawnBombParticles(state, fruit.x, fruit.y, fruit.id);
        this.spawnFloatingLabel(
          state,
          fruit.x,
          fruit.y,
          scoreDelta < 0 ? `炸弹  ${scoreDelta}` : "炸弹！",
          "#ff9b62",
          1.25,
        );
        if (state.mode === "arcade") {
          recordArcadeSlice(state, {
            fruit,
            isBomb: true,
            perfect: false,
            multiCount: multiSlice,
            countsMultiBonus: false,
          });
        }
      } else {
        state.combo += 1;
        state.comboTimer = COMBO_WINDOW;
        const classicMultiplier = state.mode === "endless" && multiSlice >= 3 ? multiSlice : 1;
        const feverMultiplier = state.mode === "arcade" && (state.arcade?.feverTimer ?? 0) > 0 ? 2 : 1;
        const perfectBonus = state.mode === "arcade" && perfect ? 2 : 0;
        scoreDelta = (fruit.type.points + perfectBonus) * classicMultiplier * feverMultiplier;
        state.score += scoreDelta;
        state.shake = Math.max(state.shake, perfect ? 0.4 : 0.28);
        this.spawnHalves(state, fruit, start, end);
        this.spawnJuice(state, fruit, start, end, speed, impactIntensity);
        this.spawnSlashBurst(state, fruit.x, fruit.y, start, end, fruit.type.fleshColor);
        if (multiSlice >= 3 && countsMultiBonus) {
          this.spawnFloatingLabel(
            state,
            fruit.x,
            fruit.y,
            `${multiSlice} 连斩`,
            "#ffe07a",
            1.22,
          );
        } else if (multiSlice < 3) {
          const showPerfect = state.mode === "arcade" && perfect;
          this.spawnFloatingLabel(
            state,
            fruit.x,
            fruit.y,
            showPerfect ? `完美  +${scoreDelta}` : `+${scoreDelta}`,
            showPerfect ? "#fff09b" : fruit.type.fleshColor,
            showPerfect ? 1.12 : 0.9,
          );
        }

        if (state.mode === "arcade") {
          const outcome = recordArcadeSlice(state, {
            fruit,
            isBomb: false,
            perfect,
            multiCount: multiSlice,
            countsMultiBonus,
          });
          if (outcome.feverActivated) this.onEvent?.({ type: "arcade-cue", cue: "fever" });
          if (outcome.eventCompleted) this.onEvent?.({ type: "arcade-cue", cue: "event-complete" });
        }
      }

      this.emitSlice(state, fruit, start, end, scoreDelta, perfect, multiSlice, impactIntensity);
    }

    if (multiSlice >= 3) {
      state.lastSliceLabel = `${multiSlice} 连斩`;
      state.lastSliceLabelTimer = 900;
    } else if (
      state.mode === "arcade"
      && hits.some((fruit) => !fruit.isBomb && isPerfectSlice(start, end, fruit, state.width, state.height))
    ) {
      state.lastSliceLabel = "完美切 +2";
      state.lastSliceLabelTimer = 720;
    }
  }

  private sliceBoss(
    state: FruitNinjaState,
    fruit: Fruit,
    start: SlicePoint,
    end: SlicePoint,
    perfect: boolean,
    multiCount: number,
    countsMultiBonus: boolean,
    speed: number,
    impactIntensity: number,
  ): number {
    fruit.lastHitAtMs = state.elapsedMs;
    fruit.bossHits = Math.min(fruit.bossMaxHits ?? 8, (fruit.bossHits ?? 0) + 1);
    const complete = fruit.bossHits >= (fruit.bossMaxHits ?? 8);
    const feverMultiplier = (state.arcade?.feverTimer ?? 0) > 0 ? 2 : 1;
    const scoreDelta = (2 + (complete ? 25 : 0)) * feverMultiplier;
    state.score += scoreDelta;
    state.shake = complete ? 1.35 : Math.max(state.shake, 0.52);
    if (state.arcade) {
      state.arcade.bossHits = fruit.bossHits;
      state.arcade.bossCompleted = complete;
    }

    if (complete) {
      fruit.sliced = true;
      this.spawnBossChunks(state, fruit, start, end);
      state.arcade!.announcement = "巨果击破 · 终局完成";
      state.arcade!.announcementTimer = 1_650;
      this.onEvent?.({ type: "arcade-cue", cue: "boss-break" });
    }
    this.spawnJuice(
      state,
      fruit,
      start,
      end,
      speed,
      complete ? Math.max(2.15, impactIntensity) : Math.max(1.1, impactIntensity * 0.78),
      complete ? 1 : 0.45,
    );
    this.spawnSlashBurst(state, fruit.x, fruit.y, start, end, fruit.type.fleshColor);
    this.spawnFloatingLabel(
      state,
      fruit.x,
      fruit.y - fruitRadiusForInstance(fruit, state.width, state.height) * 0.4,
      complete
        ? `击破  +${scoreDelta}`
        : `${fruit.bossHits}/${fruit.bossMaxHits ?? 8} 刀  +${scoreDelta}`,
      complete ? "#fff0a2" : "#9be5ff",
      complete ? 1.45 : 1.05,
    );
    const outcome = recordArcadeSlice(state, {
      fruit,
      isBomb: false,
      perfect,
      multiCount,
      countsMultiBonus,
    });
    if (outcome.feverActivated) this.onEvent?.({ type: "arcade-cue", cue: "fever" });
    if (state.arcade) state.arcade.dailyCompleted ||= evaluateDailyChallenge(state);
    return scoreDelta;
  }

  private emitSlice(
    state: FruitNinjaState,
    fruit: Fruit,
    start: SlicePoint,
    end: SlicePoint,
    scoreDelta: number,
    perfect: boolean,
    multiCount: number,
    impactIntensity: number,
  ): void {
    this.onEvent?.({
      type: "slice",
      fruitId: fruit.id,
      fruitType: fruit.type.name,
      isBomb: fruit.isBomb,
      scoreDelta,
      perfect,
      multiCount,
      impactIntensity,
      elapsedMs: state.elapsedMs,
      durationMs: Math.max(1, end.time - start.time),
      start: { x: start.x / state.width, y: start.y / state.height },
      end: { x: end.x / state.width, y: end.y / state.height },
      viewport: { width: state.width, height: state.height },
    });
  }

  private spawnSlashBurst(
    state: FruitNinjaState,
    x: number,
    y: number,
    start: SlicePoint,
    end: SlicePoint,
    color: string,
  ): void {
    const life = 0.24;
    state.slashBursts.push({
      x,
      y,
      angle: Math.atan2(end.y - start.y, end.x - start.x),
      color,
      life,
      maxLife: life,
    });
  }

  private spawnHalves(
    state: FruitNinjaState,
    fruit: Fruit,
    start: SlicePoint,
    end: SlicePoint,
  ): void {
    const random = createSeededRandom(`${state.seed}:${fruit.id}:halves`);
    const sliceAngle = Math.atan2(end.y - start.y, end.x - start.x);
    const perpendicularX = Math.cos(sliceAngle + Math.PI / 2) * 105;
    const perpendicularY = Math.sin(sliceAngle + Math.PI / 2) * 105;
    const base = {
      type: fruit.type,
      x: fruit.x,
      y: fruit.y,
      rotation: sliceAngle - Math.PI / 2,
      alpha: 1,
      radiusScale: fruit.radiusScale,
    };
    const left: FruitHalf = {
      ...base,
      vx: fruit.vx - perpendicularX,
      vy: fruit.vy - perpendicularY - 42,
      rotationSpeed: -4.8 - random() * 2.7,
      side: -1,
    };
    const right: FruitHalf = {
      ...base,
      vx: fruit.vx + perpendicularX,
      vy: fruit.vy + perpendicularY - 42,
      rotationSpeed: 4.8 + random() * 2.7,
      side: 1,
    };
    state.halves.push(left, right);
  }

  private spawnBossChunks(
    state: FruitNinjaState,
    fruit: Fruit,
    start: SlicePoint,
    end: SlicePoint,
  ): void {
    const before = state.halves.length;
    this.spawnHalves(state, fruit, start, end);
    const firstPair = state.halves.slice(before);
    for (const [index, half] of firstPair.entries()) {
      state.halves.push({
        ...half,
        x: half.x + (index === 0 ? -24 : 24),
        y: half.y + 18,
        vx: half.vx * 1.18 + (index === 0 ? -80 : 80),
        vy: half.vy - 55,
        radiusScale: (fruit.radiusScale ?? 1) * 0.58,
        rotation: half.rotation + Math.PI * 0.5,
      });
    }
  }

  private spawnJuice(
    state: FruitNinjaState,
    fruit: Fruit,
    start: SlicePoint,
    end: SlicePoint,
    speed: number,
    impactIntensity: number,
    sizeMultiplier = 1,
  ): void {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const radius = fruitRadiusForInstance(fruit, state.width, state.height) * sizeMultiplier;
    addJuiceImpact(state, {
      seed: `${state.seed}:${fruit.id}:${fruit.bossHits ?? 0}:${Math.round(state.elapsedMs / 120)}`,
      x: fruit.x,
      y: fruit.y,
      width: state.width,
      height: state.height,
      baseRadius: radius,
      angle,
      speed,
      intensity: impactIntensity,
      color: fruit.type.fleshColor,
    });
  }

  private spawnBombParticles(state: FruitNinjaState, x: number, y: number, id: number): void {
    const colors = ["#ff6b2c", "#ffbd2e", "#2c2c35", "#73717f"];
    const random = createSeededRandom(`${state.seed}:${id}:bomb`);
    for (let index = 0; index < PARTICLE_COUNT * 3; index += 1) {
      const angle = random() * Math.PI * 2;
      const speed = 130 + random() * 460;
      const life = 0.55 + random() * 0.85;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        radius: 3 + random() * 8,
        color: colors[index % colors.length],
        alpha: 1,
        life,
        maxLife: life,
        gravity: 690,
        stretch: 1.3,
      });
    }
    if (state.particles.length > MAX_JUICE_PARTICLES) {
      state.particles.splice(0, state.particles.length - MAX_JUICE_PARTICLES);
    }
  }

  private spawnFloatingLabel(
    state: FruitNinjaState,
    x: number,
    y: number,
    text: string,
    color: string,
    emphasis: number,
  ): void {
    const life = 0.78 + Math.min(0.24, emphasis * 0.1);
    state.floatingLabels.push({
      x,
      y,
      vy: -72 - emphasis * 14,
      text,
      color,
      life,
      maxLife: life,
      emphasis,
    });
    if (state.floatingLabels.length > 14) {
      state.floatingLabels.splice(0, state.floatingLabels.length - 14);
    }
  }
}

export function isPerfectSlice(
  start: Pick<SlicePoint, "x" | "y" | "time">,
  end: Pick<SlicePoint, "x" | "y" | "time">,
  fruit: Fruit,
  width: number,
  height: number,
): boolean {
  const durationMs = Math.max(1, end.time - start.time);
  const speed = Math.hypot(end.x - start.x, end.y - start.y) / (durationMs / 1000);
  const viewportScale = Math.min(1.22, Math.max(0.92, Math.min(width / 1280, height / 720)));
  const radius = fruitRadiusForInstance(fruit, width, height);
  return speed >= PERFECT_SLICE_SPEED * viewportScale
    && segmentDistanceSquared(start, end, { x: fruit.x, y: fruit.y }) <= (radius * 0.28) ** 2;
}

export function segmentIntersectsCircle(
  start: Pick<SlicePoint, "x" | "y">,
  end: Pick<SlicePoint, "x" | "y">,
  centerX: number,
  centerY: number,
  radius: number,
): boolean {
  return segmentDistanceSquared(start, end, { x: centerX, y: centerY }) <= radius * radius;
}

export function segmentDistanceSquared(
  start: Pick<SlicePoint, "x" | "y">,
  end: Pick<SlicePoint, "x" | "y">,
  point: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.0001) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  const nearestX = start.x + projection * dx;
  const nearestY = start.y + projection * dy;
  return (point.x - nearestX) ** 2 + (point.y - nearestY) ** 2;
}

function calculateImpactIntensity(
  speed: number,
  radius: number,
  width: number,
  height: number,
): number {
  const viewportScale = Math.min(1.22, Math.max(0.92, Math.min(width / 1280, height / 720)));
  const speedRatio = Math.min(2.2, Math.max(0.72, speed / (PERFECT_SLICE_SPEED * viewportScale)));
  const sizeRatio = Math.min(2.3, Math.max(0.72, radius / (64 * viewportScale)));
  return Math.min(2.25, Math.max(0.65, speedRatio * 0.58 + sizeRatio * 0.42));
}


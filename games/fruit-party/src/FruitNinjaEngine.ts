/** Game loop and state orchestration adapted from forinda/canvas-games (MIT). */
import { createSeededRandom, generateMatchSchedule, getRoundRules } from "./shared/match";
import { FruitSystem } from "./systems/FruitSystem";
import { SliceSystem } from "./systems/SliceSystem";
import {
  ARCADE_DURATION_MS,
  ArcadeSystem,
  createArcadeState,
  evaluateDailyChallenge,
  recordArcadeMiss,
} from "./systems/ArcadeSystem";
import { GameRenderer } from "./renderers/GameRenderer";
import { HUDRenderer } from "./renderers/HUDRenderer";
import {
  ARCADE_HS_KEY,
  HS_KEY,
  MAX_LIVES,
  START_COUNTDOWN,
  TRAIL_LIFETIME,
  type BladeState,
  type FruitNinjaState,
  type GameEvent,
  type GameRules,
  type GameSessionOptions,
} from "./types";

export interface FruitNinjaCallbacks {
  onEvent?: (event: GameEvent) => void;
  onGameOver?: (state: Readonly<FruitNinjaState>) => void;
}

export class FruitNinjaEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fruitSystem = new FruitSystem();
  private readonly sliceSystem: SliceSystem;
  private readonly arcadeSystem: ArcadeSystem;
  private readonly gameRenderer = new GameRenderer();
  private readonly hudRenderer = new HUDRenderer();
  private readonly resizeObserver: ResizeObserver;
  private state: FruitNinjaState;
  private session: GameSessionOptions = { mode: "endless", countdownMs: START_COUNTDOWN };
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private lastDebugSyncAt = -Infinity;
  private previousGameOver = false;
  private highScoreDirty = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: FruitNinjaCallbacks = {},
  ) {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("当前浏览器无法创建 Canvas 2D 画布。");
    this.ctx = context;
    this.sliceSystem = new SliceSystem((event) => this.callbacks.onEvent?.(event));
    this.arcadeSystem = new ArcadeSystem((event) => this.callbacks.onEvent?.(event));
    this.state = this.createInitialState(1, 1, this.loadHighScore(this.session.mode), this.session);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  startLoop(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  beginGame(options: GameSessionOptions = this.session): void {
    this.persistHighScore();
    this.session = { ...options };
    this.state = this.createInitialState(
      this.state.width,
      this.state.height,
      this.loadHighScore(this.session.mode),
      this.session,
    );
    this.state.started = true;
    this.state.countdownTimer = options.countdownMs ?? START_COUNTDOWN;
    this.lastDebugSyncAt = -Infinity;
    this.previousGameOver = false;
    this.highScoreDirty = false;
  }

  restart(): void {
    this.beginGame(this.session);
  }

  togglePause(): void {
    if (this.state.started && !this.state.gameOver) this.state.paused = !this.state.paused;
  }

  setPaused(paused: boolean): void {
    if (this.state.started && !this.state.gameOver) this.state.paused = paused;
  }

  updateBlade(
    id: string,
    x: number,
    y: number,
    time: number,
    speed: number,
    velocityX: number,
    velocityY: number,
    active: boolean,
  ): void {
    const blade = this.ensureBlade(id);
    const nextX = Math.min(this.state.width, Math.max(0, x));
    const nextY = Math.min(this.state.height, Math.max(0, y));
    const now = performance.now();
    blade.visible = true;
    blade.active = active;
    blade.lastSeen = now;
    blade.targetX = nextX;
    blade.targetY = nextY;
    blade.renderX = nextX;
    blade.renderY = nextY;
    blade.velocityX = velocityX;
    blade.velocityY = velocityY;
    blade.targetSpeed = active ? speed : 0;
    if (blade.initialized && time > blade.sampleTime) {
      blade.sampleInterval = Math.min(140, Math.max(1, time - blade.sampleTime));
    }
    blade.sampleTime = time;
    blade.initialized = true;

    if (!active) {
      blade.points = [{
        x: nextX,
        y: nextY,
        time: now,
        speed: 0,
        sequence: blade.nextSequence++,
        active: false,
      }];
      return;
    }

    const previous = blade.points[blade.points.length - 1];
    if (previous && Math.hypot(nextX - previous.x, nextY - previous.y) < 0.2) return;
    blade.points.push({
      x: nextX,
      y: nextY,
      time,
      speed,
      sequence: blade.nextSequence++,
      active: true,
    });
    if (blade.points.length > 72) blade.points.splice(0, blade.points.length - 72);
  }

  setBladeActive(id: string, active: boolean, x: number, y: number, time: number): void {
    const blade = this.ensureBlade(id);
    blade.active = active;
    blade.visible = true;
    blade.lastSeen = performance.now();
    blade.targetX = blade.renderX = x;
    blade.targetY = blade.renderY = y;
    blade.targetSpeed = 0;
    blade.sampleTime = time;
    blade.initialized = true;
    blade.points = [{
      x,
      y,
      time,
      speed: 0,
      sequence: blade.nextSequence++,
      active,
    }];
  }

  hideBlade(id: string): void {
    const blade = this.state.blades.find((candidate) => candidate.id === id);
    if (blade && !blade.active) blade.visible = false;
  }

  getState(): Readonly<FruitNinjaState> {
    return this.state;
  }

  syncScore(score: number, lives?: number): void {
    this.state.score = Math.max(0, Math.round(score));
    if (lives !== undefined) this.state.lives = Math.max(0, Math.round(lives));
  }

  syncMatchTime(elapsedMs: number): boolean {
    return fastForwardScheduledState(this.state, elapsedMs);
  }

  finish(reason: FruitNinjaState["gameOverReason"] = "time"): void {
    this.state.gameOver = true;
    this.state.gameOverReason = reason;
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.persistHighScore();
  }

  private readonly resize = (): void => {
    const parent = this.canvas.parentElement;
    const bounds = parent?.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds?.width ?? window.innerWidth));
    const height = Math.max(1, Math.floor(bounds?.height ?? window.innerHeight));
    const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    scaleGameStateToViewport(this.state, width, height);
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  private readonly loop = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 50);
    this.lastTime = now;

    if (this.state.started && !this.state.paused && !this.state.gameOver) {
      if (this.state.countdownTimer > 0) {
        this.state.countdownTimer = Math.max(0, this.state.countdownTimer - dt);
      } else {
        this.update(dt);
      }
    }
    this.pruneBlades(now);
    this.render(now);

    if (this.state.gameOver && !this.previousGameOver) {
      this.persistHighScore();
      this.callbacks.onGameOver?.(this.state);
    }
    this.previousGameOver = this.state.gameOver;
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.state.elapsedMs += dt;
    const duration = this.state.rules.durationMs;
    if (duration !== undefined && this.state.elapsedMs >= duration) {
      this.state.elapsedMs = duration;
      this.state.gameOver = true;
      this.state.gameOverReason = "time";
      return;
    }

    this.arcadeSystem.update(this.state, dt);
    const missed = this.fruitSystem.update(this.state, dt);
    const livesBeforeMisses = this.state.lives;
    const missesHaveConsequences = this.state.mode === "arcade" || this.state.rules.missesCostLife;
    for (const fruit of missed) {
      applyMissPenalty(this.state);
      if (missesHaveConsequences) {
        this.callbacks.onEvent?.({
          type: "miss",
          fruitId: fruit.id,
          elapsedMs: this.state.elapsedMs,
          lives: this.state.lives,
        });
      }
    }
    if (missed.length > 0 && missesHaveConsequences) {
      addMissFeedback(
        this.state,
        missed.reduce((sum, fruit) => sum + fruit.x, 0) / missed.length,
        missed.length,
        Math.max(0, livesBeforeMisses - this.state.lives),
      );
    }
    this.sliceSystem.update(this.state, dt);
    let fruitWriteIndex = 0;
    for (let index = 0; index < this.state.fruits.length; index += 1) {
      const fruit = this.state.fruits[index];
      if (!fruit.sliced) this.state.fruits[fruitWriteIndex++] = fruit;
    }
    this.state.fruits.length = fruitWriteIndex;

    if ((this.state.mode === "endless" || this.state.mode === "arcade") && this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
      this.highScoreDirty = true;
    }
    if (this.state.mode === "arcade" && this.state.arcade) {
      this.state.arcade.dailyCompleted ||= evaluateDailyChallenge(this.state);
    }
  }

  private pruneBlades(now: number): void {
    for (const blade of this.state.blades) {
      let writeIndex = 0;
      for (let index = 0; index < blade.points.length; index += 1) {
        const point = blade.points[index];
        if (now - point.time < TRAIL_LIFETIME) blade.points[writeIndex++] = point;
      }
      blade.points.length = writeIndex;
      if (!blade.active && now - blade.lastSeen > 1_200) blade.visible = false;
    }
  }

  private render(now: number): void {
    this.syncDebugDataset(now);
    this.gameRenderer.render(this.ctx, this.state);
    this.hudRenderer.render(this.ctx, this.state);
  }

  private syncDebugDataset(now: number): void {
    const gameOverValue = String(this.state.gameOver);
    if (now - this.lastDebugSyncAt < 100 && this.canvas.dataset.gameOver === gameOverValue) return;
    this.lastDebugSyncAt = now;
    const dataset = this.canvas.dataset;
    const setValue = (key: string, value: string): void => {
      if (dataset[key] !== value) dataset[key] = value;
    };
    setValue("score", String(this.state.score));
    setValue("lives", String(this.state.lives));
    setValue("gameOver", gameOverValue);
    setValue("gameOverReason", this.state.gameOverReason ?? "");
    setValue("mode", this.state.mode);
    setValue("arcadePhase", this.state.arcade?.phase ?? "");
    setValue("arcadeFever", String(Math.round(this.state.arcade?.fever ?? 0)));
    setValue("bossHits", String(this.state.arcade?.bossHits ?? 0));
    setValue("bombsLaunched", String(this.state.bombsLaunched));
    setValue("elapsedMs", String(Math.round(this.state.elapsedMs)));
    setValue("seed", String(this.state.seed ?? ""));
    setValue("endlessTier", String(this.state.endlessTier));
    let bombPositions = "";
    let bombPatterns = "";
    for (const fruit of this.state.fruits) {
      if (!fruit.isBomb) continue;
      if (bombPositions) {
        bombPositions += ";";
        bombPatterns += ";";
      }
      bombPositions += `${(fruit.x / this.state.width).toFixed(3)},${(fruit.y / this.state.height).toFixed(3)}`;
      bombPatterns += String(fruit.hazardPattern ?? "scheduled");
    }
    setValue("activeBombs", bombPositions);
    setValue("activeBombPatterns", bombPatterns);
    let bladeSamples = 0;
    for (const blade of this.state.blades) bladeSamples += blade.points.length;
    setValue("bladeSamples", String(bladeSamples));
  }

  private persistHighScore(): void {
    if (!this.highScoreDirty) return;
    try {
      localStorage.setItem(
        this.state.mode === "arcade" ? ARCADE_HS_KEY : HS_KEY,
        String(this.state.highScore),
      );
    } catch {
      // Local persistence is optional.
    }
    this.highScoreDirty = false;
  }

  private ensureBlade(id: string): BladeState {
    let blade = this.state.blades.find((candidate) => candidate.id === id);
    if (blade) return blade;
    blade = {
      id,
      color: "#9de7d6",
      points: [],
      visible: true,
      active: false,
      lastSeen: performance.now(),
      lastProcessedSequence: -1,
      nextSequence: 0,
      targetX: 0,
      targetY: 0,
      renderX: 0,
      renderY: 0,
      velocityX: 0,
      velocityY: 0,
      targetSpeed: 0,
      sampleTime: 0,
      sampleInterval: 16,
      initialized: false,
    };
    this.state.blades.push(blade);
    return blade;
  }

  private createInitialState(
    width: number,
    height: number,
    highScore: number,
    options: GameSessionOptions,
  ): FruitNinjaState {
    const rules = this.resolveRules(options);
    const seed = options.seed ?? createGameSeed();
    const initialElapsedMs = Math.max(0, options.initialElapsedMs ?? 0);
    const schedule = options.mode === "endless" || options.mode === "arcade"
      ? []
      : generateMatchSchedule(seed, rules.durationMs ?? 300_000);
    return {
      fruits: [],
      halves: [],
      particles: [],
      wallSplatters: [],
      slashBursts: [],
      floatingLabels: [],
      blades: [],
      score: 0,
      highScore,
      combo: 0,
      comboTimer: 0,
      lives: rules.startingLives,
      gameOver: false,
      started: false,
      paused: false,
      nextId: 1,
      launchTimer: 0.6,
      nextBombAtMs: initialBombDelayForSeed(seed),
      bombsLaunched: 0,
      wavesLaunched: 0,
      endlessTier: 0,
      countdownTimer: 0,
      elapsedMs: initialElapsedMs,
      wave: 0,
      width,
      height,
      lastSliceLabel: "",
      lastSliceLabelTimer: 0,
      mode: options.mode,
      rules,
      seed,
      schedule,
      nextScheduledIndex: firstRelevantScheduleIndex(schedule, initialElapsedMs),
      shake: 0,
      arcade: options.mode === "arcade" ? createArcadeState(seed) : undefined,
    };
  }

  private resolveRules(options: GameSessionOptions): GameRules {
    if (options.mode === "endless") {
      return {
        startingLives: MAX_LIVES,
        missesCostLife: true,
        bombPenalty: 0,
        bombEndsGame: true,
      };
    }
    if (options.mode === "arcade") {
      return {
        durationMs: options.durationMs ?? ARCADE_DURATION_MS,
        startingLives: 0,
        missesCostLife: false,
        bombPenalty: 10,
        bombEndsGame: false,
      };
    }
    const rules = getRoundRules(options.mode);
    return {
      durationMs: options.durationMs ?? rules.durationMs,
      startingLives: rules.startingLives,
      missesCostLife: rules.missesCostLife,
      bombPenalty: rules.bombPenalty,
      bombEndsGame: rules.bombEndsRound,
    };
  }

  private loadHighScore(mode: GameSessionOptions["mode"]): number {
    try {
      const key = mode === "arcade" ? ARCADE_HS_KEY : HS_KEY;
      return Number.parseInt(localStorage.getItem(key) ?? "0", 10) || 0;
    } catch {
      return 0;
    }
  }
}

export function createGameSeed(): number {
  try {
    if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
      return crypto.getRandomValues(new Uint32Array(1))[0];
    }
  } catch {
    // A normal PRNG still gives each local round a fresh fallback seed.
  }
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

export function initialBombDelayForSeed(seed: string | number): number {
  const random = createSeededRandom(`${seed}:endless-opening-bomb`);
  return 5_200 + random() * 8_800;
}

export function firstRelevantScheduleIndex(
  schedule: FruitNinjaState["schedule"],
  elapsedMs: number,
): number {
  const index = schedule.findIndex((fruit) => fruit.launchAtMs + fruit.flightMs >= elapsedMs);
  return index < 0 ? schedule.length : index;
}

export function scaleGameStateToViewport(
  state: FruitNinjaState,
  width: number,
  height: number,
): void {
  const nextWidth = Math.max(1, width);
  const nextHeight = Math.max(1, height);
  const previousWidth = Math.max(1, state.width);
  const previousHeight = Math.max(1, state.height);
  if (previousWidth === nextWidth && previousHeight === nextHeight) return;
  const scaleX = nextWidth / previousWidth;
  const scaleY = nextHeight / previousHeight;
  const uniformScale = Math.min(scaleX, scaleY);

  for (const fruit of state.fruits) {
    fruit.x *= scaleX;
    fruit.y *= scaleY;
    fruit.vx *= scaleX;
    fruit.vy *= scaleY;
  }
  for (const half of state.halves) {
    half.x *= scaleX;
    half.y *= scaleY;
    half.vx *= scaleX;
    half.vy *= scaleY;
  }
  for (const particle of state.particles) {
    particle.x *= scaleX;
    particle.y *= scaleY;
    particle.vx *= scaleX;
    particle.vy *= scaleY;
    particle.radius *= uniformScale;
  }
  for (const burst of state.slashBursts) {
    burst.x *= scaleX;
    burst.y *= scaleY;
  }
  for (const label of state.floatingLabels) {
    label.x *= scaleX;
    label.y *= scaleY;
    label.vy *= scaleY;
  }
  for (const splatter of state.wallSplatters) splatter.size *= uniformScale;
  for (const blade of state.blades) {
    blade.targetX *= scaleX;
    blade.renderX *= scaleX;
    blade.targetY *= scaleY;
    blade.renderY *= scaleY;
    blade.velocityX *= scaleX;
    blade.velocityY *= scaleY;
    blade.targetSpeed *= uniformScale;
    for (const point of blade.points) {
      point.x *= scaleX;
      point.y *= scaleY;
      point.speed *= uniformScale;
    }
  }
  state.width = nextWidth;
  state.height = nextHeight;
}

export function addMissFeedback(
  state: FruitNinjaState,
  x: number,
  missedCount = 1,
  livesLost = state.rules.missesCostLife ? 1 : 0,
): void {
  if (state.mode !== "arcade" && !state.rules.missesCostLife) return;
  const countText = missedCount > 1 ? ` ${missedCount} 个` : "";
  const text = state.mode === "arcade"
    ? `漏切${countText}  ·  狂热下降`
    : state.mode === "endless" && livesLost === 0
      ? `热身漏切${countText}  ·  不扣命`
      : livesLost > 0
        ? `漏切${countText}  ·  失去 ${livesLost} 条命`
        : `漏切${countText}`;
  state.floatingLabels.push({
    x: Math.min(state.width - 92, Math.max(92, x)),
    y: state.height - 76,
    vy: -42,
    text,
    color: "#ff9b75",
    life: 0.9,
    maxLife: 0.9,
    emphasis: 0.82,
  });
  if (state.floatingLabels.length > 14) {
    state.floatingLabels.splice(0, state.floatingLabels.length - 14);
  }
}

export function fastForwardScheduledState(
  state: FruitNinjaState,
  elapsedMs: number,
  minimumDriftMs = 350,
): boolean {
  if (state.mode === "endless" || state.mode === "arcade" || !state.started || state.gameOver) return false;
  const target = Math.min(
    state.rules.durationMs ?? Number.POSITIVE_INFINITY,
    Math.max(0, elapsedMs),
  );
  if (target - state.elapsedMs <= minimumDriftMs) return false;

  state.elapsedMs = target;
  state.nextScheduledIndex = firstRelevantScheduleIndex(state.schedule, target);
  state.fruits = [];
  state.halves = [];
  state.particles = [];
  state.wallSplatters = [];
  state.slashBursts = [];
  state.floatingLabels = [];
  state.combo = 0;
  state.comboTimer = 0;
  state.lastSliceLabel = "";
  state.lastSliceLabelTimer = 0;
  return true;
}

export function applyMissPenalty(state: FruitNinjaState): void {
  const warmupProtected = state.mode === "endless"
    && state.score === 0
    && state.elapsedMs < 10_000;
  if (state.rules.missesCostLife && !warmupProtected) state.lives -= 1;
  if (state.mode === "arcade") recordArcadeMiss(state);
  if (state.rules.missesCostLife && state.lives <= 0) {
    state.gameOver = true;
    state.gameOverReason = "lives";
  }
}



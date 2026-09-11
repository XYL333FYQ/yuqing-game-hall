import type { CompetitiveMode, ScheduledFruit } from "./shared/match";

export type GameMode = "endless" | "arcade" | CompetitiveMode;

export type ArcadeEventId = "combo-array" | "precision" | "fruit-rain" | "thread-gap";
export type ArcadePhase = "warmup" | "event" | "transition" | "boss-warning" | "boss";
export type DailyChallengeKind = "score" | "perfect" | "events" | "fever" | "clean-boss";

export interface DailyChallenge {
  dateKey: string;
  kind: DailyChallengeKind;
  target: number;
  title: string;
  description: string;
}

export interface ArcadeState {
  phase: ArcadePhase;
  phaseStartedAtMs: number;
  phaseToken: string;
  eventOrder: ArcadeEventId[];
  activeEventIndex: number;
  activeEventId?: ArcadeEventId;
  eventProgress: Record<ArcadeEventId, number>;
  completedEventIds: ArcadeEventId[];
  nextSpawnAtMs: number;
  patternIndex: number;
  fever: number;
  feverTimer: number;
  feverActivations: number;
  perfectSlices: number;
  maxMultiSlice: number;
  bombHits: number;
  bossFruitId?: number;
  bossHits: number;
  bossMaxHits: number;
  bossCompleted: boolean;
  dailyChallenge: DailyChallenge;
  dailyCompleted: boolean;
  announcement: string;
  announcementTimer: number;
}

export interface FruitType {
  name: "watermelon" | "orange" | "apple" | "lemon" | "kiwi" | "strawberry" | "bomb";
  skinColor: string;
  fleshColor: string;
  accentColor: string;
  radius: number;
  points: number;
}

export interface Fruit {
  type: FruitType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  sliced: boolean;
  isBomb: boolean;
  id: number;
  schedule?: ScheduledFruit;
  radiusScale?: number;
  variant?: "normal" | "event-target" | "boss";
  motion?: "ballistic" | "rain" | "linear" | "hover";
  expiresAtMs?: number;
  eventId?: ArcadeEventId;
  perfectTarget?: boolean;
  hazardPattern?: number;
  bossHits?: number;
  bossMaxHits?: number;
  lastHitAtMs?: number;
}

export interface FruitHalf {
  type: FruitType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  side: -1 | 1;
  alpha: number;
  radiusScale?: number;
}

export interface JuiceParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity?: number;
  stretch?: number;
  mist?: boolean;
}

export interface SplatterVertex {
  angle: number;
  radius: number;
  /** Cached local coordinates avoid repeating trigonometry on every frame. */
  x: number;
  y: number;
}

export interface SplatterSatellite {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  alpha: number;
}

export interface JuiceDrip {
  offsetX: number;
  offsetY: number;
  delay: number;
  length: number;
  width: number;
  bend: number;
  beadRadius: number;
}

export interface WallSplatter {
  id: number;
  seed: number;
  /** Normalized wall position so a resize keeps the stain attached to the background. */
  x: number;
  y: number;
  size: number;
  angle: number;
  color: string;
  darkColor: string;
  alpha: number;
  age: number;
  life: number;
  expandDuration: number;
  outline: SplatterVertex[];
  satellites: SplatterSatellite[];
  drips: JuiceDrip[];
}

export interface SlashBurst {
  x: number;
  y: number;
  angle: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingLabel {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  emphasis: number;
}

export interface SlicePoint {
  x: number;
  y: number;
  time: number;
  speed: number;
  sequence: number;
  active: boolean;
}

export interface BladeState {
  id: string;
  color: string;
  points: SlicePoint[];
  visible: boolean;
  active: boolean;
  lastSeen: number;
  lastProcessedSequence: number;
  nextSequence: number;
  targetX: number;
  targetY: number;
  renderX: number;
  renderY: number;
  velocityX: number;
  velocityY: number;
  targetSpeed: number;
  sampleTime: number;
  sampleInterval: number;
  initialized: boolean;
}

export interface GameRules {
  durationMs?: number;
  startingLives: number;
  missesCostLife: boolean;
  bombPenalty: number;
  bombEndsGame: boolean;
}

export interface FruitNinjaState {
  fruits: Fruit[];
  halves: FruitHalf[];
  particles: JuiceParticle[];
  wallSplatters: WallSplatter[];
  slashBursts: SlashBurst[];
  floatingLabels: FloatingLabel[];
  blades: BladeState[];
  score: number;
  highScore: number;
  combo: number;
  comboTimer: number;
  lives: number;
  gameOver: boolean;
  gameOverReason?: "lives" | "bomb" | "time" | "forfeit";
  started: boolean;
  paused: boolean;
  nextId: number;
  launchTimer: number;
  nextBombAtMs: number;
  bombsLaunched: number;
  wavesLaunched: number;
  endlessTier: number;
  lastBombPattern?: number;
  lastBombStartRatio?: number;
  countdownTimer: number;
  elapsedMs: number;
  wave: number;
  width: number;
  height: number;
  lastSliceLabel: string;
  lastSliceLabelTimer: number;
  mode: GameMode;
  rules: GameRules;
  seed?: number;
  schedule: ScheduledFruit[];
  nextScheduledIndex: number;
  shake: number;
  arcade?: ArcadeState;
}

export interface GameSliceEvent {
  type: "slice";
  fruitId: number;
  fruitType: FruitType["name"];
  isBomb: boolean;
  scoreDelta: number;
  perfect: boolean;
  multiCount: number;
  impactIntensity: number;
  elapsedMs: number;
  durationMs: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  viewport: { width: number; height: number };
}

export interface GameMissEvent {
  type: "miss";
  fruitId: number;
  elapsedMs: number;
  lives: number;
}

export interface ArcadeCueEvent {
  type: "arcade-cue";
  cue: "event" | "event-complete" | "fever" | "boss-warning" | "boss-break";
}

export type GameEvent = GameSliceEvent | GameMissEvent | ArcadeCueEvent;

export interface GameSessionOptions {
  mode: GameMode;
  seed?: number;
  durationMs?: number;
  countdownMs?: number;
  initialElapsedMs?: number;
}

export const GRAVITY = 980;
export const MAX_LIVES = 3;
export const TRAIL_LIFETIME = 165;
/** Reference radii target a 1280×720 playfield and scale with the viewport. */
export const FRUIT_RADIUS = 64;
export const BOMB_RADIUS = 72;
export const COMBO_WINDOW = 620;
export const LAUNCH_INTERVAL_MIN = 0.65;
export const LAUNCH_INTERVAL_MAX = 1.55;
export const PARTICLE_COUNT = 32;
export const HS_KEY = "yuqing-fruit-party-high-score";
export const ARCADE_HS_KEY = "yuqing-fruit-party-arcade-high-score";
export const MIN_SLICE_SPEED = 220;
export const PERFECT_SLICE_SPEED = 520;
export const START_COUNTDOWN = 1_800;



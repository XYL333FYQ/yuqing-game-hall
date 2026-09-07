export type CompetitiveMode = "score90" | "bestOf3" | "survival";

export type FruitName =
  | "watermelon"
  | "orange"
  | "apple"
  | "lemon"
  | "kiwi"
  | "strawberry"
  | "bomb";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface SliceClaim {
  fruitId: number;
  atMs: number;
  durationMs: number;
  start: NormalizedPoint;
  end: NormalizedPoint;
  viewport?: { width: number; height: number };
}

export function isSliceClaim(value: unknown): value is SliceClaim {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<SliceClaim>;
  const point = (pointValue: unknown): pointValue is NormalizedPoint => {
    if (!pointValue || typeof pointValue !== "object" || Array.isArray(pointValue)) return false;
    const point = pointValue as Partial<NormalizedPoint>;
    return Number.isFinite(point.x) && Number.isFinite(point.y)
      && Math.abs(point.x as number) <= 2 && Math.abs(point.y as number) <= 2;
  };
  if (!Number.isInteger(candidate.fruitId) || (candidate.fruitId as number) < 1) return false;
  if (!Number.isFinite(candidate.atMs) || !Number.isFinite(candidate.durationMs)) return false;
  if ((candidate.atMs as number) < -5_000 || (candidate.atMs as number) > 3_600_000) return false;
  if (!point(candidate.start) || !point(candidate.end)) return false;
  if (candidate.viewport !== undefined) {
    const viewport = candidate.viewport;
    if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return false;
    if ((viewport.width as number) <= 0 || (viewport.height as number) <= 0) return false;
  }
  return true;
}
export interface ScheduledFruit {
  id: number;
  launchAtMs: number;
  flightMs: number;
  startX: number;
  endX: number;
  peakY: number;
  rotation: number;
  rotationSpeed: number;
  type: FruitName;
  isBomb: boolean;
}

export interface RoundRules {
  durationMs: number;
  startingLives: number;
  missesCostLife: boolean;
  bombPenalty: number;
  bombEndsRound: boolean;
}

const FRUIT_TYPES: Exclude<FruitName, "bomb">[] = [
  "watermelon",
  "orange",
  "apple",
  "lemon",
  "kiwi",
  "strawberry",
];

const FRUIT_POINTS: Record<FruitName, number> = {
  watermelon: 3,
  orange: 1,
  apple: 1,
  lemon: 1,
  kiwi: 2,
  strawberry: 2,
  bomb: 0,
};

const FRUIT_RADIUS: Record<FruitName, number> = {
  watermelon: 76,
  orange: 65,
  apple: 64,
  lemon: 62,
  kiwi: 61,
  strawberry: 59,
  bomb: 72,
};

const CANONICAL_WIDTH = 1600;
const CANONICAL_HEIGHT = 900;
const MIN_SLICE_SPEED = 220;

export function getRoundRules(mode: CompetitiveMode, overtime = false): RoundRules {
  if (overtime) {
    return {
      durationMs: 20_000,
      startingLives: 3,
      missesCostLife: false,
      bombPenalty: 10,
      bombEndsRound: false,
    };
  }
  if (mode === "survival") {
    return {
      durationMs: 300_000,
      startingLives: 3,
      missesCostLife: true,
      bombPenalty: 0,
      bombEndsRound: true,
    };
  }
  return {
    durationMs: mode === "score90" ? 90_000 : 60_000,
    startingLives: 3,
    missesCostLife: false,
    bombPenalty: 10,
    bombEndsRound: false,
  };
}

export function fruitPoints(type: FruitName): number {
  return FRUIT_POINTS[type];
}

export function fruitRadius(
  type: FruitName,
  viewport: { width: number; height: number } = {
    width: CANONICAL_WIDTH,
    height: CANONICAL_HEIGHT,
  },
): number {
  const viewportScale = Math.min(viewport.width / 1280, viewport.height / 720);
  const scale = Math.min(1.22, Math.max(0.92, viewportScale));
  return FRUIT_RADIUS[type] * scale;
}

export function hashSeed(value: string | number): number {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string | number): () => number {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function generateMatchSchedule(
  seed: string | number,
  durationMs: number,
): ScheduledFruit[] {
  const random = createSeededRandom(seed);
  const schedule: ScheduledFruit[] = [];
  let waveAtMs = 1_350;
  let wave = 0;
  let nextId = 1;
  let nextBombAtMs = 8_000 + random() * 2_000;

  while (waveAtMs < durationMs + 2_000) {
    const difficulty = Math.min(4, Math.floor(waveAtMs / 30_000));
    const isIntroWave = wave === 0;
    const bombDue = !isIntroWave && waveAtMs >= nextBombAtMs;
    const count = isIntroWave ? 1 : 1 + Math.floor(random() * (2 + difficulty));

    if (bombDue) {
      let bomb: ScheduledFruit | undefined;
      for (let attempt = 0; attempt < 96; attempt += 1) {
        const proposed = createScheduledFruit({
          id: nextId,
          launchAtMs: waveAtMs + (random() - 0.5) * 180,
          type: "bomb",
          difficulty,
          random,
        });
        if (hasSafeHazardClearance(proposed, schedule, scheduleBombGap(difficulty))) {
          bomb = proposed;
          break;
        }
      }
      if (bomb) {
        schedule.push(bomb);
        nextId += 1;
        nextBombAtMs = bomb.launchAtMs + nextScheduleBombInterval(difficulty, random);
      } else {
        // Keep the hazard unannounced and retry soon; never force it through a
        // fruit cluster just to satisfy a timer.
        nextBombAtMs = waveAtMs + 220 + random() * 280;
      }
    }

    for (let index = 0; index < count; index += 1) {
      let candidate: ScheduledFruit | undefined;
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const type = isIntroWave
          ? "orange"
          : FRUIT_TYPES[Math.floor(random() * FRUIT_TYPES.length)];
        const proposed = createScheduledFruit({
          id: nextId,
          launchAtMs: waveAtMs + index * 32,
          type,
          difficulty,
          random,
          intro: isIntroWave,
        });
        if (hasSafeHazardClearance(proposed, schedule, scheduleBombGap(difficulty))) {
          candidate = proposed;
          break;
        }
      }
      if (candidate) {
        schedule.push(candidate);
        nextId += 1;
      }
    }

    const baseInterval = Math.max(520, 1_260 - wave * 10);
    const proposedWaveAtMs = waveAtMs + baseInterval + random() * 360;
    waveAtMs = waveAtMs < nextBombAtMs && proposedWaveAtMs > nextBombAtMs
      ? nextBombAtMs
      : proposedWaveAtMs;
    wave += 1;
  }

  return schedule.sort((first, second) => first.launchAtMs - second.launchAtMs || first.id - second.id);
}

function createScheduledFruit(input: {
  id: number;
  launchAtMs: number;
  type: FruitName;
  difficulty: number;
  random: () => number;
  intro?: boolean;
}): ScheduledFruit {
  const { id, launchAtMs, type, difficulty, random, intro = false } = input;
  const isBomb = type === "bomb";
  const flightReduction = difficulty * (isBomb ? 34 : 28);
  return {
    id,
    launchAtMs: Math.max(0, Math.round(launchAtMs)),
    flightMs: Math.round((intro ? 1_760 : isBomb ? 1_520 + random() * 360 : 1_420 + random() * 420) - flightReduction),
    startX: intro ? 0.44 + random() * 0.12 : 0.07 + random() * 0.86,
    endX: intro ? 0.42 + random() * 0.16 : 0.16 + random() * 0.68,
    peakY: intro ? 0.27 + random() * 0.08 : isBomb ? 0.14 + random() * 0.28 : 0.08 + random() * 0.3,
    rotation: random() * Math.PI * 2,
    rotationSpeed: (random() - 0.5) * 6,
    type,
    isBomb,
  };
}

function nextScheduleBombInterval(difficulty: number, random: () => number): number {
  const minimum = 7_000 - difficulty * 650;
  const maximum = 10_000 - difficulty * 900;
  return minimum + random() * (maximum - minimum);
}

function scheduleBombGap(difficulty: number): number {
  return 42 - difficulty * 8;
}

function hasSafeHazardClearance(
  candidate: ScheduledFruit,
  schedule: ScheduledFruit[],
  minimumGap: number,
): boolean {
  for (let index = schedule.length - 1; index >= 0; index -= 1) {
    const obstacle = schedule[index];
    if (obstacle.launchAtMs + obstacle.flightMs < candidate.launchAtMs) continue;
    if (obstacle.isBomb === candidate.isBomb) continue;
    if (scheduledFruitClearance(candidate, obstacle, { width: 960, height: 540 }) < minimumGap) {
      return false;
    }
  }
  return true;
}

export function scheduledFruitClearance(
  first: ScheduledFruit,
  second: ScheduledFruit,
  viewport: { width: number; height: number },
): number {
  const overlapStart = Math.max(first.launchAtMs, second.launchAtMs);
  const overlapEnd = Math.min(
    first.launchAtMs + first.flightMs,
    second.launchAtMs + second.flightMs,
  );
  if (overlapEnd < overlapStart) return Number.POSITIVE_INFINITY;

  const radius = (fruitRadius(first.type, viewport) + fruitRadius(second.type, viewport)) * 1.12;
  let clearance = Number.POSITIVE_INFINITY;
  const measure = (elapsedMs: number): void => {
    const firstPosition = fruitPosition(first, elapsedMs);
    const secondPosition = fruitPosition(second, elapsedMs);
    if (!firstPosition || !secondPosition) return;
    clearance = Math.min(
      clearance,
      Math.hypot(
        (firstPosition.x - secondPosition.x) * viewport.width,
        (firstPosition.y - secondPosition.y) * viewport.height,
      ) - radius,
    );
  };
  for (let elapsedMs = overlapStart; elapsedMs < overlapEnd; elapsedMs += 32) measure(elapsedMs);
  measure(overlapEnd);
  return clearance;
}

export function fruitPosition(
  fruit: ScheduledFruit,
  elapsedMs: number,
): NormalizedPoint | undefined {
  const progress = (elapsedMs - fruit.launchAtMs) / fruit.flightMs;
  if (progress < 0 || progress > 1) return undefined;
  const centered = progress * 2 - 1;
  return {
    x: fruit.startX + (fruit.endX - fruit.startX) * progress,
    y: fruit.peakY + (1.075 - fruit.peakY) * centered * centered,
  };
}

export function validateSliceClaim(
  fruit: ScheduledFruit,
  claim: SliceClaim,
): boolean {
  if (!Number.isFinite(claim.atMs) || !Number.isFinite(claim.durationMs)) return false;
  if (claim.durationMs < 1 || claim.durationMs > 140) return false;
  const position = fruitPosition(fruit, claim.atMs);
  if (!position) return false;

  const viewport = normalizeViewport(claim.viewport);
  const start = toViewport(claim.start, viewport);
  const end = toViewport(claim.end, viewport);
  const center = toViewport(position, viewport);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const speed = distance / (claim.durationMs / 1000);
  if (speed < MIN_SLICE_SPEED) return false;

  const radius = fruitRadius(fruit.type, viewport) * 1.12;
  return segmentDistanceSquared(start, end, center) <= radius * radius;
}

function normalizeViewport(viewport: SliceClaim["viewport"]): { width: number; height: number } {
  if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
    return { width: CANONICAL_WIDTH, height: CANONICAL_HEIGHT };
  }
  return {
    width: Math.min(3_840, Math.max(960, viewport.width)),
    height: Math.min(2_160, Math.max(540, viewport.height)),
  };
}

function toViewport(
  point: NormalizedPoint,
  viewport: { width: number; height: number },
): NormalizedPoint {
  return {
    x: point.x * viewport.width,
    y: point.y * viewport.height,
  };
}

function segmentDistanceSquared(
  start: NormalizedPoint,
  end: NormalizedPoint,
  point: NormalizedPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.0001) {
    return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  }
  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  const nearestX = start.x + projection * dx;
  const nearestY = start.y + projection * dy;
  return (point.x - nearestX) ** 2 + (point.y - nearestY) ** 2;
}





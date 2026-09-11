import { fruitPosition } from "../shared/match";
import type { Fruit, FruitNinjaState } from "../types";
import {
  GRAVITY,
  LAUNCH_INTERVAL_MAX,
  LAUNCH_INTERVAL_MIN,
} from "../types";
import {
  BOMB_TYPE,
  fruitRadiusForInstance,
  fruitRadiusForViewport,
  fruitTypeByName,
  randomFruitType,
} from "../data/fruits";

export class FruitSystem {
  update(state: FruitNinjaState, dt: number): Fruit[] {
    const missed = state.mode === "endless"
      ? this.updateEndless(state, dt)
      : state.mode === "arcade"
        ? this.updateArcade(state, dt)
        : this.updateScheduled(state, dt);
    this.updateHalves(state, dt);
    state.shake = Math.max(0, state.shake - dt / 180);
    return missed;
  }

  private updateArcade(state: FruitNinjaState, dt: number): Fruit[] {
    const dtSec = dt / 1000;
    for (const fruit of state.fruits) {
      const motion = fruit.motion ?? "ballistic";
      if (motion === "ballistic") {
        fruit.x += fruit.vx * dtSec;
        fruit.vy += GRAVITY * dtSec;
        fruit.y += fruit.vy * dtSec;
      } else if (motion === "rain") {
        fruit.x += fruit.vx * dtSec;
        fruit.vy += 70 * dtSec;
        fruit.y += fruit.vy * dtSec;
      } else if (motion === "linear") {
        fruit.x += fruit.vx * dtSec;
        fruit.y += fruit.vy * dtSec;
      }
      fruit.rotation += fruit.rotationSpeed * dtSec;
    }

    const missed: Fruit[] = [];
    let writeIndex = 0;
    for (let index = 0; index < state.fruits.length; index += 1) {
      const fruit = state.fruits[index];
      const radius = fruitRadiusForInstance(fruit, state.width, state.height);
      const outside = fruit.expiresAtMs !== undefined && state.elapsedMs >= fruit.expiresAtMs
        || fruit.motion === "linear" && (fruit.x < -radius * 2 || fruit.x > state.width + radius * 2)
        || fruit.motion !== "linear" && fruit.motion !== "hover" && fruit.y > state.height + radius * 1.6;
      if (outside) {
        if (!fruit.sliced && !fruit.isBomb && fruit.variant !== "boss") missed.push(fruit);
      } else {
        state.fruits[writeIndex++] = fruit;
      }
    }
    state.fruits.length = writeIndex;
    state.wave = Math.floor(state.elapsedMs / 12_000);
    return missed;
  }

  private updateEndless(state: FruitNinjaState, dt: number): Fruit[] {
    const dtSec = dt / 1000;
    const timeTier = Math.min(6, Math.floor(state.elapsedMs / 25_000));
    if (timeTier > state.endlessTier) {
      state.endlessTier = timeTier;
      state.lastSliceLabel = `难度 ${timeTier + 1}  ·  加速`;
      state.lastSliceLabelTimer = 1_450;
      state.shake = Math.max(state.shake, 0.32);
    }
    state.launchTimer -= dtSec;
    const bombDue = state.elapsedMs >= state.nextBombAtMs;
    if (bombDue) {
      if (this.launchBomb(state)) {
        // Avoid an exact same-frame stack, but keep normal fruit flowing so
        // bombs remain an unannounced part of the wave rather than a cutscene.
        state.launchTimer = Math.max(state.launchTimer, 0.18);
      } else {
        // No safe random trajectory exists right now. Retry shortly without
        // revealing the bomb or forcing it through a fruit cluster.
        state.nextBombAtMs = state.elapsedMs + 180 + Math.random() * 240;
      }
    } else if (state.launchTimer <= 0) {
      const isIntroWave = state.wavesLaunched === 0;
      this.launchNormalWave(state);
      state.launchTimer = isIntroWave ? 1.45 : this.nextLaunchInterval(state);
    }

    for (const fruit of state.fruits) {
      fruit.x += fruit.vx * dtSec;
      fruit.vy += GRAVITY * dtSec;
      fruit.y += fruit.vy * dtSec;
      fruit.rotation += fruit.rotationSpeed * dtSec;
    }

    const missed: Fruit[] = [];
    let writeIndex = 0;
    for (let index = 0; index < state.fruits.length; index += 1) {
      const fruit = state.fruits[index];
      const radius = fruitRadiusForViewport(fruit.type, state.width, state.height);
      const outside = fruit.y > state.height + radius * 1.6;
      if (outside) {
        if (!fruit.sliced && !fruit.isBomb) missed.push(fruit);
      } else {
        state.fruits[writeIndex++] = fruit;
      }
    }
    state.fruits.length = writeIndex;
    state.wave = Math.floor(state.score / 15);
    return missed;
  }

  private nextLaunchInterval(state: FruitNinjaState): number {
    const timeDifficulty = this.endlessDifficulty(state);
    return (LAUNCH_INTERVAL_MIN + Math.random() * (LAUNCH_INTERVAL_MAX - LAUNCH_INTERVAL_MIN))
      / (1 + state.wave * 0.035 + timeDifficulty * 0.48);
  }

  private updateScheduled(state: FruitNinjaState, _dt: number): Fruit[] {
    while (
      state.nextScheduledIndex < state.schedule.length
      && state.schedule[state.nextScheduledIndex].launchAtMs <= state.elapsedMs
    ) {
      const spec = state.schedule[state.nextScheduledIndex++];
      const position = fruitPosition(spec, state.elapsedMs) ?? { x: spec.startX, y: 1.075 };
      state.fruits.push({
        id: spec.id,
        type: fruitTypeByName(spec.type),
        x: position.x * state.width,
        y: position.y * state.height,
        vx: 0,
        vy: 0,
        rotation: spec.rotation,
        rotationSpeed: spec.rotationSpeed,
        sliced: false,
        isBomb: spec.isBomb,
        schedule: spec,
      });
    }

    const missed: Fruit[] = [];
    let writeIndex = 0;
    for (let index = 0; index < state.fruits.length; index += 1) {
      const fruit = state.fruits[index];
      const spec = fruit.schedule;
      if (!spec) continue;
      const position = fruitPosition(spec, state.elapsedMs);
      if (!position) {
        if (state.elapsedMs > spec.launchAtMs + spec.flightMs && !fruit.sliced && !fruit.isBomb) {
          missed.push(fruit);
        }
        continue;
      }

      const next = fruitPosition(spec, state.elapsedMs + 16) ?? position;
      fruit.x = position.x * state.width;
      fruit.y = position.y * state.height;
      fruit.vx = ((next.x - position.x) * state.width) / 0.016;
      fruit.vy = ((next.y - position.y) * state.height) / 0.016;
      fruit.rotation = spec.rotation + spec.rotationSpeed * ((state.elapsedMs - spec.launchAtMs) / 1000);
      state.fruits[writeIndex++] = fruit;
    }
    state.fruits.length = writeIndex;
    state.wave = Math.floor(state.elapsedMs / 15_000);
    return missed;
  }

  private updateHalves(state: FruitNinjaState, dt: number): void {
    const dtSec = dt / 1000;
    let writeIndex = 0;
    for (let index = 0; index < state.halves.length; index += 1) {
      const half = state.halves[index];
      half.x += half.vx * dtSec;
      half.vy += GRAVITY * dtSec;
      half.y += half.vy * dtSec;
      half.rotation += half.rotationSpeed * dtSec;
      half.alpha -= dtSec * 0.58;
      if (half.alpha > 0 && half.y < state.height + 200) state.halves[writeIndex++] = half;
    }
    state.halves.length = writeIndex;
  }

  private launchNormalWave(state: FruitNinjaState): void {
    const isIntroWave = state.wavesLaunched === 0;
    const timeTier = Math.min(6, Math.floor(state.elapsedMs / 25_000));
    const count = isIntroWave
      ? 1
      : 1 + Math.floor(Math.random() * (2 + timeTier));
    for (let index = 0; index < count; index += 1) {
      this.launchNormalFruit(state, isIntroWave);
    }
    state.wavesLaunched += 1;
  }

  private launchNormalFruit(state: FruitNinjaState, isIntroWave: boolean): boolean {
    const activeBombs = state.fruits.filter((fruit) => !fruit.sliced && fruit.isBomb);
    const attempts = activeBombs.length > 0 ? 14 : 1;
    const minimumGap = this.minimumBombGap(state);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const fruit = this.createFruit(state, false, isIntroWave);
      if (activeBombs.length === 0
        || this.trajectoryClearance(state, fruit, activeBombs) >= minimumGap) {
        this.commitFruit(state, fruit);
        return true;
      }
    }
    return false;
  }

  private launchBomb(state: FruitNinjaState): boolean {
    const activeFruit = state.fruits.filter((fruit) => !fruit.sliced && !fruit.isBomb);
    const minimumGap = this.minimumBombGap(state);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const bomb = this.createFruit(state, true, false);
      if (activeFruit.length > 0
        && this.trajectoryClearance(state, bomb, activeFruit) < minimumGap) {
        continue;
      }
      this.commitFruit(state, bomb);
      state.bombsLaunched += 1;
      state.lastBombPattern = bomb.hazardPattern;
      state.lastBombStartRatio = bomb.x / state.width;
      state.nextBombAtMs = state.elapsedMs + this.nextBombInterval(state);
      return true;
    }
    return false;
  }

  private createFruit(
    state: FruitNinjaState,
    isBomb: boolean,
    isIntroWave = false,
  ): Fruit {
    const type = isBomb
      ? BOMB_TYPE
      : isIntroWave ? fruitTypeByName("orange") : randomFruitType();
    const radius = fruitRadiusForViewport(type, state.width, state.height);
    const difficulty = this.endlessDifficulty(state);
    const horizontalTimeScale = 1 - difficulty * 0.16;
    let startX = isIntroWave ? 0.46 + Math.random() * 0.08 : 0.08 + Math.random() * 0.84;
    let targetX = isIntroWave ? 0.47 + Math.random() * 0.06 : 0.2 + Math.random() * 0.6;
    let flightTime = isIntroWave ? 1.75 : (1.28 + Math.random() * 0.55) * horizontalTimeScale;
    let peakYRatio = isIntroWave ? 0.3 : 0.12 + Math.random() * 0.32;

    if (isBomb) {
      // Rotate between visibly different path families. Purely uniform values
      // are technically random but repeatedly look like the same central arc.
      const patternCount = 5;
      let pattern = Math.floor(Math.random() * patternCount);
      if (pattern === state.lastBombPattern) {
        pattern = (pattern + 1 + Math.floor(Math.random() * (patternCount - 1))) % patternCount;
      }
      if (pattern === 0) {
        startX = 0.07 + Math.random() * 0.86;
        targetX = 0.1 + Math.random() * 0.8;
      } else if (pattern === 1) {
        const leftToRight = Math.random() < 0.5;
        startX = leftToRight ? 0.06 + Math.random() * 0.2 : 0.74 + Math.random() * 0.2;
        targetX = leftToRight ? 0.7 + Math.random() * 0.23 : 0.07 + Math.random() * 0.23;
      } else if (pattern === 2) {
        startX = 0.38 + Math.random() * 0.24;
        targetX = Math.random() < 0.5
          ? 0.08 + Math.random() * 0.2
          : 0.72 + Math.random() * 0.2;
      } else if (pattern === 3) {
        const fromLeft = Math.random() < 0.5;
        startX = fromLeft ? 0.06 + Math.random() * 0.18 : 0.76 + Math.random() * 0.18;
        targetX = 0.36 + Math.random() * 0.28;
      } else {
        startX = 0.07 + Math.random() * 0.86;
        targetX = this.clamp(startX + (Math.random() - 0.5) * 0.22, 0.08, 0.92);
      }
      if (state.lastBombStartRatio !== undefined
        && Math.abs(startX - state.lastBombStartRatio) < 0.16) {
        startX = this.clamp(1 - startX, 0.06, 0.94);
      }
      flightTime = (1.36 + Math.random() * 0.46) * horizontalTimeScale;
      peakYRatio = 0.1 + Math.random() * 0.36;
      const bombPattern = pattern;
      const fruit: Fruit = {
        type,
        x: state.width * startX,
        y: state.height + radius * 1.15,
        vx: (targetX * state.width - state.width * startX) / flightTime,
        vy: -(Math.sqrt(2 * GRAVITY * (state.height + radius * 1.15 - state.height * peakYRatio)) || 600),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 6,
        sliced: false,
        isBomb,
        id: 0,
        hazardPattern: bombPattern,
      };
      return fruit;
    }

    const x = state.width * startX;
    const y = state.height + radius * 1.15;
    const peakY = state.height * peakYRatio;
    const fruit: Fruit = {
      type,
      x,
      y,
      vx: (targetX * state.width - x) / flightTime,
      vy: -(Math.sqrt(2 * GRAVITY * (y - peakY)) || 600),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 6,
      sliced: false,
      isBomb,
      id: 0,
    };
    return fruit;
  }

  private commitFruit(state: FruitNinjaState, fruit: Fruit): void {
    fruit.id = state.nextId++;
    state.fruits.push(fruit);
  }

  private trajectoryClearance(
    state: FruitNinjaState,
    candidate: Fruit,
    obstacles: Fruit[],
  ): number {
    let clearance = Number.POSITIVE_INFINITY;
    const candidateRadius = fruitRadiusForInstance(candidate, state.width, state.height);
    for (const obstacle of obstacles) {
      const obstacleRadius = fruitRadiusForInstance(obstacle, state.width, state.height);
      const relativeX = candidate.x - obstacle.x;
      const relativeY = candidate.y - obstacle.y;
      const relativeVx = candidate.vx - obstacle.vx;
      const relativeVy = candidate.vy - obstacle.vy;
      const speedSquared = relativeVx * relativeVx + relativeVy * relativeVy;
      const closestTime = speedSquared > 0.001
        ? this.clamp(
          -(relativeX * relativeVx + relativeY * relativeVy) / speedSquared,
          0,
          2.2,
        )
        : 0;
      const distance = Math.hypot(
        relativeX + relativeVx * closestTime,
        relativeY + relativeVy * closestTime,
      );
      clearance = Math.min(clearance, distance - candidateRadius - obstacleRadius);
    }
    return clearance;
  }

  private minimumBombGap(state: FruitNinjaState): number {
    return Math.max(34, 56 - this.endlessDifficulty(state) * 18);
  }

  private nextBombInterval(state: FruitNinjaState): number {
    const difficulty = this.endlessDifficulty(state);
    const minimum = Math.max(2_400, 5_600 - difficulty * 2_200);
    const maximum = Math.max(minimum + 1_600, 10_600 - difficulty * 3_200);
    const rhythm = Math.random();
    if (difficulty > 0.55 && rhythm < 0.16) {
      return Math.max(2_500, minimum - 650) + Math.random() * 1_350;
    }
    if (rhythm > 0.84) {
      return maximum + Math.random() * Math.max(900, 2_200 - difficulty * 700);
    }
    return minimum + Math.random() * (maximum - minimum);
  }

  private endlessDifficulty(state: FruitNinjaState): number {
    const timePressure = state.elapsedMs / 150_000;
    const scorePressure = state.score / 450;
    return this.clamp(timePressure + scorePressure, 0, 1.6);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }
}


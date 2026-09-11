/**
 * Deterministic wet-splatter geometry adapted from the seeded blob, satellite
 * droplet, gravity trail and curved-drip ideas in Dynamic-Random and ray.js
 * (both MIT). Geometry is created once on impact; rendering never rolls new
 * random values, so stains do not crawl or shimmer between frames.
 */
import { createSeededRandom, hashSeed } from "../shared/match";
import type { FruitNinjaState, JuiceParticle, WallSplatter } from "../types";

export const MAX_WALL_SPLATTERS = 12;
export const MAX_JUICE_PARTICLES = 180;

export interface JuiceImpact {
  seed: string | number;
  x: number;
  y: number;
  width: number;
  height: number;
  baseRadius: number;
  angle: number;
  speed: number;
  intensity: number;
  color: string;
}

export function createWallSplatter(impact: JuiceImpact): WallSplatter {
  const seed = hashSeed(impact.seed);
  const random = createSeededRandom(seed);
  const intensity = clamp(impact.intensity, 0.65, 2.25);
  const pointCount = 16 + Math.floor(random() * 7);
  const outline = Array.from({ length: pointCount }, (_, index) => {
    const angle = (index / pointCount) * Math.PI * 2;
    const forwardBias = Math.max(0, Math.cos(angle)) * 0.2 * intensity;
    const lobe = Math.sin(angle * 3 + random() * 1.4) * 0.11;
    const radius = clamp(0.72 + random() * 0.48 + forwardBias + lobe, 0.55, 1.62);
    return {
      angle,
      radius,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });

  const primaryCount = 8 + Math.floor(random() * 9);
  const reverseCount = 2 + Math.floor(random() * 3);
  const satellites = Array.from({ length: primaryCount + reverseCount }, (_, index) => {
    const reverse = index >= primaryCount;
    const deviation = (random() - 0.5) * (reverse ? 0.64 : Math.PI / 3.6);
    const angle = (reverse ? Math.PI : 0) + deviation;
    const distance = reverse
      ? 0.82 + random() * 1.05
      : 1.05 + random() * (1.45 + intensity * 0.42);
    const radiusX = (0.055 + random() * 0.105) * (reverse ? 0.7 : 1);
    const radiusY = radiusX * (0.26 + random() * 0.34);
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      radiusX,
      radiusY,
      rotation: angle,
      alpha: 0.52 + random() * 0.36,
    };
  });

  const dripCount = 1 + Math.floor(random() * 2);
  const drips = Array.from({ length: dripCount }, () => ({
    offsetX: (random() - 0.5) * 1.22,
    offsetY: 0.2 + random() * 0.52,
    delay: 0.35 + random() * 0.35,
    length: 0.72 + random() * 0.92,
    width: 0.045 + random() * 0.055,
    bend: (random() - 0.5) * 0.42,
    beadRadius: 0.055 + random() * 0.055,
  }));

  return {
    id: seed,
    seed,
    x: clamp(impact.x / Math.max(1, impact.width), -0.1, 1.1),
    y: clamp(impact.y / Math.max(1, impact.height), -0.1, 1.1),
    size: impact.baseRadius * (0.52 + intensity * 0.24),
    angle: impact.angle,
    color: impact.color,
    darkColor: mixHex(impact.color, "#08111f", 0.3 + random() * 0.12),
    alpha: clamp(0.18 + intensity * 0.035 + random() * 0.035, 0.18, 0.28),
    age: 0,
    life: 5.5 + random() * 2.5,
    expandDuration: 0.12 + random() * 0.06,
    outline,
    satellites,
    drips,
  };
}

export function createJuiceParticles(impact: JuiceImpact): JuiceParticle[] {
  const random = createSeededRandom(`${impact.seed}:particles`);
  const intensity = clamp(impact.intensity, 0.65, 2.25);
  const viewportScale = Math.min(1.22, Math.max(0.92, Math.min(impact.width / 1280, impact.height / 720)));
  const count = Math.round((22 + intensity * 12) * viewportScale);
  const result: JuiceParticle[] = [];

  for (let index = 0; index < count; index += 1) {
    const mist = index >= Math.floor(count * 0.72);
    const reverse = index % 11 === 0;
    const spread = reverse ? 0.7 : Math.PI / 3.6;
    const angle = impact.angle + (reverse ? Math.PI : 0) + (random() - 0.5) * spread;
    const speed = (mist ? 120 + random() * 280 : 185 + random() * 480) * viewportScale * (0.72 + intensity * 0.25);
    const life = mist ? 0.45 + random() * 0.38 : 0.58 + random() * 0.52;
    result.push({
      x: impact.x + (random() - 0.5) * impact.baseRadius * 0.16,
      y: impact.y + (random() - 0.5) * impact.baseRadius * 0.16,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (mist ? 55 : 105),
      radius: (mist ? 0.9 + random() * 2.1 : 2.2 + random() * 5.2) * viewportScale,
      color: impact.color,
      alpha: mist ? 0.42 : 0.9,
      life,
      maxLife: life,
      gravity: mist ? 360 : 690,
      stretch: mist ? 1.1 : 1.7 + random() * 1.6,
      mist,
    });
  }
  return result;
}

export function addJuiceImpact(state: FruitNinjaState, impact: JuiceImpact): void {
  state.wallSplatters.push(createWallSplatter(impact));
  state.particles.push(...createJuiceParticles(impact));
  if (state.wallSplatters.length > MAX_WALL_SPLATTERS) {
    state.wallSplatters.splice(0, state.wallSplatters.length - MAX_WALL_SPLATTERS);
  }
  if (state.particles.length > MAX_JUICE_PARTICLES) {
    state.particles.splice(0, state.particles.length - MAX_JUICE_PARTICLES);
  }
}

export function updateJuiceEffects(state: FruitNinjaState, dt: number): void {
  const dtSec = dt / 1000;
  let particleWriteIndex = 0;
  for (let index = 0; index < state.particles.length; index += 1) {
    const particle = state.particles[index];
    particle.x += particle.vx * dtSec;
    particle.vy += (particle.gravity ?? 690) * dtSec;
    particle.y += particle.vy * dtSec;
    particle.life -= dtSec;
    const remaining = Math.max(0, particle.life / particle.maxLife);
    particle.alpha = (particle.mist ? 0.42 : 0.9) * remaining * remaining;
    if (particle.life > 0) state.particles[particleWriteIndex++] = particle;
  }
  state.particles.length = particleWriteIndex;

  let splatterWriteIndex = 0;
  for (let index = 0; index < state.wallSplatters.length; index += 1) {
    const splatter = state.wallSplatters[index];
    splatter.age += dtSec;
    if (splatter.age < splatter.life) state.wallSplatters[splatterWriteIndex++] = splatter;
  }
  state.wallSplatters.length = splatterWriteIndex;
}

export function mixHex(colorA: string, colorB: string, amount: number): string {
  const parse = (color: string): number[] => [1, 3, 5].map(
    (offset) => Number.parseInt(color.slice(offset, offset + 2), 16),
  );
  const a = parse(colorA);
  const b = parse(colorB);
  return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * amount)).join(",")})`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}


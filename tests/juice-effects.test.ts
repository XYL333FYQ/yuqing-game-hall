import { describe, expect, it } from "vitest";
import {
  addJuiceImpact,
  createJuiceParticles,
  createWallSplatter,
  MAX_JUICE_PARTICLES,
  MAX_WALL_SPLATTERS,
  updateJuiceEffects,
  type JuiceImpact,
} from "../public/games/fruit-party/source/effects/JuiceEffects";
import type { FruitNinjaState } from "../public/games/fruit-party/source/types";

const impact: JuiceImpact = {
  seed: 20260828,
  x: 640,
  y: 320,
  width: 1280,
  height: 720,
  baseRadius: 68,
  angle: 0,
  speed: 1_300,
  intensity: 1.4,
  color: "#ff4964",
};

function effectState(): FruitNinjaState {
  return {
    particles: [],
    wallSplatters: [],
  } as unknown as FruitNinjaState;
}

describe("deterministic juice splatter", () => {
  it("builds the same stable irregular geometry for the same impact seed", () => {
    const first = createWallSplatter(impact);
    const second = createWallSplatter(impact);
    expect(first).toEqual(second);
    expect(first.outline.length).toBeGreaterThanOrEqual(16);
    expect(first.outline.length).toBeLessThanOrEqual(22);
    expect(new Set(first.outline.map((point) => point.radius.toFixed(3))).size).toBeGreaterThan(10);
    for (const point of first.outline) {
      expect(point.x).toBeCloseTo(Math.cos(point.angle) * point.radius, 10);
      expect(point.y).toBeCloseTo(Math.sin(point.angle) * point.radius, 10);
    }
    expect(first.drips.length).toBeGreaterThanOrEqual(1);
    expect(first.drips.length).toBeLessThanOrEqual(2);
  });

  it("aims most satellite droplets along the outgoing blade direction", () => {
    const splatter = createWallSplatter(impact);
    const forward = splatter.satellites.filter((drop) => drop.x > 0).length;
    const backward = splatter.satellites.filter((drop) => drop.x < 0).length;
    expect(forward).toBeGreaterThanOrEqual(8);
    expect(forward).toBeGreaterThan(backward);
  });

  it("moves foreground droplets under gravity and recycles expired effects", () => {
    const particles = createJuiceParticles(impact);
    const initialVy = particles[0].vy;
    const state = effectState();
    state.particles = particles;
    state.wallSplatters = [createWallSplatter(impact)];
    const particleArray = state.particles;
    const splatterArray = state.wallSplatters;
    const originalX = state.wallSplatters[0].x;

    updateJuiceEffects(state, 200);
    expect(state.particles).toBe(particleArray);
    expect(state.wallSplatters).toBe(splatterArray);
    expect(state.particles[0].vy).toBeGreaterThan(initialVy);
    expect(state.wallSplatters[0].x).toBe(originalX);
    updateJuiceEffects(state, 9_000);
    expect(state.particles).toHaveLength(0);
    expect(state.wallSplatters).toHaveLength(0);
  });

  it("enforces the wall-stain and live-droplet caps", () => {
    const state = effectState();
    for (let index = 0; index < 20; index += 1) {
      addJuiceImpact(state, { ...impact, seed: index });
    }
    expect(state.wallSplatters).toHaveLength(MAX_WALL_SPLATTERS);
    expect(state.particles.length).toBeLessThanOrEqual(MAX_JUICE_PARTICLES);
    expect(state.wallSplatters[0].seed).not.toBe(createWallSplatter({ ...impact, seed: 0 }).seed);
  });
});

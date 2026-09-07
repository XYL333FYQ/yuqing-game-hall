import { describe, expect, it } from "vitest";
import { musicCueForState } from "../public/games/fruit-party/source/MusicDirector";
import type { FruitNinjaState } from "../public/games/fruit-party/source/types";

function state(overrides: Partial<FruitNinjaState> = {}): FruitNinjaState {
  return {
    started: true,
    gameOver: false,
    paused: false,
    countdownTimer: 0,
    elapsedMs: 0,
    mode: "endless",
    lives: 3,
    rules: { startingLives: 3, missesCostLife: true, bombPenalty: 0, bombEndsGame: true },
    ...overrides,
  } as FruitNinjaState;
}

describe("stage music direction", () => {
  it("stays silent before play and uses a short title cue for countdown", () => {
    expect(musicCueForState(state({ started: false }))).toBeUndefined();
    expect(musicCueForState(state({ countdownTimer: 1_000 }))?.track).toBe("title");
  });

  it("raises endless music intensity every twenty-five seconds", () => {
    expect(musicCueForState(state({ elapsedMs: 0 }))).toMatchObject({ track: "level-1", playbackRate: 0.96 });
    expect(musicCueForState(state({ elapsedMs: 26_000 }))).toMatchObject({ track: "level-1", playbackRate: 1.04 });
    expect(musicCueForState(state({ elapsedMs: 51_000 }))?.track).toBe("level-2");
    expect(musicCueForState(state({ elapsedMs: 101_000 }))?.track).toBe("level-3");
    expect(musicCueForState(state({ elapsedMs: 151_000 }))?.playbackRate).toBe(1.1);
  });

  it("gives arcade transitions, fever and boss their own feel", () => {
    const arcade = {
      phase: "warmup",
      activeEventIndex: -1,
      feverTimer: 0,
    } as FruitNinjaState["arcade"];
    expect(musicCueForState(state({ mode: "arcade", arcade }))?.track).toBe("level-1");
    expect(musicCueForState(state({ mode: "arcade", arcade: { ...arcade!, phase: "transition" } }))?.track).toBe("title");
    expect(musicCueForState(state({ mode: "arcade", arcade: { ...arcade!, phase: "event", activeEventIndex: 1 } }))?.track).toBe("level-2");
    expect(musicCueForState(state({ mode: "arcade", arcade: { ...arcade!, phase: "event", feverTimer: 3_000 } }))?.playbackRate).toBe(1.12);
    expect(musicCueForState(state({ mode: "arcade", arcade: { ...arcade!, phase: "boss" } }))?.volume).toBeGreaterThan(0.2);
  });

  it("switches to the ending cue after a round finishes", () => {
    expect(musicCueForState(state({ gameOver: true }))?.track).toBe("ending");
  });
});

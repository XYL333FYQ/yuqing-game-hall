import { afterEach, describe, expect, it, vi } from "vitest";
import { GameAudio } from "../public/games/fruit-party/source/GameAudio";

afterEach(() => vi.unstubAllGlobals());

describe("game audio activation", () => {
  it("does not create an AudioContext before an explicit user-gesture unlock", () => {
    const AudioContextMock = vi.fn();
    vi.stubGlobal("AudioContext", AudioContextMock);
    const audio = new GameAudio();

    audio.play({ type: "miss", fruitId: 1, elapsedMs: 1_000, lives: 3 });

    expect(AudioContextMock).not.toHaveBeenCalled();
  });
});

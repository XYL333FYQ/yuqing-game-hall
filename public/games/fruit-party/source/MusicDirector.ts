import type { FruitNinjaState } from "./types";

export type MusicTrack = "title" | "level-1" | "level-2" | "level-3" | "ending";

export interface MusicCue {
  track: MusicTrack;
  playbackRate: number;
  volume: number;
  loop: boolean;
}

interface MusicChannel {
  element: HTMLAudioElement;
  cue: MusicCue;
}

const TRACK_URLS: Record<MusicTrack, string> = {
  title: "/games/fruit-party/assets/music/title.ogg",
  "level-1": "/games/fruit-party/assets/music/level-1.ogg",
  "level-2": "/games/fruit-party/assets/music/level-2.ogg",
  "level-3": "/games/fruit-party/assets/music/level-3.ogg",
  ending: "/games/fruit-party/assets/music/ending.ogg",
};

const FADE_MS = 720;

export class MusicDirector {
  private current?: MusicChannel;
  private outgoing?: MusicChannel;
  private desired?: MusicCue;
  private unlocked = false;
  private muted = false;
  private paused = false;
  private fadeFrame = 0;
  private fadeToken = 0;
  private fadeTarget?: MusicChannel;

  unlock(): void {
    this.unlocked = true;
    this.resumeDesired();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.pauseChannels();
    else this.resumeDesired();
  }

  sync(state: Readonly<FruitNinjaState>): void {
    this.paused = state.paused;
    const cue = musicCueForState(state);
    this.desired = cue;
    if (!cue) {
      this.stopChannels();
      return;
    }

    const current = this.current;
    if (!current || current.cue.track !== cue.track) {
      this.switchTrack(cue);
    } else {
      current.cue = cue;
      current.element.loop = cue.loop;
      current.element.playbackRate = cue.playbackRate;
      if (!this.shouldPause()) {
        if (this.fadeTarget !== current) current.element.volume = cue.volume;
        if (current.element.paused) void current.element.play().catch(() => undefined);
      }
    }

    if (this.shouldPause()) this.pauseChannels();
  }

  destroy(): void {
    this.stopChannels();
    this.desired = undefined;
    this.unlocked = false;
  }

  private switchTrack(cue: MusicCue): void {
    if (typeof Audio === "undefined") return;
    this.cancelFade();
    if (this.outgoing) {
      this.outgoing.element.pause();
      this.outgoing = undefined;
    }

    const previous = this.current;
    const element = new Audio(TRACK_URLS[cue.track]);
    element.preload = "auto";
    element.loop = cue.loop;
    element.playbackRate = cue.playbackRate;
    element.volume = 0;
    if ("preservesPitch" in element) element.preservesPitch = false;
    const next = { element, cue };
    this.current = next;

    if (this.shouldPause()) {
      previous?.element.pause();
      element.volume = cue.volume;
      return;
    }

    void element.play().then(() => {
      if (this.current !== next) {
        element.pause();
        return;
      }
      this.crossFade(previous, next);
    }).catch(() => undefined);
  }

  private crossFade(previous: MusicChannel | undefined, next: MusicChannel): void {
    if (!previous) {
      next.element.volume = next.cue.volume;
      return;
    }
    this.outgoing = previous;
    this.fadeTarget = next;
    const token = ++this.fadeToken;
    const startedAt = performance.now();
    const previousVolume = previous.element.volume;
    const step = (now: number): void => {
      if (token !== this.fadeToken) return;
      const progress = Math.min(1, (now - startedAt) / FADE_MS);
      const eased = progress * progress * (3 - 2 * progress);
      previous.element.volume = previousVolume * (1 - eased);
      next.element.volume = next.cue.volume * eased;
      if (progress < 1) {
        this.fadeFrame = requestAnimationFrame(step);
        return;
      }
      previous.element.pause();
      previous.element.currentTime = 0;
      if (this.outgoing === previous) this.outgoing = undefined;
      if (this.fadeTarget === next) this.fadeTarget = undefined;
    };
    this.fadeFrame = requestAnimationFrame(step);
  }

  private resumeDesired(): void {
    if (this.shouldPause() || !this.desired) return;
    if (!this.current || this.current.cue.track !== this.desired.track) {
      this.switchTrack(this.desired);
      return;
    }
    this.current.element.volume = this.desired.volume;
    this.current.element.playbackRate = this.desired.playbackRate;
    if (this.current.element.paused) void this.current.element.play().catch(() => undefined);
  }

  private pauseChannels(): void {
    if (this.current && !this.current.element.paused) this.current.element.pause();
    if (this.outgoing && !this.outgoing.element.paused) this.outgoing.element.pause();
  }

  private shouldPause(): boolean {
    const backgrounded = typeof document !== "undefined" && document.hidden;
    return !this.unlocked || this.muted || this.paused || backgrounded;
  }

  private stopChannels(): void {
    this.cancelFade();
    for (const channel of [this.current, this.outgoing]) {
      if (!channel) continue;
      if (!channel.element.paused) channel.element.pause();
      channel.element.removeAttribute("src");
      channel.element.load();
    }
    this.current = undefined;
    this.outgoing = undefined;
  }

  private cancelFade(): void {
    this.fadeToken += 1;
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = 0;
    this.fadeTarget = undefined;
  }
}

export function musicCueForState(state: Readonly<FruitNinjaState>): MusicCue | undefined {
  if (!state.started) return undefined;
  if (state.gameOver) return cue("ending", 1, 0.145);
  if (state.countdownTimer > 0) return cue("title", 1, 0.14);

  if (state.mode === "endless") {
    const tier = Math.min(6, Math.floor(state.elapsedMs / 25_000));
    if (tier === 0) return cue("level-1", 0.96, 0.14);
    if (tier === 1) return cue("level-1", 1.04, 0.15);
    if (tier === 2) return cue("level-2", 0.98, 0.16);
    if (tier === 3) return cue("level-2", 1.06, 0.17);
    if (tier === 4) return cue("level-3", 0.98, 0.18);
    if (tier === 5) return cue("level-3", 1.05, 0.19);
    return cue("level-3", 1.1, 0.2);
  }

  if (state.mode === "arcade" && state.arcade) {
    const arcade = state.arcade;
    if (arcade.feverTimer > 0) return cue("level-3", 1.12, 0.205);
    if (arcade.phase === "warmup") return cue("level-1", 0.97, 0.14);
    if (arcade.phase === "transition") return cue("title", 1, 0.125);
    if (arcade.phase === "boss-warning") return cue("level-3", 0.88, 0.15);
    if (arcade.phase === "boss") return cue("level-3", 1.1, 0.21);
    if (arcade.activeEventIndex <= 0) return cue("level-1", 1.05, 0.155);
    if (arcade.activeEventIndex === 1) return cue("level-2", 1.02, 0.17);
    return cue("level-3", 1.02, 0.185);
  }

  const duration = Math.max(1, state.rules.durationMs ?? 90_000);
  const progress = state.elapsedMs / duration;
  if (state.lives === 1 || progress >= 0.72) return cue("level-3", 1.05, 0.19);
  if (progress >= 0.36) return cue("level-2", 1, 0.17);
  return cue("level-1", 0.98, 0.15);
}

function cue(track: MusicTrack, playbackRate: number, volume: number): MusicCue {
  return { track, playbackRate, volume, loop: true };
}


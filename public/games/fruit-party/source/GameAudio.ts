import type { GameEvent } from "./types";
import type { FruitNinjaState } from "./types";
import { MusicDirector } from "./MusicDirector";

export class GameAudio {
  private context?: AudioContext;
  private muted = false;
  private unlocked = false;
  private readonly noiseBuffers = new Map<number, AudioBuffer>();
  private readonly music = new MusicDirector();
  private lastMissAt = -Infinity;
  private sliceSoundQueued = false;
  private pendingPerfectSlice = false;

  constructor() {
    try {
      this.muted = localStorage.getItem("yuqing-game-muted") === "1";
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    }
    this.music.setMuted(this.muted);
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.music.setMuted(muted);
    try {
      localStorage.setItem("yuqing-game-muted", muted ? "1" : "0");
    } catch {
      // Muting still works for the current page without persistence.
    }
  }

  /** Must be called from a click/pointer gesture so browser autoplay rules do
   * not silently swallow the first several game sounds. */
  unlock(): void {
    if (this.muted) return;
    this.unlocked = true;
    this.music.unlock();
    const context = this.ensureContext();
    if (!context) return;
    try {
      if (context.state === "suspended") void context.resume().catch(() => undefined);
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(context.destination);
      source.start();
    } catch {
      // Audio is optional and must never interrupt input handling.
    }
  }

  destroy(): void {
    const context = this.context;
    this.context = undefined;
    this.unlocked = false;
    this.sliceSoundQueued = false;
    this.pendingPerfectSlice = false;
    this.noiseBuffers.clear();
    this.music.destroy();
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }

  syncMusic(state: Readonly<FruitNinjaState>): void {
    this.music.sync(state);
  }

  play(event: GameEvent): void {
    if (this.muted || !this.unlocked) return;
    const context = this.ensureContext();
    if (!context) return;
    try {
      if (context.state === "suspended") void context.resume().catch(() => undefined);
      if (event.type === "miss") {
        if (context.currentTime - this.lastMissAt < 0.08) return;
        this.lastMissAt = context.currentTime;
        this.playMiss(context);
      } else if (event.type === "arcade-cue") {
        this.playArcadeCue(context, event.cue);
      } else if (event.isBomb) {
        this.playBomb(context);
      } else {
        this.queueSliceSound(context, event.perfect);
      }
    } catch {
      // A failed audio node must not abort scoring or the render loop.
    }
  }

  private ensureContext(): AudioContext | undefined {
    if (this.context) return this.context;
    try {
      this.context = new AudioContext();
      return this.context;
    } catch {
      return undefined;
    }
  }

  private playMiss(context: AudioContext): void {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(185, now);
    oscillator.frequency.exponentialRampToValueAtTime(92, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.21);
  }

  private playSlice(context: AudioContext, perfect: boolean): void {
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer(context, 0.16);
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime((perfect ? 2_450 : 1_850) + Math.random() * 500, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.14);
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(perfect ? 0.105 : 0.075, now + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    source.connect(filter).connect(noiseGain).connect(context.destination);

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime((perfect ? 330 : 205) + Math.random() * 35, now);
    oscillator.frequency.exponentialRampToValueAtTime(92, now + 0.095);
    gain.gain.setValueAtTime(0.032, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    oscillator.connect(gain).connect(context.destination);
    source.start(now);
    source.stop(now + 0.17);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  }

  /** A single blade segment can hit several fruit synchronously. Collapse that
   * burst into one richer slash sound so a dense wave does not allocate dozens
   * of Web Audio nodes in the same render frame. */
  private queueSliceSound(context: AudioContext, perfect: boolean): void {
    this.pendingPerfectSlice ||= perfect;
    if (this.sliceSoundQueued) return;
    this.sliceSoundQueued = true;
    queueMicrotask(() => {
      this.sliceSoundQueued = false;
      const pendingPerfect = this.pendingPerfectSlice;
      this.pendingPerfectSlice = false;
      if (this.muted || !this.unlocked || this.context !== context) return;
      try {
        this.playSlice(context, pendingPerfect);
      } catch {
        // Sound effects remain optional under device or browser pressure.
      }
    });
  }

  private playArcadeCue(
    context: AudioContext,
    cue: "event" | "event-complete" | "fever" | "boss-warning" | "boss-break",
  ): void {
    const now = context.currentTime;
    const notes = cue === "fever"
      ? [440, 660, 880]
      : cue === "event-complete" || cue === "boss-break"
        ? [392, 523, 784]
        : cue === "boss-warning" ? [130, 98] : [294, 392];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startsAt = now + index * (cue === "boss-warning" ? 0.16 : 0.07);
      oscillator.type = cue === "boss-warning" ? "sawtooth" : "sine";
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.exponentialRampToValueAtTime(cue === "fever" ? 0.08 : 0.052, startsAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startsAt);
      oscillator.stop(startsAt + 0.24);
    });
  }

  private playBomb(context: AudioContext): void {
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer(context, 0.58);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1_100, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.54);
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.21, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    source.connect(filter).connect(noiseGain).connect(context.destination);

    const thump = context.createOscillator();
    const thumpGain = context.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(105, now);
    thump.frequency.exponentialRampToValueAtTime(36, now + 0.42);
    thumpGain.gain.setValueAtTime(0.18, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    thump.connect(thumpGain).connect(context.destination);
    source.start(now);
    source.stop(now + 0.6);
    thump.start(now);
    thump.stop(now + 0.48);
  }

  private noiseBuffer(context: AudioContext, duration: number): AudioBuffer {
    const cacheKey = Math.round(duration * 1_000);
    const cached = this.noiseBuffers.get(cacheKey);
    if (cached) return cached;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const envelope = 1 - index / data.length;
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    this.noiseBuffers.set(cacheKey, buffer);
    return buffer;
  }
}


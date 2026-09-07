import type { FruitNinjaEngine } from "./FruitNinjaEngine";

interface PointerSample {
  x: number;
  y: number;
  time: number;
}

export class PointerBladeController {
  private activePointer?: number;
  private previous?: PointerSample;
  private readonly bladeId = "pointer-0";

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly engine: FruitNinjaEngine,
  ) {
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("lostpointercapture", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("contextmenu", this.preventContextMenu);
  }

  destroy(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("lostpointercapture", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    this.activePointer = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    const sample = this.toSample(event);
    this.previous = sample;
    this.engine.setBladeActive(this.bladeId, true, sample.x, sample.y, sample.time);
    this.canvas.classList.add("is-slicing");
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!event.isPrimary) return;
    if (this.activePointer !== event.pointerId) {
      const sample = this.toSample(event);
      this.engine.updateBlade(this.bladeId, sample.x, sample.y, sample.time, 0, 0, 0, false);
      return;
    }

    event.preventDefault();
    const coalesced = event.getCoalescedEvents?.() ?? [];
    const samples = coalesced.length > 0 ? [...coalesced] : [event];
    const last = samples.at(-1);
    if (
      last
      && (last.clientX !== event.clientX || last.clientY !== event.clientY || last.timeStamp !== event.timeStamp)
    ) {
      samples.push(event);
    }
    for (const pointerEvent of samples) this.pushActiveSample(pointerEvent);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.activePointer !== event.pointerId) return;
    const sample = this.toSample(event);
    this.engine.setBladeActive(this.bladeId, false, sample.x, sample.y, sample.time);
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.activePointer = undefined;
    this.previous = undefined;
    this.canvas.classList.remove("is-slicing");
  };

  private readonly onPointerLeave = (): void => {
    if (this.activePointer === undefined) this.engine.hideBlade(this.bladeId);
  };

  private readonly preventContextMenu = (event: Event): void => event.preventDefault();

  private pushActiveSample(event: PointerEvent): void {
    const sample = this.toSample(event);
    const previous = this.previous ?? sample;
    const dt = Math.max(1, sample.time - previous.time);
    const dx = sample.x - previous.x;
    const dy = sample.y - previous.y;
    const velocityX = (dx / dt) * 1000;
    const velocityY = (dy / dt) * 1000;
    const speed = Math.hypot(velocityX, velocityY);
    this.engine.updateBlade(
      this.bladeId,
      sample.x,
      sample.y,
      sample.time,
      speed,
      velocityX,
      velocityY,
      true,
    );
    this.previous = sample;
  }

  private toSample(event: PointerEvent): PointerSample {
    const bounds = this.canvas.getBoundingClientRect();
    const time = normalizeEventTime(event.timeStamp);
    const viewport = this.engine.getState();
    return {
      x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * viewport.width,
      y: ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * viewport.height,
      time,
    };
  }
}

function normalizeEventTime(timeStamp: number): number {
  const candidate = timeStamp > performance.timeOrigin
    ? timeStamp - performance.timeOrigin
    : timeStamp;
  return Number.isFinite(candidate) && Math.abs(candidate - performance.now()) < 60_000
    ? candidate
    : performance.now();
}


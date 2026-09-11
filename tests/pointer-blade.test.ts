import { describe, expect, it, vi } from "vitest";
import type { FruitNinjaEngine } from "../games/fruit-party/src/FruitNinjaEngine";
import { PointerBladeController } from "../games/fruit-party/src/PointerBladeController";

type PointerListener = (event: PointerEvent) => void;

class FakeCanvas {
  width = 1_000;
  height = 500;
  readonly captured = new Set<number>();
  readonly classes = new Set<string>();
  private readonly listeners = new Map<string, Set<PointerListener>>();

  readonly classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
    contains: (name: string) => this.classes.has(name),
  };

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callbacks = this.listeners.get(type) ?? new Set<PointerListener>();
    callbacks.add(listener as PointerListener);
    this.listeners.set(type, callbacks);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener as PointerListener);
  }

  dispatch(type: string, event: PointerEvent): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  listenerCount(): number {
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0);
  }

  setPointerCapture(pointerId: number): void {
    this.captured.add(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.captured.delete(pointerId);
  }

  getBoundingClientRect(): DOMRect {
    return {
      left: 10,
      top: 20,
      width: 500,
      height: 250,
      right: 510,
      bottom: 270,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    };
  }
}

function pointerEvent(
  input: Partial<PointerEvent> & { pointerId: number; clientX: number; clientY: number },
): PointerEvent {
  return {
    isPrimary: true,
    button: 0,
    timeStamp: performance.now(),
    preventDefault: vi.fn(),
    getCoalescedEvents: () => [],
    ...input,
  } as PointerEvent;
}

function setup(): {
  canvas: FakeCanvas;
  controller: PointerBladeController;
  updateBlade: ReturnType<typeof vi.fn>;
  setBladeActive: ReturnType<typeof vi.fn>;
  hideBlade: ReturnType<typeof vi.fn>;
} {
  const canvas = new FakeCanvas();
  const updateBlade = vi.fn();
  const setBladeActive = vi.fn();
  const hideBlade = vi.fn();
  const engine = {
    updateBlade,
    setBladeActive,
    hideBlade,
    getState: () => ({ width: 1_000, height: 500 }),
  } as unknown as FruitNinjaEngine;
  const controller = new PointerBladeController(canvas as unknown as HTMLCanvasElement, engine);
  return { canvas, controller, updateBlade, setBladeActive, hideBlade };
}

describe("mouse blade input", () => {
  it("shows an inactive aim point while hovering", () => {
    const { canvas, controller, updateBlade } = setup();
    canvas.dispatch("pointermove", pointerEvent({ pointerId: 4, clientX: 260, clientY: 145 }));

    expect(updateBlade).toHaveBeenCalledTimes(1);
    expect(updateBlade.mock.calls[0].slice(0, 3)).toEqual(["pointer-0", 500, 250]);
    expect(updateBlade.mock.calls[0][7]).toBe(false);
    controller.destroy();
  });

  it("uses every coalesced sample only while the left button is held", () => {
    const { canvas, controller, updateBlade, setBladeActive } = setup();
    const startedAt = performance.now();
    canvas.dispatch("pointerdown", pointerEvent({
      pointerId: 7,
      clientX: 60,
      clientY: 70,
      timeStamp: startedAt,
    }));

    const first = pointerEvent({ pointerId: 7, clientX: 110, clientY: 95, timeStamp: startedAt + 8 });
    const second = pointerEvent({ pointerId: 7, clientX: 210, clientY: 145, timeStamp: startedAt + 16 });
    canvas.dispatch("pointermove", pointerEvent({
      pointerId: 7,
      clientX: 210,
      clientY: 145,
      timeStamp: startedAt + 16,
      getCoalescedEvents: () => [first, second],
    }));

    expect(setBladeActive.mock.calls[0][1]).toBe(true);
    expect(canvas.captured.has(7)).toBe(true);
    expect(canvas.classList.contains("is-slicing")).toBe(true);
    expect(updateBlade).toHaveBeenCalledTimes(2);
    expect(updateBlade.mock.calls.every((call) => call[7] === true)).toBe(true);
    expect(updateBlade.mock.calls[1][4]).toBeGreaterThan(0);

    canvas.dispatch("pointerup", pointerEvent({
      pointerId: 7,
      clientX: 210,
      clientY: 145,
      timeStamp: startedAt + 18,
    }));
    expect(setBladeActive.mock.calls.at(-1)?.[1]).toBe(false);
    expect(canvas.captured.has(7)).toBe(false);
    expect(canvas.classList.contains("is-slicing")).toBe(false);
    controller.destroy();
  });

  it("keeps a captured drag alive across the edge and ends it on cancellation", () => {
    const { canvas, controller, setBladeActive, hideBlade } = setup();
    canvas.dispatch("pointerdown", pointerEvent({ pointerId: 9, clientX: 50, clientY: 50 }));
    canvas.dispatch("pointerleave", pointerEvent({ pointerId: 9, clientX: 0, clientY: 0 }));
    expect(hideBlade).not.toHaveBeenCalled();

    canvas.dispatch("pointercancel", pointerEvent({ pointerId: 9, clientX: 0, clientY: 0 }));
    expect(setBladeActive.mock.calls.at(-1)?.[1]).toBe(false);
    expect(canvas.captured.has(9)).toBe(false);

    canvas.dispatch("pointerleave", pointerEvent({ pointerId: 9, clientX: 0, clientY: 0 }));
    expect(hideBlade).toHaveBeenCalledWith("pointer-0");
    controller.destroy();
    expect(canvas.listenerCount()).toBe(0);
  });
});

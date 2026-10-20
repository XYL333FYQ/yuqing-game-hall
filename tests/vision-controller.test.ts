import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VisionController } from "../src/vision/VisionController";
import type { VisionStatus } from "../src/vision/types";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: (event: unknown) => void;
  messages: Record<string, unknown>[] = [];
  constructor() { FakeWorker.instances.push(this); }
  postMessage(message: Record<string, unknown>): void { this.messages.push(message); }
  terminate(): void {}
  emit(data: Record<string, unknown>): void { this.onmessage?.({ data }); }
}

describe("vision frame lifecycle", () => {
  let controller: VisionController;
  let callback: VideoFrameRequestCallback;
  let status: ReturnType<typeof vi.fn<(status: VisionStatus) => void>>;
  let bitmap: { close: ReturnType<typeof vi.fn> };
  let createBitmap: ReturnType<typeof vi.fn>;
  let now: number;
  let currentTime: number;

  beforeEach(() => {
    FakeWorker.instances = [];
    now = 0;
    currentTime = 1;
    bitmap = { close: vi.fn() };
    createBitmap = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("createImageBitmap", createBitmap);
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ drawImage: vi.fn() }) }) });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({
      active: true, getTracks: () => [{ stop: vi.fn() }], getVideoTracks: () => [{getSettings: () => ({width: 640, height: 360})}],
    }) } });
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const video = {
      readyState: 2,
      get currentTime() { return currentTime; },
      play: async () => {},
      requestVideoFrameCallback: (cb: VideoFrameRequestCallback) => { callback = cb; return 1; },
      cancelVideoFrameCallback: vi.fn(),
    } as unknown as HTMLVideoElement;
    status = vi.fn();
    controller = new VisionController(video, vi.fn(), status);
  });

  afterEach(() => {
    controller.stop();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function start(): Promise<FakeWorker> {
    const pending = controller.start("hands");
    await vi.waitFor(() => expect(FakeWorker.instances.length).toBeGreaterThan(0));
    const worker = FakeWorker.instances.at(-1)!;
    worker.emit({ type: "INIT_DONE", delegate: "GPU" });
    await pending;
    return worker;
  }

  function tick(): void {
    now += 34;
    currentTime += 1 / 30;
    callback(now, { mediaTime: currentTime } as VideoFrameCallbackMetadata);
  }

  it("drops an old asynchronous capture when a new model starts", async () => {
    const old = await start();
    let resolve!: (value: typeof bitmap) => void;
    createBitmap.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    tick();
    const switched = controller.start("holistic");
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    const next = FakeWorker.instances[1];
    next.emit({ type: "INIT_DONE", delegate: "GPU" });
    await switched;
    resolve(bitmap);
    await Promise.resolve();
    expect(next.messages.filter(m => m.type === "DETECT_VIDEO")).toHaveLength(0);
    expect(old.messages.filter(m => m.type === "DETECT_VIDEO")).toHaveLength(0);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("restores GPU reporting after a previous CPU fallback", async () => {
    const worker = await start();
    worker.emit({ type: "DELEGATE_FALLBACK" });
    const pending = controller.start("holistic");
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    FakeWorker.instances[1].emit({ type: "INIT_DONE", delegate: "GPU" });
    await pending;
    expect(status.mock.calls.at(-1)?.[0].delegate).toBe("GPU");
  });

  it("keeps only one frame in flight and resumes after a frame error", async () => {
    const worker = await start();
    tick();
    await Promise.resolve();
    tick();
    expect(createBitmap).toHaveBeenCalledOnce();
    worker.emit({ type: "DETECT_ERROR", error: "test failure" });
    tick();
    await Promise.resolve();
    expect(createBitmap).toHaveBeenCalledTimes(2);
  });

  it("uses the newest camera frame immediately after inference without processing duplicates", async () => {
    const worker = await start();
    tick();
    await Promise.resolve();
    tick(); // New camera frame while the worker is busy.
    worker.emit({type: "DETECT_RESULT", result: {landmarks: [], handedness: []}, timestampMs: 34, inferenceTime: 40});
    await Promise.resolve();
    expect(createBitmap).toHaveBeenCalledTimes(2);
    worker.emit({type: "DETECT_RESULT", result: {landmarks: [], handedness: []}, timestampMs: 68, inferenceTime: 10});
    await Promise.resolve();
    expect(createBitmap).toHaveBeenCalledTimes(2);
  });

  it("settles a model startup immediately when the camera is stopped", async () => {
    const pending = controller.start("hands");
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    controller.stop();
    const result = await Promise.race([
      pending.then(() => "stopped"),
      new Promise(resolve => setTimeout(() => resolve("still waiting"), 30)),
    ]);
    expect(result).toBe("stopped");
  });

  it("closes a camera granted after the user has already stopped startup", async () => {
    let resolve!: (value: unknown) => void;
    navigator.mediaDevices.getUserMedia = vi.fn().mockReturnValue(new Promise(r => { resolve = r; }));
    const stop = vi.fn();
    const pending = controller.start("hands");
    controller.stop();
    resolve({active: true, getTracks: () => [{stop}], getVideoTracks: () => [{getSettings: () => ({})}]});
    await pending;
    expect(stop).toHaveBeenCalledOnce();
    expect(FakeWorker.instances).toHaveLength(0);
  });
});

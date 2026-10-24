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
  terminate = vi.fn();
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
  let stopTrack: ReturnType<typeof vi.fn>;
  let video: HTMLVideoElement;

  beforeEach(() => {
    FakeWorker.instances = [];
    now = 0;
    currentTime = 1;
    bitmap = { close: vi.fn() };
    createBitmap = vi.fn().mockResolvedValue(bitmap);
    stopTrack = vi.fn();
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("createImageBitmap", createBitmap);
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ drawImage: vi.fn() }) }) });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({
      active: true, getTracks: () => [{ stop: stopTrack }], getVideoTracks: () => [{getSettings: () => ({width: 640, height: 360})}],
    }) } });
    vi.spyOn(performance, "now").mockImplementation(() => now);
    video = {
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
    const count = FakeWorker.instances.length;
    const pending = controller.start("hands");
    await vi.waitFor(() => expect(FakeWorker.instances.length).toBe(count + 1));
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

  it("does not mistake video clock advancement for a newly presented camera frame", async () => {
    const worker = await start();
    tick();
    await Promise.resolve();
    currentTime += 1 / 60; // The playback clock advances without a new video-frame callback.
    now += 16;
    worker.emit({ type: "DETECT_RESULT", result: { landmarks: [], handedness: [] }, timestampMs: 34, inferenceTime: 16 });
    await Promise.resolve();
    expect(createBitmap).toHaveBeenCalledOnce();
  });

  it("keeps the pending camera sample timestamp when inference finishes later", async () => {
    const worker = await start();
    tick();
    await Promise.resolve();
    tick();
    now = 90;
    worker.emit({ type: "DETECT_RESULT", result: { landmarks: [], handedness: [] }, timestampMs: 34, inferenceTime: 56 });
    await Promise.resolve();
    const requests = worker.messages.filter(message => message.type === "DETECT_VIDEO");
    expect(requests).toHaveLength(2);
    expect(requests[1].timestampMs).toBe(68);
  });

  it("keeps frame deduplication and camera metrics in the animation-frame fallback", async () => {
    Object.defineProperty(video, "requestVideoFrameCallback", { value: undefined });
    let fallback!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => { fallback = next; return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const worker = await start();
    now = 34;
    fallback(now);
    await Promise.resolve();
    now = 50;
    fallback(now);
    worker.emit({ type: "DETECT_RESULT", result: { landmarks: [], handedness: [] }, timestampMs: 34, inferenceTime: 16 });
    expect(status.mock.calls.at(-1)?.[0].cameraFps).toBe(1);
    expect(createBitmap).toHaveBeenCalledOnce();
    currentTime += 1 / 30;
    now = 68;
    fallback(now);
    await Promise.resolve();
    expect(createBitmap).toHaveBeenCalledTimes(2);
  });

  it("uses decoded frame counts when the fallback playback clock changes continuously", async () => {
    Object.defineProperty(video, "requestVideoFrameCallback", { value: undefined });
    let decodedFrames = 1;
    Object.defineProperty(video, "getVideoPlaybackQuality", { value: () => ({ totalVideoFrames: decodedFrames, droppedVideoFrames: 0 }) });
    let fallback!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => { fallback = next; return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const worker = await start();
    fallback(34);
    await Promise.resolve();
    worker.emit({ type: "DETECT_RESULT", result: { landmarks: [], handedness: [] }, timestampMs: 34, inferenceTime: 1 });
    currentTime += 1 / 120;
    fallback(42);
    await Promise.resolve();
    expect(createBitmap).toHaveBeenCalledOnce();
    decodedFrames++;
    fallback(68);
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

  it.each(["worker-error", "error-message"])("stops the camera and reports a %s after successful initialization", async kind => {
    const worker = await start();
    tick();
    await Promise.resolve();
    if (kind === "worker-error") worker.onerror?.({ message: "Worker crashed" });
    else worker.emit({ type: "ERROR", error: "Worker crashed" });
    expect(status.mock.calls.at(-1)?.[0]).toMatchObject({ phase: "error", message: "Worker crashed" });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(worker.terminate).toHaveBeenCalledOnce();
    tick();
    expect(createBitmap).toHaveBeenCalledOnce();
  });

  it("ignores errors from a replaced worker and can restart after a runtime failure", async () => {
    const old = await start();
    old.onerror?.({ message: "First worker crashed" });
    const next = await start();
    status.mockClear();
    old.onerror?.({ message: "Stale error" });
    old.emit({ type: "ERROR", error: "Stale message" });
    expect(status).not.toHaveBeenCalled();
    tick();
    await Promise.resolve();
    expect(next.messages.filter(message => message.type === "DETECT_VIDEO")).toHaveLength(1);
  });
});

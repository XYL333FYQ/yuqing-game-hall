import { afterEach, expect, it, vi } from "vitest";

const detect = vi.hoisted(() => vi.fn());
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  HolisticLandmarker: { createFromOptions: async () => ({ detectForVideo: detect }) },
}));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });

it("reports a failed holistic frame so the controller can continue with the next frame", async () => {
  const scope = { onmessage: undefined as unknown, postMessage: vi.fn(), location: { origin: "http://localhost" } };
  vi.stubGlobal("self", scope);
  await import("../src/vision/workers/holistic-landmarker.worker");
  const message = scope.onmessage as (event: { data: unknown }) => Promise<void>;
  await message({ data: { type: "INIT", modelAssetPath: "/models/holistic_landmarker.task", delegate: "GPU", runningMode: "VIDEO" } });
  detect.mockImplementationOnce(() => { throw new Error("lost frame"); }).mockReturnValueOnce({ poseLandmarks: [] });
  const bitmap = { close: vi.fn() };
  await message({ data: { type: "DETECT_VIDEO", bitmap, timestampMs: 1 } });
  expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({type: "DETECT_ERROR"}));
  expect(bitmap.close).toHaveBeenCalledOnce();
  await message({ data: { type: "DETECT_VIDEO", bitmap, timestampMs: 2 } });
  expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({type: "DETECT_RESULT", timestampMs: 2}));
});

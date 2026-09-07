import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type VisionMode = "hands" | "holistic";

export interface DetectedHand {
  id: string;
  handedness: "left" | "right" | "unknown";
  score: number;
  landmarks: NormalizedLandmark[];
}

export interface VisionFrame {
  mode: VisionMode;
  timestamp: number;
  inferenceMs: number;
  hands: DetectedHand[];
  pose: NormalizedLandmark[];
  face: NormalizedLandmark[];
}

export interface VisionStatus {
  phase: "idle" | "camera" | "model" | "ready" | "error";
  message: string;
  inferenceMs?: number;
  detectionFps?: number;
  cameraFps?: number;
  pipelineLatencyMs?: number;
  cameraWidth?: number;
  cameraHeight?: number;
  backend?: "hand-landmarker" | "holistic";
  delegate?: "GPU" | "CPU";
}

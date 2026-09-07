import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { VisionFrame } from "./types";

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32],
];

export class VisionOverlayRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.canvas.width = 640;
    this.canvas.height = 360;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建视觉预览画布。");
    this.ctx = context;
  }

  render(frame: VisionFrame): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const hand of frame.hands) {
      const isLeft = hand.handedness === "left";
      this.drawConnections(hand.landmarks, HAND_CONNECTIONS, isLeft ? "#55e7ff" : "#ffe889", 3);
      this.drawPoints(hand.landmarks, isLeft ? "#b7f6ff" : "#fff8c7", 2.2);
      const tip = hand.landmarks[8];
      if (tip) this.drawPoint(tip, "#ffffff", 6);
    }

    if (frame.pose.length > 0) {
      this.drawConnections(frame.pose, POSE_CONNECTIONS, "rgba(255,255,255,.84)", 2.2);
      this.drawPoints(frame.pose.filter((point) => (point.visibility ?? 1) > 0.45), "#ff6c5c", 2.2);
    }

    if (frame.face.length > 0) {
      this.drawPoints(frame.face.filter((_, index) => index % 7 === 0), "rgba(109,255,184,.66)", 1.1);
    }
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawConnections(
    landmarks: NormalizedLandmark[],
    connections: Array<[number, number]>,
    color: string,
    width: number,
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = "round";
    for (const [startIndex, endIndex] of connections) {
      const start = landmarks[startIndex];
      const end = landmarks[endIndex];
      if (!start || !end || (start.visibility ?? 1) < 0.4 || (end.visibility ?? 1) < 0.4) continue;
      this.ctx.beginPath();
      this.ctx.moveTo(start.x * this.canvas.width, start.y * this.canvas.height);
      this.ctx.lineTo(end.x * this.canvas.width, end.y * this.canvas.height);
      this.ctx.stroke();
    }
  }

  private drawPoints(landmarks: NormalizedLandmark[], color: string, radius: number): void {
    for (const landmark of landmarks) this.drawPoint(landmark, color, radius);
  }

  private drawPoint(landmark: NormalizedLandmark, color: string, radius: number): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(landmark.x * this.canvas.width, landmark.y * this.canvas.height, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

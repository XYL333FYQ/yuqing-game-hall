import type {
  HandLandmarkerResult,
  HolisticLandmarkerResult,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { DetectedHand, VisionFrame, VisionMode, VisionStatus } from "./types";

type WorkerResult = HandLandmarkerResult | HolisticLandmarkerResult;

const DETECTION_WIDTH = 512;
const DETECTION_HEIGHT = 288;

export class VisionController {
  private worker?: Worker;
  private stream?: MediaStream;
  private mode: VisionMode = "hands";
  private processing = false;
  private ready = false;
  private frameCallbackId?: number;
  private rafId?: number;
  private generation = 0;
  private lastTimestamp = -1;
  private detectionTimes: number[] = [];
  private cameraFrameTimes: number[] = [];
  private cameraWidth?: number;
  private cameraHeight?: number;
  private backend: VisionStatus["backend"] = "hand-landmarker";
  private delegate: VisionStatus["delegate"] = "GPU";
  private captureCanvas = document.createElement("canvas");
  private captureContext: CanvasRenderingContext2D;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onFrame: (frame: VisionFrame) => void,
    private readonly onStatus: (status: VisionStatus) => void,
  ) {
    this.captureCanvas.width = DETECTION_WIDTH;
    this.captureCanvas.height = DETECTION_HEIGHT;
    const context = this.captureCanvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("无法创建摄像头缩放画布。");
    this.captureContext = context;
  }

  async start(mode: VisionMode): Promise<void> {
    const generation = ++this.generation;
    this.mode = mode;
    this.ready = false;
    this.processing = false;
    this.lastTimestamp = -1;
    this.detectionTimes = [];
    this.cameraFrameTimes = [];
    this.cancelFrameLoop();
    this.disposeWorker();

    try {
      await this.ensureCamera();
      if (generation !== this.generation) return;
      await this.initializeWorker(mode, generation);
      if (generation !== this.generation) return;
      this.scheduleFrame();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.onStatus({ phase: "error", message });
      throw error;
    }
  }

  async switchMode(mode: VisionMode): Promise<void> {
    if (mode === this.mode && this.ready) return;
    await this.start(mode);
  }

  stop(): void {
    this.generation += 1;
    this.cancelFrameLoop();
    this.disposeWorker();
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = undefined;
    }
    this.video.srcObject = null;
    this.onStatus({ phase: "idle", message: "摄像头已关闭" });
  }

  getMode(): VisionMode {
    return this.mode;
  }

  private async ensureCamera(): Promise<void> {
    if (this.stream?.active) return;
    this.onStatus({ phase: "camera", message: "正在启动摄像头…" });
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("浏览器不支持摄像头访问。");

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640, max: 960 },
          height: { ideal: 360, max: 540 },
          frameRate: { ideal: 30, max: 60 },
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        throw new Error("摄像头权限被拒绝。请在浏览器地址栏允许摄像头后重试。");
      }
      if (error instanceof DOMException && error.name === "NotFoundError") {
        throw new Error("没有找到可用摄像头，请连接摄像头后重试。");
      }
      throw error;
    }
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    const settings = this.stream.getVideoTracks()[0]?.getSettings();
    this.cameraWidth = settings?.width;
    this.cameraHeight = settings?.height;
  }

  private async initializeWorker(mode: VisionMode, generation: number): Promise<void> {
    this.onStatus({ phase: "model", message: mode === "hands" ? "正在加载双手模型…" : "正在加载全身视觉模型…" });
    const worker = mode === "hands"
      ? new Worker(new URL("./workers/hand-landmarker.worker.ts", import.meta.url), { type: "module" })
      : new Worker(new URL("./workers/holistic-landmarker.worker.ts", import.meta.url), { type: "module" });
    this.worker = worker;

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("视觉模型初始化超时，请刷新后重试。")), 45_000);

      worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
        if (generation !== this.generation) return;
        const data = event.data;
        const type = String(data.type ?? "");

        if (type === "INIT_DONE") {
          window.clearTimeout(timeout);
          this.ready = true;
          this.backend = mode === "hands" ? "hand-landmarker" : "holistic";
          this.onStatus({
            phase: "ready",
            message: mode === "hands" ? "完整双手识别已就绪" : "脸部、双手与全身识别已就绪",
            delegate: this.delegate,
            backend: this.backend,
          });
          resolve();
        } else if (type === "DELEGATE_FALLBACK") {
          this.delegate = "CPU";
          this.onStatus({ phase: "model", message: "GPU 不可用，正在切换 CPU 模式…", delegate: "CPU" });
        } else if (type === "LOAD_PROGRESS") {
          const loaded = Number(data.loaded ?? 0);
          const total = Number(data.total ?? 0);
          const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
          this.onStatus({ phase: "model", message: `正在加载模型 ${percent}%` });
        } else if (type === "DETECT_RESULT") {
          this.handleDetection(
            data.result as WorkerResult,
            Number(data.inferenceTime ?? 0),
            Number(data.timestampMs ?? performance.now()),
          );
        } else if (type === "DETECT_ERROR") {
          this.processing = false;
          console.warn("视觉帧处理失败:", String(data.error ?? "未知错误"));
        } else if (type === "ERROR") {
          window.clearTimeout(timeout);
          const message = String(data.error ?? "视觉模型初始化失败");
          reject(new Error(message));
        }
      };

      worker.onerror = (event) => {
        window.clearTimeout(timeout);
        reject(new Error(event.message || "视觉 Worker 启动失败"));
      };

      worker.postMessage({
        type: "INIT",
        modelAssetPath: mode === "hands" ? "/models/hand_landmarker.task" : "/models/holistic_landmarker.task",
        delegate: "GPU",
        baseUrl: "/",
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.46,
        minHandPresenceConfidence: 0.42,
        minTrackingConfidence: 0.42,
      });
    });
  }

  private scheduleFrame(): void {
    if (typeof this.video.requestVideoFrameCallback === "function") {
      const callback: VideoFrameRequestCallback = (now, metadata) => {
        this.recordCameraFrame(now);
        const reportedCaptureTime = metadata.captureTime;
        const captureTime = typeof reportedCaptureTime === "number"
          && Number.isFinite(reportedCaptureTime)
          && reportedCaptureTime > 0
          && Math.abs(reportedCaptureTime - now) < 5000
          ? reportedCaptureTime
          : now;
        void this.captureFrame(captureTime);
        if (this.ready) this.frameCallbackId = this.video.requestVideoFrameCallback(callback);
      };
      this.frameCallbackId = this.video.requestVideoFrameCallback(callback);
      return;
    }

    const callback = (now: number) => {
      this.recordCameraFrame(now);
      void this.captureFrame(now);
      if (this.ready) this.rafId = requestAnimationFrame(callback);
    };
    this.rafId = requestAnimationFrame(callback);
  }

  private async captureFrame(cameraTimestamp: number): Promise<void> {
    if (!this.ready || !this.worker || this.processing || this.video.readyState < 2) return;
    this.processing = true;

    try {
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(this.video, {
          resizeWidth: DETECTION_WIDTH,
          resizeHeight: DETECTION_HEIGHT,
          resizeQuality: "low",
        });
      } catch {
        this.captureContext.drawImage(this.video, 0, 0, DETECTION_WIDTH, DETECTION_HEIGHT);
        bitmap = await createImageBitmap(this.captureCanvas);
      }

      const timestamp = cameraTimestamp > this.lastTimestamp ? cameraTimestamp : this.lastTimestamp + 1;
      this.lastTimestamp = timestamp;
      this.worker.postMessage({ type: "DETECT_VIDEO", bitmap, timestampMs: timestamp }, [bitmap]);
    } catch {
      this.processing = false;
    }
  }

  private handleDetection(result: WorkerResult, inferenceMs: number, sampleTimestamp: number): void {
    this.processing = false;
    const now = performance.now();
    this.detectionTimes.push(now);
    this.detectionTimes = this.detectionTimes.filter((time) => now - time <= 1000);

    const frame = this.normalizeResult(result, inferenceMs, sampleTimestamp);
    this.onFrame(frame);
    this.onStatus({
      phase: "ready",
      message: this.mode === "hands" ? "双手识别运行中" : "全身视觉识别运行中",
      inferenceMs,
      detectionFps: this.detectionTimes.length,
      cameraFps: this.cameraFrameTimes.length,
      pipelineLatencyMs: Math.max(0, now - sampleTimestamp),
      cameraWidth: this.cameraWidth,
      cameraHeight: this.cameraHeight,
      backend: this.backend,
      delegate: this.delegate,
    });
  }

  private recordCameraFrame(now: number): void {
    this.cameraFrameTimes.push(now);
    this.cameraFrameTimes = this.cameraFrameTimes.filter((time) => now - time <= 1000);
  }

  private normalizeResult(result: WorkerResult, inferenceMs: number, timestamp: number): VisionFrame {
    const hands: DetectedHand[] = [];
    let pose: NormalizedLandmark[] = [];
    let face: NormalizedLandmark[] = [];

    if (this.mode === "hands") {
      const handResult = result as HandLandmarkerResult;
      handResult.landmarks?.forEach((landmarks, index) => {
        const category = handResult.handedness?.[index]?.[0];
        const label = category?.categoryName?.toLowerCase() || `hand-${index}`;
        const handedness = label.includes("left") ? "left" : label.includes("right") ? "right" : "unknown";
        hands.push({ id: label, handedness, score: category?.score ?? 1, landmarks });
      });
    } else {
      const holistic = result as HolisticLandmarkerResult;
      holistic.leftHandLandmarks?.forEach((landmarks) => hands.push({ id: "left", handedness: "left", score: 1, landmarks }));
      holistic.rightHandLandmarks?.forEach((landmarks) => hands.push({ id: "right", handedness: "right", score: 1, landmarks }));
      pose = holistic.poseLandmarks?.[0] ?? [];
      face = holistic.faceLandmarks?.[0] ?? [];
    }

    return { mode: this.mode, timestamp, inferenceMs, hands, pose, face };
  }

  private cancelFrameLoop(): void {
    if (this.frameCallbackId !== undefined && typeof this.video.cancelVideoFrameCallback === "function") {
      this.video.cancelVideoFrameCallback(this.frameCallbackId);
    }
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    this.frameCallbackId = undefined;
    this.rafId = undefined;
  }

  private disposeWorker(): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: "CLEANUP" });
    this.worker.terminate();
    this.worker = undefined;
  }
}

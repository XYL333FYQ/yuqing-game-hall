import { canPlayGames } from "../platform/device";
import { bindCopyUrl, desktopGate, siteFooter, siteHeader } from "../shell/shell";
import { HandTrackStabilizer } from "../vision/HandTrackStabilizer";
import { VisionController } from "../vision/VisionController";
import { VisionOverlayRenderer } from "../vision/VisionOverlayRenderer";
import type { VisionMode, VisionStatus } from "../vision/types";

export function renderVisionLab(root: HTMLElement): () => void {
  document.title = "体感实验室 · 雨晴游戏厅";
  document.body.dataset.page = "site";
  const playable = canPlayGames();
  root.innerHTML = `
    <div class="site-shell arcade-shell arcade-vision-shell">
      ${siteHeader("vision")}
      <main class="vision-page">
        <header class="vision-heading"><div><p class="kicker">MOTION LAB / 本地视觉</p><h1>体感实验室</h1><p>抬起双手，或让全身入镜。实时查看你的动作与识别结果。</p></div><span class="privacy-chip"><i></i> 画面仅在本地处理</span></header>
        ${playable ? "" : desktopGate("体感实验室请在电脑上打开")}
        <div class="vision-layout ${playable ? "" : "is-disabled"}">
          <section class="vision-preview-card">
            <div class="vision-preview-heading"><span>实时预览</span><div class="runtime-dot" data-phase="idle"><i></i><span data-status>待机 · 摄像头未开启</span></div></div>
            <div class="vision-media mirrored"><video autoplay muted playsinline></video><canvas></canvas><div class="vision-placeholder"><span aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 17a4 4 0 0 1 4-4h6l3-5h10l3 5h6a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z"/><circle cx="24" cy="26" r="9"/></svg></span><strong>等待你的第一个动作</strong><small>选择识别模式，开启摄像头<br>让双手或全身进入画面</small></div></div>
            <div class="vision-livebar"><span data-mode-label>双手识别 · 镜像画面</span><button type="button" data-action="stop" hidden>关闭摄像头</button></div>
          </section>
          <aside class="vision-control-card">
            <p class="kicker">识别模式</p>
            <div class="lab-mode-list" role="radiogroup" aria-label="识别模式">
              <button class="lab-mode selected" type="button" data-mode="hands" role="radio" aria-checked="true"><span class="lab-mode-icon">手</span><span><strong>完整双手识别</strong><small>最多双手 · 每只手 21 个关键点</small></span><em>7.46 MiB</em></button>
              <button class="lab-mode" type="button" data-mode="holistic" role="radio" aria-checked="false"><span class="lab-mode-icon">体</span><span><strong>全身视觉</strong><small>脸部、姿态、左手和右手统一输出</small></span><em>13.05 MiB</em></button>
            </div>
            <button class="button primary full" type="button" data-action="start" ${playable ? "" : "disabled"}>开启摄像头与本地模型</button>
            <p class="vision-error" role="alert"></p>
            <div class="vision-metrics-heading"><span>运行状态</span><span data-delegate>等待启动</span></div>
            <dl class="metrics-grid"><div><dt>相机帧率</dt><dd data-camera-fps>—</dd></div><div><dt>识别帧率</dt><dd data-ai-fps>—</dd></div><div><dt>推理耗时</dt><dd data-inference>—</dd></div><div><dt>管线延迟</dt><dd data-latency>—</dd></div></dl>
            <div class="landmark-counts"><span>手 <b data-hands>0</b></span><span>身体 <b data-pose>0</b></span><span>面部 <b data-face>0</b></span><span>左右手 <b data-handedness>—</b></span></div>
            <p class="metric-note">保持光线充足，让手部或全身完整入镜。识别帧率越高、延迟越低，动作跟随越流畅。</p>
          </aside>
        </div>
      </main>
      ${siteFooter()}
    </div>`;
  if (!playable) return bindCopyUrl(root);

  const video = root.querySelector<HTMLVideoElement>("video")!;
  const canvas = root.querySelector<HTMLCanvasElement>(".vision-media canvas")!;
  const placeholder = root.querySelector<HTMLElement>(".vision-placeholder")!;
  const startButton = root.querySelector<HTMLButtonElement>("[data-action=start]")!;
  const stopButton = root.querySelector<HTMLButtonElement>("[data-action=stop]")!;
  const error = root.querySelector<HTMLElement>(".vision-error")!;
  const overlay = new VisionOverlayRenderer(canvas);
  const stabilizer = new HandTrackStabilizer();
  let mode: VisionMode = "hands";
  let running = false;
  let starting = false;
  let disposed = false;
  let startAttempt = 0;
  let lastMetricsUpdate = -Infinity;
  const textElements = new Map<string, HTMLElement>();

  const vision = new VisionController(
    video,
    (frame) => {
      const stable = stabilizer.stabilize(frame);
      overlay.render(stable);
      setText("[data-hands]", String(stable.hands.length));
      setText("[data-pose]", String(stable.pose.length));
      setText("[data-face]", String(stable.face.length));
      setText("[data-handedness]", stable.hands.length > 0
        ? stable.hands.map((hand) => hand.handedness === "left" ? "左" : hand.handedness === "right" ? "右" : "未知").join(" · ")
        : "—");
    },
    (status) => updateStatus(status),
  );

  const updateStatus = (status: VisionStatus): void => {
    const dot = root.querySelector<HTMLElement>(".runtime-dot")!;
    dot.dataset.phase = status.phase;
    setText("[data-status]", status.message);
    if (status.phase === "error") {
      running = false;
      overlay.clear();
      stabilizer.reset();
      resetMetrics();
      placeholder.hidden = false;
      stopButton.hidden = true;
      startButton.disabled = false;
      startButton.textContent = "重新尝试";
      error.textContent = status.message;
    }
    if (status.delegate) setText("[data-delegate]", status.delegate === "GPU" ? "GPU 加速" : "CPU 模式");
    // Keep the overlay at the recognition rate; text only needs four updates/second.
    if (status.inferenceMs !== undefined && performance.now() - lastMetricsUpdate < 250) return;
    if (status.inferenceMs !== undefined) lastMetricsUpdate = performance.now();
    if (status.cameraFps !== undefined) setText("[data-camera-fps]", `${status.cameraFps} FPS`);
    if (status.detectionFps !== undefined) setText("[data-ai-fps]", `${status.detectionFps} FPS`);
    if (status.inferenceMs !== undefined) setText("[data-inference]", `${Math.round(status.inferenceMs)} ms`);
    if (status.pipelineLatencyMs !== undefined) setText("[data-latency]", `${Math.round(status.pipelineLatencyMs)} ms`);
  };

  const setText = (selector: string, value: string): void => {
    let element = textElements.get(selector);
    if (!element) {
      element = root.querySelector<HTMLElement>(selector) ?? undefined;
      if (element) textElements.set(selector, element);
    }
    if (element && element.textContent !== value) element.textContent = value;
  };

  const resetMetrics = (): void => {
    for (const selector of ["[data-camera-fps]", "[data-ai-fps]", "[data-inference]", "[data-latency]"]) {
      setText(selector, "—");
    }
    setText("[data-hands]", "0");
    setText("[data-pose]", "0");
    setText("[data-face]", "0");
    setText("[data-handedness]", "—");
    setText("[data-delegate]", "等待启动");
    lastMetricsUpdate = -Infinity;
  };

  const start = async (): Promise<void> => {
    if (starting || disposed) return;
    const attempt = ++startAttempt;
    starting = true;
    running = false;
    overlay.clear();
    stabilizer.reset();
    stopButton.hidden = false;
    startButton.disabled = true;
    startButton.textContent = "正在准备模型…";
    error.textContent = "";
    resetMetrics();
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-mode]")) button.disabled = true;
    try {
      await vision.start(mode);
      if (disposed || attempt !== startAttempt) return;
      running = true;
      placeholder.hidden = true;
      stopButton.hidden = false;
      startButton.textContent = "切换或重新启动";
      startButton.disabled = false;
    } catch (reason) {
      if (disposed || attempt !== startAttempt) return;
      vision.stop();
      stopButton.hidden = true;
      placeholder.hidden = false;
      error.textContent = reason instanceof Error ? reason.message : "摄像头或模型启动失败。";
      startButton.textContent = "重新尝试";
      startButton.disabled = false;
    } finally {
      if (attempt === startAttempt) {
        starting = false;
        for (const button of root.querySelectorAll<HTMLButtonElement>("[data-mode]")) button.disabled = false;
      }
    }
  };

  const clickHandler = async (event: MouseEvent): Promise<void> => {
    const modeButton = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-mode]") : null;
    if (modeButton) {
      if (starting || modeButton.dataset.mode === mode) return;
      mode = modeButton.dataset.mode as VisionMode;
      setText("[data-mode-label]", mode === "hands" ? "双手识别 · 镜像画面" : "全身视觉 · 镜像画面");
      for (const candidate of root.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
        const selected = candidate === modeButton;
        candidate.classList.toggle("selected", selected);
        candidate.setAttribute("aria-checked", String(selected));
      }
      if (running) await start();
      return;
    }
    const action = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-action]")?.dataset.action : undefined;
    if (action === "start") await start();
    if (action === "stop") {
      startAttempt += 1;
      starting = false;
      vision.stop();
      overlay.clear();
      stabilizer.reset();
      running = false;
      resetMetrics();
      placeholder.hidden = false;
      stopButton.hidden = true;
      startButton.disabled = false;
      for (const button of root.querySelectorAll<HTMLButtonElement>("[data-mode]")) button.disabled = false;
      startButton.textContent = "开启摄像头与本地模型";
    }
  };
  root.addEventListener("click", clickHandler);

  return () => {
    disposed = true;
    root.removeEventListener("click", clickHandler);
    vision.stop();
  };
}

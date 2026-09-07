import { FruitNinjaEngine } from "./FruitNinjaEngine";
import { GameAudio } from "./GameAudio";
import { PointerBladeController } from "./PointerBladeController";
import { ARCADE_DURATION_MS, createDailyChallenge, getArcadeGrade, localDateKey } from "./systems/ArcadeSystem";

const gameRoot = document.querySelector<HTMLElement>("#fruit-party");
if (!gameRoot) throw new Error("果切派对缺少根节点。");
const root: HTMLElement = gameRoot;

document.title = "果切派对";
root.innerHTML = `
  <main class="fruit-game">
    <header class="toolbar"><a href="/" class="brand">🍉 <strong>果切派对</strong></a><div class="mode-switch"><button data-mode="arcade" class="active">90 秒街机</button><button data-mode="endless">经典无尽</button></div><div class="tools"><button data-action="mute">声音</button><button data-action="pause">暂停</button><button data-action="fullscreen">全屏</button></div></header>
    <section class="stage"><canvas class="game-canvas" aria-label="按住鼠标左键拖动切水果"></canvas>
      <div class="overlay" data-overlay><p class="eyebrow" data-intro-eyebrow>90 秒街机</p><h1 data-intro-title>每二十秒，换一种玩法。</h1><p data-intro-copy>无炸弹热身后迎接三个随机挑战，攒满狂热进入双倍，最后击破巨型水果。</p><button data-action="start" class="start">开始游戏</button></div>
      <div class="result" data-result hidden><p class="eyebrow">本局成绩</p><h2 data-result-score>0 分</h2><p data-result-copy>再来一局，超过自己。</p><button data-action="restart" class="start">再来一局</button></div>
      <p class="hint">按住鼠标左键拖动 · P 暂停</p>
    </section>
  </main>`;

const canvas = root.querySelector<HTMLCanvasElement>(".game-canvas")!;
const overlay = root.querySelector<HTMLElement>("[data-overlay]")!;
const result = root.querySelector<HTMLElement>("[data-result]")!;
const score = root.querySelector<HTMLElement>("[data-result-score]")!;
const resultCopy = root.querySelector<HTMLElement>("[data-result-copy]")!;
const introEyebrow = root.querySelector<HTMLElement>("[data-intro-eyebrow]")!;
const introTitle = root.querySelector<HTMLElement>("[data-intro-title]")!;
const introCopy = root.querySelector<HTMLElement>("[data-intro-copy]")!;
const audio = new GameAudio();
let mode: "arcade" | "endless" = "arcade";
const engine = new FruitNinjaEngine(canvas, {
  onEvent: (event) => audio.play(event),
  onGameOver: (state) => {
    score.textContent = `${state.score} 分`;
    resultCopy.textContent = mode === "arcade" && state.arcade
      ? `评级 ${getArcadeGrade(state.score)} · 完美切 ${state.arcade.perfectSlices}`
      : state.gameOverReason === "bomb" ? "炸弹不会预警；看清目标再出刀。" : "再来一局，超过自己。";
    result.hidden = false;
    postMessage({ type: "YUQING_GAME_SCORE", score: state.score, mode });
  },
});
const pointer = new PointerBladeController(canvas, engine);
engine.startLoop();
const musicTimer = window.setInterval(() => audio.syncMusic(engine.getState()), 120);

function postMessage(data: Record<string, unknown>): void {
  window.parent !== window && window.parent.postMessage(data, window.location.origin);
}

function selectMode(next: "arcade" | "endless"): void {
  mode = next;
  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  if (mode === "arcade") {
    introEyebrow.textContent = "90 秒街机";
    introTitle.textContent = "每二十秒，换一种玩法。";
    introCopy.textContent = `今日挑战：${createDailyChallenge(localDateKey()).description}`;
  } else {
    introEyebrow.textContent = "经典无尽";
    introTitle.textContent = "按住左键，一刀切开。";
    introCopy.textContent = "越撑越快，避开炸弹，漏掉三颗水果就会结束。";
  }
}

function start(): void {
  audio.unlock();
  overlay.hidden = true;
  result.hidden = true;
  engine.beginGame(mode === "arcade" ? { mode, durationMs: ARCADE_DURATION_MS } : { mode });
  postMessage({ type: "YUQING_GAME_STARTED", mode });
}

root.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action], [data-mode]") : null;
  if (!target) return;
  if (target.dataset.mode === "arcade" || target.dataset.mode === "endless") return selectMode(target.dataset.mode);
  const action = target.dataset.action;
  if (action === "start" || action === "restart") start();
  if (action === "pause") target.textContent = engine.getState().paused ? "暂停" : "继续", engine.togglePause();
  if (action === "mute") { audio.setMuted(!audio.isMuted()); target.textContent = audio.isMuted() ? "已静音" : "声音"; }
  if (action === "fullscreen") { const op = document.fullscreenElement ? document.exitFullscreen() : root.querySelector<HTMLElement>(".fruit-game")?.requestFullscreen(); if (op) void op.catch(() => undefined); }
});
document.addEventListener("keydown", (event) => { if (event.key.toLowerCase() === "p") engine.togglePause(); });
window.addEventListener("beforeunload", () => { pointer.destroy(); engine.destroy(); audio.destroy(); window.clearInterval(musicTimer); });
postMessage({ type: "YUQING_GAME_READY", gameId: "fruit-party", capabilities: ["audio", "fullscreen", "storage", "multiplayer"] });

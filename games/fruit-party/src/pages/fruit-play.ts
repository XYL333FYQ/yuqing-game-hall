import { fruitPartyHref } from "../router";
import { canPlayGames } from "../ui/shell";
import { bindCopyUrl, desktopGate, gamePageHeader } from "../ui/shell";
import { isEmbedded } from "../ui/embed";
import { FruitNinjaEngine } from "../FruitNinjaEngine";
import { GameAudio } from "../GameAudio";
import { PointerBladeController } from "../PointerBladeController";

export function renderFruitPlay(root: HTMLElement): () => void {
  document.title = "单人无尽 · 果切派对";
  if (!canPlayGames()) {
    document.body.dataset.page = "site";
    root.innerHTML = `<div class="site-shell">${gamePageHeader("games")}<main class="narrow-page"><a class="back-link" href="${fruitPartyHref("home")}" data-game-nav>← 返回玩法选择</a>${desktopGate()}</main></div>`;
    return bindCopyUrl(root);
  }

  const embedded = isEmbedded();
  document.body.dataset.page = "game";
  root.innerHTML = `
    <main class="play-shell${embedded ? " is-embedded" : ""}">
      ${embedded ? `
        <div class="embedded-game-controls" aria-label="游戏操作">

          <div class="toolbar-mode-switch" aria-label="游戏模式"><a href="${fruitPartyHref("arcade")}" data-game-nav>街机挑战</a><span>经典无尽</span></div>

          <div class="toolbar-actions">
            <button type="button" data-action="mute" aria-pressed="false">声音</button>
            <button type="button" data-action="pause">暂停</button>
          </div>
        </div>` : `
        <div class="play-toolbar">
          <a class="toolbar-brand" href="${fruitPartyHref("home")}" data-game-nav><b>←</b><span><strong>果切派对</strong><small>经典无尽</small></span></a>

          <div class="toolbar-mode-switch" aria-label="游戏模式"><a href="${fruitPartyHref("arcade")}" data-game-nav>街机挑战</a><span>经典无尽</span></div>

          <div class="toolbar-actions">
            <button type="button" data-action="mute" aria-pressed="false">声音</button>
            <button type="button" data-action="pause">暂停</button>
            <button type="button" data-action="fullscreen">全屏</button>
          </div>
        </div>`}
      <section class="game-stage" aria-label="果切派对单人游戏">
        <canvas class="game-canvas" aria-label="按住鼠标左键拖动切水果"></canvas>
        <div class="game-start-overlay">
          <div class="game-start-card">
            <span class="modal-label">经典无尽 · 越撑越快</span>
            <div class="game-start-visual" aria-hidden="true">
              <img src="./assets/fruits/orange.svg" alt="">
              <span></span>
              <img src="./assets/fruits/bomb.svg" alt="">
            </div>
            <p class="kicker">单人无尽</p>
            <h1>按住左键，<br>一刀切开。</h1>
            <p>炸弹会从随机位置、随机时机出现，不会预警；坚持越久，水果越密、速度越快，炸弹也会更频繁。漏掉三颗水果或切中炸弹，本局结束。</p>
            <div class="start-rules"><span><b>01</b>按住左键</span><span><b>02</b>快速划过</span><span><b>03</b>避开炸弹</span></div>
            <button class="button primary" type="button" data-action="start">开始游戏</button>
          </div>
        </div>
        <div class="game-result" hidden>
          <div><img class="result-art" data-result-art src="./assets/fruits/orange.svg" alt=""><p class="kicker">本局成绩</p><h2 data-result-score>0 分</h2><p data-result-copy>再来一局，超过自己。</p><button class="button primary" type="button" data-action="restart">再来一局</button><nav class="result-links" aria-label="结算页操作"><a class="text-link" href="${fruitPartyHref("home")}" data-game-nav>返回玩法选择</a><a class="text-link" href="${fruitPartyHref("arcade")}" data-game-nav>进入街机挑战 <span>→</span></a></nav></div>
        </div>
        <div class="mouse-hint">按住鼠标左键拖动 · P 暂停</div>
      </section>
    </main>`;

  const canvas = root.querySelector<HTMLCanvasElement>(".game-canvas")!;
  const overlay = root.querySelector<HTMLElement>(".game-start-overlay")!;
  const result = root.querySelector<HTMLElement>(".game-result")!;
  const score = root.querySelector<HTMLElement>("[data-result-score]")!;
  const resultCopy = root.querySelector<HTMLElement>("[data-result-copy]")!;
  const resultArt = root.querySelector<HTMLImageElement>("[data-result-art]")!;
  const audio = new GameAudio();
  const muteButton = root.querySelector<HTMLButtonElement>("[data-action=mute]")!;
  muteButton.textContent = audio.isMuted() ? "已静音" : "声音";
  muteButton.setAttribute("aria-pressed", String(audio.isMuted()));
  const engine = new FruitNinjaEngine(canvas, {
    onEvent: (event) => audio.play(event),
    onGameOver: (state) => {
      score.textContent = `${state.score} 分`;
      const hitBomb = state.gameOverReason === "bomb";
      resultArt.src = hitBomb ? "./assets/fruits/bomb.svg" : "./assets/fruits/orange.svg";
      resultCopy.textContent = hitBomb ? "炸弹不会预警；看清目标再出刀，别在果群里贪刀。" : "再来一局，超过自己。";
      result.hidden = false;
    },
  });
  const pointer = new PointerBladeController(canvas, engine);
  engine.startLoop();
  const musicTimer = window.setInterval(() => audio.syncMusic(engine.getState()), 120);
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-action="pause"]')!;
  let pausedByVisibility = false;

  const syncPauseLabel = (): void => {
    pauseButton.textContent = engine.getState().paused ? "继续" : "暂停";
  };

  const start = (): void => {
    audio.unlock();
    pausedByVisibility = false;
    overlay.hidden = true;
    result.hidden = true;
    engine.beginGame({ mode: "endless" });
  };
  const clickHandler = (event: MouseEvent): void => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-action]") : null;
    if (!button) return;
    const action = button.dataset.action;
    if (action === "start" || action === "restart") start();
    if (action === "pause") {
      pausedByVisibility = false;
      engine.togglePause();
      syncPauseLabel();
    }
    if (action === "mute") {
      audio.setMuted(!audio.isMuted());
      if (!audio.isMuted()) audio.unlock();
      button.textContent = audio.isMuted() ? "已静音" : "声音";
      button.setAttribute("aria-pressed", String(audio.isMuted()));
    }
    if (action === "fullscreen") {
      const operation = document.fullscreenElement
        ? document.exitFullscreen()
        : root.querySelector<HTMLElement>(".play-shell")?.requestFullscreen();
      if (operation) void operation.catch(() => undefined);
    }
  };
  const keyHandler = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === "p") {
      pausedByVisibility = false;
      engine.togglePause();
      syncPauseLabel();
    }
  };
  const visibilityHandler = (): void => {
    if (document.hidden) {
      pausedByVisibility = engine.getState().started
        && !engine.getState().paused
        && !engine.getState().gameOver;
      if (pausedByVisibility) engine.setPaused(true);
    } else if (pausedByVisibility) {
      engine.setPaused(false);
      pausedByVisibility = false;
    }
    audio.syncMusic(engine.getState());
    syncPauseLabel();
  };
  root.addEventListener("click", clickHandler);
  document.addEventListener("keydown", keyHandler);
  document.addEventListener("visibilitychange", visibilityHandler);

  return () => {
    root.removeEventListener("click", clickHandler);
    document.removeEventListener("keydown", keyHandler);
    document.removeEventListener("visibilitychange", visibilityHandler);
    pointer.destroy();
    engine.destroy();
    window.clearInterval(musicTimer);
    audio.destroy();
  };
}


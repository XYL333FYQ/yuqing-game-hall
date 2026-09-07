import { fruitPartyHref } from "../router";
import { canPlayGames } from "../ui/shell";
import { bindCopyUrl, desktopGate, siteHeader } from "../ui/shell";
import { FruitNinjaEngine } from "../FruitNinjaEngine";
import { GameAudio } from "../GameAudio";
import { PointerBladeController } from "../PointerBladeController";
import {
  ARCADE_DURATION_MS,
  createDailyChallenge,
  getArcadeGrade,
  localDateKey,
} from "../systems/ArcadeSystem";

export function renderFruitArcade(root: HTMLElement): () => void {
  document.title = "90 秒街机 · 果切派对";
  if (!canPlayGames()) {
    document.body.dataset.page = "site";
    root.innerHTML = `<div class="site-shell">${siteHeader("games")}<main class="narrow-page"><a class="back-link" href="${fruitPartyHref("home")}" data-game-nav>← 返回游戏介绍</a>${desktopGate()}</main></div>`;
    return bindCopyUrl(root);
  }

  const dateKey = localDateKey();
  const daily = createDailyChallenge(dateKey);
  const dailyWasCompleted = readDailyCompletion(dateKey);
  document.body.dataset.page = "game";
  root.innerHTML = `
    <main class="play-shell arcade-shell">
      <div class="play-toolbar">
        <a class="toolbar-brand" href="${fruitPartyHref("home")}" data-game-nav><b>←</b><span><strong>果切派对</strong><small>90 秒街机</small></span></a>
        <div class="toolbar-mode-switch" aria-label="游戏模式"><span>街机挑战</span><a href="${fruitPartyHref("play")}" data-game-nav>经典无尽</a></div>
        <div class="toolbar-actions">
          <button type="button" data-action="mute" aria-pressed="false">声音</button>
          <button type="button" data-action="pause">暂停</button>
          <button type="button" data-action="fullscreen">全屏</button>
        </div>
      </div>
      <section class="game-stage" aria-label="果切派对 90 秒动态街机">
        <canvas class="game-canvas" aria-label="按住鼠标左键拖动切水果"></canvas>
        <div class="game-start-overlay">
          <div class="game-start-card arcade-start-card">
            <span class="modal-label">90 秒街机 · 三项随机挑战</span>
            <div class="arcade-start-heading">
              <span class="arcade-time-seal"><b>90</b><small>秒</small></span>
              <div><p class="kicker">动态街机</p><h1>每二十秒，<br>换一种玩法。</h1></div>
            </div>
            <p>无炸弹热身后连续迎接三个随机挑战，攒满狂热进入 6 秒双倍，最后十秒击破巨型水果。</p>
            <div class="arcade-flow" aria-label="本局流程">
              <span><b>01</b>热身</span><i></i><span><b>02</b>三项挑战</span><i></i><span><b>03</b>巨果终局</span>
            </div>
            <div class="daily-card${dailyWasCompleted ? " completed" : ""}">
              <span>今日挑战</span><div><strong>${daily.title}</strong><small>${daily.description}</small></div><b>${dailyWasCompleted ? "已完成" : "本机记录"}</b>
            </div>
            <button class="button primary arcade-start-button" type="button" data-action="start">开始 90 秒挑战</button>
          </div>
        </div>
        <div class="game-result arcade-result" hidden>
          <div>
            <div class="grade-badge" data-result-grade>C</div>
            <p class="kicker">街机结算</p>
            <h2 data-result-score>0 分</h2>
            <p class="result-record" data-result-record>最高纪录 0</p>
            <dl class="arcade-result-stats">
              <div><dt>完美切</dt><dd data-result-perfect>0</dd></div>
              <div><dt>最大连斩</dt><dd data-result-multi>0</dd></div>
              <div><dt>挑战完成</dt><dd data-result-events>0 / 3</dd></div>
              <div><dt>狂热爆发</dt><dd data-result-fever>0</dd></div>
            </dl>
            <p class="daily-result" data-result-daily>今日挑战尚未完成</p>
            <button class="button primary" type="button" data-action="restart">再挑战一次</button>
            <nav class="result-links" aria-label="结算页操作">
              <a class="text-link" href="${fruitPartyHref("home")}" data-game-nav>返回游戏介绍</a>
              <a class="text-link" href="${fruitPartyHref("play")}" data-game-nav>切换到经典无尽 <span>→</span></a>
            </nav>
          </div>
        </div>
        <div class="mouse-hint">按住鼠标左键拖动 · P 暂停</div>
      </section>
    </main>`;

  const canvas = root.querySelector<HTMLCanvasElement>(".game-canvas")!;
  const overlay = root.querySelector<HTMLElement>(".game-start-overlay")!;
  const result = root.querySelector<HTMLElement>(".game-result")!;
  const score = root.querySelector<HTMLElement>("[data-result-score]")!;
  const grade = root.querySelector<HTMLElement>("[data-result-grade]")!;
  const record = root.querySelector<HTMLElement>("[data-result-record]")!;
  const perfect = root.querySelector<HTMLElement>("[data-result-perfect]")!;
  const multi = root.querySelector<HTMLElement>("[data-result-multi]")!;
  const events = root.querySelector<HTMLElement>("[data-result-events]")!;
  const fever = root.querySelector<HTMLElement>("[data-result-fever]")!;
  const dailyResult = root.querySelector<HTMLElement>("[data-result-daily]")!;
  const audio = new GameAudio();
  const muteButton = root.querySelector<HTMLButtonElement>("[data-action=mute]")!;
  muteButton.textContent = audio.isMuted() ? "已静音" : "声音";
  muteButton.setAttribute("aria-pressed", String(audio.isMuted()));

  let activeEngine: FruitNinjaEngine | undefined;
  const engine = activeEngine = new FruitNinjaEngine(canvas, {
    onEvent: (event) => {
      audio.play(event);
      const arcade = activeEngine?.getState().arcade;
      if (arcade?.dailyCompleted) writeDailyCompletion(arcade.dailyChallenge.dateKey);
    },
    onGameOver: (state) => {
      const arcade = state.arcade;
      if (!arcade) return;
      const rating = getArcadeGrade(state.score);
      score.textContent = `${state.score} 分`;
      grade.textContent = rating;
      grade.dataset.grade = rating;
      record.textContent = `最高纪录 ${state.highScore}`;
      perfect.textContent = String(arcade.perfectSlices);
      multi.textContent = String(arcade.maxMultiSlice);
      events.textContent = `${arcade.completedEventIds.length} / 3`;
      fever.textContent = String(arcade.feverActivations);
      if (arcade.dailyCompleted) writeDailyCompletion(arcade.dailyChallenge.dateKey);
      dailyResult.textContent = arcade.dailyCompleted || readDailyCompletion(dateKey)
        ? `✓ 今日挑战「${arcade.dailyChallenge.title}」已完成`
        : `今日挑战：${arcade.dailyChallenge.description}`;
      dailyResult.classList.toggle("completed", arcade.dailyCompleted || readDailyCompletion(dateKey));
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
    const seed = typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint32Array(1))[0]
      : Math.floor(Math.random() * 0x7fffffff);
    engine.beginGame({ mode: "arcade", durationMs: ARCADE_DURATION_MS, seed });
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
    if (event.key.toLowerCase() !== "p") return;
    pausedByVisibility = false;
    engine.togglePause();
    syncPauseLabel();
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

function readDailyCompletion(dateKey: string): boolean {
  try {
    return localStorage.getItem(`yuqing-fruit-party-daily-${dateKey}`) === "1";
  } catch {
    return false;
  }
}

function writeDailyCompletion(dateKey: string): void {
  try {
    localStorage.setItem(`yuqing-fruit-party-daily-${dateKey}`, "1");
  } catch {
    // The result still renders when storage is unavailable.
  }
}


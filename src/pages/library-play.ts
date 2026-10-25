import { canPlayGame } from "../platform/device";
import { findGame } from "../platform/game-catalog";
import { iframeAllowPolicy } from "../platform/game-launch";
import { bindCopyUrl, desktopGate } from "../shell/shell";
import { themeSwitcher } from "../appearance/theme";

export function renderLibraryPlay(root: HTMLElement, id: string): () => void {
  const game = findGame(id);
  if (!game) throw new Error("没有找到这款游戏。");
  const { presentation, theme } = game;
  const { play } = presentation;
  const launch = game.platform.launch;

  document.title = `${presentation.title} · 雨晴游戏厅`;
  document.body.dataset.page = "library-game";

  if (!canPlayGame(play)) {
    root.innerHTML = `<main class="library-player-gate"><a class="back-link" href="/library/${game.id}" data-nav>← 返回游戏介绍</a>${desktopGate("请在电脑上游玩", "当前设备适合浏览游戏介绍，请使用电脑打开游戏。")}</main>`;
    return bindCopyUrl(root);
  }

  if (launch.kind !== "iframe") {
    root.innerHTML = `<main class="library-player-gate"><a class="back-link" href="/library/${game.id}" data-nav>← 返回游戏介绍</a><section class="desktop-gate"><span class="desktop-gate-icon">↗</span><div><strong>${presentation.availability.label}</strong><p>当前可以先查看游戏介绍与玩法信息。</p></div>${launch.kind === "external" ? `<a class="button primary" href="${launch.url}" target="_blank" rel="noreferrer">${presentation.actionLabel}</a>` : ""}</section></main>`;
    return () => undefined;
  }
  const startPath = launch.startUrl ?? launch.entry;

  root.innerHTML = `
    <div class="library-player" style="--game-accent:${theme.accent};--game-dark:${theme.dark}">
      <header class="library-player-toolbar">
        <a href="/library/${game.id}" data-nav><b>←</b><span><strong>${presentation.title}</strong><small>${play.modes} · ${play.players}</small></span></a>
        <p class="library-player-status"><i></i> <span>${play.controls}</span></p>
        <div class="library-player-tools">
          ${themeSwitcher()}
          <button type="button" data-cinema-toggle title="收起或展开顶部控制栏">沉浸宽屏</button>
          <button type="button" data-retry>重新载入</button>
          <button type="button" class="is-primary" data-fullscreen>全屏游玩 ⛶</button>
        </div>
      </header>
      <button type="button" class="library-cinema-restore" data-cinema-restore hidden aria-label="展开顶部工具栏" title="退出沉浸宽屏">▾ 展开控制栏</button>
      <div class="library-frame-wrap">
        <iframe src="${startPath}" title="${presentation.title}" allow="${iframeAllowPolicy(game)}"></iframe>
        <div class="library-frame-loading" role="status">
          <div class="library-loading-emblem"><span>${presentation.mark}</span><i></i></div>
          <strong data-loading-title>正在打开 ${presentation.title}</strong>
          <span data-loading-copy>游戏马上就好，准备进入游玩画面 · 操作：${play.controls}</span>
          <div class="library-frame-actions" hidden>
            <button type="button" data-overlay-retry>重新载入</button>
            <a href="${startPath}" target="_blank" rel="noreferrer">独立页面打开</a>
          </div>
        </div>
      </div>
    </div>`;

  const playerRoot = root.querySelector<HTMLElement>(".library-player");
  const frame = root.querySelector<HTMLIFrameElement>("iframe");
  const loading = root.querySelector<HTMLElement>(".library-frame-loading");
  const fullscreenButton = root.querySelector<HTMLButtonElement>("[data-fullscreen]");
  const cinemaToggle = root.querySelector<HTMLButtonElement>("[data-cinema-toggle]");
  const cinemaRestore = root.querySelector<HTMLButtonElement>("[data-cinema-restore]");
  const retryButtons = root.querySelectorAll<HTMLButtonElement>("[data-retry], [data-overlay-retry]");
  const loadingTitle = root.querySelector<HTMLElement>("[data-loading-title]");
  const loadingCopy = root.querySelector<HTMLElement>("[data-loading-copy]");
  const loadingActions = root.querySelector<HTMLElement>(".library-frame-actions");
  let loaded = false;
  let slowTimer: number | undefined;
  const startLoadingTimer = (): void => {
    window.clearTimeout(slowTimer);
    slowTimer = window.setTimeout(() => {
      if (loaded) return;
      if (loadingTitle) loadingTitle.textContent = "加载时间比预期更久";
      if (loadingCopy) loadingCopy.textContent = "可以重新载入，或在独立页面打开以查看浏览器给出的错误。";
      loadingActions?.removeAttribute("hidden");
    }, 15000);
  };
  const onLoad = (): void => {
    loaded = true;
    window.clearTimeout(slowTimer);
    loading?.setAttribute("hidden", "");
  };
  const onFullscreen = (): void => { void frame?.requestFullscreen(); };
  const toggleCinema = (active?: boolean): void => {
    if (!playerRoot || !cinemaRestore) return;
    const nextState = active ?? !playerRoot.classList.contains("is-cinema");
    playerRoot.classList.toggle("is-cinema", nextState);
    cinemaRestore.hidden = !nextState;
  };
  const onCinemaToggle = (): void => toggleCinema();
  const onCinemaRestore = (): void => toggleCinema(false);
  const onRetry = (): void => {
    if (!frame) return;
    loaded = false;
    loading?.removeAttribute("hidden");
    loadingActions?.setAttribute("hidden", "");
    if (loadingTitle) loadingTitle.textContent = `正在重新打开 ${presentation.title}`;
    if (loadingCopy) loadingCopy.textContent = "正在重新载入游戏…";
    startLoadingTimer();
    frame.src = startPath;
  };
  const onReadyMessage = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
    if ((event.data as { type?: string } | null)?.type === "YUQING_GAME_READY") onLoad();
  };
  frame?.addEventListener("load", onLoad);
  fullscreenButton?.addEventListener("click", onFullscreen);
  cinemaToggle?.addEventListener("click", onCinemaToggle);
  cinemaRestore?.addEventListener("click", onCinemaRestore);
  retryButtons.forEach((button) => button.addEventListener("click", onRetry));
  window.addEventListener("message", onReadyMessage);
  startLoadingTimer();

  return () => {
    window.clearTimeout(slowTimer);
    frame?.removeEventListener("load", onLoad);
    fullscreenButton?.removeEventListener("click", onFullscreen);
    cinemaToggle?.removeEventListener("click", onCinemaToggle);
    cinemaRestore?.removeEventListener("click", onCinemaRestore);
    retryButtons.forEach((button) => button.removeEventListener("click", onRetry));
    window.removeEventListener("message", onReadyMessage);
    if (frame) frame.src = "about:blank";
  };
}

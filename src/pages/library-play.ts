import { canPlayGames } from "../platform/device";
import { bindCopyUrl, desktopGate } from "../platform/shell";
import { findLibraryGame, iframeAllowPolicy } from "../data/gameLibrary";

export function renderLibraryPlay(root: HTMLElement, slug: string): () => void {
  const game = findLibraryGame(slug);
  if (!game) throw new Error("没有找到这款游戏。");

  document.title = `${game.title} · 雨晴游戏厅`;
  document.body.dataset.page = "library-game";

  if (!canPlayGames()) {
    root.innerHTML = `<main class="library-player-gate"><a class="back-link" href="/library/${game.slug}" data-nav>← 返回游戏介绍</a>${desktopGate("请在电脑上游玩", "当前设备适合浏览游戏介绍，请使用电脑打开游戏。")}</main>`;
    return bindCopyUrl(root);
  }

  if (!game.localPath) {
    root.innerHTML = `<main class="library-player-gate"><a class="back-link" href="/library/${game.slug}" data-nav>← 返回游戏介绍</a><section class="desktop-gate"><span class="desktop-gate-icon">↗</span><div><strong>${game.statusLabel}</strong><p>当前可以先查看游戏介绍与玩法信息。</p></div>${game.onlineUrl ? `<a class="button primary" href="${game.onlineUrl}" target="_blank" rel="noreferrer">${game.launchLabel ?? "前往体验"}</a>` : ""}</section></main>`;
    return () => undefined;
  }
  const startPath = game.startPath ?? game.localPath;

  root.innerHTML = `
    <div class="library-player">
      <header class="library-player-toolbar">
        <a href="/library/${game.slug}" data-nav><b>←</b><span><strong>${game.title}</strong><small>${game.mode}</small></span></a>
        <p><i></i> 雨晴游戏厅 · 即刻开玩</p>
        <div class="library-player-tools"><button type="button" data-retry>重新载入</button><button type="button" data-fullscreen>全屏游玩</button></div>
      </header>
      <div class="library-frame-wrap">
        <iframe src="${startPath}" title="${game.title}" allow="${iframeAllowPolicy(game)}"></iframe>
        <div class="library-frame-loading" role="status"><i></i><strong data-loading-title>正在打开 ${game.title}</strong><span data-loading-copy>游戏马上就好，准备进入游玩画面。</span><div class="library-frame-actions" hidden><button type="button" data-overlay-retry>重新载入</button><a href="${startPath}" target="_blank" rel="noreferrer">独立页面打开</a></div></div>
      </div>
    </div>`;

  const frame = root.querySelector<HTMLIFrameElement>("iframe");
  const loading = root.querySelector<HTMLElement>(".library-frame-loading");
  const fullscreenButton = root.querySelector<HTMLButtonElement>("[data-fullscreen]");
  const retryButtons = root.querySelectorAll<HTMLButtonElement>("[data-retry], [data-overlay-retry]");
  const loadingTitle = root.querySelector<HTMLElement>("[data-loading-title]");
  const loadingCopy = root.querySelector<HTMLElement>("[data-loading-copy]");
  const loadingActions = root.querySelector<HTMLElement>(".library-frame-actions");
  let loaded = false;
  const onLoad = (): void => {
    loaded = true;
    loading?.setAttribute("hidden", "");
  };
  const onFullscreen = (): void => { void frame?.requestFullscreen(); };
  const onRetry = (): void => {
    if (!frame) return;
    loaded = false;
    loading?.removeAttribute("hidden");
    loadingActions?.setAttribute("hidden", "");
    if (loadingTitle) loadingTitle.textContent = `正在重新打开 ${game.title}`;
    if (loadingCopy) loadingCopy.textContent = "正在重新载入游戏…";
    frame.src = startPath ?? "about:blank";
  };
  const onReadyMessage = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
    if ((event.data as { type?: string } | null)?.type === "YUQING_GAME_READY") onLoad();
  };
  frame?.addEventListener("load", onLoad);
  fullscreenButton?.addEventListener("click", onFullscreen);
  retryButtons.forEach((button) => button.addEventListener("click", onRetry));
  window.addEventListener("message", onReadyMessage);
  const slowTimer = window.setTimeout(() => {
    if (loaded) return;
    if (loadingTitle) loadingTitle.textContent = "加载时间比预期更久";
    if (loadingCopy) loadingCopy.textContent = "可以重新载入，或在独立页面打开以查看浏览器给出的错误。";
    loadingActions?.removeAttribute("hidden");
  }, 15000);

  return () => {
    window.clearTimeout(slowTimer);
    frame?.removeEventListener("load", onLoad);
    fullscreenButton?.removeEventListener("click", onFullscreen);
    retryButtons.forEach((button) => button.removeEventListener("click", onRetry));
    window.removeEventListener("message", onReadyMessage);
    if (frame) frame.src = "about:blank";
  };
}

import { canPlayGames } from "../platform/device";
import { bindCopyUrl, desktopGate } from "../platform/shell";
import { findLibraryGame } from "../data/gameLibrary";

export function renderLibraryPlay(root: HTMLElement, slug: string): () => void {
  const game = findLibraryGame(slug);
  if (!game) throw new Error("没有找到这款游戏。");

  document.title = `${game.title} · 雨晴游戏厅`;
  document.body.dataset.page = "library-game";

  if (!canPlayGames()) {
    root.innerHTML = `<main class="library-player-gate"><a class="back-link" href="/games/${game.slug}" data-nav>← 返回游戏介绍</a>${desktopGate()}</main>`;
    return bindCopyUrl(root);
  }

  if (!game.localPath) {
    root.innerHTML = `<main class="library-player-gate"><a class="back-link" href="/games/${game.slug}" data-nav>← 返回游戏介绍</a><section class="desktop-gate"><span class="desktop-gate-icon">↗</span><div><strong>这款游戏需要独立的联机服务器</strong><p>它不是一个上传 HTML 就能运行的静态小游戏，请从介绍页连接在线服务或按服务器部署说明自建。</p></div>${game.onlineUrl ? `<a class="button primary" href="${game.onlineUrl}" target="_blank" rel="noreferrer">连接在线服务</a>` : ""}</section></main>`;
    return () => undefined;
  }

  root.innerHTML = `
    <div class="library-player">
      <header class="library-player-toolbar">
        <a href="/games/${game.slug}" data-nav><b>←</b><span><strong>${game.title}</strong><small>${game.originalTitle} · 开源移植版</small></span></a>
        <p><i></i> 随雨晴游戏厅部署</p>
        <div class="library-player-tools"><button type="button" data-retry>重新载入</button><button type="button" data-fullscreen>全屏游玩</button></div>
      </header>
      <div class="library-frame-wrap">
        <iframe src="${game.localPath}" title="${game.title}" allow="autoplay; fullscreen; gamepad"></iframe>
        <div class="library-frame-loading" role="status"><i></i><strong data-loading-title>正在打开 ${game.title}</strong><span data-loading-copy>首次载入大型 3D 资源可能需要几秒钟。</span><div class="library-frame-actions" hidden><button type="button" data-overlay-retry>重新载入</button><a href="${game.localPath}" target="_blank" rel="noreferrer">在独立页面打开</a></div></div>
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
    if (loadingCopy) loadingCopy.textContent = "正在重新装载本地游戏资源…";
    frame.src = game.localPath ?? "about:blank";
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

import { installLinkNavigation, type PageCleanup } from "../platform/navigation";
import { siteHeader } from "../platform/shell";

type PageLoader = (root: HTMLElement) => Promise<PageCleanup>;

export function startPortal(app: HTMLDivElement): void {
  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

  let cleanup: PageCleanup | undefined;
  let renderRevision = 0;
  const removeNavigation = installLinkNavigation();

  const renderRoute = async (): Promise<void> => {
    const revision = ++renderRevision;
    cleanup?.();
    cleanup = undefined;
    app.innerHTML = `<div class="route-loader" role="status"><i></i><span>正在打开雨晴游戏厅…</span></div>`;
    const path = normalizePath(window.location.pathname);

    try {
      const loader = resolvePortalRoute(path);
      if (revision !== renderRevision) return;
      if (loader) cleanup = await loader(app);
      else renderNotFound(app);
      restoreScroll(path, revision, () => renderRevision);
    } catch (error) {
      if (revision !== renderRevision) return;
      console.error(error);
      document.body.dataset.page = "site";
      app.innerHTML = `<div class="site-shell">${siteHeader()}<main class="narrow-page"><section class="error-card"><p class="kicker">加载失败</p><h1>页面没有顺利打开</h1><p>${escapeHtml(error instanceof Error ? error.message : "发生未知错误。")}</p><button class="button primary" type="button" data-reload>重新加载</button></section></main></div>`;
      app.querySelector<HTMLButtonElement>("[data-reload]")?.addEventListener("click", () => window.location.reload());
    }
  };

  window.addEventListener("popstate", () => void renderRoute());
  window.addEventListener("beforeunload", () => {
    cleanup?.();
    removeNavigation();
  });
  void renderRoute();
}

function resolvePortalRoute(path: string): PageLoader | undefined {
  if (path === "/") return async (root) => (await import("../pages/home")).renderHome(root);
  if (path === "/vision-lab") return async (root) => (await import("../pages/vision-lab")).renderVisionLab(root);

  const playMatch = path.match(/^\/games\/([^/]+)\/play$/i);
  if (playMatch) return async (root) => (await import("../pages/library-play")).renderLibraryPlay(root, playMatch[1]);

  const gameMatch = path.match(/^\/games\/([^/]+)$/i);
  if (gameMatch) return async (root) => (await import("../pages/library-game")).renderLibraryGame(root, gameMatch[1]);
  return undefined;
}

function renderNotFound(app: HTMLElement): void {
  document.title = "页面不存在 · 雨晴游戏厅";
  document.body.dataset.page = "site";
  app.innerHTML = `<div class="site-shell">${siteHeader()}<main class="narrow-page"><section class="error-card"><p class="kicker">404</p><h1>这一局还没准备好</h1><p>你访问的页面不存在，返回游戏厅看看现在能玩的内容。</p><a class="button primary" href="/" data-nav>返回首页</a></section></main></div>`;
}

function restoreScroll(path: string, revision: number, currentRevision: () => number): void {
  if (path.startsWith("/room/") || path.endsWith("/play") || path.endsWith("/arcade")) return;
  const resetScroll = (): void => {
    if (revision !== currentRevision() || window.location.pathname !== path) return;
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const hashTarget = targetId ? document.getElementById(targetId) : null;
    if (hashTarget) hashTarget.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  };
  resetScroll();
  requestAnimationFrame(resetScroll);
  window.setTimeout(resetScroll, 80);
}

function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

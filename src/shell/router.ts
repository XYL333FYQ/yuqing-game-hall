import { fragmentTargetId, installLinkNavigation, type PageCleanup } from "./navigation";
import { cancelPortal } from "../appearance/portal-transition";
import { siteFooter, siteHeader } from "./shell";

type PageRenderer = (root: HTMLElement) => PageCleanup;
type PageLoader = () => Promise<PageRenderer>;

export function startPortal(app: HTMLDivElement): Promise<void> {
  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

  let cleanup: PageCleanup | undefined;
  let renderRevision = 0;
  const removeNavigation = installLinkNavigation();

  const renderRoute = async (): Promise<void> => {
    const revision = ++renderRevision;
    cleanup?.();
    cleanup = undefined;
    const path = normalizePath(window.location.pathname);

    try {
      const loader = resolvePortalRoute(path);
      if (revision !== renderRevision) return;
      const applyPage = async (): Promise<void> => {
        if (revision !== renderRevision) return;
        const renderPage = loader ? await loader() : undefined;
        if (revision !== renderRevision) return;
        if (renderPage) cleanup = renderPage(app);
        else renderNotFound(app);
        restoreScroll(path, revision, () => renderRevision);
      };

      cancelPortal();
      const docWithTransition = document as Document & {
        startViewTransition?: (callback: () => Promise<void> | void) => { finished: Promise<void>; ready?: Promise<void>; updateCallbackDone?: Promise<void> };
      };
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (typeof docWithTransition.startViewTransition === "function" && !prefersReducedMotion && app.childElementCount > 0) {
        const transition = docWithTransition.startViewTransition(() => applyPage());
        void transition.ready?.catch(() => undefined);
        await Promise.all([transition.updateCallbackDone, transition.finished]);
      } else {
        if (app.childElementCount === 0 && !document.querySelector("#entry-screen[open]")) {
          app.innerHTML = `<div class="route-loader" role="status"><i></i><span>正在打开雨晴游戏厅…</span></div>`;
        }
        await applyPage();
      }
    } catch (error) {
      if (revision !== renderRevision) return;
      console.error(error);
      document.body.dataset.page = "site";
      app.innerHTML = `<div class="site-shell arcade-shell">${siteHeader()}<main class="narrow-page"><section class="error-card"><p class="kicker">加载失败</p><h1>页面没有顺利打开</h1><p>${escapeHtml(error instanceof Error ? error.message : "发生未知错误。")}</p><button class="button primary" type="button" data-reload>重新加载</button></section></main>${siteFooter()}</div>`;
      app.querySelector<HTMLButtonElement>("[data-reload]")?.addEventListener("click", () => window.location.reload());
    }
  };

  window.addEventListener("popstate", () => void renderRoute());
  window.addEventListener("beforeunload", () => {
    cleanup?.();
    removeNavigation();
  });
  return renderRoute();
}

function resolvePortalRoute(path: string): PageLoader | undefined {
  if (path === "/") return async () => (await import("../pages/home")).renderHome;
  if (path === "/vision-lab") return async () => (await import("../pages/vision-lab")).renderVisionLab;
  if (path === "/third-party-notices") return async () => (await import("../pages/third-party-notices")).renderThirdPartyNotices;

  const playMatch = path.match(/^\/play\/([^/]+)$/i);
  if (playMatch) return async () => {
    const { renderLibraryPlay } = await import("../pages/library-play");
    return (root) => renderLibraryPlay(root, playMatch[1]);
  };

  const gameMatch = path.match(/^\/library\/([^/]+)$/i);
  if (gameMatch) return async () => {
    const { renderLibraryGame } = await import("../pages/library-game");
    return (root) => renderLibraryGame(root, gameMatch[1]);
  };
  return undefined;
}

function renderNotFound(app: HTMLElement): void {
  document.title = "页面不存在 · 雨晴游戏厅";
  document.body.dataset.page = "site";
  app.innerHTML = `<div class="site-shell arcade-shell">${siteHeader()}<main class="narrow-page"><section class="error-card"><p class="kicker">404</p><h1>这一局还没准备好</h1><p>你访问的页面不存在，返回游戏厅看看现在能玩的内容。</p><a class="button primary" href="/" data-nav>返回首页</a></section></main>${siteFooter()}</div>`;
}

function restoreScroll(path: string, revision: number, currentRevision: () => number): void {
  if (path.startsWith("/play/")) return;
  const resetScroll = (): void => {
    if (revision !== currentRevision() || window.location.pathname !== path) return;
    const targetId = fragmentTargetId(window.location.hash);
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

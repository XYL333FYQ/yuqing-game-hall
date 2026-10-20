/** 页面卸载时清理事件、计时器、音频和 Canvas 循环的统一约定。 */
export type PageCleanup = () => void;

export function navigate(path: string): void {
  const url = new URL(path, window.location.origin);
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    if (url.hash !== window.location.hash) window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    const targetId = decodeURIComponent(url.hash.slice(1));
    const hashTarget = targetId ? document.getElementById(targetId) : null;
    if (hashTarget) hashTarget.scrollIntoView({ block: "start", behavior: "smooth" });
    else if (!url.hash) window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function installLinkNavigation(): () => void {
  const handler = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-nav]") : null;
    if (!target || target.origin !== window.location.origin) return;
    event.preventDefault();
    navigate(`${target.pathname}${target.search}${target.hash}`);
  };
  document.addEventListener("click", handler);
  return () => document.removeEventListener("click", handler);
}

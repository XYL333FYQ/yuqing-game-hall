/** 页面卸载时清理事件、计时器、音频和 Canvas 循环的统一约定。 */
export type PageCleanup = () => void;

export function navigate(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
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

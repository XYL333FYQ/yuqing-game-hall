export function siteHeader(active: "home" | "games" | "vision" | "none" = "none", options: { search?: boolean } = {}): string {
  return `
    <header class="site-header">
      <a class="site-brand" href="/" data-nav aria-label="返回雨晴游戏厅首页">
        <span class="site-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span><strong>雨晴游戏厅</strong><small>打开就能玩的小游戏</small></span>
      </a>
      <div class="site-header-actions">
        <nav class="site-nav" aria-label="主导航">
          <a href="/" data-nav ${active === "home" ? 'aria-current="page"' : ""}>首页</a>
          <a href="/#all-games" data-nav ${active === "games" ? 'aria-current="page"' : ""}>游戏</a>
          <a href="/#all-games" data-nav>分类</a>
          <a href="/third-party-notices" data-nav>关于</a>
        </nav>
        ${options.search ? `<label class="site-search"><span aria-hidden="true">⌕</span><input type="search" data-game-search placeholder="搜索你想玩的游戏…" autocomplete="off" aria-label="搜索游戏"></label>` : ""}
        ${options.search ? `<span class="site-header-quick-note"><span aria-hidden="true">🎮</span><b>随时随地，打开就能玩</b><small>好游戏，让生活更有趣</small></span><span class="site-header-smile" aria-hidden="true">☻</span>` : ""}
      </div>
    </header>`;
}

export function siteFooter(): string {
  return `
    <footer class="site-footer">
      <span>雨晴游戏厅 · 好游戏，好心情</span>
      <span>想玩就来，随时开一局 · <a href="/third-party-notices" data-nav>使用说明</a></span>
    </footer>`;
}

export function desktopGate(title = "请在电脑上游玩", copy = "手机可以浏览游戏介绍，但不会启动游戏、联机房间或摄像头。"): string {
  return `
    <section class="desktop-gate" role="status">
      <span class="desktop-gate-icon" aria-hidden="true">↗</span>
      <div><strong>${title}</strong><p>${copy}</p></div>
      <button class="button secondary" type="button" data-copy-url>复制当前链接</button>
    </section>`;
}

export function bindCopyUrl(root: ParentNode = document): () => void {
  const button = root.querySelector<HTMLButtonElement>("[data-copy-url]");
  if (!button) return () => undefined;
  const handler = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      button.textContent = "已复制链接";
    } catch {
      button.textContent = "请从地址栏复制";
    }
  };
  button.addEventListener("click", handler);
  return () => button.removeEventListener("click", handler);
}

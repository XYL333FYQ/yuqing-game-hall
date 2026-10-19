export function siteHeader(active: "home" | "games" | "vision" | "none" = "none", options: { search?: boolean } = {}): string {
  return `
    <header class="site-header">
      <a class="site-brand" href="/" data-nav aria-label="返回雨晴游戏厅首页">
        <span class="site-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span><strong>雨晴游戏厅</strong><small>YUQING ARCADE LOUNGE</small></span>
      </a>
      <div class="site-header-actions">
        <nav class="site-nav" aria-label="主导航">
          <a href="/" data-nav ${active === "home" ? 'aria-current="page"' : ""}>首页</a>
          <a href="/#all-games" data-nav ${active === "games" ? 'aria-current="page"' : ""}>游戏库</a>
          <a href="/vision-lab" data-nav ${active === "vision" ? 'aria-current="page"' : ""}>体感实验室</a>
          <a href="/third-party-notices" data-nav>关于</a>
        </nav>
        ${options.search ? `
          <label class="site-search">
            <span class="site-search-icon" aria-hidden="true">⌕</span>
            <input type="search" data-game-search placeholder="搜索游戏、类型或标签…" autocomplete="off" aria-label="搜索游戏">
            <button type="button" class="site-search-clear" data-search-clear hidden aria-label="清空搜索">×</button>
            <kbd class="site-search-kbd" aria-hidden="true" title="按 / 键快速搜索">/</kbd>
          </label>` : ""}
        <div class="site-header-status" title="自建联机网关与穿透服务就绪">
          <span class="status-pulse-dot" aria-hidden="true"></span>
          <span>服务在线</span>
        </div>
      </div>
    </header>`;
}

export function siteFooter(): string {
  return `
    <footer class="site-footer">
      <div class="site-footer-content">
        <div class="site-footer-brand">
          <strong>雨晴游戏厅</strong>
          <p>私享复古未来游戏舱 · 56 款经典与联机游戏收录</p>
        </div>
        <div class="site-footer-links">
          <span>局域 / 公网极速对战</span>
          <span><a href="/vision-lab" data-nav>体感工坊</a></span>
          <span><a href="/third-party-notices" data-nav>开源许可与致谢</a></span>
        </div>
      </div>
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

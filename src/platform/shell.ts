export function siteHeader(active: "games" | "vision" | "none" = "none"): string {
  return `
    <header class="site-header">
      <a class="site-brand" href="/" data-nav aria-label="返回雨晴游戏厅首页">
        <span class="site-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span><strong>雨晴游戏厅</strong><small>打开就能玩的小游戏</small></span>
      </a>
      <div class="site-header-actions">
        <nav class="site-nav" aria-label="主导航">
          <a href="/" data-nav ${active === "games" ? 'aria-current="page"' : ""}>游戏</a>
          <a href="/vision-lab" data-nav ${active === "vision" ? 'aria-current="page"' : ""}>体感实验室</a>
        </nav>
        <span class="local-status"><i></i>本机即时响应</span>
      </div>
    </header>`;
}

export function siteFooter(): string {
  return `
    <footer class="site-footer">
      <span>雨晴游戏厅 · 静态游戏随站点加载，联机大作使用独立服务器</span>
      <a href="/legal/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer">开源许可与模型说明</a>
    </footer>`;
}

export function desktopGate(title = "请在电脑上游玩"): string {
  return `
    <section class="desktop-gate" role="status">
      <span class="desktop-gate-icon" aria-hidden="true">↗</span>
      <div><strong>${title}</strong><p>手机可以浏览游戏介绍，但不会启动游戏、联机房间或摄像头。</p></div>
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

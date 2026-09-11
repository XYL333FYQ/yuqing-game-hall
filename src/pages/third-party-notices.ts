import { GAME_CATALOG } from "../platform/game-catalog";
import { siteFooter, siteHeader } from "../platform/shell";

/**
 * 关于与素材说明页。
 *
 * 游戏详情页只读取 presentation；来源与许可属于平台资料，因此只在
 * 这个专门的说明页展示，避免把实现信息混进游戏介绍。
 */
export function renderThirdPartyNotices(root: HTMLElement): () => void {
  document.title = "关于与素材说明 · 雨晴游戏厅";
  document.body.dataset.page = "site";

  const notices = GAME_CATALOG.map((game) => {
    const presentation = game.presentation;
    return `<article class="arcade-notice-card">
      <div class="arcade-notice-card-heading"><span class="arcade-notice-mark" style="--game-accent:${escapeHtml(game.theme.accent)};--game-dark:${escapeHtml(game.theme.dark)}">${escapeHtml(presentation.mark)}</span><div><h3>${escapeHtml(presentation.title)}</h3><p>${escapeHtml(presentation.category)} · ${escapeHtml(presentation.availability.label)}</p></div></div>
      <p class="arcade-notice-license">${escapeHtml(game.platform.license)}</p>
      <a href="${escapeHtml(game.platform.sourceUrl)}" target="_blank" rel="noreferrer">查看来源 <span>↗</span></a>
    </article>`;
  }).join("");

  root.innerHTML = `
    <div class="site-shell arcade-shell arcade-info-shell">
      ${siteHeader("none")}
      <main class="arcade-main arcade-info-main">
        <section class="arcade-info-hero" aria-labelledby="about-title">
          <div class="arcade-info-hero-copy">
            <span class="arcade-featured-kicker">✦ 雨晴游戏厅</span>
            <p class="arcade-overline">ABOUT THE ARCADE</p>
            <h1 id="about-title">好游戏，<br><em>轻松找到</em></h1>
            <p>从首页挑一款喜欢的游戏，先看清玩法与操作，再决定现在就玩哪一局。</p>
            <div class="arcade-info-actions"><a class="arcade-primary-action" href="/#all-games" data-nav>浏览全部游戏 <span>→</span></a><a class="arcade-heading-link" href="/" data-nav>返回首页</a></div>
          </div>
          <div class="arcade-info-orbit" aria-hidden="true"><span>PLAY</span><b>雨晴<br>游戏厅</b><i>✦</i></div>
        </section>

        <section class="arcade-info-section" aria-labelledby="how-to-play-title">
          <div class="arcade-info-section-heading"><div><p class="arcade-overline">PLAY GUIDE</p><h2 id="how-to-play-title">来到这里，三步开始</h2></div><span>01</span></div>
          <div class="arcade-info-guide-grid">
            <article><b>01</b><h3>挑一款游戏</h3><p>按热门、人数或类型浏览，找到此刻想玩的内容。</p></article>
            <article><b>02</b><h3>先看玩法</h3><p>详情页会展示游戏简介、适合人数、操作方式和亮点。</p></article>
            <article><b>03</b><h3>马上开玩</h3><p>根据游戏状态进入游玩、前往体验，或稍后再来。</p></article>
          </div>
        </section>

        <section class="arcade-notice-panel" aria-labelledby="notice-title">
          <div class="arcade-info-section-heading"><div><p class="arcade-overline">CREDITS & LICENSES</p><h2 id="notice-title">游戏来源与许可</h2><p>这里集中放置游戏来源、作者署名与许可说明；游戏介绍页面只保留玩家需要的内容。</p></div><span>02</span></div>
          <div class="arcade-notice-grid">${notices}</div>
          <div class="arcade-notice-footer"><span>完整文本与本地许可文件随项目一并保留。</span><a href="/legal/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer">查看完整说明 <span>↗</span></a></div>
        </section>
      </main>
      ${siteFooter()}
    </div>`;

  return () => undefined;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

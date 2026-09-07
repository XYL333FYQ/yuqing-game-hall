import { canPlayGames } from "../ui/platform";
import { bindCopyUrl, desktopGate, siteFooter, siteHeader } from "../ui/platform";
import { fruitArtwork } from "../artwork";

export function renderFruitDetails(root: HTMLElement): () => void {
  document.title = "果切派对 · 雨晴游戏厅";
  document.body.dataset.page = "site";
  const playable = canPlayGames();
  root.innerHTML = `
    <div class="site-shell">
      ${siteHeader("games")}
      <main class="game-detail">
        <a class="back-link" href="/" data-nav>← 返回游戏厅</a>
        <section class="detail-hero">
          <div class="detail-copy">
            <p class="detail-index">游戏 01 · 已开放</p>
            <div class="tag-row"><span class="tag green">已上线</span><span class="tag">电脑鼠标</span></div>
            <h1>果切派对</h1>
            <p class="detail-lead">水果起飞，刀光落下。单人挑战自己的极限，或者用同一套水果序列和朋友公平对决。</p>
            <div class="detail-actions">
              ${playable ? `
                <a class="button primary" href="/games/fruit-party/arcade" data-nav>90 秒街机</a>
                <a class="button secondary" href="/games/fruit-party/play" data-nav>经典无尽</a>
                <a class="button secondary compact" href="/games/fruit-party/online" data-nav>好友联机</a>` : `
                <button class="button primary" type="button" disabled>请在电脑上游玩</button>`}
            </div>
            <dl class="quick-facts"><div><dt>怎么切</dt><dd>按住左键拖动</dd></div><div><dt>几个人</dt><dd>单人 / 双人</dd></div><div><dt>要准备什么</dt><dd>一台电脑</dd></div></dl>
          </div>
          <div class="detail-art"><div class="poster-topline"><span>果切派对 · 第一台机位</span><b><i></i> 可以开局</b></div>${fruitArtwork()}<div class="detail-art-caption"><small>最要紧的一条</small><strong>切水果，避开炸弹。</strong></div></div>
        </section>
        ${playable ? "" : desktopGate()}
        <section class="rules-grid">
          <article><span class="rule-symbol">90</span><small>首推玩法</small><h2>动态街机</h2><p>三段随机挑战、狂热双倍和巨型水果终局，每一局 90 秒都有完整起伏。</p></article>
          <article><span class="rule-symbol">∞</span><small>纯粹练手</small><h2>经典无尽</h2><p>越撑越快，炸弹也会越来越密。漏掉三颗水果或切中炸弹，本局结束。</p></article>
          <article><span class="rule-symbol">双</span><small>叫朋友来</small><h2>好友对战</h2><p>双方看到相同水果时间线，本地即时挥刀；可选积分、三局两胜和生存。</p></article>
        </section>
      </main>
      ${siteFooter()}
    </div>`;
  return bindCopyUrl(root);
}


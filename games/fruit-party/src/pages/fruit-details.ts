import { fruitArtwork } from "../artwork";
import { fruitPartyHref } from "../router";
import { isEmbedded } from "../ui/embed";
import { canPlayGames } from "../ui/shell";

/**
 * 果切自己的首屏大厅。平台只加载这个游戏入口，不参与模式选择或玩法跳转。
 */
export function renderFruitDetails(root: HTMLElement): () => void {
  document.title = "果切派对";
  document.body.dataset.page = "game";
  const playable = canPlayGames();
  const embedded = isEmbedded();
  root.innerHTML = `
    <main class="play-shell fruit-mode-shell${embedded ? " is-embedded" : ""}">
      ${embedded ? "" : `
        <div class="play-toolbar">
          <span class="toolbar-brand"><b>✦</b><span><strong>果切派对</strong><small>选择玩法</small></span></span>
        </div>`}
      <section class="game-stage fruit-mode-stage" aria-label="果切派对玩法选择">
        <div class="fruit-mode-art" aria-hidden="true">${fruitArtwork()}</div>
        <div class="fruit-mode-shade"></div>
        <div class="fruit-mode-panel">
          <span class="modal-label">果切派对 · 选择玩法</span>
          <p class="kicker">READY · PICK A MODE</p>
          <h1>想怎么切，<br>就怎么开局。</h1>
          <p>每种玩法都有自己的节奏：冲高分、练手感，或是叫朋友来一场公平对决。</p>
          ${playable ? `
            <nav class="fruit-mode-grid" aria-label="选择果切玩法">
              <a class="fruit-mode-card featured" href="${fruitPartyHref("arcade")}" data-game-nav><span class="fruit-mode-symbol">90</span><span><small>首推玩法</small><strong>动态街机</strong><em>90 秒随机挑战、狂热与巨果终局</em></span><b>开始 →</b></a>
              <a class="fruit-mode-card" href="${fruitPartyHref("play")}" data-game-nav><span class="fruit-mode-symbol">∞</span><span><small>单人练手</small><strong>经典无尽</strong><em>越撑越快，避开突然出现的炸弹</em></span><b>开始 →</b></a>
              <a class="fruit-mode-card" href="${fruitPartyHref("online")}" data-game-nav><span class="fruit-mode-symbol">双</span><span><small>两人对局</small><strong>好友联机</strong><em>同一水果时间线，凭房间码开战</em></span><b>开房 →</b></a>
            </nav>` : `
            <p class="fruit-mode-gate">果切需要在电脑上使用鼠标游玩；请在电脑浏览器中选择玩法。</p>`}
        </div>
      </section>
    </main>`;
  return () => undefined;
}

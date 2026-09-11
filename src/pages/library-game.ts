import { siteFooter, siteHeader } from "../platform/shell";
import { findLibraryGame, type LibraryGame } from "../data/gameLibrary";

const FALLBACK_ART = "/platform/game-placeholder.svg";

export function renderLibraryGame(root: HTMLElement, slug: string): () => void {
  const game = findLibraryGame(slug);
  if (!game) throw new Error("没有找到这款游戏。");

  document.title = `${game.title} · 雨晴游戏厅`;
  document.body.dataset.page = "site";

  root.innerHTML = `
    <div class="site-shell arcade-shell arcade-detail-shell">
      ${siteHeader("games")}
      <main class="library-detail">
        <a class="back-link" href="/#all-games" data-nav>← 返回游戏厅</a>
        <section class="library-detail-hero" style="--game-accent:${game.accent};--game-dark:${game.dark}">
          <div class="library-detail-copy">
            <div class="library-status-row"><span class="library-status ${game.status}">${game.statusLabel}</span><span>精选游戏 ${String(game.order).padStart(2, "0")}</span></div>
            <p class="detail-index">${game.genre}</p>
            <h1>${game.title}</h1>
            ${game.originalTitle ? `<p class="original-title">${game.originalTitle}</p>` : ""}
            <p class="library-lead">${game.summary}</p>
            <div class="tag-row">${game.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
            <div class="library-actions">${actionMarkup(game)}</div>
          </div>
          <div class="library-detail-cover" aria-hidden="true">
            <img src="${artwork(game, "hero")}" alt="">
            <span class="cover-grid"></span><span class="cover-orbit orbit-one"></span><span class="cover-orbit orbit-two"></span>
            <strong>${game.mark}</strong><small>${game.originalTitle ?? game.title}</small>
          </div>
        </section>

        <section class="library-facts" aria-label="游戏信息">
          <div><small>玩法</small><strong>${game.mode}</strong></div>
          <div><small>人数</small><strong>${game.players}</strong></div>
          <div><small>操作</small><strong>${game.controls}</strong></div>
          <div><small>适合</small><strong>${game.genre}</strong></div>
        </section>

        ${game.screenshots.length > 0 ? `
          <section class="library-screenshots" aria-label="游戏截图">
            <p class="kicker">游戏截图</p>
            <div>${game.screenshots.map((screenshot) => `<img src="${screenshot}" alt="${game.title} 截图" loading="lazy">`).join("")}</div>
          </section>` : ""}

        <section class="library-highlights" aria-labelledby="library-highlights-title">
          <div class="library-highlights-heading"><div><p class="kicker">游戏亮点</p><h2 id="library-highlights-title">现在就来玩一局</h2></div><span aria-hidden="true">✦</span></div>
          <div class="library-highlights-grid">${game.highlights.map((item, index) => `<article><b>${String(index + 1).padStart(2, "0")}</b><p>${item}</p></article>`).join("")}</div>
        </section>
      </main>
      ${siteFooter()}
    </div>`;

  return () => undefined;
}

function artwork(game: LibraryGame, variant: "hero" | "cover"): string {
  if (variant === "hero") return game.hero ?? game.cover ?? game.icon ?? FALLBACK_ART;
  return game.cover ?? game.hero ?? game.icon ?? FALLBACK_ART;
}

function actionMarkup(game: LibraryGame): string {
  if (game.localPath) return `<a class="button primary" href="/play/${game.slug}" data-nav>${game.launchLabel ?? "进入游戏"}</a>`;
  if (game.onlineUrl) return `<a class="button primary" href="${game.onlineUrl}" target="_blank" rel="noreferrer">${game.launchLabel ?? "前往体验"}</a>`;
  return `<span class="button disabled-button" aria-disabled="true">${game.launchLabel ?? "暂不可用"}</span>`;
}

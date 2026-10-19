import { siteFooter, siteHeader } from "../platform/shell";
import { findLibraryGame, LIBRARY_GAMES, type LibraryGame } from "../data/gameLibrary";

const FALLBACK_ART = "/platform/game-placeholder.svg";

export function renderLibraryGame(root: HTMLElement, slug: string): () => void {
  const game = findLibraryGame(slug);
  if (!game) throw new Error("没有找到这款游戏。");

  document.title = `${game.title} · 雨晴游戏厅`;
  document.body.dataset.page = "site";

  const relatedGames = LIBRARY_GAMES
    .filter((candidate) => candidate.slug !== game.slug && candidate.status !== "unavailable")
    .sort((left, right) => similarityScore(game, right) - similarityScore(game, left))
    .slice(0, 4);

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
            <img src="${artwork(game)}" alt="">
            <span class="cover-grid"></span><span class="cover-orbit orbit-one"></span><span class="cover-orbit orbit-two"></span>
            <strong>${game.mark}</strong><small>${game.originalTitle ?? game.title}</small>
          </div>
        </section>

        <section class="library-facts" aria-label="游戏信息">
          <div><small>玩法模式</small><strong>${game.mode}</strong></div>
          <div><small>适玩人数</small><strong>${game.players}</strong></div>
          <div><small>操作方式</small><strong>${game.controls}</strong></div>
          <div><small>支持终端</small><strong>${game.devices.includes("mobile") || game.inputs.includes("touch") ? "电脑 · 手机 / 触屏" : "电脑键盘 / 鼠标"}</strong></div>
        </section>

        ${game.screenshots.length > 0 ? `
          <section class="library-screenshots" aria-label="游戏截图">
            <p class="kicker">游戏截图 · 点击放大预览</p>
            <div>${game.screenshots.map((screenshot, idx) => `<button type="button" class="library-screenshot-trigger" data-lightbox-index="${idx}" aria-label="放大查看 ${game.title} 截图 ${idx + 1}"><img src="${screenshot}" alt="${game.title} 截图 ${idx + 1}" loading="lazy"></button>`).join("")}</div>
          </section>
          <div class="library-lightbox" data-lightbox hidden role="dialog" aria-modal="true" aria-label="游戏截图预览">
            <button type="button" class="library-lightbox-close" data-lightbox-close aria-label="关闭截图预览">×</button>
            <img data-lightbox-image src="" alt="${game.title} 高清截图">
          </div>` : ""}

        <section class="library-highlights" aria-labelledby="library-highlights-title">
          <div class="library-highlights-heading"><div><p class="kicker">游戏亮点</p><h2 id="library-highlights-title">现在就来玩一局</h2></div><span aria-hidden="true">✦</span></div>
          <div class="library-highlights-grid">${game.highlights.map((item, index) => `<article><b>${String(index + 1).padStart(2, "0")}</b><p>${item}</p></article>`).join("")}</div>
        </section>

        ${relatedGames.length > 0 ? `
          <section class="library-related" aria-labelledby="library-related-title">
            <div class="library-highlights-heading">
              <div><p class="kicker">SIMILAR GAMES</p><h2 id="library-related-title">相似风格推荐</h2></div>
              <a class="arcade-heading-link" href="/#all-games" data-nav>探索全部 <span>→</span></a>
            </div>
            <div class="library-related-grid">
              ${relatedGames.map((item) => `
                <a class="library-related-card" href="/library/${item.slug}" data-nav style="--game-accent:${item.accent};--game-dark:${item.dark}">
                  <div class="library-related-art"><img src="${artwork(item)}" alt="${item.title}" loading="lazy"></div>
                  <div class="library-related-copy"><small>${item.genre} · ${item.players}</small><h3>${item.title}</h3><p>${item.summary}</p></div>
                </a>`).join("")}
            </div>
          </section>` : ""}
      </main>
      ${siteFooter()}
    </div>`;

  const lightbox = root.querySelector<HTMLElement>("[data-lightbox]");
  const lightboxImage = root.querySelector<HTMLImageElement>("[data-lightbox-image]");

  const onRootClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !lightbox || !lightboxImage) return;
    const trigger = target.closest<HTMLButtonElement>("[data-lightbox-index]");
    if (trigger) {
      const idx = Number(trigger.dataset.lightboxIndex ?? 0);
      const src = game.screenshots[idx];
      if (src) {
        lightboxImage.src = src;
        lightbox.hidden = false;
      }
      return;
    }
    if (target.closest("[data-lightbox-close]") || target === lightbox) {
      lightbox.hidden = true;
      lightboxImage.src = "";
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && lightbox && !lightbox.hidden) {
      lightbox.hidden = true;
      if (lightboxImage) lightboxImage.src = "";
    }
  };

  root.addEventListener("click", onRootClick);
  window.addEventListener("keydown", onKeyDown);

  return () => {
    root.removeEventListener("click", onRootClick);
    window.removeEventListener("keydown", onKeyDown);
  };
}

function similarityScore(target: LibraryGame, candidate: LibraryGame): number {
  let score = 0;
  if (candidate.genre === target.genre) score += 5;
  for (const tag of candidate.tags) {
    if (target.tags.includes(tag)) score += 2;
  }
  if (candidate.players === target.players) score += 1;
  return score;
}

function artwork(game: LibraryGame): string {
  return game.hero ?? game.cover ?? game.icon ?? FALLBACK_ART;
}

function actionMarkup(game: LibraryGame): string {
  if (game.localPath) return `<a class="button primary" href="/play/${game.slug}" data-nav>${game.launchLabel ?? "进入游戏"} <span>▶</span></a>`;
  if (game.onlineUrl) return `<a class="button primary" href="${game.onlineUrl}" target="_blank" rel="noreferrer">${game.launchLabel ?? "前往体验"} <span>↗</span></a>`;
  return `<span class="button disabled-button" aria-disabled="true">${game.launchLabel ?? "暂不可用"}</span>`;
}

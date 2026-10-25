import { GAME_CATALOG, findGame } from "../platform/game-catalog";
import { GALLERY_ART } from "../platform/gallery-art";
import type { GameManifest } from "../platform/game-manifest";
import { siteFooter, siteHeader } from "../shell/shell";

const FALLBACK_ART = "/platform/game-placeholder.svg";

export function renderLibraryGame(root: HTMLElement, id: string): () => void {
  const game = findGame(id);
  if (!game) throw new Error("没有找到这款游戏。");
  const { presentation, theme } = game;
  const { play, availability } = presentation;
  const screenshots = presentation.art.screenshots ?? [];

  document.title = `${presentation.title} · 雨晴游戏厅`;
  document.body.dataset.page = "site";

  const relatedGames = GAME_CATALOG
    .filter((candidate) => candidate.id !== game.id && candidate.presentation.availability.state !== "unavailable")
    .sort((left, right) => similarityScore(game, right) - similarityScore(game, left))
    .slice(0, 4);

  const hasCover = Boolean(GALLERY_ART[game.id] ?? presentation.art.hero ?? presentation.art.cover ?? presentation.art.icon);

  root.innerHTML = `
    <div class="site-shell arcade-shell arcade-detail-shell">
      ${siteHeader("games")}
      <main class="library-detail">
        <a class="back-link" href="/#all-games" data-nav>← 返回游戏厅</a>
        <section class="library-detail-hero" style="--game-accent:${theme.accent};--game-dark:${theme.dark}">
          <div class="library-detail-copy">
            <div class="library-status-row"><span class="library-status ${availability.state}">${availability.label}</span><span>精选收录 #${String(game.order).padStart(2, "0")}</span></div>
            <p class="detail-index">${presentation.category}</p>
            <h1>${presentation.title}</h1>
            ${presentation.originalTitle ? `<p class="original-title">${presentation.originalTitle}</p>` : ""}
            <p class="library-lead">${presentation.description}</p>
            <div class="tag-row">${presentation.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
            <div class="library-actions">${actionMarkup(game)}</div>
          </div>
          <div class="library-detail-cover ${hasCover ? "has-artwork" : "is-fallback"}" aria-hidden="true">
            <div class="library-cover-frame">
              <img src="${artwork(game)}" alt="">
              <span class="library-cover-badge">${play.players} · ${play.modes}</span>
            </div>
            ${hasCover ? "" : `
              <span class="cover-grid"></span><span class="cover-orbit orbit-one"></span><span class="cover-orbit orbit-two"></span>
              <strong>${presentation.mark}</strong><small>${presentation.originalTitle ?? presentation.title}</small>
            `}
          </div>
        </section>

        <section class="library-facts" aria-label="游戏信息">
          <div><small>玩法模式</small><strong>${play.modes}</strong></div>
          <div><small>适玩人数</small><strong>${play.players}</strong></div>
          <div><small>操作方式</small><strong>${play.controls}</strong></div>
          <div><small>支持终端</small><strong>${play.devices.includes("mobile") || play.inputs.includes("touch") ? "电脑 · 手机 / 触屏" : "电脑键盘 / 鼠标"}</strong></div>
        </section>

        ${screenshots.length > 0 ? `
          <section class="library-screenshots" aria-label="游戏截图">
            <p class="kicker">游戏截图 · 点击放大预览</p>
            <div>${screenshots.map((screenshot, idx) => `<button type="button" class="library-screenshot-trigger" data-lightbox-index="${idx}" aria-label="放大查看 ${presentation.title} 截图 ${idx + 1}"><img src="${screenshot}" alt="${presentation.title} 截图 ${idx + 1}" loading="lazy"></button>`).join("")}</div>
          </section>
          <div class="library-lightbox" data-lightbox hidden role="dialog" aria-modal="true" aria-label="游戏截图预览">
            <button type="button" class="library-lightbox-close" data-lightbox-close aria-label="关闭截图预览">×</button>
            <img data-lightbox-image src="" alt="${presentation.title} 高清截图">
          </div>` : ""}

        <section class="library-highlights" aria-labelledby="library-highlights-title">
          <div class="library-highlights-heading"><div><p class="kicker">游戏亮点</p><h2 id="library-highlights-title">现在就来玩一局</h2></div><span aria-hidden="true">✦</span></div>
          <div class="library-highlights-grid">${presentation.highlights.map((item, index) => `<article><b>${String(index + 1).padStart(2, "0")}</b><p>${item}</p></article>`).join("")}</div>
        </section>

        ${relatedGames.length > 0 ? `
          <section class="library-related" aria-labelledby="library-related-title">
            <div class="library-highlights-heading">
              <div><p class="kicker">SIMILAR GAMES</p><h2 id="library-related-title">相似风格推荐</h2></div>
              <a class="arcade-heading-link" href="/#all-games" data-nav>探索全部 <span>→</span></a>
            </div>
            <div class="library-related-grid">
              ${relatedGames.map((item) => `
                <a class="library-related-card" href="/library/${item.id}" data-nav style="--game-accent:${item.theme.accent};--game-dark:${item.theme.dark}">
                  <div class="library-related-art"><img src="${artwork(item)}" alt="${item.presentation.title}" loading="lazy"></div>
                  <div class="library-related-copy"><small>${item.presentation.category} · ${item.presentation.play.players}</small><h3>${item.presentation.title}</h3><p>${item.presentation.description}</p></div>
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
      const src = screenshots[idx];
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

/** 相似度：共有的分类权重最高（discovery.genres 词表），其次是共有标签与相同的人数描述。 */
function similarityScore(target: GameManifest, candidate: GameManifest): number {
  let score = 0;
  for (const genre of candidate.discovery.genres) {
    if (target.discovery.genres.includes(genre)) score += 5;
  }
  for (const tag of candidate.presentation.tags) {
    if (target.presentation.tags.includes(tag)) score += 2;
  }
  if (candidate.presentation.play.players === target.presentation.play.players) score += 1;
  return score;
}

function artwork(game: GameManifest): string {
  const { art } = game.presentation;
  return GALLERY_ART[game.id] ?? art.hero ?? art.cover ?? art.icon ?? FALLBACK_ART;
}

function actionMarkup(game: GameManifest): string {
  const { launch } = game.platform;
  const label = game.presentation.actionLabel;
  if (launch.kind === "iframe") return `<a class="button primary" href="/play/${game.id}" data-nav>${label} <span>▶</span></a>`;
  if (launch.kind === "external") return `<a class="button primary" href="${launch.url}" target="_blank" rel="noreferrer">${label} <span>↗</span></a>`;
  return `<span class="button disabled-button" aria-disabled="true">${label}</span>`;
}

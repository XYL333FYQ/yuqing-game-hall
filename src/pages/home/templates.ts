import { GALLERY_ART } from "../../platform/gallery-art";
import type { GameManifest } from "../../platform/game-manifest";
import { siteFooter, siteHeader } from "../../shell/shell";

export interface HomeMarkupInput {
  /** 可展示的游戏总数；同时决定轮播控件与"全部"筛选按钮上的数量。 */
  gameCount: number;
  onlineModeCounts: ReadonlyMap<string, number>;
  genreOptions: readonly { id: string; name: string; count: number }[];
}

/** 首页整体 HTML 骨架；轮播、热门和游戏库列表由 index.ts 在挂载后填充。 */
export function homeMarkup({ gameCount, onlineModeCounts, genreOptions }: HomeMarkupInput): string {
  return `
    <div class="site-shell arcade-shell arcade-home">
      ${siteHeader("home", { search: true })}
      <main class="arcade-main">
        <section class="arcade-featured" data-featured-carousel aria-label="精选推荐">
          <div class="gallery-hero-object" aria-hidden="true"><img src="/platform/gallery/arcade-console.webp" alt="" width="1536" height="1024" fetchpriority="high"></div>
          <div class="arcade-featured-stage" data-featured-stage></div>
          ${gameCount > 1 ? `
            <div class="arcade-featured-controls">
              <span class="arcade-featured-counter" data-featured-counter aria-live="polite">01 / ${String(gameCount).padStart(2, "0")}</span>
              <button type="button" data-featured-step="previous" aria-label="上一款精选游戏">←</button>
              <div class="arcade-featured-dots" data-featured-dots></div>
              <button type="button" data-featured-step="next" aria-label="下一款精选游戏">→</button>
            </div>` : ""}
        </section>

        <section class="arcade-recent-bar" data-recent-section hidden aria-label="最近探索">
          <div class="arcade-recent-label"><span>⏱</span><strong>继续探索</strong></div>
          <div class="arcade-recent-list" data-recent-list></div>
        </section>

        <section class="arcade-section arcade-trending" aria-labelledby="trending-title">
          ${sectionHeading("正在流行", `<div class="arcade-heading-actions"><span class="arcade-heading-note">实时热度与轮换推荐</span><button type="button" class="arcade-refresh" data-trending-refresh>换一批 <span>↻</span></button></div>`, "trending-title", "TRENDING NOW")}
          <div class="arcade-trending-grid" data-trending-grid></div>
        </section>

        <a class="gallery-vision" href="/vision-lab" data-nav>
          <img src="/platform/gallery/vision-hand.jpg" alt="" loading="lazy" width="2172" height="724">
          <span class="gallery-vision-copy">
            <span class="gallery-vision-kicker"><i></i> 浏览器本地识别 · 视频不上传</span>
            <strong>体感实验室</strong>
            <small>无需外设，使用摄像头在浏览器本地实时追踪双手 21 个关键点与全身姿态，用手势开启体感交互体验。</small>
          </span>
          <span class="gallery-vision-action">进入实验室 <b aria-hidden="true">↗</b></span>
        </a>

        <section class="arcade-section arcade-all-games" id="all-games" aria-labelledby="all-games-title">
          ${sectionHeading("游戏库", `<div class="arcade-heading-actions"><span class="arcade-result-count" data-result-count></span><button type="button" class="arcade-random-btn" data-random-launch title="随机挑选一款游戏">🎲 随机开一局 <span aria-hidden="true">↗</span></button></div>`, "all-games-title", "GAME LIBRARY")}
          <div class="arcade-filter-bar" aria-label="筛选游戏">
            <div class="arcade-filter-pills">
              <div class="arcade-filter-group" role="group" aria-label="按人数筛选">
                <span class="arcade-filter-label" aria-hidden="true">人数</span>
                <div class="arcade-filter-options">
                  <button class="is-active" type="button" data-audience="all" aria-pressed="true">全部 <em>${gameCount}</em></button>
                  <button type="button" data-audience="single" aria-pressed="false">单人</button>
                  <button type="button" data-audience="duo" aria-pressed="false">双人</button>
                  <button type="button" data-audience="multi" aria-pressed="false">多人</button>
                </div>
              </div>
              <div class="arcade-filter-group" role="group" aria-label="按联机方式筛选">
                <span class="arcade-filter-label" aria-hidden="true">联机</span>
                <div class="arcade-filter-options">
                  <button class="is-active" type="button" data-online="all" aria-pressed="true">不限</button>
                  <button type="button" data-online="friend-room" aria-pressed="false">好友联机 <em>${onlineModeCounts.get("friend-room") ?? 0}</em></button>
                  <button type="button" data-online="public" aria-pressed="false">公开联机 <em>${onlineModeCounts.get("public") ?? 0}</em></button>
                </div>
              </div>
              <div class="arcade-filter-group" role="group" aria-label="按分类筛选">
                <span class="arcade-filter-label" aria-hidden="true">分类</span>
                <div class="arcade-filter-options is-scrollable">
                  ${genreOptions.map(({ id, name, count }) => `<button type="button" data-genre="${id}" aria-pressed="false">${escapeHtml(name)} <em>${count}</em></button>`).join("")}
                </div>
              </div>
            </div>
            <div class="arcade-select" data-sort-control>
              <span>排序</span>
              <button class="arcade-select-trigger" type="button" data-sort-trigger aria-haspopup="listbox" aria-expanded="false" aria-label="游戏排序"><span data-sort-label>热门优先</span></button>
              <div class="arcade-sort-menu" data-sort-menu role="listbox" aria-label="游戏排序选项" hidden>
                <button type="button" role="option" tabindex="-1" data-sort-option="popular" aria-selected="true">热门优先</button>
                <button type="button" role="option" tabindex="-1" data-sort-option="name" aria-selected="false">名称排序</button>
                <button type="button" role="option" tabindex="-1" data-sort-option="group" aria-selected="false">多人优先</button>
              </div>
              <select class="arcade-native-sort" data-sort aria-hidden="true" tabindex="-1"><option value="popular">热门优先</option><option value="name">名称排序</option><option value="group">多人优先</option></select>
            </div>
          </div>
          <div class="arcade-library-grid" data-game-list></div>
          <button type="button" class="gallery-more" data-library-more hidden></button>
          <div class="arcade-empty-state" data-empty hidden>
            <span class="arcade-empty-icon" aria-hidden="true">⌕</span>
            <strong>没有找到匹配的游戏</strong>
            <p>试试换个关键词，或者清除当前筛选条件查看全部收录。</p>
            <div class="arcade-empty-actions">
              <button type="button" class="arcade-primary-action" data-reset-filters>重置全部筛选</button>
              <button type="button" class="arcade-secondary-action" data-random-launch>🎲 随机挑一款</button>
            </div>
          </div>
        </section>

      </main>
      ${siteFooter()}
    </div>`;
}

export function featureSlide(game: GameManifest, index: number, total: number): string {
  const presentation = game.presentation;
  const launch = game.platform.launch;
  const isMultiplayer = game.discovery.audiences.includes("multi") || game.discovery.audiences.includes("duo");
  const isMobileReady = presentation.play.devices.includes("mobile") || presentation.play.inputs.includes("touch");
  return `<article class="arcade-featured-slide arcade-featured-slide-${escapeHtml(game.id)}" style="--game-accent:${game.theme.accent};--game-dark:${game.theme.dark}" aria-roledescription="slide" aria-label="第 ${index + 1} / ${total} 个精选游戏">
    <div class="feature-backdrop" aria-hidden="true">${gameArt(game, "hero", true)}</div>
    <div class="arcade-featured-copy">
      <div class="arcade-featured-eyebrow">
        <span class="arcade-featured-kicker">✦ 精选推荐</span>
        ${isMultiplayer ? `<span class="arcade-badge-pill multi">${escapeHtml(presentation.play.players)}</span>` : `<span class="arcade-badge-pill single">${escapeHtml(presentation.play.players)}</span>`}
        ${isMobileReady ? `<span class="arcade-badge-pill mobile">支持触屏</span>` : ""}
      </div>
      <p class="arcade-overline">${escapeHtml(presentation.category)}</p>
      <h1>${escapeHtml(presentation.title)}</h1>
      <p>${escapeHtml(presentation.tagline)}</p>
      <div class="arcade-tag-row">
        ${presentation.tags.slice(0, 4).map((tag) => `<span class="arcade-tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <dl class="arcade-meta">
        <div><dt>玩法模式</dt><dd>${escapeHtml(presentation.play.modes)}</dd></div>
        <div><dt>操作方式</dt><dd>${escapeHtml(presentation.play.controls)}</dd></div>
      </dl>
      <div class="arcade-featured-actions">
        ${launchAction(game, actionLabel(game, launch.kind === "external" ? "前往体验" : "立即进入"), "arcade-primary-action")}
        <a class="arcade-secondary-action" href="/library/${game.id}" data-nav data-game-interest="${game.id}" data-interest-kind="detail">玩法详情 <span>→</span></a>
      </div>
    </div>
    <div class="arcade-featured-art">
      <div class="arcade-art-glow" aria-hidden="true"></div>
      <a class="feature-preview-link" href="/library/${game.id}" data-nav data-game-interest="${game.id}" data-interest-kind="detail" aria-label="查看 ${escapeHtml(presentation.title)}">
        <div class="arcade-featured-art-frame">
          <div class="feature-art-ambient" aria-hidden="true">${gameArt(game, "hero", true)}</div>
          ${gameArt(game, "hero", true)}
          <span class="feature-frame-caption">
            <strong>${escapeHtml(presentation.title)}</strong>
            <small>${escapeHtml(presentation.play.modes)}</small>
          </span>
          <span class="feature-play-cue" aria-hidden="true">↗</span>
        </div>
      </a>
    </div>
  </article>`;
}

function sectionHeading(title: string, aside: string, id: string, kicker = ""): string {
  return `<div class="arcade-section-heading"><div class="arcade-section-title">${kicker ? `<span class="arcade-section-kicker">${kicker}</span>` : ""}<h2 id="${id}">${title}</h2></div>${aside}</div>`;
}

export function gameCard(game: GameManifest, variant: "trending" | "people" | "library", index = 0): string {
  const presentation = game.presentation;
  const visibleTags = presentation.tags.slice(0, 2);
  return `<article class="arcade-game-card arcade-game-card-${variant}" style="--game-accent:${game.theme.accent};--game-dark:${game.theme.dark};--card-index:${Math.min(index, 15)}">
    <a class="arcade-game-art" href="/library/${game.id}" data-nav data-game-interest="${game.id}" data-interest-kind="detail" aria-label="查看 ${escapeHtml(presentation.title)}">
      ${gameArt(game, "cover")}
      ${variant === "trending" ? `<span class="arcade-card-rank">HOT 0${index + 1}</span>` : ""}
      <span class="arcade-card-players">${escapeHtml(presentation.play.players)}</span>
      <span class="gallery-card-open" aria-hidden="true">↗</span>
    </a>
    <div class="arcade-game-copy">
      <div class="arcade-card-header">
        <span class="gallery-game-category">${escapeHtml(presentation.category)}</span>
        <a href="/library/${game.id}" data-nav data-game-interest="${game.id}" data-interest-kind="detail"><h3>${escapeHtml(presentation.title)}</h3></a>
      </div>
      <div class="gallery-card-hover">
        <p>${escapeHtml(presentation.tagline)}</p>
        <div class="arcade-card-footer">
          <div class="arcade-card-tags">${visibleTags.map((tag) => `<span class="arcade-tag">${escapeHtml(tag)}</span>`).join("")}</div>
          ${launchAction(game, actionLabel(game, "进入游戏"), "arcade-card-action")}
        </div>
      </div>
    </div>
  </article>`;
}

function gameArt(game: GameManifest, variant: "hero" | "cover", hero = false): string {
  const presentation = game.presentation;
  const art = presentation.art;
  const source = GALLERY_ART[game.id] ?? (variant === "hero" ? art.hero ?? art.cover ?? art.icon : art.cover ?? art.icon ?? art.hero);
  if (source) return `<img src="${escapeHtml(source)}" alt="${escapeHtml(presentation.title)} 展示图" ${hero ? "fetchpriority=\"high\"" : "loading=\"lazy\""}>`;
  return `<div class="arcade-art-fallback ${hero ? "arcade-art-fallback-hero" : ""}" aria-label="${escapeHtml(presentation.title)} 街机经典收录">
    <div class="arcade-cartridge-pattern" aria-hidden="true"></div>
    <span class="arcade-cartridge-mark">${escapeHtml(presentation.mark)}</span>
    <b class="arcade-cartridge-genre">${escapeHtml(presentation.category)}</b>
    <small class="arcade-cartridge-tag">ARCADE EDITION</small>
  </div>`;
}

function launchAction(game: GameManifest, label: string, className: string): string {
  if (game.platform.launch.kind === "iframe") return `<a class="${className}" href="/play/${game.id}" data-nav data-game-interest="${game.id}" data-interest-kind="launch">${label} <span>▶</span></a>`;
  if (game.platform.launch.kind === "external") return `<a class="${className}" href="${game.platform.launch.url}" target="_blank" rel="noreferrer" data-game-interest="${game.id}" data-interest-kind="launch">${label} <span>↗</span></a>`;
  return "";
}

function actionLabel(game: GameManifest, fallback: string): string {
  return game.presentation.actionLabel || fallback;
}

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

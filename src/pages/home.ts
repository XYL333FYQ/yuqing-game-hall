import { GAME_CATALOG } from "../platform/game-catalog";
import { featuredGames, playableGames, readSessionEngagement, recordSessionEngagement, trendingGames } from "../platform/game-discovery";
import type { GameAudience, GameManifest } from "../platform/game-manifest";
import { siteFooter, siteHeader } from "../platform/shell";

export function renderHome(root: HTMLElement): () => void {
  const games = playableGames(GAME_CATALOG);
  const featured = featuredGames(games);
  if (featured.length === 0) throw new Error("没有可展示的游戏资料。");
  const availableTags = [...new Set(games.flatMap((game) => game.presentation.tags))].sort((left, right) => left.localeCompare(right, "zh-CN"));

  document.title = "雨晴游戏厅 · 找一款现在想玩的游戏";
  document.body.dataset.page = "site";
  root.innerHTML = `
    <div class="site-shell arcade-shell">
      ${siteHeader("home", { search: true })}
      <main class="arcade-main">
        <section class="arcade-featured" data-featured-carousel aria-label="精选推荐">
          <div class="arcade-featured-stage" data-featured-stage></div>
          ${featured.length > 1 ? `<div class="arcade-featured-controls"><button type="button" data-featured-step="previous" aria-label="上一款精选游戏">←</button><div class="arcade-featured-dots" data-featured-dots></div><button type="button" data-featured-step="next" aria-label="下一款精选游戏">→</button></div>` : ""}
        </section>

        <section class="arcade-benefits" aria-label="游戏厅特色">
          <article><span class="arcade-benefit-icon arcade-benefit-icon-green" aria-hidden="true">🎮</span><div><b>无需下载</b><small>打开就能玩，随时随地享受游戏</small></div></article>
          <article><span class="arcade-benefit-icon arcade-benefit-icon-lime" aria-hidden="true">♟</span><div><b>丰富的游戏类型</b><small>动作、街机、策略等多种选择</small></div></article>
          <article><span class="arcade-benefit-icon arcade-benefit-icon-orange" aria-hidden="true">♥</span><div><b>和朋友一起玩</b><small>支持单人、双人及多人游戏</small></div></article>
          <article><span class="arcade-benefit-icon arcade-benefit-icon-yellow" aria-hidden="true">✦</span><div><b>纯粹的游戏体验</b><small>简单、干净、专注于乐趣</small></div></article>
        </section>

        <section class="arcade-section arcade-trending" aria-labelledby="trending-title">
          ${sectionHeading("🔥", "热门游戏", "大家都在玩的精选游戏", `<div class="arcade-heading-actions"><a class="arcade-heading-link" href="#all-games" data-nav>查看更多 <span>→</span></a><button type="button" class="arcade-refresh" data-trending-refresh>换一批 <span>↻</span></button></div>`, "trending-title")}
          <div class="arcade-trending-grid" data-trending-grid></div>
        </section>

        <section class="arcade-section arcade-all-games" id="all-games" aria-labelledby="all-games-title">
          ${sectionHeading("🎮", "全部游戏", "发现更多有趣的游戏", `<div class="arcade-heading-actions"><span class="arcade-heading-note">按人数与类型筛选</span><span class="arcade-result-count" data-result-count></span></div>`, "all-games-title")}
          <div class="arcade-filter-bar" aria-label="筛选游戏">
            <div class="arcade-filter-pills" role="group" aria-label="按人数筛选">
              <button class="is-active" type="button" data-audience="all" aria-pressed="true">全部</button>
              <button type="button" data-audience="single" aria-pressed="false">单人</button>
              <button type="button" data-audience="duo" aria-pressed="false">双人</button>
              <button type="button" data-audience="multi" aria-pressed="false">多人</button>
              ${availableTags.filter((tag) => !["单人", "多人", "本地双人", "1–4 人"].includes(tag)).slice(0, 7).map((tag) => `<button type="button" data-tag-pill="${escapeHtml(tag)}" aria-pressed="false">${escapeHtml(tag)}</button>`).join("")}
            </div>
            <span class="arcade-filter-hint">✦ 挑一款喜欢的，马上开始</span>
            <div class="arcade-select" data-sort-control>
              <span>排序</span>
              <button class="arcade-select-trigger" type="button" data-sort-trigger aria-haspopup="listbox" aria-expanded="false" aria-label="游戏排序"><span data-sort-label>热门优先</span></button>
              <div class="arcade-sort-menu" data-sort-menu role="listbox" aria-label="游戏排序选项" hidden>
                <button type="button" role="option" data-sort-option="popular" aria-selected="true">热门优先</button>
                <button type="button" role="option" data-sort-option="name" aria-selected="false">名称排序</button>
                <button type="button" role="option" data-sort-option="group" aria-selected="false">多人优先</button>
              </div>
              <select class="arcade-native-sort" data-sort aria-hidden="true" tabindex="-1"><option value="popular">热门优先</option><option value="name">名称排序</option><option value="group">多人优先</option></select>
            </div>
          </div>
          <div class="arcade-library-grid" data-game-list></div>
          <p class="arcade-empty" data-empty hidden>没有找到这款游戏，试试换个关键词或筛选条件。</p>
        </section>

        <a class="arcade-vision-card" href="/vision-lab" data-nav>
          <span class="arcade-vision-icon" aria-hidden="true">◌</span>
          <span><b>体感实验室</b><small>用摄像头试试手势互动和体感小游戏</small></span>
          <em>去体验 →</em>
        </a>
      </main>
      ${siteFooter()}
    </div>`;

  const carousel = root.querySelector<HTMLElement>("[data-featured-carousel]");
  const featuredStage = root.querySelector<HTMLElement>("[data-featured-stage]");
  const featuredDots = root.querySelector<HTMLElement>("[data-featured-dots]");
  const trendingGrid = root.querySelector<HTMLElement>("[data-trending-grid]");
  const gameList = root.querySelector<HTMLElement>("[data-game-list]");
  const resultCount = root.querySelector<HTMLElement>("[data-result-count]");
  const empty = root.querySelector<HTMLElement>("[data-empty]");
  const sortSelect = root.querySelector<HTMLSelectElement>("[data-sort]");
  const sortTrigger = root.querySelector<HTMLButtonElement>("[data-sort-trigger]");
  const sortMenu = root.querySelector<HTMLElement>("[data-sort-menu]");
  const sortLabel = root.querySelector<HTMLElement>("[data-sort-label]");
  const sortOptions = root.querySelectorAll<HTMLButtonElement>("[data-sort-option]");
  const searchInputs = root.querySelectorAll<HTMLInputElement>("[data-game-search]");
  const audienceButtons = root.querySelectorAll<HTMLButtonElement>("[data-audience]");
  const tagButtons = root.querySelectorAll<HTMLButtonElement>("[data-tag-pill]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let featuredIndex = 0;
  let trendCycle = 0;
  let audience: GameAudience | "all" = "all";
  let selectedTag = "";
  let query = "";
  let sortValue = "popular";
  let carouselTimer: number | undefined;
  let trendingTimer: number | undefined;

  const renderFeatured = (): void => {
    const game = featured[featuredIndex];
    if (featuredStage) featuredStage.innerHTML = featureSlide(game, featuredIndex, featured.length);
    if (featuredDots) featuredDots.innerHTML = featured.map((item, index) => `<button type="button" data-featured-index="${index}" aria-label="切换到 ${escapeHtml(item.presentation.title)}" aria-current="${index === featuredIndex ? "true" : "false"}"></button>`).join("");
  };
  const renderTrending = (): void => {
    if (trendingGrid) trendingGrid.innerHTML = trendingGames(games, readSessionEngagement(), { limit: 4, cycle: trendCycle }).map((game) => gameCard(game, "trending")).join("");
  };
  const updateList = (): void => {
    const matched = games
      .filter((game) => audience === "all" || game.discovery.audiences.includes(audience))
      .filter((game) => !selectedTag || game.presentation.tags.includes(selectedTag))
      .filter((game) => matchesSearch(game, query))
      .sort(sortGames(sortValue));
    if (gameList) gameList.innerHTML = matched.map((game) => gameCard(game, "library")).join("");
    if (resultCount) resultCount.textContent = `${matched.length} 款`;
    empty?.toggleAttribute("hidden", matched.length > 0);
  };
  const pauseCarousel = (): void => {
    if (carouselTimer !== undefined) window.clearInterval(carouselTimer);
    carouselTimer = undefined;
  };
  const playCarousel = (): void => {
    pauseCarousel();
    if (!reduceMotion && featured.length > 1) carouselTimer = window.setInterval(() => {
      featuredIndex = (featuredIndex + 1) % featured.length;
      renderFeatured();
    }, 7000);
  };
  const onSearch = (event: Event): void => {
    query = (event.currentTarget as HTMLInputElement).value.trim();
    searchInputs.forEach((input) => { if (input !== event.currentTarget) input.value = query; });
    updateList();
  };
  const onRootClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (sortMenu && !target?.closest("[data-sort-control]")) {
      sortMenu.hidden = true;
      sortTrigger?.setAttribute("aria-expanded", "false");
    }
    const sortOption = target?.closest<HTMLButtonElement>("[data-sort-option]");
    if (sortOption) {
      sortValue = sortOption.dataset.sortOption ?? "popular";
      if (sortSelect) sortSelect.value = sortValue;
      if (sortLabel) sortLabel.textContent = sortOption.textContent ?? "热门优先";
      sortOptions.forEach((option) => option.setAttribute("aria-selected", String(option === sortOption)));
      if (sortMenu) sortMenu.hidden = true;
      sortTrigger?.setAttribute("aria-expanded", "false");
      updateList();
      return;
    }
    if (target?.closest("[data-sort-control]")) {
      const isOpen = !sortMenu?.hidden;
      if (sortMenu) sortMenu.hidden = isOpen;
      sortTrigger?.setAttribute("aria-expanded", String(!isOpen));
      return;
    }
    const featureControl = target?.closest<HTMLButtonElement>("[data-featured-step], [data-featured-index]");
    if (featureControl) {
      const requestedIndex = featureControl.dataset.featuredIndex;
      featuredIndex = requestedIndex === undefined ? (featuredIndex + (featureControl.dataset.featuredStep === "previous" ? -1 : 1) + featured.length) % featured.length : Number(requestedIndex);
      renderFeatured();
      playCarousel();
      return;
    }
    if (target?.closest("[data-trending-refresh]")) {
      trendCycle += 1;
      renderTrending();
      return;
    }
    const interest = target?.closest<HTMLElement>("[data-game-interest]");
    if (interest?.dataset.gameInterest && (interest.dataset.interestKind === "detail" || interest.dataset.interestKind === "launch")) {
      recordSessionEngagement(interest.dataset.gameInterest, interest.dataset.interestKind);
    }
  };
  const onAudienceClick = (event: Event): void => {
    audience = (event.currentTarget as HTMLButtonElement).dataset.audience as GameAudience | "all";
    selectedTag = "";
    tagButtons.forEach((button) => {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });
    audienceButtons.forEach((button) => {
      const active = button.dataset.audience === audience;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    updateList();
  };
  const onTagClick = (event: Event): void => {
    const button = event.currentTarget as HTMLButtonElement;
    audience = "all";
    selectedTag = button.dataset.tagPill ?? "";
    audienceButtons.forEach((item) => {
      item.classList.remove("is-active");
      item.setAttribute("aria-pressed", "false");
    });
    tagButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    updateList();
  };
  root.addEventListener("click", onRootClick);
  carousel?.addEventListener("pointerenter", pauseCarousel);
  carousel?.addEventListener("pointerleave", playCarousel);
  carousel?.addEventListener("focusin", pauseCarousel);
  carousel?.addEventListener("focusout", playCarousel);
  searchInputs.forEach((input) => input.addEventListener("input", onSearch));
  audienceButtons.forEach((button) => button.addEventListener("click", onAudienceClick));
  tagButtons.forEach((button) => button.addEventListener("click", onTagClick));
  renderFeatured();
  renderTrending();
  updateList();
  if (!reduceMotion) trendingTimer = window.setInterval(() => { trendCycle += 1; renderTrending(); }, 18000);
  playCarousel();

  return () => {
    pauseCarousel();
    if (trendingTimer !== undefined) window.clearInterval(trendingTimer);
    root.removeEventListener("click", onRootClick);
    carousel?.removeEventListener("pointerenter", pauseCarousel);
    carousel?.removeEventListener("pointerleave", playCarousel);
    carousel?.removeEventListener("focusin", pauseCarousel);
    carousel?.removeEventListener("focusout", playCarousel);
    searchInputs.forEach((input) => input.removeEventListener("input", onSearch));
    audienceButtons.forEach((button) => button.removeEventListener("click", onAudienceClick));
    tagButtons.forEach((button) => button.removeEventListener("click", onTagClick));
  };
}

function featureSlide(game: GameManifest, index: number, total: number): string {
  const presentation = game.presentation;
  const launch = game.platform.launch;
  return `<article class="arcade-featured-slide arcade-featured-slide-${escapeHtml(game.id)}" style="--game-accent:${game.theme.accent};--game-dark:${game.theme.dark}" aria-roledescription="slide" aria-label="第 ${index + 1} / ${total} 个精选游戏">
    <div class="arcade-featured-copy"><span class="arcade-featured-kicker">★ 精选推荐</span><p class="arcade-overline">${escapeHtml(presentation.category)}</p><h1>${escapeHtml(presentation.title)}</h1><p>${escapeHtml(presentation.tagline)}</p><div class="arcade-tag-row">${presentation.tags.slice(0, 3).map(tagPill).join("")}</div><div class="arcade-featured-actions">${launchAction(game, actionLabel(game, launch.kind === "external" ? "前往体验" : "开始游戏"), "arcade-primary-action")}<a href="/library/${game.id}" data-nav data-game-interest="${game.id}" data-interest-kind="detail">游戏详情 <span>→</span></a></div></div>
    <div class="arcade-featured-art">${gameArt(game, "hero", true)}${game.id === "fruit-party" ? fruitDecorations() : ""}</div>
  </article>`;
}

function sectionHeading(icon: string, title: string, lead: string, aside: string, id: string): string {
  return `<div class="arcade-section-heading"><div class="arcade-section-title"><span class="arcade-section-icon" aria-hidden="true">${icon}</span><div><h2 id="${id}">${title}</h2><p>${lead}</p></div></div>${aside}</div>`;
}

function fruitDecorations(): string {
  return `<span class="arcade-fruit-deco arcade-fruit-deco-orange"><img src="/games/fruit-party/assets/fruits/orange.svg" alt=""></span><span class="arcade-fruit-deco arcade-fruit-deco-lemon"><img src="/games/fruit-party/assets/fruits/lemon.svg" alt=""></span><span class="arcade-fruit-deco arcade-fruit-deco-strawberry"><img src="/games/fruit-party/assets/fruits/strawberry.svg" alt=""></span>`;
}

function gameCard(game: GameManifest, variant: "trending" | "people" | "library"): string {
  const presentation = game.presentation;
  const launch = game.platform.launch;
  const label = actionLabel(game, launch.kind === "external" ? "打开" : "开始");
  return `<article class="arcade-game-card arcade-game-card-${variant}" style="--game-accent:${game.theme.accent};--game-dark:${game.theme.dark}">
    <a class="arcade-game-art" href="/library/${game.id}" data-nav data-game-interest="${game.id}" data-interest-kind="detail" aria-label="查看 ${escapeHtml(presentation.title)}">${gameArt(game, "cover")}</a>
    <div class="arcade-game-copy"><div class="arcade-card-meta"><span>${audienceSummary(game.discovery.audiences)}</span><small>${escapeHtml(presentation.category)}</small></div><a href="/library/${game.id}" data-nav data-game-interest="${game.id}" data-interest-kind="detail"><h3>${escapeHtml(presentation.title)}</h3></a><p>${escapeHtml(presentation.tagline)}</p><div class="arcade-card-bottom"><div class="arcade-tag-row">${presentation.tags.slice(0, 2).map(tagPill).join("")}</div>${launchAction(game, label, "arcade-card-action")}</div></div>
  </article>`;
}

function gameArt(game: GameManifest, variant: "hero" | "cover", hero = false): string {
  const presentation = game.presentation;
  const art = presentation.art;
  const source = variant === "hero" ? art.hero ?? art.cover ?? art.icon : art.cover ?? art.icon ?? art.hero;
  if (source) return `<img src="${escapeHtml(source)}" alt="${escapeHtml(presentation.title)} 展示图" ${hero ? "fetchpriority=\"high\"" : "loading=\"lazy\""}>`;
  return `<div class="arcade-art-fallback ${hero ? "arcade-art-fallback-hero" : ""}" aria-label="${escapeHtml(presentation.title)} 展示素材待补"><span>${escapeHtml(presentation.mark)}</span><b>${escapeHtml(presentation.category)}</b><small>展示素材待补</small></div>`;
}

function launchAction(game: GameManifest, label: string, className: string): string {
  if (game.platform.launch.kind === "iframe") return `<a class="${className}" href="/play/${game.id}" data-nav data-game-interest="${game.id}" data-interest-kind="launch">${label} <span>▶</span></a>`;
  if (game.platform.launch.kind === "external") return `<a class="${className}" href="${game.platform.launch.url}" target="_blank" rel="noreferrer" data-game-interest="${game.id}" data-interest-kind="launch">${label} <span>↗</span></a>`;
  return "";
}

function actionLabel(game: GameManifest, fallback: string): string {
  return game.presentation.actionLabel || fallback;
}

function tagPill(tag: string): string { return `<span class="arcade-tag">${escapeHtml(tag)}</span>`; }

function audienceSummary(audiences: readonly GameAudience[]): string {
  const labels: Record<GameAudience, string> = { single: "单人", duo: "双人", multi: "多人" };
  return audiences.map((audience) => labels[audience]).join(" · ");
}

function matchesSearch(game: GameManifest, query: string): boolean {
  if (!query) return true;
  const presentation = game.presentation;
  return [presentation.title, presentation.originalTitle ?? "", presentation.category, presentation.tagline, presentation.description, presentation.mark, ...presentation.tags].join(" ").toLocaleLowerCase("zh-CN").includes(query.toLocaleLowerCase("zh-CN"));
}

function byPopularity(left: GameManifest, right: GameManifest): number {
  return (left.discovery.popularRank ?? Number.MAX_SAFE_INTEGER) - (right.discovery.popularRank ?? Number.MAX_SAFE_INTEGER) || left.order - right.order;
}

function sortGames(sort: string): (left: GameManifest, right: GameManifest) => number {
  if (sort === "name") return (left, right) => left.presentation.title.localeCompare(right.presentation.title, "zh-CN");
  if (sort === "group") return (left, right) => Number(right.discovery.audiences.includes("multi")) - Number(left.discovery.audiences.includes("multi")) || byPopularity(left, right);
  return byPopularity;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

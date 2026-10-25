import { GAME_CATALOG } from "../platform/game-catalog";
import { featuredGames, readSessionEngagement, recordSessionEngagement, trendingGames } from "../platform/game-discovery";
import { filterGames, type GameAudienceFilter, type GameGenreFilter, type GameOnlineFilter } from "../platform/game-filters";
import type { GameManifest } from "../platform/game-manifest";
import { siteFooter, siteHeader } from "../platform/shell";
import { GALLERY_ART } from "../platform/gallery-art";
import taxonomy from "../platform/game-taxonomy.json";

export function renderHome(root: HTMLElement): () => void {
  const games = featuredGames(GAME_CATALOG);
  const featured = games;
  if (featured.length === 0) throw new Error("没有可展示的游戏资料。");
  const onlineModeCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  for (const game of games) {
    onlineModeCounts.set(game.discovery.online, (onlineModeCounts.get(game.discovery.online) ?? 0) + 1);
    for (const genre of game.discovery.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }
  const genreOptions = Object.entries(taxonomy.genres)
    .filter(([id]) => (genreCounts.get(id) ?? 0) > 0)
    .map(([id, name]) => ({ id, name, count: genreCounts.get(id) ?? 0 }));

  document.title = "雨晴游戏厅 · 找一款现在想玩的游戏";
  document.body.dataset.page = "site";
  root.innerHTML = `
    <div class="site-shell arcade-shell arcade-home">
      ${siteHeader("home", { search: true })}
      <main class="arcade-main">
        <section class="arcade-featured" data-featured-carousel aria-label="精选推荐">
          <div class="gallery-hero-object" aria-hidden="true"><img src="/platform/gallery/arcade-console.webp" alt="" width="1536" height="1024" fetchpriority="high"></div>
          <div class="arcade-featured-stage" data-featured-stage></div>
          ${featured.length > 1 ? `
            <div class="arcade-featured-controls">
              <span class="arcade-featured-counter" data-featured-counter aria-live="polite">01 / ${String(featured.length).padStart(2, "0")}</span>
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
                  <button class="is-active" type="button" data-audience="all" aria-pressed="true">全部 <em>${games.length}</em></button>
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

  const carousel = root.querySelector<HTMLElement>("[data-featured-carousel]");
  const home = root.querySelector<HTMLElement>(".arcade-home");
  const header = root.querySelector<HTMLElement>(".site-header");
  const headerObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
    if (header) home?.style.setProperty("--gallery-header-height", `${header.getBoundingClientRect().height}px`);
  }) : undefined;
  if (header) headerObserver?.observe(header);
  const featuredStage = root.querySelector<HTMLElement>("[data-featured-stage]");
  const featuredDots = root.querySelector<HTMLElement>("[data-featured-dots]");
  const featuredCounter = root.querySelector<HTMLElement>("[data-featured-counter]");
  const recentSection = root.querySelector<HTMLElement>("[data-recent-section]");
  const recentList = root.querySelector<HTMLElement>("[data-recent-list]");
  const trendingGrid = root.querySelector<HTMLElement>("[data-trending-grid]");
  const gameList = root.querySelector<HTMLElement>("[data-game-list]");
  const libraryMore = root.querySelector<HTMLButtonElement>("[data-library-more]");
  const resultCount = root.querySelector<HTMLElement>("[data-result-count]");
  const empty = root.querySelector<HTMLElement>("[data-empty]");
  const sortSelect = root.querySelector<HTMLSelectElement>("[data-sort]");
  const sortTrigger = root.querySelector<HTMLButtonElement>("[data-sort-trigger]");
  const sortControl = root.querySelector<HTMLElement>("[data-sort-control]");
  const sortMenu = root.querySelector<HTMLElement>("[data-sort-menu]");
  const sortLabel = root.querySelector<HTMLElement>("[data-sort-label]");
  const sortOptions = root.querySelectorAll<HTMLButtonElement>("[data-sort-option]");
  const searchInputs = root.querySelectorAll<HTMLInputElement>("[data-game-search]");
  const searchClearButtons = root.querySelectorAll<HTMLButtonElement>("[data-search-clear]");
  const audienceButtons = root.querySelectorAll<HTMLButtonElement>("[data-audience]");
  const onlineButtons = root.querySelectorAll<HTMLButtonElement>("[data-online]");
  const genreButtons = root.querySelectorAll<HTMLButtonElement>("[data-genre]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let featuredIndex = 0;
  let trendCycle = 0;
  let audience: GameAudienceFilter = "all";
  let online: GameOnlineFilter = "all";
  let genre: GameGenreFilter = "all";
  let query = "";
  let sortValue = "popular";
  let libraryLimit = 12;
  let carouselTimer: number | undefined;
  let featureExitTimer: number | undefined;
  let trendingTimer: number | undefined;

  const setSortOpen = (open: boolean): void => {
    if (sortMenu) sortMenu.hidden = !open;
    sortTrigger?.setAttribute("aria-expanded", String(open));
    if (open) Array.from(sortOptions).find(option => option.getAttribute("aria-selected") === "true")?.focus();
  };
  const onSortFocusOut = (event: FocusEvent): void => {
    if (!(event.relatedTarget instanceof Element) || !sortControl?.contains(event.relatedTarget)) setSortOpen(false);
  };

  const syncSearchClear = (): void => {
    searchClearButtons.forEach((btn) => {
      btn.hidden = query.length === 0;
    });
  };

  const renderRecent = (): void => {
    if (!recentSection || !recentList) return;
    const engagement = readSessionEngagement();
    const recentIds = Object.entries(engagement)
      .filter(([, counts]) => counts.launch > 0 || counts.detail > 0)
      .sort((left, right) => (right[1].launch * 10 + right[1].detail) - (left[1].launch * 10 + left[1].detail))
      .slice(0, 6)
      .map(([id]) => id);
    const recentGames = recentIds
      .map((id) => games.find((g) => g.id === id))
      .filter((g): g is GameManifest => Boolean(g));
    if (recentGames.length === 0) {
      recentSection.hidden = true;
      return;
    }
    recentSection.hidden = false;
    recentList.innerHTML = recentGames.map((game) => {
      const targetHref = game.platform.launch.kind === "iframe" ? `/play/${game.id}` : `/library/${game.id}`;
      return `<a class="arcade-recent-pill" href="${targetHref}" data-nav style="--game-accent:${game.theme.accent}">
        <span class="arcade-recent-mark">${escapeHtml(game.presentation.mark)}</span>
        <strong>${escapeHtml(game.presentation.title)}</strong>
        <small>${escapeHtml(game.presentation.category)}</small>
      </a>`;
    }).join("");
  };

  const renderFeatured = (): void => {
    const game = featured[featuredIndex];
    if (carousel) {
      carousel.style.setProperty("--game-accent", game.theme.accent);
      carousel.style.setProperty("--game-dark", game.theme.dark);
    }
    if (featuredStage) {
      if (featureExitTimer !== undefined) window.clearTimeout(featureExitTimer);
      featuredStage.querySelector(".feature-slide-previous")?.remove();
      const previous = featuredStage.querySelector<HTMLElement>(".arcade-featured-slide");
      const snapshot = previous && !reduceMotion ? previous.cloneNode(true) as HTMLElement : undefined;
      featuredStage.innerHTML = featureSlide(game, featuredIndex, featured.length);
      if (snapshot) {
        snapshot.classList.add("feature-slide-previous");
        snapshot.setAttribute("aria-hidden", "true");
        snapshot.inert = true;
        featuredStage.append(snapshot);
        featureExitTimer = window.setTimeout(() => {
          snapshot.remove();
          featureExitTimer = undefined;
        }, 580);
      }
    }
    if (featuredCounter) {
      featuredCounter.textContent = `${String(featuredIndex + 1).padStart(2, "0")} / ${String(featured.length).padStart(2, "0")}`;
    }
    const dotStart = Math.floor(featuredIndex / 5) * 5;
    if (featuredDots) featuredDots.innerHTML = featured.slice(dotStart, dotStart + 5).map((item, offset) => {
      const index = dotStart + offset;
      return `<button type="button" data-featured-index="${index}" title="${escapeHtml(item.presentation.title)}" aria-label="切换到 ${escapeHtml(item.presentation.title)}" aria-current="${index === featuredIndex ? "true" : "false"}"></button>`;
    }).join("");
  };
  const renderTrending = (): void => {
    if (trendingGrid) trendingGrid.innerHTML = trendingGames(games, readSessionEngagement(), { limit: 4, cycle: trendCycle }).map((game, idx) => gameCard(game, "trending", idx)).join("");
  };
  const updateList = (): void => {
    const matched = filterGames(games, { audience, online, genre, query }).sort(sortGames(sortValue));
    if (gameList) gameList.innerHTML = matched.slice(0, libraryLimit).map((game, idx) => gameCard(game, "library", idx)).join("");
    if (libraryMore) {
      libraryMore.hidden = matched.length <= libraryLimit;
      libraryMore.textContent = `继续浏览 ${Math.max(0, matched.length - libraryLimit)} 款游戏 ↓`;
    }
    if (resultCount) resultCount.textContent = `${matched.length} 款`;
    empty?.toggleAttribute("hidden", matched.length > 0);
  };
  const pauseCarousel = (): void => {
    if (carouselTimer !== undefined) window.clearInterval(carouselTimer);
    carouselTimer = undefined;
    carousel?.classList.add("is-paused");
  };
  const playCarousel = (): void => {
    pauseCarousel();
    if (carousel?.matches(":hover, :focus-within")) return;
    carousel?.classList.remove("is-paused");
    if (!reduceMotion && featured.length > 1) carouselTimer = window.setInterval(() => {
      if (document.documentElement.dataset.themeTransition === "portal") return;
      featuredIndex = (featuredIndex + 1) % featured.length;
      renderFeatured();
    }, 7000);
  };
  const onSearch = (event: Event): void => {
    libraryLimit = 12;
    query = (event.currentTarget as HTMLInputElement).value.trim();
    searchInputs.forEach((input) => { if (input !== event.currentTarget) input.value = query; });
    syncSearchClear();
    updateList();
  };
  const setActiveFilterButton = (buttons: NodeListOf<HTMLButtonElement>, group: "audience" | "online" | "genre", value: string): void => {
    buttons.forEach((button) => {
      const active = button.dataset[group] === value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };
  const resetAllFilters = (): void => {
    libraryLimit = 12;
    query = "";
    audience = "all";
    online = "all";
    genre = "all";
    searchInputs.forEach((input) => { input.value = ""; });
    syncSearchClear();
    setActiveFilterButton(audienceButtons, "audience", "all");
    setActiveFilterButton(onlineButtons, "online", "all");
    setActiveFilterButton(genreButtons, "genre", "all");
    updateList();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (sortControl?.contains(document.activeElement)) {
      if (event.key === "Escape" && !sortMenu?.hidden) {
        event.preventDefault();
        setSortOpen(false);
        sortTrigger?.focus();
        return;
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        if (sortMenu?.hidden) setSortOpen(true);
        else {
          const options = Array.from(sortOptions);
          const index = options.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
            : index < 0 ? (event.key === "ArrowDown" ? 0 : options.length - 1)
              : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
          options[next]?.focus();
        }
        return;
      }
    }
    if (event.key === "Enter" && document.activeElement instanceof HTMLInputElement && document.activeElement.hasAttribute("data-game-search")) {
      root.querySelector("#all-games")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      return;
    }
    if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
      event.preventDefault();
      const firstInput = searchInputs[0];
      firstInput?.focus();
      firstInput?.select();
      return;
    }
    if (event.key === "Escape" && document.activeElement instanceof HTMLInputElement) {
      if (query) {
        query = "";
        searchInputs.forEach((input) => { input.value = ""; });
        syncSearchClear();
        updateList();
      } else {
        document.activeElement.blur();
      }
      return;
    }
    if (carousel?.contains(document.activeElement)) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        featuredIndex = (featuredIndex - 1 + featured.length) % featured.length;
        renderFeatured();
        playCarousel();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        featuredIndex = (featuredIndex + 1) % featured.length;
        renderFeatured();
        playCarousel();
      }
    }
  };
  const onRootClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-search-clear]")) {
      query = "";
      searchInputs.forEach((input) => { input.value = ""; });
      syncSearchClear();
      updateList();
      searchInputs[0]?.focus();
      return;
    }
    if (target?.closest("[data-reset-filters]")) {
      resetAllFilters();
      return;
    }
    if (target?.closest("[data-library-more]")) {
      const previousCount = gameList?.children.length ?? 0;
      libraryLimit = games.length;
      updateList();
      gameList?.querySelectorAll<HTMLAnchorElement>(".arcade-game-art")[previousCount]?.focus({ preventScroll: true });
      return;
    }
    if (target?.closest("[data-random-launch]")) {
      const randomGame = games[Math.floor(Math.random() * games.length)];
      if (randomGame) {
        recordSessionEngagement(randomGame.id, "detail");
        window.history.pushState({}, "", `/library/${randomGame.id}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      return;
    }
    if (sortMenu && !target?.closest("[data-sort-control]")) {
      setSortOpen(false);
    }
    const sortOption = target?.closest<HTMLButtonElement>("[data-sort-option]");
    if (sortOption) {
      libraryLimit = 12;
      sortValue = sortOption.dataset.sortOption ?? "popular";
      if (sortSelect) sortSelect.value = sortValue;
      if (sortLabel) sortLabel.textContent = sortOption.textContent ?? "热门优先";
      sortOptions.forEach((option) => option.setAttribute("aria-selected", String(option === sortOption)));
      setSortOpen(false);
      sortTrigger?.focus();
      updateList();
      return;
    }
    const sortTriggerEl = target?.closest<HTMLButtonElement>("[data-sort-trigger]");
    if (sortTriggerEl) {
      const isOpen = !sortMenu?.hidden;
      setSortOpen(!isOpen);
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
      renderRecent();
    }
  };
  const onAudienceClick = (event: Event): void => {
    libraryLimit = 12;
    audience = (event.currentTarget as HTMLButtonElement).dataset.audience as GameAudienceFilter;
    setActiveFilterButton(audienceButtons, "audience", audience);
    updateList();
  };
  const onOnlineClick = (event: Event): void => {
    libraryLimit = 12;
    online = (event.currentTarget as HTMLButtonElement).dataset.online as GameOnlineFilter;
    setActiveFilterButton(onlineButtons, "online", online);
    updateList();
  };
  const onGenreClick = (event: Event): void => {
    libraryLimit = 12;
    const button = event.currentTarget as HTMLButtonElement;
    genre = button.dataset.genre === genre ? "all" : button.dataset.genre as GameGenreFilter;
    setActiveFilterButton(genreButtons, "genre", genre);
    updateList();
  };
  root.addEventListener("click", onRootClick);
  sortControl?.addEventListener("focusout", onSortFocusOut);
  window.addEventListener("keydown", onKeyDown);
  carousel?.addEventListener("pointerenter", pauseCarousel);
  carousel?.addEventListener("pointerleave", playCarousel);
  carousel?.addEventListener("focusin", pauseCarousel);
  carousel?.addEventListener("focusout", playCarousel);
  searchInputs.forEach((input) => input.addEventListener("input", onSearch));
  audienceButtons.forEach((button) => button.addEventListener("click", onAudienceClick));
  onlineButtons.forEach((button) => button.addEventListener("click", onOnlineClick));
  genreButtons.forEach((button) => button.addEventListener("click", onGenreClick));
  renderFeatured();
  renderRecent();
  renderTrending();
  updateList();
  if (!reduceMotion) trendingTimer = window.setInterval(() => {
    if (document.documentElement.dataset.themeTransition === "portal") return;
    trendCycle += 1;
    renderTrending();
  }, 18000);
  playCarousel();

  return () => {
    headerObserver?.disconnect();
    if (featureExitTimer !== undefined) window.clearTimeout(featureExitTimer);
    pauseCarousel();
    if (trendingTimer !== undefined) window.clearInterval(trendingTimer);
    root.removeEventListener("click", onRootClick);
    sortControl?.removeEventListener("focusout", onSortFocusOut);
    window.removeEventListener("keydown", onKeyDown);
    carousel?.removeEventListener("pointerenter", pauseCarousel);
    carousel?.removeEventListener("pointerleave", playCarousel);
    carousel?.removeEventListener("focusin", pauseCarousel);
    carousel?.removeEventListener("focusout", playCarousel);
    searchInputs.forEach((input) => input.removeEventListener("input", onSearch));
    audienceButtons.forEach((button) => button.removeEventListener("click", onAudienceClick));
    onlineButtons.forEach((button) => button.removeEventListener("click", onOnlineClick));
    genreButtons.forEach((button) => button.removeEventListener("click", onGenreClick));
  };
}

function featureSlide(game: GameManifest, index: number, total: number): string {
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

function gameCard(game: GameManifest, variant: "trending" | "people" | "library", index = 0): string {
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

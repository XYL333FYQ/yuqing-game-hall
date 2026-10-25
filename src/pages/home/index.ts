import { GAME_CATALOG } from "../../platform/game-catalog";
import { featuredGames, readSessionEngagement, recordSessionEngagement, trendingGames } from "../../platform/game-discovery";
import { filterGames, sortGames, type GameAudienceFilter, type GameGenreFilter, type GameOnlineFilter } from "../../platform/game-filters";
import type { GameManifest } from "../../platform/game-manifest";
import taxonomy from "../../platform/game-taxonomy.json";
import { escapeHtml, featureSlide, gameCard, homeMarkup } from "./templates";

/** 首页：精选轮播、热门推荐与带筛选的游戏库；返回的函数负责清理事件与计时器。 */
export function renderHome(root: HTMLElement): () => void {
  const games = featuredGames(GAME_CATALOG);
  if (games.length === 0) throw new Error("没有可展示的游戏资料。");
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
  root.innerHTML = homeMarkup({ gameCount: games.length, onlineModeCounts, genreOptions });

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
    const game = games[featuredIndex];
    if (carousel) {
      carousel.style.setProperty("--game-accent", game.theme.accent);
      carousel.style.setProperty("--game-dark", game.theme.dark);
    }
    if (featuredStage) {
      if (featureExitTimer !== undefined) window.clearTimeout(featureExitTimer);
      featuredStage.querySelector(".feature-slide-previous")?.remove();
      const previous = featuredStage.querySelector<HTMLElement>(".arcade-featured-slide");
      const snapshot = previous && !reduceMotion ? previous.cloneNode(true) as HTMLElement : undefined;
      featuredStage.innerHTML = featureSlide(game, featuredIndex, games.length);
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
      featuredCounter.textContent = `${String(featuredIndex + 1).padStart(2, "0")} / ${String(games.length).padStart(2, "0")}`;
    }
    const dotStart = Math.floor(featuredIndex / 5) * 5;
    if (featuredDots) featuredDots.innerHTML = games.slice(dotStart, dotStart + 5).map((item, offset) => {
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
    if (!reduceMotion && games.length > 1) carouselTimer = window.setInterval(() => {
      if (document.documentElement.dataset.themeTransition === "portal") return;
      featuredIndex = (featuredIndex + 1) % games.length;
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
        featuredIndex = (featuredIndex - 1 + games.length) % games.length;
        renderFeatured();
        playCarousel();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        featuredIndex = (featuredIndex + 1) % games.length;
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
      featuredIndex = requestedIndex === undefined ? (featuredIndex + (featureControl.dataset.featuredStep === "previous" ? -1 : 1) + games.length) % games.length : Number(requestedIndex);
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

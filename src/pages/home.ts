import { siteFooter, siteHeader } from "../platform/shell";
import { GAME_CATALOG } from "../platform/game-catalog";
import type { GameManifest } from "../platform/game-manifest";
import { LIBRARY_GAMES, type LibraryGame } from "../data/gameLibrary";

export function renderHome(root: HTMLElement): () => void {
  const featuredGame = GAME_CATALOG.find((game) => game.featured) ?? GAME_CATALOG.find((game) => game.launch.kind !== "none");
  if (!featuredGame) throw new Error("没有可展示的游戏 Manifest。");
  const siteGames = GAME_CATALOG.filter((game) => game.launch.kind === "iframe").length;
  const serverGames = GAME_CATALOG.filter((game) => game.hosting === "server").length;
  const restrictedGames = GAME_CATALOG.filter((game) => game.hosting === "restricted").length;
  const staticGames = GAME_CATALOG.filter((game) => game.launch.kind === "iframe").length;
  document.title = "雨晴游戏厅";
  document.body.dataset.page = "site";
  root.innerHTML = `
    <div class="site-shell">
      ${siteHeader("games")}
      <main>
        <section class="home-hero">
          <div class="home-hero-copy">
            <div class="hero-index"><span><i></i> ${siteGames} 款随站运行 · ${serverGames} 款在线服务</span><b>雨晴游戏厅</b></div>
            <p class="kicker">今天想玩什么</p>
            <h1>进一个厅，<br><span>慢慢挑。</span></h1>
            <p>动作、竞速、街机和多人派对都从这里进入。每款游戏通过自己的 Manifest 声明资料与入口，平台负责发现、展示和统一启动。</p>
            <div class="hero-actions">
              <a class="button primary hero-primary" href="/games/${featuredGame.id}" data-nav><span>先玩${featuredGame.name}</span><b>→</b></a>
              <a class="text-link" href="#game-library">浏览全部游戏 <span>↓</span></a>
            </div>
            <div class="hero-proof" aria-label="游戏厅状态">
              <span><b>${siteGames}</b><small>随站点运行</small></span>
              <span><b>${serverGames}</b><small>独立联机服务</small></span>
              <span><b>${restrictedGames}</b><small>许可受限</small></span>
            </div>
          </div>
          <div class="hero-visual">
            <div class="poster-topline"><span>本期主打 · ${featuredGame.name}</span><b><i></i> ${featuredGame.hostingLabel}</b></div>
            ${manifestArtwork(featuredGame, "hero")}
            <div class="hero-spec"><span><small>操作</small><strong>${featuredGame.play.controls}</strong></span><span><small>玩法</small><strong>${featuredGame.play.modes}</strong></span></div>
            <span class="hero-badge">${featuredGame.mark}</span>
          </div>
        </section>

        <section class="content-section published-section" aria-labelledby="available-title">
          <div class="section-heading"><div><p class="kicker">正式机位</p><h2 id="available-title">已经完成，可以认真玩</h2></div><span><i></i> 通过构建、规则与中文化验收</span></div>
          <a class="game-card" href="/games/${featuredGame.id}" data-nav>
            <div class="game-card-art"><span class="game-card-number">01</span>${manifestArtwork(featuredGame, "card")}<span class="game-card-corner">${featuredGame.play.controls}</span></div>
            <div class="game-card-body">
              <p class="card-index">第一款正式游戏</p>
              <div class="tag-row"><span class="tag green">${featuredGame.hostingLabel}</span>${featuredGame.tags.slice(0, 2).map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
              <h3>${featuredGame.name}</h3>
              <p>${featuredGame.description}</p>
              <div class="game-card-stats"><span><b>${featuredGame.play.inputs.length}</b><small>种输入</small></span><span><b>${featuredGame.play.devices.length}</b><small>类设备</small></span><span><b>${featuredGame.tags.length}</b><small>个标签</small></span></div>
              <span class="card-action">进入正式机位 <b>→</b></span>
            </div>
          </a>
        </section>

        <section class="library-section" id="game-library" aria-labelledby="library-title">
          <div class="library-heading">
            <div><p class="kicker">开源游戏区</p><h2 id="library-title">${LIBRARY_GAMES.length} 种玩法，都在同一个厅</h2><p>${staticGames} 款静态作品已经收进游戏厅并接入中文层；${serverGames} 款大型联机作品使用独立服务入口，避免用一个永远转圈的框假装已经加载。</p></div>
            <div class="library-count"><strong>${LIBRARY_GAMES.length}</strong><span>款项目统一管理</span></div>
          </div>
          <div class="library-legend"><span><i class="static-dot"></i>静态接入：可随 Cloudflare 直接发布</span><span><i class="server-dot"></i>独立服务：联机后端部署在服务器</span><span><i class="restricted-dot"></i>许可受限：不复用代码</span><b><i></i> 游戏入口已经统一</b></div>
          <div class="library-grid">
            ${LIBRARY_GAMES.map((game) => libraryCard(game)).join("")}
          </div>
        </section>

        <section class="promotion-policy">
          <span class="promotion-number">质量线</span>
          <div><p class="kicker">以后统一照这个标准</p><h2>能打开只是第一关</h2><p>每款游戏都要经过中文导览、许可核对、资源本地化、性能检查和真实浏览器验收。静态作品放在 <code>public/games/</code>，需要后端的作品单独放入服务器部署区，原始研究仓库仍与正式运行目录隔离。</p></div>
          <a class="text-link" href="/vision-lab" data-nav>体感实验室 <span>→</span></a>
        </section>
      </main>
      ${siteFooter()}
    </div>`;

  return () => undefined;
}

function manifestArtwork(game: GameManifest, variant: "hero" | "card"): string {
  if (game.cover) return `<img class="manifest-art manifest-art-${variant}" src="${game.cover}" alt="${game.name}" loading="lazy">`;
  return `<div class="manifest-art manifest-art-${variant}" style="--game-accent:${game.theme.accent};--game-dark:${game.theme.dark}"><strong>${game.mark}</strong><span>${game.originalName}</span></div>`;
}

function libraryCard(game: LibraryGame): string {
  const availability = game.localPath ? "随站点部署" : game.status === "server" ? "独立在线服务" : "仅保留说明";
  return `
    <a class="library-card" href="/games/${game.slug}" data-nav style="--game-accent:${game.accent};--game-dark:${game.dark}">
      <div class="library-card-cover" aria-hidden="true">
        ${game.cover ? `<img src="${game.cover}" alt="">` : ""}
        <span class="cover-grid"></span><span class="cover-orbit orbit-one"></span><span class="cover-orbit orbit-two"></span>
        <strong>${game.mark}</strong><small>${game.originalTitle}</small><b>${String(game.order).padStart(2, "0")}</b>
      </div>
      <div class="library-card-body">
        <div class="library-card-topline"><span class="library-status ${game.status}">${game.statusLabel}</span><em>${availability}</em></div>
        <p>${game.genre}</p><h3>${game.title}</h3><small>${game.summary}</small>
        <div class="tag-row">${game.tags.slice(0, 3).map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
        <span class="card-action">查看中文介绍与试玩入口 <b>→</b></span>
      </div>
    </a>`;
}

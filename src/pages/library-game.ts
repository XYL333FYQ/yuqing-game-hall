import { siteFooter, siteHeader } from "../platform/shell";
import { findLibraryGame, type LibraryGame } from "../data/gameLibrary";

export function renderLibraryGame(root: HTMLElement, slug: string): () => void {
  const game = findLibraryGame(slug);
  if (!game) throw new Error("没有找到这款游戏。");

  document.title = `${game.title} · 雨晴游戏厅`;
  document.body.dataset.page = "site";
  const primaryAction = actionMarkup(game);
  const notice = statusNotice(game);

  root.innerHTML = `
    <div class="site-shell">
      ${siteHeader("games")}
      <main class="library-detail">
        <a class="back-link" href="/#game-library" data-nav>← 返回游戏厅</a>
        <section class="library-detail-hero" style="--game-accent:${game.accent};--game-dark:${game.dark}">
          <div class="library-detail-cover" aria-hidden="true">
            ${game.cover ? `<img src="${game.cover}" alt="">` : ""}
            <span class="cover-grid"></span><span class="cover-orbit orbit-one"></span><span class="cover-orbit orbit-two"></span>
            <strong>${game.mark}</strong><small>${game.originalTitle}</small>
          </div>
          <div class="library-detail-copy">
            <div class="library-status-row"><span class="library-status ${game.status}">${game.statusLabel}</span><span>游戏 ${String(game.order).padStart(2, "0")}</span></div>
            <p class="detail-index">${game.genre}</p>
            <h1>${game.title}</h1>
            <p class="original-title">原项目 · ${game.originalTitle}</p>
            <p class="library-lead">${game.summary}</p>
            <div class="tag-row">${game.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
            <div class="library-actions">${primaryAction}<a class="button secondary" href="${game.sourceUrl}" target="_blank" rel="noreferrer">查看源码</a></div>
          </div>
        </section>

        <section class="trial-notice ${game.status}">
          <span>${notice.badge}</span>
          <div><strong>${notice.title}</strong><p>${notice.copy}</p></div>
        </section>

        <section class="library-facts" aria-label="项目概况">
          <div><small>游玩方式</small><strong>${game.mode}</strong></div>
          <div><small>主要操作</small><strong>${game.controls}</strong></div>
          <div><small>技术结构</small><strong>${game.runtime}</strong></div>
          <div><small>开源许可</small><strong>${game.license}</strong></div>
        </section>

        ${game.screenshots.length > 0 ? `
          <section class="library-screenshots" aria-label="游戏截图">
            <p class="kicker">游戏截图</p>
            <div>${game.screenshots.map((screenshot) => `<img src="${screenshot}" alt="${game.title} 截图" loading="lazy">`).join("")}</div>
          </section>` : ""}

        <section class="library-analysis">
          <article class="analysis-card wide"><p class="kicker">为什么纳入游戏厅</p><h2>适配判断</h2><p>${game.fit}</p></article>
          <article class="analysis-card"><p class="kicker">值得拆解</p><h2>已有亮点</h2><ul>${game.highlights.map((item) => `<li>${item}</li>`).join("")}</ul></article>
          <article class="analysis-card caution"><p class="kicker">仍需继续处理</p><h2>已知边界</h2><ul>${game.cautions.map((item) => `<li>${item}</li>`).join("")}</ul></article>
          <article class="analysis-card wide localization-card"><p class="kicker">中文化进度</p><h2>先把关键入口说清楚</h2><p>${game.localization}</p></article>
        </section>
      </main>
      ${siteFooter()}
    </div>`;

  return () => undefined;
}

function actionMarkup(game: LibraryGame): string {
  if (game.localPath) return `<a class="button primary" href="/games/${game.slug}/play" data-nav>进入游戏</a>`;
  if (game.onlineUrl) return `<a class="button primary" href="${game.onlineUrl}" target="_blank" rel="noreferrer">连接在线服务</a>`;
  return `<span class="button disabled-button" aria-disabled="true">许可证不允许改造</span>`;
}

function statusNotice(game: LibraryGame): { badge: string; title: string; copy: string } {
  if (game.status === "static") return {
    badge: "接入",
    title: "这款游戏可在游戏厅内直接运行",
    copy: "运行资源已经收进正式静态目录，Cloudflare 和普通静态服务器都能托管；中文化按核心入口、规则和高频操作分层继续完善。",
  };
  if (game.status === "server") return {
    badge: "服务",
    title: "这款联机游戏需要常驻服务器",
    copy: "游戏厅保留统一中文介绍，并连接已核验的上游在线版本。自建时需要部署它自己的房间服务和 WebSocket，不能只上传前端文件。",
  };
  return {
    badge: "受限",
    title: "许可证明确阻止本项目使用其代码",
    copy: "为了尊重原作者条款，这里只保留产品观察和源码链接，不复制、不修改，也不打包进发布版本。",
  };
}

import { describe, expect, it, vi } from "vitest";
import { GAME_CATALOG } from "../src/platform/game-catalog";
import type { GameManifest } from "../src/platform/game-manifest";
import { escapeHtml, gameCard, homeMarkup } from "../src/pages/home/templates";

// 页头页脚依赖浏览器环境；这里只验证首页自身的骨架。
vi.mock("../src/shell/shell", () => ({ siteHeader: () => "", siteFooter: () => "" }));

const iframeGame = GAME_CATALOG.find((game) => game.platform.launch.kind === "iframe") as GameManifest;
const externalGame = GAME_CATALOG.find((game) => game.platform.launch.kind === "external") as GameManifest;
const restrictedGame = GAME_CATALOG.find((game) => game.platform.launch.kind === "none") as GameManifest;

describe("首页模板", () => {
  it("escapeHtml 转义可能破坏结构的字符", () => {
    expect(escapeHtml(`<b class="x">&</b>`)).toBe("&lt;b class=&quot;x&quot;&gt;&amp;&lt;/b&gt;");
  });

  it("游戏卡片对标题做转义，避免清单文案破坏页面结构", () => {
    const tricky: GameManifest = {
      ...iframeGame,
      presentation: { ...iframeGame.presentation, title: `<img src=x onerror=alert(1)>` },
    };
    const markup = gameCard(tricky, "library");
    expect(markup).not.toContain("<img src=x");
    expect(markup).toContain("&lt;img src=x");
  });

  it("按启动方式生成入口：iframe 走站内播放页，外部游戏新窗口打开，受限项目没有入口", () => {
    expect(gameCard(iframeGame, "library")).toContain(`href="/play/${iframeGame.id}"`);
    const external = gameCard(externalGame, "library");
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noreferrer"');
    expect(gameCard(restrictedGame, "library")).not.toContain("arcade-card-action");
  });

  it("首页骨架包含三组带标签的筛选，并使用传入的数量", () => {
    const markup = homeMarkup({
      gameCount: 56,
      onlineModeCounts: new Map([["friend-room", 7], ["public", 4]]),
      genreOptions: [{ id: "arcade", name: "街机", count: 10 }],
    });
    for (const label of ["按人数筛选", "按联机方式筛选", "按分类筛选"]) expect(markup).toContain(`aria-label="${label}"`);
    expect(markup).toContain('data-online="friend-room"');
    expect(markup).toContain("好友联机 <em>7</em>");
    expect(markup).toContain("公开联机 <em>4</em>");
    expect(markup).toContain('data-genre="arcade"');
    expect(markup).toContain("全部 <em>56</em>");
  });
});

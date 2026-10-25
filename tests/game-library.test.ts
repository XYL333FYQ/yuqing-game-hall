import { describe, expect, it } from "vitest";
import { GAME_CATALOG, findGame } from "../src/platform/game-catalog";
import { iframeAllowPolicy } from "../src/platform/game-launch";

describe("统一游戏库", () => {
  it("所有游戏都按公开介绍与内部运行数据分层", () => {
    const forbidden = /静态版|部署|架构|技术栈|技术结构|WebSocket|Cloudflare|服务器|许可证|源码|中文化|适配|接入/i;
    for (const game of GAME_CATALOG) {
      const presentation = game.presentation;
      const publicCopy = [
        presentation.title,
        presentation.originalTitle ?? "",
        presentation.mark,
        presentation.category,
        presentation.tagline,
        presentation.description,
        presentation.actionLabel,
        ...presentation.tags,
        ...presentation.highlights,
      ].join(" ");
      expect(publicCopy).not.toMatch(forbidden);
      expect(game).not.toHaveProperty("technology");
      expect(game).not.toHaveProperty("sourceUrl");
      expect(game.platform.technology).toBeTruthy();
      expect(game.platform.launch).toBeDefined();
    }
  });

  it("游戏 id 与排序值全目录唯一，按 id 可以查到对应目录项", () => {
    expect(new Set(GAME_CATALOG.map((game) => game.id)).size).toBe(GAME_CATALOG.length);
    expect(new Set(GAME_CATALOG.map((game) => game.order)).size).toBe(GAME_CATALOG.length);
    for (const game of GAME_CATALOG) expect(findGame(game.id)).toBe(game);
    expect(findGame("not-a-game")).toBeUndefined();
  });

  it("所有 iframe 静态游戏都访问 Manifest 声明的随站点发布入口", () => {
    const iframeGames = GAME_CATALOG.filter((game) => game.platform.launch.kind === "iframe");
    expect(iframeGames.length).toBeGreaterThan(0);
    for (const game of iframeGames) {
      const launch = game.platform.launch;
      if (launch.kind !== "iframe") continue;
      expect(game.presentation.availability.state).toBe("playable");
      expect(launch.entry).toMatch(/^\/games\/[A-Za-z0-9_/-]+(?:\.html)?$/);
      expect(launch.entry).toMatch(/\.html$/);
      expect(launch.entry).not.toContain("..");
    }
  });

  it("受限项目不会暴露试玩按钮", () => {
    const kaetram = findGame("kaetram");
    expect(kaetram?.presentation.availability.state).toBe("unavailable");
    expect(kaetram?.platform.launch.kind).toBe("none");
  });

  it("游戏可在 Manifest 中声明自己的启动页，而不改变可校验的 HTML 入口", () => {
    const launch = findGame("fruit-party")?.platform.launch;
    expect(launch?.kind).toBe("iframe");
    if (launch?.kind !== "iframe") return;
    expect(launch.entry).toBe("/games/fruit-party/index.html");
    expect(launch.startUrl).toBe("/games/fruit-party/index.html?route=home");
    expect(findGame("fruit-party")?.presentation.actionLabel).toBe("选择玩法");
  });

  it("只给明确声明的 iframe 游戏开放麦克风", () => {
    const derKoloss = findGame("der-koloss");
    const fruitParty = findGame("fruit-party");
    expect(derKoloss && iframeAllowPolicy(derKoloss)).toContain("microphone");
    expect(derKoloss && iframeAllowPolicy(derKoloss)).toContain("camera 'none'");
    expect(fruitParty && iframeAllowPolicy(fruitParty)).toContain("microphone 'none'");
    expect(fruitParty && iframeAllowPolicy(fruitParty)).toContain("camera 'none'");
  });
});

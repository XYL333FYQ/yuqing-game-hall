import { describe, expect, it } from "vitest";
import { LIBRARY_GAMES, findLibraryGame, iframeAllowPolicy } from "../src/data/gameLibrary";
import { GAME_CATALOG } from "../src/platform/game-catalog";

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

  it("从 Manifest 派生所有游戏项目", () => {
    expect(LIBRARY_GAMES).toHaveLength(GAME_CATALOG.length);
    expect(new Set(LIBRARY_GAMES.map((game) => game.slug)).size).toBe(GAME_CATALOG.length);
    expect(new Set(LIBRARY_GAMES.map((game) => game.order)).size).toBe(GAME_CATALOG.length);
    expect(LIBRARY_GAMES.map((game) => game.slug)).toEqual(GAME_CATALOG.map((game) => game.id));
  });

  it("所有 iframe 静态游戏都访问 Manifest 声明的随站点发布入口", () => {
    const localGames = LIBRARY_GAMES.filter((game) => game.localPath);
    const iframeGames = GAME_CATALOG.filter((game) => game.platform.launch.kind === "iframe");
    expect(localGames).toHaveLength(iframeGames.length);
    for (const game of localGames) {
      expect(game.status).toBe("playable");
      expect(game.localPath).toMatch(/^\/games\/[A-Za-z0-9_/-]+(?:\.html)?$/);
      expect(game.localPath).toMatch(/\.html$/);
      expect(game.localPath).not.toContain("..");
    }
  });

  it("受限项目不会暴露试玩按钮", () => {
    const kaetram = findLibraryGame("kaetram");
    expect(kaetram?.status).toBe("unavailable");
    expect(kaetram?.localPath).toBeUndefined();
    expect(kaetram?.onlineUrl).toBeUndefined();
  });

  it("游戏可在 Manifest 中声明自己的启动页，而不改变可校验的 HTML 入口", () => {
    const fruitParty = findLibraryGame("fruit-party");
    expect(fruitParty?.localPath).toBe("/games/fruit-party/index.html");
    expect(fruitParty?.startPath).toBe("/games/fruit-party/index.html?route=home");
    expect(fruitParty?.launchLabel).toBe("选择玩法");
  });

  it("只给明确声明的 iframe 游戏开放麦克风", () => {
    const derKoloss = findLibraryGame("der-koloss");
    const fruitParty = findLibraryGame("fruit-party");
    expect(derKoloss && iframeAllowPolicy(derKoloss)).toContain("microphone");
    expect(derKoloss && iframeAllowPolicy(derKoloss)).toContain("camera 'none'");
    expect(fruitParty && iframeAllowPolicy(fruitParty)).toContain("microphone 'none'");
    expect(fruitParty && iframeAllowPolicy(fruitParty)).toContain("camera 'none'");
  });
});

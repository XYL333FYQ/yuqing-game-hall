import { describe, expect, it } from "vitest";
import { LIBRARY_GAMES, findLibraryGame } from "../src/data/gameLibrary";
import { GAME_CATALOG } from "../src/platform/game-catalog";

describe("统一游戏库", () => {
  it("从 Manifest 派生所有游戏项目", () => {
    expect(LIBRARY_GAMES).toHaveLength(GAME_CATALOG.length);
    expect(new Set(LIBRARY_GAMES.map((game) => game.slug)).size).toBe(GAME_CATALOG.length);
    expect(new Set(LIBRARY_GAMES.map((game) => game.order)).size).toBe(GAME_CATALOG.length);
    expect(LIBRARY_GAMES.map((game) => game.slug)).toEqual(GAME_CATALOG.map((game) => game.id));
  });

  it("所有 iframe 静态游戏都访问 Manifest 声明的随站点发布入口", () => {
    const localGames = LIBRARY_GAMES.filter((game) => game.localPath);
    const iframeGames = GAME_CATALOG.filter((game) => game.launch.kind === "iframe");
    expect(localGames).toHaveLength(iframeGames.length);
    for (const game of localGames) {
      expect(game.status).toBe("static");
      expect(game.localPath).toMatch(/^\/games\/[A-Za-z0-9_/-]+(?:\.html)?$/);
      expect(game.localPath).toMatch(/\.html$/);
      expect(game.localPath).not.toContain("..");
    }
  });

  it("受限项目不会暴露试玩按钮", () => {
    const kaetram = findLibraryGame("kaetram");
    expect(kaetram?.status).toBe("restricted");
    expect(kaetram?.localPath).toBeUndefined();
    expect(kaetram?.onlineUrl).toBeUndefined();
  });
});

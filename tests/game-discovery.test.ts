import { describe, expect, it } from "vitest";
import { GAME_CATALOG } from "../src/platform/game-catalog";
import { featuredGames, playableGames, trendingGames } from "../src/platform/game-discovery";
import type { GameManifest } from "../src/platform/game-manifest";

describe("首页游戏发现规则", () => {
  it("精选自动覆盖所有可玩游戏，包括没有精选标记的新游戏", () => {
    const games = playableGames(GAME_CATALOG);
    const featured = featuredGames(GAME_CATALOG);
    expect(featured).toHaveLength(games.length);
    expect(new Set(featured.map((game) => game.id))).toEqual(new Set(games.map((game) => game.id)));
    expect(featured.some((game) => !game.featured)).toBe(true);
    expect(featured.every((game) => game.platform.launch.kind !== "none")).toBe(true);
  });

  it("重新进入时可改变推荐顺序，且不会改动原始目录", () => {
    const original = GAME_CATALOG.map((game) => game.id);
    const first = featuredGames(GAME_CATALOG, () => 0);
    const next = featuredGames(GAME_CATALOG, () => 0.999);
    expect(first.map((game) => game.id)).not.toEqual(next.map((game) => game.id));
    expect(GAME_CATALOG.map((game) => game.id)).toEqual(original);
  });

  it("热门区每次只给出四款不同游戏，换一批直接前进四款", () => {
    const games = playableGames(GAME_CATALOG);
    const first = trendingGames(games, {}, { limit: 4, cycle: 0 });
    const next = trendingGames(games, {}, { limit: 4, cycle: 1 });
    expect(first).toHaveLength(4);
    expect(new Set(first.map((game) => game.id)).size).toBe(4);
    expect(first.every((game) => game.platform.launch.kind !== "none")).toBe(true);
    expect(next.map((game) => game.id)).not.toEqual(first.map((game) => game.id));
    expect(next.every((game) => !first.includes(game))).toBe(true);
  });

  it("多次换一批能覆盖整个目录，不局限于前七款", () => {
    const games = featuredGames(GAME_CATALOG);
    const seen = new Set<string>();
    for (let cycle = 0; cycle < Math.ceil(games.length / 4); cycle += 1) {
      const batch = trendingGames(games, {}, { limit: 4, cycle });
      expect(new Set(batch.map((game) => game.id)).size).toBe(4);
      batch.forEach((game) => seen.add(game.id));
    }
    expect(seen).toEqual(new Set(games.map((game) => game.id)));
  });

  it("新增清单不需要精选或热度排名就能自动进入两个推荐区域", () => {
    const added: GameManifest = {
      ...playableGames(GAME_CATALOG)[0],
      id: "new-game",
      order: 1000,
      featured: false,
      discovery: { audiences: ["single"] },
    };
    const pool = featuredGames([...GAME_CATALOG, added], () => 0);
    expect(pool).toContain(added);
    const batches = Array.from({ length: Math.ceil(pool.length / 4) }, (_, cycle) => trendingGames(pool, {}, { cycle }));
    expect(batches.flat()).toContain(added);
  });

  it("空目录、小目录和末尾绕回都不会产生重复或无效卡片", () => {
    expect(featuredGames([])).toEqual([]);
    expect(trendingGames([])).toEqual([]);
    expect(trendingGames(GAME_CATALOG, {}, { limit: 0 })).toEqual([]);
    const games = playableGames(GAME_CATALOG).slice(0, 5);
    expect(trendingGames(games.slice(0, 2), {}, { cycle: 10 })).toEqual(games.slice(0, 2));
    expect(trendingGames(games, {}, { cycle: 1 })).toEqual([games[4], games[0], games[1], games[2]]);
  });

  it("本次会话内真实启动意图会提高对应游戏的热门得分", () => {
    const games = playableGames(GAME_CATALOG);
    const candidate = games.at(-1);
    expect(candidate).toBeDefined();
    const regular = trendingGames(games, {}, { limit: 4, cycle: 0 });
    const interested = trendingGames(games, { [candidate!.id]: { detail: 0, launch: 1 } }, { limit: 4, cycle: 0 });
    expect(interested.map((game) => game.id)).toContain(candidate!.id);
    expect(regular.every((game) => game.id !== candidate!.id)).toBe(true);
  });
});

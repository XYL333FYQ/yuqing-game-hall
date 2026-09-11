import { describe, expect, it } from "vitest";
import { GAME_CATALOG } from "../src/platform/game-catalog";
import { featuredGames, playableGames, trendingGames } from "../src/platform/game-discovery";

describe("首页游戏发现规则", () => {
  it("精选轮播完全从标记的游戏元数据派生，并按 featuredRank 排列", () => {
    const featured = featuredGames(GAME_CATALOG);
    expect(featured.length).toBeGreaterThan(1);
    expect(featured.every((game) => game.featured)).toBe(true);
    expect(featured.map((game) => game.discovery.featuredRank)).toEqual([...featured.map((game) => game.discovery.featuredRank)].sort((left, right) => (left ?? Infinity) - (right ?? Infinity)));
  });

  it("热门区每次只给出四款可玩的不同游戏，换一批会在高分候选中轮换", () => {
    const games = playableGames(GAME_CATALOG);
    const first = trendingGames(games, {}, { limit: 4, cycle: 0 });
    const next = trendingGames(games, {}, { limit: 4, cycle: 1 });
    expect(first).toHaveLength(4);
    expect(new Set(first.map((game) => game.id)).size).toBe(4);
    expect(first.every((game) => game.platform.launch.kind !== "none")).toBe(true);
    expect(next.map((game) => game.id)).not.toEqual(first.map((game) => game.id));
  });

  it("本次会话内真实启动意图会提高对应游戏的热门得分", () => {
    const games = playableGames(GAME_CATALOG);
    const candidate = games.at(-1);
    expect(candidate).toBeDefined();
    const regular = trendingGames(games, {}, { limit: 4, cycle: 0 });
    const interested = trendingGames(games, { [candidate!.id]: { detail: 0, launch: 30 } }, { limit: 4, cycle: 0 });
    expect(interested.map((game) => game.id)).toContain(candidate!.id);
    expect(regular.every((game) => game.id !== candidate!.id)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { GAME_CATALOG } from "../src/platform/game-catalog";
import { playableGames } from "../src/platform/game-discovery";
import { filterGames, sortGames } from "../src/platform/game-filters";

const playable = playableGames(GAME_CATALOG);
const ids = (games: ReturnType<typeof filterGames>) => games.map((game) => game.id).sort();

describe("首页游戏筛选 filterGames", () => {
  it("好友联机筛出全部 online=friend-room 的游戏", () => {
    const expected = playable.filter((game) => game.discovery.online === "friend-room").map((game) => game.id).sort();
    expect(expected).toHaveLength(8);
    expect(ids(filterGames(playable, { online: "friend-room" }))).toEqual(expected);
    expect(expected).toEqual(["der-koloss", "doudizhu", "fruit-party", "gamenest", "gobang", "guandan", "mahjong", "pvp-arena"]);
  });

  it("公开联机筛出全部 online=public 的可玩游戏", () => {
    expect(ids(filterGames(playable, { online: "public" }))).toEqual(["openfront", "scribble", "suroi", "tosios"]);
  });

  it("人数筛选读 discovery.audiences", () => {
    const expected = playable.filter((game) => game.discovery.audiences.includes("duo")).map((game) => game.id).sort();
    expect(ids(filterGames(playable, { audience: "duo" }))).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });

  it("分类筛选读 discovery.genres，竞速只剩极速光轨", () => {
    expect(ids(filterGames(playable, { genre: "racing" }))).toEqual(["hexgl"]);
  });

  it("人数、联机、分类与关键词可任意组合", () => {
    expect(ids(filterGames(playable, { online: "friend-room", genre: "board-card" }))).toEqual(["doudizhu", "gamenest", "gobang", "guandan", "mahjong"]);
    expect(ids(filterGames(playable, { audience: "multi", online: "friend-room", genre: "board-card" }))).toEqual(["doudizhu", "gamenest", "gobang", "guandan", "mahjong"]);
    expect(ids(filterGames(playable, { online: "friend-room", genre: "board-card", query: "五子棋" }))).toEqual(["gobang"]);
  });

  it("组合筛选可以为空结果", () => {
    expect(filterGames(playable, { online: "friend-room", genre: "puzzle" })).toEqual([]);
    expect(filterGames(playable, { audience: "single", online: "public", genre: "racing" })).toEqual([]);
    expect(filterGames(playable, { query: "不存在的游戏关键词" })).toEqual([]);
  });

  it("默认条件返回全部游戏", () => {
    expect(filterGames(playable, {})).toHaveLength(playable.length);
    expect(filterGames(playable, { audience: "all", online: "all", genre: "all", query: "" })).toHaveLength(playable.length);
  });

  it("关键词仍匹配标签与分类副标题文本", () => {
    expect(ids(filterGames(playable, { query: "棋牌" }))).toEqual(ids(playable.filter((game) => game.presentation.tags.includes("棋牌"))));
    expect(ids(filterGames(playable, { query: "竞速" }))).toContain("hexgl");
  });
});

describe("游戏库排序 sortGames", () => {
  it("默认按热度排序，没有热度排名的游戏排在后面并按目录顺序", () => {
    const sorted = [...playable].sort(sortGames("popular"));
    const ranks = sorted.map((game) => game.discovery.popularRank ?? Number.MAX_SAFE_INTEGER);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("名称排序按中文拼音顺序", () => {
    const titles = [...playable].sort(sortGames("name")).map((game) => game.presentation.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "zh-CN")));
  });

  it("多人优先把 audiences 含 multi 的游戏排在前面", () => {
    const sorted = [...playable].sort(sortGames("group"));
    const multiCount = playable.filter((game) => game.discovery.audiences.includes("multi")).length;
    expect(multiCount).toBeGreaterThan(0);
    expect(sorted.slice(0, multiCount).every((game) => game.discovery.audiences.includes("multi"))).toBe(true);
  });
});

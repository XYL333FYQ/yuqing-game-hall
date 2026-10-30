import { expect, it } from "vitest";
// The standalone game's browser module is plain JavaScript without declarations.
// @ts-expect-error standalone game module has no TypeScript declarations
import { buildInviteLink } from "../public/games/der-koloss/js/multiplayer-contracts.js";

it("邀请链接留在当前游戏页面并携带房间码", () => {
  const link = new URL(buildInviteLink("ab12c", "玩家甲", "https://games.example/games/der-koloss/?debug=1"));
  expect(link.origin + link.pathname).toBe("https://games.example/games/der-koloss/");
  expect(link.searchParams.get("join")).toBe("AB12C");
  expect(link.searchParams.get("from")).toBe("玩家甲");
  expect(link.searchParams.has("debug")).toBe(false);
});

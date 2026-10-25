import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

function browserAI(directory: string) {
  const context: Record<string, any> = {};
  context.window = context;
  runInNewContext(readFileSync(new URL("../public/games/_shared/card-room/js/parser.js", import.meta.url), "utf8"), context);
  for (const name of ["ai-suggest.js", "guandan-suggest.js", "mahjong-ai.js", "smart-ai.js"]) {
    runInNewContext(readFileSync(new URL(`../${directory}/${name}`, import.meta.url), "utf8"), context);
  }
  return context.SmartAI;
}

describe.each([
  ["Node require source", () => require("../server-games/card-room/rules/smart-ai.js").SmartAI],
  ["browser source", () => browserAI("server-games/card-room/rules")],
  ["browser published copy", () => browserAI("public/games/_shared/card-room/js")],
] as const)("shared card AI: %s", (_name, load) => {
  it("uses the runtime validator contract for singles, pairs and straights", () => {
    const ai = load();
    const card = (value: number, type = 0) => ({ value, type, deck: 0 });
    expect(ai.doudizhu.suggest([card(5)], { len: 1, key: 3, type: "A", ctxPos: "other" })).toHaveLength(1);
    expect(ai.doudizhu.suggest([card(5), card(5, 1)], { len: 2, key: 4, type: "AA", ctxPos: "other" })).toHaveLength(2);
    expect(ai.doudizhu.enumerate([3, 4, 5, 6, 7].map(value => card(value)))
      .some((candidate: any) => candidate.ret.type === "ABCDE")).toBe(true);
  });

  it("infers missing bomb flags and never beats a stronger bomb with a weaker one", () => {
    const ai = load();
    const hand = [0, 1, 2, 3].map(type => ({ value: 4, type, deck: 0 }));
    for (const last of [
      { len: 4, key: 10, type: "BOMB" },
      { len: 5, key: 7, type: "STRAIGHT_FLUSH" },
      { len: 4, key: 99, type: "JOKER_BOMB" },
    ]) {
      expect(ai.guandan.suggest(hand, { ...last, ctxPos: "other" }, { levelRank: 15 })).toHaveLength(0);
      expect(ai.guandan.suggest(hand, { ...last, bomb: true, ctxPos: "other" }, { levelRank: 15 })).toHaveLength(0);
    }
    expect(ai.guandan.suggest(hand, { len: 4, key: 3, type: "BOMB", ctxPos: "other" }, { levelRank: 15 })).toHaveLength(4);
  });
});

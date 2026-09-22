/// <reference types="node" />
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

/**
 * 按生产环境的加载顺序执行真实的两个文件：
 *   1. 像素竞技场专属中文表（普通脚本，先执行）
 *   2. 公共 yuqing-bridge.js（defer，后执行）
 * 只替换 DOM，让 bridge 停在“还没 boot”的状态，这样测的是翻译链本身。
 */
function loadTranslationChain() {
  const window: Record<string, any> = {
    location: { href: "https://games.example/games/pvp-arena/client/index.html", origin: "https://games.example" },
    parent: undefined,
    setTimeout,
    clearTimeout,
  };
  const document = {
    currentScript: { dataset: { game: "pvp-arena" } },
    readyState: "loading",
    addEventListener: () => {},
    querySelector: () => null,
    createElement: () => ({ style: {}, setAttribute: () => {}, append: () => {} }),
  };

  const context = createContext({
    window,
    document,
    Node: { TEXT_NODE: 3 },
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    MutationObserver: class { observe() {} },
    console: { warn: () => {}, error: () => {}, log: () => {} },
  });

  runInContext(source("../public/games/pvp-arena/client/js/i18n/zh-CN.js"), context, { filename: "i18n/zh-CN.js" });
  runInContext(source("../public/games/_shared/yuqing-bridge.js"), context, { filename: "yuqing-bridge.js" });

  // Canvas 与 DOM 走的是同一个函数：engine.js 的 CANVAS.print / printCenter
  // 在真正绘制之前调用它。
  const translate = window.yuqingTranslateText as (text: string) => string;
  return { window, translate };
}

describe("pixel arena localization chain", () => {
  const { window, translate } = loadTranslationChain();

  it("exposes the dedicated table and registers it as the bridge priority layer", () => {
    expect(typeof window.YuqingPvpI18n?.translate).toBe("function");
    expect(typeof window.yuqingTranslateOverride).toBe("function");
    // 专属表未命中时必须返回空串，让公共 bridge 继续兜底。
    expect(window.yuqingTranslateOverride("ZZZ definitely not translated")).toBe("");
  });

  it("prefers the dedicated table, then the shared bridge, then the original text", () => {
    // 1) 只在专属表里（公共 bridge 没有）：HUD / 结算
    expect(translate("GAME OVER")).toBe("游戏结束");
    expect(translate("YOU WON")).toBe("你赢了");
    // 2) 只在公共 bridge 里：队伍与颜色名
    expect(translate("RED")).toBe("红队");
    expect(translate("Light purple")).toBe("浅紫");
    // 3) 两边都没有：保持原文
    expect(translate("DefinitelyNotInAnyTable")).toBe("DefinitelyNotInAnyTable");
    // 前后空白必须保留，Canvas 的居中排版依赖它。
    expect(translate("  GAME OVER  ")).toBe("  游戏结束  ");
  });

  it("translates numbers and countdowns assembled at runtime", () => {
    expect(translate("125% damage")).toBe("125% 伤害");
    expect(translate("15% move/aim speed")).toBe("15% 移动 / 瞄准速度");
    expect(translate("12 frags")).toBe("12 次击杀");
    expect(translate("5 minutes")).toBe("5 分钟");
    expect(translate("Starting the game in 3sec...")).toBe("游戏将在 3 秒后开始…");
    expect(translate("Quitting game in 2sec...")).toBe("退出游戏倒计时 2 秒…");
    expect(translate("COMBO x4")).toBe("连击 ×4");
    expect(translate("Watch Soldier")).toBe("观战：Soldier");
  });

  it("covers the player-visible strings the hall cares about", () => {
    // 这些字符串来自 Canvas 绘制与联机大厅，绘制后再抓 DOM 是抓不到的，
    // 必须在 print 之前命中同一张表。
    const mustBeTranslated = [
      // 主菜单 / 结算 / HUD
      "GAME OVER", "NEW MISSION", "NEW HIGH SCORE", "YOU LOSE", "YOU ARE THE ONE",
      "YOU'RE OUT", "Well done!", "Get ready!", "Life lost!", "Point scored!",
      "Flag is back!", "Flag is lost!", "You got the flag!",
      // 任务与模式
      "Deathmatch", "Bloodlust", "Instagib", "Invasion", "King of the hill",
      "Capture the flag", "Last man standing", "Horde Versus", "Horde Co-op",
      "Earn 1 point for every frag, lose 1 point for suicide!",
      "Lose all lives and you're out! The last man standing wins!",
      // 设置
      "Screen controls", "Rendering mode", "Off-screen sync", "Configure controls...",
      "Controls configuration saved", "Reset to default", "Okay, thanks!",
      // 联机大厅与状态
      "NET Server", "NET Client", "NET Server ID", "Your ID", "Room", "Nickname",
      "Disconnected", "Preparing...", "Connecting...", "Wait for connection...",
      "Joining game...", "Waiting to join the game...", "Playing...",
      "Waiting for players...", "PRESS FIRE", "JOIN IN!",
      "Players connected to the same server will play together.",
      "URL Copied!", "Share this link to play together",
      "Input the Server ID to connect.",
      // 模式说明
      "Bring the flag at the hotspot to your home for 1 point!",
      "The map fills up with drones. Kill anything to earn points!",
      "Share lives, kill drones and go for the highest score!",
      "Clear missions. Fight as a team. Fail as a team.",
      // 操作说明
      "Move forward", "Move backward", "Strafe left", "Strafe right", "Turn left",
      "Menu confirm", "Menu cancel", "Aim button", "Touch screen", "Mouse",
    ];
    const untranslated = mustBeTranslated.filter((text) => translate(text) === text);
    expect(untranslated, `以下字符串没有中文翻译：${untranslated.join(" / ")}`).toEqual([]);
  });

  it("keeps map proper names and credit names in their original form", () => {
    // game.json 里明确记录了“地图专名保留原文”的项目约定。
    expect(translate("The Mansion")).toBe("The Mansion");
    expect(translate("Training Room")).toBe("Training Room");
    expect(translate("KesieV - kesiev.com")).toBe("KesieV - kesiev.com");
  });
});

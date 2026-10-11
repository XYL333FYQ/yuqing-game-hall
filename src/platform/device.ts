import type { GameDevice, GameInput } from "./game-manifest";

export interface PlayableGameTarget {
  devices?: readonly (GameDevice | string)[];
  inputs?: readonly (GameInput | string)[];
}

/**
 * 判断指定游戏是否允许在当前设备上直接游玩。
 * - 声明支持 mobile 或 touch 的游戏，在手机/触屏设备上直接放行畅玩；
 * - 仅支持 desktop 或必须键鼠操作的游戏，按屏幕尺寸和悬停指针进行桌面门禁检查。
 */
export function canPlayGame(game?: PlayableGameTarget | null): boolean {
  if (game?.devices?.includes("mobile") || game?.inputs?.includes("touch")) {
    return true;
  }
  return canPlayGames();
}

/** 传统全局桌面门槛，作为未声明触屏支持或桌面独占游戏的基准判断。 */
export function canPlayGames(): boolean {
  return window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches
    && window.innerWidth >= 960
    && window.innerHeight >= 600;
}

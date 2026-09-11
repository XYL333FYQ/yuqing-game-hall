/** 当前大厅真正支持并实际验收过的游戏设备门槛。 */
export function canPlayGames(): boolean {
  return window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches
    && window.innerWidth >= 960
    && window.innerHeight >= 600;
}

/** 当前大厅真正支持并实际验收过的游戏设备门槛。 */
export function canPlayGames(): boolean {
  return window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches
    && window.innerWidth >= 960
    && window.innerHeight >= 600;
}

export function desktopOnlyMessage(): string {
  return "这款游戏需要电脑、鼠标和至少 960×600 的浏览空间。你可以在手机上查看介绍，再把链接发送到电脑打开。";
}

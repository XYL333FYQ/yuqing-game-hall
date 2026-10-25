import type { GameManifest } from "./game-manifest";

/** 保留常用播放器能力，并显式关闭 Manifest 未声明的摄像头/麦克风。 */
export function iframeAllowPolicy(game: Pick<GameManifest, "permissions">): string {
  const permissions = game.permissions ?? [];
  const declared = new Set(permissions);
  const ordinary = permissions.filter((permission) => permission !== "camera" && permission !== "microphone");
  const defaults = [...new Set<string>(["autoplay", "fullscreen", "gamepad", ...ordinary])];
  return [
    ...defaults,
    declared.has("camera") ? "camera" : "camera 'none'",
    declared.has("microphone") ? "microphone" : "microphone 'none'",
  ].join("; ");
}

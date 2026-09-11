import { GAME_CATALOG } from "../platform/game-catalog";
import type { GameAvailability, GameManifest, GamePermission } from "../platform/game-manifest";

/**
 * 大厅列表所需的轻量视图模型。
 *
 * 游戏资料的唯一来源是各游戏目录里的 game.json；这里仅把 Manifest
 * 映射成旧页面使用的字段，避免大厅页面重复维护一份游戏注册表。
 */
export type LibraryGameStatus = GameAvailability;

export interface LibraryGame {
  slug: string;
  order: number;
  title: string;
  originalTitle?: string;
  mark: string;
  genre: string;
  summary: string;
  status: LibraryGameStatus;
  statusLabel: string;
  accent: string;
  dark: string;
  tags: readonly string[];
  mode: string;
  players: string;
  controls: string;
  highlights: readonly string[];
  icon?: string;
  cover?: string;
  hero?: string;
  screenshots: readonly string[];
  localPath?: string;
  startPath?: string;
  launchLabel?: string;
  onlineUrl?: string;
  permissions: readonly GamePermission[];
}

/** 所有游戏都由同一份 Manifest 目录进入通用详情与启动页。 */
export const LIBRARY_GAMES: readonly LibraryGame[] = GAME_CATALOG.map(toLibraryGame);

export function findLibraryGame(slug: string): LibraryGame | undefined {
  return LIBRARY_GAMES.find((game) => game.slug === slug);
}

function toLibraryGame(game: GameManifest): LibraryGame {
  const presentation = game.presentation;
  const launch = game.platform.launch;
  return {
    slug: game.id,
    order: game.order,
    title: presentation.title,
    originalTitle: presentation.originalTitle,
    mark: presentation.mark,
    genre: presentation.category,
    summary: presentation.description,
    status: presentation.availability.state,
    statusLabel: presentation.availability.label,
    accent: game.theme.accent,
    dark: game.theme.dark,
    tags: presentation.tags,
    mode: presentation.play.modes,
    players: presentation.play.players,
    controls: presentation.play.controls,
    highlights: presentation.highlights,
    icon: presentation.art.icon,
    cover: presentation.art.cover,
    hero: presentation.art.hero,
    screenshots: presentation.art.screenshots ?? [],
    localPath: launch.kind === "iframe" ? launch.entry : undefined,
    startPath: launch.kind === "iframe" ? launch.startUrl ?? launch.entry : undefined,
    launchLabel: presentation.actionLabel,
    onlineUrl: launch.kind === "external" ? launch.url : undefined,
    permissions: game.permissions ?? [],
  };
}

/** 保留常用播放器能力，并显式关闭 Manifest 未声明的摄像头/麦克风。 */
export function iframeAllowPolicy(game: Pick<LibraryGame, "permissions">): string {
  const declared = new Set(game.permissions);
  const ordinary = game.permissions.filter((permission) => permission !== "camera" && permission !== "microphone");
  const defaults = [...new Set<GamePermission>(["autoplay", "fullscreen", "gamepad", ...ordinary])];
  return [
    ...defaults,
    declared.has("camera") ? "camera" : "camera 'none'",
    declared.has("microphone") ? "microphone" : "microphone 'none'",
  ].join("; ");
}

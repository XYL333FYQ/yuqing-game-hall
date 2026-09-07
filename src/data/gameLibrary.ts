import { GAME_CATALOG } from "../platform/game-catalog";
import type { GameHosting, GameManifest } from "../platform/game-manifest";

/**
 * 大厅列表所需的轻量视图模型。
 *
 * 游戏资料的唯一来源是各游戏目录里的 game.json；这里仅把 Manifest
 * 映射成旧页面使用的字段，避免大厅页面重复维护一份游戏注册表。
 */
export type LibraryGameStatus = "static" | "server" | "restricted";

export interface LibraryGame {
  slug: string;
  order: number;
  title: string;
  originalTitle: string;
  mark: string;
  genre: string;
  summary: string;
  status: LibraryGameStatus;
  statusLabel: string;
  accent: string;
  dark: string;
  tags: readonly string[];
  mode: string;
  controls: string;
  runtime: string;
  license: string;
  localization: string;
  fit: string;
  highlights: readonly string[];
  cautions: readonly string[];
  cover?: string;
  screenshots: readonly string[];
  localPath?: string;
  onlineUrl?: string;
  sourceUrl: string;
}

/** 所有游戏都由同一份 Manifest 目录进入通用详情与启动页。 */
export const LIBRARY_GAMES: readonly LibraryGame[] = GAME_CATALOG.map(toLibraryGame);

export function findLibraryGame(slug: string): LibraryGame | undefined {
  return LIBRARY_GAMES.find((game) => game.slug === slug);
}

function toLibraryGame(game: GameManifest): LibraryGame {
  const launch = game.launch;
  return {
    slug: game.id,
    order: game.order,
    title: game.name,
    originalTitle: game.originalName,
    mark: game.mark,
    genre: game.category,
    summary: game.description,
    status: statusForHosting(game.hosting),
    statusLabel: game.hostingLabel,
    accent: game.theme.accent,
    dark: game.theme.dark,
    tags: game.tags,
    mode: game.play.modes,
    controls: game.play.controls,
    runtime: game.technology,
    license: game.license,
    localization: game.localization,
    fit: game.fit,
    highlights: game.highlights,
    cautions: game.cautions,
    cover: game.cover,
    screenshots: game.screenshots ?? [],
    localPath: launch.kind === "iframe" ? launch.entry : undefined,
    onlineUrl: launch.kind === "external" ? launch.url : launch.kind === "iframe" ? launch.upstreamUrl : undefined,
    sourceUrl: game.sourceUrl,
  };
}

function statusForHosting(hosting: GameHosting): LibraryGameStatus {
  if (hosting === "server") return "server";
  if (hosting === "restricted") return "restricted";
  return "static";
}

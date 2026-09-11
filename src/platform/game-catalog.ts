import { GAME_MANIFESTS } from "../generated/gameCatalog";
import type { GameManifest } from "./game-manifest";

export const GAME_CATALOG: readonly GameManifest[] = GAME_MANIFESTS;

export function findGame(id: string): GameManifest | undefined {
  return GAME_CATALOG.find((game) => game.id === id);
}

export function iframeEntry(game: GameManifest): string | undefined {
  return game.platform.launch.kind === "iframe" ? game.platform.launch.entry : undefined;
}

export function primaryGameUrl(game: GameManifest): string | undefined {
  if (game.platform.launch.kind === "iframe") return game.platform.launch.entry;
  if (game.platform.launch.kind === "external") return game.platform.launch.url;
  return undefined;
}

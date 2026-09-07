import { GAME_MANIFESTS } from "../generated/gameCatalog";
import type { GameManifest } from "./game-manifest";

export const GAME_CATALOG: readonly GameManifest[] = GAME_MANIFESTS;

export function findGame(id: string): GameManifest | undefined {
  return GAME_CATALOG.find((game) => game.id === id);
}

export function iframeEntry(game: GameManifest): string | undefined {
  return game.launch.kind === "iframe" ? game.launch.entry : undefined;
}

export function primaryGameUrl(game: GameManifest): string | undefined {
  if (game.launch.kind === "iframe") return game.launch.entry;
  if (game.launch.kind === "external") return game.launch.url;
  return undefined;
}

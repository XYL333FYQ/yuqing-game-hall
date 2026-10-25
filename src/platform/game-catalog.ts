import { GAME_MANIFESTS } from "../generated/gameCatalog";
import type { GameManifest } from "./game-manifest";

export const GAME_CATALOG: readonly GameManifest[] = GAME_MANIFESTS;

/** 按游戏 id（也是 /library/<id>、/play/<id> 路由里的 id）查找目录项。 */
export function findGame(id: string): GameManifest | undefined {
  return GAME_CATALOG.find((game) => game.id === id);
}

import type { GameAudience, GameGenreId, GameManifest, GameOnlineMode } from "./game-manifest";

export type GameAudienceFilter = GameAudience | "all";
export type GameOnlineFilter = GameOnlineMode | "all";
export type GameGenreFilter = GameGenreId | "all";

export interface GameFilterCriteria {
  audience?: GameAudienceFilter;
  online?: GameOnlineFilter;
  genre?: GameGenreFilter;
  query?: string;
}

/**
 * 首页游戏库筛选：人数、联机、分类与关键词全部为 AND 关系，可任意组合。
 * 人数读 discovery.audiences，联机读 discovery.online，分类读 discovery.genres；
 * 关键词仍匹配标题、分类副标题与标签等展示文本。
 */
export function filterGames(games: readonly GameManifest[], criteria: GameFilterCriteria): GameManifest[] {
  const audience = criteria.audience ?? "all";
  const online = criteria.online ?? "all";
  const genre = criteria.genre ?? "all";
  const query = (criteria.query ?? "").trim();
  return games.filter((game) =>
    (audience === "all" || game.discovery.audiences.includes(audience))
      && (online === "all" || game.discovery.online === online)
      && (genre === "all" || game.discovery.genres.includes(genre))
      && matchesSearch(game, query),
  );
}

function matchesSearch(game: GameManifest, query: string): boolean {
  if (!query) return true;
  const presentation = game.presentation;
  return [presentation.title, presentation.originalTitle ?? "", presentation.category, presentation.tagline, presentation.description, presentation.mark, ...presentation.tags].join(" ").toLocaleLowerCase("zh-CN").includes(query.toLocaleLowerCase("zh-CN"));
}

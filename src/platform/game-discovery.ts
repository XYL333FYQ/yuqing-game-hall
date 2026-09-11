import type { GameManifest } from "./game-manifest";

export type EngagementKind = "detail" | "launch";
export type GameEngagement = Record<string, { detail: number; launch: number }>;

const ENGAGEMENT_STORAGE_KEY = "yuqing-game-hall:discovery-v1";

export function playableGames(games: readonly GameManifest[]): GameManifest[] {
  return games.filter((game) => game.platform.launch.kind !== "none");
}

export function featuredGames(games: readonly GameManifest[]): GameManifest[] {
  const playable = playableGames(games);
  const selected = playable.filter((game) => game.featured);
  return (selected.length > 0 ? selected : playable.slice(0, 1)).sort((left, right) =>
    featuredRank(left) - featuredRank(right) || popularityRank(left) - popularityRank(right) || left.order - right.order,
  );
}

/**
 * 热门位由目录中的初始热度、可玩的形式和本次会话内的实际兴趣组成。
 * cycle 让同一批高分候选在“换一批”时轮换，避免首页永远是同四张卡。
 */
export function trendingGames(
  games: readonly GameManifest[],
  engagement: GameEngagement = {},
  options: { limit?: number; cycle?: number } = {},
): GameManifest[] {
  const limit = options.limit ?? 4;
  const ranked = playableGames(games).sort((left, right) => trendScore(right, engagement) - trendScore(left, engagement) || popularityRank(left) - popularityRank(right) || left.order - right.order);
  if (ranked.length <= limit) return ranked;

  const pool = ranked.slice(0, Math.min(ranked.length, limit + 3));
  const start = ((options.cycle ?? 0) % pool.length + pool.length) % pool.length;
  return Array.from({ length: limit }, (_, index) => pool[(start + index) % pool.length]);
}

export function readSessionEngagement(): GameEngagement {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(ENGAGEMENT_STORAGE_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).flatMap(([id, counts]) => {
        if (!counts || typeof counts !== "object" || Array.isArray(counts)) return [];
        const detail = Number((counts as Record<string, unknown>).detail);
        const launch = Number((counts as Record<string, unknown>).launch);
        return [[id, { detail: Number.isFinite(detail) ? Math.max(0, detail) : 0, launch: Number.isFinite(launch) ? Math.max(0, launch) : 0 }]];
      }),
    );
  } catch {
    return {};
  }
}

export function recordSessionEngagement(gameId: string, kind: EngagementKind): GameEngagement {
  const engagement = readSessionEngagement();
  const previous = engagement[gameId] ?? { detail: 0, launch: 0 };
  engagement[gameId] = { ...previous, [kind]: previous[kind] + 1 };
  try {
    sessionStorage.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify(engagement));
  } catch {
    // 隐私模式或禁用存储时，页面仍按目录热度正常工作。
  }
  return engagement;
}

function trendScore(game: GameManifest, engagement: GameEngagement): number {
  const clicks = engagement[game.id] ?? { detail: 0, launch: 0 };
  const base = 120 - Math.min(popularityRank(game), 20) * 7;
  const format = game.platform.launch.kind === "iframe" ? 10 : 5;
  const audience = game.discovery.audiences.length * 3;
  const featured = game.featured ? 8 : 0;
  return base + format + audience + featured + clicks.detail * 2 + clicks.launch * 12;
}

function popularityRank(game: GameManifest): number {
  return game.discovery.popularRank ?? Number.MAX_SAFE_INTEGER;
}

function featuredRank(game: GameManifest): number {
  return game.discovery.featuredRank ?? Number.MAX_SAFE_INTEGER;
}

import type { GameManifest } from "./game-manifest";

export type EngagementKind = "detail" | "launch";
export type GameEngagement = Record<string, { detail: number; launch: number }>;

const ENGAGEMENT_STORAGE_KEY = "yuqing-game-hall:discovery-v1";

export function playableGames(games: readonly GameManifest[]): GameManifest[] {
  return games.filter((game) => game.platform.launch.kind !== "none");
}

/** 全部可玩的游戏自动参与推荐；首页每次进入时打乱一次，轮换期间保持顺序稳定。 */
export function featuredGames(games: readonly GameManifest[], random: () => number = Math.random): GameManifest[] {
  const pool = playableGames(games);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [pool[index], pool[target]] = [pool[target], pool[index]];
  }
  return pool;
}

/**
 * 首页传入打乱后的完整推荐池，本次会话内的实际兴趣优先。
 * 每轮前进一批，覆盖整个目录，不用手工排名限制新游戏的曝光。
 */
export function trendingGames(
  games: readonly GameManifest[],
  engagement: GameEngagement = {},
  options: { limit?: number; cycle?: number } = {},
): GameManifest[] {
  const limit = Math.max(0, Math.floor(options.limit ?? 4));
  if (limit === 0) return [];
  const ranked = playableGames(games).sort((left, right) => trendScore(right, engagement) - trendScore(left, engagement));
  if (ranked.length <= limit) return ranked;

  const offset = (options.cycle ?? 0) * limit;
  const start = (offset % ranked.length + ranked.length) % ranked.length;
  return Array.from({ length: limit }, (_, index) => ranked[(start + index) % ranked.length]);
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
    // 隐私模式或禁用存储时，页面仍可正常轮换推荐。
  }
  return engagement;
}

function trendScore(game: GameManifest, engagement: GameEngagement): number {
  const clicks = engagement[game.id] ?? { detail: 0, launch: 0 };
  return clicks.detail * 2 + clicks.launch * 12;
}

export interface FruitPartyServerConfig {
  host: string;
  port: number;
  production: boolean;
  allowedOrigins: ReadonlySet<string>;
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): FruitPartyServerConfig {
  const production = env.NODE_ENV === "production";
  const port = Number(env.PORT ?? "8790");
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("PORT 必须是 0–65535 之间的整数。");
  }

  const allowedOrigins = new Set(
    (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map(normalizeOrigin)
      .filter((origin): origin is string => Boolean(origin)),
  );
  if (production && allowedOrigins.size === 0) {
    throw new Error("生产环境必须通过 ALLOWED_ORIGINS 指定允许访问的游戏平台来源。");
  }

  return {
    host: env.HOST?.trim() || "127.0.0.1",
    port,
    production,
    allowedOrigins,
  };
}

export function resolveAllowedOrigin(
  origin: string | undefined,
  config: Pick<FruitPartyServerConfig, "production" | "allowedOrigins">,
): string | undefined | null {
  if (!origin) return undefined;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return null;
  if (config.allowedOrigins.has("*") || config.allowedOrigins.has(normalized)) return normalized;
  if (!config.production && isLoopbackOrigin(normalized)) return normalized;
  return null;
}

function normalizeOrigin(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === "*") return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

export interface FruitPartyRuntimeConfig {
  /**
   * 多人服务的 HTTP(S) 根地址。留空时请求当前网站的 /api；独立部署时可填
   * https://rooms.example.com 或带路径前缀的 https://example.com/fruit-service/。
   */
  multiplayerServiceUrl?: string;
}

declare global {
  interface Window {
    FRUIT_PARTY_CONFIG?: FruitPartyRuntimeConfig;
  }
}

export function resolveMultiplayerServiceUrl(configuredValue: string | undefined, pageUrl: string): URL {
  const configured = configuredValue?.trim();
  const base = configured ? new URL(configured, pageUrl) : new URL(new URL(pageUrl).origin);
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error("果切多人服务地址必须使用 http:// 或 https://。");
  }
  base.search = "";
  base.hash = "";
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return base;
}

export function multiplayerHttpUrl(path: string): string {
  return endpoint(path).href;
}

export function multiplayerWebSocketUrl(path: string): string {
  const url = endpoint(path);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}

export function multiplayerServiceLabel(): string {
  return serviceBase().href.replace(/\/$/, "");
}

function endpoint(path: string): URL {
  return new URL(path.replace(/^\/+/, ""), serviceBase());
}

function serviceBase(): URL {
  return resolveMultiplayerServiceUrl(window.FRUIT_PARTY_CONFIG?.multiplayerServiceUrl, window.location.href);
}

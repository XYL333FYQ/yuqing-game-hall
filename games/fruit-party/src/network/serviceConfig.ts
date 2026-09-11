export interface FruitPartyRuntimeConfig {
  /**
   * 多人服务的 HTTP(S) 根地址。线上必须明确填写；仅本地开发留空时自动连接
   * http://127.0.0.1:8790。可填写 https://rooms.example.com 或带路径前缀的
   * https://example.com/fruit-service/。
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
  const page = new URL(pageUrl);
  const isLocalDevelopment = page.hostname === "localhost" || page.hostname === "127.0.0.1" || page.hostname === "[::1]";
  if (!configured && !isLocalDevelopment) {
    throw new Error("果切多人服务尚未配置，请在 fruit-party.config.js 中填写 VPS 的 HTTPS 地址。");
  }
  const base = configured ? new URL(configured, page) : new URL("http://127.0.0.1:8790/");
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

// Cloudflare Pages 运行时从 /api/runtime-config 读取公开服务地址。
// 本地接口不存在或请求失败时保留空值，由游戏继续使用 localhost fallback。
(() => {
  const config = window.FRUIT_PARTY_CONFIG = window.FRUIT_PARTY_CONFIG || { multiplayerServiceUrl: "" };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);
  window.FRUIT_PARTY_CONFIG_READY = fetch("/api/runtime-config", {
    cache: "no-store",
    credentials: "same-origin",
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((runtime) => {
      const serviceUrl = typeof runtime.fruitPartyServiceUrl === "string"
        ? runtime.fruitPartyServiceUrl.trim()
        : "";
      if (serviceUrl) config.multiplayerServiceUrl = serviceUrl;
      return config;
    })
    .catch((error) => {
      console.warn("[Fruit Party] 运行时服务配置不可用，将使用本地 fallback 或显示未配置提示。", error);
      return config;
    })
    .finally(() => window.clearTimeout(timeout));
})();

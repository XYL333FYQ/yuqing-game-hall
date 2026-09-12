// Cloudflare Pages 运行时从 /api/runtime-config 读取公开 WSS 中继地址。
// 本地接口不存在或请求失败时保留当前输入地址，不阻止单机游戏启动。
(() => {
  const config = window.SANCTUARY_CONFIG = window.SANCTUARY_CONFIG || { relayUrl: "" };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);
  window.SANCTUARY_CONFIG_READY = fetch("/api/runtime-config", {
    cache: "no-store",
    credentials: "same-origin",
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((runtime) => {
      const relayUrl = typeof runtime.sanctuaryRelayUrl === "string"
        ? runtime.sanctuaryRelayUrl.trim()
        : "";
      if (relayUrl) config.relayUrl = relayUrl;
      return config;
    })
    .catch((error) => {
      console.warn("[Sanctuary] 运行时中继配置不可用，将保留本地输入地址。", error);
      return config;
    })
    .finally(() => window.clearTimeout(timeout));
})();

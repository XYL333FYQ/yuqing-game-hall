/**
 * 雨晴游戏厅共享 WebRTC 运行时配置（普通脚本，挂到 window）。
 *
 * 职责只有一件事：把 Cloudflare Pages 运行时公开配置里的 `WEBRTC_SERVICE_URL`
 * 变成游戏可以直接交给 PeerJS 的选项，以及交给 RTCPeerConnection 的 ICE 配置。
 *
 * 链路：
 *   /api/runtime-config            （Cloudflare Pages Function，读 WEBRTC_SERVICE_URL）
 *     -> webrtcServiceUrl
 *     -> GET <webrtcServiceUrl>/rtc-config   （VPS webrtc-gateway）
 *     -> iceServers（自建 STUN + 短期 TURN 凭据） + peer.path
 *
 * 关键约束：
 * - 这里不硬编码任何 VPS IP / 域名，也不内置公共 PeerJS / STUN / TURN 作为兜底。
 *   配置缺失时状态是 `unconfigured`，由游戏显式告诉玩家“联机服务未配置”，
 *   否则无法判断自建服务是否真的在工作。
 * - TURN 用户名与密码来自 gateway 每次签发的短期凭据，前端不保存长期密钥。
 */
(() => {
  "use strict";

  if (window.YuqingWebRTC) return;

  const RUNTIME_CONFIG_PATH = "/api/runtime-config";
  const DEFAULT_PEER_PATH = "/";
  const DEFAULT_PEER_KEY = "peerjs";
  const REQUEST_TIMEOUT_MS = 8000;

  const MESSAGES = {
    loading: "正在获取联机服务配置…",
    unconfigured: "联机服务未配置：Cloudflare 尚未设置 WEBRTC_SERVICE_URL。",
    failed: "无法连接雨晴联机服务（PeerJS 信令 / STUN / TURN）。",
    ready: "联机服务就绪。",
  };

  /** @type {Set<(state: object) => void>} */
  const listeners = new Set();

  let resolved = false;
  let state = snapshot("loading", {});

  function snapshot(status, patch) {
    return Object.freeze({
      status,
      serviceUrl: patch.serviceUrl ?? "",
      peer: patch.peer ?? null,
      iceServers: patch.iceServers ?? [],
      message: MESSAGES[status] ?? "",
      error: patch.error ?? "",
    });
  }

  function publish(next) {
    state = next;
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        console.warn("[YuqingWebRTC] 配置订阅回调抛出异常。", error);
      }
    }
  }

  function isDebugRelayForced() {
    const diag = window.YuqingNetDiag;
    return !!(diag && diag.enabled && diag.forceRelay);
  }

  // 本地联调允许显式指定服务地址，仍然不写死任何默认服务：
  //   window.YUQING_WEBRTC_SERVICE_URL = "https://rtc.example.com"
  //   或 URL 加 ?webrtc=https://rtc.example.com
  function explicitServiceUrl() {
    const injected = typeof window.YUQING_WEBRTC_SERVICE_URL === "string"
      ? window.YUQING_WEBRTC_SERVICE_URL.trim()
      : "";
    if (injected) return injected;
    try {
      const fromQuery = new URL(window.location.href).searchParams.get("webrtc");
      return fromQuery ? fromQuery.trim() : "";
    } catch {
      return "";
    }
  }

  async function fetchJson(url, credentials) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizeServiceUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported protocol");
    if (url.username || url.password) throw new Error("credentials are not allowed");
    // gateway 必须独占一个主机（或反向代理的根路径）：PeerJS 的信令路径由
    // gateway 自己决定，前端不做前缀拼接，避免和 Nginx 的 rewrite 假设打架。
    if (url.pathname.replace(/\/+$/, "")) throw new Error("WEBRTC_SERVICE_URL must be an origin without a path");
    return url.origin;
  }

  /**
   * 把 gateway 的公开地址拆成 PeerJS 需要的 host/port/path/secure。
   * path 直接来自 gateway 的 `/rtc-config`（约定为 "/"），
   * 客户端会拼成 `<path>peerjs/id`（HTTP）与 `<path>peerjs`（WebSocket）。
   */
  function peerEndpoint(serviceUrl, peerPath, peerKey) {
    const url = new URL(serviceUrl);
    const secure = url.protocol === "https:";
    const path = typeof peerPath === "string" && peerPath ? peerPath : DEFAULT_PEER_PATH;
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : secure ? 443 : 80,
      path,
      key: typeof peerKey === "string" && peerKey ? peerKey : DEFAULT_PEER_KEY,
      secure,
    };
  }

  function normalizeIceServers(value) {
    if (!Array.isArray(value)) return [];
    const servers = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const urls = entry.urls ?? entry.url;
      const list = Array.isArray(urls) ? urls : [urls];
      const clean = list.filter((item) => typeof item === "string" && /^(stun|turn)s?:/i.test(item));
      if (!clean.length) continue;
      const server = { urls: clean.length === 1 ? clean[0] : clean };
      if (typeof entry.username === "string" && entry.username) server.username = entry.username;
      if (typeof entry.credential === "string" && entry.credential) server.credential = entry.credential;
      servers.push(server);
    }
    return servers;
  }

  function buildState(serviceUrl, rtc) {
    const peerPath = rtc?.peer?.path;
    const peerKey = rtc?.peer?.key;
    const iceServers = normalizeIceServers(rtc?.iceServers);
    if (!iceServers.length) throw new Error("no ice servers");
    return snapshot("ready", {
      serviceUrl,
      peer: peerEndpoint(serviceUrl, peerPath, peerKey),
      iceServers,
    });
  }

  const ready = (async () => {
    try {
      const injected = explicitServiceUrl();
      if (injected) {
        const serviceUrl = normalizeServiceUrl(injected);
        const rtc = await fetchJson(`${serviceUrl}/rtc-config`, "omit");
        publish(buildState(serviceUrl, rtc));
        return state;
      }

      const runtime = await fetchJson(RUNTIME_CONFIG_PATH, "same-origin");
      const configured = normalizeServiceUrl(runtime?.webrtcServiceUrl);
      if (!configured) {
        publish(snapshot("unconfigured", {}));
        return state;
      }
      const rtc = await fetchJson(`${configured}/rtc-config`, "omit");
      publish(buildState(configured, rtc));
      return state;
    } catch (error) {
      console.warn("[YuqingWebRTC] 联机服务配置不可用。", error);
      publish(snapshot("failed", { error: String(error && error.message ? error.message : error) }));
      return state;
    } finally {
      resolved = true;
    }
  })();

  window.YuqingWebRTC = {
    ready,

    get state() {
      return state;
    },

    /** 配置是否已经就绪；游戏在建立 Peer 之前必须先确认。 */
    isReady() {
      return state.status === "ready";
    },

    isSettled() {
      return resolved;
    },

    serviceUrl() {
      return state.serviceUrl;
    },

    iceServers() {
      return state.iceServers;
    },

    /** 面向玩家的一句话说明；未就绪时用于替代“正在连接…”。 */
    message() {
      return state.message;
    },

    /**
     * PeerJS 构造函数选项。未就绪时返回 null —— 调用方必须显式失败，
     * 不要退回公共 PeerJS 服务，否则无法验证自建信令是否真的可用。
     */
    peerOptions(overrides) {
      if (state.status !== "ready" || !state.peer) return null;
      const config = { iceServers: state.iceServers };
      // 仅调试模式（?debug=network）可以强制走 TURN，用来确认 VPS 中继真的工作。
      if (isDebugRelayForced()) config.iceTransportPolicy = "relay";
      return {
        host: state.peer.host,
        port: state.peer.port,
        path: state.peer.path,
        key: state.peer.key,
        secure: state.peer.secure,
        config,
        ...(overrides || {}),
      };
    },

    /** 调试模式下的“强制使用 VPS 中继”当前是否生效。 */
    isRelayForced() {
      return isDebugRelayForced();
    },

    onChange(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      if (resolved) listener(state);
      return () => listeners.delete(listener);
    },
  };
})();

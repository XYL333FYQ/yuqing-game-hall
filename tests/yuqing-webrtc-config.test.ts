/// <reference types="node" />
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const webrtcSource = readFileSync(new URL("../public/games/_shared/yuqing-webrtc.js", import.meta.url), "utf8");
const netdiagSource = readFileSync(new URL("../public/games/_shared/yuqing-netdiag.js", import.meta.url), "utf8");

type Gateway = { iceServers?: unknown; peer?: unknown };

/**
 * 在隔离上下文里执行真实的 `public/games/_shared/yuqing-webrtc.js`。
 * 这样测试的是真正会被浏览器加载的那份文件，而不是它的复制品。
 */
function loadWebRtcModule(options: {
  runtimeConfig?: unknown;
  runtimeFails?: boolean;
  rtcConfig?: Gateway;
  rtcFails?: boolean;
  query?: string;
  injectedServiceUrl?: string;
  netDiag?: unknown;
} = {}) {
  const calls: string[] = [];
  const window: Record<string, unknown> = {
    location: { href: `https://games.example/index.html${options.query ?? ""}` },
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof clearTimeout>) => clearTimeout(...args),
  };
  if (options.injectedServiceUrl) window.YUQING_WEBRTC_SERVICE_URL = options.injectedServiceUrl;
  if (options.netDiag) window.YuqingNetDiag = options.netDiag;

  const fetchStub = vi.fn(async (url: string) => {
    calls.push(String(url));
    if (String(url).endsWith("/api/runtime-config")) {
      if (options.runtimeFails) throw new TypeError("Failed to fetch");
      return jsonResponse(options.runtimeConfig ?? {});
    }
    if (String(url).endsWith("/rtc-config")) {
      if (options.rtcFails) throw new TypeError("Failed to fetch");
      return jsonResponse(options.rtcConfig ?? {});
    }
    return jsonResponse({}, 404);
  });

  runInNewContext(webrtcSource, {
    window,
    fetch: fetchStub,
    URL,
    URLSearchParams,
    AbortController,
    console: { warn: () => {} },
  });

  return { api: window.YuqingWebRTC as Record<string, any>, calls, fetchStub };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const rtcConfig: Gateway = {
  peer: { path: "/", key: "peerjs" },
  iceServers: [
    { urls: ["stun:turn.example.com:3478"] },
    {
      urls: ["turn:turn.example.com:3478?transport=udp", "turn:turn.example.com:3478?transport=tcp"],
      username: "1750000000:abcdef0123456789",
      credential: "signed-credential",
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("shared WebRTC runtime configuration", () => {
  it("reports an explicit unconfigured state instead of falling back to a public broker", async () => {
    const { api } = loadWebRtcModule({ runtimeConfig: { fruitPartyServiceUrl: "", sanctuaryRelayUrl: "", webrtcServiceUrl: "" } });
    await api.ready;

    expect(api.state.status).toBe("unconfigured");
    expect(api.isReady()).toBe(false);
    expect(api.peerOptions()).toBeNull();
    expect(api.message()).toContain("WEBRTC_SERVICE_URL");
  });

  it("turns the Cloudflare runtime URL into PeerJS options and short-lived ICE servers", async () => {
    const { api, calls } = loadWebRtcModule({
      runtimeConfig: { webrtcServiceUrl: "https://rtc.example.com" },
      rtcConfig,
    });
    await api.ready;

    expect(api.state.status).toBe("ready");
    // 同源相对路径：浏览器会解析到游戏厅自己的 /api/runtime-config。
    expect(calls).toEqual(["/api/runtime-config", "https://rtc.example.com/rtc-config"]);

    const options = api.peerOptions({ debug: 0 });
    expect(options).toMatchObject({
      host: "rtc.example.com",
      port: 443,
      // PeerJS 客户端会拼成 `<path>peerjs/id` 与 `<path>peerjs`，
      // 因此 gateway 挂在站点根路径时这里必须是 "/"。
      path: "/",
      key: "peerjs",
      secure: true,
      debug: 0,
    });
    expect(options.config.iceServers).toEqual([
      { urls: "stun:turn.example.com:3478" },
      {
        urls: ["turn:turn.example.com:3478?transport=udp", "turn:turn.example.com:3478?transport=tcp"],
        username: "1750000000:abcdef0123456789",
        credential: "signed-credential",
      },
    ]);
    // 默认不限制 ICE 传输策略，优先让浏览器尝试 P2P 直连。
    expect(options.config.iceTransportPolicy).toBeUndefined();
  });

  it("rejects a service URL that carries a path, instead of guessing a reverse-proxy rewrite", async () => {
    const { api } = loadWebRtcModule({
      runtimeConfig: { webrtcServiceUrl: "https://rtc.example.com/yuqing-rtc/" },
      rtcConfig,
    });
    await api.ready;

    expect(api.state.status).toBe("failed");
    expect(api.peerOptions()).toBeNull();
  });

  it("fails closed when the runtime configuration or the gateway is unreachable", async () => {
    const broken = loadWebRtcModule({ runtimeFails: true });
    await broken.api.ready;
    expect(broken.api.state.status).toBe("failed");
    expect(broken.api.peerOptions()).toBeNull();

    const gatewayDown = loadWebRtcModule({
      runtimeConfig: { webrtcServiceUrl: "https://rtc.example.com" },
      rtcFails: true,
    });
    await gatewayDown.api.ready;
    expect(gatewayDown.api.state.status).toBe("failed");
    expect(gatewayDown.api.peerOptions()).toBeNull();
  });

  it("rejects a gateway response without usable ICE servers", async () => {
    const { api } = loadWebRtcModule({
      runtimeConfig: { webrtcServiceUrl: "https://rtc.example.com" },
      rtcConfig: { peer: { path: "/" }, iceServers: [] },
    });
    await api.ready;
    expect(api.state.status).toBe("failed");
  });

  it("only forces TURN relaying while the debug diagnostics panel asks for it", async () => {
    const relayForced = loadWebRtcModule({
      runtimeConfig: { webrtcServiceUrl: "https://rtc.example.com" },
      rtcConfig,
      netDiag: { enabled: true, forceRelay: true },
    });
    await relayForced.api.ready;
    expect(relayForced.api.peerOptions().config.iceTransportPolicy).toBe("relay");
    expect(relayForced.api.isRelayForced()).toBe(true);

    const panelOpenButNotForced = loadWebRtcModule({
      runtimeConfig: { webrtcServiceUrl: "https://rtc.example.com" },
      rtcConfig,
      netDiag: { enabled: true, forceRelay: false },
    });
    await panelOpenButNotForced.api.ready;
    expect(panelOpenButNotForced.api.peerOptions().config.iceTransportPolicy).toBeUndefined();

    // 普通玩家不带 ?debug=network：诊断对象即使存在也不能影响 ICE 策略。
    const notDebugging = loadWebRtcModule({
      runtimeConfig: { webrtcServiceUrl: "https://rtc.example.com" },
      rtcConfig,
      netDiag: { enabled: false, forceRelay: true },
    });
    await notDebugging.api.ready;
    expect(notDebugging.api.peerOptions().config.iceTransportPolicy).toBeUndefined();
  });

  it("allows an explicit local service URL without hardcoding any default endpoint", async () => {
    const { api, calls } = loadWebRtcModule({
      query: "?webrtc=https%3A%2F%2Fdev-rtc.example.com",
      rtcConfig,
    });
    await api.ready;
    expect(api.state.status).toBe("ready");
    expect(calls).toEqual(["https://dev-rtc.example.com/rtc-config"]);
    expect(api.peerOptions()).toMatchObject({ host: "dev-rtc.example.com", port: 443 });
  });
});

describe("WebRTC runtime sources", () => {
  const forbidden = [
    ["0.peerjs.com", "公共 PeerJS 服务"],
    ["stun.l.google.com", "公共 Google STUN"],
    ["stun:stun", "任何公共 STUN 前缀"],
  ] as const;

  it("never ships a public PeerJS / STUN fallback in the shared runtime or the two WebRTC games", () => {
    const sources: Array<[string, string]> = [
      ["public/games/_shared/yuqing-webrtc.js", webrtcSource],
      ["public/games/der-koloss/js/net.js", readSource("../public/games/der-koloss/js/net.js")],
      ["public/games/pvp-arena/client/js/netplay-config.js", readSource("../public/games/pvp-arena/client/js/netplay-config.js")],
      ["public/games/pvp-arena/client/js/netplay-peerjs.js", readSource("../public/games/pvp-arena/client/js/netplay-peerjs.js")],
    ];
    for (const [file, source] of sources) {
      for (const [needle, label] of forbidden) {
        expect(source.includes(needle), `${file} 仍然包含${label}（${needle}）`).toBe(false);
      }
    }
  });

  it("loads the diagnostics module in every WebRTC game entry point", () => {
    expect(readSource("../public/games/der-koloss/index.html")).toContain("_shared/yuqing-netdiag.js");
    expect(readSource("../public/games/pvp-arena/client/index.html")).toContain("_shared/yuqing-netdiag.js");
  });
});

describe("network diagnostics module", () => {
  it("stays completely inert without ?debug=network", () => {
    const window: Record<string, unknown> = { location: { href: "https://games.example/index.html" } };
    expect(() => runInNewContext(netdiagSource, {
      window,
      URLSearchParams,
      setTimeout,
      clearTimeout,
      console: { warn: () => {} },
    })).not.toThrow();

    const api = window.YuqingNetDiag as Record<string, any>;
    expect(api.enabled).toBe(false);
    expect(api.forceRelay).toBe(false);
    // 没有 document 也不报错：默认路径完全不碰 DOM。
    expect(() => api.report("signaling", "ok")).not.toThrow();
    expect(() => api.route("relay")).not.toThrow();
  });
});

function readSource(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

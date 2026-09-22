/**
 * 雨晴游戏厅轻量网络诊断（普通脚本，挂到 window）。
 *
 * 默认关闭，只有 URL 带 `?debug=network` 时才启用面板与采样：
 *   /games/der-koloss/index.html?debug=network
 *
 * 设计边界（重要）：
 * - 本模块**只读**：它观察 RTCPeerConnection、读取 getStats()、显示状态，
 *   不会修改 ICE 配置、不会改信令地址、不会改变任何连接决策。
 * - 唯一例外是调试面板里的“强制使用 VPS 中继”。它不是游戏逻辑，
 *   而是把 iceTransportPolicy=relay 交给 YuqingWebRTC.peerOptions()，
 *   用来确认 TURN 是否真的能中继；切换后需要重新连接才生效。
 * - 普通玩家（不带 ?debug=network）看不到面板，也不会有任何额外开销：
 *   RTCPeerConnection 包装器只在启用时才安装。
 */
(() => {
  "use strict";

  if (window.YuqingNetDiag) return;

  const params = new URLSearchParams(window.location.search);
  const enabled = params.get("debug") === "network";

  const STATUS_LABEL = {
    ok: "正常",
    fail: "失败",
    pending: "进行中",
    unknown: "—",
  };
  const STATUS_COLOR = {
    ok: "#6ee7a8",
    fail: "#ff7b8a",
    pending: "#ffd166",
    unknown: "#9aa3ad",
  };

  const WEBRTC_ROWS = [
    { key: "signaling", label: "联机服务器" },
    { key: "match", label: "找到对方" },
    { key: "p2p", label: "P2P 直连" },
    { key: "turn", label: "VPS TURN 中继" },
    { key: "connected", label: "最终连接" },
    { key: "route", label: "当前线路" },
    { key: "latency", label: "延迟" },
  ];

  let rows = WEBRTC_ROWS.slice();
  const values = new Map();
  let note = "";
  let details = "";
  let panel = null;
  let rowsHost = null;
  let noteHost = null;
  let detailHost = null;
  let forceRelay = params.get("relay") === "1";

  function createPanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.id = "yuqing-netdiag";
    panel.setAttribute("role", "complementary");
    panel.setAttribute("aria-label", "网络诊断");
    Object.assign(panel.style, {
      position: "fixed",
      zIndex: "2147483000",
      left: "10px",
      bottom: "10px",
      minWidth: "210px",
      maxWidth: "300px",
      padding: "8px 10px 9px",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: "10px",
      background: "rgba(12,14,16,.88)",
      color: "#e9edf1",
      font: "12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, 'Microsoft YaHei UI', monospace",
      boxShadow: "0 10px 30px rgba(0,0,0,.45)",
      backdropFilter: "blur(8px)",
      userSelect: "text",
    });

    const head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px";
    const title = document.createElement("strong");
    title.textContent = "网络诊断";
    title.style.cssText = "font-size:12px;letter-spacing:.04em;color:#fff";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.title = "隐藏面板（本页内）";
    close.style.cssText = "cursor:pointer;border:0;background:transparent;color:#c7cdd4;font-size:15px;line-height:1;padding:0 2px";
    close.addEventListener("click", () => panel.style.display = "none");
    head.append(title, close);

    rowsHost = document.createElement("div");
    noteHost = document.createElement("div");
    noteHost.style.cssText = "margin-top:5px;color:#aab3bd;word-break:break-all";

    detailHost = document.createElement("div");
    detailHost.style.cssText = "display:none;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.14);color:#8f99a4;white-space:pre-wrap;word-break:break-all";

    const tools = document.createElement("div");
    tools.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,.14)";

    const relayLabel = document.createElement("label");
    relayLabel.style.cssText = "display:flex;align-items:center;gap:5px;cursor:pointer;color:#ffd166";
    const relayBox = document.createElement("input");
    relayBox.type = "checkbox";
    relayBox.checked = forceRelay;
    relayBox.addEventListener("change", () => {
      forceRelay = relayBox.checked;
      set("route", "pending", forceRelay ? "强制中继已开启，重新连接后生效" : "已恢复自动选择线路");
    });
    relayLabel.append(relayBox, document.createTextNode("强制使用 VPS 中继"));

    const detailButton = document.createElement("button");
    detailButton.type = "button";
    detailButton.textContent = "详情";
    detailButton.style.cssText = "cursor:pointer;margin-left:auto;border:1px solid rgba(255,255,255,.22);border-radius:6px;background:transparent;color:#c7cdd4;font:inherit;padding:1px 7px";
    detailButton.addEventListener("click", () => {
      const shown = detailHost.style.display === "block";
      detailHost.style.display = shown ? "none" : "block";
      detailButton.textContent = shown ? "详情" : "收起";
    });

    tools.append(relayLabel, detailButton);
    panel.append(head, rowsHost, noteHost, detailHost, tools);
    document.body.append(panel);
    render();
  }

  function render() {
    if (!panel || !rowsHost) return;
    rowsHost.textContent = "";
    for (const row of rows) {
      const entry = values.get(row.key) || { status: "unknown", detail: "" };
      const line = document.createElement("div");
      line.style.cssText = "display:flex;gap:8px;justify-content:space-between";
      const label = document.createElement("span");
      label.textContent = row.label;
      label.style.color = "#b9c1c9";
      const value = document.createElement("span");
      value.textContent = entry.detail ? `${STATUS_LABEL[entry.status]} · ${entry.detail}` : STATUS_LABEL[entry.status];
      value.style.cssText = `color:${STATUS_COLOR[entry.status]};text-align:right`;
      line.append(label, value);
      rowsHost.append(line);
    }
    noteHost.textContent = note;
    detailHost.textContent = details;
  }

  function set(key, status, detail) {
    const known = rows.some((row) => row.key === key);
    if (!known) return;
    values.set(key, { status, detail: detail || "" });
    if (enabled) render();
  }

  function setDetail(text) {
    details = text || "";
    if (enabled && detailHost) detailHost.textContent = details;
  }

  // ---- RTCPeerConnection 观察（只读） ----

  const observed = new WeakSet();
  const observedList = [];
  let watched = null;
  let pollTimer = 0;

  function installObserver() {
    const Native = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (typeof Native !== "function" || Native.__yuqingObserved) return;

    const Wrapped = function (...args) {
      const pc = new Native(...args);
      observe(pc);
      return pc;
    };
    Wrapped.prototype = Native.prototype;
    for (const key of Object.getOwnPropertyNames(Native)) {
      if (key === "prototype" || key === "length" || key === "name") continue;
      try {
        Wrapped[key] = Native[key];
      } catch {
        /* 个别属性不可写，忽略即可 */
      }
    }
    Wrapped.__yuqingObserved = true;
    if (window.RTCPeerConnection) window.RTCPeerConnection = Wrapped;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = Wrapped;
  }

  function observe(pc) {
    if (!pc || observed.has(pc)) return;
    observed.add(pc);
    observedList.push(pc);
    if (observedList.length > 8) observedList.shift();
    if (!watched) watched = pc;
    ensurePolling();
  }

  function ensurePolling() {
    if (pollTimer || !enabled) return;
    pollTimer = window.setInterval(() => {
      void sample();
    }, 1500);
  }

  /** 从 PeerJS 的 DataConnection 里取出底层 RTCPeerConnection（字段名随版本变化，全部兜底）。 */
  function peerConnectionOf(conn) {
    if (!conn) return null;
    if (typeof RTCPeerConnection === "function" && conn instanceof RTCPeerConnection) return conn;
    return conn.peerConnection || conn._pc || conn.dataChannel?._pc || conn.dataChannel?.peerConnection || null;
  }

  function selectedPair(stats) {
    const candidates = new Map();
    let pairId = "";
    stats.forEach((report) => {
      if (report.type === "local-candidate" || report.type === "remote-candidate") candidates.set(report.id, report);
      if (report.type === "transport" && report.selectedCandidatePairId) pairId = report.selectedCandidatePairId;
    });
    let pair = null;
    stats.forEach((report) => {
      if (report.type !== "candidate-pair") return;
      if (pairId && report.id === pairId) pair = report;
      else if (!pair && report.state === "succeeded" && (report.nominated || report.selected)) pair = report;
    });
    if (!pair) return null;
    return {
      localType: candidates.get(pair.localCandidateId)?.candidateType || "",
      remoteType: candidates.get(pair.remoteCandidateId)?.candidateType || "",
      protocol: pair.protocol || "",
      rtt: Number.isFinite(pair.currentRoundTripTime) ? Math.round(pair.currentRoundTripTime * 1000) : null,
    };
  }

  async function sample() {
    const pc = watched && watched.connectionState !== "closed" ? watched : activeConnection();
    if (!pc) return;
    if (pc.connectionState === "connected" || pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
      set("connected", "ok");
    } else if (pc.connectionState === "failed" || pc.iceConnectionState === "failed") {
      set("connected", "fail");
    } else {
      set("connected", "pending");
    }
    let stats;
    try {
      stats = await pc.getStats();
    } catch {
      return;
    }
    const pair = selectedPair(stats);
    if (!pair) {
      set("p2p", "pending");
      set("turn", "pending");
      set("route", "pending");
      return;
    }
    const relayed = pair.localType === "relay" || pair.remoteType === "relay";
    set("p2p", relayed ? "fail" : "ok", relayed ? "" : `${pair.localType} → ${pair.remoteType}`);
    set("turn", relayed ? "ok" : "unknown", relayed ? "已中继" : "未使用");
    set("route", "ok", relayed ? "VPS 中继" : "P2P 直连");
    if (pair.rtt !== null) set("latency", "ok", `${pair.rtt} ms`);
    setDetail([
      `ice=${pc.iceConnectionState} pc=${pc.connectionState}`,
      `pair=${pair.localType}→${pair.remoteType} (${pair.protocol || "?"})`,
      `iceTransportPolicy=${pc.getConfiguration?.().iceTransportPolicy || "all"}`,
    ].join("\n"));
  }

  /** 优先取已连通、其次是仍在协商的连接，避免面板盯着一个已经废弃的 PeerConnection。 */
  function activeConnection() {
    const live = observedList.filter((pc) => pc.connectionState !== "closed");
    if (!live.length) return null;
    return live.find((pc) => pc.connectionState === "connected")
      || live.find((pc) => pc.connectionState !== "failed")
      || live[live.length - 1];
  }

  window.YuqingNetDiag = {
    enabled,
    get forceRelay() {
      return forceRelay;
    },

    /** WebSocket 类游戏可以换成自己的行；必须在第一次 report 之前调用。 */
    define(nextRows) {
      if (!Array.isArray(nextRows) || !nextRows.length) return;
      rows = nextRows.map((row) => ({ key: String(row.key), label: String(row.label) }));
      values.clear();
      if (enabled) render();
    },

    report(key, status, detail) {
      if (!enabled) return;
      set(key, STATUS_LABEL[status] ? status : "unknown", detail);
    },

    route(route) {
      if (!enabled) return;
      if (route === "p2p") set("route", "ok", "P2P 直连");
      else if (route === "relay") set("route", "ok", "VPS 中继");
      else set("route", "pending");
    },

    latency(ms) {
      if (!enabled) return;
      set("latency", "ok", Number.isFinite(ms) ? `${Math.round(ms)} ms` : "—");
    },

    note(text) {
      if (!enabled) return;
      note = text || "";
      if (noteHost) noteHost.textContent = note;
    },

    /** 让诊断面板盯住某个具体连接（PeerJS DataConnection 或 RTCPeerConnection）。 */
    watch(connection) {
      if (!enabled) return;
      const pc = peerConnectionOf(connection);
      if (!pc) return;
      watched = pc;
      observe(pc);
    },

    get watchedConnection() {
      return watched;
    },
  };

  if (!enabled) return;

  const boot = () => {
    createPanel();
    installObserver();
    for (const row of rows) if (!values.has(row.key)) values.set(row.key, { status: "unknown", detail: "" });
    render();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();

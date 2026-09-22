/// <reference types="node" />
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const netdiagSource = source("../public/games/_shared/yuqing-netdiag.js");

/** 极简 DOM 桩：只实现 yuqing-netdiag.js 真正用到的那几个方法。 */
class FakeNode {
  tagName: string;
  style: Record<string, string> = {};
  children: FakeNode[] = [];
  id = "";
  type = "";
  checked = false;
  title = "";
  private text = "";

  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
  }

  set textContent(value: string) {
    this.text = value;
    this.children = [];
  }

  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }

  append(...nodes: FakeNode[]): void {
    this.children.push(...nodes);
  }

  appendChild(node: FakeNode): void {
    this.children.push(node);
  }

  setAttribute(): void {}
  addEventListener(): void {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 640, height: 400 };
  }

  walk(): FakeNode[] {
    return [this, ...this.children.flatMap((child) => child.walk())];
  }
}

function loadDiagnostics(options: { query?: string; pc?: any } = {}) {
  const body = new FakeNode("body");
  const created: FakeNode[] = [];
  const document = {
    readyState: "complete",
    body,
    createElement: (tag: string) => {
      const node = new FakeNode(tag);
      created.push(node);
      return node;
    },
    createTextNode: (text: string) => {
      const node = new FakeNode("#text");
      node.textContent = text;
      return node;
    },
    addEventListener: () => {},
  };

  const intervals: Array<{ handler: () => void; id: number }> = [];
  let nextIntervalId = 1;
  const query = options.query ?? "";
  const window: Record<string, any> = {
    location: { href: `https://games.example/index.html${query}`, search: query },
    document,
    setTimeout,
    clearTimeout,
    setInterval: (handler: () => void) => {
      const id = nextIntervalId++;
      intervals.push({ handler, id });
      return id;
    },
    clearInterval: (id: number) => {
      const index = intervals.findIndex((entry) => entry.id === id);
      if (index >= 0) intervals.splice(index, 1);
    },
  };
  if (options.pc) window.RTCPeerConnection = options.pc;

  const context = createContext({ window, document, URLSearchParams, console: { warn: () => {} } });
  runInContext(netdiagSource, context, { filename: "yuqing-netdiag.js" });

  const tick = async () => {
    for (const entry of [...intervals]) entry.handler();
    // sample() 是 async 的，让它的 await 走完。
    await Promise.resolve();
    await Promise.resolve();
  };

  const panel = body.children.find((node) => node.id === "yuqing-netdiag");
  return {
    api: window.YuqingNetDiag as Record<string, any>,
    window,
    body,
    panel,
    tick,
    /** 面板上某一行的渲染文本。 */
    rowText(label: string): string {
      const line = panel?.walk().find((node) => node.children[0]?.textContent === label);
      return line?.children[1]?.textContent ?? "";
    },
    rowsHostText(): string {
      return panel?.children[1]?.textContent ?? "";
    },
  };
}

describe("network diagnostics panel", () => {
  it("renders the default WebRTC rows only with ?debug=network", () => {
    const off = loadDiagnostics();
    expect(off.api.enabled).toBe(false);
    expect(off.panel).toBeUndefined();

    const on = loadDiagnostics({ query: "?debug=network" });
    expect(on.api.enabled).toBe(true);
    expect(on.panel).toBeDefined();
    for (const label of ["联机服务器", "找到对方", "P2P 直连", "VPS TURN 中继", "最终连接", "当前线路", "延迟"]) {
      expect(on.rowText(label)).toContain("—");
    }
  });

  it("lets a WebSocket game swap in its own rows and report status", () => {
    const diag = loadDiagnostics({ query: "?debug=network" });
    diag.api.define([
      { key: "relay", label: "中继服务器" },
      { key: "connected", label: "已连接" },
      { key: "peers", label: "队友状态" },
      { key: "chat", label: "聊天消息" },
    ]);
    // WebRTC 的行必须消失，不能两套行混在一起。
    expect(diag.rowText("P2P 直连")).toBe("");
    expect(diag.rowText("中继服务器")).toContain("—");

    diag.api.report("relay", "ok");
    diag.api.report("peers", "ok", "2 位队友");
    expect(diag.rowText("中继服务器")).toContain("正常");
    expect(diag.rowText("队友状态")).toContain("正常 · 2 位队友");

    // 未知 key 直接忽略，避免游戏写错 key 时把面板弄乱。
    diag.api.report("nope", "ok");
    expect(diag.rowText("已连接")).toContain("—");
  });

  it("detects a TURN-relayed connection and reports latency, without touching the connection", async () => {
    const stats = new Map<string, any>();
    stats.set("l1", { id: "l1", type: "local-candidate", candidateType: "relay" });
    stats.set("r1", { id: "r1", type: "remote-candidate", candidateType: "relay" });
    stats.set("p1", { id: "p1", type: "candidate-pair", state: "succeeded", nominated: true, localCandidateId: "l1", remoteCandidateId: "r1", protocol: "udp", currentRoundTripTime: 0.084 });
    stats.set("t1", { id: "t1", type: "transport", selectedCandidatePairId: "p1" });

    const instances: any[] = [];
    function FakePeerConnection(this: any) {
      const pc = {
        connectionState: "connected",
        iceConnectionState: "connected",
        getStats: async () => stats,
        getConfiguration: () => ({ iceTransportPolicy: "relay" }),
      };
      instances.push(pc);
      return pc;
    }
    const diag = loadDiagnostics({ query: "?debug=network&relay=1", pc: FakePeerConnection });
    expect(diag.api.forceRelay).toBe(true);

    // 面板只观察：创建连接不能改变它的任何参数。
    const pc = new diag.window.RTCPeerConnection({ iceServers: [{ urls: "turn:turn.example.com:3478" }] });
    expect(instances).toHaveLength(1);

    await diag.tick();
    expect(diag.rowText("P2P 直连")).toContain("失败");
    expect(diag.rowText("VPS TURN 中继")).toContain("正常");
    expect(diag.rowText("当前线路")).toContain("VPS 中继");
    expect(diag.rowText("最终连接")).toContain("正常");
    expect(diag.rowText("延迟")).toContain("84 ms");
    // 只读断言：没有给连接加任何东西。
    expect(Object.keys(pc).sort()).toEqual(["connectionState", "getConfiguration", "getStats", "iceConnectionState"]);
  });

  it("reports a direct P2P path as such", async () => {
    const stats = new Map<string, any>();
    stats.set("l1", { id: "l1", type: "local-candidate", candidateType: "host" });
    stats.set("r1", { id: "r1", type: "remote-candidate", candidateType: "srflx" });
    stats.set("p1", { id: "p1", type: "candidate-pair", state: "succeeded", nominated: true, localCandidateId: "l1", remoteCandidateId: "r1", protocol: "udp", currentRoundTripTime: 0.012 });
    stats.set("t1", { id: "t1", type: "transport", selectedCandidatePairId: "p1" });

    function FakePeerConnection(this: any) {
      return {
        connectionState: "connected",
        iceConnectionState: "connected",
        getStats: async () => stats,
        getConfiguration: () => ({}),
      };
    }
    const diag = loadDiagnostics({ query: "?debug=network", pc: FakePeerConnection });
    new diag.window.RTCPeerConnection();
    await diag.tick();

    expect(diag.rowText("P2P 直连")).toContain("正常");
    expect(diag.rowText("当前线路")).toContain("P2P 直连");
    expect(diag.rowText("VPS TURN 中继")).toContain("未使用");
  });

  it("does not wrap RTCPeerConnection when the panel is off", () => {
    const Native = function (this: any) {
      return { connectionState: "connected" };
    } as any;
    const diag = loadDiagnostics({ pc: Native });
    expect(diag.window.RTCPeerConnection).toBe(Native);
  });
});

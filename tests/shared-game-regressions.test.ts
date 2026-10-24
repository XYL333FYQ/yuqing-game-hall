/// <reference types="node" />
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function source(relative: string): string {
  return readFileSync(new URL(`../public/games/${relative}`, import.meta.url), "utf8");
}

function browserCardAi() {
  const context: Record<string, any> = { console };
  context.window = context;
  for (const name of ["parser.js", "guandan-suggest.js", "smart-ai.js"]) {
    runInNewContext(source(`_shared/card-room/js/${name}`), context);
  }
  return context.SmartAI;
}

describe("浏览器实际加载的棋牌建议脚本", () => {
  it("可以跟单牌、对子，并枚举顺子", () => {
    const ai = browserCardAi();
    const card = (value: number, type = 0) => ({ value, type });
    expect(ai.doudizhu.suggest([card(5)], { len: 1, key: 3, type: "A", ctxPos: "other" })).toHaveLength(1);
    expect(ai.doudizhu.suggest([card(5), card(5, 1)], { len: 2, key: 4, type: "AA", ctxPos: "other" })).toHaveLength(2);
    const candidates = ai.doudizhu.enumerate([3, 4, 5, 6, 7].map(value => card(value)));
    expect(candidates.some((candidate: any) => candidate.ret.type === "ABCDE")).toBe(true);
  });

  it("未提供 bomb 标记时也不能用小炸弹压大炸弹", () => {
    const ai = browserCardAi();
    const hand = [0, 1, 2, 3].map(type => ({ value: 4, type, deck: 0 }));
    expect(ai.guandan.suggest(hand, { len: 4, key: 10, type: "BOMB", ctxPos: "other" }, { levelRank: 15 })).toHaveLength(0);
    expect(ai.guandan.suggest(hand, { len: 4, key: 3, type: "BOMB", ctxPos: "other" }, { levelRank: 15 })).toHaveLength(4);
  });
});

it("庇护所旧连接的延迟关闭不会禁用新连接", async () => {
  const sockets: any[] = [];
  const elements = new Map<string, any>();
  class Socket {
    readyState = 1;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onmessage = null;
    onerror = null;
    sent: string[] = [];
    constructor() { sockets.push(this); }
    close() { this.readyState = 3; }
    send(data: string) { this.sent.push(data); }
    deliverClose() { this.onclose?.(); }
  }
  const context: Record<string, any> = {
    window: {}, URL, WebSocket: Socket, location: { protocol: "http:" },
    document: { getElementById(id: string) {
      if (!elements.has(id)) elements.set(id, { style: {}, addEventListener() {} });
      return elements.get(id);
    } },
  };
  runInNewContext(`${source("sanctuarys-end/js/24-net.js")}\nglobalThis.testNet = NET;`, context);
  const net = context.testNet;
  await net.connect("127.0.0.1", 8787, "test");
  sockets[0].onopen();
  net.disconnect();
  await net.connect("127.0.0.1", 8787, "test");
  sockets[1].onopen();
  sockets[0].deliverClose();
  expect(net.connected).toBe(true);
  expect(net.ws).toBe(sockets[1]);
  net.send({ t: "chat", msg: "still connected" });
  expect(sockets[1].sent).toHaveLength(1);
});

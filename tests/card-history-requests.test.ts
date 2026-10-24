/// <reference types="node" />
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function historyRequests(game: string) {
  const html = readFileSync(new URL(`../public/games/${game}/index.html`, import.meta.url), "utf8");
  const start = html.indexOf("openHistory: function () {");
  const section = html.slice(start, html.indexOf("openSiteStats: function () {", start));
  const lifecycleStart = section.indexOf("var stopReplay =");
  const lifecycleEnd = section.indexOf("var idx = layer.open", lifecycleStart);
  const requestStart = section.indexOf("var requestHistory = function");
  const requestEnd = section.indexOf("var formatTime =", requestStart);
  if (start < 0 || lifecycleStart < 0 || lifecycleEnd < lifecycleStart || requestStart < 0 || requestEnd < requestStart) {
    throw new Error(`Missing ${game} history controller anchors`);
  }
  const requests: { signal: AbortSignal; resolve: (response: any) => void; reject: (error: Error) => void }[] = [];
  const rendered: string[] = [], failures: string[] = [];
  const ctx: Record<string, any> = {
    AbortController,
    panel: { isConnected: true },
    self: { historyViewerHeaders: () => ({}) },
    fetch: (_url: string, options: { signal: AbortSignal }) => new Promise((resolve, reject) => {
      // Deliberately allow late completion after abort, as an already received response can do.
      requests.push({ signal: options.signal, resolve, reject });
    }),
  };
  runInNewContext(section.slice(lifecycleStart, lifecycleEnd) + section.slice(requestStart, requestEnd), ctx);
  ctx.stopReplay = vi.fn();
  const send = (name: string) => ctx.requestHistory(name, (data: { value: string }) => rendered.push(data.value), () => failures.push(name));
  const succeed = (index: number, value: string) => requests[index].resolve({ ok: true, json: async () => ({ value }) });
  return { ctx, requests, rendered, failures, send, succeed };
}

describe.each(["mahjong", "guandan"])("%s 历史面板的实际请求控制器", game => {
  it("较早的成功响应不能覆盖最新结果", async () => {
    const state = historyRequests(game);
    const older = state.send("older"), latest = state.send("latest");
    expect(state.requests[0].signal.aborted).toBe(true);
    state.succeed(1, "latest"); await latest;
    state.succeed(0, "older"); await older;
    expect(state.rendered).toEqual(["latest"]);
  });

  it("较早请求的失败不能替换新请求的内容", async () => {
    const state = historyRequests(game);
    const older = state.send("older"), latest = state.send("latest");
    state.succeed(1, "latest"); await latest;
    state.requests[0].reject(new Error("late network error")); await older;
    expect(state.failures).toEqual([]);
    expect(state.rendered).toEqual(["latest"]);
  });

  it("关闭面板中止请求、停止播放，并忽略迟到响应及后续请求", async () => {
    const state = historyRequests(game), pending = state.send("pending");
    state.ctx.closeHistory();
    expect(state.requests[0].signal.aborted).toBe(true);
    state.succeed(0, "late"); await pending;
    state.send("after close");
    expect(state.requests).toHaveLength(1);
    expect(state.rendered).toEqual([]);
    expect(state.failures).toEqual([]);
    expect(state.ctx.stopReplay).toHaveBeenCalledOnce();
  });

  it("旧请求结束后关闭面板仍能中止当前请求", async () => {
    const state = historyRequests(game);
    const older = state.send("older"), latest = state.send("latest");
    state.succeed(0, "older"); await older;
    expect(state.requests[1].signal.aborted).toBe(false);
    state.ctx.closeHistory();
    expect(state.requests[1].signal.aborted).toBe(true);
    state.succeed(1, "late latest"); await latest;
    expect(state.rendered).toEqual([]);
  });

  it("面板已移除但关闭回调尚未执行时也不应用响应", async () => {
    const state = historyRequests(game), pending = state.send("pending");
    state.ctx.panel.isConnected = false;
    state.succeed(0, "detached"); await pending;
    expect(state.rendered).toEqual([]);
    expect(state.failures).toEqual([]);
  });

  it("当前 HTTP 错误正常反馈，重试仍能显示结果", async () => {
    const state = historyRequests(game), failed = state.send("failed");
    state.requests[0].resolve({ ok: false }); await failed;
    expect(state.failures).toEqual(["failed"]);
    const retry = state.send("retry");
    state.succeed(1, "recovered"); await retry;
    expect(state.rendered).toEqual(["recovered"]);
  });
});

/**
 * 果切派对复用公共的只读网络诊断框架（URL 带 `?debug=network` 时启用）。
 *
 * 和孤堡尸潮 / 像素竞技场共用同一个面板实现，只是把 WebRTC 的行换成 WebSocket 语义：
 *   联机服务器 / 房间 / 找到对方 / 最终连接
 *
 * 这里只上报状态，不参与任何连接、房间或对战决策；`window.YuqingNetDiag` 不存在时
 * 所有调用都是空操作。
 */

export type FruitDiagnosticKey = "service" | "room" | "opponent" | "connected";
export type DiagnosticStatus = "ok" | "fail" | "pending" | "unknown";

interface NetDiagApi {
  enabled?: boolean;
  define?: (rows: ReadonlyArray<{ key: string; label: string }>) => void;
  report?: (key: string, status: DiagnosticStatus, detail?: string) => void;
  note?: (text: string) => void;
}

declare global {
  interface Window {
    YuqingNetDiag?: NetDiagApi;
  }
}

let initialized = false;

/** 在进入联机房间页时调用一次；重复调用是安全的。 */
export function initFruitPartyDiagnostics(): void {
  const diag = window.YuqingNetDiag;
  if (!diag?.enabled || initialized) return;
  initialized = true;
  diag.define?.([
    { key: "service", label: "联机服务器" },
    { key: "room", label: "房间" },
    { key: "opponent", label: "找到对方" },
    { key: "connected", label: "最终连接" },
  ]);
  diag.note?.("果切使用权威 WebSocket，不是 WebRTC");
}

export function reportDiagnostic(key: FruitDiagnosticKey, status: DiagnosticStatus, detail?: string): void {
  window.YuqingNetDiag?.report?.(key, status, detail);
}

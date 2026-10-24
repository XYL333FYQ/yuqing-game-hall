import { isRoomCredentials, type CreateRoomResponse } from "../shared/protocol";
import { reportDiagnostic } from "./netDiagnostics";
import { multiplayerHttpUrl, multiplayerServiceLabel, waitForMultiplayerServiceConfig } from "./serviceConfig";

export async function roomRequest(path: string, body: object): Promise<CreateRoomResponse> {
  await waitForMultiplayerServiceConfig();
  const requestUrl = multiplayerHttpUrl(path);
  reportDiagnostic("service", "pending");
  reportDiagnostic("room", "pending");
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), 10_000);
  try {
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      reportDiagnostic("service", "fail", multiplayerServiceLabel());
      if (controller.signal.aborted) throw new Error("房间请求超时，请检查网络后重试。");
      throw new Error(`无法连接果切多人服务（${multiplayerServiceLabel()}）。请确认后端已启动，并检查 fruit-party.config.js。`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      reportDiagnostic("service", "fail", "地址没有返回房间 API");
      throw new Error(`果切多人服务地址（${multiplayerServiceLabel()}）没有返回房间 API，请检查 fruit-party.config.js。`);
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error(controller.signal.aborted ? "房间请求超时，请检查网络后重试。" : "房间服务返回的数据无法解析，请重试。");
    }
    if (!response.ok) {
      const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "房间服务暂时不可用。";
      reportDiagnostic("room", "fail", message);
      throw new Error(message);
    }
    if (!isCreateRoomResponse(data)) throw new Error("房间数据不完整，请重新创建或加入房间。");
    reportDiagnostic("service", "ok", multiplayerServiceLabel());
    reportDiagnostic("room", "ok", data.code);
    return data;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function isCreateRoomResponse(value: unknown): value is CreateRoomResponse {
  return isRoomCredentials(value) && "mode" in value
    && (value.mode === "score90" || value.mode === "bestOf3" || value.mode === "survival");
}



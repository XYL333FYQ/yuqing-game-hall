import type { CreateRoomResponse } from "../shared/protocol";
import { reportDiagnostic } from "./netDiagnostics";
import { multiplayerHttpUrl, multiplayerServiceLabel, waitForMultiplayerServiceConfig } from "./serviceConfig";

export async function roomRequest(path: string, body: object): Promise<CreateRoomResponse> {
  await waitForMultiplayerServiceConfig();
  const requestUrl = multiplayerHttpUrl(path);
  reportDiagnostic("service", "pending");
  reportDiagnostic("room", "pending");
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    reportDiagnostic("service", "fail", multiplayerServiceLabel());
    throw new Error(`无法连接果切多人服务（${multiplayerServiceLabel()}）。请确认后端已启动，并检查 fruit-party.config.js。`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    reportDiagnostic("service", "fail", "地址没有返回房间 API");
    throw new Error(`果切多人服务地址（${multiplayerServiceLabel()}）没有返回房间 API，请检查 fruit-party.config.js。`);
  }
  const data = await response.json() as CreateRoomResponse & { error?: string };
  if (!response.ok) {
    reportDiagnostic("room", "fail", data.error ?? "房间服务暂时不可用");
    throw new Error(data.error ?? "房间服务暂时不可用。");
  }
  reportDiagnostic("service", "ok", multiplayerServiceLabel());
  reportDiagnostic("room", "ok", String(data.code ?? ""));
  return data;
}



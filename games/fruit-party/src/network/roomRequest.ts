import type { CreateRoomResponse } from "../shared/protocol";
import { multiplayerHttpUrl, multiplayerServiceLabel } from "./serviceConfig";

export async function roomRequest(path: string, body: object): Promise<CreateRoomResponse> {
  const requestUrl = multiplayerHttpUrl(path);
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`无法连接果切多人服务（${multiplayerServiceLabel()}）。请确认后端已启动，并检查 fruit-party.config.js。`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`果切多人服务地址（${multiplayerServiceLabel()}）没有返回房间 API，请检查 fruit-party.config.js。`);
  }
  const data = await response.json() as CreateRoomResponse & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "房间服务暂时不可用。");
  return data;
}



import type { CreateRoomResponse } from "../server/protocol";

export async function roomRequest(path: string, body: object): Promise<CreateRoomResponse> {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    throw new Error("当前统一启动入口未启用联机后端；联机验收时请运行 corepack pnpm dev:cloudflare。");
  }

  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("联机服务没有正确响应，请重新运行 corepack pnpm dev:cloudflare。");
  }
  const data = await response.json() as CreateRoomResponse & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "房间服务暂时不可用。");
  return data;
}



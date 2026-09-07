// 此文件由 scripts/generate-game-catalog.mjs 生成。
interface Env { ASSETS: Fetcher }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return Response.json({ ok: true, service: "yuqing-game-hall" });
    if (url.pathname.startsWith("/api/")) return Response.json({ error: "当前平台没有内置游戏后端。" }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};

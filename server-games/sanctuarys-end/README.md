# Sanctuary's End WebSocket 中继

这个服务只同步玩家在线状态与聊天，不同步敌人、伤害或掉落，因此不是权威合作战斗服务器。它已从 `public/games/sanctuarys-end/Server/` 移到这里，避免后端源码被 Cloudflare Pages 当作静态文件发布。

本地启动：

```text
corepack pnpm server:sanctuary:start
```

生产环境必须设置 `ALLOWED_ORIGINS`。Nginx 对外提供 `wss://sanctuary.example.com/socket`，Compose 只把 Node 服务端口映射到 VPS 的 `127.0.0.1:8787`。在 Cloudflare Pages 项目的 `SANCTUARY_RELAY_URL` 运行时环境变量中填写该公开 WSS 地址，无需重新构建前端。

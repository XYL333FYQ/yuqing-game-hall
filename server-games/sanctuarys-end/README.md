# Sanctuary's End WebSocket 中继

这个服务只同步玩家在线状态与聊天，不同步敌人、伤害或掉落，因此不是权威合作战斗服务器。它已从 `public/games/sanctuarys-end/Server/` 移到这里，避免后端源码被 Cloudflare Pages 当作静态文件发布。

本地启动：

```text
corepack pnpm server:sanctuary:start
```

生产环境必须设置 `ALLOWED_ORIGINS`。Nginx 对外提供 `wss://sanctuary.example.com/socket`，Node 服务只监听 `127.0.0.1:8787`。随后在静态运行包的 `sanctuary.config.js` 填写该地址。

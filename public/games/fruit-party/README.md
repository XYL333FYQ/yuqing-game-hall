# 果切派对独立运行说明

这个目录是一份可单独部署的静态游戏包。`index.html`、`assets/` 和
`fruit-party.config.js` 是浏览器运行所需文件；页面内导航只使用自己的
`?route=...` 查询参数，不依赖雨晴游戏厅的页面路由。

## 静态站点

把本目录作为网站根目录即可。单机和街机模式不需要后端。

多人客户端读取 `fruit-party.config.js`：

```js
window.FRUIT_PARTY_CONFIG = {
  multiplayerServiceUrl: "https://fruit-rooms.example.com",
};
```

留空表示请求当前网站同源的 `/api`。如果静态站点与多人服务使用不同域名，
服务端还必须把静态站点的完整来源加入 `ALLOWED_ORIGINS`，多个来源用逗号分隔。

## 多人后端

`source/server/worker.ts` 是果切自己的 Cloudflare Worker，`wrangler.jsonc`
为它声明 `GameRoom` Durable Object。它只提供以下边界，不承载游戏平台页面：

- `GET /api/health`
- `POST /api/rooms`
- `POST /api/rooms/:code/join`
- `GET /api/rooms/:code/socket`（WebSocket 升级）

在仓库根目录运行本地后端：

```powershell
corepack pnpm exec wrangler dev --config public/games/fruit-party/wrangler.jsonc --port 8790 --var "ALLOWED_ORIGINS:http://127.0.0.1:8766"
```

生产部署前先运行：

```powershell
corepack pnpm check:fruit-party:server
corepack pnpm build:fruit-party:server
```

部署时通过 Wrangler 环境变量或 Secret 配置实际的 `ALLOWED_ORIGINS`。不要把
管理密钥放进 `fruit-party.config.js`；这里的服务地址本来就是浏览器可见信息。

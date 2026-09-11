# 果切派对开发源码

这里保存果切派对自己的 TypeScript、Canvas、页面、输入、音频和比赛协议。它不参与游戏厅 Vite 包，也不会直接上传 Cloudflare。

在仓库根目录执行：

```powershell
corepack pnpm build:fruit-party
```

构建脚本只把浏览器运行所需的 `index.html`、`fruit-party.config.js`、哈希 JS/CSS、字体、美术和音频更新到 `public/games/fruit-party/`。游戏平台随后把该目录当成普通独立游戏，通过 iframe 加载。

多人服务不在这里运行。浏览器与 VPS 共用的纯协议/规则位于 `src/shared/`，Node/WebSocket 实现在 `server-games/fruit-party/`。

本地联调：

```powershell
corepack pnpm server:fruit:dev
corepack pnpm dev
```

localhost 下未配置地址时，客户端自动连接 `http://127.0.0.1:8790`。生产构建前必须把 `src/public/fruit-party.config.js` 的 `multiplayerServiceUrl` 改为 VPS 的公开 HTTPS 地址，再重新运行 `build:fruit-party`。配置中只能放公开服务地址，不能放密钥。

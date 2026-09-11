# Sanctuary's End 开发边界

这里保留 Sanctuary's End 的开发说明、类型定义与 Biome/TypeScript 配置。浏览器真正运行的 HTML、JavaScript、模型、字体和其他静态资源位于 `../../public/games/sanctuarys-end/`，由 Cloudflare Pages 发布；本目录不会进入 `dist/`。

完整上游原始 README 与源码副本保存在 `../../game-sources/upstream/Sanctuarys_End/`，因此这里不重复保存已经过时的上游部署步骤。

## 本地运行

从项目根目录启动游戏厅：

```powershell
corepack pnpm dev
```

然后打开 `/play/sanctuarys-end`。也可以直接访问 `/games/sanctuarys-end/sanctuary.html`，但必须通过 HTTP 提供，不能用 `file://` 双击运行 ES 模块。

游戏浏览器端无需打包。可选的开发检查从本目录运行：

```powershell
npm install
npm run typecheck
npm run lint
```

这些工具读取 `../../public/games/sanctuarys-end/js/`，不会把开发依赖发布给玩家。

## 联机数据服务

轻量位置/聊天中继已迁到 `../../server-games/sanctuarys-end/`。从项目根目录启动本地版本：

```powershell
corepack pnpm server:sanctuary:start
```

生产环境需要：

1. 在 VPS 为中继服务配置 `ALLOWED_ORIGINS`；
2. 通过 Nginx/Caddy 暴露 WSS；
3. 把 `../../public/games/sanctuarys-end/sanctuary.config.js` 的 `relayUrl` 改成公开 `wss://.../socket` 地址；
4. 重新执行根目录的 `corepack pnpm build`。

中继只同步在线位置和聊天，不负责敌人、伤害、掉落或存档，因此不能把它描述成权威合作战斗服务器。

## 资源与许可

运行包中的 `LICENSE`、`CREDITS.md` 和各依赖许可必须保留。开发资料移出 `public/` 只是为了避免 Cloudflare 发布无关文件，不代表删除或改变上游许可。

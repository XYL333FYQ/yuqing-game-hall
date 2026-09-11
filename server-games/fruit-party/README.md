# 果切派对 VPS 多人服务

这个目录只包含果切房间的 HTTP 与 WebSocket 后端，不包含游戏平台页面、iframe
页面或静态资源。房间状态保存在当前 Node 进程内，适合单实例部署；重启会结束现有
房间。需要横向扩容时，应先把房间状态与消息广播迁移到 Redis 等共享基础设施。

## 本地运行

在仓库根目录执行：

```text
corepack pnpm install --frozen-lockfile
corepack pnpm server:fruit:check
corepack pnpm server:fruit:build
corepack pnpm server:fruit:dev
```

开发模式未设置 `NODE_ENV=production` 时，默认允许 `localhost` 和 `127.0.0.1`
来源。生产环境必须设置 `ALLOWED_ORIGINS`，例如：

```text
HOST=0.0.0.0
PORT=8790
NODE_ENV=production
ALLOWED_ORIGINS=https://games.example.com
```

前端 `public/games/fruit-party/fruit-party.config.js` 的
`multiplayerServiceUrl` 要填写公开 HTTPS 地址，例如
`https://rooms.example.com`。浏览器会自动把房间连接换成 `wss://`。

## Docker / VPS

Docker 构建上下文必须是仓库根目录，因为服务构建时会把果切共享比赛规则一起打包：

```text
docker build -f server-games/fruit-party/Dockerfile -t yuqing-fruit-party-server .
docker run --rm -p 127.0.0.1:8790:8790 --env-file server-games/fruit-party/.env yuqing-fruit-party-server
```

也可以复制上级目录的 `docker-compose.example.yml` 和 `nginx.example.conf`。
Nginx 负责 HTTPS 与 WebSocket 升级，Node 服务只监听内网端口。

接口边界：

- `GET /api/health`
- `POST /api/rooms`
- `POST /api/rooms/:code/join`
- `GET /api/rooms/:code`
- `GET /api/rooms/:code/socket`（WebSocket 升级）

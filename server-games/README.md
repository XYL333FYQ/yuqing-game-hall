# 联机游戏服务器区

这里收纳不能作为 Cloudflare 静态资源直接运行的联机项目。雨晴游戏厅主站只负责中文介绍和入口；匹配、房间、WebSocket 与权威状态必须在常驻服务器上运行。

## 可以直接用 Docker 启动

`docker-compose.example.yml` 提供两个相互独立的服务：

- Scribble.rs：`biosmarcel/scribble.rs:latest`，容器端口 `8080`。
- TOSIOS：`halftheopposite/tosios`，容器端口 `3001`。

复制为 `docker-compose.yml`，把示例域名和 CORS 来源改成自己的域名，再运行：

```bash
docker compose up -d
docker compose ps
```

两个端口默认只绑定 `127.0.0.1`，不会直接暴露在公网。使用 `nginx.example.conf` 配置 HTTPS 反向代理；WebSocket 的 `Upgrade` 和 `Connection` 请求头不能省略。

## 需要从源码构建

上游源码保存在 `../game-sources/upstream/`，不复制进游戏厅静态构建。

### Suroi

```bash
cd game-sources/upstream/suroi
bun install --frozen-lockfile
bun build:client
bun start
```

Suroi 的客户端构建、服务端配置和 Nginx 目录必须按同一上游版本部署。它使用 Bun 和专用游戏服务，不能原样改成 Cloudflare Worker。

### OpenFront

```bash
cd game-sources/upstream/OpenFrontIO
npm run inst
npm run build-prod
npm run start:server
```

生产环境还必须提供上游要求的域名、API 密钥、Turnstile、进程数和版本提交等环境变量。不要把 README 中的开发占位密钥用于公网。OpenFront 使用 AGPL-3.0，修改后对外提供网络服务时必须遵守对应源码义务；素材另受 CC BY-SA 4.0 约束。

## Cloudflare 的位置

主站和五款静态游戏可以放在 Cloudflare Workers Static Assets。自有服务器上的联机服务可使用独立子域名；Cloudflare 可以代理 HTTPS 和 WebSocket，但免费静态托管本身不会替你运行 Bun、Go、Colyseus 或 OpenFront 的 Node 服务。

本目录只准备部署结构，不会自动登录服务器、改 DNS 或公开端口。正式上线前仍需在目标服务器执行容器或构建验收。

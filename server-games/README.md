# VPS 联机数据服务

这个目录只放联机数据处理：HTTP API、WebSocket 房间、中继、WebRTC 信令与 TURN 配置。它不保存或提供游戏 HTML、JavaScript、图片、音频、模型等静态资源；这些内容全部由 Cloudflare Pages 的 `dist/` 提供。

```text
Cloudflare Pages                              VPS
大厅 + /games 下的静态运行包   --HTTPS-->  API / 中继 / 信令
浏览器中的游戏                ---WSS--->  房间/比分/状态中继、PeerJS 信令
浏览器 A                      --WebRTC-> 浏览器 B
                                   \----> 直连失败时经 VPS coturn 中继
```

## 配置来源：GitHub，不是 VPS

`server-games/.env` 是**部署产物**，不是需要长期维护的配置文件。
`deploy-vps.yml` 每次执行都会从 GitHub Variables / Secrets 重新生成它并原子替换到 VPS：

```text
GitHub Variables / Secrets
  → node server-games/scripts/generate-env.mjs   （校验 + 生成，缺项直接失败）
  → $RUNNER_TEMP/server-games.env               （runner 临时目录，权限 600，不进仓库）
  → scp 成 .env.incoming
  → 在 VPS 上 mv 原子替换成 .env
  → 比对本地/远端 sha256
  → docker compose pull / up -d
  → 健康检查 + 协议 smoke test
```

## 马来西亚单一生产部署

2026-10-10 已完成六条正式 DNS 切换、公网 HTTPS/WebSocket/STUN 检查及双客户端公网联机验收。
`.github/workflows/deploy-vps.yml` 的 push 和手动运行均固定使用 `malaysia` GitHub Environment（Azure），不再提供即将到期的香港 VPS 目标。回滚通过手动运行并填写 `image_sha`，回滚的是 Azure 上的旧版本镜像而非回香港。
**不要再将 GitHub 仓库级 VPS_HOST / VPS_USER / VPS_SSH_KEY 作为实际生产部署凭据**，现在应使用 `malaysia` 环境内的同名 Secrets。

**malaysia 环境必须配置：**

- 环境 Secrets：`VPS_HOST`（Azure 公网 IP）、`VPS_USER`（例如 `azureuser`）、`VPS_SSH_KEY`（此用户对应私钥）。
- 环境 Variables：`DEPLOY_TARGET_GUARD=malaysia`、`MALAYSIA_PUBLIC_IP`（Azure 公网 IP）、`TURN_EXTERNAL_IP`（同一 IP）。
- 其余仍共用仓库级 Secrets / Variables：例如 GHCR 镜像拉取、Cloudflare Pages 部署、`ALLOWED_ORIGINS`、`TURN_PUBLIC_HOST`、`TURN_REALM`。不要误删这些共享项；正式 `turn.xyllovefyq.cc.cd` 已指向 Azure。

若上述专属配置缺失，工作流会在构建镜像与 SSH 之前拒绝部署，防止误读已废弃的仓库级香港凭据。
`VPS_USER` 需要具有 Docker 权限，并且能够写入 `/opt/yuqing-game-hall/server-games`。
工作流已排除文档和工作流自身修改触发的自动部署，所以单纯更新部署工作流不会重启线上容器。

确认其他工作流不依赖后，可删除仓库级旧 `VPS_HOST`、`VPS_USER`、`VPS_SSH_KEY` Secrets 及仓库级旧 `TURN_EXTERNAL_IP` Variable；**保留** `malaysia` 环境中的同名条目。Cloudflare Pages/GHCR/TURN 共享配置仍须保留。
GHCR 全局旧镜像版本清理目前仍禁用，Azure VPS 本地旧镜像清理仍执行。后续在确认版本回滚策略后可重新启用。
注意：独立环境并不自动安装 Nginx、管理 DNS/证书或配置 Azure NSG，这些仍需部署前配置并单独验收。

## 后端镜像版本与回滚

每次正常部署都会将五个后端镜像标记为当前 Git 提交的完整 SHA，并让 VPS 使用这些不可变标签，避免 `latest` 在失败或回滚时指向不确定版本。通过健康检查和协议验收后，工作流把成功版本写入 VPS 的 `.deployed-version`，并清理旧镜像；VPS 与 GHCR 都保留当前版本和上一成功版本。

如需回滚，在 GitHub Actions 手动运行 **Deploy VPS Backends**：`image_sha` 留空会构建并部署工作流当前提交；填入一个 40 位小写提交 SHA，则直接拉取该已发布版本，不重建镜像。只能回滚到仍保留在 GHCR 中的版本；自动清理后通常可选当前版和上一版。

仓库中的 GHCR 全局旧版本清理目前禁用，避免在确认回滚策略前删除需要的镜像。后续如启用，请检查 `GITHUB_TOKEN` 权限和保留策略；VPS 本地镜像清理仅针对本项目五个后端镜像，不会清理 coturn、其他 Docker 镜像或卷。

**不要手动编辑 `/opt/yuqing-game-hall/server-games/.env`**：下一次部署就会被覆盖。
要改配置就去改 GitHub 上的 Variables / Secrets，然后到 Actions 页面 Run workflow
（改配置不会触发 push 事件）。

### 需要哪些配置

| 位置 | 键 | 说明 |
| --- | --- | --- |
| Variables | `ALLOWED_ORIGINS` | 允许访问后端的前端来源，逗号分隔 |
| Variables | `TURN_PUBLIC_HOST` | 自建 STUN/TURN 对外域名 |
| Variables | `TURN_EXTERNAL_IP` | VPS 公网 IPv4 |
| Variables | `TURN_REALM` | coturn realm，通常等于 `TURN_PUBLIC_HOST` |
| Variables | `TURN_PORT` | coturn 监听端口，默认 `3478` |
| Variables | `TURN_MIN_PORT` / `TURN_MAX_PORT` | 中继端口段，默认 `49160` / `49200` |
| Variables | `TURN_CREDENTIAL_TTL_SECONDS` | 短期凭据有效期，默认 `3600` |
| Secrets | `TURN_SHARED_SECRET` | gateway 与 coturn 共用，至少 32 位；`openssl rand -hex 32` |

生成器会做格式与范围校验，并且会拦下几类「运行时只表现为连不上」的错误，例如
`TURN_PORT` 落在中继端口段内、`TURN_MIN_PORT > TURN_MAX_PORT`、
值里含 `$` / 引号 / `#` / 换行等会破坏 `.env` 解析的字符。
校验逻辑有独立单元测试：`corepack pnpm server:config:test`。

`.env.example` 只用于**本地**手动起服务调试（`docker compose -f docker-compose.example.yml`），
不参与自动部署。

## 当前可直接部署的服务

| 目录 | 作用 | 协议 |
| --- | --- | --- |
| `fruit-party/` | 权威房间、比赛规则、比分和重连 | HTTP + WebSocket |
| `sanctuarys-end/` | 只转发在线位置与聊天，不处理战斗和资源 | WebSocket |
| `webrtc-gateway/` | PeerJS 信令、签发短期 TURN 凭据、`/health` | HTTP + WebSocket |
| `card-room/` | 掼蛋 / 四人麻将，访客、AI、观战及房间规则 | HTTP + Socket.IO |
| `gobang/` | 五子棋房间、回合与胜负校验 | WebSocket |
| （compose 中的 `coturn`） | 自建 STUN + TURN，浏览器拿到的凭据由 gateway 签发 | STUN/TURN |

本地手动调试（正式部署走 GitHub Actions，见上一节）：

```bash
cp .env.example .env
cp docker-compose.example.yml docker-compose.yml
docker compose up -d --build
docker compose ps
```

以上命令在 `server-games/` 目录执行；Docker 构建上下文仍是仓库根目录，因为果切服务会打包 `games/fruit-party/src/shared/` 中的共享比赛协议。五个服务的端口都只绑定到 VPS 的 `127.0.0.1`，公网通过 `nginx.example.conf` 的 HTTPS/WSS 反向代理访问；只有 coturn 直接对外暴露 `3478/tcp+udp` 与中继端口段。`.env` 中的 `ALLOWED_ORIGINS` 必须是 Cloudflare 游戏厅的完整来源，例如 `https://games.example.com`。

## WebRTC 基础设施

`webrtc-gateway` 和 `coturn` 一起构成雨晴自己的 WebRTC 基础设施：

```text
浏览器
  ├─ GET /api/runtime-config            （Cloudflare Pages Function）
  │     -> WEBRTC_SERVICE_URL
  ├─ GET <WEBRTC_SERVICE_URL>/rtc-config（gateway）
  │     -> 自建 STUN 地址 + 带过期时间的 TURN 临时凭据
  ├─ WSS <WEBRTC_SERVICE_URL>/peerjs    （gateway，PeerJS 信令）
  └─ turn:<TURN_PUBLIC_HOST>:3478       （coturn，直连失败时中继）
```

关键约束：

- 浏览器**永远拿不到** `TURN_SHARED_SECRET`。gateway 用 HMAC-SHA1 为每个客户端签发 `过期时间:随机串` 形式的短期用户名和对应凭据，coturn 用同一密钥做 `--use-auth-secret` 校验。
- 游戏源码里不写任何 VPS 域名或 IP。`public/games/_shared/yuqing-webrtc.js` 只读 Cloudflare 运行时公开配置。
- 配置缺失时状态是 `unconfigured`，游戏会明确告诉玩家“联机服务未配置”，**不会**回退到公共 PeerJS / 公共 STUN。否则我们无法判断自建信令与 TURN 是否真的在工作。
- `WEBRTC_SERVICE_URL` 必须是一个独立主机（反向代理的根路径），不能带路径前缀：PeerJS 客户端会把 `path` 拼成 `<path>peerjs/id` 与 `<path>peerjs`。
- 本地联调可以显式指定服务地址，不需要改源码：`window.YUQING_WEBRTC_SERVICE_URL = "https://..."` 或 URL 加 `?webrtc=https://...`。

## 网络诊断

任意游戏页加 `?debug=network` 会显示只读诊断面板，并出现仅在调试模式可用的“强制使用 VPS 中继”开关。面板只读取 `RTCPeerConnection` 状态，不参与任何连接决策；普通玩家看不到它，也不会有额外开销（关闭时既不建面板，也不包装 `RTCPeerConnection`）。

WebRTC 游戏（孤堡尸潮 / 像素竞技场）默认行：联机服务器 / 找到对方 / P2P 直连 / VPS TURN 中继 / 最终连接 / 当前线路 / 延迟。

WebSocket 游戏复用同一个面板，只是换成自己的行：

- 庇护所（`public/games/sanctuarys-end/js/24-net.js`）：中继服务器 / 已连接 / 队友状态 / 聊天消息；
- 果切（`games/fruit-party/src/network/netDiagnostics.ts`）：联机服务器 / 房间 / 找到对方 / 最终连接。

## 测试与验收

```bash
# 协议级 smoke test：gateway 自己起进程，验证 /health、/rtc-config、/peerjs/id、Origin 拒绝
pnpm --dir server-games/webrtc-gateway test
pnpm --dir server-games/webrtc-gateway test:smoke

# 两个真实 WebSocket 客户端验证 welcome / state / chat / leave
pnpm --dir server-games/sanctuarys-end test

# 从外部验证自建 STUN/TURN 是否真的可达（防火墙 + coturn + DNS）
pnpm server:turn:check turn.example.com 3478
```

对已经在跑的部署做验收时，把上面两个 smoke test 指向真实地址即可，断言完全一致：

```bash
RELAY_URL=ws://127.0.0.1:8787/socket RELAY_ORIGIN=https://games.example.com \
  pnpm --dir server-games/sanctuarys-end test
WEBRTC_GATEWAY_URL=http://127.0.0.1:9000 WEBRTC_GATEWAY_ORIGIN=https://games.example.com \
  pnpm --dir server-games/webrtc-gateway test:smoke
```

`deploy-vps.yml` 就是这样做的：部署后通过 SSH 隧道连 VPS 的 `127.0.0.1:8787` / `127.0.0.1:9000` 跑同一份断言，并额外检查容器健康状态与公网 STUN/TURN 可达性。它不会只验证“进程活着”。

## 手动步骤

本目录的脚本不会登录 VPS、修改防火墙、申请证书或改 DNS。正式上线仍需在目标服务器完成：

1. 申请 `rtc.example.com` / `turn.example.com` 的证书与 DNS；
2. 放行 `3478/tcp+udp` 与中继端口段 `49160–49200/udp`；
3. 用 `openssl rand -hex 32` 生成 `TURN_SHARED_SECRET` 并写入 `.env`；
4. 在 Cloudflare Pages 设置 `WEBRTC_SERVICE_URL`；
5. 用上面的 smoke test 与 `?debug=network` 面板做一次跨网络验收。

## 新增棋牌

部署、好友 / 单人玩法、固定上游版本及换 VPS 操作见 [BOARD_GAMES.md](../BOARD_GAMES.md)。新增牌房 8002 和五子棋 8792 只监听 VPS 回环地址，使用独立 HTTPS/WSS 反向代理。前端新增 `CARD_ROOM_SERVICE_URL` 与 `GOBANG_SERVICE_URL`，仍由 GitHub Variables 管理。牌房为访客内存模式，重启会清空战绩及房间。

```bash
pnpm --dir server-games/card-room test
pnpm --dir server-games/gobang test
# 对已部署服务执行相同双客户端协议验收：
CARD_ROOM_URL=https://cards.example.com BOARD_ORIGIN=https://games.example.com pnpm --dir server-games/card-room test:smoke
GOBANG_URL=wss://gobang.example.com/socket BOARD_ORIGIN=https://games.example.com pnpm --dir server-games/gobang test
```

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
| （compose 中的 `coturn`） | 自建 STUN + TURN，浏览器拿到的凭据由 gateway 签发 | STUN/TURN |

本地手动调试（正式部署走 GitHub Actions，见上一节）：

```bash
cp .env.example .env
cp docker-compose.example.yml docker-compose.yml
docker compose up -d --build
docker compose ps
```

以上命令在 `server-games/` 目录执行；Docker 构建上下文仍是仓库根目录，因为果切服务会打包 `games/fruit-party/src/shared/` 中的共享比赛协议。三个服务的端口都只绑定到 VPS 的 `127.0.0.1`，公网通过 `nginx.example.conf` 的 HTTPS/WSS 反向代理访问；只有 coturn 直接对外暴露 `3478/tcp+udp` 与中继端口段。`.env` 中的 `ALLOWED_ORIGINS` 必须是 Cloudflare 游戏厅的完整来源，例如 `https://games.example.com`。

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

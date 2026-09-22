# 雨晴游戏厅架构

## 1. 架构结论

项目采用“静态平台、独立游戏、独立后端”三层结构：

```text
Cloudflare Pages
  ├─ 游戏厅 SPA（src -> dist）
  ├─ 游戏简介目录（game.json -> generated catalog）
  └─ 静态游戏运行包（public/games -> dist/games）
            │
            │ iframe
            ▼
      每款游戏自己的 HTML / JS / CSS / Canvas / 资源
            │
            │ HTTPS + WSS（需要联机时）
            ▼
VPS
  ├─ 房间、匹配、权威状态与 WebSocket
  ├─ 可选的 WebRTC 信令服务
  └─ 可选的 STUN/TURN（独立端口与运维边界）

第三方服务器游戏
  └─ 由 Manifest 提供 external URL，浏览器跳转到其独立服务器
```

大厅只知道游戏的资料和启动地址，不 import 玩法模块；游戏也不依赖大厅 DOM。这样某款游戏的框架、全局 CSS 或后端故障不会直接破坏平台。

## 2. 四类文件为什么要分开

| 目录 | 内容 | 是否进入 Cloudflare Pages | 是否可直接运行 |
| --- | --- | --- | --- |
- `src/` | 大厅 TypeScript、页面、路由 | 编译后进入 | 是，作为大厅 |
| `games/` | 自维护源码及不应公开的游戏开发资料 | 否 | 果切需先构建；其余供维护使用 |
| `public/games/` | 完整静态游戏运行包 | 运行文件进入；已登记开发资料会剔除 | 是，通过 iframe |
| `public/games/_shared/` | 跨游戏的公共运行脚本（汉化 bridge、WebRTC 运行时配置、只读网络诊断） | 是 | 由各游戏页面 `<script>` 引入 |
| `server-games/` | 本项目维护的联机数据后端 | 否 | 在 VPS 单独运行 |
| `external-games/` | 第三方游戏简介与外部地址 | 否，只把 JSON 内容编入大厅 | 否，点击后跳转 |
| `game-sources/upstream/` | 上游完整源码归档 | 否 | 不视为发布包 |
| `dist/` | 每次构建生成的静态成品 | 就是部署内容 | 是 |

`public/` 不是普通源码目录。Vite 会把它原样复制，因此访客能看到里面所有文件。把旧 Worker、TypeScript 服务端源码或部署密钥放进去，不只是杂乱，也会破坏安全边界。

## 3. Manifest 是唯一游戏目录

Manifest 的类型定义位于 `src/platform/game-manifest.ts`。生成脚本扫描：

- `public/games/`：已发布的静态/混合游戏；
- `external-games/`：跳转到第三方服务器的游戏；
- `game-sources/rejected/`：只保留说明、不可启动的项目。

数据流如下：

```text
各目录 game.json
  -> scripts/generate-game-catalog.mjs 校验
  -> src/generated/gameCatalog.ts
  -> src/platform/game-catalog.ts
  -> 首页 / 介绍页 / 播放器
```

浏览器不能扫描服务器文件，所以扫描只发生在开发或构建阶段。生成文件禁止手工编辑；旧的 `gameLibrary.ts` 只做 UI 字段映射，不再保存第二份内容。

`presentation` 是玩家可见介绍，`platform` 是维护、许可和启动信息。当前启动类型只有：

```json
{ "kind": "iframe", "entry": "/games/example/index.html" }
{ "kind": "external", "url": "https://game.example.com" }
{ "kind": "none" }
```

`iframe` 的入口必须位于自身 `/games/<id>/` 下；`external` 必须使用 HTTPS；`none` 只用于明确不可运行的项目。

## 4. 路由与静态目录不能重名

平台路由固定为：

- `/library/<id>`：介绍页；
- `/play/<id>`：统一播放器；
- `/vision-lab`、`/third-party-notices`：平台功能页。

运行包固定为 `/games/<id>/...`。例如：

```text
/library/hexgl
  -> /play/hexgl
  -> <iframe src="/games/hexgl/index.html">
```

此前将平台详情也放在 `/games/<id>`，会与 `public/games/<id>/` 的真实目录发生语义冲突。尤其在 Cloudflare Pages 上，静态路径解析和 SPA 回退可能得到不同结果。保留三个清楚的命名空间后，直接刷新介绍页和加载游戏文件不再争抢同一路径。

## 5. iframe 的职责边界

iframe 负责隔离每款游戏的页面环境：

- 游戏保留自己的 HTML、CSS、全局变量、Canvas/WebGL 和资源相对路径；
- 平台只提供返回、重新载入、全屏和加载提示；
- 播放器保留常用的音频、全屏和手柄能力，摄像头/麦克风等敏感权限只按 Manifest 的 `permissions` 加入 iframe；
- 同源游戏可选发送 `YUQING_GAME_READY`，但不需要接入庞大的平台 SDK；
- 暂不添加 `sandbox`，因为它可能破坏存储、音频、全屏、WebRTC 或旧游戏脚本，必须逐款实测后才能收紧。

果切同样走 iframe。其开发源码位于 `games/fruit-party/src/`，`build:fruit-party` 使用临时目录构建，只更新 `public/games/fruit-party/` 中的 HTML、配置和哈希资源。暂停、声音和玩法选择仍属于游戏内部，不由大厅重新实现。

## 6. 后端边界

Cloudflare Pages 不承载 Node、Bun、Go、Colyseus 或常驻 WebSocket 进程。`server-games/` 中的内容不进入静态构建。

果切后端是本仓库当前可直接部署的实现：

```text
server-games/fruit-party/src/server.ts
  ├─ GET  /api/health
  ├─ POST /api/rooms
  ├─ POST /api/rooms/:code/join
  ├─ GET  /api/rooms/:code
  └─ GET  /api/rooms/:code/socket  -> WebSocket upgrade
```

比赛规则和协议位于 `games/fruit-party/src/shared/`，由浏览器客户端和 Node 服务共同编译使用；这是刻意保留的唯一跨边界代码共享。服务器维护权威比分、房间生命周期和重连状态，客户端保持本地画面响应。

当前服务的房间状态保存在单个 Node 进程内。它适合第一阶段单实例 VPS；服务重启会结束现有房间。只有真正需要横向扩容时，才应引入 Redis/共享状态和跨实例广播。

生产环境要求：

- `ALLOWED_ORIGINS` 明确列出 Cloudflare Pages 的完整来源；
- 浏览器只访问 HTTPS/WSS 公网地址；
- Nginx/Caddy 负责证书和 WebSocket Upgrade；
- 裸进程只绑定 VPS 回环地址；容器内可监听 `0.0.0.0`，但 Compose 只映射到宿主机 `127.0.0.1`；
- 健康检查、日志、重启策略和限流由 VPS 运维负责。

## 7. WebSocket 与 WebRTC 的关系

二者不是替代关系：

| 能力 | WebSocket | WebRTC |
| --- | --- | --- |
| 房间/匹配/登录信令 | 适合 | 仍需外部信令 |
| 权威比分与反作弊 | 适合，由服务器裁决 | 不适合只信任点对点客户端 |
| 玩家间低延迟数据 | 可用 | 适合 DataChannel |
| 音视频 | 不是首选 | 适合 |
| 穿透复杂网络 | 走普通 HTTPS/WSS | 常需要 STUN/TURN |

因此推荐的长期结构是：VPS WebSocket 负责房间和 WebRTC 信令；浏览器建立 P2P 连接；直连失败时通过独立 TURN 中继。TURN 通常需要 UDP/TCP 端口和公网 IP，不能当作 Cloudflare Pages 静态资源，也不能只靠一个 WebSocket 反向代理完成。

目前果切使用权威 WebSocket，没有为了“架构看起来完整”强行改成 WebRTC。Der Koloss、PVP Arena 保留各自上游的 WebRTC/PeerJS 协议与游戏逻辑，但信令、STUN、TURN 已经统一到雨晴自建的服务上：

```text
public/games/_shared/yuqing-webrtc.js
  ├─ GET /api/runtime-config          （Cloudflare Function，读 WEBRTC_SERVICE_URL）
  ├─ GET <WEBRTC_SERVICE_URL>/rtc-config  -> 自建 STUN + 短期 TURN 凭据
  └─ WSS <WEBRTC_SERVICE_URL>/peerjs      -> server-games/webrtc-gateway（PeerJS 信令）
                                              server-games/docker-compose.prod.yml 里的 coturn
```

约束与理由：

- 前端只读 Cloudflare 运行时公开配置，源码里不出现 VPS 域名或 IP；
- TURN 凭据由 gateway 用 `TURN_SHARED_SECRET` 现场签发（HMAC-SHA1 + 过期时间），浏览器永远拿不到长期密钥；
- 配置缺失时明确失败，**不保留回退到公共 PeerJS / 公共 STUN 的逻辑**，否则无法判断自建服务是否真的在工作；
- 优先 P2P 直连，直连不通时自动经自建 TURN 中继；
- 生产 HTTPS/WSS 由 `server-games/nginx.example.conf` 反代到 `127.0.0.1:9000`；STUN/TURN 的 `3478` 与中继端口段直接到达 coturn，不经过 Nginx，也不经过 Cloudflare 代理。

`public/games/_shared/yuqing-netdiag.js` 提供 `?debug=network` 的只读诊断面板（含仅调试可用的“强制使用 VPS 中继”），用来在真实网络上区分 P2P 与中继、确认 TURN 是否真的工作。它只读取 `RTCPeerConnection` 状态，不改变任何连接决策。

## 8. 第三方服务器游戏

Suroi、Scribble.rs、TOSIOS 和 OpenFront 的 Manifest 位于 `external-games/`，平台在构建时读取 JSON，展示简介后打开 HTTPS 外部地址。原因是这些项目的客户端和服务端必须保持版本一致，有各自的运行时、数据库或房间协议；仅复制前端文件到 Cloudflare 会产生一个看似能打开、实际上不能联机的残缺版本。它们的整站和服务端都不部署到本项目 VPS。

`game-sources/upstream/` 保存完整上游源码以便许可审查和以后自建，不参与目录扫描后的运行文件校验，也不进入 `dist`。

## 9. 构建与部署数据流

```text
corepack pnpm build:fruit-party
  games/fruit-party/src
  -> public/games/fruit-party（独立静态运行包）

corepack pnpm build
  games/fruit-party/src -> public/games/fruit-party
  game.json -> generated catalog
  public + src -> dist
  -> Cloudflare Pages 文件限制检查

corepack pnpm server:fruit:build
  server-games/fruit-party + games/fruit-party/src/shared
  -> server-games/fruit-party/dist/server.mjs
  -> Docker/VPS
```

Cloudflare Pages 部署命令只上传 `dist/`：

```powershell
corepack pnpm deploy:cloudflare
```

VPS 使用两个服务各自的 Dockerfile 或 `docker-compose.example.yml`，与静态部署完全独立。根目录 `.dockerignore` 会把 `public/`、`dist/` 和上游源码排除在容器构建上下文之外，避免任何静态素材进入 VPS 镜像。部署动作、账号登录、DNS 和证书不由项目构建自动执行。

## 10. 结构守卫

自动检查应持续保证：

- Manifest 唯一、ID/排序不冲突；
- iframe 入口真实存在且在自己的游戏目录；
- `public/games/fruit-party/` 不再出现 TypeScript 源码、Worker 或服务端目录；
- 平台 `src/` 不 import `games/` 或 `server-games/`；
- `dist/` 不包含 TypeScript、CoffeeScript、source map、VPS 服务、外部目录源码和上游仓库；
- Cloudflare Pages 单文件不超过 25 MiB、免费计划站点文件数不超过 20,000。

这些检查证明结构没有重新混在一起，但不能代替行为验收。发布前仍要实际打开首页、介绍页、iframe、果切模式选择、暂停/声音、房间 WebSocket，以及至少一个第三方静态游戏；WebRTC 还需跨网络和 TURN 条件的真实设备测试。

## 11. 新增游戏决策

```text
游戏能否只靠浏览器静态文件完整运行？
  ├─ 能 -> public/games/<id> + iframe Manifest
  └─ 不能
      ├─ 后端由本项目维护 -> games/<id> + server-games/<id> + hybrid Manifest
      ├─ 使用第三方服务器 -> external-games/<id>/game.json + external URL
      └─ 许可或运行条件不允许 -> game-sources/rejected + none
```

新增普通静态游戏时，不修改首页、通用详情页或播放器。只有游戏本身确实需要独特能力时，才新增它自己的构建或服务器代码。

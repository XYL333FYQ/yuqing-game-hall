# 雨晴游戏厅

雨晴游戏厅由三个彼此独立的部分组成：静态游戏平台、可独立运行的游戏包，以及部署在 VPS 的联机服务。大厅只读取每款游戏的 `game.json`，负责介绍、分类和启动；它不直接导入任何游戏玩法代码。

## 快速开始

双击根目录唯一的 `启动雨晴游戏厅.cmd`，脚本会安装缺失依赖、选择可用端口并打开浏览器。它只启动静态平台；果切单人模式可直接玩，好友联机还要另开终端启动 VPS 服务的本地版本：

```powershell
corepack pnpm server:fruit:dev
```

命令行开发：

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

主要页面：

- `/`：游戏厅首页。
- `/library/<id>`：由 `game.json` 生成的游戏介绍页。
- `/play/<id>`：平台播放器；本地游戏在这里通过 iframe 启动。
- `/games/<id>/<entry>.html`：游戏自己的静态运行入口，不是平台路由。
- `/vision-lab`：独立的视觉识别实验室。
- `/third-party-notices`：第三方许可与来源说明。

这里刻意不用 `/games/<id>` 作为平台介绍页。Cloudflare Pages 会把 `/games/hexgl` 识别成真实静态目录，容易与单页应用路由冲突；`/library`、`/play` 和 `/games` 分开后，刷新、iframe 和资源相对路径都有唯一含义。

## 目录职责

```text
src/                         游戏厅前端源码
  portal/                    平台路由
  pages/                     首页、介绍页、播放器等
  platform/                  Manifest 类型、目录读取、公共页面能力
  generated/                 构建时生成的游戏目录，不手工编辑

games/                       自己维护的游戏开发源码
  fruit-party/src/           果切派对源码与共享比赛协议
  sanctuarys-end/            庇护所的开发配置与维护文档
  littlejs-arcade/types/     不进入运行包的类型声明
  hexgl/source/              不进入运行包的 CoffeeScript 原件

public/                      Cloudflare Pages 会公开发布的文件
  games/<id>/                可直接运行的静态游戏包与 game.json
  models/、wasm/             浏览器按需加载的模型和运行时
  legal/                     构建时同步的许可文件

server-games/                只部署到 VPS 的联机数据服务
  fruit-party/               权威房间、比分与 WebSocket
  sanctuarys-end/            在线位置与聊天中继

external-games/              第三方服务器游戏的 JSON 简介与跳转地址

game-sources/upstream/       上游源码归档，只用于审查和同步，不发布
game-sources/rejected/       不允许发布或不采用的项目记录
scripts/                     构建、目录生成和边界检查
tests/                       平台与果切共享逻辑测试
dist/                        可重新生成的 Cloudflare Pages 成品
```

最重要的规则是：

- `public/` 里的每个文件都可能被访客下载，不能放服务端源码、密钥或私有配置。
- `games/` 是开发源码；构建后才把可运行文件写入 `public/games/`。
- `server-games/` 只放本项目维护的联机数据服务，不放静态游戏，也不放第三方跳转资料。
- `external-games/` 只在构建时提供第三方游戏简介与外链，不会部署到 Cloudflare 或 VPS；所需资料会编入大厅前端。
- `game-sources/upstream/` 是完整上游副本，不是可直接发布的游戏包。

## 游戏如何接入

每款游戏只有一份资料来源：`game.json`。构建前，`scripts/generate-game-catalog.mjs` 会扫描约定目录、校验字段，再生成 `src/generated/gameCatalog.ts`。不要手工维护第二份游戏列表。

### 静态游戏

把经过验证的完整运行包放在 `public/games/<id>/`，同目录添加 `game.json`：

```json
{
  "platform": {
    "hosting": "static",
    "launch": {
      "kind": "iframe",
      "entry": "/games/example/index.html"
    }
  }
}
```

平台会生成 `/library/example` 和 `/play/example`。iframe 直接加载 `/games/example/index.html`，游戏自己的 CSS、Canvas、音频、图片和脚本都留在游戏目录内。

### 自带 VPS 后端的游戏

浏览器运行包仍放 `public/games/<id>/`，后端放 `server-games/<id>/`，Manifest 使用 `hosting: "hybrid"`。前端必须通过公开的 `https://` / `wss://` 地址访问 VPS，不能假设 Cloudflare Pages 存在同源 `/api`。

果切派对就是这个结构：

```text
/play/fruit-party
  -> iframe /games/fruit-party/index.html
  -> fruit-party.config.js 中的 HTTPS 服务地址
  -> VPS /api/rooms 与 WebSocket 房间服务
```

本地开发时，果切配置留空会连接 `http://127.0.0.1:8790`；部署到真实域名时留空会直接显示配置错误，避免误请求静态站点。

### 第三方服务器游戏

不能独立静态运行的第三方项目只在 `external-games/<id>/game.json` 保存介绍、上游地址和跳转属性，`launch.kind` 使用 `external`。玩家点击后离开本站，进入对方的服务器；平台不会用 iframe 伪装一个并不存在的本地客户端，也不会把第三方整站放进你的 VPS。

### WebSocket 与 WebRTC

- WebSocket 适合房间、匹配、权威比分和信令。果切当前实际使用 Node + WebSocket。
- WebRTC 适合浏览器之间的低延迟点对点数据或音视频，但仍需要信令服务；复杂网络下还需要 STUN/TURN。
- Cloudflare Pages 只发布静态文件。VPS 负责 WebSocket/信令；TURN 通常还需要单独开放 UDP/TCP 端口。
- 当前 Der Koloss 和 PVP Arena 保留各自的 WebRTC/PeerJS 实现；这不等于项目已经拥有统一的自建 TURN 服务。
- 孤堡尸潮的 WebRTC 语音通过 Manifest 单独声明麦克风权限，其他 iframe 游戏不会因此获得麦克风能力。

## 构建与验证

```powershell
# 单独更新果切浏览器运行包（开发时可选）
corepack pnpm build:fruit-party

# 类型、Manifest、静态入口和项目边界
corepack pnpm check

# 平台/游戏逻辑与真实 WebSocket 服务测试
corepack pnpm test:all

# 重新构建自维护游戏并生成 Cloudflare Pages 目录
corepack pnpm build

# 构建果切 VPS 服务
corepack pnpm server:fruit:build
```

`build` 会先更新自维护游戏的浏览器运行包，再生成静态 `dist/`。随后会移除已登记的旧开发文档和工具目录；边界检查会拒绝 TypeScript、CoffeeScript、source map、VPS 代码或上游源码进入成品，并继续检查 Cloudflare Pages 的文件数和单文件大小限制。许可与运行资源始终保留。它不会打包或部署 VPS 服务。

## 部署

Cloudflare Pages：

```powershell
corepack pnpm deploy:cloudflare
```

该命令构建后执行 `wrangler pages deploy dist --project-name yuqing-game-hall`。执行前确认 Wrangler 登录账号、Pages 项目名和域名正确；项目不会自动替你修改 DNS 或登录第三方账号。

果切 VPS 服务：

```bash
docker compose -f server-games/docker-compose.example.yml up -d fruit-party
```

先把示例域名、证书路径和 `ALLOWED_ORIGINS` 改成真实值，再参考 `server-games/nginx.example.conf` 配置 HTTPS/WebSocket 反向代理。最后把 `public/games/fruit-party/fruit-party.config.js` 中的地址设为该服务域名，并重新构建静态站点。

## 许可与来源

第三方运行包、上游归档和公开许可文件承担不同职责，不能因为代码能运行就推断它可以商用或重新分发。详细记录见 `SOURCE_AUDIT.md`、`THIRD_PARTY_NOTICES.md` 和 `licenses/`；构建时会把它们同步到 `/legal/`。

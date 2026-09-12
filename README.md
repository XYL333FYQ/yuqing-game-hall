# 雨晴游戏厅

给小人机做的小游戏联机网站：一个可部署的网页游戏大厅，支持本地静态游戏、部分联机游戏，以及第三方游戏跳转。

---

## 你可以用它做什么

- 在一个统一首页里展示多款小游戏；
- 直接在浏览器里玩本地静态游戏；
- 为特定游戏接入独立 VPS 联机服务（WebSocket/房间/比分）；
- 为暂时无法静态部署的第三方游戏提供资料页与外部跳转。

主要页面：

- `/`：游戏厅首页
- `/library/<id>`：游戏介绍页
- `/play/<id>`：平台播放器页面
- `/games/<id>/<entry>.html`：游戏自己的静态入口（非平台路由）

---

## 快速开始（Windows 一键）

在项目根目录双击：

- `启动雨晴游戏厅.cmd`

该脚本会尝试安装依赖、选择可用端口并打开浏览器。默认启动的是**静态平台**：

- 单机/静态内容可直接体验；
- 需要 VPS 后端的联机功能，需要你先完成“联机服务部署与配置”。

---

## 命令行开发

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

可选：单独启动果切联机服务开发模式

```powershell
corepack pnpm server:fruit:dev
```

---

## 部署指南

> 推荐拆分为两部分：
> 1) Cloudflare Pages 部署静态大厅；
> 2) VPS 部署联机服务（如果你需要联机）。

### 1) 部署静态大厅（Cloudflare Pages）

```powershell
corepack pnpm deploy:cloudflare
```

此命令会构建并执行 `wrangler pages deploy dist --project-name yuqing-game-hall`。

部署前请确认：

1. 已登录 Wrangler；
2. Cloudflare Pages 项目名正确；
3. 绑定域名与 DNS 已在 Cloudflare 侧配置完成（命令不会自动改 DNS）。

---

### 2) 部署联机服务（VPS / Docker）

以果切服务为例：

```bash
docker compose -f server-games/docker-compose.example.yml up -d fruit-party
```

部署前至少完成这几项：

1. 把示例域名改成你的真实域名；
2. 配置 HTTPS 证书路径；
3. 设置 `ALLOWED_ORIGINS` 为你的前端站点域名；
4. 按 `server-games/nginx.example.conf` 配置反向代理（含 WebSocket）。

部署后，记得把前端配置文件（如 `public/games/fruit-party/fruit-party.config.js`）中的服务地址改为你的 `https://` / `wss://` 正式地址。

---

## 联机功能说明（重要）

- Cloudflare Pages 只托管静态文件，不提供你的自定义 WebSocket 房间后端；
- 联机游戏请使用独立 VPS 服务，并通过 `https://` / `wss://` 给前端访问；
- 本地开发允许连接 `127.0.0.1`，但生产环境缺省配置会直接报错，避免误连静态站点。

---

## 构建与检查

```powershell
# 可选：先更新果切浏览器运行包
corepack pnpm build:fruit-party

# 类型、Manifest、静态入口和边界检查
corepack pnpm check

# 平台/游戏逻辑与 WebSocket 服务测试
corepack pnpm test:all

# 构建平台并生成 dist/
corepack pnpm build

# 构建果切 VPS 服务
corepack pnpm server:fruit:build
```

---

## 新增/接入游戏（简版）

平台通过每款游戏的 `game.json` 生成目录。

- **静态游戏**：放到 `public/games/<id>/`，并提供可运行入口与 `game.json`；
- **联机游戏（混合）**：浏览器运行包放 `public/games/<id>/`，后端服务放 `server-games/<id>/`；
- **第三方服务器游戏**：在 `external-games/<id>/game.json` 填资料与跳转，不当作本站自托管服务。

---

## 目录说明（面向部署）

- `src/`：游戏厅前端源码
- `public/`：会被公开发布的静态文件（访客可直接下载）
- `games/`：自维护游戏开发源码
- `server-games/`：仅部署到 VPS 的联机后端服务
- `external-games/`：第三方服务器游戏资料（构建时读入）
- `dist/`：构建产物（用于 Cloudflare Pages）

请注意：不要把密钥、私有配置、服务端源码放进 `public/`。

---

## 常见问题（FAQ）

### 1. 为什么我部署到 Pages 后，联机还是失败？
因为 Pages 是静态托管，不会替你运行游戏房间服务。请单独部署 VPS 联机后端，并正确配置 `wss://`。

### 2. 本地能联机，线上不行？
通常是这几类问题：

- 前端仍指向本地地址；
- 线上没配 HTTPS/WSS；
- `ALLOWED_ORIGINS` 未包含你的前端域名；
- 反向代理未转发 WebSocket Upgrade 头。

### 3. 我可以把第三方在线游戏直接当作本站联机服务吗？
不建议。第三方服务可用性与协议不受本项目控制，应通过 `external-games` 模式做资料与跳转说明。

---

## 许可与来源

第三方运行包、上游归档与许可文件请分别遵循仓库中的审计与声明文档（如 `SOURCE_AUDIT.md`、`THIRD_PARTY_NOTICES.md` 等）。
请勿因为“代码能跑”就默认拥有再分发或商用授权。

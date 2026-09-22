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

**部署配置的唯一来源是 GitHub。** 你只需要维护 GitHub 上的 Variables / Secrets，
`push main` 之后由 GitHub Actions 把配置同步到 Cloudflare 与 VPS——
不需要（也不应该）长期手动维护 VPS 上的 `.env` 或 Cloudflare 的运行时变量。

```text
修改代码 / 修改 GitHub 配置
  → push main（只改配置时用 Actions 页面的 Run workflow）
  → deploy-cloudflare.yml：同步运行时变量 → 构建 → 部署 Pages
  → deploy-vps.yml：生成 .env → 原子替换到 VPS → pull/up → 健康检查 + 协议 smoke test
```

> 注意：改 Variables / Secrets **不会**触发 push 事件。改完配置后请到
> Actions 页面手动 Run workflow，或者推一个任意提交。

### 1) 部署静态大厅（Cloudflare Pages）

由 `.github/workflows/deploy-cloudflare.yml` 自动完成。它会在部署**之前**
把下面三个公开地址同步到 Pages 项目的运行时环境配置，再执行
`wrangler pages deploy dist --project-name=yuqing-game-hall`。

同步是「先读、合并、再写」：只新增/覆盖这三个键，你在 Cloudflare 上手动加过的
其它变量会原样保留。想本地手动部署也可以用 `corepack pnpm deploy:cloudflare`，
但那样不会同步运行时变量。

### 2) 部署联机服务（VPS / Docker）

由 `.github/workflows/deploy-vps.yml` 自动完成。每次执行都会：

1. 从 GitHub Variables / Secrets 生成生产 `.env`（缺任何一项就直接失败并报出名字）；
2. 写到 runner 的临时目录（不在仓库里），权限 `600`；
3. `scp` 成 `.env.incoming`，在 VPS 上 `mv` **原子替换**成 `.env`——compose 永远读不到写了一半的配置；
4. 比对本地与 VPS 的 `sha256`，确认落盘内容一致；
5. `docker compose pull` / `up -d`，然后做健康检查与协议 smoke test。

会起来四件事：果切房间服务、庇护所中继、WebRTC gateway（PeerJS 信令 + 签发短期 TURN 凭据）、coturn（自建 STUN + TURN）。

本地想跑一遍示例（仅用于调试，正式环境请走 Actions）：

```bash
cd server-games
cp .env.example .env
docker compose -f docker-compose.example.yml up -d --build
```

部署后用同一套协议 smoke test 验收，而不是只看进程是否活着：

```bash
corepack pnpm server:webrtc:test          # gateway 自身：/health、/rtc-config、/peerjs/id、Origin 拒绝
corepack pnpm server:webrtc:smoke         # 同上，但把真实进程拉起来跑一遍
corepack pnpm server:sanctuary:test       # 两个真实客户端：welcome / state / chat / leave
corepack pnpm server:turn:check turn.example.com 3478   # 从外部验证 STUN/TURN 真的可达
corepack pnpm server:config:test          # .env 生成与 Cloudflare 同步逻辑的单元测试
```

---

## 部署配置清单

### A. GitHub Variables（Settings → Secrets and variables → Actions → Variables）

非敏感，明文可见。

| 变量 | 用途 | 示例 |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | 允许访问 VPS 后端的前端来源，多个用英文逗号分隔 | `https://games.example.com` |
| `TURN_PUBLIC_HOST` | 自建 STUN/TURN 对外域名 | `turn.example.com` |
| `TURN_EXTERNAL_IP` | VPS 公网 IPv4（NAT 后必须填） | `203.0.113.10` |
| `TURN_REALM` | coturn realm，通常等于 `TURN_PUBLIC_HOST` | `turn.example.com` |
| `TURN_PORT` | coturn 监听端口 | `3478` |
| `TURN_MIN_PORT` | 中继端口段下界 | `49160` |
| `TURN_MAX_PORT` | 中继端口段上界 | `49200` |
| `TURN_CREDENTIAL_TTL_SECONDS` | 短期 TURN 凭据有效期（300–86400） | `3600` |
| `FRUIT_PARTY_SERVICE_URL` | 果切房间服务公开地址 | `https://rooms.example.com` |
| `SANCTUARY_RELAY_URL` | 庇护所中继公开地址 | `wss://sanctuary.example.com/socket` |
| `WEBRTC_SERVICE_URL` | 自建 PeerJS 信令 + STUN/TURN 入口，**必须是不带路径的主机根地址** | `https://rtc.example.com` |

后三项留空是合法的：代表该服务还没部署，Actions 会把 Cloudflare 上对应变量清空，
游戏会显示「联机服务未配置」。这是明确的降级状态，不是残缺服务。

### B. GitHub Secrets（同一页面的 Secrets）

| Secret | 用途 |
| --- | --- |
| `TURN_SHARED_SECRET` | gateway 与 coturn 共用的随机密钥，至少 32 位。生成：`openssl rand -hex 32` |
| `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` | SSH 到 VPS 部署（已有） |
| `GHCR_USERNAME` / `GHCR_READ_TOKEN` | VPS 拉取镜像（已有） |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | Pages 部署与运行时变量同步（已有） |

`TURN_SHARED_SECRET` 是唯一的新增项。它只存在于 GitHub Secrets 与 VPS 的 `.env`，
浏览器永远拿不到——前端每次只取 gateway 现场签发的短期临时凭据。

### C. 仍然必须手动做一次的事（DNS / 防火墙 / 证书）

这些不属于「每次部署要改的配置」，但首次上线必须手动完成：

1. **DNS**：`rtc.example.com` → VPS IP；`turn.example.com` → VPS IP。
   两条都必须**关闭 Cloudflare 代理（灰云）**：TURN 不走 HTTP，WebSocket 也不希望被改写路径。
2. **防火墙**：放行 `3478/tcp`、`3478/udp`、`49160–49200/udp`（443 用于 Nginx，应已有）。
3. **HTTPS 证书**：为三个后端主机各申请一份（`nginx.example.conf` 里有示例路径）。
4. **Nginx**：按 `server-games/nginx.example.conf` 配置；其中 `rtc.example.com` 必须占用整站根路径。
5. **Cloudflare Pages 项目**：项目名与 `PAGES_PROJECT`（默认 `yuqing-game-hall`）一致；
   如果项目还不存在，同步步骤会跳过并给出警告，`wrangler` 那步会自己报错。

### D. Cloudflare API Token 权限

**不需要新增权限。** 运行时变量同步调用的是
`PATCH /accounts/{account_id}/pages/projects/{project_name}`，
它要求的 `Cloudflare Pages: Edit` 与 `wrangler pages deploy` 所需权限相同，
现有 `CLOUDFLARE_API_TOKEN` 已经具备。

如果同步步骤返回 403，Actions 日志会直接指出缺哪项权限；此时到
Cloudflare Dashboard → My Profile → API Tokens 确认该 token 的权限里包含
Account 级别的 **Cloudflare Pages: Edit**。

---

## 联机功能说明（重要）

- Cloudflare Pages 只托管静态文件，不提供你的自定义 WebSocket 房间后端，也不跑信令；
- 联机游戏请使用独立 VPS 服务，并通过 `https://` / `wss://` 给前端访问；
- **WebRTC 游戏（孤堡尸潮、像素竞技场）只连雨晴自建的 PeerJS 信令 / STUN / TURN**。配置缺失时会明确提示“联机服务未配置”，不会偷偷回退到公共 PeerJS 服务，否则无法判断自建服务是否真的在工作；
- TURN 凭据是 gateway 现场签发的短期临时凭据，永久密钥只存在于 VPS 的 `.env` 里；
- 本地开发允许连接 `127.0.0.1`，但生产环境缺省配置会直接报错，避免误连静态站点。

### Cloudflare Pages 运行时变量

这三个公开地址**不要**在 Cloudflare 后台手动维护：在 GitHub Variables 里设置
（见上面的部署配置清单 A），`deploy-cloudflare.yml` 会在每次部署前自动同步过去。

如果你确实想临时覆盖某个值，可以在 Pages 项目的 Settings → Environment variables 里改，
但下一次部署就会被 GitHub 的值重新覆盖——GitHub 是唯一来源。

`WEBRTC_SERVICE_URL` 必须是独立主机的根地址，不能带路径前缀。

---

## 构建与检查

```powershell
# 可选：先更新果切浏览器运行包
corepack pnpm build:fruit-party

# 类型、Manifest、静态入口、边界与文本编码检查（含三个 VPS 服务的语法检查）
corepack pnpm check

# 平台/游戏逻辑测试 + 果切服务测试 + 庇护所中继协议 smoke test
corepack pnpm test:all

# WebRTC gateway 的协议 smoke test（单独跑，因为要占用端口）
corepack pnpm server:webrtc:test

# 构建平台并生成 dist/
corepack pnpm build

# 构建果切 VPS 服务
corepack pnpm server:fruit:build
```

### 联机问题排查

在游戏地址后面加 `?debug=network`（例如 `/games/der-koloss/index.html?debug=network`）会打开只读网络诊断面板。WebRTC 游戏（孤堡尸潮 / 像素竞技场）显示：联机服务器、找到对方、P2P 直连、VPS TURN 中继、最终连接、当前线路、延迟；WebSocket 游戏（果切 / 庇护所）复用同一个面板，换成联机服务器、房间/队友、找到对方、最终连接这些行。面板里还有一个仅调试模式可用的“强制使用 VPS 中继”，用来确认 TURN 是否真的能中继。普通玩家看不到这个面板。

### 中文变成乱码了怎么办

本仓库所有源码与配置文本文件都必须是**严格 UTF-8**。Windows 上用系统 ANSI（GBK）代码页读写文件会造成「UTF-8 → 按 GBK 解码 → 再按 GBK 写回」的双重编码乱码，这种损坏不会让任何测试失败，只有别人打开文件时才看得到。

`corepack pnpm check` 里的 `check:encoding` 会逐字节校验并直接报出问题文件。修复方式是**整体重写为 UTF-8**，不要对乱码字节做局部替换（那些字符往往已经丢了 `。`、`–`、反引号这类字节，反向变换无法还原）：

```js
// 显式按 UTF-8 落盘，不要依赖编辑器的“默认编码”
writeFileSync(file, text, { encoding: "utf8" });
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

### 3. WebRTC 游戏（孤堡尸潮 / 像素竞技场）提示“联机服务未配置”？
说明 Cloudflare Pages 还没有设置 `WEBRTC_SERVICE_URL`，或者 `webrtc-gateway` 没有起来。这是刻意设计：宁可明确报错，也不偷偷回退到公共 PeerJS。用 `?debug=network` 面板可以看到是哪一步失败。

### 4. 能连上但一直很卡 / 连不上？
多半是 P2P 打不通又没有可用的 TURN。检查 `3478/tcp`、`3478/udp` 与 `49160–49200/udp` 是否在 VPS 防火墙放行，以及 `TURN_PUBLIC_HOST` 的 DNS 是否指向这台 VPS；然后用 `corepack pnpm server:turn:check <turn-host> 3478` 从外部确认。

### 5. 我可以把第三方在线游戏直接当作本站联机服务吗？
不建议。第三方服务可用性与协议不受本项目控制，应通过 `external-games` 模式做资料与跳转说明。

---

## 许可与来源

第三方运行包、上游归档与许可文件请分别遵循仓库中的审计与声明文档（如 `SOURCE_AUDIT.md`、`THIRD_PARTY_NOTICES.md` 等）。
请勿因为“代码能跑”就默认拥有再分发或商用授权。

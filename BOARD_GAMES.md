# 新增棋牌与换 VPS

本批按“好友联机优先，也能自己玩”接入四个大厅入口。游戏页面和素材由 Cloudflare Pages 提供，后端只处理房间、规则或连接；游戏代码里没有生产 VPS 的 IP。

入口延续当前大厅的电脑端游玩限制。

| 游戏 | 好友玩法 | 自己玩 | 后端 |
| --- | --- | --- | --- |
| 斗地主 | 房间码邀请，空位 AI 补齐 | 离线 AI，经典 / 双人 / 组队及变体 | 复用现有 WebRTC gateway + coturn，无专用牌局服务 |
| 掼蛋 | 四人固定对家，私人房号，观战 | 一人加三个 AI；仍需要服务器 | `server-games/card-room`，8002 |
| 四人麻将 | 私人房号、吃碰杠胡、观战 | 一人加三个 AI；仍需要服务器 | 与掼蛋共用 card-room |
| 五子棋 | 相同房号，黑白两人，其他人观战 | 同一电脑轮流落子，无电脑 AI | `server-games/gobang`，8792 |

掼蛋与麻将使用上游基础规则，不包括所有地区变体。牌房采用访客和内存模式，无需论坛账号、MySQL 或额外密钥；重启后房间和历史战局消失。斗地主由房主浏览器主持，房主离开会中断牌局。

## GitHub 配置

在 **Settings → Secrets and variables → Actions → Variables** 新增：

| 变量 | 示例 | 用途 |
| --- | --- | --- |
| `CARD_ROOM_SERVICE_URL` | `https://cards.example.com` | 掼蛋和麻将的独立 HTTPS 主机根地址，不能带路径 |
| `GOBANG_SERVICE_URL` | `wss://gobang.example.com/socket` | 五子棋 WebSocket 地址，必须包含实际 `/socket` 路径 |

斗地主继续使用原有 `WEBRTC_SERVICE_URL`，例如 `https://rtc.example.com`。`ALLOWED_ORIGINS` 包含游戏厅的完整来源，例如 `https://games.example.com`。

`deploy-cloudflare.yml` 将这些公开地址同步到 Pages；浏览器通过 `/api/runtime-config` 读取。生产地址留空时显示未配置，不回退公共服务。本地 localhost 调试的牌房 / 五子棋默认连接 8002 / 8792。

`deploy-vps.yml` 已增加两个镜像、Compose 服务、健康检查和双客户端协议验收。首次在 VPS 上配置 `cards`、`gobang` 域名的 DNS、HTTPS 证书和 Nginx，示例在 `server-games/nginx.example.conf`。8002 和 8792 只绑定 VPS 的 127.0.0.1；公网经 443 的 HTTPS/WSS 代理访问。

## 换 VPS 的实际步骤

1. 新 VPS 安装 Docker、Compose 和 Nginx，准备部署用户与 SSH 密钥，并能访问 GHCR。
2. 在 GitHub Secrets 更新 `VPS_HOST`、`VPS_USER`、`VPS_SSH_KEY`，Variables 更新 `TURN_EXTERNAL_IP`。
3. 将现有后端域名的 DNS 指向新 IP，在新机器安装证书和 Nginx 配置，放行 443 和 TURN 端口。
4. 手动运行 **Deploy VPS Backends**。首次或正常部署时 `image_sha` 留空；工作流按当前 Git 提交号构建镜像。通过验收后，VPS 与 GHCR 自动保留当前版和上一版。要回滚时，在同一工作流的 `image_sha` 输入框填写要恢复的 40 位小写提交号。地址域名不变时，游戏前端无需修改。
5. 如果后端域名也变了，修改相应 `*_SERVICE_URL` 后手动运行 Cloudflare 部署工作流。

这两项新地址可以分别指向不同机器。但当前 VPS 工作流一次部署到一个 `VPS_HOST`；将各服务自动分散部署到多个 VPS 需要另行扩展。内存模式没有历史数据要迁移，换机器会开始新的房间。

## 新游戏为什么不总是只加 JSON

静态游戏准备好可运行的 HTML / JS / 素材以后，增加 `public/games/<id>/game.json` 就能注册到大厅。JSON 只描述游戏和入口，不会自动安装任意后端。新游戏有专用服务器时，还需接入后端镜像、Compose 和运行时服务地址，本批的两个服务就是这样接入的。

## 来源与本地改动

| 原项目 | 固定版本 | 本批改动 |
| --- | --- | --- |
| [doudizhu-online](https://github.com/DavidWang1231/doudizhu-online) · MIT | `8d750b58ea17667573709401d6c882a8d2392da7` | 本地 PeerJS、现有自建信令 / TURN、失败提示，移除 PWA 缓存 |
| [CardRoomPro](https://github.com/TypeThe0ry/CardRoomPro) · MIT | `372c4954ad372f683594ff8a220704b2be924886` | 页面 / 后端拆分，访客内存模式，地址配置及来源限制，自绘扑克；弹窗更新为 MIT Layer 3.5.1 |
| [gobang](https://github.com/HullQin/gobang) · MIT | `eae97a81fc449ce8f05daf89db67f4d9b3914d8a` | 保留 SVG 棋盘，Node 房间协议实现，服务端回合 / 胜负校验，房号改为查询参数，修复两侧连五判断 |

许可证随运行包保留，第三方组件见 `THIRD_PARTY_NOTICES.md`。上游下载归档在被 Git 忽略的 `game-sources/upstream`，不参与部署。封面、扑克图案和地主标识为本项目自绘，没有采用上游示例图片。

## 验证命令与边界

```powershell
corepack pnpm check
corepack pnpm test
corepack pnpm server:config:test
corepack pnpm server:board:test
corepack pnpm build
```

棋牌测试包括 AI 完整对局、历史隐私、真人 / 观众重连、房主管理与真实双客户端房间。五子棋测试包括非法回合、重复落子、观众、连五和重连。斗地主保留上游八组模式、每组 120 局 AI 模拟。

本地浏览器验收不能代替新 VPS 的 Docker 构建、公网 DNS / TLS / TURN 和不同网络好友测试。新 VPS 尚未部署时，不把本地接入描述为已上线。

本轮本地验证已通过：类型 / 边界检查与生产构建、102 项大厅测试、51 项配置测试、新棋牌后端测试、斗地主 960 局模拟，以及四款游戏的实际浏览器操作。掼蛋 / 麻将使用两位真人加两位 AI 建房并出牌；斗地主验证断网 AI 和两位真人加 AI；五子棋验证同屏连五、中心落子、好友同步和刷新恢复。大厅搜索“棋牌”可找到四个入口，均能在 iframe 内启动。

两个后端也已使用 `pnpm deploy --prod` 的独立依赖包启动，并通过同一双客户端协议验收。工作流 / Compose YAML 和工作流 shell 语法通过检查。本机没有 Docker，尚未实际构建 Linux 镜像，也未部署到 VPS 或完成公网 TURN 验收。

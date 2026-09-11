# VPS 联机数据服务

这个目录只放联机数据处理：HTTP API、WebSocket 房间、中继，以及未来可能加入的 WebRTC 信令/TURN 配置。它不保存或提供游戏 HTML、JavaScript、图片、音频、模型等静态资源；这些内容全部由 Cloudflare Pages 的 `dist/` 提供。

```text
Cloudflare Pages                         VPS
大厅 + /games 下的静态运行包  --HTTPS--> API
浏览器中的游戏               ---WSS---> 房间/比分/状态中继
浏览器 A                      --WebRTC-> 浏览器 B
                                   \----> VPS 信令/TURN（需要时）
```

## 当前可直接部署的服务

- `fruit-party/`：权威房间、比赛规则、比分和重连，Node + WebSocket。
- `sanctuarys-end/`：只转发在线位置与聊天，不处理战斗和资源，Node + WebSocket。

复制示例配置并修改域名：

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d --build
docker compose ps
```

两个端口都只绑定到 VPS 的 `127.0.0.1`，公网通过 `nginx.example.conf` 的 HTTPS/WSS 反向代理访问。`ALLOWED_ORIGINS` 必须是 Cloudflare 游戏厅的完整来源，例如 `https://games.example.com`。

## WebRTC 边界

WebRTC 的点对点数据和语音发生在浏览器之间，但建立连接仍需信令；复杂 NAT 下还需要 TURN 中继。推荐把信令和 TURN 放在 VPS，静态游戏配置只包含公开的 WSS/STUN/TURN 地址。TURN 凭据应由短期 API 签发，不能硬编码进 `public/`。

当前项目没有统一自建的 WebRTC 信令/TURN 服务。Der Koloss 与 PVP Arena 保留各自上游实现；在跨运营商网络和 TURN 失败回退完成实测前，不应宣称统一 WebRTC 基础设施已经上线。

本目录的脚本不会登录 VPS、修改防火墙、申请证书或改 DNS。正式上线仍需在目标服务器进行健康检查、WSS 握手、双客户端房间和重连验收。

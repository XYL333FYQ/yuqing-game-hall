# WebRTC gateway

这个服务在同一 HTTPS/WSS 入口提供：

- `/peerjs`：PeerJS 信令（HTTP `GET /peerjs/id`、`GET /peerjs/peers` 与 WebSocket）；
- `GET /rtc-config`：短期 TURN REST API 凭据和自建 STUN/TURN 地址；
- `GET /health`：服务健康状态（含 TURN 主机与端口，方便确认部署连到了哪台机器）。

`TURN_SHARED_SECRET` 只存在于 gateway 与 coturn 的 VPS 环境中。浏览器每次取得带过期时间的 HMAC-SHA1 临时凭据（`<过期时间>:<随机串>`），不保存永久 TURN 用户名或密码。

## 挂载位置不能随便改

`peer@1.x` 的 `ExpressPeerServer` 返回的应用内部自带 `/:key/id` 前缀，而且它的 WebSocket 路径是 `<config.path>/peerjs`。因此 gateway **必须挂在站点根路径**上：

```js
app.use(ExpressPeerServer(httpServer, { path: "/" }));   // ✅
app.use("/peerjs", ExpressPeerServer(httpServer, { path: "/" }));  // ❌ /peerjs/id 会 404
```

客户端会拼成 `<path>peerjs/id`（HTTP）与 `<path>peerjs`（WebSocket），所以 `/rtc-config` 返回的 `peer.path` 恒为 `"/"`。挂载错了的后果很隐蔽：WebSocket 仍然连得上，但所有不带固定 ID 的 `new Peer()` 都拿不到 ID。`tests/gateway.smoke.test.js` 里有一条断言专门守这个。

## 本地运行与测试

本地启动前复制 `.env.example` 中的变量，然后运行：

```text
corepack pnpm server:webrtc:start
corepack pnpm server:webrtc:check   # 语法检查
corepack pnpm server:webrtc:test    # 进程内：/health、/rtc-config、凭据 HMAC、Origin 拒绝
corepack pnpm server:webrtc:smoke   # 拉起真实进程跑一遍协议断言
```

对已经在跑的部署做验收时，把地址指过去即可，断言完全一致：

```text
WEBRTC_GATEWAY_URL=http://127.0.0.1:9000 WEBRTC_GATEWAY_ORIGIN=https://games.example.com \
  corepack pnpm server:webrtc:smoke
```

`peer@1.0.2` 的 PeerServer 会启动两个自我重排的 `setTimeout`（连接存活检查与消息队列清理），且没有对外暴露停止方法，所以测试脚本用 `--test-force-exit` 收尾。生产环境靠 `SIGTERM` 处理函数里的 `process.exit(0)` 退出。

## 生产部署

生产环境由 `server-games/docker-compose.prod.yml` 启动。公网 HTTPS/WSS 由 `server-games/nginx.example.conf` 反向代理到 `127.0.0.1:9000`，并且必须占用整站根路径；STUN/TURN 的 `3478/tcp+udp` 和中继端口范围直接到达 coturn，不经过 Nginx 或 Cloudflare 代理。

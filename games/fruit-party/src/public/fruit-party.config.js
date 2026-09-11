// 上线前把 multiplayerServiceUrl 改成果切 VPS 服务的公开 HTTPS 地址。
// 仅 localhost/127.0.0.1 开发环境允许留空，并自动连接 http://127.0.0.1:8790。
window.FRUIT_PARTY_CONFIG = window.FRUIT_PARTY_CONFIG || {
  multiplayerServiceUrl: "",
};

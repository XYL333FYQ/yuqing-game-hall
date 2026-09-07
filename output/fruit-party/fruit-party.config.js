// 独立部署时，把 multiplayerServiceUrl 改成果切多人 Worker 的公开地址。
// 留空表示使用当前网站同源的 /api；平台托管时也可以覆盖这个全局配置。
window.FRUIT_PARTY_CONFIG = window.FRUIT_PARTY_CONFIG || {
  multiplayerServiceUrl: "",
};

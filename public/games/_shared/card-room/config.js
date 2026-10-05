// Service addresses are supplied by GitHub -> Pages runtime configuration.
window.YUQING_CARD_ROOM_SERVICE_URL = '';
window.YUQING_CARD_ROOM_READY = (async () => {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  let configured = '';
  try {
    const response = await fetch('/api/runtime-config', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (response.ok) configured = (await response.json()).cardRoomServiceUrl || '';
  } catch { /* Local Vite does not run Pages Functions. */ }
  if (!configured && local) configured = 'http://127.0.0.1:8002';
  if (!configured) throw new Error('棋牌联机服务未配置，请稍后重试。');
  const address = new URL(configured);
  if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password || address.search || address.hash || address.pathname !== '/') {
    throw new Error('棋牌联机地址无效，请联系管理员。');
  }
  if (!local && address.protocol !== 'https:') throw new Error('棋牌联机服务需要 HTTPS。');
  window.YUQING_CARD_ROOM_SERVICE_URL = address.origin;
  return address.origin;
})();
// The game UI subscribes later, after its own scripts have loaded.
window.YUQING_CARD_ROOM_READY.catch(() => {});

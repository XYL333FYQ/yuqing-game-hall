window.YUQING_GOBANG_READY = (async () => {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  let configured = '';
  try {
    const response = await fetch('/api/runtime-config', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (response.ok) configured = (await response.json()).gobangServiceUrl || '';
  } catch { /* Local Vite does not run Pages Functions. */ }
  if (!configured && local) configured = 'ws://127.0.0.1:8792/socket';
  if (!configured) throw new Error('五子棋联机服务未配置，可以先玩同屏双人。');
  const address = new URL(configured);
  if (!['ws:', 'wss:'].includes(address.protocol) || address.username || address.password || address.search || address.hash) {
    throw new Error('五子棋联机地址无效，请联系管理员。');
  }
  if (!local && address.protocol !== 'wss:') throw new Error('五子棋联机服务需要 WSS。');
  return address.href;
})();
window.YUQING_GOBANG_READY.catch(() => {});

const NET = {
  ws: null, id: 0, connected: false, name: '', remotes: new Map(), sendT: 0,
  // 复用公共只读诊断框架（?debug=network）。WebSocket 游戏没有 ICE，
  // 所以把默认的 P2P/TURN 行换成中继、队友状态与聊天，语义更准确。
  diag: (() => {
    const api = window.YuqingNetDiag;
    if (api && api.enabled) {
      api.define([
        { key: 'relay', label: '中继服务器' },
        { key: 'connected', label: '已连接' },
        { key: 'peers', label: '队友状态' },
        { key: 'chat', label: '聊天消息' }
      ]);
    }
    return {
      report(key, status, detail) { if (api) api.report(key, status, detail); },
      note(text) { if (api) api.note(text); }
    };
  })(),
  async connect(host, port, name) {
    this.name = (name || 'Hero').slice(0, 14);
    try { await window.SANCTUARY_CONFIG_READY; } catch (_) { }
    const configured = String(window.SANCTUARY_CONFIG && window.SANCTUARY_CONFIG.relayUrl || '').trim();
    const address = configured || host;
    if (!address) { this.status('请输入中继地址'); return; }
    // Tear down any prior socket first, or a repeat Connect orphans it — its handlers keep firing and its
    // remote ghosts leak. Null the handlers before close() so the old socket's onclose can't clobber new state.
    if (this.ws) { try { this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null; this.ws.close(); } catch (_) { } }
    this.clearRemotes(); this.connected = false;
    try {
      const explicitProtocol = /^wss?:\/\//i.test(address);
      const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
      const socketUrl = new URL(explicitProtocol ? address : protocol + address + ':' + (port || 8787));
      if (socketUrl.protocol !== 'ws:' && socketUrl.protocol !== 'wss:') throw new Error('unsupported protocol');
      this.ws = new WebSocket(socketUrl.href);
    } catch (e) { this.status('中继地址格式不正确'); this.diag.report('relay', 'fail', '地址格式不正确'); return; }
    this.status('Connecting…');
    this.diag.report('relay', 'pending');
    this.diag.note(configured ? '中继地址来自 Cloudflare 运行时配置' : '中继地址来自本地输入');
    this.ws.onopen = () => {
      this.connected = true; this.status('Connected — adventuring together'); this.refreshUI();
      this.diag.report('relay', 'ok'); this.diag.report('connected', 'ok');
    };
    this.ws.onclose = () => {
      this.connected = false; this.clearRemotes(); this.status('Disconnected'); this.refreshUI();
      this.diag.report('connected', 'fail', '连接已断开'); this.diag.report('peers', 'fail');
    };
    this.ws.onerror = () => {
      this.status('Connection failed (is the server running & port open?)');
      this.diag.report('relay', 'fail', '无法连接中继');
    };
    this.ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (_) { return; } this.onMsg(m); };
  },
  disconnect() { if (this.ws) { try { this.ws.close(); } catch (_) { } } this.ws = null; this.connected = false; this.clearRemotes(); this.refreshUI(); this.status('Not connected'); this.diag.report('connected', 'fail', '已手动断开'); },
  send(o) { if (this.connected && this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(o)); } catch (_) { } } },
  onMsg(m) { if (m.t === 'welcome') { this.id = m.id; this.diag.report('connected', 'ok', '已分配 id ' + m.id); } else if (m.t === 'state') { this.upsert(m); this.diag.report('peers', 'ok', this.remotes.size + ' 位队友'); } else if (m.t === 'leave') { this.removeRemote(m.id); this.diag.report('peers', this.remotes.size ? 'ok' : 'pending', this.remotes.size + ' 位队友'); } else if (m.t === 'chat') { this.chat(m.name, m.msg); this.diag.report('chat', 'ok', String(m.name || '').slice(0, 12)); } },
  upsert(m) {
    let r = this.remotes.get(m.id); if (!r) { const mesh = buildHero(); mesh.scale.set(0.96, 0.96, 0.96); mesh.visible = false; scene.add(mesh); r = { mesh }; this.remotes.set(m.id, r); }
    // Coerce every relayed field — the relay forwards peer payloads verbatim, so a NaN/string x/z/dir would
    // poison the scene-graph transform (and the projected nameplate), and an unknown class must not recolor.
    const nx = +m.x || 0, nz = +m.z || 0; r.tx = nx; r.tz = nz;
    if (r.x === undefined || Math.hypot(nx - r.x, nz - r.z) > 20) { r.x = nx; r.z = nz; } // snap on spawn/teleport; otherwise tick() lerps toward the target so ~9Hz updates don't stutter
    r.dir = +m.dir || 0; r.zone = m.zone; r.depth = +m.depth || 0; r.name = String(m.name || 'Player').slice(0, 24); r.cls = m.cls; r.level = +m.level || 1; r.hp = +m.hp || 0; r.hpMax = +m.hpMax || 1;
    if (r.mesh.userData.cloak && Object.prototype.hasOwnProperty.call(CLASSES, m.cls)) r.mesh.userData.cloak.material.color.setHex(CLASSES[m.cls].col);
  },
  removeRemote(id) { const r = this.remotes.get(id); if (r) { removeMesh(r.mesh); this.remotes.delete(id); } },
  clearRemotes() { for (const [, r] of this.remotes) removeMesh(r.mesh); this.remotes.clear(); },
  tick(dt) {
    if (!this.connected) return; this.sendT -= dt; if (this.sendT <= 0 && character && running) { this.sendT = 110; this.send({ t: 'state', x: +player.x.toFixed(2), z: +player.z.toFixed(2), dir: +player.dir.toFixed(2), zone, depth, name: this.name || character.name, cls: character.class, level: player.level, hp: Math.round(player.hp), hpMax: player.hpMax }); }
    for (const [, r] of this.remotes) { const vis = (running && r.zone === zone && r.depth === depth); r.mesh.visible = vis; if (vis) { if (r.tx !== undefined) { const k = Math.min(1, dt / 110); r.x += (r.tx - r.x) * k; r.z += (r.tz - r.z) * k; } r.mesh.position.set(r.x, Math.abs(Math.sin(now() * 0.005)) * 0.12, r.z); r.mesh.rotation.y = r.dir || 0; } }
  },
  status(s) { const el = document.getElementById('mpStatus'); if (el) el.textContent = s; },
  refreshUI() { const c = this.connected; document.getElementById('mpConnect').style.display = c ? 'none' : 'block'; document.getElementById('mpDisconnect').style.display = c ? 'block' : 'none'; document.getElementById('mpChatWrap').style.display = c ? 'block' : 'none'; },
  chat(name, msg) { const log = document.getElementById('mpChatLog'); if (log) { const d = document.createElement('div'); d.innerHTML = '<b style="color:#9fd8ff">' + escapeHtml(name) + ':</b> ' + escapeHtml(msg); log.appendChild(d); while (log.childNodes.length > 200) log.removeChild(log.firstChild); log.scrollTop = log.scrollHeight; } if (running) showMsg(name + ': ' + msg); }
};
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const mpModal = document.getElementById('mpModal');
function openMP() { document.getElementById('mpName').value = NET.name || (character ? character.name : ''); mpModal.style.display = 'block'; NET.refreshUI(); syncBackdrop(); }
function closeMP() { mpModal.style.display = 'none'; syncBackdrop(); }
document.getElementById('mpBtn').onclick = openMP;
document.getElementById('menuMP').onclick = openMP;
document.getElementById('mpClose').onclick = closeMP;
document.getElementById('mpConnect').onclick = () => NET.connect(document.getElementById('mpHost').value.trim(), document.getElementById('mpPort').value.trim(), document.getElementById('mpName').value.trim());
document.getElementById('mpDisconnect').onclick = () => NET.disconnect();
function mpSendChat() { const inp = document.getElementById('mpChatInput'); const v = inp.value.trim(); if (!v || !NET.connected) return; const nm = NET.name || (character ? character.name : 'Hero'); NET.send({ t: 'chat', name: nm, msg: v }); NET.chat(nm, v); inp.value = ''; }
document.getElementById('mpChatSend').onclick = mpSendChat;
document.getElementById('mpChatInput').addEventListener('keydown', e => { if (e.key === 'Enter') mpSendChat(); });

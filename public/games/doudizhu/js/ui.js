'use strict';
/* ui.js — screens, rendering and the host/guest glue.
   Roles: 'local' (practice, everything in-page), 'host' (runs the Game and
   pushes per-seat views to the guest), 'guest' (renders views, sends intents). */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const App = {
  role: null,
  name: '',
  cfg: null,
  game: null,
  peer: null,
  conns: {},        // host, in-game: seat -> DataConnection
  guests: [],       // host, lobby: [{conn, name}] in seat order (seat = idx + 1)
  guestConn: null,  // guest: connection to host
  code: null,
  started: false,
  view: null,
  selected: new Set(),
  bubbles: {},
};

/* ---------------- generic helpers ---------------- */

function showScreen(id) {
  $$('.screen').forEach(el => el.classList.toggle('active', el.id === id));
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toast-wrap').appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function rankLabel(r) {
  if (r === 16) return t('jk_small');
  if (r === 17) return t('jk_big');
  return RANK_LABELS[r];
}

function cardHTML(c, cls, laizi) {
  cls = cls || '';
  if (!c) return `<div class="card back ${cls}"></div>`;
  const isJoker = c.r >= 16;
  const red = isJoker ? c.r === 17 : (c.s === 1 || c.s === 2);
  const lz = laizi && c.r === laizi ? ' lz' : '';
  if (isJoker) {
    return `<div class="card jk ${red ? 'red' : ''} ${cls}${lz}" data-id="${c.id}">` +
      `<span class="jk-txt">${c.r === 17 ? 'JOKER' : 'joker'}</span><span class="cs">🃏</span></div>`;
  }
  return `<div class="card ${red ? 'red' : ''} ${cls}${lz}" data-id="${c.id}">` +
    `<span class="cr">${RANK_LABELS[c.r]}</span><span class="cs">${SUITS[c.s]}</span></div>`;
}

function comboName(combo) {
  if (!combo) return '';
  if (combo.type === 'bomb') {
    if (combo.laiziBomb) return t('c_laizi_bomb');
    return t('c_bomb') + (combo.soft ? ' · ' + t('c_soft') : '');
  }
  let s = t('c_' + combo.type);
  if (combo.soft) s += ' · ' + t('g_laizi');
  return s;
}

function prevFor(v) {
  return v.trick.combo && v.trick.seat !== v.mySeat ? v.trick.combo : null;
}

/* ---------------- static texts / language ---------------- */

function applyStaticTexts() {
  const set = (id, key) => { const el = $(id); if (el) el.textContent = t(key); };
  set('#t-title', 'title'); set('#t-subtitle', 'subtitle');
  set('#t-name', 'h_name'); set('#t-mode', 'h_mode');
  set('#t-mclassic', 'm_classic'); set('#t-mclassic-d', 'm_classic_d');
  set('#t-mduel', 'm_duel'); set('#t-mduel-d', 'm_duel_d');
  set('#t-mteam', 'm_team'); set('#t-mteam-d', 'm_team_d');
  set('#t-options', 'h_options');
  set('#t-olaizi', 'o_laizi'); set('#t-olaizi-d', 'o_laizi_d');
  set('#t-onoshuffle', 'o_noshuffle'); set('#t-onoshuffle-d', 'o_noshuffle_d');
  set('#t-odoubling', 'o_doubling'); set('#t-odoubling-d', 'o_doubling_d');
  set('#t-obase', 'o_base');
  set('#t-bcreate', 'b_create'); set('#t-bcreate-d', 'b_create_d');
  set('#t-bpractice', 'b_practice'); set('#t-bpractice-d', 'b_practice_d');
  set('#t-join', 'h_join'); set('#t-rcode', 'r_code');
  $('#btn-diag').textContent = t('diag_btn');
  set('#t-help-title', 'help_title');
  $('#btn-help').textContent = t('b_help');
  $('#btn-join').textContent = t('b_join');
  $('#btn-copy').textContent = t('b_copy');
  $('#btn-start').textContent = t('b_start');
  $('#btn-leave-room').textContent = t('b_leave');
  $('#inp-code').placeholder = t('ph_code');
  $('#btn-lang').textContent = LANG === 'zh' ? 'EN' : '中文';
  for (const id of ['#btn-bgm', '#btn-bgm2']) $(id).title = t('tt_bgm');
  for (const id of ['#btn-snd', '#btn-snd2']) $(id).title = t('tt_snd');
  $('#btn-lang2').textContent = LANG === 'zh' ? 'EN' : '中文';
  $('#help-body').innerHTML = t('help_body');
  document.documentElement.lang = LANG === 'zh' ? 'zh' : 'en';
}

/* ---------------- home / config ---------------- */

function cfgFromForm() {
  return {
    mode: ($$('input[name=mode]').find(r => r.checked) || {}).value || 'classic',
    laizi: $('#opt-laizi').checked,
    noShuffle: $('#opt-noshuffle').checked,
    doubling: $('#opt-doubling').checked,
    base: +$('#sel-base').value,
  };
}

function myName() {
  const v = $('#inp-name').value.trim();
  const name = v || ('Player' + Math.floor(Math.random() * 900 + 100));
  try { localStorage.setItem('ddz_name', name); } catch (e) { }
  return name;
}

/* ---------------- room (waiting) screen ---------------- */

function renderRoster(players) {
  const wrap = $('#room-players');
  wrap.innerHTML = players.map(p =>
    `<div class="roster-row"><span class="avatar">${p.ai ? '🤖' : '🧑'}</span>` +
    `<span>${esc(p.name)}</span>${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}</div>`).join('');
}

function seatsForMode(mode) { return mode === 'duel' ? 2 : mode === 'team' ? 4 : 3; }
function roomCapacity() { return App.cfg ? seatsForMode(App.cfg.mode) : 3; }

function hostRosterPlayers() {
  const seats = [{ name: App.name, tag: t('r_host') }];
  for (const g of App.guests) seats.push({ name: g.name });
  while (seats.length < roomCapacity()) seats.push({ name: t('r_ai'), ai: true });
  return seats;
}

function updateRoomScreen() {
  $('#room-code').textContent = App.code || '';
  $('#room-status').textContent = App.guests.length >= roomCapacity() - 1 ? '' : t('r_waiting');
  renderRoster(hostRosterPlayers());
  $('#btn-start').style.display = App.role === 'host' ? '' : 'none';
}

function sendRoomInfo() {
  const players = hostRosterPlayers().map(p => ({ name: p.name, ai: !!p.ai, tag: p.tag || '' }));
  for (const g of App.guests) {
    if (g.conn) try { g.conn.send({ t: 'room', code: App.code, players }); } catch (e) { }
  }
}

/* ---------------- liveness (heartbeat) ----------------
   WebRTC close events are unreliable when a tab is killed or a phone is
   locked, so both sides ping every 5s; 40s of silence means gone. */

const HEARTBEAT_MS = 5000;
const PEER_TIMEOUT_MS = 40000;

function startHeartbeat() {
  stopHeartbeat();
  App._hb = setInterval(() => {
    const now = Date.now();
    if (App.role === 'host') {
      for (const g of App.guests.slice()) {
        if (!g.conn) continue;
        try { g.conn.send({ t: 'ping' }); } catch (e) { }
        if (g.lastSeen && now - g.lastSeen > PEER_TIMEOUT_MS) {
          const conn = g.conn;
          try { conn.close(); } catch (e) { }
          hostOnGuestGone(conn);
        }
      }
    } else if (App.role === 'guest' && App.guestConn) {
      try { App.guestConn.send({ t: 'ping' }); } catch (e) { }
      if (App._hostSeen && now - App._hostSeen > PEER_TIMEOUT_MS) {
        toast(t('e_hostleft'));
        goHome();
      }
    }
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (App._hb) { clearInterval(App._hb); App._hb = null; }
}

function sendBye() {
  try {
    if (App.role === 'guest' && App.guestConn) App.guestConn.send({ t: 'bye' });
    if (App.role === 'host') for (const g of App.guests) { if (g.conn) g.conn.send({ t: 'bye' }); }
  } catch (e) { }
}

/* ---------------- host / local game plumbing ---------------- */

function sendAll(msg) {
  for (const conn of Object.values(App.conns)) { try { conn.send(msg); } catch (e) { } }
}

function pushViews() {
  const g = App.game;
  if (!g) return;
  for (const [seat, conn] of Object.entries(App.conns)) {
    try { conn.send({ t: 'view', v: g.buildView(+seat) }); } catch (e) { }
  }
  App.view = g.buildView(0);
  renderGame();
}

function newGame(players) {
  App.game = new Game(Object.assign({}, App.cfg, { players }), {
    onUpdate: () => pushViews(),
    onEvent: (ev) => {
      if (ev === 'redeal') { toast(t('e_redeal')); sendAll({ t: 'toastc', code: 'e_redeal' }); }
    },
    onError: (e) => console.error(e),
  });
  App.started = true;
  App.selected = new Set();
  showScreen('screen-game');
  App.game.startRound();
}

function startPractice() {
  App.name = myName();
  App.cfg = cfgFromForm();
  App.role = 'local';
  const players = [{ name: App.name }];
  const total = seatsForMode(App.cfg.mode);
  while (players.length < total) players.push({ name: 'AI ' + players.length, isAI: true });
  newGame(players);
}

function setCreateBusy(busy) {
  const btn = $('#btn-create');
  btn.disabled = busy;
  $('#t-bcreate').textContent = busy ? t('connecting') : t('b_create');
}

function createRoom(attempt) {
  if (!netAvailable()) { toast(t('e_net')); return; }
  App.name = myName();
  App.cfg = cfgFromForm();
  App.role = 'host';
  App.code = makeRoomCode();
  setCreateBusy(true);
  const sess = App._netSession || 0;
  const alive = () => (App._netSession || 0) === sess && App.role === 'host';
  App._joinTimer = setTimeout(() => {
    App._joinTimer = null;
    toast(t('e_timeout'));
    goHome();
  }, 12000);
  let myPeer = null;
  createHostPeer(App.code, {
    onReady: () => {
      if (!alive()) return;
      clearJoinTimer(); setCreateBusy(false);
      showScreen('screen-room'); updateRoomScreen(); startHeartbeat();
    },
    onCodeTaken: () => {
      if (!alive()) return;
      clearJoinTimer();
      try { if (myPeer) myPeer.destroy(); } catch (e) { }
      if ((attempt || 0) < 3) createRoom((attempt || 0) + 1);
      else { setCreateBusy(false); toast(t('e_conn')); }
    },
    onError: () => { if (!alive()) return; clearJoinTimer(); setCreateBusy(false); toast(t('e_net')); goHome(); },
    onConnection: (conn) => { if (alive()) hostAcceptConn(conn); },
  }).then(p => {
    myPeer = p;
    if (!alive()) { try { p.destroy(); } catch (e) { } return; }
    App.peer = p;
  }).catch(error => {
    if (!alive()) return;
    clearJoinTimer();
    toast(error.message || t('e_net'));
    goHome();
  });
}

function seatOfConn(conn) {
  const idx = App.guests.findIndex(g => g.conn === conn);
  return idx < 0 ? -1 : idx + 1;
}

function hostAcceptConn(conn) {
  if (App.started || App.guests.length >= roomCapacity() - 1) {
    try { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 200); } catch (e) { }
    return;
  }
  conn.on('data', d => hostOnData(conn, d));
  conn.on('close', () => hostOnGuestGone(conn));
}

function hostOnData(conn, d) {
  if (!d || typeof d !== 'object') return;
  const known = App.guests.find(g => g.conn === conn);
  if (known) known.lastSeen = Date.now();
  if (d.t === 'ping') return;
  if (d.t === 'bye') { if (known) { try { conn.close(); } catch (e) { } hostOnGuestGone(conn); } return; }
  if (d.t === 'hello') {
    if (seatOfConn(conn) >= 0) return;
    if (App.started || App.guests.length >= roomCapacity() - 1) {
      try { conn.send({ t: 'full' }); } catch (e) { }
      return;
    }
    App.guests.push({ conn, name: String(d.name || 'Guest').slice(0, 12), lastSeen: Date.now() });
    updateRoomScreen();
    sendRoomInfo();
    return;
  }
  if (d.t === 'act' && App.started) {
    const seat = seatOfConn(conn);
    if (seat < 0) return;
    dispatchAct(seat, d.kind, d.data, () => { try { conn.send({ t: 'err', code: 'e_invalid' }); } catch (e) { } });
  }
}

function hostOnGuestGone(conn) {
  const idx = App.guests.findIndex(g => g.conn === conn);
  if (idx < 0) return;
  if (App.started && App.game && App.game.state !== 'idle') {
    // Keep the seat (order defines seats); let an AI take over.
    const seat = idx + 1;
    App.guests[idx].conn = null;
    delete App.conns[seat];
    const nm = App.game.players[seat].name;
    App.game.players[seat].isAI = true;
    toast(t('e_disconnected', nm));
    sendAll({ t: 'toastc', code: 'e_disconnected', arg: nm });
    App.game.pump();
    pushViews();
  } else {
    const nm = App.guests[idx].name;
    App.guests.splice(idx, 1);
    toast(t('e_left', nm));
    updateRoomScreen();
    sendRoomInfo();
  }
}

function hostStartGame() {
  const players = [{ name: App.name }];
  for (const g of App.guests) players.push({ name: g.name });
  while (players.length < roomCapacity()) players.push({ name: 'AI ' + players.length, isAI: true });
  App.conns = {};
  App.guests.forEach((g, i) => { if (g.conn) App.conns[i + 1] = g.conn; });
  newGame(players);
}

function dispatchAct(seat, kind, data, onErr) {
  const g = App.game;
  if (!g) return;
  let ok = true;
  data = data || {};
  if (kind === 'bid') ok = g.actBid(seat, data.v | 0);
  else if (kind === 'double') ok = g.actDouble(seat, !!data.yes);
  else if (kind === 'play') ok = g.actPlay(seat, Array.isArray(data.ids) ? data.ids : []);
  else if (kind === 'pass') ok = g.actPass(seat);
  else if (kind === 'again') g.nextRound();
  else if (kind === 'chat') hostChat(seat, data.id | 0);
  if (!ok && onErr) onErr();
}

function hostChat(seat, id) {
  sendAll({ t: 'chat', seat, id });
  showBubble(seat, t('chat')[id] || '');
}

/* ---------------- guest plumbing ---------------- */

function setJoinBusy(busy) {
  const btn = $('#btn-join');
  btn.disabled = busy;
  btn.textContent = busy ? t('connecting') : t('b_join');
}

function clearJoinTimer() {
  if (App._joinTimer) { clearTimeout(App._joinTimer); App._joinTimer = null; }
  setJoinBusy(false);
}

function joinRoom() {
  if (!netAvailable()) { toast(t('e_net')); return; }
  const code = $('#inp-code').value.trim().toUpperCase();
  if (code.length !== 4) { toast(t('e_room404')); return; }
  App.name = myName();
  App.role = 'guest';
  App.code = code;
  setJoinBusy(true);
  const sess = App._netSession || 0;
  const alive = () => (App._netSession || 0) === sess && App.role === 'guest';
  App._joinTimer = setTimeout(() => {
    App._joinTimer = null;
    toast(t('e_timeout'));
    goHome();
  }, 12000);
  createGuestPeer(code, {
    onOpen: (conn) => {
      if (!alive()) return;
      clearJoinTimer();
      App.guestConn = conn;
      App._hostSeen = Date.now();
      startHeartbeat();
      conn.send({ t: 'hello', name: App.name });
      showScreen('screen-room');
      $('#room-code').textContent = code;
      $('#room-status').textContent = t('r_waiting');
      $('#btn-start').style.display = 'none';
      renderRoster([]);
    },
    onData: (d) => { if (alive()) guestOnData(d); },
    onClose: () => { if (alive()) { toast(t('e_hostleft')); goHome(); } },
    onNotFound: () => { if (!alive()) return; clearJoinTimer(); toast(t('e_room404')); goHome(); },
    onError: () => { if (!alive()) return; clearJoinTimer(); toast(t('e_conn')); goHome(); },
  }).then(p => {
    if (!alive()) { try { p.destroy(); } catch (e) { } return; }
    App.peer = p;
  }).catch(error => {
    if (!alive()) return;
    clearJoinTimer();
    toast(error.message || t('e_net'));
    goHome();
  });
}

/* ---------------- network diagnostics ---------------- */

async function runDiag() {
  const out = $('#diag-out');
  out.innerHTML = `<div class="diag-line">${t('diag_running')}</div>`;
  const r = await netDiagnose();
  const line = (ok, label) =>
    `<div class="diag-line">${ok ? '✅' : '❌'} ${label}</div>`;
  let verdict;
  if (!r.broker) verdict = t('diag_v_broker');
  else if (r.turn) verdict = t('diag_v_good');
  else if (r.stun) verdict = t('diag_v_noturn');
  else verdict = t('diag_v_blocked');
  out.innerHTML =
    line(r.broker, t('diag_broker')) +
    line(r.stun, t('diag_stun')) +
    line(r.turn, t('diag_turn')) +
    `<div class="diag-verdict">${verdict}</div>`;
}

function guestOnData(d) {
  if (!d || typeof d !== 'object') return;
  App._hostSeen = Date.now();
  if (d.t === 'ping') return;
  if (d.t === 'bye') { toast(t('e_hostleft')); goHome(); return; }
  if (d.t === 'room') {
    $('#room-status').textContent = '';
    renderRoster(d.players || []);
  } else if (d.t === 'view') {
    App.started = true;
    App.view = d.v;
    if (!$('#screen-game').classList.contains('active')) showScreen('screen-game');
    renderGame();
  } else if (d.t === 'chat') {
    if (d.seat !== App.view?.mySeat) showBubble(d.seat, t('chat')[d.id] || '');
  } else if (d.t === 'err' || d.t === 'toastc') {
    toast(t(d.code || 'e_invalid', d.arg !== undefined ? d.arg : ''));
  } else if (d.t === 'full') {
    toast(t('e_full'));
    goHome();
  }
}

/* ---------------- shared action entry ---------------- */

function act(kind, data) {
  if (App.role === 'guest') {
    if (App.guestConn) App.guestConn.send({ t: 'act', kind, data });
    if (kind === 'chat') showBubble(App.view ? App.view.mySeat : 1, t('chat')[data.id] || '');
    return;
  }
  if (kind === 'chat' && App.role === 'local') { showBubble(0, t('chat')[data.id] || ''); return; }
  dispatchAct(0, kind, data, () => toast(t('e_invalid')));
}

/* ---------------- game rendering ---------------- */

function seatSides(v) {
  // My seat at the bottom; play order flows to the right.
  if (v.n === 2) return { left: null, right: null, top: (v.mySeat + 1) % 2 };
  if (v.n === 4) return { left: (v.mySeat + 3) % 4, right: (v.mySeat + 1) % 4, top: (v.mySeat + 2) % 4 };
  return { left: (v.mySeat + 2) % 3, right: (v.mySeat + 1) % 3, top: null };
}

function playAreaHTML(v, seat) {
  const p = v.players[seat];
  if (v.state === 'bidding') {
    if (p.bid === null || p.bid === undefined) return '';
    return `<span class="say">${p.bid === 0 ? t('bid0') : t('bidN', p.bid)}</span>`;
  }
  if (v.state === 'doubling') {
    if (p.dbl === null || p.dbl === undefined) return '';
    return `<span class="say">${p.dbl ? t('dblY') : t('dblN')}</span>`;
  }
  const lp = p.lastPlay;
  if (!lp) return '';
  if (lp.pass) return `<span class="say pass">${t('pass_txt')}</span>`;
  const cards = lp.cards.slice().sort((a, b) => b.r - a.r);
  return `<div class="mini-cards">${cards.map(c => cardHTML(c, 'mini', v.laizi)).join('')}</div>` +
    `<span class="combo-tag">${comboName(lp.combo)}</span>`;
}

function seatBadge(v, p) {
  if (p.landlord) return `<span class="badge lord">👑 ${t('g_landlord')}</span>`;
  if (p.ally) return `<span class="badge ally">🤝 ${t('g_ally')}</span>`;
  return v.landlord != null ? `<span class="badge">${t('g_farmer')}</span>` : '';
}

function oppPanelHTML(v, seat) {
  const p = v.players[seat];
  const isTurn = v.actor === seat && (v.state === 'bidding' || v.state === 'doubling' || v.state === 'playing');
  const badge = seatBadge(v, p);
  const settleHand = p.hand && v.state === 'settle'
    ? `<div class="mini-cards reveal">${p.hand.map(c => cardHTML(c, 'mini', v.laizi)).join('')}</div>` : '';
  return `<div class="opp ${isTurn ? 'turn' : ''}" data-seat="${seat}">
    <div class="opp-head">
      <span class="avatar">${p.isAI ? '🤖' : '🧑'}</span>
      <div class="opp-names">
        <div class="pname">${esc(p.name)}${p.isAI ? ` <span class="tag">${t('ai_tag')}</span>` : ''} ${badge}</div>
        <div class="pmeta">${t('score_pts', p.score)} · ${t('cards_left', p.cardCount)}</div>
      </div>
    </div>
    <div class="opp-play">${playAreaHTML(v, seat)}</div>${settleHand}
    <div class="bubble-slot"></div>
  </div>`;
}

function centerHTML(v) {
  const chips = [];
  chips.push(`<span class="chip">${t('g_round', v.roundNo)}</span>`);
  if (v.laizi) chips.push(`<span class="chip lzchip">${t('g_laizi')}: ${rankLabel(v.laizi)}</span>`);
  chips.push(`<span class="chip">${t('g_mult')} ×${v.liveMult}</span>`);
  if (v.flags.noShuffle) chips.push(`<span class="chip">${t('o_noshuffle')}</span>`);
  if (v.mode === 'duel') chips.push(`<span class="chip dim" title="${t('g_dead')}">🂠×17</span>`);
  return chips.join('');
}

function midHTML(v) {
  let bottom;
  if (v.bottom) bottom = v.bottom.map(c => cardHTML(c, 'mini', v.laizi)).join('');
  else bottom = [0, 1, 2].map(() => cardHTML(null, 'mini')).join('');
  let html = `<div class="bottom-cards"><span class="bc-label">${t('g_bottom')}</span>${bottom}</div>`;
  const sides = seatSides(v);
  if (sides.top !== null) html += oppPanelHTML(v, sides.top);
  return html;
}

function myInfoHTML(v) {
  const p = v.players[v.mySeat];
  const badge = seatBadge(v, p);
  return `<span class="avatar">🧑</span><span class="pname">${esc(p.name)}</span> ${badge}
    <span class="pmeta">${t('score_pts', p.score)}</span><div class="bubble-slot"></div>`;
}

function actionsHTML(v) {
  const mine = v.actor === v.mySeat;
  if (v.state === 'bidding') {
    if (!mine) return statusHTML(v);
    let btns = `<button class="act-btn" data-bid="0">${t('bid0')}</button>`;
    for (let b = 1; b <= 3; b++)
      btns += `<button class="act-btn primary" data-bid="${b}" ${b <= v.currentBid ? 'disabled' : ''}>${t('bidN', b)}</button>`;
    return btns;
  }
  if (v.state === 'doubling') {
    if (!mine) return statusHTML(v);
    return `<button class="act-btn" data-dbl="0">${t('dblN')}</button>` +
      `<button class="act-btn primary" data-dbl="1">${t('dblY')}</button>`;
  }
  if (v.state === 'playing') {
    if (!mine) return statusHTML(v);
    const prev = prevFor(v);
    if (prev && !canBeat(v)) {
      return `<button class="act-btn noplay" data-act="pass">${t('cant_beat')}</button>`;
    }
    const sel = v.myHand.filter(c => App.selected.has(c.id));
    let combo = null;
    if (sel.length) {
      combo = analyze(sel.map(c => c.r), prev, v.laizi);
      if (combo && prev && !beats(combo, prev)) combo = null;
    }
    const preview = combo ? `<span class="combo-preview">${comboName(combo)}</span>` : '';
    return `${preview}<button class="act-btn" data-act="hint">${t('b_hint')}</button>` +
      `<button class="act-btn" data-act="pass" ${prev ? '' : 'disabled'}>${t('b_pass')}</button>` +
      `<button class="act-btn primary" data-act="play" ${combo ? '' : 'disabled'}>${t('b_play')}</button>`;
  }
  return '';
}

/* Is there any legal answer to the current trick? Memoized per situation
   so re-renders (card clicks, bubbles) don't recompute move generation. */
function canBeat(v) {
  const c = v.trick.combo;
  const sig = [v.roundNo, v.trick.seat, c && c.type, c && c.rank, c && c.n, v.myHand.length].join('|');
  if (App._beatSig === sig) return App._beatHas;
  App._beatSig = sig;
  App._beatHas = legalMoves(v.myHand.map(x => x.r), v.laizi, prevFor(v)).length > 0;
  return App._beatHas;
}

function statusHTML(v) {
  if (v.actor == null) return '';
  const nm = v.players[v.actor].name;
  return `<span class="status">${t('thinking', esc(nm))}</span>`;
}

/* Sound effects are driven by diffing consecutive views, so they fire
   identically for local play, host and guest. */
function sndSig(v) {
  return {
    round: v.roundNo,
    state: v.state,
    actor: v.actor,
    plays: v.players.map(p => {
      const lp = p.lastPlay;
      if (!lp) return '';
      return lp.pass ? 'P' : lp.cards.map(c => c.id).join('-');
    }),
    bids: v.players.map(p => (p.bid === null || p.bid === undefined) ? '' : String(p.bid)).join(','),
    dbls: v.players.map(p => (p.dbl === null || p.dbl === undefined) ? '' : (p.dbl ? '1' : '0')).join(','),
  };
}

function playSounds(v) {
  const prev = App._snd;
  const cur = sndSig(v);
  App._snd = cur;
  if (!prev || prev.round !== cur.round) {
    if (v.state === 'bidding') Snd.deal();
    return;
  }
  for (let i = 0; i < v.players.length; i++) {
    if (cur.plays[i] === prev.plays[i] || cur.plays[i] === '') continue;
    if (cur.plays[i] === 'P') { Snd.pass(); continue; }
    const c = v.players[i].lastPlay.combo;
    if (c && c.type === 'rocket') Snd.rocket();
    else if (c && c.type === 'bomb') Snd.bomb();
    else Snd.play();
  }
  if (cur.bids !== prev.bids) Snd.bid();
  if (cur.dbls !== prev.dbls) Snd.dbl();
  if (v.state === 'settle' && prev.state !== 'settle' && v.result) {
    const r = v.result;
    const iWon = r.landlordWon ? v.mySeat === v.landlord : v.mySeat !== v.landlord;
    if (iWon) Snd.win(); else Snd.lose();
    return;
  }
  if (v.state === 'playing' && cur.actor === v.mySeat && prev.actor !== v.mySeat) Snd.turn();
}

function renderGame() {
  const v = App.view;
  if (!v) return;
  playSounds(v);
  // prune stale selection
  const handIds = new Set(v.myHand.map(c => c.id));
  for (const id of [...App.selected]) if (!handIds.has(id)) App.selected.delete(id);

  $('#center-info').innerHTML = centerHTML(v);
  const sides = seatSides(v);
  $('#opp-left').innerHTML = sides.left !== null ? oppPanelHTML(v, sides.left) : '';
  $('#opp-right').innerHTML = sides.right !== null ? oppPanelHTML(v, sides.right) : '';
  $('#table-mid').innerHTML = midHTML(v);

  // my last play
  const mp = v.players[v.mySeat].lastPlay;
  let mpHtml = '';
  if (mp) {
    mpHtml = mp.pass ? `<span class="say pass">${t('pass_txt')}</span>`
      : `<div class="mini-cards">${mp.cards.slice().sort((a, b) => b.r - a.r).map(c => cardHTML(c, 'mini', v.laizi)).join('')}</div>`;
  } else if (v.state === 'playing' && v.actor === v.mySeat && !prevFor(v)) {
    mpHtml = `<span class="say lead">${t('lead_any')}</span>`;
  }
  $('#my-lastplay').innerHTML = mpHtml;

  $('#actions').innerHTML = actionsHTML(v);
  $('#my-hand').innerHTML = v.myHand.map(c =>
    cardHTML(c, App.selected.has(c.id) ? 'sel' : '', v.laizi)).join('');
  layoutHand();
  $('#my-info').innerHTML = myInfoHTML(v);
  $('#btn-chat').style.display = App.role === 'local' ? 'none' : '';

  bindActionButtons();
  renderBubbles();

  if (v.landlord != null && App._lordSeen !== v.roundNo) {
    App._lordSeen = v.roundNo;
    animateLandlord(v);
  }

  if (v.state === 'settle' && v.result) renderSettle(v);
  else $('#settle-overlay').classList.add('hidden');
}

/* Landlord reveal: banner + the kitty cards flying into the landlord's
   hand (or seat panel). Purely cosmetic overlay clones. */
function animateLandlord(v) {
  Snd.landlord();
  const banner = document.createElement('div');
  banner.className = 'lord-banner';
  banner.textContent = '👑 ' + t('lord_banner', v.players[v.landlord].name);
  document.body.appendChild(banner);
  setTimeout(() => banner.classList.add('show'), 20);
  setTimeout(() => { banner.classList.remove('show'); setTimeout(() => banner.remove(), 400); }, 1800);

  const srcCards = $$('#table-mid .bottom-cards .card');
  const target = v.landlord === v.mySeat ? $('#my-hand')
    : ($(`.opp[data-seat="${v.landlord}"]`) || $('#table-mid'));
  if (!srcCards.length || !target) return;
  const tr = target.getBoundingClientRect();
  const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
  srcCards.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const clone = el.cloneNode(true);
    clone.classList.add('fly-card');
    clone.style.left = r.left + 'px';
    clone.style.top = r.top + 'px';
    clone.style.width = r.width + 'px';
    clone.style.height = r.height + 'px';
    document.body.appendChild(clone);
    requestAnimationFrame(() => {
      clone.style.transform = 'scale(1.9)';
      setTimeout(() => {
        clone.style.transform =
          `translate(${tx - (r.left + r.width / 2)}px, ${ty - (r.top + r.height / 2)}px) scale(.35)`;
        clone.style.opacity = '0';
      }, 650 + i * 130);
    });
    setTimeout(() => clone.remove(), 1700 + i * 130);
  });
}

function bindActionButtons() {
  $$('#actions [data-bid]').forEach(b => b.onclick = () => act('bid', { v: +b.dataset.bid }));
  $$('#actions [data-dbl]').forEach(b => b.onclick = () => act('double', { yes: +b.dataset.dbl === 1 }));
  const hint = $('#actions [data-act=hint]');
  if (hint) hint.onclick = doHint;
  const pass = $('#actions [data-act=pass]');
  if (pass) pass.onclick = () => { App.selected.clear(); act('pass'); };
  const play = $('#actions [data-act=play]');
  if (play) play.onclick = () => act('play', { ids: [...App.selected] });
}

/* Drag across the hand to (de)select a run of cards; a plain tap still
   toggles one card. Bound once in boot() — the hand element persists. */
function bindHandDrag() {
  const handEl = $('#my-hand');
  let drag = null;
  const cardIdAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const c = el && el.closest('#my-hand .card');
    return c ? +c.dataset.id : null;
  };
  const applySel = (id, on) => {
    if (on) App.selected.add(id); else App.selected.delete(id);
    Snd.tick();
    renderGame();
  };
  handEl.addEventListener('pointerdown', e => {
    const id = cardIdAt(e.clientX, e.clientY);
    if (id === null) return;
    e.preventDefault();
    try { handEl.setPointerCapture(e.pointerId); } catch (err) { }
    drag = { on: !App.selected.has(id), touched: new Set([id]) };
    applySel(id, drag.on);
  });
  handEl.addEventListener('pointermove', e => {
    if (!drag) return;
    const id = cardIdAt(e.clientX, e.clientY);
    if (id === null || drag.touched.has(id)) return;
    drag.touched.add(id);
    applySel(id, drag.on);
  });
  const end = () => { drag = null; };
  handEl.addEventListener('pointerup', end);
  handEl.addEventListener('pointercancel', end);
}

/* Compress card overlap so the whole hand always fits the screen. */
function layoutHand() {
  const handEl = $('#my-hand');
  const cards = handEl.children;
  const n = cards.length;
  if (!n) return;
  const cw = cards[0].offsetWidth;
  const avail = handEl.clientWidth - 20;
  let step = cw - (window.innerWidth <= 720 ? 22 : 30);
  if (cw + step * (n - 1) > avail) step = Math.max(11, (avail - cw) / (n - 1));
  for (let i = 1; i < n; i++) cards[i].style.marginLeft = (step - cw) + 'px';
}

function doHint() {
  const v = App.view;
  const prev = prevFor(v);
  const moves = hintMoves(v.myHand.map(c => c.r), v.laizi, prev);
  if (!moves.length) { if (prev) { App.selected.clear(); act('pass'); } return; }
  // Repeated presses in the same situation cycle through the options.
  const sig = JSON.stringify([v.roundNo, v.trick.seat, prev && prev.type, prev && prev.rank, v.myHand.length]);
  if (App._hintSig !== sig) { App._hintSig = sig; App._hintIdx = 0; }
  const mv = moves[App._hintIdx % moves.length];
  App._hintIdx++;
  const cards = materialize(v.myHand, mv.play, v.laizi);
  if (!cards) return;
  App.selected = new Set(cards.map(c => c.id));
  renderGame();
}

/* ---------------- bubbles / chat ---------------- */

function showBubble(seat, text) {
  if (!text) return;
  Snd.chat();
  if (App.bubbles[seat]) clearTimeout(App.bubbles[seat].timer);
  App.bubbles[seat] = { text, timer: setTimeout(() => { delete App.bubbles[seat]; renderBubbles(); }, 3200) };
  renderBubbles();
}

function renderBubbles() {
  const v = App.view;
  if (!v) return;
  $$('.bubble-slot').forEach(el => el.innerHTML = '');
  for (const [seatStr, b] of Object.entries(App.bubbles)) {
    const seat = +seatStr;
    let slot = null;
    if (seat === v.mySeat) slot = $('#my-info .bubble-slot');
    else {
      const panel = $(`.opp[data-seat="${seat}"] .bubble-slot`);
      if (panel) slot = panel;
    }
    if (slot) slot.innerHTML = `<span class="bubble">${esc(b.text)}</span>`;
  }
}

function toggleChatPop() {
  const pop = $('#chat-pop');
  if (!pop.classList.contains('hidden')) { pop.classList.add('hidden'); return; }
  pop.innerHTML = t('chat').map((p, i) => `<button data-chat="${i}">${esc(p)}</button>`).join('');
  pop.classList.remove('hidden');
  $$('#chat-pop [data-chat]').forEach(b => b.onclick = () => {
    act('chat', { id: +b.dataset.chat });
    pop.classList.add('hidden');
  });
}

/* ---------------- settle overlay ---------------- */

function renderSettle(v) {
  const r = v.result;
  const iWon = r.landlordWon ? v.mySeat === v.landlord : v.mySeat !== v.landlord;
  const chips = [t('s_base', r.base), t('s_bid', r.bid)];
  if (r.bombs) chips.push(t('s_bombs', r.bombs));
  if (r.spring) chips.push(t('s_spring'));
  if (r.anti) chips.push(t('s_anti'));
  chips.push(t('s_total', r.mult * r.bid * r.base));
  const rows = v.players.map((p, i) => {
    const d = r.deltas[i];
    return `<div class="settle-row ${i === v.mySeat ? 'me' : ''}">
      <span>${p.landlord ? '👑' : ''} ${esc(p.name)}</span>
      <span class="${d >= 0 ? 'plus' : 'minus'}">${d >= 0 ? '+' : ''}${d}</span>
      <span class="total">${t('score_pts', p.score)}</span></div>`;
  }).join('');
  $('#settle-overlay').innerHTML = `<div class="settle-box ${iWon ? 'won' : 'lost'}">
    <h2>${r.landlordWon ? t('s_lwin') : t('s_fwin')}</h2>
    <p class="personal">${iWon ? t('s_youwin') : t('s_youlose')}</p>
    <div class="settle-chips">${chips.map(c => `<span class="chip">${c}</span>`).join('')}</div>
    <div class="settle-rows">${rows}</div>
    <div class="big-btns">
      <button id="btn-again" class="primary">${t('b_again')}</button>
      <button id="btn-settle-home">${t('b_home')}</button>
    </div></div>`;
  $('#settle-overlay').classList.remove('hidden');
  $('#btn-again').onclick = () => act('again');
  $('#btn-settle-home').onclick = goHome;
}

/* ---------------- navigation / cleanup ---------------- */

function goHome() {
  sendBye();
  stopHeartbeat();
  App._netSession = (App._netSession || 0) + 1;
  App._hostSeen = null;
  if (App.game) { App.game.stop(); App.game = null; }
  if (App.peer) {
    // Let the bye message flush before tearing the connection down.
    const peer = App.peer;
    App.peer = null;
    setTimeout(() => { try { peer.destroy(); } catch (e) { } }, 300);
  }
  App.role = null;
  App.conns = {};
  App.guests = [];
  App.guestConn = null;
  App.started = false;
  App.view = null;
  App.selected = new Set();
  App.bubbles = {};
  App._snd = null;
  App._lordSeen = null;
  App._hintSig = null;
  App._beatSig = null;
  if (App._joinTimer) { clearTimeout(App._joinTimer); App._joinTimer = null; }
  setJoinBusy(false);
  setCreateBusy(false);
  $('#settle-overlay').classList.add('hidden');
  $('#chat-pop').classList.add('hidden');
  showScreen('screen-home');
}

/* ---------------- boot ---------------- */

function boot() {
  try {
    const savedLang = localStorage.getItem('ddz_lang');
    if (savedLang) setLang(savedLang);
    const savedName = localStorage.getItem('ddz_name');
    if (savedName) $('#inp-name').value = savedName;
  } catch (e) { }
  applyStaticTexts();

  const toggleLang = () => {
    setLang(LANG === 'zh' ? 'en' : 'zh');
    applyStaticTexts();
    if (App.role === 'host' && $('#screen-room').classList.contains('active')) updateRoomScreen();
    if (App.view) renderGame();
  };
  $('#btn-lang').onclick = toggleLang;
  $('#btn-lang2').onclick = toggleLang;

  const setSndBtns = () => {
    const label = Snd.enabled ? '🔊' : '🔇';
    $('#btn-snd').textContent = label;
    $('#btn-snd2').textContent = label;
  };
  setSndBtns();
  $('#btn-snd').onclick = () => { Snd.toggle(); setSndBtns(); };
  $('#btn-snd2').onclick = () => { Snd.toggle(); setSndBtns(); };

  const setBgmBtns = () => {
    $('#btn-bgm').classList.toggle('off', !Bgm.enabled);
    $('#btn-bgm2').classList.toggle('off', !Bgm.enabled);
  };
  setBgmBtns();
  $('#btn-bgm').onclick = () => { Bgm.toggle(); setBgmBtns(); };
  $('#btn-bgm2').onclick = () => { Bgm.toggle(); setBgmBtns(); };
  // Browsers only allow audio after a user gesture; arm on any click.
  document.addEventListener('pointerdown', () => { Snd.unlock(); Bgm.poke(); });

  bindHandDrag();
  window.addEventListener('resize', () => { if (App.view) layoutHand(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { Snd.unlock(); Bgm.poke(); }
  });
  const openHelp = () => $('#help-modal').classList.remove('hidden');
  $('#btn-help').onclick = openHelp;
  $('#btn-help2').onclick = openHelp;
  $('#btn-help-close').onclick = () => $('#help-modal').classList.add('hidden');
  $('#help-modal').onclick = e => { if (e.target.id === 'help-modal') $('#help-modal').classList.add('hidden'); };

  $('#btn-practice').onclick = startPractice;
  $('#btn-create').onclick = () => createRoom(0);
  $('#btn-join').onclick = joinRoom;
  $('#inp-code').onkeydown = e => { if (e.key === 'Enter') joinRoom(); };
  $('#btn-copy').onclick = () => {
    const code = App.code || '';
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast(t('copied')));
    else { prompt(t('r_code'), code); }
  };
  $('#btn-start').onclick = hostStartGame;
  $('#btn-leave-room').onclick = goHome;
  $('#btn-diag').onclick = runDiag;
  $('#btn-exit-game').onclick = goHome;
  $('#btn-chat').onclick = toggleChatPop;

  const farewell = () => {
    sendBye();
    if (App.peer) try { App.peer.destroy(); } catch (e) { }
  };
  window.addEventListener('beforeunload', farewell);
  window.addEventListener('pagehide', farewell);
}

document.addEventListener('DOMContentLoaded', boot);

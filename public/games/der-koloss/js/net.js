// Networking: PeerJS/WebRTC host-authoritative model.
// Host runs the lobby + zombie simulation; clients send inputs & hit claims.
// Two data channels per peer: reliable (events) + unreliable/unordered (snapshots).
// Also owns voice chat end-to-end (streams, analysers, mute state) so both the
// lobby UI and the in-game HUD can read speaking state.
import { genCode } from './utils.js';
import { audio } from './audio.js';
import {
  availableLobbyColor,
  departedLobbyPlayers,
  isValidNetworkPayload,
  isValidSnapshotPayload,
  peerConnectionIsCurrent,
  removeLobbyPeer,
  sanitizePerkAnimation,
  shouldHandleRemoteClose,
  stableClientReplacement,
  stalePeerIds,
} from './multiplayer-contracts.js';

const PREFIX = 'der-koloss-z-';
const MAX_PLAYERS = 4;
const HEARTBEAT_INTERVAL_MS = 5000;
const PEER_TIMEOUT_MS = 20000;
const PEER_SWEEP_INTERVAL_MS = 5000;
const CLIENT_ID_KEY = 'der-koloss-client-id';
const PERSONAS = new Set(['dempsey', 'nikolai', 'takeo', 'richtofen']);
const CLIENT_EVENTS = new Set([
  'bark', 'barrier_req', 'box_spin_req', 'box_take', 'dead', 'door_req', 'down',
  'drop_take', 'grenade', 'hello', 'monkey', 'name', 'pap_req', 'pap_take',
  'pause', 'perk', 'perk_anim', 'persona', 'power_req', 'radio_req', 'ready', 'respawn',
  'revive_req', 'revive_self', 'revive_start', 'revive_stop', 'shoot', 'song_req', 'swap', 'tele_req',
  'trap_req', 'zhit', 'zsplash', 'heartbeat', 'leave',
]);
const HOST_ONLY_EVENTS = new Set([
  'barrier', 'boardpoints', 'box_move', 'box_state', 'door', 'drop', 'gameover',
  'hitcredit', 'killcredit', 'monkey_end', 'pap_door', 'pap_ready', 'pap_reject', 'pap_start', 'pdmg',
  'power', 'radio', 'revive_done', 'round', 'intermission', 'song', 'tele', 'tele_link',
  'trap_off', 'trap_on', 'return_lobby', 'zkill',
]);
const EVENT_MIN_MS = {
  hello: 60000, name: 250, persona: 250, ready: 250,
  barrier_req: 250, box_spin_req: 500, box_take: 500, door_req: 500,
  grenade: 500, pap_req: 500, pap_take: 500, power_req: 1000,
  perk_anim: 1500,
  radio_req: 500, revive_req: 500, song_req: 500, tele_req: 1000,
  // revive_start/stop are edge-triggered, but an input that flickers on the
  // F key would emit a pair per frame without a floor under them.
  revive_start: 250, revive_stop: 250, revive_self: 500,
  // A single shotgun/penetrating shot legitimately emits several zhit claims
  // in the same task. The global reliable-packet cap and host claim budgets
  // provide the abuse bound; spacing zhit packets discarded valid pellets.
  trap_req: 500, shoot: 25, zhit: 0, zsplash: 100,
};

// Cosmetic shot relay budget. 55 ms is ~18 flashes a second per shooter, which
// still reads as continuous automatic fire but keeps three guests firing an
// FG42 well inside the reliable-channel cap.
const SHOT_RELAY_MIN_MS = 55;

function cleanName(value) {
  return String(value || 'Player')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14) || 'Player';
}

function cleanPersona(value) {
  return PERSONAS.has(value) ? value : 'dempsey';
}

function cleanClientId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{16,80}$/.test(id) ? id : null;
}

function clientIdentity() {
  try {
    const saved = cleanClientId(globalThis.localStorage?.getItem(CLIENT_ID_KEY));
    if (saved) return saved;
  } catch (e) {}
  let id = null;
  try { id = cleanClientId(globalThis.crypto?.randomUUID?.()); } catch (e) {}
  if (!id) {
    const random = Math.random().toString(36).slice(2);
    id = `client-${Date.now().toString(36)}-${random.padEnd(12, '0').slice(0, 12)}`;
  }
  try { globalThis.localStorage?.setItem(CLIENT_ID_KEY, id); } catch (e) {}
  return id;
}

export class Net {
  constructor() {
    this.mode = null; // 'host' | 'client'
    this.peer = null;
    this.code = null;
    this.peers = new Map(); // id -> { r: conn, u: conn, name, ready, color, openR, openU }
    this._clientPeers = new Map(); // stable browser client id -> current PeerJS transport id
    this._clientId = clientIdentity();
    this.isHost = false;
    this.matchActive = false;
    // callbacks (assigned by consumer)
    this.onLobby = null;
    this.onStart = null;
    this.onEvent = null;      // reliable gameplay event (msg, fromId)
    this.onSnap = null;       // unreliable snapshot (client side)
    this.onPlayerState = null;// unreliable player state (host side)
    this.onPeerLeave = null;
    this.onClosed = null;
    this.lobbyPlayers = [];
    this.lobbyCheats = {};
    // Host-owned room policy. Starting false prevents a guest microphone
    // permission prompt before its first authenticated lobby snapshot.
    this.lobbyVoiceEnabled = false;
    // voice chat state
    this.myStream = null;
    this.voiceFailed = false;
    this.micMuted = false;
    this.voiceStreams = new Map(); // peerId -> { el, analyser, data, speaking }
    this._mediaConnections = new Map(); // peerId -> current PeerJS MediaConnection
    this.mutedPeers = new Set();   // locally-muted peer ids
    this.mySpeaking = false;
    this._myAnalyser = null;
    this._myData = null;
    this.voiceVolume = 0.55;
    this._voiceRequestGeneration = 0;
    this._rate = new Map();
    this._shotRelay = new Map();   // peer id -> last relayed shot, see 'shoot'
    this._eventAt = new Map();
    this._pendingUnreliable = new Map();
    this._intentionalLeave = false;
    this._closedHandled = false;
  }

  get connected() { return !!this.peer && !this.peer.destroyed; }
  get myId() { return this.peer?.id; }

  // ---------------- hosting ----------------
  host(playerName) {
    return new Promise((resolve, reject) => {
      this._intentionalLeave = false;
      this._closedHandled = false;
      const tryCode = (attempt) => {
        const code = genCode(5);
        const peer = new Peer(PREFIX + code, { debug: 0 });
        const kill = setTimeout(() => { peer.destroy(); reject(new Error('Connection to matchmaking timed out. Check your internet.')); }, 10000);
        peer.on('open', () => {
          clearTimeout(kill);
          this.peer = peer;
          this.code = code;
          this.isHost = true;
          this.mode = 'host';
          this.matchActive = false;
          this.lobbyPlayers = [{ id: peer.id, name: cleanName(playerName), ready: false, color: 0, host: true, persona: cleanPersona(this.myPersona) }];
          this._startPeerSweep();
          peer.on('connection', (conn) => this._hostAccept(conn));
          peer.on('error', (e) => { if (e.type !== 'peer-unavailable') console.warn('[net]', e.type); });
          this._setupVoiceAnswer();
          resolve(code);
        });
        peer.on('error', (e) => {
          clearTimeout(kill);
          if (e.type === 'unavailable-id' && attempt < 3) { peer.destroy(); tryCode(attempt + 1); }
          else reject(new Error('Could not create lobby: ' + e.type));
        });
      };
      tryCode(0);
    });
  }

  _hostAccept(conn) {
    const ch = conn.metadata?.ch === 'u' ? 'u' : 'r';
    conn.on('open', () => {
      let p = this.peers.get(conn.peer);
      if (!p && this.matchActive) {
        try { if (ch === 'r') conn.send({ t: 'reject', reason: 'Match in progress. Rejoin when the host returns to the lobby.' }); } catch (e) {}
        try { conn.close(); } catch (e) {}
        return;
      }
      if (!p && ch === 'u') {
        if (this._pendingUnreliable.size >= 12) { try { conn.close(); } catch (e) {} return; }
        const old = this._pendingUnreliable.get(conn.peer);
        if (old) { try { old.conn.close(); } catch (e) {} clearTimeout(old.timer); }
        const timer = setTimeout(() => {
          const pending = this._pendingUnreliable.get(conn.peer);
          if (pending?.conn === conn) this._pendingUnreliable.delete(conn.peer);
          try { conn.close(); } catch (e) {}
        }, 5000);
        this._pendingUnreliable.set(conn.peer, { conn, timer });
        conn.on('close', () => { const pending = this._pendingUnreliable.get(conn.peer); if (pending?.conn === conn) { clearTimeout(pending.timer); this._pendingUnreliable.delete(conn.peer); } });
        conn.on('error', () => { try { conn.close(); } catch (e) {} });
        return;
      }
      const clientId = cleanClientId(conn.metadata?.clientId);
      let replacementColor = null;
      if (!p && ch === 'r' && clientId) {
        const previousId = stableClientReplacement(this._clientPeers, clientId, conn.peer);
        if (previousId) {
          replacementColor = this.lobbyPlayers.find((player) => player.id === previousId)?.color ?? null;
          this._dropPeer(previousId);
        }
      }
      if (!p && this.peers.size >= MAX_PLAYERS - 1) {
        try { if (ch === 'r') conn.send({ t: 'reject', reason: 'Lobby is full (4 players max).' }); } catch (e) {}
        try { conn.close(); } catch (e) {}
        return;
      }
      if (!p) {
        p = {
          name: '?', ready: false, color: availableLobbyColor(this.lobbyPlayers, replacementColor, MAX_PLAYERS),
          openR: false, openU: false, authenticated: false,
          clientId, lastSeen: Date.now(),
        };
        this.peers.set(conn.peer, p);
        if (clientId) this._clientPeers.set(clientId, conn.peer);
        p.helloTimer = setTimeout(() => { if (!p.authenticated) this._dropPeer(conn.peer, p); }, 5000);
      }
      if (p[ch]?.open) { try { conn.close(); } catch (e) {} return; }
      this._attachHostConn(conn, ch, p);
      const pending = this._pendingUnreliable.get(conn.peer);
      if (ch === 'r' && pending) {
        clearTimeout(pending.timer);
        this._pendingUnreliable.delete(conn.peer);
        this._attachHostConn(pending.conn, 'u', p);
      }
    });
  }

  _attachHostConn(conn, ch, p) {
    if (p[ch]?.open) { try { conn.close(); } catch (e) {} return; }
    p[ch] = conn;
    p[ch === 'r' ? 'openR' : 'openU'] = true;
    conn.on('data', (msg) => {
      if (peerConnectionIsCurrent(this.peers, conn.peer, p, ch, conn)) this._hostData(conn.peer, msg, ch);
    });
    conn.on('close', () => this._dropPeer(conn.peer, p));
    conn.on('error', () => this._dropPeer(conn.peer, p));
  }

  _dropPeer(id, expectedPeer = null) {
    const p = this.peers.get(id);
    if (!p || (expectedPeer && p !== expectedPeer)) return;
    const removal = removeLobbyPeer(this.lobbyPlayers, id);
    const departed = removal.departed;
    clearTimeout(p.helloTimer);
    // Delete first: PeerJS implementations and test doubles are allowed to emit
    // close synchronously, and both reliable/unreliable channels point here.
    // Re-entrant close/error notifications must observe an already-removed peer.
    this.peers.delete(id);
    if (p.clientId && this._clientPeers.get(p.clientId) === id) this._clientPeers.delete(p.clientId);
    try { p.r?.close(); } catch (e) {}
    try { p.u?.close(); } catch (e) {}
    this._rate.delete(id);
    this._shotRelay.delete(id);
    for (const key of [...this._eventAt.keys()]) if (key.startsWith(`${id}:`)) this._eventAt.delete(key);
    this.lobbyPlayers = removal.players;
    this._cleanupPeerVoice(id);
    if (departed) {
      this._broadcastLobby();
      this.onPeerLeave?.(id, departed.name || p.name || 'Player');
    }
  }

  _cleanupPeerVoice(id) {
    this._detachVoiceStream(id);
    this._mediaPeers?.delete(id);
    this.mutedPeers.delete(id);
    const media = this._mediaConnections.get(id);
    this._mediaConnections.delete(id);
    try { media?.close(); } catch (e) {}
  }

  _hostData(fromId, msg, ch) {
    // Count a packet before walking its nested payload so malformed traffic is
    // still covered by the per-peer CPU budget.
    if (!msg || typeof msg !== 'object' || !this._allowMessage(fromId, ch) || !isValidNetworkPayload(msg)) return;
    const sourcePeer = this.peers.get(fromId);
    if (sourcePeer) sourcePeer.lastSeen = Date.now();
    if (ch === 'u') {
      const peer = this.peers.get(fromId);
      if (!peer?.authenticated) return;
      const entry = this.lobbyPlayers.find((l) => l.id === fromId);
      if ([msg.x, msg.y, msg.z, msg.yaw, msg.pitch].some((value) => !Number.isFinite(Number(value)))) return;
      msg.id = fromId;
      msg.name = entry?.name || 'Player';
      msg.x = Math.max(-200, Math.min(200, Number(msg.x)));
      msg.y = Math.max(-50, Math.min(100, Number(msg.y)));
      msg.z = Math.max(-200, Math.min(200, Number(msg.z)));
      msg.yaw = Math.max(-100, Math.min(100, Number(msg.yaw)));
      msg.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Number(msg.pitch)));
      this.onPlayerState?.(msg, fromId);
      return;
    }
    const peer = this.peers.get(fromId);
    if (!CLIENT_EVENTS.has(msg.t) || HOST_ONLY_EVENTS.has(msg.t)) return;
    if (msg.t !== 'hello' && !peer?.authenticated) return;
    if (!this._allowEvent(fromId, msg.t)) return;
    if (['pause', 'down', 'dead', 'respawn', 'revive_self', 'drop_take', 'bark', 'pap_take', 'shoot'].includes(msg.t)) msg.pid = fromId;
    if (msg.t === 'revive_req' || msg.t === 'revive_start' || msg.t === 'revive_stop') msg.by = fromId;
    switch (msg.t) {
      case 'shoot': {
        // The host has always consumed these itself; without a relay a guest
        // could only ever see the HOST shoot, never the other guests, so in a
        // four-player game two thirds of the gunfire was invisible from a
        // guest's seat. Relay it, with the shooter's identity stamped by us
        // rather than claimed by the sender.
        this.onEvent?.(msg, fromId);
        // Muzzle flashes are cosmetic and the reliable channel is shared with
        // the whole combat feed, so a fast automatic weapon is throttled down
        // to a rate the eye still reads as continuous fire.
        const now = performance.now();
        const last = this._shotRelay.get(fromId) || 0;
        if (now - last >= SHOT_RELAY_MIN_MS) {
          this._shotRelay.set(fromId, now);
          this._broadcastRel(msg);
        }
        break;
      }
      case 'hello': {
        const p = this.peers.get(fromId);
        if (!p?.openR) break;
        const claimedClientId = cleanClientId(msg.clientId);
        if (p.clientId && claimedClientId !== p.clientId) { this._dropPeer(fromId); break; }
        if (!p.clientId && claimedClientId) {
          const previousId = stableClientReplacement(this._clientPeers, claimedClientId, fromId);
          if (previousId) this._dropPeer(previousId);
          p.clientId = claimedClientId;
          this._clientPeers.set(claimedClientId, fromId);
        }
        p.authenticated = true;
        clearTimeout(p.helloTimer);
        if (p) { p.name = cleanName(msg.name); p.persona = cleanPersona(msg.persona); }
        const entry = this.lobbyPlayers.find((l) => l.id === fromId);
        if (!entry && this.lobbyPlayers.length < MAX_PLAYERS) this.lobbyPlayers.push({ id: fromId, name: p ? p.name : 'Player', ready: false, color: p.color, host: false, persona: cleanPersona(msg.persona) });
        else if (entry) { entry.name = p?.name || 'Player'; entry.persona = cleanPersona(msg.persona); }
        this._broadcastLobby();
        break;
      }
      case 'ready': {
        const entry = this.lobbyPlayers.find((l) => l.id === fromId);
        if (entry) entry.ready = !!msg.ready;
        this._broadcastLobby();
        break;
      }
      case 'persona': {
        const entry = this.lobbyPlayers.find((l) => l.id === fromId);
        if (entry) entry.persona = cleanPersona(msg.persona);
        this._broadcastLobby();
        break;
      }
      case 'name': {
        const entry = this.lobbyPlayers.find((l) => l.id === fromId);
        if (entry) entry.name = cleanName(msg.name);
        this._broadcastLobby();
        break;
      }
      case 'heartbeat':
        break;
      case 'leave':
        this._dropPeer(fromId, sourcePeer);
        break;
      case 'perk_anim': {
        const event = sanitizePerkAnimation(fromId, msg);
        if (!event) break;
        // The host observes it locally and relays only the sanitized identity.
        // The sender gets the relay too, but game code suppresses its local echo.
        this.onEvent?.(event, fromId);
        this._broadcastRel(event);
        break;
      }
      default:
        this.onEvent?.(msg, fromId);
    }
  }

  _allowMessage(id, ch) {
    const now = performance.now();
    let r = this._rate.get(id);
    if (!r || now - r.at >= 1000) { r = { at: now, r: 0, u: 0 }; this._rate.set(id, r); }
    r[ch]++;
    return r[ch] <= (ch === 'u' ? 45 : 120);
  }

  _allowEvent(id, type) {
    const min = EVENT_MIN_MS[type] || 0;
    if (!min) return true;
    const key = `${id}:${type}`;
    const now = performance.now();
    const last = this._eventAt.get(key);
    if (last != null && now - last < min) return false;
    this._eventAt.set(key, now);
    return true;
  }

  _startPeerSweep() {
    clearInterval(this._peerSweepTimer);
    this._peerSweepTimer = setInterval(() => this._pruneStalePeers(Date.now()), PEER_SWEEP_INTERVAL_MS);
  }

  _pruneStalePeers(now = Date.now()) {
    for (const id of stalePeerIds(this.peers, now, PEER_TIMEOUT_MS)) this._dropPeer(id);
  }

  _startHeartbeat() {
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = setInterval(() => this.sendRel({ t: 'heartbeat' }), HEARTBEAT_INTERVAL_MS);
  }

  _broadcastLobby() {
    const payload = {
      t: 'lobby', players: this.lobbyPlayers, code: this.code,
      cheats: this.lobbyCheats, voiceEnabled: this.lobbyVoiceEnabled,
    };
    this._broadcastRel(payload);
    this.syncVoiceCalls();
    this.onLobby?.(this.lobbyPlayers, this.code);
  }

  setLobbyCheats(settings) {
    if (!this.isHost) return;
    // Keep the lobby payload data-only and detached from the menu's mutable
    // object. Guests receive this snapshot for a truthful read-only preview.
    try { this.lobbyCheats = JSON.parse(JSON.stringify(settings || {})); }
    catch (e) { this.lobbyCheats = {}; }
    this._broadcastLobby();
  }

  setLobbyVoiceEnabled(enabled) {
    if (!this.isHost) return false;
    this.lobbyVoiceEnabled = enabled === true;
    if (!this.lobbyVoiceEnabled) this.disableVoice();
    else this.voiceFailed = false;
    this._broadcastLobby();
    return this.lobbyVoiceEnabled;
  }

  resetLobbyReady() {
    this.matchActive = false;
    for (const player of this.lobbyPlayers) player.ready = false;
    if (this.isHost) this._broadcastLobby();
  }

  setPersona(persona) {
    persona = cleanPersona(persona);
    this.myPersona = persona;
    const me = this.lobbyPlayers.find((l) => l.id === this.myId);
    if (me) me.persona = persona;
    if (this.isHost) this._broadcastLobby();
    else this.sendRel({ t: 'persona', persona });
  }

  setName(name) {
    const n = cleanName(name);
    const me = this.lobbyPlayers.find((l) => l.id === this.myId);
    if (me) me.name = n;
    if (this.isHost) this._broadcastLobby();
    else this.sendRel({ t: 'name', name: n });
  }

  setReady(ready) {
    if (this.isHost) {
      const me = this.lobbyPlayers.find((l) => l.id === this.myId);
      if (me) me.ready = ready;
      this._broadcastLobby();
    } else {
      this.sendRel({ t: 'ready', ready });
      const me = this.lobbyPlayers.find((l) => l.id === this.myId);
      if (me) me.ready = ready;
      this.onLobby?.(this.lobbyPlayers, this.code);
    }
  }

  majorityReady() {
    const n = this.lobbyPlayers.length;
    const r = this.lobbyPlayers.filter((p) => p.ready).length;
    return r >= Math.floor(n / 2) + 1;
  }

  startGame(payload) {
    this.matchActive = true;
    const msg = { t: 'start', ...payload, players: this.lobbyPlayers };
    this._broadcastRel(msg);
    this.onStart?.(msg);
  }

  // ---------------- joining ----------------
  join(code, playerName) {
    return new Promise((resolve, reject) => {
      this._intentionalLeave = false;
      this._closedHandled = false;
      const peer = new Peer({ debug: 0 });
      const kill = setTimeout(() => { peer.destroy(); reject(new Error('Connection timed out. Check the code and try again.')); }, 12000);
      peer.on('open', () => {
        this.peer = peer;
        this.isHost = false;
        this.mode = 'client';
        this.code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        this._setupVoiceAnswer();
        const hostId = PREFIX + this.code;
        const r = peer.connect(hostId, { metadata: { ch: 'r', clientId: this._clientId }, reliable: true });
        const u = peer.connect(hostId, { metadata: { ch: 'u', clientId: this._clientId }, reliable: false });
        this.hostConn = { r, u };
        let opened = false;
        r.on('open', () => {
          clearTimeout(kill);
          opened = true;
          r.send({ t: 'hello', name: cleanName(playerName), persona: cleanPersona(this.myPersona), clientId: this._clientId });
          this._startHeartbeat();
          resolve();
        });
        r.on('data', (msg) => {
          if (this._allowMessage('host', 'r')) this._clientData(msg);
        });
        u.on('data', (msg) => {
          if (!this._allowMessage('host', 'u') || !isValidSnapshotPayload(msg, { maxPlayers: MAX_PLAYERS })) return;
          this.onSnap?.(msg);
        });
        r.on('close', () => {
          if (this.peer === peer && this.hostConn?.r === r) this._closed('The host left or lost connection — returned to the main menu.');
        });
        r.on('error', () => {
          if (this.peer === peer && this.hostConn?.r === r) this._closed('The host connection was lost — returned to the main menu.');
        });
        peer.on('error', (e) => {
          if (!opened) {
            clearTimeout(kill);
            reject(new Error(e.type === 'peer-unavailable' ? 'Lobby not found. Check the code.' : 'Network error: ' + e.type));
          }
        });
      });
      peer.on('error', (e) => { clearTimeout(kill); reject(new Error('Could not connect: ' + e.type)); });
    });
  }

  _clientData(msg) {
    if (!msg || typeof msg !== 'object' || !isValidNetworkPayload(msg)) return;
    switch (msg.t) {
      case 'lobby':
        if (!Array.isArray(msg.players) || msg.players.length > MAX_PLAYERS) return;
        {
          const previous = this.lobbyPlayers;
          this.lobbyPlayers = msg.players.map((p, i) => ({
            id: String(p.id || '').slice(0, 80), name: cleanName(p.name), ready: !!p.ready,
            color: Number.isFinite(Number(p.color)) ? Math.abs(Math.trunc(Number(p.color))) % MAX_PLAYERS : i % MAX_PLAYERS,
            host: !!p.host, persona: cleanPersona(p.persona),
          }));
          this.lobbyCheats = msg.cheats && typeof msg.cheats === 'object' ? msg.cheats : {};
          this.lobbyVoiceEnabled = msg.voiceEnabled === true;
          if (!this.lobbyVoiceEnabled) this.disableVoice();
          this.syncVoiceCalls();
          this.onLobby?.(this.lobbyPlayers, String(msg.code || '').slice(0, 5));
          for (const player of departedLobbyPlayers(previous, this.lobbyPlayers, this.myId)) {
            this._cleanupPeerVoice(player.id);
            this.onPeerLeave?.(player.id, player.name);
          }
        }
        break;
      case 'start':
        if (!Array.isArray(msg.players) || msg.players.length > MAX_PLAYERS) return;
        this.matchActive = true;
        msg.players = msg.players.map((p, i) => ({
          ...p,
          id: String(p.id || '').slice(0, 80),
          name: cleanName(p.name),
          color: Number.isFinite(Number(p.color)) ? Math.abs(Math.trunc(Number(p.color))) % MAX_PLAYERS : i % MAX_PLAYERS,
          persona: cleanPersona(p.persona),
        }));
        this.onStart?.(msg);
        break;
      case 'reject':
        this._closed(String(msg.reason || 'The lobby rejected the connection.').slice(0, 120));
        break;
      default:
        this.onEvent?.(msg, 'host');
    }
  }

  _closed(reason) {
    if (!shouldHandleRemoteClose({
      intentional: this._intentionalLeave,
      handled: this._closedHandled,
      connected: this.connected,
    })) return;
    this._closedHandled = true;
    const onClosed = this.onClosed;
    this._teardown();
    onClosed?.(reason);
  }

  // ---------------- send ----------------
  _broadcastRel(msg) {
    for (const [, p] of this.peers) {
      try { if (p.authenticated && p.r?.open) p.r.send(msg); } catch (e) {}
    }
  }
  _broadcastUnrel(msg) {
    for (const [, p] of this.peers) {
      try { if (p.authenticated && p.u?.open) p.u.send(msg); } catch (e) {}
    }
  }
  // ---------------- voice chat (PeerJS media) ----------------
  _setupVoiceAnswer() {
    // answer incoming calls whether or not we've enabled our own mic yet
    if (this._voiceAnswerWired || !this.peer) return;
    this._voiceAnswerWired = true;
    this.peer.on('call', (mc) => {
      if (!this._isAllowedVoicePeer(mc.peer)) { try { mc.close(); } catch (e) {} return; }
      // Wait briefly for the lobby's normal microphone request to finish so a
      // single PeerJS call carries audio both ways instead of spawning a second
      // connection for the reverse direction.
      const started = performance.now();
      const generation = this._voiceRequestGeneration;
      const answer = () => {
        if (generation !== this._voiceRequestGeneration || !this._isAllowedVoicePeer(mc.peer)) {
          try { mc.close(); } catch (e) {}
          return;
        }
        if (!this.myStream && !this.voiceFailed && performance.now() - started < 8000) {
          setTimeout(answer, 100);
          return;
        }
        try { mc.answer(this.myStream || undefined); } catch (e) { try { mc.answer(); } catch (e2) {} }
        this._wireMediaConn(mc);
      };
      answer();
    });
  }

  _isAllowedVoicePeer(id) {
    if (!this.lobbyVoiceEnabled || !id || id === this.myId) return false;
    if (this.isHost) {
      const peer = this.peers.get(id);
      return !!(peer?.authenticated && peer.r?.open && this.lobbyPlayers.some((p) => p.id === id));
    }
    if (!this.hostConn?.r?.open) return false;
    if (id === PREFIX + this.code) return true;
    return this.lobbyPlayers.some((p) => p.id === id);
  }

  async enableVoice() {
    if (!this.lobbyVoiceEnabled || this.myStream || this.voiceFailed) return this.myStream;
    if (this._enableVoicePromise) return this._enableVoicePromise;
    const requestGeneration = this._voiceRequestGeneration;
    this._enableVoicePromise = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
        } });
        if (!this.lobbyVoiceEnabled || requestGeneration !== this._voiceRequestGeneration) {
          for (const track of stream.getTracks()) track.stop();
          return null;
        }
        for (const track of stream.getAudioTracks()) track.contentHint = 'speech';
        this.myStream = stream;
        this._mediaPeers = this._mediaPeers || new Set();
        // self-level analyser (lobby + HUD "you are talking" indicator)
        try {
          audio.init();
          const src = audio.ctx.createMediaStreamSource(stream);
          this._myAnalyser = audio.ctx.createAnalyser();
          this._myAnalyser.fftSize = 512;
          src.connect(this._myAnalyser);
          this._myData = new Uint8Array(this._myAnalyser.frequencyBinCount);
        } catch (e) {}
        if (this.micMuted) this.setMicMuted(true); // re-apply a lobby mute to the fresh stream
        // call everyone in the lobby (host: peer map; guests: lobby player ids)
        const ids = new Set(this.isHost ? [...this.peers.keys()] : this.lobbyPlayers.map((l) => l.id));
        ids.delete(this.myId);
        for (const id of ids) if (this._shouldCall(id)) this._callPeer(id);
        this._setupVoiceAnswer();
        return stream;
      } catch (e) {
        if (this.lobbyVoiceEnabled && requestGeneration === this._voiceRequestGeneration) this.voiceFailed = true;
        return null;
      }
    })();
    try { return await this._enableVoicePromise; }
    finally { this._enableVoicePromise = null; }
  }

  // call any lobby members we don't have media with yet (e.g. someone joined late)
  syncVoiceCalls() {
    if (!this.lobbyVoiceEnabled || !this.myStream) return;
    this._mediaPeers = this._mediaPeers || new Set();
    for (const l of this.lobbyPlayers) {
      if (l.id !== this.myId && this._shouldCall(l.id) && !this._mediaPeers.has(l.id)) this._callPeer(l.id);
    }
  }

  _shouldCall(id) { return String(this.myId || '').localeCompare(String(id || '')) < 0; }

  _callPeer(id) {
    if (!this.myStream || !this._isAllowedVoicePeer(id)) return;
    this._mediaPeers = this._mediaPeers || new Set();
    if (this._mediaPeers.has(id)) return;
    this._mediaPeers.add(id);
    try {
      const mc = this.peer.call(id, this.myStream);
      this._wireMediaConn(mc);
    } catch (e) { this._mediaPeers.delete(id); }
  }

  _wireMediaConn(mc) {
    if (!mc || !this._isAllowedVoicePeer(mc.peer)) { try { mc?.close(); } catch (e) {} return; }
    this._mediaPeers = this._mediaPeers || new Set();
    this._mediaPeers.add(mc.peer);
    const previous = this._mediaConnections.get(mc.peer);
    this._mediaConnections.set(mc.peer, mc);
    if (previous && previous !== mc) { try { previous.close(); } catch (e) {} }
    mc.on('stream', (remote) => {
      if (this._mediaConnections.get(mc.peer) !== mc || !this._isAllowedVoicePeer(mc.peer)) return;
      this._attachVoiceStream(mc.peer, remote);
      this.onVoiceStream?.(mc.peer, remote);
    });
    const cleanup = () => {
      // An old call may close after OFF -> ON has installed a replacement. It
      // must not delete/detach the replacement's state.
      if (this._mediaConnections.get(mc.peer) !== mc) return;
      this._mediaConnections.delete(mc.peer);
      this._mediaPeers?.delete(mc.peer);
      this._detachVoiceStream(mc.peer);
      this.onVoiceStreamEnd?.(mc.peer);
    };
    mc.on('close', cleanup);
    mc.on('error', cleanup);
  }

  // ---------------- voice streams (shared by lobby UI + game HUD) ----------------
  _attachVoiceStream(id, stream) {
    if (this.voiceStreams.has(id)) return;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.playsInline = true;
    el.srcObject = stream;
    el.muted = this.mutedPeers.has(id);
    el.volume = this.voiceVolume;
    document.body.appendChild(el);
    let analyser = null, data = null;
    try {
      audio.init();
      const srcNode = audio.ctx.createMediaStreamSource(stream);
      analyser = audio.ctx.createAnalyser();
      analyser.fftSize = 512;
      srcNode.connect(analyser); // analysis only — playback stays on the <audio> el
      data = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {}
    this.voiceStreams.set(id, { el, analyser, data, speaking: false });
  }

  _detachVoiceStream(id) {
    const vs = this.voiceStreams.get(id);
    if (!vs) return;
    try { vs.el.srcObject = null; vs.el.remove(); } catch (e) {}
    this.voiceStreams.delete(id);
  }

  _detachAllVoice() { for (const id of [...this.voiceStreams.keys()]) this._detachVoiceStream(id); }

  mutePeer(id, m) {
    if (m) this.mutedPeers.add(id); else this.mutedPeers.delete(id);
    const vs = this.voiceStreams.get(id);
    if (vs) { try { vs.el.muted = m; } catch (e) {} }
  }

  // call every frame (game) or on a timer (lobby): updates speaking flags + ducking
  updateVoiceSpeaking() {
    const now = performance.now();
    if (now < (this._nextVoiceMeter || 0)) return;
    this._nextVoiceMeter = now + 50;
    if (this._myAnalyser) {
      this._myAnalyser.getByteTimeDomainData(this._myData);
      let peak = 0;
      for (const v of this._myData) peak = Math.max(peak, Math.abs(v - 128));
      this.mySpeaking = peak > 14 && !this.micMuted;
    } else this.mySpeaking = false;
    let active = 0;
    for (const [, vs] of this.voiceStreams) {
      if (!vs.analyser) { vs.speaking = false; continue; }
      vs.analyser.getByteTimeDomainData(vs.data);
      let peak = 0;
      for (const v of vs.data) peak = Math.max(peak, Math.abs(v - 128));
      vs.speaking = peak > 14;
      if (vs.speaking) active++;
    }
    // smart voice management: when 3+ people talk over each other, duck them all
    for (const [, vs] of this.voiceStreams) { try { vs.el.volume = this.voiceVolume * (active >= 3 ? 0.65 : 1.0); } catch (e) {} }
  }

  setVoiceVolume(value) {
    this.voiceVolume = Math.max(0, Math.min(1, Number(value) || 0));
    for (const [, vs] of this.voiceStreams) { try { vs.el.volume = this.voiceVolume; } catch (e) {} }
  }

  setMicMuted(muted) {
    this.micMuted = muted;
    if (!this.myStream) return;
    for (const tr of this.myStream.getAudioTracks()) tr.enabled = !muted;
  }

  disableVoice() {
    this._voiceRequestGeneration++;
    try { this.myStream?.getTracks().forEach((t) => t.stop()); } catch (e) {}
    this.myStream = null;
    this._myAnalyser = null;
    this._myData = null;
    this.mySpeaking = false;
    const calls = [...this._mediaConnections.values()];
    this._mediaConnections.clear();
    this._mediaPeers?.clear();
    for (const call of calls) { try { call.close(); } catch (e) {} }
    this._detachAllVoice();
  }

  sendRel(msg) {
    if (this.isHost) this._broadcastRel(msg);
    else { try { if (this.hostConn?.r?.open) this.hostConn.r.send(msg); } catch (e) {} }
  }
  sendUnrel(msg) {
    if (this.isHost) this._broadcastUnrel(msg);
    else { try { if (this.hostConn?.u?.open) this.hostConn.u.send(msg); } catch (e) {} }
  }

  leave() {
    this._intentionalLeave = true;
    if (!this.isHost) {
      try { if (this.hostConn?.r?.open) this.hostConn.r.send({ t: 'leave' }); } catch (e) {}
    }
    this._teardown();
  }

  _teardown() {
    clearInterval(this._heartbeatTimer);
    clearInterval(this._peerSweepTimer);
    this._heartbeatTimer = null;
    this._peerSweepTimer = null;
    this.disableVoice();
    this.mutedPeers.clear();
    for (const [, p] of this.peers) clearTimeout(p.helloTimer);
    try { for (const [, p] of this.peers) { p.r?.close(); p.u?.close(); } } catch (e) {}
    try { this.hostConn?.r?.close(); this.hostConn?.u?.close(); } catch (e) {}
    try { this.peer?.destroy(); } catch (e) {}
    this.peer = null;
    this.hostConn = null;
    this.peers.clear();
    this._clientPeers.clear();
    this.lobbyPlayers = [];
    this.lobbyCheats = {};
    this.lobbyVoiceEnabled = false;
    this.isHost = false;
    this.matchActive = false;
    this.mode = null;
    this.code = null;
    this._rate.clear();
    this._shotRelay.clear();
    this._eventAt.clear();
    for (const [, pending] of this._pendingUnreliable) { clearTimeout(pending.timer); try { pending.conn.close(); } catch (e) {} }
    this._pendingUnreliable.clear();
    this._voiceAnswerWired = false;
    // A dead transport must not deliver late gameplay/lobby callbacks into a
    // newly visible menu or a later Net instance.
    this.onLobby = null;
    this.onStart = null;
    this.onEvent = null;
    this.onSnap = null;
    this.onPlayerState = null;
    this.onPeerLeave = null;
    this.onClosed = null;
  }
}

'use strict';
/* net.js — thin PeerJS (WebRTC) wrapper. The room code doubles as the host's
   peer id; the guest dials it directly, so no game server is needed.

   Connectivity: STUN gets peers through ordinary home NATs. Networks with
   client isolation or blocked UDP (campus WiFi like eduroam, many offices)
   also need a TURN relay. Signaling and short-lived TURN credentials come
   from the hall's shared YuqingWebRTC runtime configuration. */

const NET_PREFIX = 'ddz26-room-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

async function getPeerOptions() {
  await window.YuqingWebRTC?.ready;
  const options = window.YuqingWebRTC?.peerOptions({ debug: 0 });
  if (!options) throw new Error(window.YuqingWebRTC?.message() || '联机服务未配置');
  return options;
}
async function getIceServers() {
  return (await getPeerOptions()).config.iceServers;
}

function makeRoomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function netAvailable() { return typeof Peer !== 'undefined'; }

/* Reconnect to the signaling broker if the connection drops; existing
   WebRTC data channels keep working during broker outages. */
function autoReconnect(peer) {
  peer.on('disconnected', () => {
    if (!peer.destroyed) { try { peer.reconnect(); } catch (e) { } }
  });
}

/* Host side: claim the room id, accept guest connections. Async: resolves
   to the Peer once ICE servers are known. */
async function createHostPeer(code, cb) {
  const options = await getPeerOptions();
  const peer = new Peer(NET_PREFIX + code, options);
  autoReconnect(peer);
  peer.on('open', () => cb.onReady && cb.onReady());
  peer.on('error', e => {
    if (e.type === 'unavailable-id') cb.onCodeTaken && cb.onCodeTaken();
    else if (e.type !== 'peer-unavailable') cb.onError && cb.onError(e.type);
  });
  peer.on('connection', conn => {
    conn.on('open', () => cb.onConnection && cb.onConnection(conn));
  });
  return peer;
}

/* Guest side: dial the host's room id. */
async function createGuestPeer(code, cb) {
  const options = await getPeerOptions();
  const peer = new Peer(options);
  autoReconnect(peer);
  peer.on('open', () => {
    const conn = peer.connect(NET_PREFIX + code, { reliable: true });
    conn.on('open', () => cb.onOpen && cb.onOpen(conn));
    conn.on('data', d => cb.onData && cb.onData(d));
    conn.on('close', () => cb.onClose && cb.onClose());
    conn.on('error', () => cb.onError && cb.onError('conn'));
  });
  peer.on('error', e => {
    if (e.type === 'peer-unavailable') cb.onNotFound && cb.onNotFound();
    else cb.onError && cb.onError(e.type);
  });
  return peer;
}

/* Network self-test used by the in-app diagnostics panel.
   Reports signaling-broker reachability and which ICE candidate types
   this network can produce. */
async function netDiagnose() {
  const res = { broker: false, stun: false, turn: false };
  if (netAvailable()) {
    try {
      const options = await getPeerOptions();
      await new Promise(resolve => {
        let p = null;
        const done = ok => { res.broker = ok; try { if (p) p.destroy(); } catch (e) { } resolve(); };
        const to = setTimeout(() => done(false), 8000);
        try {
          p = new Peer(options);
          p.on('open', () => { clearTimeout(to); done(true); });
          p.on('error', () => { clearTimeout(to); done(false); });
        } catch (e) { clearTimeout(to); done(false); }
      });
    } catch { res.broker = false; }
  }
  try {
    const iceServers = await getIceServers();
    const types = await new Promise(resolve => {
      const pc = new RTCPeerConnection({ iceServers });
      pc.createDataChannel('probe');
      const ts = new Set();
      pc.onicecandidate = e => {
        if (e.candidate) {
          const m = /typ (\w+)/.exec(e.candidate.candidate);
          if (m) ts.add(m[1]);
        }
      };
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => { });
      setTimeout(() => { try { pc.close(); } catch (e) { } resolve(ts); }, 7000);
    });
    res.stun = types.has('srflx');
    res.turn = types.has('relay');
  } catch (e) { }
  return res;
}

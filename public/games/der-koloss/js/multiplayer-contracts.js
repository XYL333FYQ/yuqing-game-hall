// Pure multiplayer rules shared by runtime code and deterministic Node tests.

// Bound untrusted structured-clone payloads before gameplay code sees them.
// PeerJS performs the clone/allocation before delivery, but this still caps the
// traversal work and prevents oversized nested data from reaching hot paths.
export function isValidNetworkPayload(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 512 || depth > 5) return false;
  if (value == null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e7;
  if (typeof value === 'string') return value.length <= 160;
  if (Array.isArray(value)) {
    return value.length <= 64 && value.every((item) => isValidNetworkPayload(item, depth + 1, budget));
  }
  if (typeof value !== 'object') return false;
  const keys = Object.keys(value);
  return keys.length <= 40 && keys.every((key) => key.length <= 40 && isValidNetworkPayload(value[key], depth + 1, budget));
}

export function isValidSnapshotPayload(value, { maxPlayers = 4, maxZombies = 40 } = {}) {
  if (!isValidNetworkPayload(value) || value?.t !== 'snap') return false;
  if (!Array.isArray(value.pl) || value.pl.length > maxPlayers) return false;
  if (!Array.isArray(value.z) || value.z.length > maxZombies) return false;

  const playerStateValid = (player) => {
    if (!player || typeof player !== 'object' || Array.isArray(player)) return false;
    if (typeof player.id !== 'string' || !player.id || player.id.length > 80) return false;
    const coordinates = [player.x, player.y, player.z, player.yaw, player.pitch];
    if (!coordinates.every(Number.isFinite)) return false;
    return Math.abs(player.x) <= 200 && player.y >= -50 && player.y <= 100
      && Math.abs(player.z) <= 200 && Math.abs(player.yaw) <= 100
      && Math.abs(player.pitch) <= Math.PI / 2;
  };
  if (!value.pl.every(playerStateValid)) return false;

  return value.z.every((zombie) => Array.isArray(zombie)
    && zombie.length === 9
    && zombie.every(Number.isFinite)
    && Number.isInteger(zombie[0])
    && Math.abs(zombie[1]) <= 20000
    && Math.abs(zombie[2]) <= 20000
    && zombie[3] >= -5000 && zombie[3] <= 10000
    && zombie[4] >= -10000 && zombie[4] <= 10000
    && Number.isInteger(zombie[5]) && zombie[5] >= 0 && zombie[5] <= 7);
}
// Keep this module free of DOM/Three.js dependencies.

import { CFG } from './config.js';

const finite = (...values) => values.every((value) => Number.isFinite(Number(value)));

export function validCreditClaimId(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 0x7fffffff;
}

// A credit id is single-use per authenticated sender. Callers deliberately
// consume it before gameplay validation so an invalid, duplicate, or late
// packet can never be replayed later for points.
export function consumeCreditClaim(ledger, value, maxEntries = 2048) {
  if (!(ledger instanceof Set) || !validCreditClaimId(value) || ledger.has(value)) return false;
  ledger.add(value);
  if (ledger.size > maxEntries) {
    const oldest = ledger.values().next().value;
    ledger.delete(oldest);
  }
  return true;
}

export function acceptPendingCredit(pending, value, kind, now, maxAgeMs = 8000) {
  if (!(pending instanceof Map) || !['hit', 'kill'].includes(kind) || !validCreditClaimId(value)) return false;
  const claim = pending.get(value);
  if (!claim || !Number.isFinite(now) || now - claim.at < 0 || now - claim.at > maxAgeMs || claim[kind]) return false;
  claim[kind] = true;
  return true;
}

export function consumeBoardCredit(ledger, value, maxEntries = 512) {
  if (!(ledger instanceof Set) || typeof value !== 'string' || !value || value.length > 80 || ledger.has(value)) return false;
  ledger.add(value);
  if (ledger.size > maxEntries) ledger.delete(ledger.values().next().value);
  return true;
}

export function remoteSwapSource({
  weaponId, claimedPap = false, ownedWeapons, spawnWeaponAllowance,
  nearMatchingWallbuy = false, readyBoxWeapon = null,
} = {}) {
  if (typeof weaponId !== 'string' || !(ownedWeapons instanceof Map)) return null;
  if (ownedWeapons.has(weaponId)) return 'owned';
  const spawnPap = spawnWeaponAllowance instanceof Map ? spawnWeaponAllowance.get(weaponId) : undefined;
  if (ownedWeapons.size < 2 && spawnPap !== undefined && !!claimedPap === !!spawnPap) return 'spawn';
  if (nearMatchingWallbuy && !claimedPap) return 'wallbuy';
  if (readyBoxWeapon === weaponId && !claimedPap) return 'box';
  return null;
}

export function remoteWeaponClaimAllowed(remote, weaponId, pap) {
  if (!remote || typeof weaponId !== 'string') return false;
  return remote.weaponId === weaponId && !!remote.weaponPap === !!pap;
}

// Shotguns generate each pellet locally around the reliable center ray. The
// host accepts that concrete ray only inside a bounded cone; this reconciles
// legitimate pellet spread without turning a center shot into arbitrary aim.
export function boundedPelletDirectionAllowed(center, pellet, maxSpread = 0.01) {
  if (!center || !pellet || !finite(center.x, center.y, center.z, pellet.x, pellet.y, pellet.z)) return false;
  const a = Math.hypot(center.x, center.y, center.z);
  const b = Math.hypot(pellet.x, pellet.y, pellet.z);
  if (a < 0.7 || b < 0.7 || a > 1.3 || b > 1.3) return false;
  const dot = (center.x * pellet.x + center.y * pellet.y + center.z * pellet.z) / (a * b);
  // Independent pitch/yaw jitter has a diagonal envelope of sqrt(2)*spread.
  // Two is a conservative floating-point/input-bloom allowance, still capped.
  const cone = Math.min(0.16, Math.max(0.012, Number(maxSpread) || 0) * 2);
  return dot >= Math.cos(cone);
}

/**
 * Reconcile a client hit with the authoritative, slightly newer host position.
 * WebRTC + snapshot interpolation means the target can legitimately move between
 * what the guest rendered and what the host validates. The allowance is spatial
 * and bounded: it grows for nearby targets, but never permits a backwards shot,
 * an implausibly distant target, or damage through a host-side wall.
 */
export function remoteShotTargetAllowed({
  origin, dir, target, baseSpread = 0.01, pellet = false,
  wallDistance = Infinity, maxDistance = 125,
}) {
  if (!origin || !dir || !target) return false;
  if (!finite(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, target.x, target.y, target.z)) return false;
  if (!(Number.isFinite(wallDistance) || wallDistance === Infinity)) return false;
  const vx = target.x - origin.x;
  const vy = target.y - origin.y;
  const vz = target.z - origin.z;
  const distance = Math.hypot(vx, vy, vz);
  const dirLength = Math.hypot(dir.x, dir.y, dir.z);
  if (!distance || distance > maxDistance || dirLength < 0.7) return false;
  const dot = (vx * dir.x + vy * dir.y + vz * dir.z) / (distance * dirLength);
  // 0.8 m covers a full snapshot/interpolation interval at sprinting-zombie
  // speed. Normal body radius and weapon spread are added independently.
  const motionAllowance = 0.8;
  const hitRadius = pellet ? 0.7 : 0.48;
  const angularAllowance = Math.min(0.22, Math.atan2(hitRadius + motionAllowance, distance));
  const spread = Math.max(0.01, Number(baseSpread) || 0) + angularAllowance;
  if (dot < Math.cos(spread)) return false;
  return wallDistance >= distance - 1.15;
}

export function departedLobbyPlayers(previous = [], next = [], selfId = null) {
  const remaining = new Set(next.map((player) => player.id));
  return previous.filter((player) => player.id !== selfId && !remaining.has(player.id));
}

export function multiplayerExitDestination({ mode, gameOver = false, hostEnded = false } = {}) {
  if (mode === 'solo') return 'menu';
  return gameOver || hostEnded ? 'lobby' : 'menu';
}

export const SYNCED_PERK_IDS = Object.freeze(['jug', 'speed', 'dtap', 'qr']);

export function sanitizePerkAnimation(senderId, message) {
  const perkId = typeof message?.id === 'string' ? message.id : '';
  if (!SYNCED_PERK_IDS.includes(perkId)) return null;
  const pid = String(senderId || '').slice(0, 80);
  if (!pid) return null;
  // Never copy a client-supplied pid. The authenticated connection is the only
  // authority for which remote soldier may play this cosmetic animation.
  return { t: 'perk_anim', pid, id: perkId };
}

export function shouldShowGameplayCanvas(screen, hasActiveGame) {
  // The game screen ALWAYS shows the canvas. It used to be gated on
  // hasActiveGame too, but that made a transient ordering slip (showScreen
  // landing a beat before app.game is assigned) permanently latch the canvas
  // to display:none — the world kept rendering into a hidden element, so the
  // player got a pure black screen with a live HUD and no way back short of a
  // reload. Nothing ever re-ran showScreen to undo it.
  if (screen === 'game') return true;
  // The overlay screens are different: there the flag genuinely distinguishes
  // "paused mid-match, show the frozen world behind the menu" from "sitting in
  // the main menu", and getting it wrong is merely cosmetic and recoverable.
  return hasActiveGame === true && (screen === 'pause' || screen === 'options');
}

export function shouldRefreshLobbyUi(screen, hasActiveGame) {
  if (hasActiveGame) return false;
  return ['lobby', 'cheats', 'charselect', 'charpage'].includes(screen);
}

export function shouldHandleRemoteClose({ intentional = false, handled = false, connected = false } = {}) {
  return connected === true && intentional !== true && handled !== true;
}

export function stalePeerIds(peers, now, timeoutMs) {
  if (!(peers instanceof Map) || !Number.isFinite(now) || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return [];
  const stale = [];
  for (const [id, peer] of peers) {
    if (!peer?.authenticated || !Number.isFinite(peer.lastSeen)) continue;
    if (now - peer.lastSeen >= timeoutMs) stale.push(id);
  }
  return stale;
}

export function stableClientReplacement(clientPeers, clientId, incomingPeerId) {
  if (!(clientPeers instanceof Map) || typeof clientId !== 'string' || !clientId || typeof incomingPeerId !== 'string' || !incomingPeerId) return null;
  const previousPeerId = clientPeers.get(clientId);
  return typeof previousPeerId === 'string' && previousPeerId !== incomingPeerId ? previousPeerId : null;
}

export function peerConnectionIsCurrent(peers, id, expectedPeer, channel, connection) {
  return peers instanceof Map
    && peers.get(id) === expectedPeer
    && (channel === 'r' || channel === 'u')
    && expectedPeer?.[channel] === connection;
}

export function removeLobbyPeer(players, id) {
  const list = Array.isArray(players) ? players : [];
  const departed = list.find((player) => player?.id === id) || null;
  return { departed, players: departed ? list.filter((player) => player?.id !== id) : list };
}

export function availableLobbyColor(players, preferred = null, maxPlayers = 4) {
  const limit = Number.isInteger(maxPlayers) && maxPlayers > 1 ? maxPlayers : 4;
  const normalizedPreferred = Number.isFinite(Number(preferred))
    ? Math.abs(Math.trunc(Number(preferred))) % limit
    : null;
  const used = new Set((Array.isArray(players) ? players : []).map((player) => Number(player?.color)));
  if (normalizedPreferred != null && normalizedPreferred > 0 && !used.has(normalizedPreferred)) return normalizedPreferred;
  for (let color = 1; color < limit; color++) if (!used.has(color)) return color;
  return 1;
}

const ROSTER_PERSONAS = Object.freeze({
  dempsey: 'Tank Dempsey',
  nikolai: 'Nikolai Belinski',
  takeo: 'Takeo Masaki',
  richtofen: 'Edward Richtofen',
});

const cleanRosterText = (value, fallback, maxLength) => {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return text || fallback;
};

/**
 * Bound and normalize the always-visible co-op roster before it reaches the DOM.
 * `points` must come from the synchronized score state supplied by the caller;
 * this contract deliberately owns presentation only, never network authority.
 */
export function multiplayerRosterPresentation(multiplayer, players = []) {
  if (multiplayer !== true) return { visible: false, signature: 'solo', rows: [] };
  const source = Array.isArray(players) ? players.slice(0, 4) : [];
  const usedIds = new Set();
  const rows = source.map((player, index) => {
    const raw = player && typeof player === 'object' ? player : {};
    const baseId = cleanRosterText(raw.id, `slot-${index}`, 80);
    let id = baseId;
    for (let suffix = 2; usedIds.has(id); suffix++) id = `${baseId.slice(0, 74)}-${suffix}`;
    usedIds.add(id);
    const colorValue = Number(raw.color ?? raw.c);
    const colorIndex = Number.isFinite(colorValue)
      ? Math.abs(Math.trunc(colorValue)) % CFG.COLORS.length
      : index % CFG.COLORS.length;
    const personaId = String(raw.persona || '').toLowerCase();
    const persona = ROSTER_PERSONAS[personaId]
      || cleanRosterText(raw.marine, 'Soldier', 24);
    const pointsValue = Number(raw.points);
    const points = Number.isFinite(pointsValue)
      ? Math.min(9_999_999, Math.max(0, Math.trunc(pointsValue)))
      : 0;
    const micEnabled = raw.micEnabled === true || raw.mic === true;
    const speaking = micEnabled && raw.speaking === true;
    const voice = speaking ? 'speaking' : micEnabled ? 'idle' : 'muted';
    return {
      id,
      name: cleanRosterText(raw.name, 'Player', 14),
      persona,
      color: CFG.COLORS[colorIndex],
      colorIndex,
      points,
      voice,
    };
  });
  const signature = `multi:${rows.map((row) => [
    row.id, row.name, row.persona, row.colorIndex, row.points, row.voice,
  ].join('|')).join('~')}`;
  return { visible: true, signature, rows };
}

// Host and guest kill confirmations must produce the same local reward and
// floating-score presentation. Keeping this pure prevents the network handler
// from silently drifting away from the authority-side feedback again.
export function killCreditPresentation({ head = false, knife = false, doubleActive = false } = {}) {
  const basePoints = knife ? CFG.POINTS_KNIFE_KILL : head ? CFG.POINTS_HEADSHOT : CFG.POINTS_KILL;
  return {
    basePoints,
    displayedPoints: doubleActive ? basePoints * 2 : basePoints,
    color: head ? '#ffd24a' : '#e8e4d8',
  };
}

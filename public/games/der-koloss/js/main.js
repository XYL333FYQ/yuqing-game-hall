// Boot + menus: main menu, options (sensitivity/FOV/volumes/quality),
// lobby (host/join with ready-up), pause, game lifecycle.
import { CFG, STORE_KEY, NAME_KEY } from './config.js';
import { initInput, input, lockPointer, unlockPointer, clearPressed, resetInputState } from './input.js';
import { audio } from './audio.js';
import { HUD } from './hud.js';
import { Net } from './net.js';
import { Game } from './game.js';
import { assets } from './assets.js';
import { PERSONAS, drawPortrait } from './personas.js';
import { WEAPONS } from './weapons.js';
import { getMenuMusicOffset, keepMenuMusicClock } from './site-audio.js?v=6';
import { shouldRefreshLobbyUi, shouldShowGameplayCanvas } from './multiplayer-contracts.js';

const $ = (id) => document.getElementById(id);
const DEBUG = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  && new URLSearchParams(location.search).get('debug') === '1';
function debugExpose(name, value) { if (DEBUG) window[name] = value; }

// ---------------- options ----------------
const DEFAULTS = {
  sensitivity: 1.0, fov: 110, master: 0.8, sfx: 1.0, music: 0.7, voice: 0.55,
  quality: 'auto', invertY: false, brightness: 1.0, brightnessCalibration: 2, masterTouched: false,
  motionBlur: 1.0, settingsSchema: 3,
};
function loadOptions() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    let saved = raw ? (JSON.parse(raw) || {}) : {};
    // Calibration v2 makes the old 180% exposure the new readable 100%.
    // Older builds persisted the default 1.0 even when the player never touched
    // the slider, so reset all v1 values once to guarantee returning players get
    // the new readable baseline instead of remaining stuck on the old darkness.
    if (raw && saved.brightnessCalibration !== 2) {
      saved.brightness = 1;
      saved.brightnessCalibration = 2;
      localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    }
    // v1 and v2 ship to the same origin under the same STORE_KEY, so a player
    // returning from v1 arrives carrying a v1 options blob — and `saved` wins
    // over DEFAULTS below. Every one of those values was tuned against the old
    // forward renderer, and `quality` is the worst of them: 'low' switches off
    // shadowMap, the sun's castShadow and the whole post stack (see
    // applyQuality in js/game.js), so a returning player sees v2 rendered like
    // v1 and reasonably concludes the deploy is broken.
    //
    // So a pre-v2 blob is discarded wholesale rather than patched field by
    // field: v2 is a different renderer and a different audio mix, and the
    // defaults below are the tuned baseline we actually want everyone to land
    // on. This runs once — settingsSchema pins it — so anything the player
    // changes afterwards persists normally.
    if (raw && saved.settingsSchema !== 2 && saved.settingsSchema !== 3) {
      saved = { ...DEFAULTS };
      localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    }
    // Schema 3 adds a real automatic quality mode. V2's untouched default was High, so migrate it to Auto;
    // every other setting remains intact and explicit Low/Medium choices are preserved.
    if (raw && saved.settingsSchema === 2) {
      if (saved.quality === 'high') saved.quality = 'auto';
      saved.settingsSchema = 3;
      localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    }
    return { ...DEFAULTS, ...saved };
  }
  catch (e) { return { ...DEFAULTS }; }
}
function saveOptions(o) { localStorage.setItem(STORE_KEY, JSON.stringify(o)); }
const options = loadOptions();

// ---------------- multiplayer auto-volume ----------------
// In co-op, drop master volume to 15% by default so voice chat stays clearly
// audible. As soon as the player moves the master slider themselves, their
// choice wins (persisted via options.masterTouched) and we never override again.
const MP_MASTER = 0.15;
let mpMasterOverride = null; // runtime-only; never written to localStorage
function effectiveMaster() { return mpMasterOverride ?? options.master; }
function syncMasterUI() {
  const el = $('opt-master');
  if (!el) return;
  el.value = effectiveMaster();
  $('opt-master-val').textContent = Math.round(effectiveMaster() * 100) + '%';
}
function setMpMasterOverride(on) {
  mpMasterOverride = (on && !options.masterTouched) ? MP_MASTER : null;
  syncMasterUI();
  audio.setVolume('master', effectiveMaster());
}

// ---------------- cheat codes ----------------
const CHEATS_KEY = 'der-riese-cheats';
function loadCheats() {
  // `|| {}` alone still lets a primitive through — JSON.parse('7') is 7, and
  // modules are strict mode, so the first `cheats[id] = ...` on a number throws.
  try {
    const v = JSON.parse(localStorage.getItem(CHEATS_KEY));
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  } catch (e) { return {}; }
}
const cheats = loadCheats();

// ---------------- persona (character) ----------------
const PERSONA_KEY = 'der-riese-persona';
function getPersona() {
  const id = localStorage.getItem(PERSONA_KEY) || 'dempsey';
  return PERSONAS.some((p) => p.id === id) ? id : 'dempsey';
}
function setPersona(id) {
  localStorage.setItem(PERSONA_KEY, id);
  app.net?.setPersona(id);
  $('lobby-char-name').textContent = PERSONAS.find((p) => p.id === id)?.label || '';
}
let charReturnTo = 'menu';
function openCharSelect(from) {
  charReturnTo = from;
  buildCharCards();
  showScreen('charselect');
}
function takenPersonas() {
  return new Set((app.net?.lobbyPlayers || []).filter((l) => l.id !== app.net?.myId).map((l) => l.persona));
}
function freePersona() {
  const taken = takenPersonas();
  const mine = getPersona();
  if (!taken.has(mine)) return mine;
  return (PERSONAS.find((p) => !taken.has(p.id)) || PERSONAS[0]).id;
}
function buildCharCards() {
  const taken = takenPersonas();
  const wrap = $('char-cards');
  wrap.innerHTML = '';
  for (const p of PERSONAS) {
    const isTaken = taken.has(p.id);
    const card = document.createElement('div');
    card.className = 'char-card' + (isTaken ? ' taken' : '');
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    drawPortrait(cv, p.id);
    const nm = document.createElement('div');
    nm.className = 'cc-name'; nm.textContent = p.label;
    const rl = document.createElement('div');
    rl.className = 'cc-role'; rl.textContent = isTaken ? 'TAKEN' : p.role;
    card.append(cv, nm, rl);
    if (!isTaken) card.addEventListener('click', () => { audio.play('ui'); openCharPage(p.id); });
    wrap.appendChild(card);
  }
}
let charPageId = 'dempsey';
function openCharPage(id) {
  charPageId = id;
  const p = PERSONAS.find((x) => x.id === id);
  if (!p) return;
  $('char-name').textContent = p.label;
  $('char-role').textContent = p.role;
  $('char-bio').textContent = p.bio;
  $('char-traits').innerHTML = p.traits.map((x) => `<li>${x}</li>`).join('');
  $('char-quotes').innerHTML = p.quotes.map((q) => `<div>“${q}”</div>`).join('');
  const cv = $('char-portrait');
  cv.width = 96; cv.height = 96;
  drawPortrait(cv, id);
  // SELECT blocked if someone in the lobby already claimed this marine
  const taken = takenPersonas();
  const pickBtn = $('btn-char-pick');
  if (taken.has(id)) { pickBtn.disabled = true; pickBtn.textContent = 'TAKEN'; }
  else { pickBtn.disabled = false; pickBtn.textContent = 'SELECT'; }
  // voice line preview buttons (a few signature lines per character)
  const vwrap = $('char-voice-lines');
  vwrap.innerHTML = '';
  const previews = [['start1', 'Battle cry'], ['round1', 'New wave'], ['kill1', 'Kill'], ['power1', 'Power on']];
  for (const [ev, lbl] of previews) {
    const b = document.createElement('button');
    b.className = 'vline-btn';
    b.textContent = '▸ ' + lbl;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        audio.init(); // AudioContext needs the click gesture; buffers may not be loaded on the menu yet
        applyOptions();
        if (!assets.audioReady) await assets.loadAudio(audio.ctx);
        const buf = assets.sound(`vox_${id}_${ev}`);
        if (buf) audio.playBuffer(buf, 'vox', { bus: 'sfx', vol: 1.8 });
        else toast('Voice line not found.');
      } finally { b.disabled = false; }
    });
    vwrap.appendChild(b);
  }
  showScreen('charpage');
}
function saveCheats() {
  localStorage.setItem(CHEATS_KEY, JSON.stringify(cheats));
  if (app?.net?.isHost) app.net.setLobbyCheats(cheats);
}
const CHEAT_IDS = ['papguns', 'wunder', 'perkaholic', 'goldguns', 'opensesame', 'zero', 'warbond', 'god', 'power', 'tele'];
const cheatsReadOnly = () => !!(app.net && !app.net.isHost);
const visibleCheats = () => cheatsReadOnly() ? (app.net?.lobbyCheats || {}) : cheats;
// ---- custom loadout catalog: era -> type -> A-Z ----
const WPN_ERA = {
  m1911: 0, magnum: 0, kar98: 0, gewehr43: 0, m1a1: 0, m1garand: 0, thompson: 0, mp40: 0,
  type100: 0, ppsh: 0, trench: 0, dbshotgun: 0, bar: 0, fg42: 0, mg42: 0, browning: 0,
  ptrs41: 0, mosin: 0, springfield: 0, panzerschreck: 0, stg44: 0, raygun: 0, dg2: 0,
  ump45: 1, acr: 1, famas: 1, ak74u: 1, galil: 1, commando: 1,
};
const ERA_LBL = ['WORLD AT WAR', 'BLACK OPS ERA'];
const CLS_ORDER = ['pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'lmg', 'launcher', 'wonder'];
const CLS_LBL = { pistol: 'PISTOLS', smg: 'SMGs', shotgun: 'SHOTGUNS', rifle: 'RIFLES', sniper: 'SNIPERS', lmg: 'LMGs', launcher: 'LAUNCHERS', wonder: 'WONDER WEAPONS' };
const LOADOUT_GUNS = Object.keys(WPN_ERA)
  .map((id) => ({ id, name: WEAPONS[id]?.name || id, cls: WEAPONS[id]?.cls || 'rifle', era: WPN_ERA[id] }))
  .filter((w) => CLS_ORDER.includes(w.cls))
  .sort((a, b) => a.era - b.era || CLS_ORDER.indexOf(a.cls) - CLS_ORDER.indexOf(b.cls) || a.name.localeCompare(b.name));
function buildWeaponPickers() {
  for (const wrap of document.querySelectorAll('.wpn-pick')) {
    const slot = wrap.dataset.slot;
    const list = wrap.querySelector('.wpn-list');
    const search = wrap.querySelector('.wpn-search');
    const render = (filter = '') => {
      list.innerHTML = '';
      let lastGroup = null;
      for (const w of LOADOUT_GUNS) {
        if (filter && !w.name.toLowerCase().includes(filter)) continue;
        const group = `${ERA_LBL[w.era]} · ${CLS_LBL[w.cls]}`;
        if (group !== lastGroup) {
          lastGroup = group;
          const gh = document.createElement('div');
          gh.className = 'wpn-group'; gh.textContent = group;
          list.appendChild(gh);
        }
        const b = document.createElement('button');
        b.className = 'wpn-item' + (visibleCheats().loadout?.[slot] === w.id ? ' sel' : '');
        b.disabled = cheatsReadOnly();
        b.innerHTML = `${w.name}<span class="cls">${w.cls.toUpperCase()}</span>`;
        b.addEventListener('click', () => {
          if (cheatsReadOnly()) return;
          audio.play('ui');
          cheats.loadout = cheats.loadout || {};
          cheats.loadout[slot] = cheats.loadout[slot] === w.id ? null : w.id; // click again to clear
          // custom loadout is exclusive with the random/spawn-weapon codes
          if (cheats.loadout[slot]) {
            for (const id of ['papguns', 'wunder']) { cheats[id] = false; const el = $('cheat-' + id); if (el) el.checked = false; }
          }
          saveCheats();
          render(search.value.trim().toLowerCase());
        });
        list.appendChild(b);
      }
      if (!list.children.length) list.innerHTML = '<div class="wpn-group">no guns match</div>';
    };
    search.addEventListener('input', () => render(search.value.trim().toLowerCase()));
    wrap._render = render;
    render();
  }
}
let cheatsReturnTo = 'menu';
function openCheats(from) {
  cheatsReturnTo = from;
  syncCheatsUI();
  showScreen('cheats');
}
function syncCheatsUI() {
  const guest = cheatsReadOnly();
  const shown = visibleCheats();
  for (const id of CHEAT_IDS) {
    const el = $('cheat-' + id);
    if (el) { el.checked = !!shown[id]; el.disabled = guest; }
  }
  $('cheat-round').value = shown.startRound || 1;
  $('cheat-round').disabled = guest;
  $('cheat-area').value = shown.startArea || 'mainframe';
  $('cheat-area').disabled = guest;
  $('cheats-panel').classList.toggle('read-only', guest);
  for (const wrap of document.querySelectorAll('.wpn-pick')) wrap._render?.(wrap.querySelector('.wpn-search').value.trim().toLowerCase());
  // Guests see the host's current snapshot, but cannot mutate any setting.
  $('cheats-note').textContent = guest
    ? 'VIEW ONLY — only the host can change cheats. The settings shown here are the host’s and apply to everyone.'
    : 'Solo & hosted lobbies — in co-op your codes apply to everyone.';
  $('btn-cheats-all').style.display = guest ? 'none' : '';
  $('btn-cheats-none').style.display = guest ? 'none' : '';
  $('btn-titan').style.display = guest ? 'none' : '';
}
function bindCheatsUI() {
  for (const id of CHEAT_IDS) {
    const el = $('cheat-' + id);
    if (!el) continue;
    el.checked = !!cheats[id];
    el.addEventListener('change', () => {
      if (cheatsReadOnly()) { syncCheatsUI(); return; }
      audio.play('ui');
      cheats[id] = el.checked;
      // ARMED TO THE TEETH / WUNDERWAFFEN / custom loadout: pick ONE source of spawn guns
      if (el.checked && (id === 'papguns' || id === 'wunder')) {
        const other = id === 'papguns' ? 'wunder' : 'papguns';
        cheats[other] = false; $('cheat-' + other).checked = false;
        cheats.loadout = {};
        for (const wrap of document.querySelectorAll('.wpn-pick')) wrap._render?.();
      }
      saveCheats();
    });
  }
  buildWeaponPickers();
  $('btn-titan').addEventListener('click', () => {
    if (cheatsReadOnly()) return;
    Object.assign(cheats, {
      wunder: true, perkaholic: true, opensesame: true, warbond: true,
      god: true, power: true, tele: true,
      papguns: false, goldguns: false, zero: false, loadout: {},
    });
    saveCheats(); syncCheatsUI();
    audio.play('count_go');
    toast('TITAN MODE armed — God + Wunderwaffen + perks + 50k + power on + doors open + teleporters linked (no gold, no ghost town)');
  });
  const setAll = (v) => {
    if (cheatsReadOnly()) return;
    for (const id of CHEAT_IDS) { cheats[id] = v; const el = $('cheat-' + id); if (el) el.checked = v; }
    // ARMED TO THE TEETH and WUNDERWAFFEN are mutually exclusive — the checkbox
    // handler above enforces it, and applyCheats assumes it. Ticking both made
    // the spawn build a full set of view-models and then throw them away for a
    // second set on the most expensive frame of the session.
    if (v) { cheats.wunder = false; const w = $('cheat-wunder'); if (w) w.checked = false; }
    if (!v) cheats.loadout = {};
    else { cheats.loadout = {}; } // select-all never picks specific guns
    for (const wrap of document.querySelectorAll('.wpn-pick')) wrap._render?.();
    saveCheats(); audio.play('buy');
    // GHOST TOWN is in the set, so "everything on" means no zombies. Say so —
    // otherwise an empty factory reads as the game being broken.
    if (v) toast('Every code armed — including GHOST TOWN, so no zombies will spawn. Untick it for a normal run.');
  };
  $('btn-cheats-all').addEventListener('click', () => setAll(true));
  $('btn-cheats-none').addEventListener('click', () => setAll(false));
  $('btn-cheats-back').addEventListener('click', () => {
    audio.play('ui');
    showScreen(cheatsReturnTo);
    if (cheatsReturnTo === 'lobby') refreshLobbyUI();
  });
  const rEl = $('cheat-round');
  rEl.addEventListener('change', () => {
    if (cheatsReadOnly()) { syncCheatsUI(); return; }
    cheats.startRound = Math.max(1, Math.min(40, parseInt(rEl.value) || 1));
    rEl.value = cheats.startRound; saveCheats(); audio.play('ui');
  });
  const aEl = $('cheat-area');
  aEl.addEventListener('change', () => {
    if (cheatsReadOnly()) { syncCheatsUI(); return; }
    cheats.startArea = aEl.value; saveCheats(); audio.play('ui');
  });
}

function getName() {
  let n = localStorage.getItem(NAME_KEY);
  if (!n) {
    n = 'Soldier' + Math.floor(Math.random() * 900 + 100);
    localStorage.setItem(NAME_KEY, n);
  }
  return n;
}

const PUBLIC_SITE_URL = 'https://www.derkoloss.com';
function buildInviteLink(code, inviter = getName()) {
  const safeCode = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const safeInviter = String(inviter || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 14);
  return `${PUBLIC_SITE_URL}/invite/${encodeURIComponent(safeCode)}${safeInviter ? `?from=${encodeURIComponent(safeInviter)}` : ''}`;
}

// ---------------- app state ----------------
const app = {
  screen: 'menu', // menu | lobby | game
  game: null,
  net: null,
  hud: new HUD(),
  ready: false,
};
let canvas;
let lastTabT = 0; // last Tab press (scoreboard) — pointer-unlock guard
window.addEventListener('keydown', (e) => { if (e.code === 'Tab') lastTabT = performance.now(); }, { capture: true });

function showScreen(name) {
  for (const s of ['menu', 'lobby', 'options', 'pause', 'solo-fs-modal', 'join-modal', 'charselect', 'charpage', 'cheats']) $(s).classList.add('hidden');
  $('hud').classList.add('hidden');
  if (name === 'game') {
    $('hud').classList.remove('hidden');
    app.screen = 'game'; // was missing — broke every "am I in-game?" check (incl. click-to-relock)
    canvas?.classList.toggle('hidden', !shouldShowGameplayCanvas('game', !!app.game));
    canvas?.setAttribute('aria-hidden', String(!shouldShowGameplayCanvas('game', !!app.game)));
    return;
  }
  $(name).classList.remove('hidden');
  app.screen = name;
  const showCanvas = shouldShowGameplayCanvas(name, !!app.game);
  canvas?.classList.toggle('hidden', !showCanvas);
  canvas?.setAttribute('aria-hidden', String(!showCanvas));
}

// ---------------- options UI ----------------
function bindOptionsUI() {
  const bind = (id, key, fmt = (v) => v) => {
    const el = $(id);
    el.value = options[key];
    $(id + '-val').textContent = fmt(options[key]);
    el.addEventListener('input', () => {
      options[key] = parseFloat(el.value);
      if (key === 'master') { options.masterTouched = true; mpMasterOverride = null; }
      $(id + '-val').textContent = fmt(options[key]);
      saveOptions(options);
      applyOptions();
    });
  };
  bind('opt-sens', 'sensitivity', (v) => v.toFixed(2));
  bind('opt-fov', 'fov', (v) => Math.round(v));
  bind('opt-brightness', 'brightness', (v) => Math.round(v * 100) + '%');
  bind('opt-motionblur', 'motionBlur', (v) => (v <= 0.001 ? 'Off' : Math.round(v * 100) + '%'));
  bind('opt-master', 'master', (v) => Math.round(v * 100) + '%');
  bind('opt-sfx', 'sfx', (v) => Math.round(v * 100) + '%');
  bind('opt-music', 'music', (v) => Math.round(v * 100) + '%');
  bind('opt-voice', 'voice', (v) => Math.round(v * 100) + '%');
  const q = $('opt-quality');
  q.value = options.quality;
  q.addEventListener('change', () => { options.quality = q.value; saveOptions(options); applyOptions(); });
  const vc = $('opt-voicechat');
  vc.checked = options.voiceChat !== false;
  vc.addEventListener('change', () => { options.voiceChat = vc.checked; saveOptions(options); });
  const inv = $('opt-invert');
  inv.checked = options.invertY;
  inv.addEventListener('change', () => { options.invertY = inv.checked; saveOptions(options); });
  const nameEl = $('opt-name');
  nameEl.value = getName();
  nameEl.addEventListener('change', () => {
    const v = nameEl.value.trim().slice(0, 14) || getName();
    nameEl.value = v;
    localStorage.setItem(NAME_KEY, v);
  });
}

function applyOptions() {
  audio.setVolume('master', effectiveMaster());
  audio.setVolume('sfx', options.sfx);
  audio.setVolume('music', options.music);
  audio.setVolume('voice', options.voice);
  app.net?.setVoiceVolume(options.voice);
  if (app.game) {
    app.game.applyQuality();
    // Exposure lives in the post composite now; Game.render() reads
    // options.brightness every frame, so nothing to push here.
    if (app.game.player && !app.game.player.adsT) {
      app.game.camera.fov = options.fov;
      app.game.camera.updateProjectionMatrix();
    }
  }
}

// ---------------- lobby voice (mic permission + indicators + mutes) ----------------
let lobbyVoiceT = null;
async function enableLobbyVoice() {
  const net = app.net;
  if (!net) return;
  updateLobbyVoiceUI();
  if (net.lobbyVoiceEnabled) {
    audio.init();
    await net.enableVoice(); // prompt only after the host-enabled lobby policy arrives
  } else {
    net.disableVoice();
  }
  if (app.net !== net) return; // left while the prompt was open
  updateLobbyVoiceUI();
  startLobbyVoiceLoop();
}
function updateLobbyVoiceUI() {
  const net = app.net;
  const btn = $('btn-lobby-mic');
  const note = $('lobby-voice-note');
  if (!btn) return;
  if (!net) { btn.textContent = 'MIC: —'; if (note) note.textContent = ''; return; }
  btn.disabled = !net.isHost && !net.lobbyVoiceEnabled;
  if (!net.lobbyVoiceEnabled) {
    btn.textContent = 'VOICE: OFF';
    if (note) note.textContent = net.isHost ? 'host setting — guests will not be asked for microphone access' : 'disabled by host — no microphone permission needed';
    return;
  }
  if (net.voiceFailed && !net.myStream) { btn.textContent = 'MIC: BLOCKED'; if (note) note.textContent = 'click to retry (check browser permission)'; return; }
  btn.textContent = net.isHost ? 'VOICE: ON' : (net.micMuted ? 'MIC: MUTED' : 'MIC: ON');
  if (note) note.textContent = net.isHost
    ? 'host setting — guests are prompted only while voice is ON'
    : (net.myStream ? 'controlled by host · click to mute yourself' : 'requesting microphone…');
}
function startLobbyVoiceLoop() {
  stopLobbyVoiceLoop();
  lobbyVoiceT = setInterval(() => {
    const net = app.net;
    if (!net) { stopLobbyVoiceLoop(); return; }
    net.updateVoiceSpeaking();
    document.querySelectorAll('.lobby-spk[data-pid]').forEach((el) => {
      const id = el.dataset.pid;
      const on = id === net.myId ? net.mySpeaking
        : (net.voiceStreams.get(id)?.speaking && !net.mutedPeers.has(id));
      el.classList.toggle('on', !!on);
    });
  }, 200);
}
function stopLobbyVoiceLoop() { if (lobbyVoiceT) { clearInterval(lobbyVoiceT); lobbyVoiceT = null; } }

// ---------------- lobby countdown (CoD-style auto-start) ----------------
let countdownT = null;
let countdownLeft = 0;
function stopLobbyCountdown() {
  if (countdownT) { clearInterval(countdownT); countdownT = null; }
}
function syncLobbyCountdown() {
  const net = app.net;
  if (!shouldRefreshLobbyUi(app.screen, !!app.game)) { stopLobbyCountdown(); return; }
  if (!net || !net.lobbyPlayers.length) { stopLobbyCountdown(); return; }
  const n = net.lobbyPlayers.length;
  const ready = net.lobbyPlayers.filter((p) => p.ready).length;
  const majority = ready >= Math.floor(n / 2) + 1;
  if (majority && !countdownT) {
    const countdownNet = net;
    countdownLeft = 10;
    audio.play('count_tick');
    countdownT = setInterval(() => {
      if (app.net !== countdownNet || !shouldRefreshLobbyUi(app.screen, !!app.game)) {
        stopLobbyCountdown();
        return;
      }
      countdownLeft--;
      if (countdownLeft <= 0) {
        stopLobbyCountdown();
        if (app.net?.isHost && app.net.majorityReady()) {
          audio.play('count_go');
          app.net.startGame({ cheats });
        }
        return;
      }
      audio.play('count_tick');
      const hint = $('lobby-hint');
      if (hint) hint.textContent = `Starting in ${countdownLeft}s — unready to cancel.`;
    }, 1000);
  } else if (!majority && countdownT) {
    stopLobbyCountdown();
    refreshLobbyUI();
  }
}

// ---------------- lobby ----------------
function refreshLobbyUI() {
  const net = app.net;
  const players = net?.lobbyPlayers || [];
  // one-of-each marine: earliest claim wins; if mine collides, take a free one
  if (net) {
    const me = players.find((p) => p.id === net.myId);
    if (me) {
      const others = players.filter((p) => p.id !== net.myId);
      const taken = new Set(others.map((p) => p.persona));
      const mine = me.persona || getPersona();
      const earlierClaim = players.findIndex((p) => p.persona === mine) !== players.findIndex((p) => p.id === net.myId);
      if (earlierClaim) {
        const free = (PERSONAS.find((c) => !taken.has(c.id)) || PERSONAS[0]).id;
        setPersona(free);
        toast(`${PERSONAS.find((c) => c.id === mine)?.label} is taken — you're ${PERSONAS.find((c) => c.id === free)?.label} now`);
      }
    }
  }
  $('lobby-code').textContent = net?.code || '-----';
  if (net?.code) $('lobby-link').value = buildInviteLink(net.code);
  const rows = players.map((p) => {
    const col = CFG.COLORS[(p.color ?? 0) % 4];
    const self = p.id === net.myId;
    return `<div class="lobby-row">
      <span class="lobby-spk" data-pid="${escapeHtml(p.id)}" title="voice">●</span>
      <span class="lobby-name" style="color:${col}">${p.host ? '👑 ' : ''}${escapeHtml(p.name)}${self ? ' (you)' : ''}${p.persona ? ` · ${escapeHtml(PERSONAS.find((c) => c.id === p.persona)?.label || '')}` : ''}</span>
      ${self ? '' : `<button class="lobby-mute${net.mutedPeers.has(p.id) ? ' muted' : ''}" data-pid="${escapeHtml(p.id)}" title="Mute/unmute this player">${net.mutedPeers.has(p.id) ? '🔇' : '🔊'}</button>`}
      <span class="lobby-ready ${p.ready ? 'yes' : ''}">${p.ready ? 'READY' : 'NOT READY'}</span>
    </div>`;
  }).join('');
  $('lobby-players').innerHTML = rows;
  const isHost = net?.isHost;
  $('btn-start-game').classList.toggle('hidden', !isHost);
  $('btn-lobby-cheats').classList.remove('hidden');
  $('btn-lobby-cheats').textContent = isHost ? 'CHEAT CODES' : 'VIEW CHEAT CODES';
  if (isHost) {
    const can = net.majorityReady();
    $('btn-start-game').disabled = !can;
    $('lobby-hint').textContent = can
      ? 'Majority ready — starting soon (or start now).'
      : `Waiting for majority to ready up (${players.filter((p) => p.ready).length}/${players.length}, need ${Math.floor(players.length / 2) + 1})…`;
  } else {
    $('lobby-hint').textContent = countdownT ? $('lobby-hint').textContent : 'Waiting for the host to start…';
  }
  $('btn-ready').textContent = app.ready ? 'UNREADY' : 'READY UP';
  $('btn-ready').classList.toggle('ready', app.ready);
  updateLobbyVoiceUI();
  syncLobbyCountdown();
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function wireNetLobby() {
  const net = app.net;
  debugExpose('__net', net);
  net.onLobby = () => {
    if (app.net !== net || !shouldRefreshLobbyUi(app.screen, !!app.game)) return;
    refreshLobbyUI();
    void enableLobbyVoice();
    if (!$('cheats').classList.contains('hidden')) syncCheatsUI();
  };
  net.onStart = (payload) => {
    if (app.net !== net || app.game) return;
    stopLobbyCountdown();
    const mode = net.isHost ? 'host' : 'client';
    startGame(mode, net, payload.players, payload.cheats);
  };
  net.onClosed = (reason) => {
    exitToMenu();
    toast(reason || 'Connection lost.');
  };
}

// ---------------- menu music ----------------
let menuMusic = null;
function startMenuMusic() {
  if (menuMusic || app.game) return;
  audio.init();
  if (assets.audioReady) {
    const track = assets.sound('menu_music');
    menuMusic = audio.loopFile('menu_music', 0.42, 'music', getMenuMusicOffset(track?.duration));
    debugExpose('__menuMusicHandle', menuMusic);
  }
}
function stopMenuMusic() {
  if (menuMusic) {
    rememberMenuMusicPosition();
    menuMusic.stop(); menuMusic = null;
    debugExpose('__menuMusicHandle', null);
  }
}
function rememberMenuMusicPosition() {
  if (!menuMusic) return;
  const elapsed = Math.max(0, audio.ctx.currentTime - menuMusic.startedAt);
  keepMenuMusicClock((menuMusic.offset + elapsed) % menuMusic.duration);
}

// ---------------- game lifecycle ----------------
let assetsLoading = null;
async function ensureAssets(show = true) {
  if (assets.ready && assets.audioReady) return;
  if (show) $('loading').classList.remove('hidden');
  const bar = $('load-bar');
  if (!assetsLoading) {
    assetsLoading = (async () => {
      await assets.load((f) => { bar.style.width = `${Math.round(f * 70)}%`; });
      audio.init();
      await assets.loadAudio(audio.ctx);
      bar.style.width = '100%';
    })();
  }
  await assetsLoading;
  if (show) $('loading').classList.add('hidden');
}

function startGame(mode, net, lobbyPlayers, netCheats = null) {
  app.ready = false;
  stopMenuMusic();
  stopLobbyCountdown();
  stopLobbyVoiceLoop();
  setMpMasterOverride(mode !== 'solo'); // co-op: quiet game, clear voices
  const bootlog = ['startGame:' + mode];
  debugExpose('__bootlog', bootlog);
  // co-op: the host's cheat codes + settings apply to EVERYONE
  const effCheats = (mode === 'client' && netCheats) ? { ...netCheats } : cheats;
  ensureAssets().then(() => {
    bootlog.push('assets-done');
    const game = new Game({
      mode, net: mode === 'solo' ? null : net,
      options, hud: app.hud, cheats: effCheats,
      myName: getName(),
      lobbyPlayers: lobbyPlayers || [{ id: 'local', name: getName(), color: 0 }],
      onExit: (destination, message) => destination === 'lobby' ? returnToLobby(message) : exitToMenu(),
    });
    bootlog.push('game-ctor');
    app.game = game;
    debugExpose('__game', game);
    resetInputState();
    showScreen('game');
    app.hud.show();
    bootlog.push('pre-init');
    game.init(canvas);
    bootlog.push('init-done');
    applyOptions();
    lockPointer(canvas);
    toast(mode === 'solo' ? 'Survive. Good luck.'
      : mpMasterOverride != null ? 'Game started — master volume lowered to 15% so you can hear your team (change it in Options).'
      : 'Game started — good luck!');
  }).catch((e) => {
    if (DEBUG) bootlog.push('ERROR: ' + (e.stack || e.message));
    console.error('startGame failed', e);
    // showScreen('game') already ran, so without this the player is left on a
    // black canvas with a live HUD over a half-built Game and no way back but
    // ESC. Put them back where they came from instead.
    if (app.game) { try { app.game.dispose(); } catch (_) {} app.game = null; }
    app.hud.hide();
    unlockPointer();
    showScreen(mode === 'solo' ? 'menu' : 'lobby');
    if (mode === 'solo') startMenuMusic();
    toast('Failed to start: ' + e.message);
    $('loading').classList.add('hidden');
  });
}

function exitToMenu() {
  stopLobbyVoiceLoop();
  if (app.game) { app.game.dispose(); app.game = null; }
  setMpMasterOverride(false);
  app.hud.hide();
  unlockPointer();
  if (app.net) { app.net.leave(); app.net = null; }
  app.ready = false;
  showScreen('menu');
  startMenuMusic();
}

function returnToLobby(message = '') {
  stopLobbyCountdown();
  stopLobbyVoiceLoop();
  if (!app.net) { exitToMenu(); return; }
  if (app.game) { app.game.dispose(); app.game = null; }
  setMpMasterOverride(false);
  app.hud.hide();
  unlockPointer();
  resetInputState();
  app.ready = false;
  if (app.net.isHost) app.net.resetLobbyReady();
  else app.net.setReady(false);
  showScreen('lobby');
  refreshLobbyUI();
  startMenuMusic();
  void enableLobbyVoice();
  if (message) toast(message, 4500);
}

function pauseGame() {
  if (!app.game) return;
  app.game.setPaused(true);
  unlockPointer();
  const pauseMic = $('btn-pause-mic');
  pauseMic.classList.toggle('hidden', app.game.mode === 'solo');
  const voiceDisabled = !!app.net && !app.net.lobbyVoiceEnabled;
  pauseMic.disabled = voiceDisabled;
  pauseMic.textContent = voiceDisabled ? 'VOICE: DISABLED' : `MIC: ${app.net?.micMuted ? 'OFF' : 'ON'}`;
  $('btn-quit').textContent = app.game.mode === 'host' ? 'END GAME TO LOBBY' : app.game.mode === 'client' ? 'LEAVE GAME' : 'QUIT TO MENU';
  showScreen('pause');
  $('hud').classList.remove('hidden');
}
function resumeGame() {
  if (!app.game) return;
  clearPressed();
  showScreen('game');
  app.game.setPaused(false);
  lockPointer(canvas);
}

// ---------------- toast ----------------
let toastT = null;
function toast(msg, ms = 3200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.add('hidden'), ms);
}

// ---------------- boot ----------------
function boot() {
  canvas = $('game-canvas');
  debugExpose('__audio', audio);
  initInput(canvas);
  bindOptionsUI();
  bindCheatsUI();

  // audio unlock on first gesture + warm the asset cache for menu music (no overlay)
  const unlock = () => {
    audio.init();
    applyOptions();
    ensureAssets(false).then(() => startMenuMusic());
  };
  addEventListener('mousedown', unlock, { once: true });
  addEventListener('keydown', unlock, { once: true });
  // Attempt an immediate resume when arriving from another same-origin page.
  // Browsers that require a fresh gesture remain covered by the listeners above.
  unlock();

  // menu buttons
  document.querySelectorAll('.menu-link').forEach((link) => link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    audio.play('ui');
    rememberMenuMusicPosition();
    setTimeout(() => { location.href = link.href; }, 75);
  }));
  $('btn-more').addEventListener('click', () => {
    audio.play('ui');
    const panel = $('menu-more-links');
    const open = panel.classList.toggle('hidden') === false;
    $('btn-more').setAttribute('aria-expanded', String(open));
  });
  const startSolo = () => startGame('solo', null, null);
  $('btn-solo').addEventListener('click', () => {
    audio.play('ui');
    if (document.fullscreenElement) startSolo();
    else { showScreen('solo-fs-modal'); syncSoloFsUI(); }
  });
  $('btn-solo-fs-start').addEventListener('click', () => { audio.play('ui'); startSolo(); });
  $('btn-solo-fs-back').addEventListener('click', () => { audio.play('ui'); showScreen('menu'); });
  $('btn-host').addEventListener('click', async () => {
    audio.play('ui');
    const btn = $('btn-host');
    btn.disabled = true; btn.textContent = 'CREATING…';
    try {
      app.net = new Net();
      wireNetLobby();
      await app.net.host(getName());
      app.net.setLobbyCheats(cheats);
      // This is a room policy, not a guest-local preference. It is published
      // before anyone receives an invite and controls whether guests are ever
      // asked for microphone permission.
      app.net.setLobbyVoiceEnabled(options.voiceChat !== false);
      app.net.setPersona(getPersona());
      app.ready = false;
      showScreen('lobby');
      refreshLobbyUI();
      void enableLobbyVoice();
      $('lobby-link').value = buildInviteLink(app.net.code);
    } catch (e) {
      toast(e.message);
      app.net = null;
    }
    btn.disabled = false; btn.textContent = 'HOST LOBBY';
  });
  $('btn-join').addEventListener('click', () => {
    audio.play('ui');
    $('join-code').value = '';
    showScreen('join-modal');
    $('join-code').focus();
  });
  $('btn-options').addEventListener('click', () => { audio.play('ui'); showScreen('options'); });
  $('btn-cheats').addEventListener('click', () => { audio.play('ui'); openCheats('menu'); });
  $('btn-lobby-cheats').addEventListener('click', () => { audio.play('ui'); openCheats('lobby'); });
  $('btn-char').addEventListener('click', () => { audio.play('ui'); openCharSelect('menu'); });
  $('btn-char-back').addEventListener('click', () => { audio.play('ui'); showScreen(charReturnTo); if (charReturnTo === 'lobby') refreshLobbyUI(); });
  $('btn-char-page-back').addEventListener('click', () => { audio.play('ui'); openCharSelect(charReturnTo); });
  $('btn-char-pick').addEventListener('click', () => {
    audio.play('buy');
    setPersona(charPageId);
    showScreen(charReturnTo);
    if (charReturnTo === 'lobby') refreshLobbyUI();
    const picked = PERSONAS.find((p) => p.id === charPageId);
    toast(`${picked?.label} selected`);
  });
  $('btn-lobby-char').addEventListener('click', () => { audio.play('ui'); openCharSelect('lobby'); });
  // easy in-lobby rename (persisted + broadcast to everyone)
  const lobbyNameEl = $('lobby-name');
  lobbyNameEl.value = getName();
  lobbyNameEl.addEventListener('change', () => {
    const v = lobbyNameEl.value.trim().slice(0, 14) || getName();
    lobbyNameEl.value = v;
    localStorage.setItem(NAME_KEY, v);
    app.net?.setName(v);
    if (app.net?.code) $('lobby-link').value = buildInviteLink(app.net.code, v);
    audio.play('ui');
  });
  setPersona(getPersona());
  $('btn-options-back').addEventListener('click', () => { audio.play('ui'); showScreen(app.game ? 'pause' : 'menu'); if (app.game) $('hud').classList.remove('hidden'); });

  // join modal
  $('btn-join-cancel').addEventListener('click', () => { audio.play('ui'); showScreen('menu'); });
  const doJoin = async () => {
    const code = $('join-code').value.trim().toUpperCase();
    if (code.length < 4) { toast('Enter the lobby code.'); return; }
    const btn = $('btn-join-go');
    btn.disabled = true; btn.textContent = 'JOINING…';
    try {
      app.net = new Net();
      wireNetLobby();
      await app.net.join(code, getName());
      app.net.setPersona(getPersona());
      app.ready = false;
      showScreen('lobby');
      refreshLobbyUI();
      // lobbyVoiceEnabled remains false until the authenticated host snapshot
      // arrives; enableLobbyVoice therefore cannot prompt prematurely.
      void enableLobbyVoice();
      $('lobby-link').value = buildInviteLink(app.net.code);
    } catch (e) {
      toast(e.message);
      if (app.net) { app.net.leave(); app.net = null; }
      showScreen('menu');
    }
    btn.disabled = false; btn.textContent = 'JOIN';
  };
  $('btn-join-go').addEventListener('click', doJoin);
  $('join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });

  // lobby
  $('btn-ready').addEventListener('click', () => {
    audio.play('ui');
    app.ready = !app.ready;
    app.net?.setReady(app.ready);
    refreshLobbyUI();
  });
  $('btn-start-game').addEventListener('click', () => {
    audio.play('ui');
    if (app.net?.isHost && app.net.majorityReady()) {
      stopLobbyCountdown();
      app.net.startGame({ cheats });
    }
  });
  $('btn-leave-lobby').addEventListener('click', () => { audio.play('ui'); exitToMenu(); });
  // lobby voice: mute self / retry mic, and per-player mute buttons (delegated)
  $('btn-lobby-mic').addEventListener('click', async () => {
    audio.play('ui');
    const net = app.net;
    if (!net) return;
    if (net.isHost) {
      const enabled = net.setLobbyVoiceEnabled(!net.lobbyVoiceEnabled);
      options.voiceChat = enabled;
      saveOptions(options);
      updateLobbyVoiceUI();
      if (enabled) await enableLobbyVoice();
      else toast('Voice chat disabled for this lobby — guests will not be prompted.');
      return;
    }
    if (!net.lobbyVoiceEnabled) { toast('Voice chat is disabled by the host.'); return; }
    if (!net.myStream) {
      net.voiceFailed = false; // retry after a denied permission
      updateLobbyVoiceUI();
      await net.enableVoice();
      updateLobbyVoiceUI();
      return;
    }
    net.setMicMuted(!net.micMuted);
    updateLobbyVoiceUI();
  });
  $('lobby-players').addEventListener('click', (e) => {
    const b = e.target.closest('.lobby-mute');
    if (!b || !app.net) return;
    audio.play('ui');
    const id = b.dataset.pid;
    const m = !app.net.mutedPeers.has(id);
    app.net.mutePeer(id, m);
    b.textContent = m ? '🔇' : '🔊';
    b.classList.toggle('muted', m);
    toast(m ? 'Player muted (this session)' : 'Player unmuted');
  });
  $('btn-copy-link').addEventListener('click', async () => {
    audio.play('ui');
    const link = $('lobby-link').value;
    try { await navigator.clipboard.writeText(link); toast('Invite link copied — send it to your friend!'); }
    catch (e) { $('lobby-link').select(); toast('Select and copy the link manually.'); }
  });

  // pause
  $('btn-resume').addEventListener('click', () => { audio.play('ui'); resumeGame(); });
  $('btn-pause-options').addEventListener('click', () => { audio.play('ui'); showScreen('options'); });
  $('btn-quit').addEventListener('click', () => {
    audio.play('ui');
    if (app.game?.mode === 'host' && app.game.endMatchToLobby()) return;
    exitToMenu();
  });

  // fullscreen
  const isFs = () => !!document.fullscreenElement;
  function syncFsUI() {
    const on = isFs();
    $('btn-pause-fs').textContent = `FULLSCREEN: ${on ? 'ON' : 'OFF'}`;
    const lobbyFs = $('btn-lobby-fs');
    lobbyFs.textContent = on ? 'EXIT FULL SCREEN' : 'FULL SCREEN';
    lobbyFs.classList.toggle('fullscreen-callout', !on);
    lobbyFs.setAttribute('aria-pressed', String(on));
    syncSoloFsUI();
  }
  function syncSoloFsUI() {
    const button = $('btn-solo-fs-toggle');
    const start = $('btn-solo-fs-start');
    if (!button || !start) return;
    const on = isFs();
    button.textContent = on ? 'EXIT FULL SCREEN' : 'ENTER FULL SCREEN';
    button.classList.toggle('fullscreen-callout', !on);
    button.setAttribute('aria-pressed', String(on));
    start.textContent = on ? 'START GAME' : 'START WITHOUT FULL SCREEN';
  }
  async function toggleFullscreen() {
    try {
      if (isFs()) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (e) { /* browser denied — ignore */ }
  }
  document.addEventListener('fullscreenchange', syncFsUI);
  $('btn-pause-fs').addEventListener('click', () => { audio.play('ui'); toggleFullscreen(); });
  $('btn-lobby-fs').addEventListener('click', () => { audio.play('ui'); toggleFullscreen(); });
  $('btn-solo-fs-toggle').addEventListener('click', () => { audio.play('ui'); toggleFullscreen(); });
  syncFsUI();
  $('btn-pause-mic').addEventListener('click', () => {
    audio.play('ui');
    if (!app.game || !app.net?.lobbyVoiceEnabled) return;
    const m = !app.game.micMuted;
    app.game.setMicMuted(m);
    $('btn-pause-mic').textContent = `MIC: ${m ? 'OFF' : 'ON'}`;
  });

  // pointer lock loss => pause — EXCEPT when Tab (scoreboard) caused it: relock instantly
  input.onPointerUnlock = () => {
    const tabbing = input.keys['Tab'] || (lastTabT && performance.now() - lastTabT < 700);
    if (tabbing && app.game && app.screen === 'game') { lockPointer(canvas); return; }
    if (app.game && !app.game.over && app.screen === 'game') pauseGame();
  };

  // global keys
  input.onKey = (code) => {
    if (code === 'F11') { toggleFullscreen(); return; }
    if (code === 'Escape') {
      if (app.game && app.screen === 'game') {
        // not fullscreen (or browser already left lock): treat as pause
        if (document.pointerLockElement) unlockPointer();
        pauseGame();
      } else if (app.game && app.screen === 'pause') {
        resumeGame();
      } else if (app.screen === 'options' && app.game) {
        showScreen('pause');
        $('hud').classList.remove('hidden');
      }
    }
  };

  // canvas click re-locks pointer during play
  canvas.addEventListener('mousedown', () => {
    if (app.game && app.screen === 'game' && !input.locked) lockPointer(canvas);
  });
  // fallback: ANY click while in-game and unlocked re-locks (covers overlays swallowing canvas clicks)
  document.addEventListener('mousedown', (e) => {
    if (app.game && app.screen === 'game' && !app.game.paused && !app.game.over && !input.locked) {
      lockPointer(canvas);
    }
  });
  // Chrome can reject relock (ESC cooldown); keep hint visible until lock succeeds
  document.addEventListener('pointerlockerror', () => { syncLockHint(); });

  // "CLICK TO AIM" hint whenever we're in live gameplay without pointer lock
  const lockHint = $('lock-hint');
  function syncLockHint() {
    const need = !!(app.game && app.screen === 'game' && !app.game.paused && !app.game.over && !input.locked);
    lockHint.classList.toggle('hidden', !need);
  }
  document.addEventListener('pointerlockchange', syncLockHint);
  setInterval(syncLockHint, 400);

  // deep link: ?join=CODE
  const params = new URLSearchParams(location.search);
  const joinCode = params.get('join');
  const inviter = String(params.get('from') || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 14);
  if (joinCode) {
    showScreen('join-modal');
    $('join-code').value = joinCode.toUpperCase();
    $('btn-join-go').focus();
    toast(inviter ? `${inviter} invited you — press JOIN to drop in!` : 'Lobby invite detected — press JOIN to drop in!');
  } else {
    showScreen('menu');
  }
}

boot();

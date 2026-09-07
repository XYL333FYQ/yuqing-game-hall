import * as THREE from 'three';

// Asset Archive interactions: model inspection, recordings, filters, and playback.
import { WEAPONS, WeaponRig, getStats } from './weapons.js';
import { PERSONAS, LINES } from './personas.js';
import { initSiteAudio } from './site-audio.js?v=6';

const $ = (id) => document.getElementById(id);
const siteAudio = initSiteAudio();
const audio = new Audio();
audio.preload = 'metadata';

const CLASS_NAMES = {
  pistol: 'Pistols', smg: 'Submachine Guns', rifle: 'Rifles', shotgun: 'Shotguns',
  lmg: 'Light Machine Guns', sniper: 'Sniper Rifles', launcher: 'Launchers', wonder: 'Wonder Weapons',
};
const CLASS_ORDER = ['pistol', 'smg', 'rifle', 'shotgun', 'lmg', 'sniper', 'launcher', 'wonder'];
const weaponEntries = Object.entries(WEAPONS).filter(([, weapon]) => CLASS_ORDER.includes(weapon.cls));

let selectedId = 'm1911';
let classFilter = 'all';
let variantFilter = 'both';
let searchTerm = '';
let previewPap = false;
let finishMode = 'standard';
let activeSoundId = '';
let weaponInteractionActive = false;

// ElevenLabs-generated perk bottle shatter and deep soda belch.
const AUDIO_REVISIONS = Object.freeze({ bottle_break: 'perk-v4', belch: 'perk-v4' });
function soundUrl(id) { return `../assets/audio/${id}.mp3${AUDIO_REVISIONS[id] ? `?v=${AUDIO_REVISIONS[id]}` : ''}`; }
function formatTime(value) {
  if (!Number.isFinite(value)) return '0:00';
  const minutes = Math.floor(value / 60);
  return `${minutes}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}
function titleCase(value) {
  const names = {
    pap: 'Pack-a-Punch', dg2: 'Wunderwaffe DG-2', dtap: 'Double Tap', qr: 'Quick Revive',
    jug: 'Juggernog', zdeath: 'Zombie Death', magin: 'Magazine In', magout: 'Magazine Out',
    maxammo: 'Max Ammo', double: 'Double Points', insta: 'Insta-Kill',
    cellin: 'Power Cell In', cellout: 'Power Cell Out', boltopen: 'Bolt Open', boltclose: 'Bolt Close',
  };
  return value.split('_').map((word) => names[word] || word.replace(/(\d+)/, ' $1').replace(/^./, (c) => c.toUpperCase())).join(' ');
}

function clearPlayingButtons() {
  document.querySelectorAll('.sound-button.playing').forEach((button) => button.classList.remove('playing'));
}
function syncPlayingButtons() {
  clearPlayingButtons();
  if (audio.paused || !activeSoundId) return;
  document.querySelectorAll(`.sound-button[data-sound="${CSS.escape(activeSoundId)}"]`).forEach((button) => button.classList.add('playing'));
}
function playSound(id, title, kind = 'Archive audio', modelPap = null) {
  cancelWeaponInteraction('READY // SELECT A FIRE CONTROL');
  if (activeSoundId === id && !audio.paused) {
    audio.pause();
    return;
  }
  activeSoundId = id;
  audio.src = soundUrl(id);
  $('dock-title').textContent = title;
  $('dock-kind').textContent = kind.toUpperCase();
  $('audio-dock').classList.add('visible');
  $('dock-toggle').disabled = false;
  $('dock-scrub').disabled = false;
  if (modelPap !== null) {
    previewPap = modelPap;
    finishMode = modelPap ? 'pap' : 'standard';
    document.querySelectorAll('.finish-button').forEach((candidate) => candidate.classList.toggle('active', candidate.dataset.finish === finishMode));
    renderSelectedWeapon();
  }
  siteAudio.setDucked(true);
  audio.play().catch(() => siteAudio.setDucked(false));
}

audio.addEventListener('play', () => {
  siteAudio.setDucked(true);
  $('dock-toggle').textContent = '❚❚';
  $('dock-toggle').setAttribute('aria-label', 'Pause audio');
  syncPlayingButtons();
});
audio.addEventListener('pause', () => {
  if (!weaponInteractionActive) siteAudio.setDucked(false);
  $('dock-toggle').textContent = '▶';
  $('dock-toggle').setAttribute('aria-label', 'Play audio');
  syncPlayingButtons();
});
audio.addEventListener('ended', () => { siteAudio.setDucked(false); clearPlayingButtons(); });
audio.addEventListener('loadedmetadata', () => { $('dock-duration').textContent = formatTime(audio.duration); });
audio.addEventListener('timeupdate', () => {
  $('dock-current').textContent = formatTime(audio.currentTime);
  $('dock-scrub').value = audio.duration ? String((audio.currentTime / audio.duration) * 100) : '0';
});
$('dock-toggle').addEventListener('click', () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); });
$('dock-scrub').addEventListener('input', (event) => {
  if (audio.duration) audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
});

function makeSoundButton({ id, label, kind, modelPap = null }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-button';
  button.dataset.sound = id;
  button.dataset.uiSound = 'off';
  button.textContent = label;
  button.addEventListener('click', () => playSound(id, label, kind, modelPap));
  return button;
}

// ---------------------------------------------------------------------------
// Interactive armory model
// ---------------------------------------------------------------------------
const canvas = $('weapon-canvas');
const canvasWrap = $('weapon-canvas-wrap');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 50);
// Eye height and the height the model is mounted at are the SAME number on
// purpose — the model's measured centre then lands exactly on the optical
// centre of the frame. Two different constants here is how the framing drifts.
const STAGE_EYE_Y = 0.06;
camera.position.set(0, STAGE_EYE_Y, 3.1);
scene.add(new THREE.HemisphereLight(0xc7d2df, 0x24140e, 1.25));
scene.add(new THREE.AmbientLight(0xffffff, 1.15));
const keyLight = new THREE.DirectionalLight(0xffead0, 3.2);
keyLight.position.set(3, 4, 4);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xa31f27, 4.5);
rimLight.position.set(-4, 1, -3);
scene.add(rimLight);
const modelPivot = new THREE.Group();
scene.add(modelPivot);

const rigCamera = new THREE.PerspectiveCamera();
const weaponRig = new WeaponRig(rigCamera);
weaponRig.hipPos.set(0, 0, 0);
let currentMount = null;
let yaw = -0.28;
let pitch = -0.12;
let dragging = false;
let lastX = 0;
let lastY = 0;
let lastInteraction = 0;

// The pose the archive holds the weapon in: no aim, no movement, no sway. The
// render loop feeds these same values every frame, so a rig settled with them
// is in exactly the pose that will be drawn.
const REST_POSE = { ads: false, moving: false, sprinting: false, mouseX: 0, mouseY: 0 };

// Bounds of what is actually ON SCREEN. Box3.setFromObject() does not test
// `visible` and does not skip sprites, so a plain box here swallows the hidden
// gloves and the zero-opacity muzzle flash and centres the weapon against
// geometry nobody can see.
function visibleBounds(root) {
  const box = new THREE.Box3();
  const scratch = new THREE.Box3();
  (function walk(object, parentVisible) {
    const visible = parentVisible && object.visible;
    if (visible && object.isMesh && !object.isSprite && object.geometry) {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      box.union(scratch.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld));
    }
    for (const child of object.children) walk(child, visible);
  })(root, true);
  return box;
}

function setModel(id, pap, finish = finishMode) {
  const weaponChanged = weaponRig.current?.id !== id;
  if (currentMount) modelPivot.remove(currentMount);
  weaponRig.alwaysGold = false;
  weaponRig.diamondNext = finish === 'diamond';
  weaponRig.equip(id, pap);
  weaponRig.equipT = 1;
  if (finish === 'gold') weaponRig.applyGoldCamo(true);
  if (finish === 'diamond' && !weaponRig.diamondCamo) weaponRig.applyDiamondCamo();
  const model = weaponRig.current.group;
  // The archive presents the weapon alone, so the gloves come off. Test the
  // glove flag, NOT the part name: a name prefix of "hand" also matches
  // `handguard` and `handle`, which took the wooden forend and the carry handle
  // off fifteen weapons and left the front end hanging in space.
  model.traverse((o) => { if (o.userData?.isGlove) o.visible = false; });
  // Settle the rig into its rest pose BEFORE measuring. equip() leaves the
  // weapon in the lowered holster pose it rises out of, and the first update()
  // of the render loop lifts it back up — so a box taken here without this
  // call is stale by the height of that raise. The error is then multiplied by
  // the fit scale below, which is why it threw the small guns (scaled ~3x)
  // clean off the top of the frame and left the rifles sitting high.
  weaponRig.update(0, REST_POSE);
  model.removeFromParent();
  model.updateMatrixWorld(true);
  const box = visibleBounds(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z, 0.01);
  const scale = 1.28 / longest;
  const centerMount = new THREE.Group();
  centerMount.position.copy(center).multiplyScalar(-1);
  centerMount.add(model);
  const orientationMount = new THREE.Group();
  orientationMount.rotation.y = Math.PI / 2;
  orientationMount.add(centerMount);
  currentMount = new THREE.Group();
  currentMount.scale.setScalar(scale);
  currentMount.position.y = STAGE_EYE_Y;
  currentMount.add(orientationMount);
  modelPivot.clear();
  modelPivot.add(currentMount);
  if (weaponChanged) {
    yaw = -0.28;
    pitch = -0.12;
  }
}

canvasWrap.addEventListener('pointerdown', (event) => {
  dragging = true; lastX = event.clientX; lastY = event.clientY; lastInteraction = performance.now();
  canvasWrap.setPointerCapture(event.pointerId);
});
canvasWrap.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  yaw += (event.clientX - lastX) * 0.008;
  pitch = THREE.MathUtils.clamp(pitch + (event.clientY - lastY) * 0.006, -0.65, 0.65);
  lastX = event.clientX; lastY = event.clientY; lastInteraction = performance.now();
});
canvasWrap.addEventListener('pointerup', (event) => { dragging = false; lastInteraction = performance.now(); canvasWrap.releasePointerCapture(event.pointerId); });
canvasWrap.addEventListener('pointercancel', () => { dragging = false; });

function resizeRenderer() {
  const rect = canvasWrap.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resizeRenderer).observe(canvasWrap);
resizeRenderer();

let lastFrame = performance.now();
function renderFrame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (!dragging && now - lastInteraction > 1700 && !matchMedia('(prefers-reduced-motion: reduce)').matches) yaw += dt * 0.22;
  weaponRig.update(dt, REST_POSE);
  modelPivot.rotation.set(pitch, yaw, 0.03);
  renderer.render(scene, camera);
  requestAnimationFrame(renderFrame);
}
requestAnimationFrame(renderFrame);

// ---------------------------------------------------------------------------
// Armory filters and selection
// ---------------------------------------------------------------------------
function renderClassFilters() {
  const host = $('class-filters');
  host.replaceChildren();
  [{ id: 'all', label: 'All' }, ...CLASS_ORDER.map((id) => ({ id, label: CLASS_NAMES[id] }))].forEach(({ id, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-button${id === classFilter ? ' active' : ''}`;
    button.textContent = label;
    button.setAttribute('aria-pressed', String(id === classFilter));
    button.addEventListener('click', () => {
      classFilter = id;
      renderClassFilters();
      reconcileSelectedWeapon();
      renderWeaponGrid();
    });
    host.append(button);
  });
}

function visibleWeapons() {
  return weaponEntries.filter(([, weapon]) => {
    const classMatch = classFilter === 'all' || weapon.cls === classFilter;
    const haystack = `${weapon.name} ${weapon.pap?.name || ''} ${CLASS_NAMES[weapon.cls]}`.toLowerCase();
    return classMatch && haystack.includes(searchTerm);
  });
}
function reconcileSelectedWeapon() {
  const entries = visibleWeapons();
  if (!entries.length || entries.some(([id]) => id === selectedId)) return;
  cancelWeaponInteraction();
  selectedId = entries[0][0];
  previewPap = variantFilter === 'pap';
  renderSelectedWeapon();
}
function renderWeaponGrid() {
  const host = $('weapon-grid');
  host.replaceChildren();
  const entries = visibleWeapons();
  $('weapon-result-count').textContent = `${entries.length} ${entries.length === 1 ? 'WEAPON' : 'WEAPONS'}`;
  entries.forEach(([id, weapon]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `weapon-card${id === selectedId ? ' active' : ''}`;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(id === selectedId));
    button.dataset.weaponId = id;
    button.innerHTML = `<b>${weapon.name}</b><span>${CLASS_NAMES[weapon.cls]} · ${weapon.pap?.name || 'No upgrade record'}</span>`;
    button.addEventListener('click', () => {
      cancelWeaponInteraction();
      selectedId = id;
      previewPap = variantFilter === 'pap';
      renderWeaponGrid();
      renderSelectedWeapon();
      if (innerWidth < 801) $('weapon-canvas-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    host.append(button);
  });
  $('weapon-empty').classList.toggle('visible', entries.length === 0);
}
function statValue(value, suffix = '') { return value == null ? '—' : `${value}${suffix}`; }
function previewUsesPap() {
  return finishMode === 'pap' || finishMode === 'diamond'
    || (finishMode === 'standard' && (variantFilter === 'pap' || (variantFilter === 'both' && previewPap)));
}

const ammoByLoadout = new Map();
const shotPools = new Map();
let fireSession = null;
let reloadTimers = [];
let reloadCompleteTimer = null;
let reloadToken = 0;

function ammoState(id, pap) {
  const key = `${id}:${pap ? 'pap' : 'normal'}`;
  if (!ammoByLoadout.has(key)) {
    const stats = getStats(id, pap);
    ammoByLoadout.set(key, {
      magazine: Math.max(0, stats.mag || 0),
      capacity: Math.max(0, stats.mag || 0),
      reserve: Math.max(0, stats.reserve || 0),
    });
  }
  return ammoByLoadout.get(key);
}

function setWeaponStatus(message, state = '') {
  $('weapon-status').textContent = message;
  $('weapon-status').classList.toggle('firing', state === 'firing');
}

function updateWeaponStats(pap) {
  const stats = getStats(selectedId, pap);
  const ammo = ammoState(selectedId, pap);
  $('weapon-stats').innerHTML = [
    ['DAMAGE', statValue(stats.dmg)], ['RATE', statValue(stats.rpm, ' RPM')],
    ['MAGAZINE', `${ammo.magazine} / ${ammo.capacity}`], ['RESERVE', statValue(ammo.reserve)],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function updateWeaponPresentation(pap, resetModel = true) {
  const weapon = WEAPONS[selectedId];
  const stats = getStats(selectedId, pap);
  $('weapon-class').textContent = `${CLASS_NAMES[weapon.cls]} // ${pap ? 'Pack-a-Punch' : 'Standard issue'}`;
  $('weapon-name').textContent = pap ? weapon.pap?.name || weapon.name : weapon.name;
  $('pap-name').textContent = pap ? `Original designation: ${weapon.name}` : `Upgrade: ${weapon.pap?.name || 'No record'}`;
  updateWeaponStats(pap);
  $('fire-instruction').textContent = stats.auto
    ? `Press and hold to fire at ${stats.rpm} RPM. The weapon reloads automatically when empty.`
    : 'Press to fire one shot. Reload manually or when the magazine is empty.';
  if (resetModel) setModel(selectedId, pap, finishMode);
}

function activateFireVariant(pap) {
  previewPap = pap;
  finishMode = pap ? 'pap' : 'standard';
  document.querySelectorAll('.finish-button').forEach((button) => button.classList.toggle('active', button.dataset.finish === finishMode));
  updateWeaponPresentation(pap);
}

function pooledShot(soundId) {
  let pool = shotPools.get(soundId);
  if (!pool) {
    pool = { index: 0, sounds: Array.from({ length: 8 }, () => {
      const shot = new Audio(soundUrl(soundId));
      shot.preload = 'auto';
      shot.volume = 0.86;
      return shot;
    }) };
    shotPools.set(soundId, pool);
  }
  const shot = pool.sounds[pool.index++ % pool.sounds.length];
  shot.currentTime = 0;
  shot.play().catch(() => {});
}

function showLiveDock(title, kind) {
  $('audio-dock').classList.add('visible');
  $('dock-title').textContent = title;
  $('dock-kind').textContent = kind.toUpperCase();
  $('dock-toggle').textContent = '•';
  $('dock-toggle').disabled = true;
  $('dock-scrub').disabled = true;
  $('dock-current').textContent = 'LIVE';
  $('dock-duration').textContent = '';
  $('dock-scrub').value = '0';
}

function clearReloadTimers() {
  reloadTimers.forEach(clearTimeout);
  reloadTimers = [];
  clearTimeout(reloadCompleteTimer);
  reloadCompleteTimer = null;
  reloadToken += 1;
}

function finishFireSession(message = 'READY // RELEASED') {
  if (!fireSession) return;
  clearTimeout(fireSession.timer);
  fireSession.button?.classList.remove('firing');
  fireSession = null;
  weaponInteractionActive = false;
  siteAudio.setDucked(false);
  setWeaponStatus(message);
}

function cancelWeaponInteraction(message = 'READY // SELECT A FIRE CONTROL') {
  clearReloadTimers();
  if (fireSession) {
    clearTimeout(fireSession.timer);
    fireSession.button?.classList.remove('firing');
    fireSession = null;
  }
  weaponInteractionActive = false;
  siteAudio.setDucked(false);
  if ($('weapon-status')) setWeaponStatus(message);
}

function completeReload(id, pap) {
  const ammo = ammoState(id, pap);
  const needed = Math.max(0, ammo.capacity - ammo.magazine);
  const loaded = Math.min(needed, ammo.reserve);
  ammo.magazine += loaded;
  ammo.reserve -= loaded;
  if (id === selectedId) updateWeaponStats(pap);
  return loaded;
}

function playReloadSequence(id, pap = previewUsesPap(), onComplete = null) {
  clearReloadTimers();
  const token = reloadToken;
  audio.pause();
  activeSoundId = '';
  clearPlayingButtons();
  weaponInteractionActive = true;
  siteAudio.setDucked(true);
  const weapon = WEAPONS[id];
  const stats = getStats(id, pap);
  const duration = Math.max(0.1, stats.reload || weapon.reload || 0.1);
  weaponRig.startReload(duration);
  showLiveDock(`${pap ? weapon.pap?.name || weapon.name : weapon.name} // Reload sequence`, 'Weapon handling');
  setWeaponStatus(`RELOADING // ${duration.toFixed(1)} SECONDS`);
  (weapon.reloadStages || []).forEach(([fraction, soundId]) => {
    reloadTimers.push(setTimeout(() => {
      if (token !== reloadToken) return;
      const stageAudio = new Audio(soundUrl(soundId));
      stageAudio.volume = 0.9;
      stageAudio.play().catch(() => {});
    }, fraction * duration * 1000));
  });
  reloadCompleteTimer = setTimeout(() => {
    if (token !== reloadToken) return;
    const loaded = completeReload(id, pap);
    onComplete?.(loaded);
    if (!fireSession) {
      weaponInteractionActive = false;
      siteAudio.setDucked(false);
      const ammo = ammoState(id, pap);
      if (loaded) setWeaponStatus(`READY // ${loaded} ROUNDS LOADED`);
      else if (ammo.magazine >= ammo.capacity) setWeaponStatus('READY // RELOAD SEQUENCE COMPLETE');
      else setWeaponStatus('EMPTY // NO RESERVE AMMUNITION');
    }
  }, duration * 1000 + 40);
}

function fireNextRound() {
  const session = fireSession;
  if (!session || session.id !== selectedId || session.reloading) return;
  const weapon = WEAPONS[session.id];
  const stats = getStats(session.id, session.pap);
  const ammo = ammoState(session.id, session.pap);
  if (ammo.magazine <= 0) {
    if (ammo.reserve <= 0) {
      pooledShot('dry');
      finishFireSession('EMPTY // NO RESERVE AMMUNITION');
      return;
    }
    session.reloading = true;
    playReloadSequence(session.id, session.pap, (loaded) => {
      if (!fireSession || fireSession !== session) return;
      session.reloading = false;
      if (loaded > 0 && session.held) fireNextRound();
      else finishFireSession(loaded ? 'READY // RELOAD COMPLETE' : 'EMPTY // NO RESERVE AMMUNITION');
    });
    return;
  }

  weaponRig.fire();
  pooledShot(`${weapon.sfx}${session.pap ? '_pap' : ''}`);
  ammo.magazine -= 1;
  updateWeaponStats(session.pap);
  setWeaponStatus(`FIRING // ${ammo.magazine} OF ${ammo.capacity} ROUNDS`, 'firing');

  const delay = Math.max(45, 60000 / Math.max(1, stats.rpm || 60));
  if (stats.auto && session.held) {
    session.timer = setTimeout(fireNextRound, delay);
  } else if (ammo.magazine === 0 && ammo.reserve > 0) {
    session.timer = setTimeout(fireNextRound, delay);
  } else {
    session.timer = setTimeout(() => finishFireSession(`READY // ${ammo.magazine} ROUNDS REMAIN`), Math.min(240, delay));
  }
}

function startFiring(pap, button, held = true, preserveFinish = false) {
  cancelWeaponInteraction();
  if (!preserveFinish) activateFireVariant(pap);
  audio.pause();
  activeSoundId = '';
  clearPlayingButtons();
  weaponInteractionActive = true;
  siteAudio.setDucked(true);
  const weapon = WEAPONS[selectedId];
  const stats = getStats(selectedId, pap);
  fireSession = { id: selectedId, pap, held, button, timer: null, reloading: false };
  button.classList.add('firing');
  const finishLabel = preserveFinish && (finishMode === 'diamond' || finishMode === 'gold')
    ? `${finishMode} finish`
    : (pap ? 'Pack-a-Punch' : CLASS_NAMES[weapon.cls]);
  showLiveDock(`${pap ? weapon.pap?.name || weapon.name : weapon.name} // Live fire`, finishLabel);
  setWeaponStatus(stats.auto ? 'FIRING // HOLD TO CONTINUE' : 'FIRING // SINGLE SHOT', 'firing');
  fireNextRound();
}

function releaseFiring(button) {
  if (!fireSession || fireSession.button !== button) return;
  fireSession.held = false;
  clearTimeout(fireSession.timer);
  if (!fireSession.reloading) finishFireSession('READY // TRIGGER RELEASED');
}

function bindFireControl(button, pap, { preserveFinish = false } = {}) {
  let lastActivation = 0;
  button.dataset.uiSound = 'off';
  button.setAttribute('aria-label', `${button.textContent}. Press${WEAPONS[selectedId].auto ? ' and hold' : ''} to fire.`);
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    lastActivation = performance.now();
    button.setPointerCapture?.(event.pointerId);
    startFiring(pap, button, true, preserveFinish);
  });
  button.addEventListener('pointerup', () => releaseFiring(button));
  button.addEventListener('pointercancel', () => releaseFiring(button));
  button.addEventListener('lostpointercapture', () => releaseFiring(button));
  button.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      lastActivation = performance.now();
      startFiring(pap, button, true, preserveFinish);
    }
  });
  button.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') releaseFiring(button);
  });
  button.addEventListener('click', () => {
    if (performance.now() - lastActivation > 350) startFiring(pap, button, false, preserveFinish);
  });
}

function makeWeaponFireButton(pap) {
  const weapon = WEAPONS[selectedId];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-button weapon-fire-button';
  button.textContent = `${pap ? weapon.pap?.name || weapon.name : weapon.name} // ${pap ? 'Pack-a-Punch' : 'Normal'} fire`;
  bindFireControl(button, pap);
  return button;
}

function renderSelectedWeapon() {
  cancelWeaponInteraction();
  const pap = previewUsesPap();
  updateWeaponPresentation(pap);
  const soundHost = $('weapon-audio');
  soundHost.replaceChildren();
  if (variantFilter !== 'pap') soundHost.append(makeWeaponFireButton(false));
  if (variantFilter !== 'normal') soundHost.append(makeWeaponFireButton(true));
  const actions = document.createElement('div');
  actions.className = 'weapon-action-row';
  const shoot = document.createElement('button');
  shoot.type = 'button'; shoot.className = 'weapon-action'; shoot.textContent = 'Fire animation';
  bindFireControl(shoot, pap, { preserveFinish: true });
  const reload = document.createElement('button');
  reload.type = 'button'; reload.className = 'weapon-action'; reload.textContent = 'Reload sequence';
  reload.dataset.uiSound = 'off';
  reload.addEventListener('click', () => {
    cancelWeaponInteraction();
    const activePap = previewUsesPap();
    playReloadSequence(selectedId, activePap);
  });
  const inspect = document.createElement('button');
  inspect.type = 'button'; inspect.className = 'weapon-action'; inspect.textContent = 'Inspect finish';
  inspect.addEventListener('click', () => weaponRig.startInspect());
  const rotate = document.createElement('button');
  rotate.type = 'button'; rotate.className = 'weapon-action'; rotate.textContent = 'Reset view';
  rotate.addEventListener('click', () => { yaw = -0.28; pitch = -0.12; lastInteraction = 0; });
  actions.append(shoot, reload, inspect, rotate);
  soundHost.append(actions);
  syncPlayingButtons();
}

document.querySelectorAll('.finish-button').forEach((button) => {
  button.addEventListener('click', () => {
    cancelWeaponInteraction();
    finishMode = button.dataset.finish;
    previewPap = finishMode === 'pap' || finishMode === 'diamond';
    document.querySelectorAll('.finish-button').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    renderSelectedWeapon();
  });
});

document.querySelectorAll('.variant-button').forEach((button) => {
  button.addEventListener('click', () => {
    cancelWeaponInteraction();
    variantFilter = button.dataset.variant;
    previewPap = variantFilter === 'pap';
    if (variantFilter === 'normal' && (finishMode === 'pap' || finishMode === 'diamond')) finishMode = 'standard';
    if (variantFilter === 'pap' && (finishMode === 'standard' || finishMode === 'gold')) finishMode = 'pap';
    document.querySelectorAll('.finish-button').forEach((candidate) => candidate.classList.toggle('active', candidate.dataset.finish === finishMode));
    document.querySelectorAll('.variant-button').forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle('active', active);
      candidate.setAttribute('aria-pressed', String(active));
    });
    renderSelectedWeapon();
  });
});
$('weapon-search').addEventListener('input', (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  reconcileSelectedWeapon();
  renderWeaponGrid();
});

$('weapon-grid').addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const buttons = [...$('weapon-grid').querySelectorAll('.weapon-card')];
  const current = buttons.indexOf(document.activeElement);
  if (current < 0) return;
  event.preventDefault();
  const next = event.key === 'ArrowDown' ? Math.min(buttons.length - 1, current + 1) : Math.max(0, current - 1);
  buttons[next]?.focus();
  buttons[next]?.click();
});

// ---------------------------------------------------------------------------
// Voice and effects catalog
// ---------------------------------------------------------------------------
function renderGroup(host, title, sounds) {
  const section = document.createElement('section');
  section.className = 'sound-group';
  const head = document.createElement('div');
  head.className = 'sound-group-head';
  head.innerHTML = `<h3>${title}</h3><span class="sound-group-count">${String(sounds.length).padStart(2, '0')} RECORDINGS</span>`;
  const list = document.createElement('div');
  list.className = 'sound-list';
  sounds.forEach((sound) => list.append(makeSoundButton(sound)));
  section.append(head, list);
  host.append(section);
}

function voiceSounds(persona) {
  const events = LINES[persona.id];
  return Object.entries(events).flatMap(([event, lines]) => lines.map((line, index) => ({
    id: `vox_${persona.id}_${event}${index + 1}`,
    label: `${titleCase(event)} ${index + 1} // “${line}”`,
    kind: persona.label,
  })));
}
PERSONAS.forEach((persona) => renderGroup($('voice-groups'), persona.label, voiceSounds(persona)));

const EFFECT_GROUPS = [
  ['Weapon Handling', [
    'dry', 'melee', 'knuckles', 'grenade', 'shot_rocket', 'shot_rifle', 'shot_smg', 'shot_lmg', 'shot_shotgun', 'shot_sniper',
    'reload_bolt', 'reload_mag', 'reload_shell', 'rel_magout', 'rel_magin', 'rel_boltopen', 'rel_boltclose', 'rel_slide',
    'rel_charge', 'rel_shell', 'rel_clip', 'rel_open', 'rel_close', 'rel_cellout', 'rel_cellin', 'rel_belt', 'rel_cover',
    'rel_rocket', 'rel_pump', 'rel_ping', 'bolt_kar98_out', 'bolt_kar98_in', 'bolt_mosin_out', 'bolt_mosin_in',
    'bolt_springfield_out', 'bolt_springfield_in', 'inspect_rifle', 'inspect_smg', 'inspect_pistol', 'inspect_sniper',
    'inspect_lmg', 'inspect_shotgun', 'inspect_wonder', 'inspect_launcher',
  ]],
  ['The Undead', [
    ...Array.from({ length: 10 }, (_, index) => `groan${index + 1}`),
    ...Array.from({ length: 4 }, (_, index) => `snarl${index + 1}`),
    ...Array.from({ length: 4 }, (_, index) => `zdeath${index + 1}`),
    'dog_growl', 'dog_growl2', 'dog_howl',
  ]],
  ['Factory & Field', [
    'ambience', 'step1', 'step2', 'step3', 'step4', 'hurt', 'hurt1', 'hurt2', 'hurt3', 'revive', 'hitmarker', 'explosion',
    'board_tear', 'board_build', 'door_open', 'power', 'teleporter', 'tele_zap', 'trap', 'pap', 'pap_insert', 'pap_zap',
    'pap_done', 'box_spin', 'teddy', 'monkey_windup', 'monkey_cymbal', 'buy', 'deny', 'ui',
  ]],
  ['Rounds & Power-Ups', [
    'round_start', 'round_end', 'gameover', 'count_tick', 'count_go',
    'ann_nuke', 'ann_maxammo', 'ann_double', 'ann_insta', 'ann_dogs',
  ]],
  ['Perk Machines', ['drink', 'bottle_break', 'belch', 'perk_jug', 'perk_speed', 'perk_dtap', 'perk_qr']],
  ['Music & Atmosphere', ['menu_music', 'music_box']],
];
EFFECT_GROUPS.forEach(([title, ids]) => renderGroup($('effect-groups'), title, ids.map((id) => ({ id, label: titleCase(id), kind: title }))));
$('original-music-control').textContent = '原仓库中的商业录音未取得再发布许可，雨晴游戏厅版本已移除。';

renderClassFilters();
renderWeaponGrid();
renderSelectedWeapon();

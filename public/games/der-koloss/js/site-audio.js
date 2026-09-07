const MUSIC_CLOCK_KEY = 'der_koloss_menu_music_clock_v1';
const MUSIC_URL = 'assets/audio/menu_music.mp3';
const UI_URL = 'assets/audio/ui.mp3';
const SUCCESS_URL = 'assets/audio/buy.mp3';

function readClock() {
  try {
    const value = JSON.parse(sessionStorage.getItem(MUSIC_CLOCK_KEY));
    if (Number.isFinite(value?.position) && Number.isFinite(value?.savedAt)) return value;
  } catch (error) { /* start a fresh clock */ }
  return null;
}

function writeClock(position) {
  try { sessionStorage.setItem(MUSIC_CLOCK_KEY, JSON.stringify({ position, savedAt: Date.now() })); }
  catch (error) { /* storage may be unavailable in privacy modes */ }
}

export function getMenuMusicOffset(duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const clock = readClock();
  if (!clock) { writeClock(0); return 0; }
  return (clock.position + Math.max(0, Date.now() - clock.savedAt) / 1000) % duration;
}

export function keepMenuMusicClock(position) {
  if (Number.isFinite(position) && position >= 0) writeClock(position);
}

export function syncMenuMusicElement(element) {
  let positioned = false;
  const position = () => {
    if (positioned || !Number.isFinite(element.duration) || element.duration <= 0) return;
    element.currentTime = getMenuMusicOffset(element.duration);
    positioned = true;
  };
  element.addEventListener('loadedmetadata', position, { once: true });
  element.addEventListener('timeupdate', () => keepMenuMusicClock(element.currentTime));
  if (element.readyState >= 1) position();
  return element;
}

let sharedSiteAudio = null;

export function initSiteAudio({ musicVolume = 0.22, uiVolume = 0.5 } = {}) {
  if (sharedSiteAudio) return sharedSiteAudio;

  const music = syncMenuMusicElement(new Audio(MUSIC_URL));
  music.loop = true;
  music.preload = 'auto';
  music.volume = musicVolume;

  const ui = new Audio(UI_URL);
  ui.preload = 'auto';
  ui.volume = uiVolume;

  const success = new Audio(SUCCESS_URL);
  success.preload = 'auto';
  success.volume = Math.min(0.62, uiVolume + 0.08);

  let ducked = false;
  const applyMusicVolume = () => {
    music.volume = ducked ? Math.min(0.065, musicVolume * 0.3) : musicVolume;
    document.documentElement.dataset.siteAudioDucked = String(ducked);
  };
  const startMusic = () => {
    document.documentElement.dataset.siteMusic = 'attempting';
    return music.play().catch(() => {
      document.documentElement.dataset.siteMusic = 'blocked';
    });
  };
  const playUi = () => {
    document.documentElement.dataset.siteUi = 'played';
    ui.currentTime = 0;
    ui.play().catch(() => {});
  };
  const playSuccess = () => {
    document.documentElement.dataset.siteSuccess = 'played';
    success.currentTime = 0;
    success.play().catch(() => {});
  };

  startMusic();
  document.documentElement.dataset.siteAudio = 'ready';
  document.documentElement.dataset.siteAudioDucked = 'false';
  music.addEventListener('play', () => { document.documentElement.dataset.siteMusic = 'playing'; });
  music.addEventListener('pause', () => { document.documentElement.dataset.siteMusic = 'paused'; });
  document.addEventListener('pointerdown', startMusic, { once: true, capture: true });
  document.addEventListener('keydown', startMusic, { once: true, capture: true });

  document.addEventListener('click', (event) => {
    const control = event.target.closest('button, a[href], input[type="search"], [role="button"]');
    if (!control || control.disabled) return;
    if (control.dataset.uiSound !== 'off') playUi();

    const link = control.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin) return;
    event.preventDefault();
    keepMenuMusicClock(music.currentTime);
    setTimeout(() => { location.href = destination.href; }, 75);
  });

  addEventListener('pagehide', () => keepMenuMusicClock(music.currentTime));

  sharedSiteAudio = {
    music,
    ui,
    playUi,
    playSuccess,
    setDucked(value) { ducked = Boolean(value); applyMusicVolume(); },
    startMusic,
  };
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
      && new URLSearchParams(location.search).get('debug') === '1') {
    window.__siteAudio = sharedSiteAudio;
  }
  return sharedSiteAudio;
}

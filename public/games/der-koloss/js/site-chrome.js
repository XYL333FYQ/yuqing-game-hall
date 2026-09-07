import { initSiteAudio } from './site-audio.js?v=6';

initSiteAudio();

const nav = document.querySelector('.site-nav');
const menuToggle = nav?.querySelector('.site-menu-toggle');
const links = nav?.querySelector('.site-links');
const themeToggle = nav?.querySelector('.theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme, persist = false) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  themeColor?.setAttribute('content', nextTheme === 'light' ? '#f4f5f6' : '#06070a');
  if (themeToggle) {
    const isLight = nextTheme === 'light';
    themeToggle.setAttribute('aria-pressed', String(isLight));
    themeToggle.setAttribute('aria-label', `Use ${isLight ? 'dark' : 'light'} theme`);
    const label = themeToggle.querySelector('.theme-toggle-label');
    if (label) label.textContent = isLight ? 'Dark' : 'Light';
  }
  if (persist) {
    try { localStorage.setItem('der-koloss-theme', nextTheme); } catch (error) { /* storage can be unavailable */ }
  }
}

applyTheme(document.documentElement.dataset.theme);
themeToggle?.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
});

function setMenuOpen(open) {
  if (!nav || !menuToggle) return;
  nav.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
}

menuToggle?.addEventListener('click', () => setMenuOpen(!nav.classList.contains('menu-open')));
links?.addEventListener('click', () => setMenuOpen(false));
document.addEventListener('click', (event) => {
  if (nav?.classList.contains('menu-open') && !nav.contains(event.target)) setMenuOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav?.classList.contains('menu-open')) {
    setMenuOpen(false);
    menuToggle?.focus();
  }
});

function hashTarget() {
  if (!location.hash || location.hash === '#') return null;
  try { return document.getElementById(decodeURIComponent(location.hash.slice(1))); }
  catch (error) { return null; }
}

function smoothScrollToInitialHash() {
  const target = hashTarget();
  if (!target) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    target.scrollIntoView({ block: 'start' });
    return;
  }

  // Browsers jump to a fragment before load. Reset once, then animate from the
  // top so a pasted or bookmarked hash URL gets the same motion as a link click.
  const previousScrollBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.style.scrollBehavior = previousScrollBehavior;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

if (document.readyState === 'complete') smoothScrollToInitialHash();
else window.addEventListener('load', smoothScrollToInitialHash, { once: true });

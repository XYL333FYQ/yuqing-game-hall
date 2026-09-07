// ---------------------------------------------------------------------------
// Main-menu background plate.
//
// The markup in index.html is already complete and self-sufficient: a poster
// still with a looping <video> layered over it. If this module never runs the
// menu still gets a correct (if static) background. Everything here is
// enhancement:
//
//   * fade the clip in only once it is genuinely playing, so a failed load,
//     a blocked autoplay or a codec the browser cannot decode leaves the
//     poster on screen instead of a black rectangle;
//   * stop decoding whenever the menu is not the visible screen or the tab is
//     in the background, so the clip costs nothing during a match;
//   * honour prefers-reduced-motion, and drop the clip entirely on a
//     Save-Data connection.
//
// The clip is silent by design. The menu already owns a music bed
// (site-audio.js); a second audio source would fight it.
// ---------------------------------------------------------------------------

const root = document.getElementById('menu-bg');
const video = root?.querySelector('video');
const menu = document.getElementById('menu');

if (root && video && menu) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let dead = false;

  // Metered or explicitly data-saving connections get the poster only.
  const conn = navigator.connection;
  if (conn && (conn.saveData === true || /^(slow-)?2g$/.test(conn.effectiveType || ''))) {
    retire();
  }

  function retire() {
    if (dead) return;
    dead = true;
    root.classList.remove('is-live');
    try { video.pause(); } catch { /* the element may already be gone */ }
    // Drop the sources so a half-started fetch is abandoned and nothing retries.
    video.querySelectorAll('source').forEach((s) => s.remove());
    video.removeAttribute('src');
    try { video.load(); } catch { /* load aborted; the poster is what matters */ }
    video.remove();
  }

  // The menu screen carries .hidden whenever another screen is up.
  const menuVisible = () => !menu.classList.contains('hidden');
  const shouldPlay = () => !dead && !reduceMotion.matches && !document.hidden && menuVisible();

  function sync() {
    if (dead) return;
    if (!shouldPlay()) {
      if (!video.paused) { try { video.pause(); } catch { /* ignore */ } }
      return;
    }
    if (!video.paused) return;
    const p = video.play();
    // Autoplay policy can still reject even for a muted video. That is fine:
    // the poster is already on screen and .is-live was never set.
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  video.addEventListener('playing', () => { if (!dead) root.classList.add('is-live'); });

  // Failure detection. A <video> that picks its resource from <source> children
  // does NOT fire `error` on itself when every candidate 404s — the spec fires
  // `error` on the <source> elements (which do not bubble) and parks the media
  // element in NETWORK_NO_SOURCE with `video.error` still null. So listen in the
  // capture phase, which sees both the source failures and a genuine decode
  // error on the element itself, and confirm against networkState on the next
  // task, once the selection algorithm has finished walking the candidates.
  const NETWORK_NO_SOURCE = 3;
  video.addEventListener('error', (e) => {
    if (e.target === video && video.error) { retire(); return; }
    setTimeout(() => {
      if (!dead && video.networkState === NETWORK_NO_SOURCE) retire();
    }, 0);
  }, true);

  video.addEventListener('stalled', () => { if (!root.classList.contains('is-live')) sync(); });

  // Menu screen shown / hidden. Watching the class beats hooking showScreen(),
  // which lives in main.js and is not ours to touch.
  new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', sync);
  if (typeof reduceMotion.addEventListener === 'function') {
    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) root.classList.remove('is-live');
      sync();
    });
  }

  sync();
}

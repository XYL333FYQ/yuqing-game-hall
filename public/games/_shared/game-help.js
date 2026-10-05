(() => {
  'use strict';
  const script = document.currentScript;
  const showHelp = () => {
    const host = document.createElement('div');
    // Isolate the help from old games' global div, button, and font styles.
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `:host{position:fixed;right:12px;top:12px;z-index:2147483646;font:14px/1.7 "Microsoft YaHei",sans-serif;color:#f4f0e6}details{max-width:min(310px,calc(100vw - 48px));background:#222c;border:1px solid #fff3;border-radius:8px;box-shadow:0 4px 20px #0004}summary{padding:5px 12px;cursor:pointer;list-style:none;user-select:none}details[open] summary{border-bottom:1px solid #fff3}section{padding:12px 16px}h2{font-size:16px;margin:0 0 8px}p{margin:8px 0}a{color:#e3bd81}summary:focus-visible,a:focus-visible{outline:2px solid #e3bd81;outline-offset:2px}`;
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '玩法说明';
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = script.dataset.title;
    const controls = document.createElement('p');
    controls.textContent = script.dataset.controls;
    const tip = document.createElement('p');
    tip.textContent = script.dataset.tip;
    const credits = document.createElement('a');
    credits.href = './SOURCE.md';
    credits.target = '_blank';
    credits.rel = 'noopener';
    credits.textContent = '原作与许可';
    section.append(title, controls, tip, credits);
    details.append(summary, section);
    shadow.append(style, details);
    // Opening or closing help should not fire the game's canvas click handlers.
    for (const type of ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'keyup']) {
      host.addEventListener(type, event => event.stopPropagation());
    }
    document.body.append(host);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showHelp, { once: true });
  else showHelp();
})();

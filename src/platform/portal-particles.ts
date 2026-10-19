/** Three depth planes retain 150 star trails without a full-screen Canvas redraw. */
export function createPortalParticles(options: {
  x: number;
  y: number;
  colors: readonly string[];
  duration: number;
}): { start: () => void; finished: Promise<void>; cancel: () => void } {
  const { x, y, colors, duration } = options;
  const width = innerWidth;
  const height = innerHeight;
  const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const layer = document.createElement("div");
  layer.className = "portal-effect";
  layer.setAttribute("aria-hidden", "true");
  layer.style.setProperty("--portal-x", `${x}px`);
  layer.style.setProperty("--portal-y", `${y}px`);
  layer.style.setProperty("--portal-accent", colors[0]);
  layer.innerHTML = Array.from({ length: 3 }, (_, plane) => {
    const paths = Array.from({ length: width < 700 ? 28 : 50 }, (_, index) => {
      const seed = index * 3 + plane;
      const angle = seed * 2.39996323;
      const distance = radius * (0.08 + ((seed * 31) % 97) / 110);
      const tail = 10 + (seed % 9) * 7;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return `<path d="M${(x + cos * distance).toFixed(1)} ${(y + sin * distance).toFixed(1)}l${(cos * tail).toFixed(1)} ${(sin * tail).toFixed(1)}" opacity="${0.4 + (seed % 4) * 0.2}"/>`;
    }).join("");
    return `<svg class="portal-stars" viewBox="0 0 ${width} ${height}" fill="none" stroke="${colors[plane % colors.length]}" stroke-width="${0.9 + plane * 0.5}" stroke-linecap="round" aria-hidden="true">${paths}</svg>`;
  }).join("") + '<div class="portal-wave"></div><div class="portal-wave portal-wave-echo"></div>';
  document.body.append(layer);

  let complete!: () => void;
  const finished = new Promise<void>((resolve) => { complete = resolve; });
  const animations: Animation[] = [];
  let stopped = false;
  const cancel = (): void => {
    stopped = true;
    animations.forEach((animation) => animation.cancel());
    layer.remove();
    complete();
  };
  const start = (): void => {
    if (stopped || animations.length) return;
    layer.querySelectorAll<SVGElement>(".portal-stars").forEach((stars, plane) => {
      animations.push(stars.animate([
        { transform: "scale(0.04)", opacity: 0 },
        { opacity: 0.95, offset: 0.2 },
        { opacity: 0.8, offset: 0.65 },
        { transform: `scale(${1.4 + plane * 0.3})`, opacity: 0 },
      ], { duration, easing: "cubic-bezier(0.4, 0, 0.16, 1)", fill: "both" }));
    });
    layer.querySelectorAll<HTMLElement>(".portal-wave").forEach((wave, index) => {
      animations.push(wave.animate([
        { transform: "translate(-50%, -50%) scale(0.01)", opacity: 0 },
        { opacity: index ? 0.3 : 0.7, offset: 0.15 },
        { transform: `translate(-50%, -50%) scale(${radius / 150})`, opacity: 0 },
      ], { duration: duration - index * 120, delay: index * 120, easing: "cubic-bezier(0.4, 0, 0.16, 1)", fill: "both" }));
    });
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(cancel);
  };
  return { start, finished, cancel };
}

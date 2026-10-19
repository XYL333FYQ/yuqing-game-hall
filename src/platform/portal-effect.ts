export interface PortalEffect {
  finished: Promise<void>;
  cancel: () => void;
}

let currentEffect: PortalEffect | undefined;

/** Rasterize static vectors once; animate only transform and opacity. */
export function playPortalEffect(options: {
  x: number;
  y: number;
  accent: string;
  onSwap?: () => void;
}): PortalEffect {
  currentEffect?.cancel();
  const { x, y, accent, onSwap } = options;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const radius = Math.hypot(width, height);
  const layer = document.createElement("div");
  layer.className = "portal-effect";
  layer.setAttribute("aria-hidden", "true");
  layer.style.setProperty("--portal-x", `${x}px`);
  layer.style.setProperty("--portal-y", `${y}px`);
  layer.style.setProperty("--portal-accent", accent);
  const rays = Array.from({ length: width < 700 ? 24 : 40 }, (_, index) => {
    const angle = index * 2.399963;
    const distance = radius * (0.06 + ((index * 17) % 41) / 90);
    const tail = 8 + (index % 7) * 6;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return `<path d="M${(x + cos * distance).toFixed(1)},${(y + sin * distance).toFixed(1)}l${(cos * tail).toFixed(1)},${(sin * tail).toFixed(1)}" opacity="${0.35 + (index % 4) * 0.2}"/>`;
  }).join("");
  layer.innerHTML = `<div class="portal-wash"></div><div class="portal-lens"></div><svg class="portal-rays" viewBox="0 0 ${width} ${height}" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${rays}</svg>`;
  document.body.append(layer);
  const timing = { duration: 620, easing: "cubic-bezier(0.2, 0.7, 0.15, 1)" };
  const animations = [
    layer.querySelector<HTMLElement>(".portal-wash")!.animate([
      { opacity: 0 }, { opacity: 0.88, offset: 0.2 }, { opacity: 0 },
    ], timing),
    layer.querySelector<HTMLElement>(".portal-lens")!.animate([
      { transform: "translate(-50%, -50%) scale(0.06)", opacity: 0.85 },
      { transform: `translate(-50%, -50%) scale(${radius / 150})`, opacity: 0 },
    ], timing),
    layer.querySelector<SVGElement>(".portal-rays")!.animate([
      { transform: "scale(0.32)", opacity: 0 },
      { opacity: 0.85, offset: 0.18 },
      { transform: "scale(1.24)", opacity: 0 },
    ], timing),
  ];
  // Let the veil paint before changing the actual palette once beneath it.
  const timer = window.setTimeout(() => onSwap?.(), 90);
  const cancel = (): void => {
    window.clearTimeout(timer);
    animations.forEach((animation) => animation.cancel());
    layer.remove();
  };
  const finished = Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
    window.clearTimeout(timer);
    layer.remove();
  });
  const effect = { finished, cancel };
  currentEffect = effect;
  void finished.then(() => { if (currentEffect === effect) currentEffect = undefined; });
  return effect;
}

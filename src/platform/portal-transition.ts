import { createPortalParticles } from "./portal-particles";

export interface PortalTransition {
  finished: Promise<void>;
  cancel: () => void;
}

let active: PortalTransition | undefined;

export function cancelPortal(): void {
  active?.cancel();
}

/** Capture each palette once, then reveal it through a moving circular aperture. */
export function revealPortal(options: {
  x: number;
  y: number;
  colors: readonly string[];
  update: () => void;
}): PortalTransition {
  cancelPortal();
  const root = document.documentElement;
  const { x, y, colors, update } = options;
  const duration = 1100;
  let cancelled = false;
  let transition: ViewTransition | undefined;
  let reveal: Animation | undefined;
  const particles = createPortalParticles({ x, y, colors, duration });
  root.style.setProperty("--portal-x", `${x}px`);
  root.style.setProperty("--portal-y", `${y}px`);
  root.dataset.themeTransition = "portal";

  const clearRootTransition = (): void => {
    delete root.dataset.themeTransition;
    root.style.removeProperty("--portal-x");
    root.style.removeProperty("--portal-y");
  };

  let effect!: PortalTransition;
  const cancel = (): void => {
    cancelled = true;
    transition?.skipTransition();
    reveal?.cancel();
    particles.cancel();
    if (active === effect) {
      active = undefined;
      clearRootTransition();
    }
  };

  if (typeof document.startViewTransition === "function") {
    try {
      transition = document.startViewTransition(() => {
        if (!cancelled) update();
      });
    } catch {
      transition = undefined;
    }
  }

  const finished = (async (): Promise<void> => {
    try {
      if (cancelled) return;
      if (!transition) {
        update();
        particles.start();
        await particles.finished;
        return;
      }
      await transition.ready;
      if (cancelled) return;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      reveal = root.animate({
        clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
      }, {
        duration,
        easing: "cubic-bezier(0.4, 0, 0.16, 1)",
        fill: "both",
        pseudoElement: "::view-transition-new(root)",
      });
      particles.start();
      await Promise.all([reveal.finished, transition.finished, particles.finished]);
    } catch {
      // Hidden tabs, interrupted navigation, or unavailable snapshot animations.
      if (!cancelled) update();
      transition?.skipTransition();
    } finally {
      reveal?.cancel();
      particles.cancel();
      if (active === effect) {
        active = undefined;
        clearRootTransition();
      }
    }
  })();
  effect = { finished, cancel };
  active = effect;
  return effect;
}

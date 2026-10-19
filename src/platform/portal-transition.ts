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
  root.dataset.themeTransition = "portal";

  const cancel = (): void => {
    cancelled = true;
    transition?.skipTransition();
    reveal?.cancel();
    particles.cancel();
    if (active === effect) {
      active = undefined;
      delete root.dataset.themeTransition;
    }
  };
  const finished = Promise.resolve().then(async (): Promise<void> => {
    try {
      if (cancelled) return;
      if (!document.startViewTransition) {
        update();
        particles.start();
        await particles.finished;
        return;
      }
      transition = document.startViewTransition(() => { if (!cancelled) update(); });
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
        delete root.dataset.themeTransition;
      }
    }
  });
  const effect = { finished, cancel };
  active = effect;
  return effect;
}

import { revealPortal, type PortalTransition } from "./portal-transition";

/** Allow the opening to read, then travel through its center into the ready page. */
export function finishEntry(): void {
  const screen = document.querySelector<HTMLDialogElement>("#entry-screen");
  if (!screen) return;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!screen.open || getComputedStyle(screen).visibility === "hidden"
    || motion.matches) {
    screen.remove();
    return;
  }
  let effect: PortalTransition | undefined;
  const cleanup = (): void => {
    window.clearTimeout(timer);
    effect?.cancel();
    screen.remove();
    window.removeEventListener("pagehide", cleanup);
    motion.removeEventListener("change", onMotionChange);
  };
  const onMotionChange = (): void => { if (motion.matches) cleanup(); };
  const firstAnimation = screen.getAnimations()[0];
  const elapsed = Number(document.timeline.currentTime ?? 0) - Number(firstAnimation?.startTime ?? document.timeline.currentTime ?? 0);
  const timer = window.setTimeout(() => {
    if (!screen.open || getComputedStyle(screen).visibility === "hidden") { cleanup(); return; }
    screen.querySelector<HTMLElement>(".entry-status")!.textContent = "准备就绪，即刻启程";
    const orbit = screen.querySelector(".entry-orbit")!.getBoundingClientRect();
    effect = revealPortal({
      x: innerWidth / 2,
      y: orbit.y + orbit.height / 2,
      colors: document.documentElement.dataset.theme === "pink"
        ? ["#f472b6", "#c4b5fd", "#fff1f8"] : ["#8ca9dc", "#67d6eb", "#e0e7ff"],
      update: () => screen.remove(),
    });
    void effect.finished.then(cleanup);
  }, Math.max(0, 1050 - elapsed));
  screen.addEventListener("close", cleanup, { once: true });
  window.addEventListener("pagehide", cleanup, { once: true });
  motion.addEventListener("change", onMotionChange);
}

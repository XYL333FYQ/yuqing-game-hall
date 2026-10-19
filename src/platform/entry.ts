import { playPortalEffect } from "./portal-effect";

/** Initial navigation only; no artificial minimum loading duration. */
export function finishEntry(): void {
  const screen = document.querySelector<HTMLDialogElement>("#entry-screen");
  if (!screen) return;
  if (!screen.open || getComputedStyle(screen).visibility === "hidden"
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    screen.remove();
    return;
  }
  screen.style.pointerEvents = "none";
  const effect = playPortalEffect({
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.45,
    accent: document.documentElement.dataset.theme === "pink" ? "#f472b6" : "#8ca9dc",
  });
  const exit = screen.animate([
    { opacity: 1, transform: "scale(1)" },
    { opacity: 0, transform: "scale(1.04)" },
  ], { duration: 430, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" });
  screen.addEventListener("close", () => { effect.cancel(); exit.cancel(); screen.remove(); }, { once: true });
  void exit.finished.catch(() => undefined).then(() => screen.remove());
  const onPageHide = (): void => { effect.cancel(); exit.cancel(); screen.remove(); };
  window.addEventListener("pagehide", onPageHide, { once: true });
  void Promise.allSettled([exit.finished, effect.finished]).then(() => {
    window.removeEventListener("pagehide", onPageHide);
  });
}

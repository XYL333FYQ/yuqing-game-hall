export type Theme = "dark" | "light" | "pink";

const STORAGE_KEY = "yuqing:theme";
const THEMES = [
  { id: "dark", label: "黑夜", color: "#090b10", particles: ["#a5b4fc", "#67e8f9", "#e0e7ff"], icon: '<path d="M20.7 13a9 9 0 0 1-9.7-9.7A9 9 0 1 0 20.7 13Z"/>' },
  { id: "light", label: "白天", color: "#f4eddf", particles: ["#d4a657", "#83c7b2", "#fff3cf"], icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/>' },
  { id: "pink", label: "粉色", color: "#fff0f5", particles: ["#f472b6", "#c4b5fd", "#fff1f8"], icon: '<path d="M12 21s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12Z"/>' },
] as const;

function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light" || value === "pink";
}

export function readThemePreference(storage: Pick<Storage, "getItem">): Theme {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return isTheme(saved) ? saved : "dark";
  } catch {
    return "dark";
  }
}

export function themeSwitcher(): string {
  const current = document.documentElement.dataset.theme ?? "dark";
  return `<div class="theme-switcher" role="group" aria-label="切换界面主题">${THEMES.map((theme) => `
    <button type="button" class="theme-choice" data-theme-choice="${theme.id}" aria-pressed="${current === theme.id}" aria-label="切换到${theme.label}主题" title="${theme.label}主题">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${theme.icon}</svg><span>${theme.label}</span>
    </button>`).join("")}</div>`;
}

/** Delegation survives SPA page replacement without touching game iframes. */
export function installThemeSwitcher(): void {
  const root = document.documentElement;
  const status = document.createElement("span");
  status.className = "theme-announcement";
  status.setAttribute("role", "status");
  document.body.append(status);
  let pending: { theme: Theme; x: number; y: number } | undefined;
  let running = false;
  let desiredTheme: Theme = isTheme(root.dataset.theme) ? root.dataset.theme : "dark";
  let revision = 0;
  let transition: ViewTransition | undefined;
  let stopParticles: (() => void) | undefined;

  const apply = (theme: Theme): void => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme === "dark" ? "dark" : "light";
    root.style.backgroundColor = THEMES.find((item) => item.id === theme)!.color;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES.find((item) => item.id === theme)!.color);
    document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
    });
    status.textContent = `已切换到${THEMES.find((item) => item.id === theme)!.label}主题`;
  };

  const cancel = (): void => {
    revision++;
    pending = undefined;
    transition?.skipTransition();
    stopParticles?.();
    if (root.dataset.theme !== desiredTheme) apply(desiredTheme);
  };

  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const { theme, x, y } = pending;
        const currentRevision = revision;
        pending = undefined;
        if (root.dataset.theme === theme) continue;
        try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Restricted storage. */ }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !document.startViewTransition) {
          apply(theme);
          continue;
        }
        const particles = createPortalParticles(theme, x, y);
        stopParticles = particles.stop;
        root.dataset.themeTransition = "portal";
        try {
          transition = document.startViewTransition(() => {
            if (currentRevision === revision) apply(theme);
          });
          await transition.ready;
          const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
          const reveal = root.animate({
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
          }, {
            duration: 1100,
            easing: "cubic-bezier(0.2, 0.7, 0.15, 1)",
            pseudoElement: "::view-transition-new(root)",
          });
          particles.start();
          await Promise.all([reveal.finished, transition.finished]);
        } catch {
          // Navigation, a hidden tab, or unsupported pseudo animations may skip snapshots.
          if (currentRevision === revision) apply(theme);
          transition?.skipTransition();
        } finally {
          particles.stop();
          stopParticles = undefined;
          transition = undefined;
          delete root.dataset.themeTransition;
        }
      }
    } finally {
      running = false;
    }
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("a[data-nav]")) cancel();
    const button = target?.closest<HTMLButtonElement>("[data-theme-choice]");
    const theme = button?.dataset.themeChoice;
    if (!button || !isTheme(theme)) return;
    const bounds = button.getBoundingClientRect();
    desiredTheme = theme;
    pending = { theme, x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    if (running) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Keep switching available. */ }
    }
    void run();
  });
  window.addEventListener("popstate", cancel);
  window.addEventListener("pagehide", cancel);
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancel(); });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    desiredTheme = isTheme(event.newValue) ? event.newValue : "dark";
    cancel();
    apply(desiredTheme);
  });
  let theme: Theme = "dark";
  try { theme = readThemePreference(localStorage); } catch { /* Access itself may throw. */ }
  desiredTheme = theme;
  apply(theme);
}

function createPortalParticles(theme: Theme, x: number, y: number): { start: () => void; stop: () => void } {
  const canvas = document.createElement("canvas");
  canvas.className = "theme-portal-particles";
  canvas.setAttribute("aria-hidden", "true");
  const width = innerWidth;
  const height = innerHeight;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  document.body.append(canvas);
  const context = canvas.getContext("2d");
  const colors = THEMES.find((item) => item.id === theme)!.particles;
  const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const stars = Array.from({ length: width < 700 ? 80 : 150 }, (_, index) => ({
    angle: Math.random() * Math.PI * 2,
    distance: 0.03 + Math.random() * 0.9,
    speed: 0.3 + Math.random() * 0.7,
    size: 0.5 + Math.random() * 1.3,
    color: colors[index % colors.length],
  }));
  let frame = 0;
  let stopped = false;
  const stop = (): void => {
    stopped = true;
    cancelAnimationFrame(frame);
    canvas.remove();
  };
  const start = (): void => {
    if (!context || stopped) return;
    context.scale(ratio, ratio);
    const started = performance.now();
    const draw = (now: number): void => {
      if (stopped) return;
      // The first rAF timestamp can precede performance.now() in the same frame.
      const progress = Math.max(0, Math.min((now - started) / 1100, 1));
      const fade = Math.sin(Math.PI * progress) * 0.85;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = theme === "dark" ? "lighter" : "source-over";
      for (const star of stars) {
        const distance = radius * (star.distance * 0.28 + Math.pow(progress, 1.7) * star.speed);
        const tail = Math.max(2, 76 * progress * star.speed);
        const cos = Math.cos(star.angle);
        const sin = Math.sin(star.angle);
        context.globalAlpha = fade * (0.4 + star.speed * 0.6);
        context.strokeStyle = star.color;
        context.lineWidth = star.size;
        context.beginPath();
        context.moveTo(x + cos * (distance - tail), y + sin * (distance - tail));
        context.lineTo(x + cos * distance, y + sin * distance);
        context.stroke();
      }
      const wave = radius * (1 - Math.pow(1 - progress, 3));
      context.globalAlpha = fade * 0.5;
      context.strokeStyle = colors[0];
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(x, y, wave, 0, Math.PI * 2);
      context.stroke();
      if (progress < 1) frame = requestAnimationFrame(draw);
      else stop();
    };
    frame = requestAnimationFrame(draw);
  };
  return { start, stop };
}

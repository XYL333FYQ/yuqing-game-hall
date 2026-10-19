import { cancelPortal, revealPortal, type PortalTransition } from "./portal-transition";

export type Theme = "dark" | "light" | "pink";
const STORAGE_KEY = "yuqing:theme";
const THEMES = [
  { id: "dark", label: "黑夜", color: "#090b10", accent: "#a5b4fc", icon: '<path d="M20.7 13a9 9 0 0 1-9.7-9.7A9 9 0 1 0 20.7 13Z"/>' },
  { id: "light", label: "白天", color: "#f4eddf", accent: "#d4a657", icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/>' },
  { id: "pink", label: "粉色", color: "#fff0f5", accent: "#f472b6", icon: '<path d="M12 21s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12Z"/>' },
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

/** One controller survives SPA replacement; newer requests cancel older effects. */
export function installThemeSwitcher(): void {
  const root = document.documentElement;
  const status = document.createElement("span");
  status.className = "theme-announcement";
  status.setAttribute("role", "status");
  document.body.append(status);
  let desired: Theme = isTheme(root.dataset.theme) ? root.dataset.theme : "dark";
  let active: PortalTransition | undefined;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const updateControls = (theme: Theme): void => {
    document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
    });
  };
  const apply = (theme: Theme): void => {
    const palette = THEMES.find((item) => item.id === theme)!;
    root.dataset.theme = theme;
    root.style.colorScheme = theme === "dark" ? "dark" : "light";
    root.style.backgroundColor = palette.color;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", palette.color);
    updateControls(theme);
    status.textContent = `已切换到${palette.label}主题`;
  };
  const settle = (): void => {
    cancelPortal();
    active = undefined;
    if (root.dataset.theme !== desired) apply(desired);
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("a[data-nav]")) settle();
    const button = target?.closest<HTMLButtonElement>("[data-theme-choice]");
    const theme = button?.dataset.themeChoice;
    if (!button || !isTheme(theme)) return;
    desired = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Restricted storage. */ }
    cancelPortal();
    active = undefined;
    updateControls(theme);
    if (root.dataset.theme === theme || motion.matches || typeof button.animate !== "function") {
      apply(theme);
      return;
    }
    const bounds = button.getBoundingClientRect();
    const accent = THEMES.find((item) => item.id === theme)!.accent;
    const effect = revealPortal({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
      colors: [accent, theme === "light" ? "#68a991" : "#67d6eb", theme === "dark" ? "#e0e7ff" : accent],
      update: () => apply(theme),
    });
    active = effect;
    void effect.finished.then(() => {
      if (active !== effect) return;
      if (root.dataset.theme !== desired) apply(desired);
      active = undefined;
    });
  });
  window.addEventListener("popstate", settle);
  window.addEventListener("pagehide", settle);
  document.addEventListener("visibilitychange", () => { if (document.hidden) settle(); });
  motion.addEventListener("change", () => { if (motion.matches) settle(); });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    desired = isTheme(event.newValue) ? event.newValue : "dark";
    settle();
    updateControls(desired);
  });
  try { desired = readThemePreference(localStorage); } catch { /* Access itself may throw. */ }
  apply(desired);
}

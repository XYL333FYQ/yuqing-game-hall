import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readThemePreference, themeParticles } from "../src/platform/theme";

describe("theme preference", () => {
  it.each(["dark", "light", "pink"] as const)("restores the saved %s theme", (theme) => {
    expect(readThemePreference({ getItem: () => theme })).toBe(theme);
  });

  it.each([null, "", "system", "<script>"])("opens in Gemini's dark theme for an invalid preference: %s", (saved) => {
    expect(readThemePreference({ getItem: () => saved })).toBe("dark");
  });

  it("still opens when browser storage is blocked", () => {
    expect(readThemePreference({ getItem: () => { throw new DOMException("Blocked", "SecurityError"); } })).toBe("dark");
  });

  it("keeps portal particle palettes distinct across dark, light, and pink themes", () => {
    const dark = themeParticles("dark");
    const light = themeParticles("light");
    const pink = themeParticles("pink");
    expect(new Set([...dark, ...light, ...pink]).size).toBe(9);
    expect(themeParticles("unknown")).toEqual(dark);
  });

  it("separates light and pink status palettes in themes.css without cross-bleeding", () => {
    const css = readFileSync(new URL("../src/styles/themes.css", import.meta.url), "utf8");
    const lightBlock = css.match(/html\[data-theme="light"\]\s*\{([^}]+)\}/)?.[1] ?? "";
    const pinkBlock = css.match(/html\[data-theme="pink"\]\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(lightBlock).toContain("--theme-status-fg: #237151");
    expect(pinkBlock).toContain("--theme-status-fg: #a93772");
    expect(pinkBlock).not.toContain("#237151");
    expect(pinkBlock).not.toContain("#e8f3e8");
  });
});

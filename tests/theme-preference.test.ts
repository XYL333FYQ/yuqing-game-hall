import { describe, expect, it } from "vitest";
import { readThemePreference } from "../src/platform/theme";

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
});

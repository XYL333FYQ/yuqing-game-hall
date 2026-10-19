import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const bootstrap = readFileSync(new URL("../public/platform/theme-init.js", import.meta.url), "utf8");

function beforeFirstPaint(saved: string | null, blocked = false) {
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  const meta = { content: "#090b10" };
  runInNewContext(bootstrap, {
    document: { documentElement: root, querySelector: () => meta },
    get localStorage() {
      if (blocked) throw new Error("Storage access denied");
      return { getItem: () => saved };
    },
  });
  return { root, meta };
}

describe("theme before first paint", () => {
  it.each([
    ["dark", "dark", "#090b10"],
    ["light", "light", "#f4eddf"],
    ["pink", "light", "#fff0f5"],
  ])("restores %s before the application loads", (theme, scheme, color) => {
    const { root, meta } = beforeFirstPaint(theme);
    expect(root.dataset.theme).toBe(theme);
    expect(root.style.colorScheme).toBe(scheme);
    expect(root.style.backgroundColor).toBe(color);
    expect(meta.content).toBe(color);
  });

  it("falls back safely for unknown preferences", () => {
    expect(beforeFirstPaint("unknown").root.dataset.theme).toBe("dark");
  });

  it("renders dark when the localStorage getter itself throws", () => {
    expect(beforeFirstPaint(null, true).root.dataset.theme).toBe("dark");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderLibraryPlay } from "../src/pages/library-play";

vi.mock("../src/platform/device", () => ({ canPlayGame: () => true }));
vi.mock("../src/appearance/theme", () => ({ themeSwitcher: () => "" }));

class Node extends EventTarget {
  textContent = "";
  hidden = false;
  src = "";
  contentWindow = {};
  requestFullscreen = vi.fn(async () => {});
  setAttribute(name: string) { if (name === "hidden") this.hidden = true; }
  removeAttribute(name: string) { if (name === "hidden") this.hidden = false; }
}

describe("library player loading lifecycle", () => {
  let nodes: Map<string, Node>;
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    nodes = new Map();
    for (const selector of ["iframe", ".library-frame-loading", ".library-frame-actions", "[data-loading-title]", "[data-loading-copy]", "[data-retry]"]) nodes.set(selector, new Node());
    vi.stubGlobal("document", { body: { dataset: {} } });
    vi.stubGlobal("window", Object.assign(new EventTarget(), { setTimeout, clearTimeout, location: { origin: "http://localhost" } }));
    cleanup = renderLibraryPlay({
      innerHTML: "", querySelector: (selector: string) => nodes.get(selector) ?? null,
      querySelectorAll: () => [nodes.get("[data-retry]")!],
    } as unknown as HTMLElement, "fruit-party");
  });

  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it.each([true, false])("rearms the slow-loading message on retry after initial loaded=%s", (loaded) => {
    if (loaded) nodes.get("iframe")!.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(15_000);
    nodes.get("[data-retry]")!.dispatchEvent(new Event("click"));
    expect(nodes.get(".library-frame-actions")!.hidden).toBe(true);
    vi.advanceTimersByTime(14_999);
    expect(nodes.get(".library-frame-actions")!.hidden).toBe(true);
    vi.advanceTimersByTime(1);
    expect(nodes.get(".library-frame-actions")!.hidden).toBe(false);
    expect(nodes.get("[data-loading-title]")!.textContent).toBe("加载时间比预期更久");
  });

  it("hides loading on ready and releases timers on navigation", () => {
    nodes.get("iframe")!.dispatchEvent(new Event("load"));
    expect(nodes.get(".library-frame-loading")!.hidden).toBe(true);
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
    expect(nodes.get("iframe")!.src).toBe("about:blank");
  });
});

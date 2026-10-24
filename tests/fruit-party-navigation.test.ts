import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../games/fruit-party/src/pages/fruit-arcade", () => ({ renderFruitArcade: () => () => {} }));
vi.mock("../games/fruit-party/src/pages/fruit-details", () => ({ renderFruitDetails: () => () => {} }));
vi.mock("../games/fruit-party/src/pages/fruit-online", () => ({ renderFruitOnline: () => () => {} }));
vi.mock("../games/fruit-party/src/pages/fruit-play", () => ({ renderFruitPlay: () => () => {} }));
vi.mock("../games/fruit-party/src/pages/room", () => ({ renderRoom: () => () => {} }));

describe("fruit game link navigation", () => {
  let click: (event: MouseEvent) => void;
  let pushState: ReturnType<typeof vi.fn>;
  class Link {
    href = "http://localhost/games/fruit-party/index.html?route=online";
    closest() { return this; }
  }

  beforeEach(async () => {
    vi.resetModules();
    pushState = vi.fn();
    const browser = { location: new URL("http://localhost/games/fruit-party/index.html?route=home"), history: { pushState }, addEventListener: vi.fn() };
    Object.assign(browser, { parent: browser });
    vi.stubGlobal("window", browser);
    vi.stubGlobal("Element", Link);
    vi.stubGlobal("document", {
      querySelector: () => ({}), documentElement: { scrollTop: 0 }, body: { scrollTop: 0 },
      addEventListener: (_type: string, listener: (event: MouseEvent) => void) => { click = listener; },
    });
    await import("../games/fruit-party/src/main");
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])("preserves browser behavior for %s clicks", (modifier) => {
    const event = { target: new Link(), button: 0, [modifier]: true, preventDefault: vi.fn() };
    click(event as unknown as MouseEvent);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("handles a normal left click inside the game", () => {
    const event = { target: new Link(), button: 0, preventDefault: vi.fn() };
    click(event as unknown as MouseEvent);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(pushState).toHaveBeenCalledWith({}, "", "?route=online");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/platform/shell", () => ({ siteHeader: () => "", siteFooter: () => "" }));
vi.mock("../src/platform/portal-transition", () => ({ cancelPortal: () => {} }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("portal navigation", () => {
  let location: URL;
  let events: EventTarget;
  let app: HTMLDivElement;
  let scrollTo: ReturnType<typeof vi.fn>;
  let getElementById: ReturnType<typeof vi.fn>;
  let documentStub: Record<string, unknown>;

  beforeEach(() => {
    vi.resetModules();
    location = new URL("http://localhost/");
    events = new EventTarget();
    scrollTo = vi.fn();
    getElementById = vi.fn(() => null);
    documentStub = {
      body: { dataset: {} },
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      querySelector: () => null, getElementById,
    };
    vi.stubGlobal("document", documentStub);
    vi.stubGlobal("window", {
      get location() { return location; },
      history: { scrollRestoration: "auto" },
      matchMedia: () => ({ matches: false }),
      addEventListener: events.addEventListener.bind(events),
      scrollTo,
      setTimeout: vi.fn(),
    });
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    app = { innerHTML: "old page", childElementCount: 1, querySelector: () => null } as unknown as HTMLDivElement;
  });

  afterEach(() => {
    events.dispatchEvent(new Event("beforeunload"));
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the latest page and its cleanup when an older import finishes last", async () => {
    const homeModule = deferred<{ renderHome: (root: HTMLElement) => () => void }>();
    const cleaned: string[] = [];
    vi.doMock("../src/pages/home", () => homeModule.promise);
    vi.doMock("../src/pages/vision-lab", () => ({ renderVisionLab: (root: HTMLElement) => {
      root.innerHTML = "vision";
      return () => { cleaned.push("vision"); };
    } }));
    const { startPortal } = await import("../src/portal/router");
    const initial = startPortal(app);
    location = new URL("http://localhost/vision-lab");
    events.dispatchEvent(new Event("popstate"));
    await vi.waitFor(() => expect(app.innerHTML).toBe("vision"));
    homeModule.resolve({ renderHome: (root) => {
      root.innerHTML = "home";
      return () => { cleaned.push("home"); };
    } });
    await initial;
    expect(app.innerHTML).toBe("vision");
    events.dispatchEvent(new Event("beforeunload"));
    expect(cleaned).toEqual(["vision"]);
  });

  it("ignores an old view-transition callback that runs after a newer route", async () => {
    const transitions: Array<() => Promise<void> | void> = [];
    documentStub.startViewTransition = (callback: () => Promise<void> | void) => {
      transitions.push(callback);
      return { finished: Promise.resolve() };
    };
    vi.doMock("../src/pages/home", () => ({ renderHome: (root: HTMLElement) => {
      root.innerHTML = "home";
      return () => {};
    } }));
    vi.doMock("../src/pages/vision-lab", () => ({ renderVisionLab: (root: HTMLElement) => {
      root.innerHTML = "vision";
      return () => {};
    } }));
    const { startPortal } = await import("../src/portal/router");
    await startPortal(app);
    location = new URL("http://localhost/vision-lab");
    events.dispatchEvent(new Event("popstate"));
    await transitions[1]();
    await transitions[0]();
    expect(app.innerHTML).toBe("vision");
  });

  it("keeps a successfully loaded page when its URL contains a malformed fragment", async () => {
    location = new URL("http://localhost/#%E0%A4%A");
    vi.doMock("../src/pages/home", () => ({ renderHome: (root: HTMLElement) => {
      root.innerHTML = "home";
      return () => {};
    } }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { startPortal } = await import("../src/portal/router");
    await startPortal(app);
    expect(app.innerHTML).toBe("home");
    expect(getElementById).toHaveBeenCalledWith("%E0%A4%A");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(error).not.toHaveBeenCalled();
  });

  it("preserves decoded anchor scrolling and its scheduled retries", async () => {
    location = new URL("http://localhost/#%E7%89%88%E6%9D%83");
    const scrollIntoView = vi.fn();
    getElementById.mockReturnValue({ scrollIntoView });
    vi.doMock("../src/pages/home", () => ({ renderHome: (root: HTMLElement) => {
      root.innerHTML = "home";
      return () => {};
    } }));
    const { startPortal } = await import("../src/portal/router");
    await startPortal(app);
    const animationCallback = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    const timeoutCallback = vi.mocked(window.setTimeout).mock.calls[0][0] as () => void;
    animationCallback(0);
    timeoutCallback();
    expect(getElementById).toHaveBeenLastCalledWith("版权");
    expect(scrollIntoView).toHaveBeenCalledTimes(3);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "start" });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

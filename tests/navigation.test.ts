import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigate } from "../src/platform/navigation";

describe("same-page hash navigation", () => {
  let location: URL;
  let scrollIntoView: ReturnType<typeof vi.fn>;
  let getElementById: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    location = new URL("http://localhost/third-party-notices");
    scrollIntoView = vi.fn();
    getElementById = vi.fn(() => ({ scrollIntoView }));
    vi.stubGlobal("document", { getElementById });
    vi.stubGlobal("window", {
      get location() { return location; },
      history: { pushState: (_state: unknown, _title: string, path: string) => { location = new URL(path, location); } },
      scrollTo: vi.fn(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(["%", "%E0%A4%A"])("keeps malformed hash %s usable as a literal element ID", (hash) => {
    expect(() => navigate(`/third-party-notices#${hash}`)).not.toThrow();
    expect(location.hash).toBe(`#${hash}`);
    expect(getElementById).toHaveBeenCalledWith(hash);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
  });

  it("still decodes valid encoded section IDs", () => {
    navigate("/third-party-notices#%E7%89%88%E6%9D%83");
    expect(getElementById).toHaveBeenCalledWith("版权");
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });
});

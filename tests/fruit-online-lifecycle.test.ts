import { afterEach, expect, it, vi } from "vitest";
import { renderFruitOnline } from "../games/fruit-party/src/pages/fruit-online";
import { renderRoom } from "../games/fruit-party/src/pages/room";
import { roomRequest } from "../games/fruit-party/src/network/roomRequest";
import { navigateToFruitParty } from "../games/fruit-party/src/router";

vi.mock("../games/fruit-party/src/network/roomRequest", () => ({ roomRequest: vi.fn() }));
vi.mock("../games/fruit-party/src/router", () => ({ fruitPartyHref: () => "?route=home", navigateToFruitParty: vi.fn() }));
vi.mock("../games/fruit-party/src/ui/embed", () => ({ isEmbedded: () => true }));
vi.mock("../games/fruit-party/src/ui/shell", () => ({ canPlayGames: () => true }));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it.each([
  ["online", true], ["invite", true], ["online", false], ["invite", false],
])("handles %s response with disposed=%s", async (page, disposed) => {
  let resolve!: (data: any) => void;
  vi.mocked(roomRequest).mockReset().mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const setItem = vi.fn();
  const dispatchEvent = vi.fn();
  vi.stubGlobal("localStorage", { getItem: () => "玩家甲", setItem });
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem });
  vi.stubGlobal("document", { body: { dataset: {} } });
  vi.stubGlobal("window", { dispatchEvent });
  vi.stubGlobal("PopStateEvent", class {});
  class FakeButton {
    dataset = { action: "create" };
    textContent = "";
    disabled = false;
    closest(selector: string) { return selector === "[data-action]" ? this : null; }
    addEventListener(_name: string, handler: () => Promise<void>) { buttonHandler = handler; }
    removeEventListener() {}
  }
  vi.stubGlobal("Element", FakeButton);
  let rootHandler!: (event: MouseEvent) => Promise<void>;
  let buttonHandler!: () => Promise<void>;
  const button = new FakeButton();
  const root = {
    innerHTML: "", querySelectorAll: () => [],
    querySelector: (selector: string) => selector === "button" ? button : selector.includes("input") || selector.startsWith("[name=") ? { value: "玩家甲" } : {},
    addEventListener: (name: string, handler: any) => { if (name === "click") rootHandler = handler; },
    removeEventListener() {},
  } as unknown as HTMLElement;
  const cleanup = page === "online" ? renderFruitOnline(root) : renderRoom(root, "ABC234");
  const pending = page === "online" ? rootHandler({ target: button } as unknown as MouseEvent) : buttonHandler();
  expect(roomRequest).toHaveBeenCalledOnce();
  if (disposed) cleanup();
  resolve({ code: "ABC234", playerId: "p", token: "t", nickname: "玩家甲" });
  await pending;
  expect(setItem).toHaveBeenCalledTimes(disposed ? 0 : 2);
  expect(navigateToFruitParty).toHaveBeenCalledTimes(!disposed && page === "online" ? 1 : 0);
  expect(dispatchEvent).toHaveBeenCalledTimes(!disposed && page === "invite" ? 1 : 0);
  if (!disposed) cleanup();
});

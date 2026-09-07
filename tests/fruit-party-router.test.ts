import { describe, expect, it } from "vitest";
import {
  fruitPartyHref,
  parseFruitPartyRoute,
} from "../public/games/fruit-party/source/router";

describe("fruit party self-contained routes", () => {
  it("keeps the existing direct launch default", () => {
    expect(parseFruitPartyRoute("")).toEqual({ name: "play" });
    expect(parseFruitPartyRoute("?route=unknown")).toEqual({ name: "play" });
  });

  it("parses every local page without a platform pathname", () => {
    expect(parseFruitPartyRoute("?route=home")).toEqual({ name: "home" });
    expect(parseFruitPartyRoute("?route=arcade")).toEqual({ name: "arcade" });
    expect(parseFruitPartyRoute("?route=online")).toEqual({ name: "online" });
    expect(parseFruitPartyRoute("?route=room&code=abc234")).toEqual({ name: "room", code: "ABC234" });
  });

  it("generates only document-relative query links", () => {
    expect(fruitPartyHref("home")).toBe("?route=home");
    expect(fruitPartyHref("play")).toBe("?route=play");
    expect(fruitPartyHref("arcade")).toBe("?route=arcade");
    expect(fruitPartyHref("online")).toBe("?route=online");
    expect(fruitPartyHref("room", "abc234")).toBe("?route=room&code=ABC234");
  });
});

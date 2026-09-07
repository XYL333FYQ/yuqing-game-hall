import { isValidRoomCode } from "./server/protocol";

export type FruitPartyRoute =
  | { name: "home" }
  | { name: "play" }
  | { name: "arcade" }
  | { name: "online" }
  | { name: "room"; code: string };

export function parseFruitPartyRoute(search: string): FruitPartyRoute {
  const query = new URLSearchParams(search);
  const name = query.get("route");
  if (name === "home" || name === "arcade" || name === "online" || name === "play") {
    return { name };
  }
  const code = (query.get("code") ?? "").toUpperCase();
  if (name === "room" && isValidRoomCode(code)) return { name, code };
  return { name: "play" };
}

export function fruitPartyHref(name: Exclude<FruitPartyRoute["name"], "room">): string;
export function fruitPartyHref(name: "room", code: string): string;
export function fruitPartyHref(name: FruitPartyRoute["name"], code?: string): string {
  const query = new URLSearchParams({ route: name });
  if (name === "room" && code) query.set("code", code.toUpperCase());
  return `?${query.toString()}`;
}

export function navigateToFruitParty(name: Exclude<FruitPartyRoute["name"], "room">): void;
export function navigateToFruitParty(name: "room", code: string): void;
export function navigateToFruitParty(name: FruitPartyRoute["name"], code?: string): void {
  const href = name === "room" ? fruitPartyHref(name, code ?? "") : fruitPartyHref(name);
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function absoluteFruitPartyUrl(name: "room", code: string): string {
  return new URL(fruitPartyHref(name, code), window.location.href).href;
}

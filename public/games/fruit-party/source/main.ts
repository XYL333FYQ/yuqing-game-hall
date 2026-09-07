import "./style.css";
import { renderFruitArcade } from "./pages/fruit-arcade";
import { renderFruitOnline } from "./pages/fruit-online";
import { renderFruitPlay } from "./pages/fruit-play";
import { renderRoom } from "./pages/room";
import { isValidRoomCode } from "./server/protocol";

const root = document.querySelector<HTMLDivElement>("#game-root");
if (!root) throw new Error("游戏根节点不存在。");
let cleanup = (): void => undefined;
function route(): void {
  cleanup();
  const query = new URLSearchParams(window.location.search);
  const routeName = query.get("route") ?? "play";
  if (routeName === "arcade") cleanup = renderFruitArcade(root);
  else if (routeName === "online") cleanup = renderFruitOnline(root);
  else if (routeName === "room" && isValidRoomCode(query.get("code") ?? "")) cleanup = renderRoom(root, query.get("code")!.toUpperCase());
  else cleanup = renderFruitPlay(root);
}
document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-game-nav], a[data-nav]") : null;
  if (!link) return;
  if (!link.href.includes("/games/fruit-party/")) return;
  event.preventDefault();
  const url = new URL(link.href, window.location.href);
  const routeName = url.pathname.endsWith("/arcade") ? "arcade" : url.pathname.endsWith("/online") ? "online" : "play";
  window.history.pushState({}, "", `?route=${routeName}`);
  route();
});
window.addEventListener("popstate", route);
window.addEventListener("message", (event) => { if (event.origin === window.location.origin && event.data?.type === "YUQING_GAME_HOST") return; });
window.parent !== window && window.parent.postMessage({ type: "YUQING_GAME_READY", gameId: "fruit-party" }, window.location.origin);
route();

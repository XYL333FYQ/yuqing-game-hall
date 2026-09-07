import "./style.css";
import { renderFruitArcade } from "./pages/fruit-arcade";
import { renderFruitDetails } from "./pages/fruit-details";
import { renderFruitOnline } from "./pages/fruit-online";
import { renderFruitPlay } from "./pages/fruit-play";
import { renderRoom } from "./pages/room";
import { parseFruitPartyRoute } from "./router";

const root = document.querySelector<HTMLDivElement>("#game-root");
if (!root) throw new Error("游戏根节点不存在。");
let cleanup = (): void => undefined;
function route(): void {
  cleanup();
  const current = parseFruitPartyRoute(window.location.search);
  if (current.name === "home") cleanup = renderFruitDetails(root);
  else if (current.name === "arcade") cleanup = renderFruitArcade(root);
  else if (current.name === "online") cleanup = renderFruitOnline(root);
  else if (current.name === "room") cleanup = renderRoom(root, current.code);
  else cleanup = renderFruitPlay(root);
}
document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-game-nav]") : null;
  if (!link) return;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
  event.preventDefault();
  window.history.pushState({}, "", `${url.search}${url.hash}`);
  route();
});
window.addEventListener("popstate", route);
window.parent !== window && window.parent.postMessage({ type: "YUQING_GAME_READY", gameId: "fruit-party" }, window.location.origin);
route();

import { fruitPartyHref } from "../router";

export function canPlayGames(): boolean { return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent); }
export function gamePageHeader(..._args: unknown[]): string { return `<header class="game-header"><a href="${fruitPartyHref("home")}" data-game-nav>🍉 果切派对</a><span>独立游戏</span></header>`; }
export function gamePageFooter(): string { return `<footer class="game-footer">果切派对 · 独立静态游戏</footer>`; }
export function desktopGate(title = "请在电脑上游玩"): string { return `<section class="desktop-gate"><strong>${title}</strong><p>手机可以浏览，但果切需要电脑鼠标操作。</p></section>`; }
export function bindCopyUrl(..._args: unknown[]): () => void { return () => undefined; }

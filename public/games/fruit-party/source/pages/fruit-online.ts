import { canPlayGames } from "../ui/platform";
import { bindCopyUrl, desktopGate, siteFooter, siteHeader } from "../ui/platform";
import { roomRequest } from "../network/roomRequest";
import type { CompetitiveMode } from "../server/match";
import { isValidRoomCode, roomCredentialKey, type CreateRoomResponse } from "../server/protocol";

const MODES: Array<{ id: CompetitiveMode; name: string; detail: string; badge: string }> = [
  { id: "score90", name: "90 秒积分赛", detail: "时间结束比总分，平分进入 20 秒加时。", badge: "推荐" },
  { id: "bestOf3", name: "三局两胜", detail: "每局 60 秒，率先赢下两局。", badge: "竞技" },
  { id: "survival", name: "三命生存", detail: "漏切扣命，切中炸弹直接输掉本局。", badge: "紧张" },
];

export function renderFruitOnline(root: HTMLElement): () => void {
  document.title = "好友联机 · 果切派对";
  document.body.dataset.page = "site";
  if (!canPlayGames()) {
    root.innerHTML = `<div class="site-shell">${siteHeader("games")}<main class="narrow-page"><a class="back-link" href="/games/fruit-party" data-nav>← 返回游戏介绍</a>${desktopGate()}</main>${siteFooter()}</div>`;
    return bindCopyUrl(root);
  }

  const savedNickname = readNickname();
  root.innerHTML = `
    <div class="site-shell">
      ${siteHeader("games")}
      <main class="online-page">
        <a class="back-link" href="/games/fruit-party" data-nav>← 返回果切派对</a>
        <header class="online-heading">
          <div class="online-heading-art" aria-hidden="true"><img src="/games/fruit-party/assets/fruits/orange.svg" alt=""><b>对</b><img src="/games/fruit-party/assets/fruits/strawberry.svg" alt=""></div>
          <p class="kicker">好友对战</p><h1>和朋友开一局</h1><p>不需要账号。建房后把六位房间码发给朋友，双方准备好就会同步开始。</p>
        </header>
        <div class="online-layout">
          <section class="room-panel create-panel">
            <div class="panel-title"><span>01</span><div><h2>创建房间</h2><p>选择这局怎么玩</p></div></div>
            <label class="field"><span>你的昵称</span><input name="create-nickname" maxlength="12" value="${escapeAttribute(savedNickname)}" placeholder="2–12 个字符" autocomplete="nickname"></label>
            <div class="mode-list" role="radiogroup" aria-label="房间规则">
              ${MODES.map((mode, index) => `<button class="match-mode ${index === 0 ? "selected" : ""}" type="button" data-mode="${mode.id}" role="radio" aria-checked="${index === 0}"><span><strong>${mode.name}</strong><small>${mode.detail}</small></span><em>${mode.badge}</em></button>`).join("")}
            </div>
            <button class="button primary full" type="button" data-action="create">创建房间</button>
          </section>
          <section class="room-panel join-panel">
            <div class="panel-title"><span>02</span><div><h2>加入房间</h2><p>输入朋友发来的房间码</p></div></div>
            <label class="field"><span>你的昵称</span><input name="join-nickname" maxlength="12" value="${escapeAttribute(savedNickname)}" placeholder="2–12 个字符" autocomplete="nickname"></label>
            <label class="field"><span>六位房间码</span><input class="room-code-input" name="room-code" maxlength="6" placeholder="ABC234" autocomplete="off" spellcheck="false"></label>
            <button class="button secondary full" type="button" data-action="join">加入房间</button>
            <div class="join-note"><b>提示</b><p>自己的刀刃始终在本机响应；网络只同步倒计时、得分和比赛结果。</p></div>
          </section>
        </div>
        <p class="form-error" role="alert"></p>
      </main>
      ${siteFooter()}
    </div>`;

  let selectedMode: CompetitiveMode = "score90";
  const error = root.querySelector<HTMLElement>(".form-error")!;
  const clickHandler = async (event: MouseEvent): Promise<void> => {
    const modeButton = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-mode]") : null;
    if (modeButton) {
      selectedMode = modeButton.dataset.mode as CompetitiveMode;
      for (const candidate of root.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
        const selected = candidate === modeButton;
        candidate.classList.toggle("selected", selected);
        candidate.setAttribute("aria-checked", String(selected));
      }
      return;
    }
    const actionButton = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-action]") : null;
    if (!actionButton) return;
    error.textContent = "";
    actionButton.disabled = true;
    actionButton.textContent = "正在连接…";
    try {
      if (actionButton.dataset.action === "create") {
        const nickname = valueOf("create-nickname");
        validateNickname(nickname);
        const response = await roomRequest("/api/rooms", { nickname, mode: selectedMode });
        saveAndOpen(response);
      } else {
        const nickname = valueOf("join-nickname");
        const code = valueOf("room-code").toUpperCase();
        validateNickname(nickname);
        if (!isValidRoomCode(code)) throw new Error("请输入正确的六位房间码。");
        const response = await roomRequest(`/api/rooms/${code}/join`, { nickname });
        saveAndOpen(response);
      }
    } catch (reason) {
      error.textContent = reason instanceof Error ? reason.message : "房间连接失败，请稍后重试。";
      actionButton.disabled = false;
      actionButton.textContent = actionButton.dataset.action === "create" ? "创建房间" : "加入房间";
    }
  };
  root.addEventListener("click", clickHandler);
  const keyHandler = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || event.isComposing) return;
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input || !root.contains(input)) return;
    event.preventDefault();
    const action = input.closest(".create-panel") ? "create" : "join";
    root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.click();
  };
  root.addEventListener("keydown", keyHandler);

  const valueOf = (name: string): string => root.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value.trim();
  const saveAndOpen = (response: CreateRoomResponse): void => {
    try {
      localStorage.setItem("yuqing-nickname", response.nickname);
    } catch {
      // Nickname persistence is optional; room credentials are not.
    }
    try {
      sessionStorage.setItem(roomCredentialKey(response.code), JSON.stringify(response));
    } catch {
      throw new Error("浏览器禁止保存房间凭据，请关闭无痕限制后重试。");
    }
    window.history.pushState({}, "", `/room/${response.code}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return () => {
    root.removeEventListener("click", clickHandler);
    root.removeEventListener("keydown", keyHandler);
  };
}

function readNickname(): string {
  try {
    return localStorage.getItem("yuqing-nickname") ?? "";
  } catch {
    return "";
  }
}

function validateNickname(nickname: string): void {
  if ([...nickname].length < 2 || [...nickname].length > 12) {
    throw new Error("昵称需要 2–12 个字符。");
  }
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}


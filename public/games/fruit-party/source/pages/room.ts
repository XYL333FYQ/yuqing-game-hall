import { absoluteFruitPartyUrl, fruitPartyHref, navigateToFruitParty } from "../router";
import { canPlayGames } from "../ui/shell";
import { bindCopyUrl, desktopGate, siteFooter, siteHeader } from "../ui/shell";
import { MultiplayerClient } from "../network/MultiplayerClient";
import { roomRequest } from "../network/roomRequest";
import { isRoomCredentials, roomCredentialKey, type RoomCredentials, type RoomSnapshot, type ServerMessage } from "../server/protocol";
import { FruitNinjaEngine } from "../FruitNinjaEngine";
import { GameAudio } from "../GameAudio";
import { PointerBladeController } from "../PointerBladeController";

const MODE_LABELS = {
  score90: "90 秒积分赛",
  bestOf3: "三局两胜",
  survival: "三命生存",
} as const;

export function renderRoom(root: HTMLElement, rawCode: string): () => void {
  const code = rawCode.toUpperCase();
  document.title = `房间 ${code} · 果切派对`;
  document.body.dataset.page = "game";
  if (!canPlayGames()) {
    document.body.dataset.page = "site";
    root.innerHTML = `<div class="site-shell">${siteHeader("games")}<main class="narrow-page"><a class="back-link" href="${fruitPartyHref("home")}" data-game-nav>← 返回游戏介绍</a>${desktopGate("联机比赛请在电脑上进行")}</main>${siteFooter()}</div>`;
    return bindCopyUrl(root);
  }

  const credentials = loadCredentials(code);
  if (!credentials) return renderRoomJoin(root, code);

  root.innerHTML = `
    <main class="room-shell">
      <header class="room-toolbar">
        <a class="toolbar-brand" href="${fruitPartyHref("online")}" data-game-nav>← <span>联机大厅</span></a>
        <div class="room-identity"><span>房间</span><button type="button" data-action="copy-code" title="复制房间码">${code}</button></div>
        <div class="toolbar-actions room-toolbar-actions">
          <button type="button" data-action="mute" aria-pressed="false">声音</button>
          <div class="connection-pill" data-state="connecting"><i></i><span>正在连接</span></div>
        </div>
      </header>

      <section class="room-lobby">
        <div class="lobby-card">
          <p class="kicker">好友房 · 仅凭房间码加入</p>
          <h1>等待双方准备</h1>
          <p class="lobby-mode">比赛规则：<strong data-room-mode>—</strong></p>
          <div class="versus-row">
            <article class="player-seat me"><span class="player-avatar"><img src="./assets/fruits/orange.svg" alt=""><i>我</i></span><strong data-me-name>${escapeHtml(credentials.nickname)}</strong><small data-me-state>连接中</small></article>
            <b>对战</b>
            <article class="player-seat opponent"><span class="player-avatar"><img src="./assets/fruits/strawberry.svg" alt=""><i>友</i></span><strong data-opponent-name>等待朋友加入</strong><small data-opponent-state>尚未加入</small></article>
          </div>
          <button class="button primary ready-button" type="button" data-action="ready" disabled>准备</button>
          <p class="share-hint">把房间码 <b>${code}</b> 发给朋友，或直接分享当前链接。</p>
        </div>
      </section>

      <section class="multiplayer-stage" hidden>
        <canvas class="game-canvas" aria-label="果切派对联机比赛"></canvas>
        <div class="match-scoreboard">
          <div><small data-match-me-name>我</small><strong data-match-me-score>0</strong><span data-match-me-lives></span></div>
          <p><span data-match-mode>对战</span><b data-match-clock>—:—</b><em data-match-round>第 1 局</em></p>
          <div><small data-match-opponent-name>对手</small><strong data-match-opponent-score>0</strong><span data-match-opponent-lives></span></div>
        </div>
        <div class="match-result" hidden>
          <div><p class="kicker" data-result-kicker>比赛结束</p><h2 data-result-title>本局结束</h2><p data-result-detail></p><button class="button primary" type="button" data-action="rematch">再来一场</button><a class="text-link" href="${fruitPartyHref("online")}" data-game-nav>返回联机大厅</a></div>
        </div>
        <button class="forfeit-button" type="button" data-action="forfeit">认输并离开</button>
      </section>
      <p class="room-error" role="alert"></p>
    </main>`;

  const lobby = root.querySelector<HTMLElement>(".room-lobby")!;
  const stage = root.querySelector<HTMLElement>(".multiplayer-stage")!;
  const canvas = root.querySelector<HTMLCanvasElement>(".game-canvas")!;
  const resultPanel = root.querySelector<HTMLElement>(".match-result")!;
  const audio = new GameAudio();
  const muteButton = root.querySelector<HTMLButtonElement>("[data-action=mute]")!;
  muteButton.textContent = audio.isMuted() ? "已静音" : "声音";
  muteButton.setAttribute("aria-pressed", String(audio.isMuted()));
  let client: MultiplayerClient;
  let currentRoundKey = "";
  let ready = false;
  let forfeitResetTimer: number | undefined;
  let forfeitNavigateTimer: number | undefined;
  let leavingAfterForfeit = false;
  let matchStartAt: number | undefined;
  let matchDurationMs = 0;
  let matchClockRaf = 0;
  let displayedMeScore = 0;
  let optimisticScoreUntil = 0;

  const engine = new FruitNinjaEngine(canvas, {
    onEvent: (event) => {
      audio.play(event);
      if (event.type === "slice") {
        client.enqueueSlice(event);
        displayedMeScore = Math.max(0, displayedMeScore + event.scoreDelta);
        optimisticScoreUntil = performance.now() + 900;
        const scoreNode = root.querySelector<HTMLElement>("[data-match-me-score]");
        if (scoreNode) scoreNode.textContent = String(displayedMeScore);
      }
    },
  });
  const pointer = new PointerBladeController(canvas, engine);
  engine.startLoop();
  const musicTimer = window.setInterval(() => audio.syncMusic(engine.getState()), 120);

  const onMessage = (message: ServerMessage): void => {
    if (message.type === "error") {
      root.querySelector<HTMLElement>(".room-error")!.textContent = message.message;
      return;
    }
    updateRoom(message);
  };
  client = new MultiplayerClient(credentials, onMessage, (state) => {
    const pill = root.querySelector<HTMLElement>(".connection-pill")!;
    pill.dataset.state = state;
    pill.querySelector("span")!.textContent = {
      connecting: "正在连接",
      online: "已连接",
      reconnecting: "正在重连",
      offline: "连接已断开",
    }[state];
  });
  client.connect();

  const updateRoom = (snapshot: RoomSnapshot): void => {
    const me = snapshot.players.find((player) => player.id === credentials.playerId);
    const opponent = snapshot.players.find((player) => player.id !== credentials.playerId);
    if (!me) return;
    setText("[data-room-mode]", MODE_LABELS[snapshot.mode]);
    setText("[data-me-name]", me.nickname);
    setText("[data-me-state]", me.connected ? (me.ready ? "已准备" : "在线") : "正在重连");
    setText("[data-opponent-name]", opponent?.nickname ?? "等待朋友加入");
    setText("[data-opponent-state]", opponent ? (opponent.connected ? (opponent.ready ? "已准备" : "在线") : "掉线，等待重连") : "尚未加入");
    setText("[data-match-me-name]", me.nickname);
    setText("[data-match-opponent-name]", opponent?.nickname ?? "等待中");
    if (performance.now() >= optimisticScoreUntil || me.score === displayedMeScore || snapshot.phase !== "playing") {
      displayedMeScore = me.score;
      optimisticScoreUntil = 0;
    }
    setText("[data-match-me-score]", String(displayedMeScore));
    setText("[data-match-opponent-score]", String(opponent?.score ?? 0));
    setText("[data-match-me-lives]", snapshot.mode === "survival" ? lifeLabel(me.lives) : winsLabel(me.roundWins, snapshot.mode));
    setText("[data-match-opponent-lives]", snapshot.mode === "survival" ? lifeLabel(opponent?.lives ?? 3) : winsLabel(opponent?.roundWins ?? 0, snapshot.mode));
    setText("[data-match-mode]", MODE_LABELS[snapshot.mode]);
    setText("[data-match-round]", snapshot.overtime ? "加时赛" : snapshot.mode === "bestOf3" ? `第 ${snapshot.round} 局` : "公平同图");
    matchStartAt = snapshot.startAt;
    matchDurationMs = snapshot.durationMs ?? 0;

    const readyButton = root.querySelector<HTMLButtonElement>("[data-action=ready]")!;
    ready = me.ready;
    readyButton.disabled = !opponent || !me.connected;
    readyButton.textContent = ready ? "取消准备" : opponent ? "我准备好了" : "等待朋友加入";

    const playing = ["countdown", "playing", "between-rounds", "finished"].includes(snapshot.phase);
    lobby.hidden = playing;
    stage.hidden = !playing;

    if ((snapshot.phase === "countdown" || snapshot.phase === "playing") && snapshot.seed !== undefined && snapshot.startAt !== undefined && snapshot.durationMs !== undefined) {
      const roundKey = `${snapshot.seed}:${snapshot.startAt}`;
      if (roundKey !== currentRoundKey) {
        currentRoundKey = roundKey;
        client.resetRound();
        resultPanel.hidden = true;
        const untilStart = Math.max(0, snapshot.startAt - client.getServerNow());
        const elapsed = Math.max(0, client.getServerNow() - snapshot.startAt);
        engine.beginGame({
          mode: snapshot.mode,
          seed: snapshot.seed,
          durationMs: snapshot.durationMs,
          countdownMs: untilStart,
          initialElapsedMs: elapsed,
        });
        engine.syncScore(me.score, me.lives);
      }
      const elapsed = Math.max(0, client.getServerNow() - snapshot.startAt);
      if (engine.syncMatchTime(elapsed)) engine.syncScore(me.score, me.lives);
    }

    if (snapshot.phase === "between-rounds" || snapshot.phase === "finished") {
      engine.finish("time");
      resultPanel.hidden = false;
      const won = snapshot.result?.winnerId === credentials.playerId;
      setText("[data-result-kicker]", snapshot.phase === "finished" ? "比赛结束" : "本局结束");
      setText("[data-result-title]", snapshot.result?.winnerId ? (won ? "你赢了" : "对手获胜") : "平局");
      setText("[data-result-detail]", snapshot.result?.label ?? "正在确认结果…");
      const rematch = root.querySelector<HTMLButtonElement>("[data-action=rematch]")!;
      rematch.hidden = snapshot.phase !== "finished";
      rematch.textContent = me.ready ? "等待对手…" : "再来一场";
      if (leavingAfterForfeit && snapshot.phase === "finished") navigateToLobby();
    }
  };

  const setText = (selector: string, value: string): void => {
    const element = root.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
  };

  const renderMatchClock = (): void => {
    const remainingMs = matchStartAt === undefined || matchDurationMs <= 0
      ? undefined
      : Math.max(0, matchDurationMs - Math.max(0, client.getServerNow() - matchStartAt));
    if (remainingMs === undefined) {
      setText("[data-match-clock]", "—:—");
    } else {
      const totalSeconds = Math.ceil(remainingMs / 1_000);
      setText("[data-match-clock]", `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`);
    }
    matchClockRaf = window.requestAnimationFrame(renderMatchClock);
  };
  matchClockRaf = window.requestAnimationFrame(renderMatchClock);

  const visibilityHandler = (): void => {
    if (!document.hidden) client.requestSync();
    audio.syncMusic(engine.getState());
  };
  document.addEventListener("visibilitychange", visibilityHandler);

  const clickHandler = async (event: MouseEvent): Promise<void> => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-action]") : null;
    if (!button) return;
    if (button.dataset.action === "ready") {
      audio.unlock();
      client.setReady(!ready);
    }
    if (button.dataset.action === "rematch") {
      audio.unlock();
      client.rematch();
    }
    if (button.dataset.action === "mute") {
      audio.setMuted(!audio.isMuted());
      if (!audio.isMuted()) audio.unlock();
      button.textContent = audio.isMuted() ? "已静音" : "声音";
      button.setAttribute("aria-pressed", String(audio.isMuted()));
    }
    if (button.dataset.action === "forfeit") {
      if (button.dataset.confirm !== "true") {
        button.dataset.confirm = "true";
        button.textContent = "再点一次确认认输";
        if (forfeitResetTimer !== undefined) window.clearTimeout(forfeitResetTimer);
        forfeitResetTimer = window.setTimeout(() => {
          button.dataset.confirm = "false";
          button.textContent = "认输并离开";
        }, 2_600);
        return;
      }
      leavingAfterForfeit = true;
      button.disabled = true;
      button.textContent = "正在认输…";
      client.forfeit();
      forfeitNavigateTimer = window.setTimeout(navigateToLobby, 1_500);
    }
    if (button.dataset.action === "copy-code") {
      try {
        await navigator.clipboard.writeText(absoluteFruitPartyUrl("room", code));
        button.textContent = "已复制";
      } catch {
        button.textContent = "复制失败";
      }
      window.setTimeout(() => { button.textContent = code; }, 1_400);
    }
  };
  root.addEventListener("click", clickHandler);
  const pointerAudioHandler = (): void => audio.unlock();
  root.addEventListener("pointerdown", pointerAudioHandler);

  const navigateToLobby = (): void => {
    if (forfeitNavigateTimer !== undefined) window.clearTimeout(forfeitNavigateTimer);
    navigateToFruitParty("online");
  };

  return () => {
    root.removeEventListener("click", clickHandler);
    root.removeEventListener("pointerdown", pointerAudioHandler);
    if (forfeitResetTimer !== undefined) window.clearTimeout(forfeitResetTimer);
    if (forfeitNavigateTimer !== undefined) window.clearTimeout(forfeitNavigateTimer);
    window.cancelAnimationFrame(matchClockRaf);
    document.removeEventListener("visibilitychange", visibilityHandler);
    client.close();
    pointer.destroy();
    engine.destroy();
    window.clearInterval(musicTimer);
    audio.destroy();
  };
}

function renderRoomJoin(root: HTMLElement, code: string): () => void {
  document.body.dataset.page = "site";
  const nickname = readNickname();
  root.innerHTML = `
    <div class="site-shell">${siteHeader("games")}<main class="narrow-page">
      <a class="back-link" href="${fruitPartyHref("online")}" data-game-nav>← 返回联机大厅</a>
      <section class="direct-join"><p class="kicker">房间码 ${code}</p><h1>加入朋友的房间</h1><p>输入昵称后即可进入，比赛会在双方都准备好后开始。</p><label class="field"><span>你的昵称</span><input maxlength="12" value="${escapeHtml(nickname)}" placeholder="2–12 个字符"></label><button class="button primary full" type="button">加入房间</button><p class="form-error" role="alert"></p></section>
    </main>${siteFooter()}</div>`;
  const button = root.querySelector<HTMLButtonElement>("button")!;
  const handler = async (): Promise<void> => {
    const value = root.querySelector<HTMLInputElement>("input")!.value.trim();
    const error = root.querySelector<HTMLElement>(".form-error")!;
    if ([...value].length < 2 || [...value].length > 12) {
      error.textContent = "昵称需要 2–12 个字符。";
      return;
    }
    button.disabled = true;
    button.textContent = "正在加入…";
    try {
      const data = await roomRequest(`/api/rooms/${code}/join`, { nickname: value });
      try {
        localStorage.setItem("yuqing-nickname", data.nickname);
      } catch {
        // Nickname persistence is optional.
      }
      try {
        sessionStorage.setItem(roomCredentialKey(code), JSON.stringify(data));
      } catch {
        throw new Error("浏览器禁止保存房间凭据，请关闭无痕限制后重试。");
      }
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (reason) {
      error.textContent = reason instanceof Error ? reason.message : "无法加入房间。";
      button.disabled = false;
      button.textContent = "加入房间";
    }
  };
  button.addEventListener("click", handler);
  const keyHandler = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || event.isComposing) return;
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    button.click();
  };
  root.addEventListener("keydown", keyHandler);
  return () => {
    button.removeEventListener("click", handler);
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

function loadCredentials(code: string): RoomCredentials | undefined {
  try {
    const value = sessionStorage.getItem(roomCredentialKey(code));
    if (!value) return undefined;
    const candidate = JSON.parse(value) as unknown;
    if (isRoomCredentials(candidate) && candidate.code.toUpperCase() === code) return candidate;
    sessionStorage.removeItem(roomCredentialKey(code));
    return undefined;
  } catch {
    return undefined;
  }
}

function lifeLabel(lives: number): string {
  return `${"●".repeat(Math.max(0, lives))}${"○".repeat(Math.max(0, 3 - lives))}`;
}

function winsLabel(wins: number, mode: keyof typeof MODE_LABELS): string {
  return mode === "bestOf3" ? `${wins} 局胜` : "";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}




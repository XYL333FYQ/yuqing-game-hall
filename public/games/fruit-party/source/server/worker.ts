import { DurableObject } from "cloudflare:workers";
import {
  fruitPoints,
  generateMatchSchedule,
  getRoundRules,
  validateSliceClaim,
  isSliceClaim,
  type CompetitiveMode,
  type SliceClaim,
} from "./match";
import type {
  ClientMessage,
  CreateRoomResponse,
  RoomPhase,
  RoomPlayerView,
  RoomResult,
  RoomSnapshot,
} from "./protocol";
import { isValidRoomCode, ROOM_CODE_CHARACTERS } from "./protocol";

interface Env {
  GAME_ROOMS: DurableObjectNamespace<GameRoom>;
  /** 逗号分隔的静态站点来源；同源请求始终允许。 */
  ALLOWED_ORIGINS?: string;
}

interface PlayerState extends RoomPlayerView {
  token: string;
  slicedIds: number[];
  missedIds: number[];
  disconnectAt?: number;
  lastScoreAt?: number;
  connectionId?: string;
}

interface StoredRoom {
  code: string;
  mode: CompetitiveMode;
  phase: RoomPhase;
  players: PlayerState[];
  round: number;
  seed?: number;
  startAt?: number;
  durationMs?: number;
  overtime: boolean;
  nextRoundAt?: number;
  result?: RoomResult;
  createdAt: number;
  lastActivity: number;
}

interface SocketAttachment {
  playerId: string;
  connectionId: string;
}

const ROOM_TTL_MS = 30 * 60_000;
const RECONNECT_GRACE_MS = 15_000;
const CLAIM_SETTLEMENT_GRACE_MS = 350;
const MAX_SOCKET_MESSAGE_LENGTH = 64 * 1024;
const CLIENT_MESSAGE_TYPES = new Set(["ready", "sliceBatch", "sync", "rematch", "forfeit"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const apiRequest = url.pathname.startsWith("/api/");
    const allowedOrigin = apiRequest ? resolveAllowedOrigin(request, env) : undefined;
    if (apiRequest && allowedOrigin === null) {
      return json({ error: "这个网站来源未获准连接果切多人服务。" }, 403);
    }
    if (apiRequest && request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), allowedOrigin);
    }
    try {
      if (url.pathname === "/api/health") {
        return withCors(json({ ok: true, service: "fruit-party-multiplayer" }), allowedOrigin);
      }
      if (request.method === "POST" && url.pathname === "/api/rooms") {
        const input = await readJson(request);
        const nickname = normalizeNickname(input.nickname);
        const mode = normalizeMode(input.mode);
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const code = randomCode();
          const stub = env.GAME_ROOMS.getByName(code);
          const response = await stub.fetch("https://room.internal/create", {
            method: "POST",
            body: JSON.stringify({ code, nickname, mode }),
          });
          if (response.status === 409) continue;
          return withCors(response, allowedOrigin);
        }
        return withCors(json({ error: "暂时无法生成房间码，请重试。" }, 503), allowedOrigin);
      }

      const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/join|\/socket)?$/i);
      if (match && isValidRoomCode(match[1])) {
        const code = match[1].toUpperCase();
        const suffix = match[2] ?? "";
        const stub = env.GAME_ROOMS.getByName(code);
        const target = new URL(`https://room.internal${suffix || "/snapshot"}`);
        target.search = url.search;
        const response = await stub.fetch(new Request(target, request));
        return response.status === 101 ? response : withCors(response, allowedOrigin);
      }

      if (apiRequest) return withCors(json({ error: "接口不存在。" }, 404), allowedOrigin);
      return json({ error: "这里只运行果切多人后端；请从果切静态站点打开游戏。" }, 404);
    } catch (error) {
      return withCors(json({ error: error instanceof Error ? error.message : "请求处理失败。" }, 400), allowedOrigin);
    }
  },
} satisfies ExportedHandler<Env>;

export class GameRoom extends DurableObject<Env> {
  private room?: StoredRoom;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = await ctx.storage.get<StoredRoom>("room");
      if (this.room) {
        const connectedIds = new Set(
          ctx.getWebSockets()
            .map((socket) => (socket.deserializeAttachment() as SocketAttachment | null)?.playerId)
            .filter((id): id is string => Boolean(id)),
        );
        for (const player of this.room.players) player.connected = connectedIds.has(player.id);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/create" && request.method === "POST") return this.create(request);
    if (url.pathname === "/join" && request.method === "POST") return this.join(request);
    if (url.pathname === "/socket") return this.upgrade(request);
    if (url.pathname === "/snapshot") {
      if (!this.room) return json({ error: "房间不存在或已经过期。" }, 404);
      return json(this.snapshot());
    }
    return json({ error: "房间接口不存在。" }, 404);
  }

  async webSocketMessage(socket: WebSocket, payload: string | ArrayBuffer): Promise<void> {
    if (!this.room || typeof payload !== "string") return;
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    const player = this.room.players.find((candidate) => candidate.id === attachment?.playerId && candidate.connectionId === attachment?.connectionId);
    if (!player) return;

    if (payload.length > MAX_SOCKET_MESSAGE_LENGTH) {
      socket.send(JSON.stringify({ type: "error", message: "消息过大，已被拒绝。" }));
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload) as unknown;
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "消息格式错误。" }));
      return;
    }
    if (
      !parsed
      || typeof parsed !== "object"
      || Array.isArray(parsed)
      || typeof (parsed as { type?: unknown }).type !== "string"
      || !CLIENT_MESSAGE_TYPES.has((parsed as { type: string }).type)
    ) {
      socket.send(JSON.stringify({ type: "error", message: "消息类型无效。" }));
      return;
    }
    const message = parsed as ClientMessage;
    if (message.type === "ready" && typeof message.ready !== "boolean") {
      socket.send(JSON.stringify({ type: "error", message: "准备状态无效。" }));
      return;
    }
    if (message.type === "sliceBatch" && (!Array.isArray(message.claims) || message.claims.length > 96 || message.claims.some((claim) => !isSliceClaim(claim)))) {
      socket.send(JSON.stringify({ type: "error", message: "切水果数据无效。" }));
      return;
    }
    const beforeSync = message.type === "sync" ? JSON.stringify(this.room) : undefined;
    if (message.type !== "sync") this.room.lastActivity = Date.now();
    // A survival slice arriving near the landing boundary must be validated
    // before the same tick can mark that fruit as missed.
    if (message.type !== "sliceBatch") await this.advanceRoom();
    if (!this.room) return;

    if (message.type === "sync") {
      if (beforeSync !== JSON.stringify(this.room)) {
        await this.persistAndBroadcast();
      } else {
        try {
          socket.send(JSON.stringify(this.snapshot()));
        } catch {
          // The close callback will mark the player as disconnected.
        }
      }
      return;
    }

    if (message.type === "ready" && this.room.phase === "lobby") {
      player.ready = Boolean(message.ready);
      if (this.room.players.length === 2 && this.room.players.every((candidate) => candidate.ready)) {
        this.room.round = 1;
        for (const candidate of this.room.players) candidate.roundWins = 0;
        await this.startRound(false);
      }
    } else if (message.type === "sliceBatch") {
      await this.handleSliceBatch(player, message.claims);
      await this.advanceRoom();
    } else if (message.type === "rematch" && this.room.phase === "finished") {
      player.ready = true;
      if (this.room.players.length === 2 && this.room.players.every((candidate) => candidate.ready)) {
        this.room.round = 1;
        for (const candidate of this.room.players) candidate.roundWins = 0;
        await this.startRound(false);
      }
    } else if (message.type === "forfeit" && ["countdown", "playing"].includes(this.room.phase)) {
      await this.finishMatch(otherPlayer(this.room, player.id)?.id, "forfeit", `${player.nickname} 已认输`);
    }

    await this.persistAndBroadcast();
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    if (!this.room) return;
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    const player = this.room.players.find((candidate) => candidate.id === attachment?.playerId && candidate.connectionId === attachment?.connectionId);
    if (!player) return;
    player.connected = this.hasOpenSocket(player.id, socket);
    if (!player.connected) player.disconnectAt = Date.now();
    this.room.lastActivity = Date.now();
    await this.persistAndBroadcast();
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    await this.webSocketClose(socket);
  }

  async alarm(): Promise<void> {
    await this.advanceRoom();
    if (this.room) await this.persistAndBroadcast();
  }

  private async create(request: Request): Promise<Response> {
    if (this.room) return json({ error: "房间码冲突。" }, 409);
    const input = await readJson(request);
    const now = Date.now();
    const player = createPlayer(normalizeNickname(input.nickname));
    this.room = {
      code: String(input.code),
      mode: normalizeMode(input.mode),
      phase: "lobby",
      players: [player],
      round: 1,
      overtime: false,
      createdAt: now,
      lastActivity: now,
    };
    await this.persist();
    return json(credentials(this.room, player), 201);
  }

  private async join(request: Request): Promise<Response> {
    if (!this.room) return json({ error: "房间不存在或已经过期。" }, 404);
    if (this.room.players.length >= 2) return json({ error: "这个房间已经满员。" }, 409);
    if (this.room.phase !== "lobby") return json({ error: "比赛已经开始，无法加入。" }, 409);
    const input = await readJson(request);
    const player = createPlayer(normalizeNickname(input.nickname));
    this.room.players.push(player);
    this.room.lastActivity = Date.now();
    await this.persistAndBroadcast();
    return json(credentials(this.room, player), 201);
  }

  private async upgrade(request: Request): Promise<Response> {
    if (!this.room) return json({ error: "房间不存在或已经过期。" }, 404);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "需要 WebSocket 连接。" }, 426);
    }
    const url = new URL(request.url);
    const playerId = url.searchParams.get("player") ?? "";
    const token = url.searchParams.get("token") ?? "";
    const player = this.room.players.find((candidate) => candidate.id === playerId && candidate.token === token);
    if (!player) return json({ error: "房间凭据无效。" }, 401);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [player.id]);
    const connectionId = crypto.randomUUID();
    server.serializeAttachment({ playerId: player.id, connectionId } satisfies SocketAttachment);
    player.connectionId = connectionId;
    player.connected = true;
    player.disconnectAt = undefined;
    this.room.lastActivity = Date.now();
    await this.persist();
    queueMicrotask(() => this.broadcast());
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleSliceBatch(player: PlayerState, claims: SliceClaim[]): Promise<void> {
    if (!this.room || !Array.isArray(claims) || this.room.startAt === undefined || this.room.seed === undefined) return;
    if (this.room.phase === "countdown" && Date.now() >= this.room.startAt) this.room.phase = "playing";
    if (this.room.phase !== "playing") return;
    const serverElapsed = Date.now() - this.room.startAt;
    if (serverElapsed > (this.room.durationMs ?? 90_000) + CLAIM_SETTLEMENT_GRACE_MS) return;
    const schedule = generateMatchSchedule(this.room.seed, this.room.durationMs ?? 90_000);
    const scheduleById = new Map(schedule.map((fruit) => [fruit.id, fruit]));
    const sliced = new Set(player.slicedIds);
    const missed = new Set(player.missedIds);

    for (const claim of claims.slice(0, 24)) {
      if (!claim || sliced.has(claim.fruitId) || missed.has(claim.fruitId)) continue;
      if (claim.atMs > serverElapsed + 500 || claim.atMs < serverElapsed - 2_500) continue;
      const fruit = scheduleById.get(claim.fruitId);
      if (!fruit || !validateSliceClaim(fruit, claim)) continue;
      sliced.add(fruit.id);
      player.slicedIds.push(fruit.id);
      if (fruit.isBomb) {
        if (this.room.mode === "survival") {
          await this.finishMatch(otherPlayer(this.room, player.id)?.id, "bomb", `${player.nickname} 切中了炸弹`);
          return;
        }
        player.score = Math.max(0, player.score - 10);
      } else {
        player.score += fruitPoints(fruit.type);
        player.lastScoreAt = Date.now();
      }
    }
  }

  private async advanceRoom(): Promise<void> {
    if (!this.room) return;
    const now = Date.now();
    for (const player of this.room.players) {
      if (
        !player.connected
        && player.disconnectAt
        && now - player.disconnectAt >= RECONNECT_GRACE_MS
        && ["countdown", "playing"].includes(this.room.phase)
      ) {
        await this.finishMatch(otherPlayer(this.room, player.id)?.id, "forfeit", `${player.nickname} 已掉线`);
        return;
      }
    }

    if (this.room.phase === "between-rounds" && this.room.nextRoundAt && now >= this.room.nextRoundAt) {
      this.room.round += 1;
      await this.startRound(false);
      return;
    }

    if (this.room.startAt !== undefined && now >= this.room.startAt && this.room.phase === "countdown") {
      this.room.phase = "playing";
    }
    if (this.room.phase === "playing") {
      await this.applySurvivalMisses(now);
      if (!this.room || this.room.phase !== "playing") return;
      const endAt = (this.room.startAt ?? now) + (this.room.durationMs ?? 0);
      if (now >= endAt + CLAIM_SETTLEMENT_GRACE_MS) await this.finishRound();
    }

    if (
      this.room
      && now - this.room.lastActivity >= ROOM_TTL_MS
      && this.room.players.every((player) => !player.connected)
    ) {
      await this.ctx.storage.deleteAll();
      this.room = undefined;
    }
  }

  private async applySurvivalMisses(now: number): Promise<void> {
    if (!this.room || this.room.mode !== "survival" || this.room.startAt === undefined || this.room.seed === undefined) return;
    const elapsed = now - this.room.startAt;
    const schedule = generateMatchSchedule(this.room.seed, this.room.durationMs ?? 300_000);
    for (const player of this.room.players) {
      const sliced = new Set(player.slicedIds);
      const missed = new Set(player.missedIds);
      for (const fruit of schedule) {
        if (fruit.isBomb || sliced.has(fruit.id) || missed.has(fruit.id)) continue;
        if (fruit.launchAtMs + fruit.flightMs + CLAIM_SETTLEMENT_GRACE_MS > elapsed) continue;
        player.missedIds.push(fruit.id);
        missed.add(fruit.id);
        player.lives -= 1;
        if (player.lives <= 0) {
          await this.finishMatch(otherPlayer(this.room, player.id)?.id, "survival", `${player.nickname} 已用完三条命`);
          return;
        }
      }
    }
  }

  private async startRound(overtime: boolean): Promise<void> {
    if (!this.room) return;
    const rules = getRoundRules(this.room.mode, overtime);
    this.room.overtime = overtime;
    this.room.seed = randomSeed();
    this.room.startAt = Date.now() + (overtime ? 2_500 : 3_500);
    this.room.durationMs = rules.durationMs;
    this.room.phase = "countdown";
    this.room.result = undefined;
    this.room.nextRoundAt = undefined;
    for (const player of this.room.players) {
      if (!overtime) player.score = 0;
      player.lives = rules.startingLives;
      player.slicedIds = [];
      player.missedIds = [];
      player.ready = false;
      player.lastScoreAt = undefined;
    }
  }

  private async finishRound(): Promise<void> {
    if (!this.room) return;
    const [first, second] = this.room.players;
    if (!first || !second) return;
    const winner = first.score === second.score ? undefined : first.score > second.score ? first : second;

    if (!winner && !this.room.overtime && this.room.mode !== "survival") {
      await this.startRound(true);
      return;
    }

    if (this.room.mode === "bestOf3") {
      if (winner) winner.roundWins += 1;
      const matchWinner = this.room.players.find((player) => player.roundWins >= 2);
      if (matchWinner || this.room.round >= 3) {
        const finalWinner = matchWinner ?? resolveWins(this.room.players);
        await this.finishMatch(finalWinner?.id, finalWinner ? "score" : "draw", finalWinner ? `${finalWinner.nickname} 赢下三局两胜` : "三局结束，双方战平");
        return;
      }
      this.room.phase = "between-rounds";
      this.room.result = winner
        ? { winnerId: winner.id, reason: "score", label: `${winner.nickname} 赢下第 ${this.room.round} 局` }
        : { reason: "draw", label: `第 ${this.room.round} 局战平` };
      this.room.nextRoundAt = Date.now() + 5_000;
      return;
    }

    await this.finishMatch(
      winner?.id,
      winner ? "score" : "draw",
      winner ? `${winner.nickname} 得分更高` : "双方战平",
    );
  }

  private async finishMatch(winnerId: string | undefined, reason: RoomResult["reason"], label: string): Promise<void> {
    if (!this.room) return;
    this.room.phase = "finished";
    this.room.result = { winnerId, reason, label };
    this.room.nextRoundAt = undefined;
    for (const player of this.room.players) player.ready = false;
  }

  private snapshot(): RoomSnapshot {
    if (!this.room) throw new Error("room missing");
    return {
      type: "snapshot",
      serverNow: Date.now(),
      code: this.room.code,
      mode: this.room.mode,
      phase: this.room.phase,
      players: this.room.players.map(({ id, nickname, ready, connected, score, lives, roundWins }) => ({
        id,
        nickname,
        ready,
        connected,
        score,
        lives,
        roundWins,
      })),
      round: this.room.round,
      seed: this.room.seed,
      startAt: this.room.startAt,
      durationMs: this.room.durationMs,
      overtime: this.room.overtime,
      result: this.room.result,
    };
  }

  private async persistAndBroadcast(): Promise<void> {
    await this.persist();
    this.broadcast();
  }

  private async persist(): Promise<void> {
    if (!this.room) return;
    await this.ctx.storage.put("room", this.room);
    await this.scheduleNextRelevantAlarm();
  }

  private broadcast(): void {
    if (!this.room) return;
    const payload = JSON.stringify(this.snapshot());
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        // The close callback records the disconnected state.
      }
    }
  }

  private hasOpenSocket(playerId: string, except: WebSocket): boolean {
    return this.ctx.getWebSockets(playerId).some((socket) => socket !== except && socket.readyState === WebSocket.OPEN);
  }

  private async scheduleNextRelevantAlarm(): Promise<void> {
    if (!this.room) return;
    const candidates: number[] = [];
    if (this.room.players.every((player) => !player.connected)) {
      candidates.push(this.room.lastActivity + ROOM_TTL_MS);
    }
    if (this.room.startAt !== undefined && this.room.durationMs !== undefined && ["countdown", "playing"].includes(this.room.phase)) {
      candidates.push(this.room.startAt + this.room.durationMs + CLAIM_SETTLEMENT_GRACE_MS);
    }
    if (this.room.nextRoundAt) candidates.push(this.room.nextRoundAt);
    if (["countdown", "playing"].includes(this.room.phase)) {
      for (const player of this.room.players) {
        if (player.disconnectAt) candidates.push(player.disconnectAt + RECONNECT_GRACE_MS);
      }
    }
    if (candidates.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.scheduleAlarm(Math.min(...candidates));
  }

  private async scheduleAlarm(timestamp: number): Promise<void> {
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 250, timestamp));
  }
}

function createPlayer(nickname: string): PlayerState {
  return {
    id: crypto.randomUUID(),
    token: `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", ""),
    nickname,
    ready: false,
    connected: false,
    score: 0,
    lives: 3,
    roundWins: 0,
    slicedIds: [],
    missedIds: [],
  };
}

function credentials(room: StoredRoom, player: PlayerState): CreateRoomResponse {
  return {
    code: room.code,
    mode: room.mode,
    playerId: player.id,
    token: player.token,
    nickname: player.nickname,
  };
}

function otherPlayer(room: StoredRoom, playerId: string): PlayerState | undefined {
  return room.players.find((player) => player.id !== playerId);
}

function resolveWins(players: PlayerState[]): PlayerState | undefined {
  const [first, second] = players;
  if (!first || !second || first.roundWins === second.roundWins) return undefined;
  return first.roundWins > second.roundWins ? first : second;
}

function normalizeNickname(value: unknown): string {
  const nickname = String(value ?? "").trim().replace(/[<>]/g, "");
  const length = [...nickname].length;
  if (length < 2 || length > 12) throw new Error("昵称需要 2–12 个字符。");
  return nickname;
}

function normalizeMode(value: unknown): CompetitiveMode {
  if (value === "score90" || value === "bestOf3" || value === "survival") return value;
  throw new Error("不支持的比赛规则。");
}

function randomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => ROOM_CODE_CHARACTERS[value % ROOM_CODE_CHARACTERS.length]).join("");
}

function randomSeed(): number {
  const data = new Uint32Array(1);
  crypto.getRandomValues(data);
  return data[0];
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new Error("请求内容格式错误。");
  }
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function resolveAllowedOrigin(request: Request, env: Env): string | undefined | null {
  const origin = request.headers.get("Origin");
  if (!origin) return undefined;
  if (origin === new URL(request.url).origin) return origin;
  const configured = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes("*")) return origin;
  for (const value of configured) {
    try {
      if (new URL(value).origin === origin) return origin;
    } catch {
      // Ignore malformed entries instead of accidentally widening access.
    }
  }
  return null;
}

function withCors(response: Response, origin: string | undefined | null): Response {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.append("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}












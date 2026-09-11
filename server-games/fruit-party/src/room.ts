import { randomBytes, randomUUID } from "node:crypto";
import WebSocket from "ws";
import {
  fruitPoints,
  generateMatchSchedule,
  getRoundRules,
  isSliceClaim,
  validateSliceClaim,
  type CompetitiveMode,
  type SliceClaim,
} from "../../../games/fruit-party/src/shared/match";
import {
  ROOM_CODE_CHARACTERS,
  type ClientMessage,
  type CreateRoomResponse,
  type RoomPhase,
  type RoomPlayerView,
  type RoomResult,
  type RoomSnapshot,
} from "../../../games/fruit-party/src/shared/protocol";

interface PlayerState extends RoomPlayerView {
  token: string;
  slicedIds: number[];
  missedIds: number[];
  disconnectAt?: number;
  lastScoreAt?: number;
  connectionId?: string;
}

interface RoomState {
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
export const MAX_SOCKET_MESSAGE_BYTES = 64 * 1024;
const CLIENT_MESSAGE_TYPES = new Set(["ready", "sliceBatch", "sync", "rematch", "forfeit"]);

export class RoomSession {
  readonly code: string;
  private readonly sockets = new Map<WebSocket, SocketAttachment>();
  private readonly state: RoomState;

  constructor(code: string, mode: CompetitiveMode, nickname: string) {
    const now = Date.now();
    this.code = code;
    this.state = {
      code,
      mode,
      phase: "lobby",
      players: [createPlayer(normalizeNickname(nickname))],
      round: 1,
      overtime: false,
      createdAt: now,
      lastActivity: now,
    };
  }

  hostCredentials(): CreateRoomResponse {
    return credentials(this.state, this.state.players[0]);
  }

  join(nickname: string): CreateRoomResponse {
    if (this.state.players.length >= 2) throw new RoomError(409, "这个房间已经满员。");
    if (this.state.phase !== "lobby") throw new RoomError(409, "比赛已经开始，无法加入。");
    const player = createPlayer(normalizeNickname(nickname));
    this.state.players.push(player);
    this.state.lastActivity = Date.now();
    this.broadcast();
    return credentials(this.state, player);
  }

  authorize(playerId: string, token: string): boolean {
    return this.state.players.some((player) => player.id === playerId && player.token === token);
  }

  attach(socket: WebSocket, playerId: string): void {
    const player = this.state.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new RoomError(401, "房间凭据无效。");

    for (const [existingSocket, attachment] of this.sockets) {
      if (attachment.playerId !== playerId) continue;
      this.sockets.delete(existingSocket);
      existingSocket.close(4001, "连接已被新的会话替代。");
    }

    const connectionId = randomUUID();
    player.connectionId = connectionId;
    player.connected = true;
    player.disconnectAt = undefined;
    this.state.lastActivity = Date.now();
    this.sockets.set(socket, { playerId, connectionId });
    this.broadcast();
  }

  detach(socket: WebSocket): void {
    const attachment = this.sockets.get(socket);
    this.sockets.delete(socket);
    if (!attachment) return;
    const player = this.state.players.find((candidate) =>
      candidate.id === attachment.playerId && candidate.connectionId === attachment.connectionId,
    );
    if (!player) return;
    player.connected = this.hasOpenSocket(player.id, socket);
    if (!player.connected) player.disconnectAt = Date.now();
    this.state.lastActivity = Date.now();
    this.broadcast();
  }

  handleMessage(socket: WebSocket, payload: string): void {
    const attachment = this.sockets.get(socket);
    const player = this.state.players.find((candidate) =>
      candidate.id === attachment?.playerId && candidate.connectionId === attachment?.connectionId,
    );
    if (!player) return;
    if (Buffer.byteLength(payload, "utf8") > MAX_SOCKET_MESSAGE_BYTES) {
      sendError(socket, "消息过大，已被拒绝。");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload) as unknown;
    } catch {
      sendError(socket, "消息格式错误。");
      return;
    }
    if (
      !parsed
      || typeof parsed !== "object"
      || Array.isArray(parsed)
      || typeof (parsed as { type?: unknown }).type !== "string"
      || !CLIENT_MESSAGE_TYPES.has((parsed as { type: string }).type)
    ) {
      sendError(socket, "消息类型无效。");
      return;
    }

    const message = parsed as ClientMessage;
    if (message.type === "ready" && typeof message.ready !== "boolean") {
      sendError(socket, "准备状态无效。");
      return;
    }
    if (
      message.type === "sliceBatch"
      && (!Array.isArray(message.claims) || message.claims.length > 96 || message.claims.some((claim) => !isSliceClaim(claim)))
    ) {
      sendError(socket, "切水果数据无效。");
      return;
    }

    const beforeAdvance = JSON.stringify(this.state);
    if (message.type !== "sync") this.state.lastActivity = Date.now();
    if (message.type !== "sliceBatch") this.advanceRoom();

    if (message.type === "sync") {
      if (beforeAdvance !== JSON.stringify(this.state)) this.broadcast();
      else sendSnapshot(socket, this.snapshot());
      return;
    }

    if (message.type === "ready" && this.state.phase === "lobby") {
      player.ready = message.ready;
      if (this.state.players.length === 2 && this.state.players.every((candidate) => candidate.ready)) {
        this.state.round = 1;
        for (const candidate of this.state.players) candidate.roundWins = 0;
        this.startRound(false);
      }
    } else if (message.type === "sliceBatch") {
      this.handleSliceBatch(player, message.claims);
      this.advanceRoom();
    } else if (message.type === "rematch" && this.state.phase === "finished") {
      player.ready = true;
      if (this.state.players.length === 2 && this.state.players.every((candidate) => candidate.ready)) {
        this.state.round = 1;
        for (const candidate of this.state.players) candidate.roundWins = 0;
        this.startRound(false);
      }
    } else if (message.type === "forfeit" && ["countdown", "playing"].includes(this.state.phase)) {
      this.finishMatch(otherPlayer(this.state, player.id)?.id, "forfeit", `${player.nickname} 已认输`);
    }

    this.broadcast();
  }

  tick(): void {
    const before = JSON.stringify(this.state);
    this.advanceRoom();
    if (before !== JSON.stringify(this.state)) this.broadcast();
  }

  isExpired(now = Date.now()): boolean {
    return now - this.state.lastActivity >= ROOM_TTL_MS
      && this.state.players.every((player) => !player.connected);
  }

  snapshot(): RoomSnapshot {
    return {
      type: "snapshot",
      serverNow: Date.now(),
      code: this.state.code,
      mode: this.state.mode,
      phase: this.state.phase,
      players: this.state.players.map(({ id, nickname, ready, connected, score, lives, roundWins }) => ({
        id,
        nickname,
        ready,
        connected,
        score,
        lives,
        roundWins,
      })),
      round: this.state.round,
      seed: this.state.seed,
      startAt: this.state.startAt,
      durationMs: this.state.durationMs,
      overtime: this.state.overtime,
      result: this.state.result,
    };
  }

  close(): void {
    for (const socket of this.sockets.keys()) socket.close(1001, "server shutdown");
    this.sockets.clear();
  }

  private handleSliceBatch(player: PlayerState, claims: SliceClaim[]): void {
    if (this.state.startAt === undefined || this.state.seed === undefined) return;
    if (this.state.phase === "countdown" && Date.now() >= this.state.startAt) this.state.phase = "playing";
    if (this.state.phase !== "playing") return;
    const serverElapsed = Date.now() - this.state.startAt;
    if (serverElapsed > (this.state.durationMs ?? 90_000) + CLAIM_SETTLEMENT_GRACE_MS) return;
    const schedule = generateMatchSchedule(this.state.seed, this.state.durationMs ?? 90_000);
    const scheduleById = new Map(schedule.map((fruit) => [fruit.id, fruit]));
    const sliced = new Set(player.slicedIds);
    const missed = new Set(player.missedIds);

    for (const claim of claims.slice(0, 24)) {
      if (sliced.has(claim.fruitId) || missed.has(claim.fruitId)) continue;
      if (claim.atMs > serverElapsed + 500 || claim.atMs < serverElapsed - 2_500) continue;
      const fruit = scheduleById.get(claim.fruitId);
      if (!fruit || !validateSliceClaim(fruit, claim)) continue;
      sliced.add(fruit.id);
      player.slicedIds.push(fruit.id);
      if (fruit.isBomb) {
        if (this.state.mode === "survival") {
          this.finishMatch(otherPlayer(this.state, player.id)?.id, "bomb", `${player.nickname} 切中了炸弹`);
          return;
        }
        player.score = Math.max(0, player.score - 10);
      } else {
        player.score += fruitPoints(fruit.type);
        player.lastScoreAt = Date.now();
      }
    }
  }

  private advanceRoom(): void {
    const now = Date.now();
    for (const player of this.state.players) {
      if (
        !player.connected
        && player.disconnectAt
        && now - player.disconnectAt >= RECONNECT_GRACE_MS
        && ["countdown", "playing"].includes(this.state.phase)
      ) {
        this.finishMatch(otherPlayer(this.state, player.id)?.id, "forfeit", `${player.nickname} 已掉线`);
        return;
      }
    }

    if (this.state.phase === "between-rounds" && this.state.nextRoundAt && now >= this.state.nextRoundAt) {
      this.state.round += 1;
      this.startRound(false);
      return;
    }
    if (this.state.startAt !== undefined && now >= this.state.startAt && this.state.phase === "countdown") {
      this.state.phase = "playing";
    }
    if (this.state.phase === "playing") {
      this.applySurvivalMisses(now);
      if (this.state.phase !== "playing") return;
      const endAt = (this.state.startAt ?? now) + (this.state.durationMs ?? 0);
      if (now >= endAt + CLAIM_SETTLEMENT_GRACE_MS) this.finishRound();
    }
  }

  private applySurvivalMisses(now: number): void {
    if (this.state.mode !== "survival" || this.state.startAt === undefined || this.state.seed === undefined) return;
    const elapsed = now - this.state.startAt;
    const schedule = generateMatchSchedule(this.state.seed, this.state.durationMs ?? 300_000);
    for (const player of this.state.players) {
      const sliced = new Set(player.slicedIds);
      const missed = new Set(player.missedIds);
      for (const fruit of schedule) {
        if (fruit.isBomb || sliced.has(fruit.id) || missed.has(fruit.id)) continue;
        if (fruit.launchAtMs + fruit.flightMs + CLAIM_SETTLEMENT_GRACE_MS > elapsed) continue;
        player.missedIds.push(fruit.id);
        missed.add(fruit.id);
        player.lives -= 1;
        if (player.lives <= 0) {
          this.finishMatch(otherPlayer(this.state, player.id)?.id, "survival", `${player.nickname} 已用完三条命`);
          return;
        }
      }
    }
  }

  private startRound(overtime: boolean): void {
    const rules = getRoundRules(this.state.mode, overtime);
    this.state.overtime = overtime;
    this.state.seed = randomBytes(4).readUInt32BE(0);
    this.state.startAt = Date.now() + (overtime ? 2_500 : 3_500);
    this.state.durationMs = rules.durationMs;
    this.state.phase = "countdown";
    this.state.result = undefined;
    this.state.nextRoundAt = undefined;
    for (const player of this.state.players) {
      if (!overtime) player.score = 0;
      player.lives = rules.startingLives;
      player.slicedIds = [];
      player.missedIds = [];
      player.ready = false;
      player.lastScoreAt = undefined;
    }
  }

  private finishRound(): void {
    const [first, second] = this.state.players;
    if (!first || !second) return;
    const winner = first.score === second.score ? undefined : first.score > second.score ? first : second;
    if (!winner && !this.state.overtime && this.state.mode !== "survival") {
      this.startRound(true);
      return;
    }
    if (this.state.mode === "bestOf3") {
      if (winner) winner.roundWins += 1;
      const matchWinner = this.state.players.find((player) => player.roundWins >= 2);
      if (matchWinner || this.state.round >= 3) {
        const finalWinner = matchWinner ?? resolveWins(this.state.players);
        this.finishMatch(finalWinner?.id, finalWinner ? "score" : "draw", finalWinner ? `${finalWinner.nickname} 赢下三局两胜` : "三局结束，双方战平");
        return;
      }
      this.state.phase = "between-rounds";
      this.state.result = winner
        ? { winnerId: winner.id, reason: "score", label: `${winner.nickname} 赢下第 ${this.state.round} 局` }
        : { reason: "draw", label: `第 ${this.state.round} 局战平` };
      this.state.nextRoundAt = Date.now() + 5_000;
      return;
    }
    this.finishMatch(winner?.id, winner ? "score" : "draw", winner ? `${winner.nickname} 得分更高` : "双方战平");
  }

  private finishMatch(winnerId: string | undefined, reason: RoomResult["reason"], label: string): void {
    this.state.phase = "finished";
    this.state.result = { winnerId, reason, label };
    this.state.nextRoundAt = undefined;
    for (const player of this.state.players) player.ready = false;
  }

  private broadcast(): void {
    const snapshot = this.snapshot();
    for (const socket of this.sockets.keys()) sendSnapshot(socket, snapshot);
  }

  private hasOpenSocket(playerId: string, except: WebSocket): boolean {
    for (const [socket, attachment] of this.sockets) {
      if (socket !== except && attachment.playerId === playerId && socket.readyState === WebSocket.OPEN) return true;
    }
    return false;
  }
}

export class RoomError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function createRoomCode(existing: ReadonlyMap<string, unknown>): string {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const bytes = randomBytes(6);
    const code = [...bytes].map((value) => ROOM_CODE_CHARACTERS[value % ROOM_CODE_CHARACTERS.length]).join("");
    if (!existing.has(code)) return code;
  }
  throw new RoomError(503, "暂时无法生成房间码，请重试。");
}

export function normalizeMode(value: unknown): CompetitiveMode {
  if (value === "score90" || value === "bestOf3" || value === "survival") return value;
  throw new RoomError(400, "不支持的比赛规则。");
}

function normalizeNickname(value: unknown): string {
  const nickname = String(value ?? "").trim().replace(/[<>]/g, "");
  const length = [...nickname].length;
  if (length < 2 || length > 12) throw new RoomError(400, "昵称需要 2–12 个字符。");
  return nickname;
}

function createPlayer(nickname: string): PlayerState {
  return {
    id: randomUUID(),
    token: `${randomUUID()}${randomUUID()}`.replaceAll("-", ""),
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

function credentials(room: RoomState, player: PlayerState): CreateRoomResponse {
  return { code: room.code, mode: room.mode, playerId: player.id, token: player.token, nickname: player.nickname };
}

function otherPlayer(room: RoomState, playerId: string): PlayerState | undefined {
  return room.players.find((player) => player.id !== playerId);
}

function resolveWins(players: PlayerState[]): PlayerState | undefined {
  const [first, second] = players;
  if (!first || !second || first.roundWins === second.roundWins) return undefined;
  return first.roundWins > second.roundWins ? first : second;
}

function sendSnapshot(socket: WebSocket, snapshot: RoomSnapshot): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(snapshot));
}

function sendError(socket: WebSocket, message: string): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "error", message }));
}

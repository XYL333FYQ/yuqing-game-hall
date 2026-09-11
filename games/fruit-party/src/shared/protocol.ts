import type { CompetitiveMode, SliceClaim } from "./match";

export const ROOM_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function isValidRoomCode(value: string): boolean {
  const normalized = value.toUpperCase();
  return normalized.length === 6
    && [...normalized].every((character) => ROOM_CODE_CHARACTERS.includes(character));
}

export type RoomPhase = "lobby" | "countdown" | "playing" | "between-rounds" | "finished";

export interface RoomPlayerView {
  id: string;
  nickname: string;
  ready: boolean;
  connected: boolean;
  score: number;
  lives: number;
  roundWins: number;
}

export interface RoomResult {
  winnerId?: string;
  reason: "score" | "survival" | "bomb" | "forfeit" | "draw";
  label: string;
}

export interface RoomSnapshot {
  type: "snapshot";
  serverNow: number;
  code: string;
  mode: CompetitiveMode;
  phase: RoomPhase;
  players: RoomPlayerView[];
  round: number;
  seed?: number;
  startAt?: number;
  durationMs?: number;
  overtime: boolean;
  result?: RoomResult;
}

export interface ServerErrorMessage {
  type: "error";
  message: string;
}

export type ServerMessage = RoomSnapshot | ServerErrorMessage;

export type ClientMessage =
  | { type: "ready"; ready: boolean }
  | { type: "sliceBatch"; claims: SliceClaim[] }
  | { type: "sync" }
  | { type: "rematch" }
  | { type: "forfeit" };

export interface RoomCredentials {
  code: string;
  playerId: string;
  token: string;
  nickname: string;
}

export function isRoomCredentials(value: unknown): value is RoomCredentials {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<Record<keyof RoomCredentials, unknown>>;
  return typeof candidate.code === "string"
    && isValidRoomCode(candidate.code)
    && typeof candidate.playerId === "string"
    && candidate.playerId.length > 0
    && typeof candidate.token === "string"
    && candidate.token.length > 0
    && typeof candidate.nickname === "string"
    && [...candidate.nickname].length >= 2
    && [...candidate.nickname].length <= 12;
}

export interface CreateRoomResponse extends RoomCredentials {
  mode: CompetitiveMode;
}

export const roomCredentialKey = (code: string): string => `yuqing-room-${code.toUpperCase()}`;


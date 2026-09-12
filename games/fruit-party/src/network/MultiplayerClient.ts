import type { GameSliceEvent } from "../types";
import type { ClientMessage, RoomCredentials, ServerMessage } from "../shared/protocol";
import type { SliceClaim } from "../shared/match";
import { multiplayerWebSocketUrl, waitForMultiplayerServiceConfig } from "./serviceConfig";

export class MultiplayerClient {
  private socket?: WebSocket;
  private closed = false;
  private reconnectStartedAt = 0;
  private flushTimer?: number;
  private syncTimer?: number;
  private reconnectTimer?: number;
  private queue: SliceClaim[] = [];
  private serverOffsetMs = 0;

  constructor(
    private readonly credentials: RoomCredentials,
    private readonly onMessage: (message: ServerMessage) => void,
    private readonly onConnection: (state: "connecting" | "online" | "reconnecting" | "offline") => void,
  ) {}

  connect(): void {
    this.closed = false;
    this.onConnection(this.reconnectStartedAt ? "reconnecting" : "connecting");
    void this.connectWhenConfigured();
  }

  private async connectWhenConfigured(): Promise<void> {
    await waitForMultiplayerServiceConfig();
    if (this.closed) return;
    const query = new URLSearchParams({
      player: this.credentials.playerId,
      token: this.credentials.token,
    });
    try {
      this.socket = new WebSocket(
        multiplayerWebSocketUrl(`/api/rooms/${this.credentials.code}/socket?${query}`),
      );
    } catch (error) {
      this.onConnection("offline");
      this.onMessage({
        type: "error",
        message: error instanceof Error ? error.message : "果切多人服务地址不可用。",
      });
      return;
    }
    this.socket.addEventListener("open", () => {
      this.reconnectStartedAt = 0;
      this.onConnection("online");
      this.startTimers();
      this.send({ type: "sync" });
    });
    this.socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type === "snapshot") {
          this.serverOffsetMs = message.serverNow - Date.now();
        }
        this.onMessage(message);
      } catch {
        this.onMessage({ type: "error", message: "收到无法识别的房间消息。" });
      }
    });
    this.socket.addEventListener("close", () => this.handleDisconnect());
    this.socket.addEventListener("error", () => this.socket?.close());
  }

  setReady(ready: boolean): void {
    this.send({ type: "ready", ready });
  }

  enqueueSlice(event: GameSliceEvent): void {
    this.queue.push({
      fruitId: event.fruitId,
      atMs: event.elapsedMs,
      durationMs: event.durationMs,
      start: event.start,
      end: event.end,
      viewport: event.viewport,
    });
    if (this.queue.length > 96) this.queue.splice(0, this.queue.length - 96);
  }

  resetRound(): void {
    this.queue = [];
  }

  rematch(): void {
    this.send({ type: "rematch" });
  }

  forfeit(): void {
    this.send({ type: "forfeit" });
  }

  getServerNow(): number {
    return Date.now() + this.serverOffsetMs;
  }

  requestSync(): void {
    this.send({ type: "sync" });
  }

  close(): void {
    this.closed = true;
    this.queue = [];
    this.stopTimers();
    if (this.reconnectTimer !== undefined) window.clearTimeout(this.reconnectTimer);
    this.socket?.close(1000, "leave");
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private startTimers(): void {
    this.stopTimers();
    this.flushTimer = window.setInterval(() => {
      if (this.queue.length === 0) return;
      const claims = this.queue.splice(0, 24);
      this.send({ type: "sliceBatch", claims });
    }, 100);
    this.syncTimer = window.setInterval(() => this.send({ type: "sync" }), 1_000);
  }

  private stopTimers(): void {
    if (this.flushTimer !== undefined) window.clearInterval(this.flushTimer);
    if (this.syncTimer !== undefined) window.clearInterval(this.syncTimer);
    this.flushTimer = undefined;
    this.syncTimer = undefined;
  }

  private handleDisconnect(): void {
    this.stopTimers();
    if (this.closed) {
      this.onConnection("offline");
      return;
    }
    const now = Date.now();
    this.reconnectStartedAt ||= now;
    if (now - this.reconnectStartedAt >= 15_000) {
      this.onConnection("offline");
      return;
    }
    this.onConnection("reconnecting");
    this.reconnectTimer = window.setTimeout(() => this.connect(), 1_200);
  }
}



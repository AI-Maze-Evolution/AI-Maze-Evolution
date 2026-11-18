import type { ConnectionStatus, ServerMessage } from "../types/simulation";

export interface SocketCallbacks {
  onMessage: (message: ServerMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

function resolveWebSocketUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envUrl) return envUrl;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/simulation`;
}

export class SimulationWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private closedManually = false;
  private readonly callbacks: SocketCallbacks;

  constructor(callbacks: SocketCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(): void {
    this.closedManually = false;
    this.clearTimers();
    this.callbacks.onStatusChange(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    const url = resolveWebSocketUrl();
    const socket = new WebSocket(url);
    this.ws = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.callbacks.onStatusChange("connected");
      this.startHeartbeat();
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as ServerMessage;
        this.callbacks.onMessage(parsed);
      } catch {
        // Ignore malformed frames
      }
    };

    socket.onerror = () => {
      // onclose will trigger reconnection
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      if (this.closedManually) {
        this.callbacks.onStatusChange("disconnected");
        return;
      }
      this.scheduleReconnect();
    };
  }

  public disconnect(): void {
    this.closedManually = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.onStatusChange("disconnected");
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delayMs = Math.min(10000, 1000 * Math.pow(1.6, Math.min(this.reconnectAttempts - 1, 5)));
    this.callbacks.onStatusChange("reconnecting");
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delayMs);
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

const WS_URL = 'wss://api.hyperliquid.xyz/ws';
const STALL_MS = 3000;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

export type WsStatus = 'connecting' | 'live' | 'stalled' | 'reconnecting';

interface AllMidsMessage {
  channel: 'allMids';
  data: { mids: Record<string, string> };
}

type MidsListener = (mids: Map<string, number>, status: WsStatus) => void;

class HyperliquidClient {
  private _ws: WebSocket | null = null;
  private _mids: Map<string, number> = new Map();
  private _status: WsStatus = 'connecting';
  private _listeners: Set<MidsListener> = new Set();
  private _lastMessageAt: number = 0;
  private _reconnectAttempt: number = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _started: boolean = false;

  public start(): void {
    if (this._started) return;
    this._started = true;
    this._connect();
    setInterval(() => this._checkStall(), 1000);
  }

  public subscribe(listener: MidsListener): () => void {
    this._listeners.add(listener);
    listener(this._mids, this._status);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _connect(): void {
    this._setStatus(this._reconnectAttempt === 0 ? 'connecting' : 'reconnecting');
    try {
      this._ws = new WebSocket(WS_URL);
    } catch {
      this._scheduleReconnect();
      return;
    }
    this._ws.addEventListener('open', () => {
      this._reconnectAttempt = 0;
      this._lastMessageAt = Date.now();
      this._ws?.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
    });
    this._ws.addEventListener('message', (e) => {
      this._lastMessageAt = Date.now();
      try {
        const parsed = JSON.parse(typeof e.data === 'string' ? e.data : '') as
          | AllMidsMessage
          | { channel: string; data: unknown };
        if (parsed.channel === 'allMids') {
          const mids = (parsed as AllMidsMessage).data.mids;
          for (const [coin, priceStr] of Object.entries(mids)) {
            const price = Number(priceStr);
            if (Number.isFinite(price)) this._mids.set(coin, price);
          }
          this._setStatus('live');
        }
      } catch {
        // Ignore malformed messages — they shouldn't end the stream.
      }
    });
    this._ws.addEventListener('close', () => this._scheduleReconnect());
    this._ws.addEventListener('error', () => this._ws?.close());
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimer) return;
    this._setStatus('reconnecting');
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** this._reconnectAttempt);
    this._reconnectAttempt += 1;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, delay);
  }

  private _checkStall(): void {
    if (this._status !== 'live') return;
    if (Date.now() - this._lastMessageAt > STALL_MS) {
      this._setStatus('stalled');
    }
  }

  private _setStatus(next: WsStatus): void {
    if (next === this._status) return;
    this._status = next;
    this._notify();
  }

  private _notify(): void {
    for (const l of this._listeners) l(this._mids, this._status);
  }
}

let singleton: HyperliquidClient | null = null;

export function hyperliquidClient(): HyperliquidClient {
  if (!singleton) singleton = new HyperliquidClient();
  return singleton;
}

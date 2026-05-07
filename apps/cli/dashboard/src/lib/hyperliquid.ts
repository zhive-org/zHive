const WS_URL = 'wss://api.hyperliquid.xyz/ws';
const STALL_MS = 3000;
const STALL_FORCE_RECONNECT_MS = 15_000;
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
  private _stallTimer: ReturnType<typeof setInterval> | null = null;
  private _started: boolean = false;
  private _stopped: boolean = false;
  private readonly _dex: string | undefined;

  public constructor(dex?: string) {
    this._dex = dex;
  }

  public start(): void {
    if (this._started || this._stopped) return;
    this._started = true;
    this._connect();
    this._stallTimer = setInterval(() => this._checkStall(), 1000);
  }

  public stop(): void {
    this._stopped = true;
    this._started = false;
    if (this._stallTimer) {
      clearInterval(this._stallTimer);
      this._stallTimer = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      try {
        this._ws.close();
      } catch {
        // ignore
      }
      this._ws = null;
    }
  }

  public subscribe(listener: MidsListener): () => void {
    this._listeners.add(listener);
    listener(this._mids, this._status);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _connect(): void {
    if (this._stopped) return;
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
      const subscription: { type: 'allMids'; dex?: string } = { type: 'allMids' };
      if (this._dex !== undefined) subscription.dex = this._dex;
      this._ws?.send(JSON.stringify({ method: 'subscribe', subscription }));
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
    this._ws.addEventListener('close', () => {
      if (!this._stopped) this._scheduleReconnect();
    });
    this._ws.addEventListener('error', () => this._ws?.close());
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimer || this._stopped) return;
    this._setStatus('reconnecting');
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** this._reconnectAttempt);
    this._reconnectAttempt += 1;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, delay);
  }

  private _checkStall(): void {
    if (this._stopped) return;
    const sinceLastMsg = Date.now() - this._lastMessageAt;
    if (this._status === 'live' && sinceLastMsg > STALL_MS) {
      this._setStatus('stalled');
    }
    // Half-open TCP can sit at `stalled` forever without firing `close`. After
    // 15s of no data, force a reconnect so the user isn't staring at stale
    // mids presented as live.
    if (this._status === 'stalled' && sinceLastMsg > STALL_FORCE_RECONNECT_MS) {
      try {
        this._ws?.close();
      } catch {
        // ignore
      }
      this._scheduleReconnect();
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

let _defaultClient: HyperliquidClient | null = null;
const _clientsByDex: Map<string, HyperliquidClient> = new Map();

/**
 * Returns a singleton mids client for the given Hyperliquid perp DEX. Pass
 * `undefined` for the default perp universe; pass a HIP-3 builder DEX name
 * (e.g. `"xyz"`) for a builder-deployed universe. Each dex gets its own
 * socket because the `allMids` stream is scoped per dex.
 */
export function hyperliquidClient(dex?: string): HyperliquidClient {
  if (dex === undefined) {
    if (!_defaultClient) _defaultClient = new HyperliquidClient();
    return _defaultClient;
  }
  const existing = _clientsByDex.get(dex);
  if (existing) return existing;
  const created = new HyperliquidClient(dex);
  _clientsByDex.set(dex, created);
  return created;
}

import type { LivelinePoint } from 'liveline';

export interface BufferPolicy {
  maxPoints: number;
  initialWindowSecs: number;
}

const HEARTBEAT_STALL_MS = 2_000;
const HEARTBEAT_TICK_MS = 1_000;

function isFiniteNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function buildFlatWindow(nowSecs: number, value: number, windowSecs: number): LivelinePoint[] {
  return [
    { time: nowSecs - windowSecs, value },
    { time: nowSecs, value },
  ];
}

class PriceBufferStore {
  private _buffers: Map<string, LivelinePoint[]> = new Map();
  private _versions: Map<string, number> = new Map();
  private _listeners: Map<string, Set<() => void>> = new Map();
  private _lastAppendMs: Map<string, number> = new Map();
  private _stallHandlers: Map<string, () => void> = new Map();
  private _heartbeatId: number | null = null;
  private _emptyBuffer: LivelinePoint[] = [];

  public subscribe(key: string, cb: () => void): () => void {
    let set = this._listeners.get(key);
    if (!set) {
      set = new Set();
      this._listeners.set(key, set);
    }
    set.add(cb);
    return () => {
      const current = this._listeners.get(key);
      if (!current) return;
      current.delete(cb);
      if (current.size === 0) this._listeners.delete(key);
    };
  }

  public getSnapshot(key: string): LivelinePoint[] {
    const buffer = this._buffers.get(key);
    if (!buffer) return this._emptyBuffer;
    return buffer;
  }

  public appendPoint(key: string, point: LivelinePoint, policy: BufferPolicy): void {
    if (!isFiniteNumber(point.value)) return;

    const prev = this._buffers.get(key);

    if (!prev || prev.length === 0) {
      const seeded = buildFlatWindow(point.time, point.value, policy.initialWindowSecs);
      // Replace the last seed point's time with the actual tick time so live value ends at `now`.
      seeded[seeded.length - 1] = point;
      this._buffers.set(key, seeded);
      this._lastAppendMs.set(key, Date.now());
      this._notify(key);
      return;
    }

    const last = prev[prev.length - 1];
    if (last && Math.abs(point.time - last.time) < 1 && last.value === point.value) {
      // Same-second identical value — skip (matches zhive-app dedup).
      this._lastAppendMs.set(key, Date.now());
      return;
    }

    const appended = [...prev, point];
    const capped =
      appended.length > policy.maxPoints
        ? appended.slice(appended.length - policy.maxPoints)
        : appended;
    this._buffers.set(key, capped);
    this._lastAppendMs.set(key, Date.now());
    this._notify(key);
  }

  public reset(key: string): void {
    if (!this._buffers.has(key)) return;
    this._buffers.delete(key);
    this._lastAppendMs.delete(key);
    this._notify(key);
  }

  /**
   * Drop every buffered series and notify subscribers. Used at agent boundary
   * (ready → selecting) so the next agent's mini-charts don't carry forward
   * the prior agent's price history.
   */
  public clearAll(): void {
    const keys = Array.from(this._buffers.keys());
    this._buffers.clear();
    this._lastAppendMs.clear();
    for (const key of keys) this._notify(key);
  }

  public registerStallHandler(key: string, stall: () => void): () => void {
    this._stallHandlers.set(key, stall);
    this._ensureHeartbeat();
    return () => {
      if (this._stallHandlers.get(key) === stall) {
        this._stallHandlers.delete(key);
      }
      if (this._stallHandlers.size === 0) this._teardownHeartbeat();
    };
  }

  private _notify(key: string): void {
    this._versions.set(key, (this._versions.get(key) ?? 0) + 1);
    const set = this._listeners.get(key);
    if (!set) return;
    for (const cb of set) cb();
  }

  private _ensureHeartbeat(): void {
    if (this._heartbeatId != null) return;
    if (typeof window === 'undefined') return;

    this._heartbeatId = window.setInterval(() => {
      const now = Date.now();
      for (const [key, handler] of this._stallHandlers) {
        const lastAppend = this._lastAppendMs.get(key) ?? 0;
        if (now - lastAppend < HEARTBEAT_STALL_MS) continue;
        handler();
      }
    }, HEARTBEAT_TICK_MS);
  }

  private _teardownHeartbeat(): void {
    if (this._heartbeatId == null) return;
    if (typeof window === 'undefined') return;
    window.clearInterval(this._heartbeatId);
    this._heartbeatId = null;
  }
}

export const priceBufferStore = new PriceBufferStore();

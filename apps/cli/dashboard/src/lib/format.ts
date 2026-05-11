export function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function formatUsd(value: number, opts: { signed?: boolean } = {}): string {
  const sign = opts.signed && value > 0 ? '+' : '';
  const abs = Math.abs(value);
  const formatted =
    abs >= 1000 ? abs.toLocaleString(undefined, { maximumFractionDigits: 0 }) : abs.toFixed(2);
  return `${value < 0 ? '-' : sign}$${formatted}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** Signed, fixed-precision $ notional (e.g. "$1,234.56"). Always shows the
 * absolute magnitude — pair with text color to convey sign. */
export function formatNotional(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? '-' : ''}$${formatted}`;
}

/** Signed price (no currency symbol). Useful for entry/exit prices in tables. */
export function formatPrice(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Position size with adaptive precision — small coins need more decimals. */
export function formatSize(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** ROE — input is a DECIMAL (0.12 = 12%), not a percent. Mirrors the
 * upstream `roe_pct` semantics on `PositionDto` / `ClosedTradeDto`. */
export function formatRoe(decimal: number): string {
  const pct = decimal * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/** Compact hold-duration string (e.g. "3m", "2h 14m", "5d 3h"). */
export function formatHoldTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hour = Math.floor(min / 60);
  const remMin = min % 60;
  if (hour < 24) return remMin === 0 ? `${hour}h` : `${hour}h ${remMin}m`;
  const day = Math.floor(hour / 24);
  const remHour = hour % 24;
  return remHour === 0 ? `${day}d` : `${day}d ${remHour}h`;
}

/** Relative time string ("3m ago", "yesterday", "Mar 4"). */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const deltaSec = Math.floor((Date.now() - then) / 1000);
  if (deltaSec < 60) return `${Math.max(0, deltaSec)}s ago`;
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}d ago`;
  const d = new Date(then);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

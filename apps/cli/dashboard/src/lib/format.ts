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

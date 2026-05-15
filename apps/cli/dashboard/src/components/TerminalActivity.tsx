import { useEffect, useMemo, useRef } from 'react';
import { ActionBadge, type ActionBadgeVariant } from './primitives/ActionBadge';
import { SymbolLink } from './primitives/SymbolLink';
import { displaySymbol } from '../lib/coin';
import { formatTime, formatUsd } from '../lib/format';
import type { WebEvent } from '../lib/types';

interface TerminalActivityProps {
  events: WebEvent[];
}

interface AnalyzingBannerState {
  assetCount: number;
  assets: string[];
}

function deriveAnalyzing(events: WebEvent[]): AnalyzingBannerState | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'analyzing') {
      if (e.state === 'started') {
        return {
          assetCount: e.assetCount ?? 0,
          assets: e.assets ?? [],
        };
      }
      return null;
    }
  }
  return null;
}

export function TerminalActivity({ events }: TerminalActivityProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => events.filter((e) => e.type !== 'chat' && e.type !== 'system' && e.type !== 'analyzing'),
    [events],
  );
  const analyzing = useMemo(() => deriveAnalyzing(events), [events]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible.length, analyzing]);

  return (
    <section className="flex min-h-0 flex-col bg-hive-near-black">
      <div className="flex shrink-0 items-center justify-between border-b border-hive-border bg-hive-black px-4 py-2 text-[10px] uppercase tracking-[0.22em]">
        <span className="text-hive-text-secondary">agent.log</span>
        <span className="text-hive-text-dim">
          tail -f · <span className="text-hive-honey">{analyzing ? 'analyzing' : 'streaming'}</span>
        </span>
      </div>

      {analyzing && <AnalyzingBanner assetCount={analyzing.assetCount} assets={analyzing.assets} />}

      <div
        ref={scrollRef}
        className="h-[480px] overflow-y-auto px-4 py-3 font-mono text-[13px] leading-[1.65]"
      >
        {visible.length === 0 && !analyzing && (
          <p className="text-hive-text-dim">Waiting for the agent to come online…</p>
        )}
        {visible.map((e) => (
          <TerminalRow key={e.seq} event={e} />
        ))}
      </div>
    </section>
  );
}

function AnalyzingBanner({ assetCount, assets }: { assetCount: number; assets: string[] }) {
  const visibleChips = assets.slice(0, 6);
  const hiddenCount = Math.max(0, assets.length - visibleChips.length);

  return (
    <div
      className="relative shrink-0 overflow-hidden border-b border-hive-honey/20 bg-hive-honey/5 px-4 py-2 animate-hive-glow"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-hive-honey/15 to-transparent animate-hive-shimmer" />
      <div className="relative flex items-center gap-3 text-[11px]">
        <span className="font-semibold uppercase tracking-[0.24em] text-hive-honey">analyzing</span>
        <span className="text-hive-text-dim">›</span>
        <span className="text-hive-text-secondary">
          scanning <span className="text-hive-text-primary">{assetCount}</span>{' '}
          {assetCount === 1 ? 'asset' : 'assets'} · candles + orderflow
        </span>
        {visibleChips.length > 0 && (
          <div className="ml-auto flex items-center gap-1">
            {visibleChips.map((asset, i) => (
              <span
                key={`${asset}-${i}`}
                style={{ animationDelay: `${i * 0.18}s` }}
                className="border border-hive-honey/30 bg-hive-black px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-hive-honey animate-hive-scan"
              >
                {displaySymbol(asset)}
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="font-mono text-[10px] text-hive-text-dim">+{hiddenCount}</span>
            )}
          </div>
        )}
        <span className="ml-2 flex gap-1">
          {[0, 0.2, 0.4].map((d, i) => (
            <span
              key={i}
              className="block h-1 w-1 rounded-full bg-hive-honey animate-hive-scan"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function TerminalRow({ event }: { event: WebEvent }) {
  const time = formatTime(event.timestamp);
  const stamp = <span className="shrink-0 tabular-nums text-hive-text-dim">{time}</span>;

  switch (event.type) {
    case 'message':
      return (
        <div className="flex gap-3">
          {stamp}
          <span className="text-hive-text-secondary">{event.text}</span>
        </div>
      );
    case 'error':
      return (
        <div className="flex gap-3">
          {stamp}
          <span className="text-hive-bearish">⚠ {event.errorMessage}</span>
        </div>
      );
    case 'online':
      return (
        <div className="flex gap-3">
          {stamp}
          <span className="text-hive-bullish">● {event.name} online</span>
        </div>
      );
    case 'decision': {
      // HOLD on an asset with no open position is a no-op, not a hold. The
      // producer carries `hasOpenPosition` for this exact distinction; treat
      // missing flag (pre-feature events) as HOLD to preserve old behavior.
      const displayedAction: ActionBadgeVariant =
        event.action === 'HOLD' && event.hasOpenPosition === false ? 'NO_ACTION' : event.action;
      return (
        <div className="flex gap-3">
          {stamp}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <ActionBadge action={displayedAction} />
              <SymbolLink asset={event.asset} variant="inline" />
              {event.sizeUsd !== undefined && (
                <span className="tabular-nums text-hive-text-dim">{formatUsd(event.sizeUsd)}</span>
              )}
            </div>
            {event.reasoning && (
              <div className="mt-0.5 text-hive-text-secondary">{event.reasoning}</div>
            )}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

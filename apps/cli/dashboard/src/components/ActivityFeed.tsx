import { useEffect, useMemo, useRef } from 'react';
import { formatTime, formatUsd } from '../lib/format';
import type { WebEvent } from '../lib/types';

interface ActivityFeedProps {
  events: WebEvent[];
}

const ACTION_COLOR: Record<string, string> = {
  LONG: 'text-hive-bullish',
  SHORT: 'text-hive-bearish',
  CLOSE: 'text-hive-honey',
  HOLD: 'text-hive-text-secondary',
};

export function ActivityFeed({ events }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(
    () =>
      events.filter(
        (e) => e.type !== 'chat' && e.type !== 'system' && e.type !== 'analyzing',
      ),
    [events],
  );

  // Derive thinking state from the latest analyzing event. The LLM call can
  // take a long time and the activity feed otherwise looks frozen — this
  // tells the user the agent is alive and working.
  const analyzing = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === 'analyzing') {
        return e.state === 'started'
          ? { assetCount: e.assetCount, assets: e.assets }
          : null;
      }
    }
    return null;
  }, [events]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible.length, analyzing]);

  return (
    // Designed to fit any flex/fixed-height parent — height comes from the
    // container (e.g. the docked panel in Dashboard.tsx).
    <section className="flex h-full min-h-0 flex-col border border-hive-border bg-hive-near-black">
      <div className="flex shrink-0 items-center justify-between border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          Activity
        </h2>
        <span className="font-mono text-xs text-hive-text-dim">{visible.length} events</span>
      </div>
      {analyzing && (
        <ThinkingBanner assetCount={analyzing.assetCount} assets={analyzing.assets} />
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-sm">
        {visible.length === 0 && !analyzing && (
          <p className="text-hive-text-dim">Waiting for the agent to come online…</p>
        )}
        {visible.map((e) => (
          <ActivityRow key={e.seq} event={e} />
        ))}
      </div>
    </section>
  );
}

function HexIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className={className}
      aria-hidden
    >
      <polygon
        points="12,2.5 21.2,7.5 21.2,16.5 12,21.5 2.8,16.5 2.8,7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <polygon
        points="12,7.5 16.5,10 16.5,14 12,16.5 7.5,14 7.5,10"
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  );
}

function ThinkingBanner({
  assetCount,
  assets,
}: {
  assetCount?: number;
  assets?: string[];
}) {
  const visibleChips = (assets ?? []).slice(0, 6);
  const hiddenCount = assets ? Math.max(0, assets.length - visibleChips.length) : 0;
  return (
    <div
      className="relative shrink-0 overflow-hidden border-b border-hive-honey/30 bg-hive-near-black animate-hive-glow"
      role="status"
      aria-live="polite"
    >
      {/* Slow-traveling shimmer band, narrow enough that the baseline stays
       * visible — feels like a scan line crossing the surface. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-full">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-hive-honey/15 to-transparent animate-hive-shimmer" />
      </div>
      <div className="relative flex items-center gap-3 px-4 py-2.5">
        <span className="inline-flex h-5 w-5 items-center justify-center text-hive-honey animate-hive-breathe">
          <HexIcon className="h-4 w-4" />
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-hive-honey">
            analyzing
          </span>
          <span className="font-mono text-[11px] text-hive-text-dim">›</span>
          <span className="font-mono text-[11px] text-hive-text-secondary">
            <span className="text-hive-text-primary">{assetCount ?? 0}</span>{' '}
            {assetCount === 1 ? 'asset' : 'assets'} in flight
          </span>
          <span className="inline-flex items-end gap-0.5 pl-0.5" aria-hidden>
            <span
              className="block h-1 w-1 rounded-full bg-hive-honey animate-hive-scan"
              style={{ animationDelay: '0s' }}
            />
            <span
              className="block h-1 w-1 rounded-full bg-hive-honey animate-hive-scan"
              style={{ animationDelay: '0.2s' }}
            />
            <span
              className="block h-1 w-1 rounded-full bg-hive-honey animate-hive-scan"
              style={{ animationDelay: '0.4s' }}
            />
          </span>
        </div>
        {visibleChips.length > 0 && (
          <div className="ml-auto flex items-center gap-1">
            {visibleChips.map((asset, i) => (
              <span
                key={`${asset}-${i}`}
                style={{ animationDelay: `${i * 0.18}s` }}
                className="border border-hive-honey/30 bg-hive-black px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-hive-honey animate-hive-scan"
              >
                {asset}
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="font-mono text-[10px] text-hive-text-dim">
                +{hiddenCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ event }: { event: WebEvent }) {
  const time = formatTime(event.timestamp);
  const stamp = <span className="mr-3 text-hive-text-dim">{time}</span>;

  switch (event.type) {
    case 'message':
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className="text-hive-white">{event.text}</span>
        </div>
      );
    case 'error':
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className="text-hive-bearish">⚠ {event.errorMessage}</span>
        </div>
      );
    case 'online':
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className="text-hive-bullish">● {event.name} online</span>
          {event.bio && <span className="ml-2 text-hive-text-secondary">— {event.bio}</span>}
        </div>
      );
    case 'decision': {
      const color = ACTION_COLOR[event.action] ?? 'text-hive-white';
      const size = event.sizeUsd !== undefined ? ` ${formatUsd(event.sizeUsd)}` : '';
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className={`font-semibold ${color}`}>{event.action}</span>
          <span className="ml-2 text-hive-text-primary">{event.asset}</span>
          <span className="text-hive-text-dim">{size}</span>
          <div className="ml-[6.5rem] mt-0.5 text-hive-text-secondary">{event.reasoning}</div>
        </div>
      );
    }
    default:
      return null;
  }
}

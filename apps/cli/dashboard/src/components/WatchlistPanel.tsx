interface WatchlistPanelProps {
  watchlist: string[];
}

export function WatchlistPanel({ watchlist }: WatchlistPanelProps) {
  return (
    <section className="border border-hive-border bg-hive-near-black">
      <div className="flex items-center justify-between border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          Watchlist
        </h2>
        <span className="font-mono text-xs text-hive-text-dim">{watchlist.length}</span>
      </div>
      <div className="p-3">
        {watchlist.length === 0 && (
          <p className="text-center font-mono text-sm text-hive-text-dim">Empty</p>
        )}
        {watchlist.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {watchlist.map((coin) => (
              <span
                key={coin}
                className="border border-hive-border bg-hive-black px-2 py-0.5 font-mono text-xs text-hive-text-secondary"
              >
                {coin}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

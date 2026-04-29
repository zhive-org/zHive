interface WatchlistPanelProps {
  watchlist: string[];
}

export function WatchlistPanel({ watchlist }: WatchlistPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Watchlist</h2>
        <span className="text-xs text-zinc-500">{watchlist.length}</span>
      </div>
      <div className="p-3">
        {watchlist.length === 0 && (
          <p className="text-center text-sm text-zinc-500">Empty</p>
        )}
        {watchlist.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {watchlist.map((coin) => (
              <span
                key={coin}
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-xs text-zinc-300"
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

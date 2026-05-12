/** Coin string normalization shared across position/watchlist/mids wiring.
 *
 * Sources flag coins differently:
 *  - Hyperliquid's `allMids` WS stream keys mids by base coin: `"BTC"`, `"ETH"`.
 *  - The zHive exchange adapter's `fetchPositions()` returns
 *    `coin === position.token_id`, which is `"BTC-PERP"` (or `"xyz:AAPL"` for
 *    HIP-3 builder DEX assets).
 *  - The watchlist stores plain base coins: `"BTC"`.
 *
 * The dashboard needs to (a) subscribe to the right WS feed and (b) look up
 * the right mid for a given position. Both work cleanly if we strip the
 * `-PERP` suffix everywhere downstream of `DetailedPosition`. The `xyz:`
 * prefix is kept on the wire because `useMids` uses it to route per-DEX, then
 * the merged mids map ends up keyed by the full prefixed string.
 */

/** Returns a coin in the form `useMids` can subscribe to AND `mids.get(...)`
 * can look up. Strips `-PERP` (perpetual contract suffix) but preserves any
 * `<dex>:` namespace because that's load-bearing for DEX routing. */
export function normalizeCoinKey(coin: string): string {
  return coin.replace(/-PERP$/i, '');
}

/** Display symbol — drops both the `-PERP` suffix and the `<dex>:` prefix so
 * the UI shows `"AAPL"` rather than `"xyz:AAPL"`. */
export function displaySymbol(coin: string): string {
  const stripped = coin.replace(/-PERP$/i, '');
  const colon = stripped.indexOf(':');
  return (colon > 0 ? stripped.slice(colon + 1) : stripped).toUpperCase();
}

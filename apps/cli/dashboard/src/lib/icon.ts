export function buildFallbackMarketIconUrl(tokenId: string): string {
  return `https://app.hyperliquid.xyz/coins/${encodeURIComponent(tokenId)}.svg`;
}

import { useState } from 'react';
import { buildFallbackMarketIconUrl } from '../../lib/icon';
import { displaySymbol } from '../../lib/coin';

interface SymbolIconProps {
  base: string;
  iconUrl?: string;
  className?: string;
}

export function SymbolIcon({ base, iconUrl, className }: SymbolIconProps) {
  const [broken, setBroken] = useState(false);
  const displayBase = displaySymbol(base);
  const resolvedUrl = iconUrl ?? buildFallbackMarketIconUrl(base);
  const baseClasses = 'w-4 h-4 shrink-0';
  const mergedClasses = className ? `${baseClasses} ${className}` : baseClasses;
  if (resolvedUrl && !broken) {
    return (
      <img
        src={resolvedUrl}
        alt={displayBase}
        className={mergedClasses}
        onError={() => setBroken(true)}
      />
    );
  }
  const tileClasses = `${baseClasses} inline-flex items-center justify-center border border-hive-border bg-hive-dark-gray font-mono text-[8px] font-bold text-hive-honey${
    className ? ` ${className}` : ''
  }`;
  return <span className={tileClasses}>{displayBase.charAt(0)}</span>;
}

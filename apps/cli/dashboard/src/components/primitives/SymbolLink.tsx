import { SymbolIcon } from './SymbolIcon';
import { displaySymbol } from '../../lib/coin';

interface SymbolLinkProps {
  asset: string;
  variant?: 'inline' | 'badge';
  className?: string;
}

export function SymbolLink({ asset, variant = 'inline', className }: SymbolLinkProps) {
  const display = displaySymbol(asset);
  const href = `https://www.zhive.ai/markets/${encodeURIComponent(asset)}`;
  const variantClasses =
    variant === 'badge'
      ? 'gap-2 text-sm font-bold tracking-wider'
      : 'gap-1.5 text-[13px] font-semibold tracking-wider';
  const composed = `inline-flex items-center ${variantClasses} text-hive-text-primary hover:text-hive-honey transition-colors${
    className ? ` ${className}` : ''
  }`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={composed}>
      <SymbolIcon base={asset} />
      <span>{display}</span>
    </a>
  );
}

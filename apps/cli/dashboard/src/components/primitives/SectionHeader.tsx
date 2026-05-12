import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  right?: ReactNode;
}

/** Variant-A terminal-style section band — `bg-hive-black` strip with an
 * uppercase low-tracked label on the left and an optional dim hint on the
 * right (e.g. "tail -f · streaming", "all-time", "12 assets"). */
export function SectionHeader({ title, right }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-hive-border bg-hive-black px-4 py-2 text-[10px] uppercase tracking-[0.22em]">
      <span className="text-hive-text-secondary">{title}</span>
      {right && <span className="text-hive-text-dim">{right}</span>}
    </div>
  );
}

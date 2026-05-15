export type DecisionAction = 'LONG' | 'SHORT' | 'CLOSE' | 'HOLD';
export type ActionBadgeVariant = DecisionAction | 'NO_ACTION';

interface ActionBadgeProps {
  action: ActionBadgeVariant;
  size?: 'md' | 'lg';
}

const ACTION_CLASS: Record<ActionBadgeVariant, string> = {
  LONG: 'border-hive-bullish/40 bg-hive-bullish/10 text-hive-bullish',
  SHORT: 'border-hive-bearish/40 bg-hive-bearish/10 text-hive-bearish',
  CLOSE: 'border-hive-honey/40 bg-hive-honey/10 text-hive-honey',
  HOLD: 'border-hive-border bg-hive-black text-hive-text-secondary',
  NO_ACTION: 'border-hive-border bg-hive-black text-hive-text-dim',
};

const ACTION_LABEL: Record<ActionBadgeVariant, string> = {
  LONG: 'LONG',
  SHORT: 'SHORT',
  CLOSE: 'CLOSE',
  HOLD: 'HOLD',
  NO_ACTION: 'NO ACTION',
};

export function ActionBadge({ action, size = 'md' }: ActionBadgeProps) {
  const padding = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-[11px]';
  const cls = ACTION_CLASS[action] ?? ACTION_CLASS.HOLD;
  const label = ACTION_LABEL[action] ?? action;
  return (
    <span
      className={`inline-flex items-center border font-mono font-semibold uppercase tracking-wider ${padding} ${cls}`}
    >
      {label}
    </span>
  );
}

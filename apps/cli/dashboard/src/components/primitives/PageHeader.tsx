import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Optional "back" affordance — typically the change-agent or close-settings
   * button. Renders on the left of the wordmark. */
  leading?: ReactNode;
  /** Subpath shown after the `zHive /` prefix. E.g. `"select agent"`,
   * `"honeycomb-01 settings"`. */
  title: ReactNode;
  /** Right slot — status pill, stats, action buttons. */
  trailing?: ReactNode;
}

/** Shared TopBar used by every full-page view (Dashboard / AgentPicker /
 * SettingsView). Keeps the chrome consistent: `bg-hive-near-black` band,
 * `zHive` wordmark in honey, slash separator, then the contextual title. */
export function PageHeader({ leading, title, trailing }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-hive-border bg-hive-near-black px-5 py-2.5">
      <div className="flex items-center gap-4">
        {leading}
        <span className="font-mono font-bold tracking-tight text-hive-honey">zHive</span>
        <span className="font-mono text-hive-text-dim">/</span>
        <span className="font-mono text-hive-text-primary">{title}</span>
      </div>
      {trailing && <div className="flex items-center gap-3">{trailing}</div>}
    </header>
  );
}

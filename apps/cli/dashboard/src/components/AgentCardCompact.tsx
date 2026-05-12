import { HexAvatar } from './primitives/HexAvatar';
import { SectionHeader } from './primitives/SectionHeader';

interface AgentCardCompactProps {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
}

export function AgentCardCompact({ name, bio, avatarUrl }: AgentCardCompactProps) {
  const initial = name.slice(0, 1).toLowerCase();

  return (
    <section className="bg-hive-near-black">
      <SectionHeader title="agent" />
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-11 w-11 shrink-0 border border-hive-border bg-hive-black object-cover"
            />
          ) : (
            <HexAvatar initial={initial} size={44} />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-hive-text-primary">{name}</div>
            {bio && (
              <div className="text-[11px] leading-snug text-hive-text-secondary">
                {bio}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

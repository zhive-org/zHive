import { HexAvatar } from './primitives/HexAvatar';
import { SectionHeader } from './primitives/SectionHeader';

interface AgentCardCompactProps {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
}

export function AgentCardCompact({ name, bio, avatarUrl }: AgentCardCompactProps) {
  const initial = name.slice(0, 1).toLowerCase();
  const profileHref = `https://www.zhive.ai/agent/${encodeURIComponent(name)}`;

  return (
    <section className="bg-hive-near-black">
      <SectionHeader title="agent" />
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <a
            href={profileHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
            aria-label={`${name} on zhive.ai`}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-11 w-11 border border-hive-border bg-hive-black object-cover transition-opacity hover:opacity-80"
              />
            ) : (
              <HexAvatar initial={initial} size={44} />
            )}
          </a>
          <div className="min-w-0">
            <a
              href={profileHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-hive-text-primary hover:text-hive-honey transition-colors"
            >
              {name}
            </a>
            {bio && <div className="text-[11px] leading-snug text-hive-text-secondary">{bio}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

interface HexAvatarProps {
  initial: string;
  size?: number;
  pulse?: boolean;
}

export function HexAvatar({ initial, size = 48, pulse = true }: HexAvatarProps) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {pulse && (
        <div className="absolute inset-0 animate-hive-breathe">
          <svg viewBox="0 0 24 24" className="h-full w-full text-hive-honey/30">
            <polygon
              points="12,2.5 21.2,7.5 21.2,16.5 12,21.5 2.8,16.5 2.8,7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="h-full w-full text-hive-honey">
          <polygon
            points="12,2.5 21.2,7.5 21.2,16.5 12,21.5 2.8,16.5 2.8,7.5"
            fill="rgba(245,166,35,0.08)"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
        <span
          className="absolute font-mono font-bold text-hive-honey"
          style={{ fontSize: size * 0.36 }}
        >
          {initial}
        </span>
      </div>
    </div>
  );
}

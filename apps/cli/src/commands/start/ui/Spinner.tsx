import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { colors } from '../../shared/theme';

const SPINNER_FRAMES = ['\u25D0', '\u25D3', '\u25D1', '\u25D2'];
const SPINNER_INTERVAL_MS = 200;

export function Spinner({ label }: { label: string }): React.ReactElement {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <Text>
      <Text color={colors.honey}>{SPINNER_FRAMES[frame]}</Text>
      <Text color={colors.gray}> {label}</Text>
    </Text>
  );
}

export function TypewriterText({
  text,
  color,
  speed = 25,
}: {
  text: string;
  color: string;
  speed?: number;
}): React.ReactElement {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (visible >= text.length) return;
    const timer = setTimeout(() => {
      setVisible((prev) => Math.min(prev + 2, text.length));
    }, speed);
    return () => {
      clearTimeout(timer);
    };
  }, [visible, text, speed]);

  return <Text color={color}>{text.slice(0, visible)}</Text>;
}

export function PollText({
  text,
  color,
  animate,
}: {
  text: string;
  color: string;
  animate: boolean;
}): React.ReactElement {
  if (animate) {
    return <TypewriterText text={text} color={color} />;
  }
  return <Text color={color}>{text}</Text>;
}

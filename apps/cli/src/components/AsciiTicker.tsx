import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { colors, animation } from '../commands/shared/theme';

interface AsciiTickerProps {
  rows?: 1 | 2;
  step?: number;
}

interface Segment {
  char: string;
  color: string;
}

function buildTickerChars(step: number): string {
  const stepStr = String(step).padStart(2, '0');
  const digits = stepStr.split('');
  return animation.HEX_CHARS + digits.join('') + '▪▫░▒';
}

function buildRow(cols: number, frame: number, rowIndex: number, tickerChars: string): Segment[] {
  const segments: Segment[] = [];
  const isSecondRow = rowIndex === 1;
  const scrollSpeed = isSecondRow ? 3 : 2;
  const direction = isSecondRow ? -1 : 1;
  const sinFreq = isSecondRow ? 0.4 : 0.3;
  const sinPhase = isSecondRow ? -0.4 : 0.6;
  const wrapLen = cols * 2;

  for (let c = 0; c < cols; c++) {
    const scrolledC =
      direction === 1
        ? (c + frame * scrollSpeed) % wrapLen
        : (cols - c + frame * scrollSpeed) % wrapLen;

    const charIdx = scrolledC % tickerChars.length;
    const char = tickerChars[charIdx];
    const isHex = char === '⬡' || char === '⬢';
    const pulseHit = Math.sin((c + frame * sinPhase) * sinFreq) > 0.5;

    // Edge fade: dim the outermost 4 columns
    const edgeDist = Math.min(c, cols - 1 - c);
    if (edgeDist < 2) {
      segments.push({ char: '·', color: colors.grayDim });
      continue;
    }
    if (edgeDist < 4) {
      segments.push({ char, color: colors.grayDim });
      continue;
    }

    if (pulseHit && isHex) {
      segments.push({ char, color: colors.honey });
    } else if (pulseHit) {
      segments.push({ char, color: colors.green });
    } else {
      segments.push({ char, color: colors.grayDim });
    }
  }

  return segments;
}

function renderSegments(segments: Segment[]): React.ReactElement[] {
  const elements: React.ReactElement[] = [];
  let runColor = segments[0]?.color ?? colors.grayDim;
  let runChars = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.color === runColor) {
      runChars += seg.char;
    } else {
      elements.push(
        <Text key={`${elements.length}`} color={runColor}>
          {runChars}
        </Text>,
      );
      runColor = seg.color;
      runChars = seg.char;
    }
  }

  if (runChars.length > 0) {
    elements.push(
      <Text key={`${elements.length}`} color={runColor}>
        {runChars}
      </Text>,
    );
  }

  return elements;
}

export function AsciiTicker({ rows = 1, step = 1 }: AsciiTickerProps): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const cols = process.stdout.columns || 60;
  const tickerChars = buildTickerChars(step);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => prev + 1);
    }, animation.TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <Box flexDirection="column">
      <Text>{renderSegments(buildRow(cols, frame, 0, tickerChars))}</Text>
      {rows === 2 && <Text>{renderSegments(buildRow(cols, frame, 1, tickerChars))}</Text>}
    </Box>
  );
}

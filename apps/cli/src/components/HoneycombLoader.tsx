import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { colors, animation } from '../commands/shared/theme';

const ROWS = 3;
const HEX_W = 8;
const HEX_H = 4;
const NUM_BEES = 3;
const NUM_STREAMS = 4;
const PULSE_SPAWN_INTERVAL = 4;
const PULSE_TTL = 8;
const PULSE_COLORS = [colors.green, colors.red, colors.honey];

interface HoneycombLoaderProps {
  label: string;
}

interface Bee {
  r: number;
  c: number;
  vr: number;
  vc: number;
}

interface Pulse {
  r: number;
  c: number;
  ttl: number;
  color: string;
}

function isHexEdge(r: number, c: number): boolean {
  const rowInHex = ((r % HEX_H) + HEX_H) % HEX_H;
  const isOddHex = Math.floor(r / HEX_H) % 2 === 1;
  const colOffset = isOddHex ? HEX_W / 2 : 0;
  const colInHex = (((c - colOffset) % HEX_W) + HEX_W) % HEX_W;

  if (rowInHex === 0 || rowInHex === HEX_H - 1) {
    return colInHex >= 2 && colInHex <= 5;
  }
  if (rowInHex === 1 || rowInHex === 2) {
    return colInHex === 1 || colInHex === 6;
  }
  return false;
}

function initBees(cols: number, gridRows: number): Bee[] {
  const bees: Bee[] = [];
  for (let i = 0; i < NUM_BEES; i++) {
    bees.push({
      r: Math.floor(Math.random() * gridRows),
      c: Math.floor(Math.random() * cols),
      vr: Math.random() > 0.5 ? 1 : -1,
      vc: Math.random() > 0.5 ? 1 : -1,
    });
  }
  return bees;
}

function initStreamCols(cols: number): number[] {
  const streamCols: number[] = [];
  const spacing = Math.floor(cols / (NUM_STREAMS + 1));
  for (let i = 1; i <= NUM_STREAMS; i++) {
    streamCols.push(spacing * i);
  }
  return streamCols;
}

interface CellInfo {
  char: string;
  color: string;
}

export function HoneycombLoader({ label }: HoneycombLoaderProps): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const cols = process.stdout.columns || 60;
  const gridRows = ROWS * HEX_H;
  const beesRef = useRef<Bee[]>(initBees(cols, gridRows));
  const pulsesRef = useRef<Pulse[]>([]);
  const streamColsRef = useRef<number[]>(initStreamCols(cols));

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => prev + 1);
    }, animation.TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Advance bees every other frame
  if (frame > 0 && frame % 2 === 0) {
    const bees = beesRef.current;
    for (const bee of bees) {
      bee.r += bee.vr;
      bee.c += bee.vc;

      if (bee.r <= 0 || bee.r >= gridRows - 1) {
        bee.vr *= -1;
        bee.r = Math.max(0, Math.min(gridRows - 1, bee.r));
      }
      if (bee.c <= 0 || bee.c >= cols - 1) {
        bee.vc *= -1;
        bee.c = Math.max(0, Math.min(cols - 1, bee.c));
      }
      if (Math.random() > 0.3) {
        bee.vc = Math.random() > 0.5 ? 1 : -1;
      }
    }
  }

  // Spawn pulses
  if (frame % PULSE_SPAWN_INTERVAL === 0) {
    const newPulses: Pulse[] = [];
    for (let i = 0; i < 2; i++) {
      const pr = Math.floor(Math.random() * gridRows);
      const pc = Math.floor(Math.random() * cols);
      if (isHexEdge(pr, pc)) {
        const color = PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)];
        newPulses.push({ r: pr, c: pc, ttl: PULSE_TTL, color });
      }
    }
    pulsesRef.current = [
      ...pulsesRef.current.filter((p) => p.ttl > 1).map((p) => ({ ...p, ttl: p.ttl - 1 })),
      ...newPulses,
    ];
  }

  // Build the grid
  const grid: CellInfo[][] = [];
  const streamCols = streamColsRef.current;

  for (let r = 0; r < gridRows; r++) {
    const row: CellInfo[] = [];
    for (let c = 0; c < cols; c++) {
      const hexEdge = isHexEdge(r, c);

      // Scanning wave
      const scanRow = frame % (gridRows + 6);
      const dist = Math.abs(r - scanRow);
      if (hexEdge && dist === 0) {
        row.push({ char: '⬢', color: colors.honey });
        continue;
      }
      if (hexEdge && dist <= 1) {
        row.push({ char: '⬡', color: colors.honey });
        continue;
      }

      // Data streams
      let isStream = false;
      for (const sc of streamCols) {
        if (c === sc) {
          const streamOffset = (frame * 2 + sc) % (gridRows * 3);
          const streamDist = (((r - streamOffset) % gridRows) + gridRows) % gridRows;
          if (streamDist < 6) {
            const charIdx = (frame + r) % animation.DATA_CHARS.length;
            const streamChar = animation.DATA_CHARS[charIdx];
            if (streamDist === 0) {
              row.push({ char: streamChar, color: colors.white });
            } else if (streamDist < 3) {
              row.push({ char: streamChar, color: colors.green });
            } else {
              row.push({ char: streamChar, color: colors.grayDim });
            }
            isStream = true;
            break;
          }
        }
      }
      if (isStream) continue;

      // Default hex skeleton
      if (hexEdge) {
        row.push({ char: '·', color: colors.grayDim });
      } else {
        row.push({ char: ' ', color: colors.grayDim });
      }
    }
    grid.push(row);
  }

  // Overlay pulses
  for (const pulse of pulsesRef.current) {
    if (pulse.r >= 0 && pulse.r < gridRows && pulse.c >= 0 && pulse.c < cols) {
      const brightness = pulse.ttl / PULSE_TTL;
      const cell = grid[pulse.r][pulse.c];
      if (cell.char === '·' || cell.char === ' ') {
        grid[pulse.r][pulse.c] = {
          char: brightness > 0.5 ? '⬡' : '·',
          color: pulse.color,
        };
      }
    }
  }

  // Overlay bees
  for (const bee of beesRef.current) {
    const br = Math.max(0, Math.min(gridRows - 1, Math.round(bee.r)));
    const bc = Math.max(0, Math.min(cols - 1, Math.round(bee.c)));
    grid[br][bc] = { char: '◆', color: colors.honey };
  }

  // Render grid rows
  const rowElements = grid.map((rowCells, r) => {
    const segments: React.ReactElement[] = [];
    let runColor = rowCells[0]?.color ?? colors.grayDim;
    let runChars = '';

    for (let c = 0; c < rowCells.length; c++) {
      const cell = rowCells[c];
      if (cell.color === runColor) {
        runChars += cell.char;
      } else {
        segments.push(
          <Text key={segments.length} color={runColor}>
            {runChars}
          </Text>,
        );
        runColor = cell.color;
        runChars = cell.char;
      }
    }
    if (runChars.length > 0) {
      segments.push(
        <Text key={segments.length} color={runColor}>
          {runChars}
        </Text>,
      );
    }

    return <Text key={r}>{segments}</Text>;
  });

  return (
    <Box flexDirection="column">
      {rowElements}
      <Box justifyContent="center" marginTop={0}>
        <Text color={colors.honey}>{'⬡ '}</Text>
        <Text color={colors.gray}>{label}</Text>
      </Box>
    </Box>
  );
}

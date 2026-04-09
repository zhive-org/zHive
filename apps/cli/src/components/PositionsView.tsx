import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../commands/shared/theme';
import type { DetailedPosition } from '../shared/trading/types';

interface PositionsViewProps {
  positions: DetailedPosition[];
  onClose: () => void;
  pageSize?: number;
}

const COLS: Array<{ key: string; label: string; width: number; align?: 'right' }> = [
  { key: 'coin', label: 'Coin', width: 8 },
  { key: 'side', label: 'Side', width: 6 },
  { key: 'size', label: 'Size', width: 12, align: 'right' },
  { key: 'entry', label: 'Entry', width: 12, align: 'right' },
  { key: 'mark', label: 'Mark', width: 12, align: 'right' },
  { key: 'value', label: 'Value', width: 12, align: 'right' },
  { key: 'pnl', label: 'PnL (ROE%)', width: 20, align: 'right' },
  { key: 'liq', label: 'Liq', width: 12, align: 'right' },
  { key: 'margin', label: 'Margin', width: 10, align: 'right' },
  { key: 'funding', label: 'Funding', width: 10, align: 'right' },
];

function fmtNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 1) return n.toFixed(digits);
  return n.toFixed(4);
}

function fmtPrice(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return fmtNum(n, 2);
}

function pad(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  if (text.length >= width) return text.slice(0, width);
  const padding = ' '.repeat(width - text.length);
  return align === 'right' ? padding + text : text + padding;
}

export function PositionsView({
  positions,
  onClose,
  pageSize = 10,
}: PositionsViewProps): React.ReactElement {
  const [offset, setOffset] = useState(0);
  const total = positions.length;
  const maxOffset = Math.max(0, total - pageSize);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (key.upArrow || input === 'k') {
      setOffset((o) => Math.max(0, o - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setOffset((o) => Math.min(maxOffset, o + 1));
      return;
    }
    if (key.pageUp) {
      setOffset((o) => Math.max(0, o - pageSize));
      return;
    }
    if (key.pageDown) {
      setOffset((o) => Math.min(maxOffset, o + pageSize));
      return;
    }
  });

  const visible = positions.slice(offset, offset + pageSize);
  const headerLine = COLS.map((c) => pad(c.label, c.width, c.align ?? 'left')).join(' ');

  return (
    <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
      <Box>
        <Text color={colors.honey} bold>
          Positions ({total})
        </Text>
      </Box>

      {total === 0 ? (
        <Box paddingTop={1}>
          <Text color={colors.gray}>No open positions.</Text>
        </Box>
      ) : (
        <>
          <Box>
            <Text color={colors.gray} bold>
              {headerLine}
            </Text>
          </Box>
          {visible.map((p, i) => {
            const sideColor = p.side === 'long' ? colors.green : colors.red;
            const pnlColor = p.unrealizedPnl >= 0 ? colors.green : colors.red;
            const pnlText = `${p.unrealizedPnl >= 0 ? '+' : ''}${fmtNum(p.unrealizedPnl)} (${p.roePercent >= 0 ? '+' : ''}${fmtNum(p.roePercent)}%)`;
            const fundingText = `${p.funding >= 0 ? '+' : ''}${fmtNum(p.funding)}`;
            return (
              <Box key={`${p.coin}-${offset + i}`}>
                <Text>{pad(p.coin, COLS[0].width, 'left')} </Text>
                <Text color={sideColor}>
                  {pad(p.side.toUpperCase(), COLS[1].width, 'left')}
                </Text>
                <Text> {pad(fmtNum(p.size, 4), COLS[2].width, 'right')} </Text>
                <Text>{pad(fmtPrice(p.entryPrice), COLS[3].width, 'right')} </Text>
                <Text>{pad(fmtPrice(p.markPrice), COLS[4].width, 'right')} </Text>
                <Text>{pad(fmtNum(p.positionValueUsd), COLS[5].width, 'right')} </Text>
                <Text color={pnlColor}>{pad(pnlText, COLS[6].width, 'right')}</Text>
                <Text> {pad(fmtPrice(p.liquidationPx), COLS[7].width, 'right')} </Text>
                <Text>{pad(fmtNum(p.marginUsed), COLS[8].width, 'right')} </Text>
                <Text color={p.funding >= 0 ? colors.green : colors.red}>
                  {pad(fundingText, COLS[9].width, 'right')}
                </Text>
              </Box>
            );
          })}
          <Box paddingTop={1}>
            <Text color={colors.gray}>
              {`${offset + 1}-${Math.min(offset + pageSize, total)} / ${total}`}
              {'  '}
              <Text color={colors.grayDim}>
                {'↑↓/jk scroll · PgUp/PgDn page · esc/q close'}
              </Text>
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}

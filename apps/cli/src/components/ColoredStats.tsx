import React from 'react';
import { Text } from 'ink';
import { type AgentStats } from '../shared/config/agent';
import { colors } from '../commands/shared/theme';

function formatPnl(value: number): string {
  const abs = Math.abs(Math.round(value));
  if (value > 0) return `+$${abs}`;
  if (value < 0) return `-$${abs}`;
  return '$0';
}

export function ColoredStats({ stats }: { stats: AgentStats }): React.ReactElement {
  const winRatePercent = Math.round(stats.win_rate * 100);
  const confidencePercent = Math.round(stats.confidence * 100);
  const pnl = formatPnl(stats.simulated_pnl);
  const pnlColor =
    stats.simulated_pnl > 0 ? colors.green : stats.simulated_pnl < 0 ? colors.red : colors.grayDim;

  return (
    <>
      <Text color={colors.honey}>Honey:{Math.floor(stats.honey)}</Text>
      <Text color={colors.grayDim}> </Text>
      <Text color={colors.wax}>Wax:{Math.floor(stats.wax)}</Text>
      <Text color={colors.grayDim}> </Text>
      <Text color={winRatePercent >= 50 ? colors.green : colors.red}>WR:{winRatePercent}%</Text>
      <Text color={colors.grayDim}> </Text>
      <Text color={colors.honey}>C:{confidencePercent}%</Text>
      <Text color={colors.grayDim}> </Text>
      <Text color={pnlColor}>Sim PnL:{pnl}</Text>
    </>
  );
}

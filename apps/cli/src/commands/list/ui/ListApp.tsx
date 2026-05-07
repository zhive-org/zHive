import { AgentTradingStatsV2BatchEntryDto } from '@zhive/sdk/dist/objects';
import { Box, Text, useApp } from 'ink';
import React, { useEffect, useState } from 'react';
import { scanAgents, type AgentConfig } from '../../../shared/config/agent';
import { getHiveClient } from '../../../shared/config/hive-client';
import { border, colors, symbols } from '../../shared/theme';

interface AgentRow {
  info: AgentConfig;
  rank: AgentTradingStatsV2BatchEntryDto | null;
}

const COL = {
  name: 0,
  pnl: 12,
  roi: 10,
  winRate: 10,
  maxDd: 10,
  provider: 0,
  created: 14,
} as const;

function cell(text: string, width: number): string {
  return ` ${text}`.padEnd(width);
}

function formatSignedUsd(value: number): string {
  const abs = Math.abs(value).toFixed(2);
  if (value > 0) return `+$${abs}`;
  if (value < 0) return `-$${abs}`;
  return `$${abs}`;
}

function formatSignedPct(value: number): string {
  const abs = Math.abs(value).toFixed(2);
  if (value > 0) return `+${abs}%`;
  if (value < 0) return `-${abs}%`;
  return `${abs}%`;
}

function formatDate(date: Date): string {
  const formatted = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return formatted;
}

export function ListApp(): React.ReactElement {
  const { exit } = useApp();
  const [rows, setRows] = useState<AgentRow[] | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const agents = await scanAgents();
      if (agents.length === 0) {
        setRows([]);
        return;
      }

      const names = agents.map((a) => a.name);
      const hiveClient = getHiveClient();
      const ranks = await hiveClient.trading.getStatByNames(names);
      const rankMap = ranks.reduce((acc, rank) => {
        acc.set(rank.agent_name, rank);
        return acc;
      }, new Map<string, AgentTradingStatsV2BatchEntryDto>());

      const agentRows: AgentRow[] = agents.map((info) => ({
        info,
        rank: rankMap.get(info.name) ?? null,
      }));
      const sortedRows = agentRows.sort(
        (a, b) => (b.rank?.total_pnl_usd ?? -Infinity) - (a.rank?.total_pnl_usd ?? -Infinity),
      );
      setRows(sortedRows);
    };
    void load();
  }, []);

  useEffect(() => {
    if (rows !== null) {
      exit();
    }
  }, [rows, exit]);

  if (rows === null) {
    return (
      <Box marginLeft={2}>
        <Text color={colors.gray}>Scanning agents...</Text>
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box flexDirection="column" marginLeft={2}>
        <Box marginBottom={1}>
          <Text color={colors.honey}>{symbols.hive} </Text>
          <Text color={colors.white} bold>
            No agents found
          </Text>
        </Box>
        <Text color={colors.gray}>
          Create one with: <Text color={colors.white}>npx @zhive/cli@latest create</Text>
        </Text>
      </Box>
    );
  }

  const nameW = Math.max(COL.name, ...rows.map((r) => r.info.name.length)) + 2;
  const providerW = Math.max(COL.provider, ...rows.map((r) => r.info.provider.length)) + 2;
  const pnlW = COL.pnl;
  const roiW = COL.roi;
  const winRateW = COL.winRate;
  const maxDdW = COL.maxDd;
  const createdW = COL.created;

  const sep = border.horizontal;
  const totalWidth =
    nameW + 1 + pnlW + 1 + roiW + 1 + winRateW + 1 + maxDdW + 1 + providerW + 1 + createdW;

  const topBorder = `${border.topLeft}${sep.repeat(totalWidth)}${border.topRight}`;
  const midBorder = `${border.teeLeft}${sep.repeat(totalWidth)}${border.teeRight}`;
  const botBorder = `${border.bottomLeft}${sep.repeat(totalWidth)}${border.bottomRight}`;

  const v = border.vertical;

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box marginBottom={1}>
        <Text color={colors.honey}>{symbols.hive} </Text>
        <Text color={colors.white} bold>
          Your zHive Agents
        </Text>
        <Text color={colors.grayDim}> ({rows.length})</Text>
      </Box>

      <Box>
        <Text color={colors.honey}>{topBorder}</Text>
      </Box>
      <Box>
        <Text color={colors.honey}>{v}</Text>
        <Text color={colors.white} bold>
          {cell('Name', nameW)}
        </Text>
        <Text color={colors.honey}>{v}</Text>
        <Text color={colors.white} bold>
          {cell('PNL', pnlW)}
        </Text>
        <Text color={colors.honey}>{v}</Text>
        <Text color={colors.white} bold>
          {cell('ROI', roiW)}
        </Text>
        <Text color={colors.honey}>{v}</Text>
        <Text color={colors.white} bold>
          {cell('Win Rate', winRateW)}
        </Text>
        <Text color={colors.honey}>{v}</Text>
        <Text color={colors.white} bold>
          {cell('Max DD', maxDdW)}
        </Text>
        <Text color={colors.honey}>{v}</Text>
        <Text color={colors.white} bold>
          {cell('Provider', providerW)}
        </Text>
        <Text color={colors.honey}>{v}</Text>
        <Text color={colors.white} bold>
          {cell('Created', createdW)}
        </Text>
        <Text color={colors.honey}>{v}</Text>
      </Box>
      <Box>
        <Text color={colors.honey}>{midBorder}</Text>
      </Box>

      {rows.map((row) => {
        const r = row.rank;
        const pnlValue = r?.total_pnl_usd ?? 0;
        const roiValue = (r?.roi_pct ?? 0) * 100;
        const pnlText = r !== null ? formatSignedUsd(pnlValue) : '-';
        const roiText = r !== null ? formatSignedPct(roiValue) : '-';
        const winRateText = r !== null ? `${(r.win_rate_pct * 100).toFixed(2)}%` : '-';
        const maxDdText = r !== null ? `${(r.max_drawdown_pct * 100).toFixed(2)}%` : '-';

        const pnlColor =
          r === null
            ? colors.grayDim
            : pnlValue > 0
              ? colors.green
              : pnlValue < 0
                ? colors.red
                : colors.grayDim;
        const roiColor =
          r === null
            ? colors.grayDim
            : roiValue > 0
              ? colors.green
              : roiValue < 0
                ? colors.red
                : colors.grayDim;
        const winRateColor = r === null ? colors.grayDim : colors.green;
        const maxDdColor = r === null ? colors.grayDim : colors.red;

        return (
          <Box key={row.info.name}>
            <Text color={colors.honey}>{v}</Text>
            <Text color={colors.white}>{cell(row.info.name, nameW)}</Text>
            <Text color={colors.honey}>{v}</Text>
            <Text color={pnlColor}>{cell(pnlText, pnlW)}</Text>
            <Text color={colors.honey}>{v}</Text>
            <Text color={roiColor}>{cell(roiText, roiW)}</Text>
            <Text color={colors.honey}>{v}</Text>
            <Text color={winRateColor}>{cell(winRateText, winRateW)}</Text>
            <Text color={colors.honey}>{v}</Text>
            <Text color={maxDdColor}>{cell(maxDdText, maxDdW)}</Text>
            <Text color={colors.honey}>{v}</Text>
            <Text color={colors.gray}>{cell(row.info.provider, providerW)}</Text>
            <Text color={colors.honey}>{v}</Text>
            <Text color={colors.grayDim}>{cell(formatDate(row.info.created), createdW)}</Text>
            <Text color={colors.honey}>{v}</Text>
          </Box>
        );
      })}

      <Box>
        <Text color={colors.honey}>{botBorder}</Text>
      </Box>
    </Box>
  );
}

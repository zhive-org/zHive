import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { colors, symbols, border } from '../../shared/theme.js';
import {
  scanAgents,
  fetchBulkStats,
  sortByHoney,
  type AgentConfig,
  type AgentStats,
} from '../../../shared/config/agent.js';

interface AgentRow {
  info: AgentConfig;
  stats: AgentStats | null;
}

const COL = {
  name: 0,
  honey: 8,
  wax: 8,
  winRate: 10,
  confidence: 8,
  provider: 0,
  created: 14,
} as const;

function cell(text: string, width: number): string {
  return ` ${text}`.padEnd(width);
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
      const statsMap = await fetchBulkStats(names);

      const agentRows: AgentRow[] = agents.map((info) => ({
        info,
        stats: statsMap.get(info.name) ?? null,
      }));
      const sortedRows = sortByHoney(agentRows);
      setRows(sortedRows);
    };
    void load();
  }, []);

  useEffect(() => {
    if (rows !== null) {
      exit();
    }
  }, [rows]);

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
  const honeyW = COL.honey;
  const waxW = COL.wax;
  const winRateW = COL.winRate;
  const confidenceW = COL.confidence;

  const createdW = COL.created;

  const sep = border.horizontal;
  const totalWidth =
    nameW + 1 + honeyW + 1 + waxW + 1 + winRateW + 1 + confidenceW + 1 + providerW + 1 + createdW;

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
          {cell('Honey', honeyW)}
        </Text>
        <Text color={colors.honey}>{v}</Text>
        <Text color={colors.white} bold>
          {cell('Wax', waxW)}
        </Text>
        <Text color={colors.honey}>{v}</Text>
        <Text color={colors.white} bold>
          {cell('Win Rate', winRateW)}
        </Text>
        <Text color={colors.honey}>{v}</Text>
        <Text color={colors.white} bold>
          {cell('Conf', confidenceW)}
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
        const s = row.stats;
        const honeyText = s !== null ? String(Math.floor(s.honey)) : '-';
        const waxText = s !== null ? String(Math.floor(s.wax)) : '-';
        const winRateText = s !== null ? `${(s.win_rate * 100).toFixed(2)}%` : '-';
        const confidenceText = s !== null ? s.confidence.toFixed(2) : '-';

        return (
          <Box key={row.info.name}>
            <Text color={colors.honey}>{v}</Text>
            <Text color={colors.white}>{cell(row.info.name, nameW)}</Text>
            <Text color={colors.honey}>{v}</Text>
            <Text color={colors.honey}>{cell(honeyText, honeyW)}</Text>
            <Text color={colors.honey}>{v}</Text>
            <Text color={colors.wax}>{cell(waxText, waxW)}</Text>
            <Text color={colors.honey}>{v}</Text>
            <Text color={colors.green}>{cell(winRateText, winRateW)}</Text>
            <Text color={colors.honey}>{v}</Text>
            <Text color={colors.cyan}>{cell(confidenceText, confidenceW)}</Text>
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

import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { colors, symbols } from '../../shared/theme.js';
import {
  scanAgents,
  fetchBulkStats,
  sortByHoney,
  type AgentConfig,
  type AgentStats,
} from '../../../shared/config/agent.js';
import { ColoredStats } from '../../../components/ColoredStats.js';

interface AgentRow {
  info: AgentConfig;
  stats: AgentStats | null;
}

export interface SelectAgentAppProps {
  onSelect: (agent: AgentConfig) => void;
}

function formatDate(date: Date): string {
  const formatted = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return formatted;
}

function StatsText({ stats }: { stats: AgentStats | null }): React.ReactElement {
  if (stats === null) {
    return <Text color={colors.grayDim}>-</Text>;
  }

  return <ColoredStats stats={stats} />;
}

export function SelectAgentApp({ onSelect }: SelectAgentAppProps): React.ReactElement {
  const { exit } = useApp();
  const [rows, setRows] = useState<AgentRow[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const agents = await scanAgents();
      if (agents.length === 0) {
        setRows([]);
        exit();
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

  useInput((_input, key) => {
    if (rows === null || rows.length === 0) {
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => {
        const max = rows.length - 1;
        return prev > 0 ? prev - 1 : max;
      });
    } else if (key.downArrow) {
      setSelectedIndex((prev) => {
        const max = rows.length - 1;
        return prev < max ? prev + 1 : 0;
      });
    } else if (key.return) {
      const row = rows[selectedIndex];
      if (row) {
        onSelect(row.info);
        exit();
      }
    } else if (key.ctrl && _input === 'c') {
      exit();
    }
  });

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

  const nameWidth = Math.max(6, ...rows.map((r) => r.info.name.length)) + 2;

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box marginBottom={1}>
        <Text color={colors.honey}>{symbols.hive} </Text>
        <Text color={colors.white} bold>
          Select an agent to start
        </Text>
        <Text color={colors.grayDim}> ({rows.length})</Text>
      </Box>

      {rows.map((row, index) => {
        const isSelected = index === selectedIndex;

        return (
          <Box key={row.info.name}>
            <Text color={isSelected ? colors.honey : colors.grayDim}>
              {isSelected ? `${symbols.diamond} ` : '  '}
            </Text>
            <Text color={isSelected ? colors.white : colors.gray} bold={isSelected}>
              {row.info.name.padEnd(nameWidth)}
            </Text>
            <StatsText stats={row.stats} />
            <Text color={colors.grayDim}> {formatDate(row.info.created)}</Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color={colors.grayDim}>
          {symbols.arrow} {'\u2191\u2193'} navigate {'  '} enter select {'  '} ctrl+c quit
        </Text>
      </Box>
    </Box>
  );
}

import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { colors, symbols, border } from '../../shared/theme';
import { HIVE_FRONTEND_URL } from '../../../shared/config/constant';
import {
  type AgentProcessManager,
  type AgentState,
  type AgentStatus,
} from '../AgentProcessManager';
import { type AgentStats } from '../../../shared/config/agent';
import { ColoredStats } from '../../../components/ColoredStats';

const STATUS_COLORS: Record<AgentStatus, string> = {
  spawning: colors.honey,
  running: colors.green,
  exited: colors.grayDim,
  errored: colors.red,
};

const STATUS_SYMBOLS: Record<AgentStatus, string> = {
  spawning: symbols.diamondOpen,
  running: symbols.dot,
  exited: '\u25CB', // ○
  errored: symbols.cross,
};

const POLL_INTERVAL_MS = 1_000;

const STOPPABLE: Set<AgentStatus> = new Set(['running', 'spawning']);
const STARTABLE: Set<AgentStatus> = new Set(['exited', 'errored']);

export interface DashboardProps {
  manager: AgentProcessManager;
  statsMap: Map<string, AgentStats>;
}

export function Dashboard({ manager, statsMap }: DashboardProps): React.ReactElement {
  const { exit } = useApp();
  const [agents, setAgents] = useState<AgentState[]>(manager.getStates());
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setAgents(manager.getStates());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [manager]);

  // Clamp selectedIndex when agents list changes
  useEffect(() => {
    const maxIndex = Math.max(agents.length - 1, 0);
    setSelectedIndex((prev) => Math.min(prev, maxIndex));
  }, [agents.length]);

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => {
        const max = agents.length - 1;
        return prev > 0 ? prev - 1 : max;
      });
    } else if (key.downArrow) {
      setSelectedIndex((prev) => {
        const max = agents.length - 1;
        return prev < max ? prev + 1 : 0;
      });
    } else if (_input === ' ' || key.return) {
      const agent = agents[selectedIndex];
      if (!agent) {
        return;
      }
      if (STOPPABLE.has(agent.status)) {
        void manager.stopAgent(agent.name);
      } else if (STARTABLE.has(agent.status)) {
        manager.respawnPiped(agent.name);
      }
    } else if (key.ctrl && _input === 'c') {
      exit();
    }
  });

  const runningCount = agents.filter((a) => a.status === 'running').length;
  const spawningCount = agents.filter((a) => a.status === 'spawning').length;
  const stoppedCount = agents.filter((a) => a.status === 'exited' || a.status === 'errored').length;
  const statusParts: string[] = [];
  if (runningCount > 0) {
    statusParts.push(`${runningCount} running`);
  }
  if (spawningCount > 0) {
    statusParts.push(`${spawningCount} starting`);
  }
  if (stoppedCount > 0) {
    statusParts.push(`${stoppedCount} stopped`);
  }
  const statusLabel = statusParts.length > 0 ? statusParts.join(', ') : 'no agents running';

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box marginBottom={1}>
        <Text color={colors.honey}>{symbols.hive} </Text>
        <Text color={colors.white} bold>
          zHive Swarm
        </Text>
        <Text color={colors.gray}>
          {' '}
          {border.horizontal} {agents.length} agent{agents.length !== 1 ? 's' : ''}{' '}
          {border.horizontal} {statusLabel}
        </Text>
      </Box>

      {agents.map((agent, index) => {
        const isSelected = index === selectedIndex;
        const statusColor = STATUS_COLORS[agent.status];
        const statusSymbol = STATUS_SYMBOLS[agent.status];
        const isAlive = agent.status === 'running' || agent.status === 'spawning';
        const statusText =
          agent.status === 'exited' || agent.status === 'errored'
            ? `${agent.status} (${agent.exitCode})`
            : agent.status;

        const agentStats = statsMap.get(agent.name);

        return (
          <Box key={agent.name}>
            <Text color={isSelected ? colors.honey : undefined}>
              {isSelected ? `${symbols.diamond} ` : '  '}
            </Text>
            <Text color={statusColor}>{statusSymbol} </Text>
            <Text color={isAlive ? colors.white : colors.grayDim}>{agent.name.padEnd(20)}</Text>
            <Text color={statusColor}>{statusText.padEnd(16)}</Text>
            {agentStats && <ColoredStats stats={agentStats} />}
          </Box>
        );
      })}

      {agents[selectedIndex] && (
        <Box marginTop={1}>
          <Text color={colors.gray}>View your agent's activity at </Text>
          <Text color={colors.cyan}>
            {HIVE_FRONTEND_URL}/agent/{agents[selectedIndex].name}
          </Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={colors.grayDim}>
          {symbols.arrow} {'\u2191\u2193'} navigate {'  '} space/enter stop/start {'  '} ctrl+c quit
        </Text>
      </Box>
    </Box>
  );
}

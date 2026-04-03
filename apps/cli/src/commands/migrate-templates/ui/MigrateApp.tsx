import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { scanAgents, type AgentConfig } from '../../../shared/config/agent';
import { colors, symbols, styled, border } from '../../shared/theme';
import { isOldStyleAgent, migrateAgent, type MigrateResult } from '../migrate';
import { extractErrorMessage } from '../../../shared/megathread/utils';

type Phase = 'scanning' | 'selecting' | 'migrating' | 'done';

interface SelectableAgent {
  info: AgentConfig;
  selected: boolean;
  isOldStyle: boolean;
}

export function MigrateApp(): React.ReactElement {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [agents, setAgents] = useState<SelectableAgent[]>([]);
  const [cursor, setCursor] = useState(0);
  const [results, setResults] = useState<MigrateResult[]>([]);
  const [currentStep, setCurrentStep] = useState('');
  const [currentAgent, setCurrentAgent] = useState('');

  // ─── Scan phase ────────────────────────────────────

  useEffect(() => {
    const scan = async (): Promise<void> => {
      const discovered = await scanAgents();

      if (discovered.length === 0) {
        setPhase('done');
        return;
      }

      const selectableAgents: SelectableAgent[] = discovered.map((info) => {
        const oldStyle = isOldStyleAgent(info.dir);
        return {
          info,
          selected: oldStyle,
          isOldStyle: oldStyle,
        };
      });

      const hasOldStyle = selectableAgents.some((a) => a.isOldStyle);
      if (!hasOldStyle) {
        setResults(
          selectableAgents.map((a) => ({
            name: a.info.name,
            success: true,
            error: 'Already migrated',
          })),
        );
        setPhase('done');
        return;
      }

      setAgents(selectableAgents);
      setPhase('selecting');
    };

    scan().catch((err) => {
      const message = extractErrorMessage(err);
      setResults([{ name: 'scan', success: false, error: message }]);
      setPhase('done');
    });
  }, []);

  // ─── Keyboard input (selecting phase) ──────────────

  useInput(
    (input, key) => {
      if (phase !== 'selecting') return;

      const oldStyleAgents = agents.filter((a) => a.isOldStyle);

      if (key.upArrow) {
        setCursor((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setCursor((prev) => Math.min(oldStyleAgents.length - 1, prev + 1));
      } else if (input === ' ') {
        // Toggle selection
        const targetName = oldStyleAgents[cursor]?.info.name;
        if (targetName) {
          setAgents((prev) =>
            prev.map((a) => (a.info.name === targetName ? { ...a, selected: !a.selected } : a)),
          );
        }
      } else if (key.return) {
        const selected = agents.filter((a) => a.selected && a.isOldStyle);
        if (selected.length > 0) {
          setPhase('migrating');
          runMigrations(selected);
        }
      } else if (input === 'q' || key.escape) {
        exit();
      }
    },
    { isActive: phase === 'selecting' },
  );

  // ─── Migrate phase ─────────────────────────────────

  const runMigrations = useCallback(async (selected: SelectableAgent[]) => {
    const migrateResults: MigrateResult[] = [];

    for (const agent of selected) {
      setCurrentAgent(agent.info.name);
      setCurrentStep('Starting migration');

      const result = await migrateAgent(agent.info.dir, agent.info.name, (step) => {
        setCurrentStep(step);
      });

      migrateResults.push(result);
      setResults([...migrateResults]);
    }

    setCurrentAgent('');
    setCurrentStep('');
    setPhase('done');
  }, []);

  // ─── Done phase — exit after a short delay ─────────

  useEffect(() => {
    if (phase === 'done') {
      const timer = setTimeout(() => {
        exit();
      }, 1500);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [phase, exit]);

  // ─── Render ────────────────────────────────────────

  const termWidth = process.stdout.columns || 60;

  if (phase === 'scanning') {
    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={colors.honey}>{symbols.hive} Scanning agents...</Text>
      </Box>
    );
  }

  if (phase === 'selecting') {
    const oldStyleAgents = agents.filter((a) => a.isOldStyle);
    const newStyleAgents = agents.filter((a) => !a.isOldStyle);

    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={colors.honey} bold>
          {symbols.hive} Migrate agents to @zhive/cli
        </Text>
        <Text color={colors.gray}>{border.horizontal.repeat(termWidth - 4)}</Text>
        <Text color={colors.gray}>
          Use {styled.white('↑↓')} to navigate, {styled.white('spacebar')} press to toggle,{' '}
          {styled.white('enter')} to confirm
        </Text>
        <Text> </Text>

        {oldStyleAgents.map((agent, i) => {
          const isCursor = i === cursor;
          const prefix = agent.selected ? symbols.check : symbols.diamondOpen;
          const prefixColor = agent.selected ? colors.green : colors.gray;
          const nameColor = isCursor ? colors.white : colors.gray;
          const cursorChar = isCursor ? symbols.arrow : ' ';

          return (
            <Box key={agent.info.name}>
              <Text color={colors.honey}>{cursorChar} </Text>
              <Text color={prefixColor}>{prefix} </Text>
              <Text color={nameColor} bold={isCursor}>
                {agent.info.name}
              </Text>
              <Text color={colors.gray}> ({agent.info.provider})</Text>
            </Box>
          );
        })}

        {newStyleAgents.length > 0 && (
          <>
            <Text> </Text>
            <Text color={colors.gray}>Already migrated:</Text>
            {newStyleAgents.map((agent) => (
              <Box key={agent.info.name}>
                <Text color={colors.gray}>
                  {'  '}
                  {symbols.check} {agent.info.name}
                </Text>
              </Box>
            ))}
          </>
        )}

        <Text> </Text>
        <Text color={colors.gray}>{styled.dim('q/esc to cancel')}</Text>
      </Box>
    );
  }

  if (phase === 'migrating') {
    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={colors.honey} bold>
          {symbols.hive} Migrating agents...
        </Text>
        <Text color={colors.gray}>{border.horizontal.repeat(termWidth - 4)}</Text>

        {results.map((r) => (
          <Box key={r.name}>
            <Text color={r.success ? colors.green : colors.red}>
              {r.success ? symbols.check : symbols.cross} {r.name}
            </Text>
          </Box>
        ))}

        {currentAgent && (
          <Box>
            <Text color={colors.honey}>
              {symbols.diamond} {currentAgent}: {currentStep}
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // phase === 'done'
  const successCount = results.filter((r) => r.success && !r.error).length;
  const alreadyNew = results.filter((r) => r.error === 'Already migrated').length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text color={colors.honey} bold>
        {symbols.hive} Migration complete
      </Text>
      <Text color={colors.gray}>{border.horizontal.repeat(termWidth - 4)}</Text>

      {results.map((r) => (
        <Box key={r.name}>
          {r.success && !r.error && (
            <Text color={colors.green}>
              {symbols.check} {r.name} — migrated
            </Text>
          )}
          {r.error === 'Already migrated' && (
            <Text color={colors.gray}>
              {symbols.check} {r.name} — already migrated
            </Text>
          )}
          {!r.success && r.error !== 'Already migrated' && (
            <Text color={colors.red}>
              {symbols.cross} {r.name} — {r.error}
            </Text>
          )}
        </Box>
      ))}

      {agents.length === 0 && results.length === 0 && (
        <Text color={colors.gray}>No agents found in ~/.zhive/agents/</Text>
      )}

      <Text> </Text>
      {successCount > 0 && (
        <Text color={colors.gray}>
          Agents now run via @zhive/cli. {styled.white('npx @zhive/cli@latest start')} always uses
          the latest version.
        </Text>
      )}
    </Box>
  );
}

import { Box } from 'ink';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SelectPrompt } from '../../../../components/SelectPrompt';
import { TextPrompt } from '../../../../components/TextPrompt';
import { AgenticChat } from '../../../../components/AgenticChat';
import { generateStrategy, generateStrategyFromTranscript } from '../../generate-strategy';
import { STRATEGY_PRESETS } from '../../presets/data';
import { buildStrategyMarkdown } from '../../presets/formatting';
import {
  nextAgentTurn,
  remainingTopics,
  STRATEGY_TOPICS,
  type AgentTurn,
  type ChatTurn,
  type QuestionTurn,
  type StrategyTopic,
} from '../../strategy-chat-agent';
import { GenerationState, useWizard } from '../wizard-context';
import { StreamingGenerationStep } from './StreamingGenerationStep';

export interface StrategyStepResult {
  strategyContent: string;
}

type SubStep = 'preset' | 'seed' | 'chat' | 'generate';
type ChatPath = 'preset' | 'chat';

const selectItems = [
  ...STRATEGY_PRESETS.map((p) => ({
    label: p.name,
    value: p.name,
    description: p.philosophy,
  })),
  {
    label: 'Custom (chat with agent)',
    value: '__custom__',
    description: 'Let an agent interview you to design the strategy.',
  },
];

type Pending = QuestionTurn | 'thinking' | { kind: 'error'; message: string };

export function StrategyStep(): React.ReactElement {
  const { state, dispatch } = useWizard();
  const { apiConfig, identity, strategy, strategyChat } = state;
  const [subStep, setSubStep] = useState<SubStep>('preset');
  const [chatPath, setChatPath] = useState<ChatPath>('preset');
  const [pending, setPending] = useState<Pending>('thinking');
  const inFlight = useRef(false);

  const defaultPreset = selectItems.find((item) => item.value === strategy.input);

  const callAgent = useCallback(
    async (transcript: ChatTurn[], covered: StrategyTopic[], force: StrategyTopic[] = []) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending('thinking');
      try {
        let turn: AgentTurn = await nextAgentTurn({
          providerId: apiConfig.providerId!,
          apiKey: apiConfig.apiKey,
          transcript,
          seed: strategyChat.seed,
          coveredTopics: covered,
          forceRemaining: force,
        });

        if (turn.kind === 'done') {
          const newCovered = new Set<StrategyTopic>(covered);
          for (const t of turn.topicsAddressed) newCovered.add(t);
          const remaining = STRATEGY_TOPICS.filter((t) => !newCovered.has(t));
          if (remaining.length > 0) {
            turn = await nextAgentTurn({
              providerId: apiConfig.providerId!,
              apiKey: apiConfig.apiKey,
              transcript,
              seed: strategyChat.seed,
              coveredTopics: Array.from(newCovered),
              forceRemaining: remaining,
            });
          }
        }

        if (turn.kind === 'done') {
          setSubStep('generate');
          setPending('thinking');
        } else {
          setPending(turn);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPending({ kind: 'error', message });
      } finally {
        inFlight.current = false;
      }
    },
    [apiConfig.providerId, apiConfig.apiKey, strategyChat.seed],
  );

  // When entering chat sub-step, kick off the first agent turn
  useEffect(() => {
    if (subStep !== 'chat') return;
    if (pending !== 'thinking') return;
    if (inFlight.current) return;
    void callAgent(strategyChat.transcript, strategyChat.coveredTopics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subStep, callAgent, strategyChat.transcript, pending, strategyChat.coveredTopics]);

  const handlePreset = useCallback(
    (item: { value: string }) => {
      if (item.value === '__custom__') {
        setSubStep('seed');
        return;
      }
      const preset = STRATEGY_PRESETS.find((p) => p.name === item.value);
      if (!preset) return;

      const content = buildStrategyMarkdown(identity.name, preset);
      setChatPath('preset');
      dispatch({
        type: 'UPDATE_STRATEGY',
        payload: { content, draft: content, input: preset.name },
      });
      setSubStep('generate');
    },
    [dispatch, identity.name],
  );

  const handleSeedSubmit = useCallback(
    (value: string) => {
      const seed = value.trim();
      if (!seed) return;
      const payload: Partial<GenerationState> = { input: seed };
      if (seed !== strategy.input) {
        payload.draft = '';
        payload.content = '';
      }
      dispatch({ type: 'UPDATE_STRATEGY', payload });
      dispatch({ type: 'SET_CHAT_SEED', seed });
      setChatPath('chat');
      setSubStep('chat');
      setPending('thinking');
    },
    [dispatch, strategy.input],
  );

  const handleAnswer = useCallback(
    (answer: string) => {
      if (typeof pending !== 'object' || pending.kind !== 'question') return;
      const turn: ChatTurn = {
        question: pending.prompt,
        answer,
        topic: pending.topic,
      };
      const nextTranscript = [...strategyChat.transcript, turn];
      const merged = new Set<StrategyTopic>(strategyChat.coveredTopics);
      for (const t of pending.topicsAddressed) merged.add(t);
      const covered = Array.from(merged) as StrategyTopic[];

      dispatch({ type: 'APPEND_CHAT_TURN', turn, topicsAddressed: pending.topicsAddressed });

      // If all topics covered, jump straight to generate
      if (remainingTopics(covered).length === 0) {
        setSubStep('generate');
        return;
      }

      void callAgent(nextTranscript, covered);
    },
    [pending, strategyChat.transcript, strategyChat.coveredTopics, dispatch, callAgent],
  );

  const handleUndo = useCallback(() => {
    if (strategyChat.transcript.length === 0) return;
    dispatch({ type: 'POP_CHAT_TURN' });
    const trimmed = strategyChat.transcript.slice(0, -1);
    const covered = new Set<StrategyTopic>();
    for (const t of trimmed) {
      if (t.topic) covered.add(t.topic);
    }
    void callAgent(trimmed, Array.from(covered));
  }, [strategyChat.transcript, dispatch, callAgent]);

  const handleChatBack = useCallback(() => {
    if (strategyChat.transcript.length === 0) {
      setSubStep('seed');
      return;
    }
    // mid-chat esc: also exit to seed (user can restart)
    setSubStep('seed');
  }, [strategyChat.transcript.length]);

  const handleChatRetry = useCallback(() => {
    void callAgent(strategyChat.transcript, strategyChat.coveredTopics);
  }, [callAgent, strategyChat.transcript, strategyChat.coveredTopics]);

  const handleComplete = useCallback(
    (strategyContent: string) => {
      dispatch({
        type: 'SET_STRATEGY',
        payload: {
          content: strategyContent,
          draft: '',
          input: '',
        },
      });
      dispatch({ type: 'RESET_CHAT' });
    },
    [dispatch],
  );

  const handleGenerateBack = useCallback(
    (draft?: string) => {
      if (draft) dispatch({ type: 'UPDATE_STRATEGY', payload: { draft } });
      if (chatPath === 'chat') {
        setSubStep('chat');
        setPending('thinking');
      } else {
        setSubStep('preset');
      }
    },
    [chatPath, dispatch],
  );

  const createStream = useCallback(
    (prompt: string, feedback?: string) => {
      if (chatPath === 'chat') {
        return generateStrategyFromTranscript({
          providerId: apiConfig.providerId!,
          apiKey: apiConfig.apiKey,
          seed: strategyChat.seed,
          transcript: strategyChat.transcript,
          feedback,
        });
      }
      return generateStrategy({
        providerId: apiConfig.providerId!,
        agentName: identity.name,
        apiKey: apiConfig.apiKey,
        strategy: prompt,
        draft: strategy.draft || strategy.content,
        feedback,
      });
    },
    [
      chatPath,
      apiConfig.providerId,
      apiConfig.apiKey,
      identity.name,
      strategy.draft,
      strategy.content,
      strategyChat.seed,
      strategyChat.transcript,
    ],
  );

  return (
    <Box flexDirection="column">
      {subStep === 'preset' && (
        <SelectPrompt
          label="Choose a strategy preset or chat with the agent"
          items={selectItems}
          defaultValue={defaultPreset?.value}
          onSelect={handlePreset}
          onBack={() => dispatch({ type: 'GO_BACK' })}
        />
      )}

      {subStep === 'seed' && (
        <TextPrompt
          label="In one sentence, what do you want this agent to trade and how?"
          placeholder="e.g. trend-trade SOL on 4h with 1% risk per trade"
          defaultValue={strategyChat.seed || strategy.input || undefined}
          onSubmit={handleSeedSubmit}
          onBack={() => setSubStep('preset')}
        />
      )}

      {subStep === 'chat' && (
        <AgenticChat
          seed={strategyChat.seed}
          transcript={strategyChat.transcript}
          pending={pending}
          onAnswer={handleAnswer}
          onUndo={handleUndo}
          onBack={handleChatBack}
          onRetry={handleChatRetry}
        />
      )}

      {subStep === 'generate' && (
        <StreamingGenerationStep
          title="STRATEGY.md"
          input={strategy.input}
          initialContent={strategy.draft || strategy.content}
          createStream={createStream}
          onBack={handleGenerateBack}
          onComplete={handleComplete}
        />
      )}
    </Box>
  );
}

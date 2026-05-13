import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { generateStrategy, generateStrategyFromTranscript } from '../../../generate-strategy';
import { STRATEGY_PRESETS } from '../../../presets/data';
import { buildStrategyMarkdown } from '../../../presets/formatting';
import {
  type ChatTurn,
  nextAgentTurn,
  type QuestionTurn,
  remainingTopics,
  STRATEGY_TOPICS,
  type StrategyTopic,
} from '../../../strategy-chat-agent';
import { type GenerationState, useWizard } from '../../wizard-context';
import { initial, reduce, type State } from './machine';

export type Pending = QuestionTurn | 'thinking' | { kind: 'error'; message: string };

export interface PresetViewProps {
  defaultValue?: string;
  onPick: (presetName: string) => void;
  onPickCustom: () => void;
  onWizardBack: () => void;
}

export interface SeedViewProps {
  defaultValue?: string;
  onSubmit: (seed: string) => void;
  onBack: () => void;
}

export interface CustomViewProps {
  seed: string;
  transcript: ChatTurn[];
  pending: Pending;
  onAnswer: (answer: string) => void;
  onUndo: () => void;
  onBack: () => void;
  onRetry: () => void;
}

export interface StreamingViewProps {
  stream: AsyncIterable<string>;
  feedbackCount: number;
  onComplete: (text: string) => void;
  onError: (message: string) => void;
}

export interface ReviewViewProps {
  draft: string;
  onAccept: () => void;
  onRegenerate: (feedback: string) => void;
  onBack: () => void;
}

export interface ErrorViewProps {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}

export type ViewState =
  | { kind: 'preset'; props: PresetViewProps }
  | { kind: 'seed'; props: SeedViewProps }
  | { kind: 'custom'; props: CustomViewProps }
  | { kind: 'streaming'; props: StreamingViewProps }
  | { kind: 'review'; props: ReviewViewProps }
  | { kind: 'error'; props: ErrorViewProps };

export function useStrategyController(): ViewState {
  const { state: wizard, dispatch: wd } = useWizard();
  const { apiConfig, identity, strategy, strategyChat, watchlist } = wizard;

  const [machine, send] = useReducer(reduce, initial);
  const [pending, setPending] = useState<Pending>('thinking');
  const inFlight = useRef(false);

  const buildPresetStream = (feedback?: string): AsyncIterable<string> =>
    generateStrategy({
      providerId: apiConfig.providerId!,
      agentName: identity.name,
      apiKey: apiConfig.apiKey,
      strategy: strategy.input,
      draft: strategy.draft || strategy.content,
      feedback,
    });

  const buildCustomStream = useCallback(
    (transcript: ChatTurn[], seed: string, feedback?: string): AsyncIterable<string> =>
      generateStrategyFromTranscript({
        providerId: apiConfig.providerId!,
        apiKey: apiConfig.apiKey,
        seed,
        transcript,
        feedback,
        assets: watchlist.assets,
      }),
    [apiConfig.apiKey, apiConfig.providerId, watchlist.assets],
  );

  const callAgent = useCallback(
    async (
      transcript: ChatTurn[],
      covered: StrategyTopic[],
      force: StrategyTopic[] = [],
    ): Promise<void> => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending('thinking');
      try {
        let turn = await nextAgentTurn({
          providerId: apiConfig.providerId!,
          apiKey: apiConfig.apiKey,
          transcript,
          seed: strategyChat.seed,
          coveredTopics: covered,
          forceRemaining: force,
          assets: watchlist.assets,
        });

        if (turn.kind === 'done') {
          const merged = new Set<StrategyTopic>(covered);
          for (const t of turn.topicsAddressed) merged.add(t);
          const remaining = STRATEGY_TOPICS.filter((t) => !merged.has(t));
          if (remaining.length > 0) {
            turn = await nextAgentTurn({
              providerId: apiConfig.providerId!,
              apiKey: apiConfig.apiKey,
              transcript,
              seed: strategyChat.seed,
              coveredTopics: Array.from(merged),
              forceRemaining: remaining,
              assets: watchlist.assets,
            });
          }
        }

        if (turn.kind === 'done') {
          const stream = buildCustomStream(transcript, strategyChat.seed);
          send({ type: 'INTERVIEW_DONE', stream });
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
    [
      apiConfig.apiKey,
      apiConfig.providerId,
      buildCustomStream,
      strategyChat.seed,
      watchlist.assets,
    ],
  );

  // Kick off agent on (re-)entering the 'custom' state.
  const prevKind = useRef<State['kind']>(machine.kind);
  useEffect(() => {
    if (machine.kind === 'custom' && prevKind.current !== 'custom') {
      void callAgent(strategyChat.transcript, strategyChat.coveredTopics);
    }
    prevKind.current = machine.kind;
  }, [machine.kind, callAgent, strategyChat.coveredTopics, strategyChat.transcript]);

  switch (machine.kind) {
    case 'preset': {
      return {
        kind: 'preset',
        props: {
          defaultValue: strategy.input || undefined,
          onPick: (presetName) => {
            const preset = STRATEGY_PRESETS.find((p) => p.name === presetName);
            if (!preset) return;
            const content = buildStrategyMarkdown(identity.name, preset);
            wd({
              type: 'UPDATE_STRATEGY',
              payload: { content, draft: content, input: preset.name },
            });
            send({ type: 'PRESET_PICKED' });
          },
          onPickCustom: () => send({ type: 'CUSTOM_PICKED' }),
          onWizardBack: () => wd({ type: 'GO_BACK' }),
        },
      };
    }

    case 'seed': {
      return {
        kind: 'seed',
        props: {
          defaultValue: strategyChat.seed || strategy.input || undefined,
          onSubmit: (value) => {
            const seed = value.trim();
            if (!seed) return;
            const payload: Partial<GenerationState> = { input: seed };
            if (seed !== strategy.input) {
              payload.draft = '';
              payload.content = '';
            }
            wd({ type: 'UPDATE_STRATEGY', payload });
            wd({ type: 'SET_CHAT_SEED', seed });
            send({ type: 'SEED_SUBMITTED' });
          },
          onBack: () => send({ type: 'BACK' }),
        },
      };
    }

    case 'custom': {
      return {
        kind: 'custom',
        props: {
          seed: strategyChat.seed,
          transcript: strategyChat.transcript,
          pending,
          onAnswer: (answer) => {
            if (typeof pending !== 'object' || pending.kind !== 'question') return;
            const turn: ChatTurn = {
              question: pending.prompt,
              answer,
              topic: pending.topic,
            };
            const nextTranscript = [...strategyChat.transcript, turn];
            const merged = new Set<StrategyTopic>(strategyChat.coveredTopics);
            for (const t of pending.topicsAddressed) merged.add(t);
            const covered = Array.from(merged);

            wd({
              type: 'APPEND_CHAT_TURN',
              turn,
              topicsAddressed: pending.topicsAddressed,
            });

            if (remainingTopics(covered).length === 0) {
              const stream = buildCustomStream(nextTranscript, strategyChat.seed);
              send({ type: 'INTERVIEW_DONE', stream });
              return;
            }
            void callAgent(nextTranscript, covered);
          },
          onUndo: () => {
            if (strategyChat.transcript.length === 0) return;
            wd({ type: 'POP_CHAT_TURN' });
            const trimmed = strategyChat.transcript.slice(0, -1);
            const covered = new Set<StrategyTopic>();
            for (const t of trimmed) {
              if (t.topic) covered.add(t.topic);
            }
            void callAgent(trimmed, Array.from(covered));
          },
          onBack: () => send({ type: 'BACK' }),
          onRetry: () => void callAgent(strategyChat.transcript, strategyChat.coveredTopics),
        },
      };
    }

    case 'streaming': {
      return {
        kind: 'streaming',
        props: {
          stream: machine.stream,
          feedbackCount: machine.feedbackCount,
          onComplete: (fullText) => {
            const trimmed = fullText.trim();
            if (trimmed.length === 0) {
              send({
                type: 'STREAM_FAILED',
                message: 'LLM returned empty content. Try regenerating.',
              });
              return;
            }
            wd({ type: 'UPDATE_STRATEGY', payload: { draft: trimmed } });
            send({ type: 'STREAM_COMPLETED' });
          },
          onError: (message) => send({ type: 'STREAM_FAILED', message }),
        },
      };
    }

    case 'review': {
      const draft = strategy.draft || strategy.content;
      const chatPath = machine.chatPath;
      return {
        kind: 'review',
        props: {
          draft,
          onAccept: () => {
            if (!draft) return;
            wd({
              type: 'SET_STRATEGY',
              payload: { content: draft, draft: '', input: '' },
            });
            wd({ type: 'RESET_CHAT' });
            send({ type: 'DRAFT_ACCEPTED' });
          },
          onRegenerate: (feedback) => {
            wd({ type: 'UPDATE_STRATEGY', payload: { draft: '' } });
            const stream =
              chatPath === 'custom'
                ? buildCustomStream(strategyChat.transcript, strategyChat.seed, feedback)
                : buildPresetStream(feedback);
            send({ type: 'REGEN_REQUESTED', stream });
          },
          onBack: () => send({ type: 'BACK' }),
        },
      };
    }

    case 'error': {
      const chatPath = machine.chatPath;
      return {
        kind: 'error',
        props: {
          message: machine.message,
          onRetry: () => {
            const stream =
              chatPath === 'custom'
                ? buildCustomStream(strategyChat.transcript, strategyChat.seed)
                : buildPresetStream();
            send({ type: 'RETRY', stream });
          },
          onBack: () => send({ type: 'BACK' }),
        },
      };
    }
  }
}

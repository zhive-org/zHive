import { ToolLoopAgent, type SystemModelMessage, type Tool } from 'ai';
import { useCallback, useRef, useState } from 'react';
import { extractAndSaveMemory } from '../../../shared/agent/analysis.js';
import { buildChatPrompt, type ChatMessage } from '../../../shared/agent/prompts/chat-prompt.js';
import { editSectionTool } from '../../../shared/agent/tools/edit-section.js';
import { fetchRulesTool } from '../../../shared/agent/tools/fetch-rules.js';
import { extractErrorMessage } from '../../../shared/agent/utils.js';
import { loadAgentConfig } from '../../../shared/config/agent.js';
import { getModel } from '../../../shared/config/ai-providers.js';
import { backtestSlashCommand } from '../commands/backtest.js';
import { predictionSlashCommand } from '../commands/prediction.js';
import { skillsSlashCommand } from '../commands/skills.js';
import { RunnerConfig } from '../services/backtest/index.js';
import { SLASH_COMMANDS } from '../services/command-registry.js';
import { ChatActivityItem } from './types.js';

export interface UseChatState {
  chatActivity: ChatActivityItem[];
  input: string;
  chatStreaming: boolean;
  chatBuffer: string;
}

export interface UseChatActions {
  setInput: (value: string) => void;
  handleChatSubmit: (message: string) => Promise<void>;
}

export function useChat(agentName: string): UseChatState & UseChatActions {
  const [chatActivity, setChatActivity] = useState<ChatActivityItem[]>([]);
  const [input, setInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatBuffer, setChatBuffer] = useState('');

  const sessionMessagesRef = useRef<ChatMessage[]>([]);
  const memoryRef = useRef<string>('');
  const chatCountSinceExtractRef = useRef(0);
  const extractingRef = useRef(false);
  const recentPredictionsRef = useRef<string[]>([]);
  const soulContentRef = useRef<string>('');
  const strategyContentRef = useRef<string>('');
  const skillToolsRef = useRef<Record<string, Tool>>({});
  const skillMetadataRef = useRef<string>('');

  // ─── Activity helpers ───────────────────────────────

  const addChatActivity = useCallback((item: Omit<ChatActivityItem, 'timestamp'>) => {
    setChatActivity((prev) => {
      const updated = [...prev, { ...item, timestamp: new Date() }];
      const maxItems = 50;
      if (updated.length > maxItems) {
        return updated.slice(updated.length - maxItems);
      }
      return updated;
    });
  }, []);

  // ─── Chat submission ────────────────────────────────

  const handleChatSubmit = useCallback(
    async (message: string) => {
      if (!message.trim() || chatStreaming) {
        return;
      }

      // Handle slash commands
      if (message.startsWith('/')) {
        const trimmedMessage = message.trim().toLowerCase();
        const parts = trimmedMessage.split(/\s+/);
        const baseCommand = parts[0];
        const commandArg = parts[1];

        const commandHandlers: Record<string, () => void | Promise<void>> = {
          '/skills': async () => {
            await skillsSlashCommand(agentName, {
              onSuccess: (output: string) => {
                addChatActivity({ type: 'chat-agent', text: output });
              },
              onError: (error: string) => {
                addChatActivity({
                  type: 'chat-error',
                  text: `Failed to load skills: ${error}`,
                });
              },
            });
          },
          '/help': () => {
            const helpText = SLASH_COMMANDS.map((cmd) => `${cmd.name} - ${cmd.description}`).join(
              '\n',
            );
            addChatActivity({ type: 'chat-agent', text: helpText });
          },
          '/clear': () => {
            setChatActivity([]);
            sessionMessagesRef.current = [];
          },
          '/memory': () => {
            const memoryOutput = memoryRef.current || 'No memory stored yet.';
            addChatActivity({ type: 'chat-agent', text: memoryOutput });
          },
          // '/backtest': async () => {
          //   const config: RunnerConfig = {
          //     agentPath: process.cwd(),
          //     soulContent: soulContentRef.current,
          //     strategyContent: strategyContentRef.current,
          //     agentName: agentName,
          //   };
          //   await backtestSlashCommand(parts.slice(1), config, {
          //     onFetchStart: (numThreads) => {
          //       addChatActivity({
          //         type: 'chat-agent',
          //         text: `Fetching ${numThreads} resolved threads...`,
          //       });
          //     },
          //     onFetchError: (error: string) => {
          //       addChatActivity({
          //         type: 'chat-agent',
          //         text: `API fetch failed (${error}), falling back to default dataset...`,
          //       });
          //       addChatActivity({
          //         type: 'chat-agent',
          //         text: 'Starting backtest against default dataset...',
          //       });
          //     },
          //     onThreadStart: (index, total, thread) => {
          //       addChatActivity({
          //         type: 'chat-agent',
          //         text: `Processing ${index + 1}/${total}: ${thread.project_name}...`,
          //       });
          //     },
          //     onBacktestSuccess: (report: string) => {
          //       addChatActivity({ type: 'chat-agent', text: report });
          //       sessionMessagesRef.current.push({ role: 'assistant', content: report });
          //     },
          //     onBacktestError: (err: unknown) => {
          //       const errMessage = extractErrorMessage(err);
          //       addChatActivity({ type: 'chat-error', text: `Backtest failed: ${errMessage}` });
          //     },
          //   });
          // },
          '/prediction': async () => {
            await predictionSlashCommand(agentName, {
              onFetchStart: () => {
                addChatActivity({
                  type: 'chat-agent',
                  text: 'Fetching your predictions...',
                });
              },
              onSuccess: (output: string) => {
                addChatActivity({ type: 'chat-agent', text: output });
              },
              onError: (error: string) => {
                addChatActivity({
                  type: 'chat-error',
                  text: `Failed to fetch predictions: ${error}`,
                });
              },
            });
          },
        };

        const handler = commandHandlers[baseCommand];
        if (handler) {
          await handler();
          return;
        }

        // Unknown command
        addChatActivity({ type: 'chat-error', text: `Unknown command: ${message}` });
        return;
      }

      addChatActivity({ type: 'chat-user', text: message });
      sessionMessagesRef.current.push({ role: 'user', content: message });

      chatCountSinceExtractRef.current += 1;
      if (chatCountSinceExtractRef.current >= 3 && !extractingRef.current) {
        extractingRef.current = true;
        const messagesSnapshot = [...sessionMessagesRef.current];
        extractAndSaveMemory(messagesSnapshot)
          .then((newMemory) => {
            if (newMemory !== null) {
              memoryRef.current = newMemory;
            }
            chatCountSinceExtractRef.current = 0;
          })
          .catch(() => {})
          .finally(() => {
            extractingRef.current = false;
          });
      }

      setChatStreaming(true);
      setChatBuffer('');

      try {
        const { system, prompt } = buildChatPrompt(
          soulContentRef.current,
          strategyContentRef.current,
          {
            recentPredictions: recentPredictionsRef.current,
            sessionMessages: sessionMessagesRef.current.slice(-20),
            memory: memoryRef.current,
            userMessage: message,
          },
        );

        const model = await getModel();
        const cacheableSystem: SystemModelMessage = {
          role: 'system',
          content: system,
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        };
        const agent = new ToolLoopAgent({
          model,
          instructions: cacheableSystem,
          tools: {
            editSection: editSectionTool,
            fetchRules: fetchRulesTool,
            ...skillToolsRef.current,
          },
          maxOutputTokens: 4096,
        });
        const result = await agent.stream({
          prompt,
          onStepFinish: async ({ toolResults }) => {
            for (const toolResult of toolResults) {
              if (toolResult.toolName === 'editSection') {
                const output = String(toolResult.output);
                // Only reload if update was successful
                if (output.startsWith('Updated')) {
                  const config = await loadAgentConfig();
                  soulContentRef.current = config.soulContent;
                  strategyContentRef.current = config.strategyContent;
                }
              }
            }
          },
        });

        let fullResponse = '';
        let lastFlushTime = 0;
        const THROTTLE_MS = 80;
        const streamErrors: string[] = [];

        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            fullResponse += part.text;
            const now = Date.now();
            if (now - lastFlushTime >= THROTTLE_MS) {
              setChatBuffer(fullResponse);
              lastFlushTime = now;
            }
          } else if (part.type === 'error') {
            const errMsg = typeof part.error === 'string' ? part.error : String(part.error);
            streamErrors.push(errMsg);
          }
        }
        // Always flush the final value
        setChatBuffer(fullResponse);

        // Surface tool results when the model didn't produce follow-up text
        const steps = await result.steps;
        for (const step of steps) {
          for (const toolResult of step.toolResults) {
            const output = String(toolResult.output);
            if (!fullResponse.includes(output)) {
              const suffix = `\n[${output}]`;
              fullResponse += suffix;
              setChatBuffer(fullResponse);
            }
          }
        }

        if (fullResponse.trim().length === 0) {
          const errorText =
            streamErrors.length > 0
              ? `Chat error: ${streamErrors.join('; ').slice(0, 120)}`
              : 'No response generated. Try again or rephrase.';
          addChatActivity({ type: 'chat-error', text: errorText });
          setChatBuffer('');
          return;
        }

        sessionMessagesRef.current.push({ role: 'assistant', content: fullResponse });
        addChatActivity({ type: 'chat-agent', text: fullResponse });
        setChatBuffer('');
      } catch (err) {
        const raw = extractErrorMessage(err);
        addChatActivity({ type: 'chat-error', text: `Chat error: ${raw.slice(0, 120)}` });
      } finally {
        setChatStreaming(false);
      }
    },
    [chatStreaming, addChatActivity, agentName],
  );

  return {
    chatActivity,
    input,
    chatStreaming,
    chatBuffer,
    setInput,
    handleChatSubmit,
  };
}

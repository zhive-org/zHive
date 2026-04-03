import * as ai from 'ai';
import { type SystemModelMessage } from 'ai';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import { useCallback, useRef, useState } from 'react';
import { extractAndSaveMemory } from '../../../shared/agent/analysis';
import { buildChatPrompt, type ChatMessage } from '../../../shared/agent/prompts/chat-prompt';
import { editSectionTool } from '../../../shared/tools/edit-section';
import { fetchRulesTool } from '../../../shared/tools/fetch-rules';
import { extractErrorMessage } from '../../../shared/agent/utils';
import { getModel } from '../../../shared/config/ai-providers';
import { styled } from '../../shared/theme';
import { predictionSlashCommand } from '../commands/prediction';
import { skillsSlashCommand } from '../commands/skills';
import { SLASH_COMMANDS } from '../services/command-registry';
import { ChatActivityItem } from './types';
import { useAgentRuntime } from './useAgentRuntime';

const { ToolLoopAgent } = wrapAISDK(ai);

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

export function useChat(): UseChatState & UseChatActions {
  const { runtime, reloadRuntime } = useAgentRuntime();
  const [chatActivity, setChatActivity] = useState<ChatActivityItem[]>([]);
  const [input, setInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatBuffer, setChatBuffer] = useState('');

  const sessionMessagesRef = useRef<ChatMessage[]>([]);
  const memoryRef = useRef<string>('');
  const chatCountSinceExtractRef = useRef(0);
  const extractingRef = useRef(false);
  const recentPredictionsRef = useRef<string[]>([]);

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
      if (!runtime) {
        return;
      }

      if (!message.trim() || chatStreaming) {
        return;
      }

      // Handle slash commands
      if (message.startsWith('/')) {
        const trimmedMessage = message.trim().toLowerCase();
        const parts = trimmedMessage.split(/\s+/);
        const baseCommand = parts[0];

        const commandHandlers: Record<string, () => void | Promise<void>> = {
          '/skills': async () => {
            await skillsSlashCommand(runtime.config.name, {
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
          '/prediction': async () => {
            await predictionSlashCommand(runtime.config.name, {
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
          runtime.config.soulContent,
          runtime.config.strategyContent,
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
            ...runtime.tools,
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
                  await reloadRuntime();
                }
              }
            }
          },
        });

        let lastFlushTime = 0;
        const THROTTLE_MS = 80;

        let response = '';
        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta': {
              response += part.text;
              setChatBuffer(response);
              const now = Date.now();
              if (now - lastFlushTime >= THROTTLE_MS) {
                setChatBuffer(response);
                lastFlushTime = now;
              }
              break;
            }
            case 'text-end': {
              sessionMessagesRef.current.push({ role: 'assistant', content: response });
              addChatActivity({ type: 'chat-agent', text: response });
              setChatBuffer('');
              response = '';
              break;
            }
            case 'tool-result': {
              let outputStr = '';
              if (typeof part.output === 'string') {
                outputStr = part.output;
              } else if (typeof part.output === 'object') {
                outputStr = JSON.stringify(part.output);
              }

              outputStr = outputStr.length > 50 ? `${outputStr.slice(0, 50)}...` : outputStr;
              if (outputStr.length > 0) {
                addChatActivity({
                  type: 'tool-call',
                  text: `Call ${part.toolName}: ${outputStr}`,
                });
              }
              break;
            }
            case 'error': {
              const errMsg = typeof part.error === 'string' ? part.error : String(part.error);
              addChatActivity({ type: 'chat-error', text: errMsg });
              break;
            }
          }
        }
        // cleanup any pending buffer
        setChatBuffer('');

        const steps = await result.steps;
        let toolUsed = 0;
        let tokenUsedByTool = 0;
        for (const step of steps) {
          toolUsed += step.toolResults.length;
          tokenUsedByTool += step.usage.totalTokens ?? 0;
        }

        if (toolUsed > 0) {
          const toolMessage = `${styled.gray(`Done (${toolUsed}) tool uses · ${tokenUsedByTool} tokens`)}`;
          addChatActivity({ type: 'tool-summary', text: toolMessage });
        }
      } catch (err) {
        const raw = extractErrorMessage(err);
        addChatActivity({ type: 'chat-error', text: `Chat error: ${raw.slice(0, 120)}` });
      } finally {
        setChatStreaming(false);
      }
    },
    [
      chatStreaming,
      addChatActivity,
      reloadRuntime,
      runtime?.config.name,
      runtime?.tools,
      runtime?.config.soulContent,
      runtime?.config.strategyContent,
      runtime,
    ],
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

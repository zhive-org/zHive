import * as ai from 'ai';
import { type SystemModelMessage } from 'ai';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import { useCallback, useRef, useState } from 'react';
import { AgentRuntime } from '../../../shared/agent';
import { getModel } from '../../../shared/config/ai-providers';
import { extractErrorMessage } from '../../../shared/utils';
import {
  createReadBacktestResultTool,
  createReadFileTool,
  getRunningBacktestTool,
  writeFileTool,
} from '../../../shared/tools/agent-files';
import type { DetailedPosition } from '../../../shared/trading/types';
import { styled } from '../../shared/theme';
import { executeSlashCommand, SlashCommandCallbacks } from '../services/command-registry';
import { ChatActivityItem } from './types';
import { buildChatPrompt, ChatMessage } from '../../../shared/chat';
import { extractAndSaveMemory } from '../../../shared/memory';

export type ChatOverlay =
  | { type: 'positions'; positions: DetailedPosition[] }
  | { type: 'watchlist'; currentWatchlist: string[]; agentDir: string }
  | null;

const { ToolLoopAgent } = wrapAISDK(ai);

export interface UseChatState {
  chatActivity: ChatActivityItem[];
  input: string;
  chatStreaming: boolean;
  chatBuffer: string;
  overlay: ChatOverlay;
}

export interface UseChatActions {
  setInput: (value: string) => void;
  handleChatSubmit: (message: string) => Promise<void>;
  closeOverlay: () => void;
}

export function useChat({
  runtime,
  reloadRuntime,
}: {
  runtime?: AgentRuntime;
  reloadRuntime: () => void;
}): UseChatState & UseChatActions {
  const [chatActivity, setChatActivity] = useState<ChatActivityItem[]>([]);
  const [input, setInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatBuffer, setChatBuffer] = useState('');
  const [overlay, setOverlay] = useState<ChatOverlay>(null);

  const closeOverlay = useCallback(() => {
    setOverlay(null);
  }, []);

  const sessionMessagesRef = useRef<ChatMessage[]>([]);
  const memoryRef = useRef<string>('');
  const chatCountSinceExtractRef = useRef(0);
  const extractingRef = useRef(false);
  const recentPredictionsRef = useRef<string[]>([]);

  // ─── Activity helpers ───────────────────────────────
  const addChatActivity = useCallback((item: ChatActivityItem) => {
    setChatActivity((prev) => {
      const updated = [...prev, { timestamp: new Date(), ...item }];
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
        const trimmed = message.trim();
        // Preserve original casing/values for args; only the base command is matched case-insensitively.
        const parts = trimmed.split(/\s+/);
        const baseCommand = parts[0].toLowerCase();
        const args = parts.slice(1);

        const callbacks: SlashCommandCallbacks = {
          onMessage: (text: string) => addChatActivity({ type: 'chat-agent', text }),
          onError: (error: string) => {
            addChatActivity({
              type: 'chat-error',
              text: error,
            });
          },
          onClear: () => {
            setChatActivity([]);
            sessionMessagesRef.current = [];
          },
          onOverlayOpen: (overlay: ChatOverlay) => {
            setOverlay(overlay);
          },
          onAgentContext: (text: string) => {
            sessionMessagesRef.current.push({ role: 'assistant', content: text });
          },
        };

        await executeSlashCommand(baseCommand, runtime, callbacks, args);
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
        const readFile = createReadFileTool(runtime.config.dir);
        const readBacktestResult = createReadBacktestResultTool(runtime.config.dir);
        const agent = new ToolLoopAgent({
          model,
          instructions: cacheableSystem,
          tools: {
            writeFile: writeFileTool,
            readFile,
            readBacktestResult,
            getRunningBacktest: getRunningBacktestTool,
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
    overlay,
    setInput,
    handleChatSubmit,
    closeOverlay,
  };
}

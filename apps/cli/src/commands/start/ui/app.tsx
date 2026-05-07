import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Static, Text } from 'ink';
import { loadMemory } from '@zhive/sdk';
import { useAgent } from '../hooks/useAgent';
import { PollText, Spinner } from './Spinner';
import { CommandInput } from './CommandInput';
import { border, colors, symbols } from '../../shared/theme';
import { HIVE_FRONTEND_URL } from '../../../shared/config/constant';
import { formatTime } from '../../../shared/utils';
import { useChat } from '../hooks/useChat';
import { activityFormatter } from '../hooks/utils';
import { PositionsView } from '../../../components/PositionsView';
import { WatchlistView } from '../../../components/WatchlistView';
import { useAgentRuntime } from '../hooks/useAgentRuntime';
import { useWebServer } from '../hooks/useWebServer';
import { WebEventBus } from '../web/events';
import type { WebControl, WebState } from '../web/control';
import { executeSlashCommand, type SlashCommandCallbacks } from '../services/command-registry';
import { ZhiveExchange } from '../../../shared/trading/exchange/zhive';
import type { DetailedPosition } from '../../../shared/trading/types';

const POSITIONS_TTL_MS = 5_000;

// ─── Main TUI App ────────────────────────────────────

export interface AppProps {
  webPort?: number;
  openInBrowser?: boolean;
}

export const App: React.FC<AppProps> = ({ webPort, openInBrowser }) => {
  const { runtime, reloadRuntime } = useAgentRuntime();
  const [termWidth, setTermWidth] = useState(process.stdout.columns || 60);
  const eventBus = useMemo(() => new WebEventBus(), []);
  const exchangeRef = useRef<{ apiKey: string; client: Promise<ZhiveExchange> } | null>(null);
  const positionsCacheRef = useRef<{ ts: number; positions: DetailedPosition[] } | null>(null);

  const { connected, agentName, modelInfo, activePollActivities, settledPollActivities } = useAgent(
    { runtime, eventBus },
  );

  const {
    input,
    chatActivity,
    chatBuffer,
    chatStreaming,
    overlay,
    handleChatSubmit,
    setInput,
    closeOverlay,
    clearChat,
  } = useChat({ runtime, reloadRuntime, eventBus });

  const control = useMemo<WebControl>(
    () => ({
      async executeCommand(name) {
        if (!runtime) {
          eventBus.push({ type: 'error', errorMessage: 'Runtime not ready' });
          return;
        }
        const callbacks: SlashCommandCallbacks = {
          onMessage: (text) => eventBus.push({ type: 'chat', role: 'agent', text }),
          onError: (text) => eventBus.push({ type: 'chat', role: 'error', text }),
          onClear: () => {
            clearChat();
            eventBus.push({ type: 'system', kind: 'clear-chat' });
          },
          onOverlayOpen: (overlay) => {
            const text =
              overlay?.type === 'positions'
                ? `Positions overlay opened (${overlay.positions.length} open). Fetch /api/state for details.`
                : overlay?.type === 'watchlist'
                  ? 'Watchlist overlay opened. Fetch /api/state for the current list.'
                  : 'Overlay opened.';
            eventBus.push({ type: 'chat', role: 'agent', text });
          },
        };
        await executeSlashCommand(name, runtime, callbacks);
      },
      async submitChat(text) {
        if (!runtime) {
          eventBus.push({ type: 'error', errorMessage: 'Runtime not ready' });
          return;
        }
        if (text.trim().startsWith('/')) {
          eventBus.push({
            type: 'chat',
            role: 'error',
            text: 'Slash commands must be sent to POST /api/command',
          });
          return;
        }
        void handleChatSubmit(text);
      },
      async getState(): Promise<WebState> {
        if (!runtime) {
          throw new Error('Runtime not ready');
        }
        const apiKey = runtime.config.apiKey;
        if (exchangeRef.current?.apiKey !== apiKey) {
          exchangeRef.current = { apiKey, client: ZhiveExchange.create({ apiKey }) };
          positionsCacheRef.current = null;
        }
        const cache = positionsCacheRef.current;
        const now = Date.now();
        let positions: DetailedPosition[];
        if (cache && now - cache.ts < POSITIONS_TTL_MS) {
          positions = cache.positions;
        } else {
          const exchange = await exchangeRef.current.client;
          positions = await exchange.fetchPositions();
          positionsCacheRef.current = { ts: now, positions };
        }
        const memory = await loadMemory();
        return {
          agentName: runtime.config.name,
          watchlist: runtime.config.watchList,
          positions,
          memory,
        };
      },
    }),
    [runtime, eventBus, handleChatSubmit, clearChat],
  );

  const webServer = useWebServer({ port: webPort, runtime, eventBus, control, openInBrowser });

  // ─── Terminal resize tracking ───────────────────────
  useEffect(() => {
    const onResize = (): void => {
      setTermWidth(process.stdout.columns || 60);
    };
    process.stdout.on('resize', onResize);
    return () => {
      process.stdout.off('resize', onResize);
    };
  }, []);

  // When stdin is not a TTY (piped by hive-cli start), skip interactive input
  const isInteractive = process.stdin.isTTY === true;

  const boxWidth = termWidth;

  const agentPrefix = `${agentName}:`;
  const visibleChatActivity = chatActivity.slice(-15);

  const connectedDisplay = connected ? 'Connected to zHive' : 'connecting...';
  const nameDisplay = `${agentName} agent`;
  const headerFill = Math.max(0, boxWidth - nameDisplay.length - connectedDisplay.length - 12);

  return (
    <>
      {/* Settled poll activities — rendered once into scrollback, never re-rendered */}
      <Static items={settledPollActivities}>
        {(item, i) => {
          const formatted = activityFormatter.format(item);
          if (formatted.length === 0) return <Box key={`settled-${item.id ?? i}`} />;
          return <Text key={`settled-${item.id ?? i}`}>{formatted.join('\n')}</Text>;
        }}
      </Static>

      <Box flexDirection="column" width={boxWidth}>
        {/* Header */}
        <Box>
          <Text
            color={colors.honey}
          >{`${border.topLeft}${border.horizontal} ${symbols.hive} `}</Text>
          <Text color={colors.white} bold>
            {nameDisplay}
          </Text>
          <Text color={colors.gray}> {`${border.horizontal.repeat(3)} `}</Text>
          <Text color={connected ? colors.green : colors.honey}>{connectedDisplay}</Text>
          <Text color={colors.gray}>
            {' '}
            {border.horizontal.repeat(Math.max(0, headerFill))}
            {border.topRight}
          </Text>
        </Box>
        {modelInfo && (
          <Box paddingLeft={1}>
            <Text color={colors.gray}>{symbols.hive} </Text>
            <Text color={colors.cyan}>{modelInfo.modelId}</Text>
            <Text color={colors.gray}> {'\u00d7'} </Text>
            <Text color={colors.purple}>zData</Text>
          </Box>
        )}
        {connected && (
          <Box paddingLeft={1}>
            <Text color={colors.gray}>
              {symbols.hive} View all {agentName}'s activity at{' '}
            </Text>
            <Text color={colors.cyan}>
              {HIVE_FRONTEND_URL}/agent/{agentName}
            </Text>
          </Box>
        )}
        {webServer.status === 'listening' && (
          <Box paddingLeft={1}>
            <Text color={colors.gray}>{symbols.hive} Web dashboard: </Text>
            <Text color={colors.cyan}>{webServer.url}</Text>
          </Box>
        )}
        {webServer.status === 'error' && (
          <Box paddingLeft={1}>
            <Text color={colors.red}>
              {symbols.cross} Web dashboard failed to start: {webServer.error}
            </Text>
          </Box>
        )}

        <Box flexDirection="column" paddingLeft={1} paddingRight={1} minHeight={2}>
          {!connected && <Spinner label="Initiating neural link..." />}
          {activePollActivities.map((item, i) => {
            if (item.type !== 'megathread') {
              const formatted = activityFormatter.format(item);
              if (formatted.length === 0) return <Box key={`active-${item.id ?? i}`} />;
              return <Text key={`active-${item.id ?? i}`}>{formatted.join('\n')}</Text>;
            }
            return (
              <Box key={`active-${item.id ?? i}`} flexDirection="column">
                <Box>
                  <Text color={colors.gray} dimColor>
                    {formatTime(item.timestamp)}{' '}
                  </Text>
                  <Text color={colors.controversial}>{symbols.hive} </Text>
                  <PollText
                    color={colors.controversial}
                    text={activityFormatter.getText(item)}
                    animate={false}
                  />
                  <Text> </Text>
                </Box>
                {activityFormatter.getDetail(item) && (
                  <Box marginLeft={13}>
                    <PollText
                      color={colors.gray}
                      text={`"${activityFormatter.getDetail(item)}"`}
                      animate={false}
                    />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Overlay (e.g. /positions) - takes over chat area & input when active */}
        {overlay?.type === 'positions' && (
          <>
            <Box>
              <Text color={colors.gray}>
                {border.teeLeft}
                {`${border.horizontal.repeat(2)} positions `}
                {border.horizontal.repeat(Math.max(0, boxWidth - 14))}
                {border.teeRight}
              </Text>
            </Box>
            <PositionsView positions={overlay.positions} onClose={closeOverlay} />
          </>
        )}

        {overlay?.type === 'watchlist' && (
          <>
            <Box>
              <Text color={colors.gray}>
                {border.teeLeft}
                {`${border.horizontal.repeat(2)} watchlist `}
                {border.horizontal.repeat(Math.max(0, boxWidth - 13))}
                {border.teeRight}
              </Text>
            </Box>
            <WatchlistView
              currentWatchlist={overlay.currentWatchlist}
              onClose={closeOverlay}
              onSaved={async () => reloadRuntime()}
            />
          </>
        )}

        {/* Chat section - visible after first message */}
        {!overlay && (chatActivity.length > 0 || chatStreaming) && (
          <>
            <Box>
              <Text color={colors.gray}>
                {border.teeLeft}
                {`${border.horizontal.repeat(2)} chat with ${agentName} agent `}
                {border.horizontal.repeat(Math.max(0, boxWidth - agentName.length - 22))}
                {border.teeRight}
              </Text>
            </Box>
            <Box
              flexDirection="column"
              paddingLeft={1}
              paddingRight={1}
              minHeight={2}
              // @ts-expect-error maxHeight is supported by Ink at runtime but missing from types
              maxHeight={8}
            >
              {visibleChatActivity.map((item, i) => (
                <Box key={i}>
                  {item.type === 'chat-user' && (
                    <Box>
                      <Text color={colors.white} bold>
                        you:{' '}
                      </Text>
                      <Text color={colors.white}>{item.text}</Text>
                    </Box>
                  )}
                  {item.type === 'chat-agent' && (
                    <Box>
                      <Text color={colors.honey} bold>
                        {agentPrefix}
                      </Text>
                      <Text color={colors.white} wrap="wrap">
                        {item.text}
                      </Text>
                    </Box>
                  )}
                  {item.type === 'chat-error' && (
                    <Box>
                      <Text color={colors.red}>
                        {symbols.cross} {item.text}
                      </Text>
                    </Box>
                  )}
                  {(item.type === 'tool-summary' || item.type === 'tool-call') && (
                    <Box>
                      <Text>{item.text}</Text>
                    </Box>
                  )}
                </Box>
              ))}
              {chatStreaming && chatBuffer && (
                <Box>
                  <Text color={colors.honey} bold>
                    {agentPrefix}
                  </Text>
                  <Text color={colors.white} wrap="wrap">
                    {chatBuffer}
                  </Text>
                </Box>
              )}
            </Box>
          </>
        )}

        {/* Input Bar — only when stdin is a real TTY */}
        <Box>
          <Text color={colors.gray}>
            {isInteractive ? border.teeLeft : border.bottomLeft}
            {border.horizontal.repeat(boxWidth - 2)}
            {isInteractive ? border.teeRight : border.bottomRight}
          </Text>
        </Box>
        {isInteractive && !overlay && (
          <>
            <Box paddingLeft={1}>
              <CommandInput
                value={input}
                onChange={setInput}
                onSubmit={(val) => {
                  setInput('');
                  void handleChatSubmit(val);
                }}
                placeholder={chatStreaming ? 'thinking...' : `chat with ${agentName} agent...`}
              />
            </Box>
            <Box>
              <Text color={colors.gray}>
                {border.bottomLeft}
                {border.horizontal.repeat(boxWidth - 2)}
                {border.bottomRight}
              </Text>
            </Box>
          </>
        )}
      </Box>
    </>
  );
}

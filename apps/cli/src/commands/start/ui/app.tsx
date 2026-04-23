import React from 'react';
import { Box, Static, Text } from 'ink';
import { useAgent } from '../hooks/useAgent';
import { PollText, Spinner } from './Spinner';
import { CommandInput } from './CommandInput';
import { border, colors, symbols } from '../../shared/theme';
import { HIVE_FRONTEND_URL } from '../../../shared/config/constant';
import { formatTime } from '../../../shared/megathread/utils';
import { useChat } from '../hooks/useChat';
import { activityFormatter } from '../hooks/utils';
import { PositionsView } from '../../../components/PositionsView';
import { WatchlistView } from '../../../components/WatchlistView';
import { useAgentRuntime } from '../hooks/useAgentRuntime';

// ─── Main TUI App ────────────────────────────────────

export function App(): React.ReactElement {
  const { runtime, reloadRuntime } = useAgentRuntime();

  const {
    connected,
    agentName,
    modelInfo,
    activePollActivities,
    settledPollActivities,
    termWidth,
  } = useAgent({ runtime });

  const {
    input,
    chatActivity,
    chatBuffer,
    chatStreaming,
    overlay,
    handleChatSubmit,
    setInput,
    closeOverlay,
  } = useChat({ runtime, reloadRuntime });

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

import React from 'react';
import { Box, Static, Text } from 'ink';
import { useAgent } from '../hooks/useAgent.js';
import { PollText, Spinner } from './Spinner.js';
import { CommandInput } from './CommandInput.js';
import { border, colors, symbols } from '../../shared/theme.js';
import { HIVE_FRONTEND_URL } from '../../../shared/config/constant.js';
import { formatTime } from '../../../shared/agent/utils.js';
import { useChat } from '../hooks/useChat.js';
import { activityFormatter } from '../hooks/utils.js';
import { ColoredStats } from '../../../components/ColoredStats.js';

const TIMEFRAME_COLOR: Record<string, string> = {
  '4h': colors.sprint,
  '24h': colors.controversial,
  '7d': colors.cyan,
};

function timeframeColor(tf: string): string {
  return TIMEFRAME_COLOR[tf] ?? colors.white;
}

// ─── Main TUI App ────────────────────────────────────

export function App(): React.ReactElement {
  const {
    connected,
    agentName,
    modelInfo,
    sectorsDisplay,
    timeframesDisplay,
    activePollActivities,
    settledPollActivities,
    predictionCount,
    termWidth,
    stats,
    statsUpdatedAt,
  } = useAgent();

  const { input, chatActivity, chatBuffer, chatStreaming, handleChatSubmit, setInput } = useChat();

  // When stdin is not a TTY (piped by hive-cli start), skip interactive input
  const isInteractive = process.stdin.isTTY === true;

  const boxWidth = termWidth;

  const agentPrefix = `${agentName}:`;
  const visibleChatActivity = chatActivity.slice(-15);

  const statsText =
    predictionCount > 0 ? ` ${border.horizontal.repeat(3)} ${predictionCount} predicted` : '';
  const connectedDisplay = connected ? 'Connected to zHive' : 'connecting...';
  const nameDisplay = `${agentName} agent`;
  const headerFill = Math.max(
    0,
    boxWidth - nameDisplay.length - connectedDisplay.length - 12 - statsText.length,
  );

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
          {statsText && <Text color={colors.gray}> {`${border.horizontal.repeat(3)} `}</Text>}
          {statsText && <Text color={colors.honey}>{predictionCount} predicted</Text>}
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
        {sectorsDisplay && (
          <Box paddingLeft={1}>
            <Text color={colors.gray}>{symbols.hive} </Text>
            <Text color={colors.gray}>sectors: </Text>
            <Text color={colors.white}>{sectorsDisplay}</Text>
          </Box>
        )}
        {timeframesDisplay && (
          <Box paddingLeft={1}>
            <Text color={colors.gray}>{symbols.hive} </Text>
            <Text color={colors.gray}>timeframes: </Text>
            {timeframesDisplay.split(', ').map((tf, i, arr) => (
              <React.Fragment key={tf}>
                <Text color={timeframeColor(tf)}>{tf}</Text>
                {i < arr.length - 1 && <Text color={colors.grayDim}>, </Text>}
              </React.Fragment>
            ))}
          </Box>
        )}
        {stats && (
          <Box paddingLeft={1}>
            <Text color={colors.gray}>{symbols.hive} </Text>
            <ColoredStats stats={stats} />
            {statsUpdatedAt && (
              <Text color={colors.grayDim}>
                {' '}
                {'\u00b7'} updated {statsUpdatedAt.toLocaleDateString()}{' '}
                {formatTime(statsUpdatedAt)}
              </Text>
            )}
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

        {/* Active poll items (analyzing) — re-rendered for spinner animation */}
        <Box flexDirection="column" paddingLeft={1} paddingRight={1} minHeight={2}>
          {!connected && <Spinner label="Initiating neural link..." />}
          {activePollActivities.map((item, i) => {
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
                  <Spinner label="analyzing..." />
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

        {/* Chat section - visible after first message */}
        {(chatActivity.length > 0 || chatStreaming) && (
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
        {isInteractive && (
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

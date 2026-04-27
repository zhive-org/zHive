import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { SelectPrompt, type SelectItem } from '../../../../components/SelectPrompt';
import { TextPrompt } from '../../../../components/TextPrompt';
import { Spinner } from '../../../../components/Spinner';
import { colors, symbols } from '../../../shared/theme';
import { AI_PROVIDERS, type AIProviderId } from '../../../../shared/config/ai-providers';
import { validateApiKey } from '../../validate-api-key';
import { HiveConfig, readConfig, writeConfig } from '../../../../shared/config/config';
import { apiKey as validateApiKeyFormat } from '../../validation';
import { useWizard } from '../wizard-context';

type Phase =
  | 'check-saved'
  | 'use-current'
  | 'use-saved'
  | 'select-provider'
  | 'enter-key'
  | 'validating'
  | 'error';

function maskKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  const visible = key.slice(0, 4) + '...' + key.slice(-4);
  return visible;
}

export function ApiKeyStep(): React.ReactElement {
  const { state, dispatch } = useWizard();
  const { apiConfig } = state;
  const hasExistingKey = apiConfig.providerId !== null && apiConfig.apiKey !== '';

  const [phase, setPhase] = useState<Phase>(hasExistingKey ? 'use-current' : 'check-saved');
  const [savedConfig, setSavedConfig] = useState<HiveConfig | null>(null);
  const [providerId, setProviderId] = useState<AIProviderId | null>(null);
  const [error, setError] = useState('');

  const goBack = () => dispatch({ type: 'GO_BACK' });

  useEffect(() => {
    if (phase !== 'check-saved') return;
    const loadConfig = async (): Promise<void> => {
      const config = await readConfig();
      if (config) {
        setSavedConfig(config);
        setPhase('use-saved');
      } else {
        setPhase('select-provider');
      }
    };
    void loadConfig();
  }, [phase]);

  const providerDescriptions: Record<string, string> = {
    'openrouter-free':
      'Routes to a free model via openrouter/free [FREE but still requires an API key]',
    openrouter: 'Uses openai/gpt-5.4-nano as default',
    openai: 'Uses gpt-5.4-nano as default',
    anthropic: 'Uses claude-haiku-4-5 as default',
    google: 'Uses gemini-3-flash-preview as default',
    xai: 'Uses grok-4-1-fast-reasoning as default',
  };

  const providerItems: SelectItem[] = AI_PROVIDERS.map((p) => ({
    label: p.label,
    value: p.id,
    description:
      providerDescriptions[p.id] ??
      `Uses ${p.models.runtime} (configurable via HIVE_MODEL in .env)`,
  }));

  const handleProviderSelect = (item: SelectItem): void => {
    setProviderId(item.value as AIProviderId);
    setPhase('enter-key');
  };

  const handleKeySubmit = async (key: string, selectedProviderId: AIProviderId): Promise<void> => {
    setPhase('validating');
    setError('');

    const result = await validateApiKey(selectedProviderId, key);

    if (result === true) {
      await writeConfig({ providerId: selectedProviderId, apiKey: key });
      dispatch({
        type: 'SET_API_CONFIG',
        payload: { providerId: selectedProviderId, apiKey: key },
      });
    } else {
      setError(result);
      setPhase('error');
    }
  };

  const handleUseSaved = async (item: SelectItem): Promise<void> => {
    if (item.value === 'yes' && savedConfig) {
      setPhase('validating');
      const result = await validateApiKey(savedConfig.providerId, savedConfig.apiKey);
      if (result === true) {
        dispatch({
          type: 'SET_API_CONFIG',
          payload: { providerId: savedConfig.providerId, apiKey: savedConfig.apiKey },
        });
      } else {
        setError(`Saved key is no longer valid: ${result}`);
        setPhase('select-provider');
      }
    } else {
      setPhase('select-provider');
    }
  };

  const selectedProvider = providerId ? AI_PROVIDERS.find((p) => p.id === providerId) : null;

  const savedProvider = savedConfig
    ? AI_PROVIDERS.find((p) => p.id === savedConfig.providerId)
    : null;

  return (
    <Box flexDirection="column">
      {phase === 'check-saved' && <Spinner label="Checking for saved API key..." />}

      {phase === 'use-current' && hasExistingKey && (
        <Box flexDirection="column">
          <Box marginBottom={1} marginLeft={2}>
            <Text color={colors.gray}>
              {symbols.diamond} Current key:{' '}
              <Text color={colors.honey}>
                {AI_PROVIDERS.find((p) => p.id === apiConfig.providerId)?.label ??
                  apiConfig.providerId}
              </Text>{' '}
              <Text color={colors.grayDim}>({maskKey(apiConfig.apiKey)})</Text>
            </Text>
          </Box>
          <SelectPrompt
            label="Keep current API key?"
            items={[
              { label: 'Yes, keep current key', value: 'yes' },
              { label: 'No, enter a new key', value: 'no' },
            ]}
            onSelect={(item) => {
              if (item.value === 'yes') {
                dispatch({
                  type: 'SET_API_CONFIG',
                  payload: { providerId: apiConfig.providerId!, apiKey: apiConfig.apiKey },
                });
              } else {
                setPhase('select-provider');
              }
            }}
            onBack={goBack}
          />
        </Box>
      )}

      {phase === 'use-saved' && savedConfig && savedProvider && (
        <Box flexDirection="column">
          <Box marginBottom={1} marginLeft={2}>
            <Text color={colors.gray}>
              {symbols.diamond} Saved key: <Text color={colors.honey}>{savedProvider.label}</Text>{' '}
              <Text color={colors.grayDim}>({maskKey(savedConfig.apiKey)})</Text>
            </Text>
          </Box>
          <SelectPrompt
            label="Use saved API key?"
            items={[
              { label: 'Yes, use saved key', value: 'yes' },
              { label: 'No, enter a new key', value: 'no' },
            ]}
            onSelect={(item) => {
              void handleUseSaved(item);
            }}
            onBack={goBack}
          />
        </Box>
      )}

      {phase === 'select-provider' && (
        <Box flexDirection="column">
          {error !== '' && (
            <Box marginBottom={1} marginLeft={2}>
              <Text color={colors.red}>
                {symbols.cross} {error}
              </Text>
            </Box>
          )}
          <SelectPrompt
            label="Select your AI provider"
            items={providerItems}
            onSelect={handleProviderSelect}
            onBack={goBack}
          />
        </Box>
      )}

      {phase === 'enter-key' && selectedProvider && providerId && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={colors.gray}>
              {symbols.diamond} Provider: <Text color={colors.honey}>{selectedProvider.label}</Text>
            </Text>
          </Box>
          <TextPrompt
            label={`Enter your ${selectedProvider.envVar}`}
            placeholder="sk-..."
            onSubmit={(key) => {
              void handleKeySubmit(key, providerId);
            }}
            onBack={() => setPhase('select-provider')}
            validate={validateApiKeyFormat}
          />
        </Box>
      )}

      {phase === 'validating' && <Spinner label="Validating API key..." />}

      {phase === 'error' && providerId && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={colors.red}>
              {symbols.cross} {error}
            </Text>
          </Box>
          <TextPrompt
            label="Try again — enter your API key"
            placeholder="sk-..."
            onSubmit={(key) => {
              void handleKeySubmit(key, providerId);
            }}
            onBack={() => setPhase('select-provider')}
            validate={validateApiKeyFormat}
          />
        </Box>
      )}
    </Box>
  );
}

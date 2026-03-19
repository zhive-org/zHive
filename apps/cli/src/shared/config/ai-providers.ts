import { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getAgentProviderKeys } from './env-loader.js';

let _modelPromise: Promise<LanguageModel> | null = null;

export type AIProviderId = 'openai' | 'anthropic' | 'google' | 'xai' | 'openrouter';

export interface AIProviderModels {
  /** Cheapest model — just checks if the key works. */
  validation: string;
  /** Decent model for soul/strategy generation during create. */
  generation: string;
  /** Default model for agent execution. */
  runtime: string;
}

export interface AIProvider {
  id: AIProviderId;
  label: string;
  package: string;
  envVar: string;
  models: AIProviderModels;
  load: (modelId: string) => Promise<LanguageModel>;
}

export interface ModelInfo {
  provider: string;
  modelId: string;
  source: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    package: '@ai-sdk/openai',
    envVar: 'OPENAI_API_KEY',
    models: {
      validation: 'gpt-5-nano',
      generation: 'gpt-5-mini',
      runtime: 'gpt-5-mini',
    },
    load: async (modelId) => {
      const { openai } = await import('@ai-sdk/openai');
      return openai(modelId);
    },
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    package: '@ai-sdk/anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    models: {
      validation: 'claude-haiku-4-5-20251001',
      generation: 'claude-haiku-4-5',
      runtime: 'claude-haiku-4-5',
    },
    load: async (modelId) => {
      const { anthropic } = await import('@ai-sdk/anthropic');
      return anthropic(modelId);
    },
  },
  {
    id: 'google',
    label: 'Google',
    package: '@ai-sdk/google',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    models: {
      validation: 'gemini-2.0-flash',
      generation: 'gemini-3-flash-preview',
      runtime: 'gemini-3-flash-preview',
    },
    load: async (modelId) => {
      const { google } = await import('@ai-sdk/google');
      return google(modelId);
    },
  },
  {
    id: 'xai',
    label: 'xAI',
    package: '@ai-sdk/xai',
    envVar: 'XAI_API_KEY',
    models: {
      validation: 'grok-4-1-fast-non-reasoning',
      generation: 'grok-4-1-fast-reasoning',
      runtime: 'grok-4-1-fast-reasoning',
    },
    load: async (modelId) => {
      const { xai } = await import('@ai-sdk/xai');
      return xai(modelId);
    },
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    package: '@openrouter/ai-sdk-provider',
    envVar: 'OPENROUTER_API_KEY',
    models: {
      validation: 'openai/gpt-5-nano',
      generation: 'openai/gpt-5-mini',
      runtime: 'openai/gpt-5-mini',
    },
    load: async (modelId) => {
      const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
      const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      return openrouter.chat(modelId) as unknown as LanguageModel;
    },
  },
];

/**
 * All env-var names used by AI providers.
 * Used to clear shell-inherited keys before loading an agent's .env,
 * so only the agent's chosen provider is active.
 */
export const AI_PROVIDER_ENV_VARS: string[] = AI_PROVIDERS.map((p) => p.envVar);

export function buildLanguageModel(
  providerId: AIProviderId,
  apiKey: string,
  modelType: keyof AIProviderModels,
): LanguageModel {
  const provider = getProvider(providerId);
  const modelId = provider.models[modelType];

  switch (providerId) {
    case 'openai':
      return createOpenAI({ apiKey })(modelId);
    case 'anthropic':
      return createAnthropic({ apiKey })(modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case 'xai':
      return createXai({ apiKey })(modelId);
    case 'openrouter':
      return createOpenRouter({ apiKey }).chat(modelId) as unknown as LanguageModel;
  }
}

export function getProvider(id: AIProviderId): AIProvider {
  const provider = AI_PROVIDERS.find((p) => p.id === id);
  if (!provider) {
    throw new Error(`Unknown AI provider: ${id}`);
  }
  return provider;
}

export function resolveModelInfo(): ModelInfo {
  const overrideModel = process.env.HIVE_MODEL;
  const agentKeys = getAgentProviderKeys();
  const sortedProviders = [
    ...AI_PROVIDERS.filter((p) => agentKeys.has(p.envVar)),
    ...AI_PROVIDERS.filter((p) => !agentKeys.has(p.envVar)),
  ];

  for (const provider of sortedProviders) {
    const keyValue = process.env[provider.envVar];
    if (keyValue && keyValue.trim().length > 0) {
      const centralProvider = AI_PROVIDERS.find((p) => p.envVar === provider.envVar);
      const runtimeModel = centralProvider?.models.runtime ?? 'unknown';
      const modelId = overrideModel ?? runtimeModel;
      const source = agentKeys.has(provider.envVar) ? '.env' : 'shell';
      return { provider: provider.label, modelId, source };
    }
  }

  return { provider: 'unknown', modelId: 'unknown', source: 'unknown' };
}

async function _loadModelForTier(tier: keyof AIProviderModels): Promise<LanguageModel> {
  const agentKeys = getAgentProviderKeys();
  const sortedProviders = [
    ...AI_PROVIDERS.filter((p) => agentKeys.has(p.envVar)),
    ...AI_PROVIDERS.filter((p) => !agentKeys.has(p.envVar)),
  ];

  for (const provider of sortedProviders) {
    const keyValue = process.env[provider.envVar];
    if (keyValue && keyValue.trim().length > 0) {
      const overrideModel = process.env.HIVE_MODEL;
      const modelId = tier === 'runtime' && overrideModel ? overrideModel : provider.models[tier];
      const model = await provider.load(modelId);
      return model;
    }
  }

  throw new Error(
    'No AI provider API key found in environment. ' +
      'Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, XAI_API_KEY, OPENROUTER_API_KEY',
  );
}

let _screenModelPromise: Promise<LanguageModel> | null = null;

export function getScreenModel(): Promise<LanguageModel> {
  if (_screenModelPromise) {
    return _screenModelPromise;
  }

  _screenModelPromise = _loadModelForTier('validation');
  return _screenModelPromise;
}

export function getModel(): Promise<LanguageModel> {
  if (_modelPromise) {
    return _modelPromise;
  }

  _modelPromise = _loadModelForTier('runtime');
  return _modelPromise;
}

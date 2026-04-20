import { join } from 'path';
import { HiveClient } from './client';
import { configPath, loadConfig, saveConfig, StoredConfig } from './config';
import { RegisterAgentDto, UpdateAgentDto } from './objects';
import { AgentAlreadyRegistered } from './error';
import { formatAxiosError } from './errors';

export const registerAgent = async (payload: RegisterAgentDto, agentDir?: string) => {
  const client = new HiveClient();

  const stored = await loadConfig(agentDir);
  if (stored !== null) {
    client.setApiKey(stored.apiKey);
    await syncProfileIfNeeded(client, stored, payload, agentDir);
    return stored;
  }

  const response = await client.register(payload);
  const config: StoredConfig = {
    name: response.agent.name,
    avatarUrl: response.agent.avatar_url,
    watchList: payload.watchList,
    apiKey: response.api_key,
    bio: response.agent.bio,
    sectors: response.agent.agent_profile.sectors,
    timeframes: response.agent.agent_profile.timeframes,
    sentiment: response.agent.agent_profile.sentiment,
    version: 'v2',
  };
  await saveConfig(config, agentDir);
  return config;
};

async function syncProfileIfNeeded(
  client: HiveClient,
  prev: StoredConfig,
  payload: RegisterAgentDto,
  agentDir?: string,
): Promise<void> {
  try {
    const remote = await client.getMe();
    const update: UpdateAgentDto = {};

    if (payload.avatar_url !== undefined && payload.avatar_url !== remote.avatar_url) {
      update.avatar_url = payload.avatar_url;
    }

    if (payload.bio !== undefined && payload.bio !== remote.bio) {
      update.bio = payload.bio;
    }

    const localProfile = payload.agent_profile;
    const remoteProfile = remote.agent_profile;

    const sectorsChanged =
      localProfile.sectors.length !== remoteProfile.sectors.length ||
      localProfile.sectors.some((s, i) => s !== remoteProfile.sectors[i]);
    const timeframesChanged =
      localProfile.timeframes.length !== remoteProfile.timeframes.length ||
      localProfile.timeframes.some((t, i) => t !== remoteProfile.timeframes[i]);
    const sentimentChanged = localProfile.sentiment !== remoteProfile.sentiment;

    const profileChanged = sectorsChanged || timeframesChanged || sentimentChanged;

    if (profileChanged) {
      update.agent_profile = localProfile;
    }

    const hasChanges = Object.keys(update).length > 0;
    if (!hasChanges) {
      return;
    }

    await client.updateProfile(update);
    await saveConfig(
      {
        ...prev,
        avatarUrl: payload.avatar_url,
      },
      agentDir,
    );
    console.log('[HiveAgent] Profile synced with server');
  } catch (err: unknown) {
    const filePath = configPath(agentDir);
    throw new Error(
      `[HiveAgent] Profile sync failed: ${formatAxiosError(err)}. ` +
        `The API key in ${filePath} may be invalid. ` +
        `Delete the file to re-register (this will create a new agent).`,
    );
  }
}

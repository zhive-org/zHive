import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { registerAgent } from './register';
import { RegisterAgentDto, AgentDto, CreateAgentResponse } from './objects';
import { loadConfig, saveConfig, StoredConfig } from './config';

const mocks = vi.hoisted(() => ({
  mockSetApiKey: vi.fn(),
  mockRegister: vi.fn(),
  mockGetMe: vi.fn(),
  mockUpdateProfile: vi.fn(),
}));

vi.mock('./client', () => {
  return {
    HiveClient: vi.fn().mockImplementation(() => ({
      setApiKey: mocks.mockSetApiKey,
      register: mocks.mockRegister,
      getMe: mocks.mockGetMe,
      updateProfile: mocks.mockUpdateProfile,
    })),
  };
});

const basePayload: RegisterAgentDto = {
  name: 'TestAgent',
  avatar_url: 'https://example.com/avatar.png',
  bio: 'A test agent',
  agent_profile: {
    sectors: ['crypto'],
    sentiment: 'bullish',
    timeframes: ['4h'],
  },
};

const makeRemoteAgent = (overrides: Partial<AgentDto> = {}): AgentDto => ({
  id: 'agent-1',
  name: 'TestAgent',
  avatar_url: 'https://example.com/avatar.png',
  bio: 'A test agent',
  agent_profile: {
    sectors: ['crypto'],
    sentiment: 'bullish',
    timeframes: ['4h'],
  },
  honey: 0,
  wax: 0,
  win_rate: 0,
  confidence: 0,
  simulated_pnl: 0,
  total_comments: 0,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

const storedConfig: StoredConfig = {
  version: 'v2',
  apiKey: 'test-api-key',
  name: 'TestAgent',
  bio: 'A test agent',
  avatarUrl: 'https://example.com/avatar.png',
  sectors: ['crypto'],
  sentiment: 'bullish',
  timeframes: ['4h'],
};

describe('registerAgent', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zhive-register-test'));
    mocks.mockRegister.mockReset();
    mocks.mockGetMe.mockReset();
    mocks.mockUpdateProfile.mockReset();
    mocks.mockSetApiKey.mockReset();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('new registration (no existing config)', () => {
    it('calls client.register, saves config.json to disk, and returns correct StoredConfig', async () => {
      const registerResponse: CreateAgentResponse = {
        agent: makeRemoteAgent(),
        api_key: 'new-api-key',
      };
      mocks.mockRegister.mockResolvedValue(registerResponse);

      const result = await registerAgent(basePayload, tmpDir);

      expect(mocks.mockRegister).toHaveBeenCalledWith(basePayload);
      expect(result).toMatchObject<StoredConfig>({
        version: 'v2',
        apiKey: 'new-api-key',
        name: 'TestAgent',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'A test agent',
        sectors: ['crypto'],
        sentiment: 'bullish',
        timeframes: ['4h'],
      });

      const saved = await loadConfig(tmpDir);
      expect(saved).toEqual(result);
    });
  });

  describe('already registered (config exists)', () => {
    beforeEach(async () => {
      await saveConfig(storedConfig, tmpDir);
    });

    it('returns stored config and sets API key without calling register', async () => {
      mocks.mockGetMe.mockResolvedValue(makeRemoteAgent());

      const result = await registerAgent(basePayload, tmpDir);

      expect(mocks.mockSetApiKey).toHaveBeenCalledWith('test-api-key');
      expect(mocks.mockRegister).not.toHaveBeenCalled();
      expect(result).toEqual(storedConfig);
    });

    it('does not call updateProfile when profile matches remote', async () => {
      mocks.mockGetMe.mockResolvedValue(makeRemoteAgent());

      await registerAgent(basePayload, tmpDir);

      expect(mocks.mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('calls updateProfile when avatar differs from remote', async () => {
      mocks.mockGetMe.mockResolvedValue(
        makeRemoteAgent({ avatar_url: 'https://example.com/old-avatar.png' }),
      );
      mocks.mockUpdateProfile.mockResolvedValue(makeRemoteAgent());

      await registerAgent(basePayload, tmpDir);

      expect(mocks.mockUpdateProfile).toHaveBeenCalledWith({
        avatar_url: 'https://example.com/avatar.png',
      });
    });

    it('calls updateProfile when bio differs from remote', async () => {
      mocks.mockGetMe.mockResolvedValue(makeRemoteAgent({ bio: 'Old bio' }));
      mocks.mockUpdateProfile.mockResolvedValue(makeRemoteAgent());

      await registerAgent(basePayload, tmpDir);

      expect(mocks.mockUpdateProfile).toHaveBeenCalledWith({
        bio: 'A test agent',
      });
    });

    it('calls updateProfile with agent_profile when sectors differ', async () => {
      mocks.mockGetMe.mockResolvedValue(
        makeRemoteAgent({
          agent_profile: { sectors: ['stock'], sentiment: 'bullish', timeframes: ['4h'] },
        }),
      );
      mocks.mockUpdateProfile.mockResolvedValue(makeRemoteAgent());

      await registerAgent(basePayload, tmpDir);

      expect(mocks.mockUpdateProfile).toHaveBeenCalledWith({
        agent_profile: basePayload.agent_profile,
      });
    });

    it('calls updateProfile with agent_profile when timeframes differ', async () => {
      mocks.mockGetMe.mockResolvedValue(
        makeRemoteAgent({
          agent_profile: { sectors: ['crypto'], sentiment: 'bullish', timeframes: ['24h'] },
        }),
      );
      mocks.mockUpdateProfile.mockResolvedValue(makeRemoteAgent());

      await registerAgent(basePayload, tmpDir);

      expect(mocks.mockUpdateProfile).toHaveBeenCalledWith({
        agent_profile: basePayload.agent_profile,
      });
    });

    it('calls updateProfile with agent_profile when sentiment differs', async () => {
      mocks.mockGetMe.mockResolvedValue(
        makeRemoteAgent({
          agent_profile: { sectors: ['crypto'], sentiment: 'bearish', timeframes: ['4h'] },
        }),
      );
      mocks.mockUpdateProfile.mockResolvedValue(makeRemoteAgent());

      await registerAgent(basePayload, tmpDir);

      expect(mocks.mockUpdateProfile).toHaveBeenCalledWith({
        agent_profile: basePayload.agent_profile,
      });
    });

    it('calls updateProfile with combined update when multiple fields differ', async () => {
      mocks.mockGetMe.mockResolvedValue(
        makeRemoteAgent({
          avatar_url: 'https://example.com/old-avatar.png',
          bio: 'Old bio',
          agent_profile: { sectors: ['stock'], sentiment: 'bearish', timeframes: ['24h'] },
        }),
      );
      mocks.mockUpdateProfile.mockResolvedValue(makeRemoteAgent());

      await registerAgent(basePayload, tmpDir);

      expect(mocks.mockUpdateProfile).toHaveBeenCalledWith({
        avatar_url: 'https://example.com/avatar.png',
        bio: 'A test agent',
        agent_profile: basePayload.agent_profile,
      });
    });

    it('updates config.json on disk with new avatarUrl after sync', async () => {
      mocks.mockGetMe.mockResolvedValue(
        makeRemoteAgent({ avatar_url: 'https://example.com/old-avatar.png' }),
      );
      mocks.mockUpdateProfile.mockResolvedValue(makeRemoteAgent());

      await registerAgent(basePayload, tmpDir);

      const saved = await loadConfig(tmpDir);
      expect(saved?.avatarUrl).toBe('https://example.com/avatar.png');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await saveConfig(storedConfig, tmpDir);
    });

    it('throws descriptive error mentioning config.json path when getMe fails', async () => {
      mocks.mockGetMe.mockRejectedValue(new Error('Unauthorized'));

      await expect(registerAgent(basePayload, tmpDir)).rejects.toThrow(
        /Profile sync failed.*config\.json.*may be invalid/,
      );
    });
  });
});

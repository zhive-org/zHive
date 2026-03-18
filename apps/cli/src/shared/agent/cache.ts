import { SystemModelMessage } from 'ai';

export function cacheableSystem(content: string): SystemModelMessage {
  const message: SystemModelMessage = {
    role: 'system',
    content,
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
  };
  return message;
}

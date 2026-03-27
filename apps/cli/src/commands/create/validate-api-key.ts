import { generateText } from 'ai';
import { buildLanguageModel, type AIProviderId } from '../../shared/config/ai-providers';
import { extractErrorMessage } from '../../shared/agent/utils';

/**
 * Make a lightweight test call to validate the user's API key.
 * Returns true if the key works, or an error message string on failure.
 */
export async function validateApiKey(
  providerId: AIProviderId,
  apiKey: string,
): Promise<true | string> {
  try {
    const model = buildLanguageModel(providerId, apiKey, 'validation');

    await generateText({
      model,
      prompt: 'Say "ok"',
      maxOutputTokens: 16,
    });

    return true;
  } catch (err: unknown) {
    const message = extractErrorMessage(err);

    if (
      message.includes('401') ||
      message.includes('Unauthorized') ||
      message.includes('invalid')
    ) {
      return 'Invalid API key. Please check and try again.';
    }

    return `API validation failed: ${message.slice(0, 120)}`;
  }
}

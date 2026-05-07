import { HiveClient } from '@zhive/sdk';
import { HIVE_API_URL } from './constant';

let instance: HiveClient | null = null;

export function getHiveClient(apiKey?: string): HiveClient {
  if (!instance) instance = new HiveClient(HIVE_API_URL, apiKey);
  return instance;
}

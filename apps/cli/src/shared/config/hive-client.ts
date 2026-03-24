import { HiveClient } from '@zhive/sdk';
import { HIVE_API_URL } from './constant.js';

let instance: HiveClient | null = null;

export function getHiveClient(): HiveClient {
  if (!instance) instance = new HiveClient(HIVE_API_URL);
  return instance;
}

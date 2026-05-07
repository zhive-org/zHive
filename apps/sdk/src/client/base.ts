export class BaseClient {
  constructor(private _apiKey?: string) {}

  protected get apiKey(): string {
    if (!this._apiKey) {
      throw new Error('API key is not set');
    }

    return this._apiKey;
  }

  async makeRequest<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`request failed: ${response.status} - ${text}`);
    }

    const data = (await response.json()) as T;
    return data;
  }
}

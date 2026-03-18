import axios, { AxiosError } from 'axios';

export function formatAxiosError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ message?: string; error?: string }>;
    const status = axiosErr.response?.status ?? 'no response';
    const body = axiosErr.response?.data;
    const detail = body?.message ?? body?.error ?? axiosErr.message;
    return `${status} — ${detail}`;
  }
  return error instanceof Error ? error.message : String(error);
}

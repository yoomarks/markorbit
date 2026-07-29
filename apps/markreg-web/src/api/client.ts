/// <reference types="vite/client" />
import type { SafeError } from '@markorbit/contracts';
import { MarkregApiError, safeErrorMessage } from './errors.js';

export interface ApiClient {
  post<T>(path: string, body: unknown, headers: Record<string, string>): Promise<T>;
  get<T>(path: string): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
}

export function createApiClient(
  baseUrl: string = (import.meta.env['VITE_MARKREG_GATEWAY_URL'] as string | undefined) ??
    'http://127.0.0.1:4000',
  timeoutMs = 10_000,
  fetcher: typeof fetch = fetch
): ApiClient {
  const request = async <T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`${baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal
      });
      const value = (await response.json()) as T | SafeError;
      if (!response.ok) throw safeErrorMessage(response.status, value as SafeError);
      return value as T;
    } catch (error) {
      if (error instanceof MarkregApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError')
        throw new MarkregApiError(
          'recoverable',
          'The request took too long. Your answers are safe; try again.'
        );
      throw new MarkregApiError(
        typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'recoverable',
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'You are offline. Reconnect before trying again.'
          : 'We could not reach the service. Your answers are safe; try again.'
      );
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    post: <T>(path: string, body: unknown, headers: Record<string, string>) =>
      request<T>('POST', path, body, headers),
    get: <T>(path: string) => request<T>('GET', path),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body)
  };
}

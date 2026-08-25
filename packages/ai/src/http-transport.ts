export type AiHttpTransportDeliveryState =
  | 'NOT_DELIVERED'
  | 'DELIVERED_CONFIRMED'
  | 'DELIVERY_UNCERTAIN';

export type AiHttpTransportRequest = {
  url: string;
  headers: Readonly<Record<string, string>>;
  body: string;
  timeoutMs: number;
  maxResponseBytes: number;
};

export type AiHttpTransportResponse = {
  status: number;
  body: Uint8Array;
  headers?: Readonly<Record<string, string>>;
};

export type AiHttpTransport = (
  request: Readonly<AiHttpTransportRequest>,
) => Promise<AiHttpTransportResponse>;

export class AiHttpTransportError extends Error {
  constructor(
    readonly code: 'AI_HTTP_TIMEOUT' | 'AI_HTTP_NETWORK_ERROR' | 'AI_HTTP_RESPONSE_TOO_LARGE',
    message: string,
    readonly deliveryState: AiHttpTransportDeliveryState,
  ) {
    super(message);
    this.name = 'AiHttpTransportError';
  }
}

export async function fetchAiHttpTransport(
  request: Readonly<AiHttpTransportRequest>,
): Promise<AiHttpTransportResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
      redirect: 'error',
    });
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        size += result.value.byteLength;
        if (size > request.maxResponseBytes) {
          await reader.cancel();
          throw new AiHttpTransportError(
            'AI_HTTP_RESPONSE_TOO_LARGE',
            'AI provider response exceeded the configured byte limit.',
            'DELIVERED_CONFIRMED',
          );
        }
        chunks.push(result.value);
      }
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { status: response.status, body };
  } catch (error) {
    if (error instanceof AiHttpTransportError) throw error;
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new AiHttpTransportError(
      aborted ? 'AI_HTTP_TIMEOUT' : 'AI_HTTP_NETWORK_ERROR',
      aborted ? 'AI provider request timed out.' : 'AI provider request failed.',
      'DELIVERY_UNCERTAIN',
    );
  } finally {
    clearTimeout(timeout);
  }
}

import { createServer, type Server } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ServiceManifest {
  name: string;
  port: number;
  version: string;
}
export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
}
export interface JsonRequest {
  body: unknown;
  headers: Readonly<Record<string, string | undefined>>;
  method: string;
  path: string;
}
export interface JsonResult {
  status: number;
  body: unknown;
  headers?: Readonly<Record<string, string>>;
}
export interface JsonRoute {
  method: 'POST';
  path: string;
  handle(request: JsonRequest): Promise<JsonResult> | JsonResult;
}
export interface ServiceRuntime {
  readonly manifest: ServiceManifest;
  readonly isRunning: boolean;
  readonly listeningPort: number | undefined;
  start(): Promise<void>;
  stop(): Promise<void>;
}
export interface RuntimeOptions {
  routes?: readonly JsonRoute[];
  bodyLimitBytes?: number;
}
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
export function createHealthResponse(manifest: ServiceManifest): HealthResponse {
  return { status: 'ok', service: manifest.name, version: manifest.version };
}
export function json(
  status: number,
  body: unknown,
  headers?: Readonly<Record<string, string>>
): JsonResult {
  return headers ? { status, body, headers } : { status, body };
}
function correlation(request: IncomingMessage): string {
  const value = request.headers['x-correlation-id'];
  return typeof value === 'string' && value.length > 0 ? value : 'correlation_unknown';
}
function send(response: ServerResponse, result: JsonResult): void {
  response.writeHead(result.status, {
    'content-type': 'application/json; charset=utf-8',
    ...result.headers
  });
  response.end(JSON.stringify(result.body));
}
async function readBody(request: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > limit)
      throw new HttpError(400, 'INVALID_REQUEST', 'Request body exceeds the size limit.');
    chunks.push(buffer);
  }
  if (size === 0) throw new HttpError(400, 'INVALID_REQUEST', 'A JSON request body is required.');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be valid JSON.');
  }
}
export function createServiceRuntime(
  manifest: ServiceManifest,
  options: RuntimeOptions = {}
): ServiceRuntime {
  let server: Server | undefined;
  let listeningPort: number | undefined;
  const routes = options.routes ?? [];
  const limit = options.bodyLimitBytes ?? 64 * 1024;
  return {
    manifest: Object.freeze({ ...manifest }),
    get isRunning() {
      return server?.listening === true;
    },
    get listeningPort() {
      return listeningPort;
    },
    async start() {
      if (server?.listening) return;
      const nextServer = createServer((request, response) => {
        void (async () => {
          const path = new URL(request.url ?? '/', 'http://localhost').pathname;
          if (path === '/health') {
            if (request.method !== 'GET')
              throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
            send(response, json(200, createHealthResponse(manifest)));
            return;
          }
          const pathRoutes = routes.filter((route) => route.path === path);
          if (pathRoutes.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Route not found.');
          const route = pathRoutes.find((candidate) => candidate.method === request.method);
          if (!route) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
          const body = await readBody(request, limit);
          const headers: Record<string, string | undefined> = {};
          for (const [key, value] of Object.entries(request.headers))
            headers[key] = Array.isArray(value) ? value[0] : value;
          send(response, await route.handle({ body, headers, method: request.method ?? '', path }));
        })().catch((error: unknown) => {
          if (response.headersSent) return;
          const safe =
            error instanceof HttpError
              ? error
              : new HttpError(500, 'INTERNAL_ERROR', 'An internal error occurred.', false);
          send(
            response,
            json(safe.status, {
              code: safe.code,
              message: safe.message,
              correlationId: correlation(request),
              retryable: safe.retryable
            })
          );
        });
      });
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          nextServer.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          nextServer.off('error', onError);
          resolve();
        };
        nextServer.once('error', onError);
        nextServer.once('listening', onListening);
        nextServer.listen(manifest.port, '127.0.0.1');
      });
      server = nextServer;
      const address = server.address();
      listeningPort = typeof address === 'object' && address ? address.port : manifest.port;
    },
    async stop() {
      const active = server;
      server = undefined;
      listeningPort = undefined;
      if (!active) return;
      await new Promise<void>((resolve, reject) =>
        active.close((error) => (error ? reject(error) : resolve()))
      );
    }
  };
}

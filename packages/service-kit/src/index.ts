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
  params: Readonly<Record<string, string>>;
  query: Readonly<Record<string, string>>;
}
export interface JsonResult {
  status: number;
  body: unknown;
  headers?: Readonly<Record<string, string>>;
}
export interface JsonRoute {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  bodyLimitBytes?: number;
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
    readonly retryable = false,
    readonly details?: Readonly<Record<string, unknown>>
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
function corsOrigin(request: IncomingMessage): string | undefined {
  const origin = request.headers.origin;
  if (!origin) return undefined;
  const allowed = (process.env['WEB_ORIGINS'] ?? '').split(',').filter(Boolean);
  return allowed.includes(origin) ? origin : undefined;
}
function send(request: IncomingMessage, response: ServerResponse, result: JsonResult): void {
  const origin = corsOrigin(request);
  response.writeHead(result.status, {
    'content-type': 'application/json; charset=utf-8',
    ...(origin
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          vary: 'Origin',
          'access-control-allow-headers':
            'content-type, idempotency-key, x-correlation-id, x-markorbit-csrf-token, x-markorbit-workspace-id',
          'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS'
        }
      : {}),
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
          const requestUrl = new URL(request.url ?? '/', 'http://localhost');
          const path = requestUrl.pathname;
          if (request.method === 'OPTIONS') {
            const origin = corsOrigin(request);
            if (!origin) throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed.');
            response.writeHead(204, {
              'access-control-allow-origin': origin,
              'access-control-allow-credentials': 'true',
              vary: 'Origin',
              'access-control-allow-headers':
                'content-type, idempotency-key, x-correlation-id, x-markorbit-csrf-token, x-markorbit-workspace-id',
              'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS'
            });
            response.end();
            return;
          }
          if (path === '/health') {
            if (request.method !== 'GET')
              throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
            send(request, response, json(200, createHealthResponse(manifest)));
            return;
          }
          const matches = (template: string) => {
            const names: string[] = [];
            const expression = template.replace(/:[^/]+/g, (part) => {
              names.push(part.slice(1));
              return '([^/]+)';
            });
            const match = path.match(new RegExp(`^${expression}$`));
            return match
              ? Object.fromEntries(
                  names.map((name, index) => [name, decodeURIComponent(match[index + 1]!)])
                )
              : undefined;
          };
          const pathRoutes = routes.flatMap((route) => {
            const params = matches(route.path);
            return params ? [{ route, params }] : [];
          });
          if (pathRoutes.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Route not found.');
          const matched = pathRoutes.find((candidate) => candidate.route.method === request.method);
          if (!matched) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
          const contentType = request.headers['content-type'];
          if (
            request.method !== 'GET' &&
            (typeof contentType !== 'string' ||
              contentType.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json')
          )
            throw new HttpError(400, 'INVALID_REQUEST', 'Content-Type must be application/json.');
          const body =
            request.method === 'GET'
              ? undefined
              : await readBody(request, matched.route.bodyLimitBytes ?? limit);
          const headers: Record<string, string | undefined> = {};
          for (const [key, value] of Object.entries(request.headers))
            headers[key] = Array.isArray(value) ? value[0] : value;
          send(
            request,
            response,
            await matched.route.handle({
              body,
              headers,
              method: request.method ?? '',
              path,
              params: matched.params,
              query: Object.fromEntries(requestUrl.searchParams)
            })
          );
        })().catch((error: unknown) => {
          if (response.headersSent) return;
          const safe =
            error instanceof HttpError
              ? error
              : new HttpError(500, 'INTERNAL_ERROR', 'An internal error occurred.', false);
          send(
            request,
            response,
            json(safe.status, {
              code: safe.code,
              message: safe.message,
              correlationId: correlation(request),
              retryable: safe.retryable,
              ...(safe.details ? { details: safe.details } : {})
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

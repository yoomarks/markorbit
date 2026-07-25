import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

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

export interface ServiceRuntime {
  readonly manifest: ServiceManifest;
  readonly isRunning: boolean;
  readonly listeningPort: number | undefined;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createHealthResponse(manifest: ServiceManifest): HealthResponse {
  return { status: 'ok', service: manifest.name, version: manifest.version };
}

export function createServiceRuntime(manifest: ServiceManifest): ServiceRuntime {
  let server: Server | undefined;
  let listeningPort: number | undefined;

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
        if (request.url === '/health' && request.method === 'GET') {
          response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify(createHealthResponse(manifest)));
          return;
        }

        response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ code: 'NOT_FOUND', message: 'Route not found.' }));
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
      listeningPort =
        typeof address === 'object' && address ? (address as AddressInfo).port : manifest.port;
    },
    async stop() {
      const activeServer = server;
      server = undefined;
      listeningPort = undefined;
      if (!activeServer) return;

      await new Promise<void>((resolve, reject) => {
        activeServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

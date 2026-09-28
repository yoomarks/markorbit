/* eslint-disable @typescript-eslint/no-unsafe-assignment -- MIME lookup is a bounded local string map in this dependency-free preview server. */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.WORKSPACE_PREVIEW_PORT ?? 4178);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = normalize(join(root, relative));
  if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'content-type': mime[extname(target)] ?? 'application/octet-stream',
    'cache-control': 'no-store'
  });
  createReadStream(target).pipe(response);
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Workspace Console preview: http://127.0.0.1:${port}/\n`);
});

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('.', import.meta.url).pathname.replace(/^\/(.:)/u, '$1');
const port = Number(process.env.PORT || 4208);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

createServer(async (request, response) => {
  const pathname = request.url?.split('?')[0] || '/';
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(root, requested));
  if (!file.startsWith(normalize(root))) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    response
      .writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' })
      .end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`Workspace Console V2 Preview: http://127.0.0.1:${port}`)
);

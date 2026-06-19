import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('./dist/', import.meta.url);
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const target = new URL(pathname === '/' ? './index.html' : `.${pathname}`, root);

    if (!fileURLToPath(target).startsWith(fileURLToPath(root))) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const info = await stat(target);
    const fileUrl = info.isDirectory() ? new URL('./index.html', target) : target;
    const body = await readFile(fileUrl);
    response.writeHead(200, {
      'Content-Type': types[extname(fileURLToPath(fileUrl))] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Nutcracker Nightwatch is running at http://${host}:${port}/`);
});

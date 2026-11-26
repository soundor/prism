import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Serve the built plugin, including the WASM and audio worklet modules.
const rootUrl = new URL('../.soundor/dist/web/', import.meta.url);
const root = fileURLToPath(rootUrl);
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const path = fileURLToPath(
      new URL(`.${url.pathname === '/' ? '/index.html' : url.pathname}`, rootUrl),
    );
    if (!path.startsWith(root)) {
      response.writeHead(404).end();
      return;
    }

    const body = await readFile(path);
    response
      .writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' })
      .end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(4174, '127.0.0.1');

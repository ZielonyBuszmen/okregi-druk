import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function createServer(root = fileURLToPath(new URL('../dist/', import.meta.url))) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
  };
  return http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const target = path.resolve(
        root,
        `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`,
      );
      if (target !== root && !target.startsWith(`${path.resolve(root)}${path.sep}`))
        throw new Error('path');
      if (!(await stat(target)).isFile()) throw new Error('missing');
      res.writeHead(200, {
        'Content-Type': types[path.extname(target)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(await readFile(target));
    } catch {
      res.writeHead(404);
      res.end('Nie znaleziono pliku.');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.OKREGI_PORT || 4173);
  createServer().listen(port, '0.0.0.0', () => console.log(`Aplikacja: http://localhost:${port}`));
}

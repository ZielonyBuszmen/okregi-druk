import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, 'web'), dist, { recursive: true });
await cp(path.join(root, 'config.json'), path.join(dist, 'config.json'));
await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`Gotowa aplikacja: ${dist}`);

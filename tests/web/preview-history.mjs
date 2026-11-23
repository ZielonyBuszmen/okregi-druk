import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function archivePreview(root, name, project, ui = {}) {
  const history = path.join(root, 'output/history');
  await mkdir(history, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(/[-:.]/g, '');
  await copyFile(path.join(root, `output/${name}.png`), path.join(history, `${stamp}-${name}.png`));
  await writeFile(
    path.join(history, `${stamp}-${name}.json`),
    JSON.stringify({ kind: name, project, ui }, null, 2),
  );
}

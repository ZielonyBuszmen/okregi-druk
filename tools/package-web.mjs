import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import './build-web.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const entries = {};
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(full);
    else if (entry.isFile())
      entries[path.relative(dist, full).split(path.sep).join('/')] = new Uint8Array(
        await readFile(full),
      );
  }
}
await collect(dist);
entries['START.txt'] = strToU8(
  'Okręgi — statyczna aplikacja HTML/CSS/JavaScript.\n\nRozpakuj wszystkie pliki, zachowując katalogi assets i vendor.\nOtwieraj aplikację przez serwer HTTP albo GitHub Pages, nie przez file://.\nconfig.json zawiera ustawienia początkowe.\nProjekty zapisują się w przeglądarce i można je pobrać jako JSON.\nDruk PDF: 100% / rzeczywisty rozmiar, bez dopasowania do strony.\n',
);
const archive = zipSync(entries, { level: 6 });
const unpacked = unzipSync(archive);
for (const [name, bytes] of Object.entries(entries)) {
  if (Buffer.compare(bytes, unpacked[name]) !== 0) throw new Error(`Błąd kontroli ZIP: ${name}`);
}
await mkdir(path.join(root, 'output'), { recursive: true });
const target = path.join(root, 'output/okregi-aplikacja-web.zip');
await writeFile(target, archive);
console.log(`Gotowa paczka ZIP: ${target} (${archive.length} bajtów).`);

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSession, saveSession } from '../../web/storage.js';

const defaults = JSON.parse(await readFile(new URL('../../config.json', import.meta.url)));
const key = 'okregi-project-v1:/etykiety/';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
  };
}

test('Przy pierwszym otwarciu są ustawienia początkowe', () => {
  const saved = loadSession(memoryStorage(), key, defaults);
  assert.equal(saved.restored, false);
  assert.deepEqual(saved.project, defaults);
  saved.project.rows[0].text = 'NOWY';
  assert.equal(defaults.rows[0].text, 'PREZES');
});

test('Powrót odtwarza teksty, kopie, kolory, średnicę i obraz', () => {
  const storage = memoryStorage(),
    project = structuredClone(defaults);
  project.top = 'MOJE KOŁO';
  project.diameterMm = 40;
  project.rows[0].copies = 3;
  project.rows[0].decoration = 'custom';
  project.rows[0].image = 'data:image/png;base64,YQ==';
  project.style.color = '#112233';
  assert.equal(
    saveSession(storage, key, project, {
      selectedIndex: 2,
      view: 'sheet',
      openSections: ['layout-options'],
    }).saved,
    true,
  );
  const saved = loadSession(storage, key, defaults);
  assert.deepEqual(saved.project, project);
  assert.equal(saved.ui.selectedIndex, 2);
  assert.equal(saved.ui.view, 'sheet');
  assert.deepEqual(saved.ui.openSections, ['layout-options']);
  assert.equal(saved.restored, true);
});

test('Niekompletny projekt również jest zapamiętany', () => {
  const storage = memoryStorage(),
    project = structuredClone(defaults);
  project.rows[0].text = '';
  project.style.fontMm = 0;
  const ui = { rawInputs: { diameterMm: '', 'row-1': '' } };
  assert.equal(saveSession(storage, key, project, ui).saved, true);
  const saved = loadSession(storage, key, defaults);
  assert.equal(saved.project.rows[0].text, '');
  assert.equal(saved.project.style.fontMm, 0);
  assert.deepEqual(saved.ui.rawInputs, ui.rawInputs);
});

test('Poprzedni zapis samych ustawień nadal się otwiera', () => {
  const storage = memoryStorage();
  storage.setItem(key, JSON.stringify(defaults));
  const saved = loadSession(storage, key, defaults);
  assert.equal(saved.restored, true);
  assert.deepEqual(saved.project, defaults);
});

test('Uszkodzony zapis i niebezpieczny adres obrazka nie blokują aplikacji', () => {
  const storage = memoryStorage();
  storage.setItem(key, '{');
  assert.ok(loadSession(storage, key, defaults).error);
  const project = structuredClone(defaults);
  project.rows[0].image = 'https://example.com/image.png';
  storage.setItem(key, JSON.stringify(project));
  const saved = loadSession(storage, key, defaults);
  assert.ok(saved.error);
  assert.deepEqual(saved.project, defaults);
});

test('Brak miejsca nie jest zgłaszany jako udany zapis', () => {
  const storage = {
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  const result = saveSession(storage, key, defaults, {});
  assert.equal(result.saved, false);
  assert.match(result.error, /do pliku/);
});

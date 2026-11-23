import { parseProject, calculateLayout, fitColumns, resizeDiameter, projectKey } from './model.js';
import { renderLabel, renderSheet, drawDecoration, loadImages } from './renderer.js';
import { download, pngWithDpi, makePdf } from './export.js';
import { loadSession, saveSession } from './storage.js';

const getElement = (selector) => document.querySelector(selector);
const editor = getElement('#editor');
const storageKey = `okregi-project-v1:${location.pathname}`;
// Ustawienia są osobne dla każdej aplikacji w danym katalogu GitHub Pages.
const browserStorage = getBrowserStorage();
let project,
  defaultConfig,
  currentPreview = null,
  selectedIndex = 0,
  view = 'label',
  generation = 0,
  previewTimer,
  exportInProgress = false;
const invalidFields = new Set();
const invalidInputValues = new Map();

function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function persistSession() {
  if (!project) return;
  const ui = {
    selectedIndex,
    view,
    rawInputs: Object.fromEntries(invalidInputValues),
    openSections: [...editor.querySelectorAll('details[id][open]')].map((section) => section.id),
  };
  const result = saveSession(browserStorage, storageKey, project, ui);
  getElement('#storage-status').textContent = result.saved
    ? 'Ustawienia zapisane automatycznie. Po powrocie do tej strony wrócisz do swojego projektu.'
    : result.error;
  getElement('#storage-status').classList.toggle('error', !result.saved);
}

function restoreUiState(ui) {
  selectedIndex = ui.selectedIndex;
  view = ui.view;
  if (ui.openSections !== null) {
    for (const section of editor.querySelectorAll('details[id]')) {
      section.open = ui.openSections.includes(section.id);
    }
  }
  for (const [name, value] of Object.entries(ui.rawInputs)) {
    const rowMatch = /^row-(\d+)$/.exec(name);
    const input = rowMatch
      ? editor.querySelector(`[data-row-index="${Number(rowMatch[1])}"][data-row-field="copies"]`)
      : editor.querySelector(`[data-field="${CSS.escape(name)}"]`);
    if (input) {
      input.value = value;
      invalidFields.add(name);
      invalidInputValues.set(name, value);
    }
  }
}

function notice(message, error = false) {
  getElement('#notice').textContent = message;
  getElement('#notice').hidden = !message;
  getElement('#notice').classList.toggle('error', error);
}

function circles(count) {
  if (count === 1) return '1 koło';
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) {
    return `${count} koła`;
  }
  return `${count} kół`;
}

function byPath(object, path) {
  return path.split('.').reduce((item, key) => item[key], object);
}
function setPath(object, path, value) {
  const keys = path.split('.');
  const key = keys.pop();
  keys.reduce((item, name) => item[name], object)[key] = value;
}

function syncFields() {
  for (const input of editor.querySelectorAll('[data-field]')) {
    const value = byPath(project, input.dataset.field);
    if (input.type === 'checkbox') input.checked = value;
    else input.value = typeof value === 'number' ? Number(value.toFixed(3)) : value;
  }
  editor.querySelector(`[name=mode][value=${project.mode}]`).checked = true;
  getElement('#number-fields').hidden = project.mode !== 'numbers';
  getElement('#text-fields').hidden = project.mode !== 'text';
  getElement('#rod-size-value').textContent =
    `${project.style.rodsScale.toLocaleString('pl-PL')} razy`;
}

function thumbnail(canvas, decoration) {
  canvas.width = 130;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.translate(65, 40);
  ctx.scale(9, 9);
  if (decoration === 'none') {
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, 2 * Math.PI);
    ctx.strokeStyle = '#acb7c8';
    ctx.lineWidth = 0.14;
    ctx.stroke();
  } else drawDecoration(ctx, decoration, project.style);
}

function renderRows() {
  getElement('#text-rows').replaceChildren();
  project.rows.forEach((row, index) => {
    const card = document.createElement('div');
    card.className = 'text-row';
    card.innerHTML = `
      <div class="row-heading">
        <strong></strong>
        <button type="button" class="remove-row">Usuń ten wzór</button>
      </div>
      <label class="row-text-label">Napis w środku koła</label>
      <textarea data-row-field="text" rows="2" maxlength="200"></textarea>
      <div class="row-settings">
        <div class="copies-field">
          <label>Liczba kopii
            <input type="number" min="1" max="100" step="1" data-row-field="copies">
          </label>
        </div>
        <div class="row-ornaments">
          <p class="field-label">Wybierz ozdobę</p>
          <div class="decoration-options" role="group" aria-label="Wybierz ozdobę"></div>
          <button type="button" class="upload-control">Wybierz własny obraz</button>
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden>
          <p class="custom-status" hidden></p>
        </div>
      </div>`;
    card.querySelector('strong').textContent = `Wzór ${index + 1}`;
    const textarea = card.querySelector('textarea');
    textarea.value = row.text;
    textarea.setAttribute('aria-label', `Tekst wzoru ${index + 1}`);
    textarea.id = `row-text-${index}`;
    card.querySelector('.row-text-label').htmlFor = textarea.id;
    for (const input of card.querySelectorAll('[data-row-field]')) input.dataset.rowIndex = index;
    card.querySelector('[data-row-field=copies]').value = row.copies;
    if (invalidInputValues.has(`row-${index}`)) {
      card.querySelector('[data-row-field=copies]').value = invalidInputValues.get(`row-${index}`);
    }
    const remove = card.querySelector('.remove-row');
    remove.disabled = project.rows.length === 1;
    remove.setAttribute('aria-label', `Usuń wzór ${index + 1}`);
    remove.addEventListener('click', () => removeRow(index));
    for (const [kind, title] of [
      ['none', 'Brak'],
      ['coins', 'Monety'],
      ['fishing', 'Wędki'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'decoration-choice';
      button.dataset.decoration = kind;
      button.setAttribute('aria-pressed', String(row.decoration === kind));
      button.classList.toggle('active', row.decoration === kind);
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      thumbnail(canvas, kind);
      button.append(canvas, document.createTextNode(title));
      button.addEventListener('click', () => {
        row.decoration = kind;
        renderRows();
        invalidate();
      });
      card.querySelector('.decoration-options').append(button);
    }
    const upload = card.querySelector('input[type=file]');
    card.querySelector('.upload-control').addEventListener('click', () => upload.click());
    upload.setAttribute('aria-label', `Własna ozdoba dla wzoru ${index + 1}`);
    upload.addEventListener('change', async () => {
      const file = upload.files[0];
      if (!file) return;
      try {
        if (
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
          file.size > 2 * 1024 * 1024
        )
          throw new Error('Wybierz PNG, JPG lub WEBP o rozmiarze do 2 MB.');
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
          reader.readAsDataURL(file);
        });
        const candidate = structuredClone(project);
        candidate.rows[index].image = data;
        candidate.rows[index].decoration = 'custom';
        await loadImages(candidate);
        row.image = data;
        row.imageName = file.name;
        row.decoration = 'custom';
        renderRows();
        invalidate();
        notice('Dodano własną ozdobę. Obraz pozostaje w przeglądarce.');
      } catch (error) {
        notice(error.message, true);
      }
    });
    if (row.decoration === 'custom') {
      const status = card.querySelector('.custom-status');
      status.hidden = false;
      status.textContent = `Wybrany obraz: ${row.imageName || 'własna ozdoba'}`;
    }
    getElement('#text-rows').append(card);
  });
}

function removeRow(removedIndex) {
  project.rows.splice(removedIndex, 1);
  const pendingCopies = [...invalidInputValues].filter(([name]) => /^row-\d+$/.test(name));
  for (const [name] of pendingCopies) {
    invalidFields.delete(name);
    invalidInputValues.delete(name);
  }
  for (const [name, value] of pendingCopies) {
    const index = Number(name.slice(4));
    if (index === removedIndex) continue;
    const newName = `row-${index > removedIndex ? index - 1 : index}`;
    invalidFields.add(newName);
    invalidInputValues.set(newName, value);
  }
  renderRows();
  invalidate();
}

function setCanvas(source) {
  const target = getElement('#preview-canvas');
  target.width = source.width;
  target.height = source.height;
  target.getContext('2d').drawImage(source, 0, 0);
  target.setAttribute(
    'aria-label',
    view === 'sheet'
      ? 'Podgląd całego arkusza A4'
      : `Podgląd: ${currentPreview.layout.labels[selectedIndex].text.replaceAll('\n', ' ')}`,
  );
}

function displayPreview() {
  if (!currentPreview) return;
  selectedIndex = Math.max(0, Math.min(selectedIndex, currentPreview.layout.labels.length - 1));
  setCanvas(
    view === 'sheet'
      ? currentPreview.sheet
      : renderLabel(
          currentPreview.project,
          currentPreview.layout.labels[selectedIndex],
          currentPreview.images,
        ),
  );
  getElement('#preview-stage').classList.toggle('sheet', view === 'sheet');
  for (const [id, name] of [
    ['#view-label', 'label'],
    ['#view-sheet', 'sheet'],
  ]) {
    getElement(id).classList.toggle('active', view === name);
    getElement(id).setAttribute('aria-pressed', String(view === name));
  }
}

function invalidate() {
  generation++;
  currentPreview = null;
  getElement('#approve').checked = false;
  getElement('#approve').disabled = true;
  getElement('#download-png').disabled = true;
  getElement('#download-pdf').disabled = true;
  getElement('#loading').hidden = false;
  getElement('#export-status').textContent = '';
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 180);
  // Zapis jest synchroniczny: nie czeka na podgląd ani poprawność układu.
  persistSession();
}

async function updatePreview() {
  const id = ++generation;
  try {
    if (invalidFields.size) throw new Error('Uzupełnij prawidłową liczbę w edytowanym polu.');
    const snapshot = structuredClone(project);
    const layout = calculateLayout(snapshot),
      images = await loadImages(snapshot);
    const sheet = renderSheet(snapshot, layout, images);
    if (id !== generation) return;
    currentPreview = { project: snapshot, key: projectKey(snapshot), layout, images, sheet };
    selectedIndex = Math.min(selectedIndex, layout.labels.length - 1);
    getElement('#preview-select').replaceChildren(
      ...layout.labels.map((label, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent =
          snapshot.mode === 'numbers'
            ? label.text
            : `${label.text.replaceAll('\n', ' ')} · ${i + 1}`;
        return option;
      }),
    );
    getElement('#preview-select').value = selectedIndex;
    displayPreview();
    getElement('#diameter-label').textContent = `${Number(snapshot.diameterMm.toFixed(2))} mm`;
    getElement('#count-label').textContent =
      `${circles(layout.labels.length)} · ${layout.columns} × ${layout.rows} · A4`;
    getElement('#preview-error').hidden = true;
    getElement('#preview-stage').classList.remove('invalid');
    getElement('#approve').disabled = false;
    getElement('#download-png').disabled = false;
  } catch (error) {
    if (id !== generation) return;
    currentPreview = null;
    getElement('#preview-error').hidden = false;
    getElement('#preview-error').textContent = error.message;
    getElement('#preview-stage').classList.add('invalid');
    getElement('#approve').checked = false;
    getElement('#approve').disabled = true;
    getElement('#download-png').disabled = true;
    getElement('#download-pdf').disabled = true;
  } finally {
    if (id === generation) getElement('#loading').hidden = true;
  }
}

function resetEditor() {
  invalidFields.clear();
  invalidInputValues.clear();
  selectedIndex = 0;
  syncFields();
  renderRows();
  invalidate();
}

editor.addEventListener('submit', (event) => event.preventDefault());
editor.addEventListener('input', (event) => {
  const input = event.target;
  if (input.dataset.rowField) {
    const key = input.dataset.rowField,
      index = Number(input.dataset.rowIndex);
    const value = key === 'copies' ? input.valueAsNumber : input.value;
    if (typeof value === 'number' && !Number.isFinite(value)) {
      invalidFields.add(`row-${index}`);
      invalidInputValues.set(`row-${index}`, input.value);
    } else {
      invalidFields.delete(`row-${index}`);
      invalidInputValues.delete(`row-${index}`);
      project.rows[index][key] = value;
    }
    invalidate();
    return;
  }
  const field = input.dataset.field;
  if (!field) return;
  const value =
    input.type === 'checkbox'
      ? input.checked
      : ['number', 'range'].includes(input.type)
        ? input.valueAsNumber
        : input.value;
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) || (field === 'diameterMm' && (value < 8 || value > 120)))
  ) {
    invalidFields.add(field);
    invalidInputValues.set(field, input.value);
    invalidate();
    return;
  }
  invalidFields.delete(field);
  invalidInputValues.delete(field);
  if (field === 'diameterMm') {
    project = resizeDiameter(project, value);
    for (const other of editor.querySelectorAll('[data-field^="style."]')) {
      const v = byPath(project, other.dataset.field);
      if (typeof v === 'number') other.value = Number(v.toFixed(3));
    }
    project.layout.columns = fitColumns(project);
    getElement('#columns').value = project.layout.columns;
  } else setPath(project, field, value);
  if (field === 'style.color' || field === 'style.accent' || field === 'style.rodsScale')
    renderRows();
  if (field === 'style.rodsScale')
    getElement('#rod-size-value').textContent = `${value.toLocaleString('pl-PL')} razy`;
  invalidate();
});

editor.addEventListener('change', (event) => {
  if (event.target.name !== 'mode') return;
  project.mode = event.target.value;
  project.style.fontMm =
    ((project.mode === 'numbers' ? 16.0333333 : 4.2) * project.diameterMm) / 37;
  project.style.textOffsetY = project.mode === 'numbers' ? 0 : (2 * project.diameterMm) / 37;
  project.layout.gapX = project.mode === 'numbers' ? 1 : 4;
  project.layout.columns =
    project.mode === 'numbers'
      ? fitColumns(project)
      : Math.min(
          2,
          project.rows.reduce((n, r) => n + r.copies, 0),
        );
  resetEditor();
});

getElement('#add-row').addEventListener('click', () => {
  if (project.rows.length >= 30) {
    notice('Możesz dodać najwyżej 30 różnych wzorów.', true);
    return;
  }
  project.rows.push({ text: 'TWÓJ\nTEKST', copies: 1, decoration: 'none', image: null });
  renderRows();
  invalidate();
});
getElement('#fit-columns').addEventListener('click', () => {
  project.layout.columns = fitColumns(project);
  getElement('#columns').value = project.layout.columns;
  invalidFields.delete('layout.columns');
  invalidate();
});
getElement('#preset-roles').addEventListener('click', () => {
  project = parseProject(defaultConfig);
  project.mode = 'text';
  project.rows = [
    { text: 'PREZES', copies: 2, decoration: 'fishing', image: null },
    { text: 'SKARBNIK\nKOŁA', copies: 2, decoration: 'coins', image: null },
  ];
  project.style.fontMm = (4.2 * project.diameterMm) / 37;
  project.style.textOffsetY = (2 * project.diameterMm) / 37;
  project.layout.columns = 2;
  project.layout.gapX = project.layout.gapY = 4;
  resetEditor();
  notice('Wczytano wzory prezesa i skarbnika.');
});
getElement('#preview-select').addEventListener('change', (event) => {
  selectedIndex = Number(event.target.value);
  displayPreview();
  persistSession();
});
getElement('#view-label').addEventListener('click', () => {
  view = 'label';
  displayPreview();
  persistSession();
});
getElement('#view-sheet').addEventListener('click', () => {
  view = 'sheet';
  displayPreview();
  persistSession();
});
for (const section of editor.querySelectorAll('details[id]')) {
  section.addEventListener('toggle', () => persistSession());
}
getElement('#approve').addEventListener('change', () => {
  getElement('#download-pdf').disabled = !getElement('#approve').checked || !currentPreview;
});

getElement('#save-project').addEventListener('click', () => {
  if (!currentPreview || projectKey(project) !== currentPreview.key) {
    notice('Popraw ustawienia przed zapisaniem projektu.', true);
    return;
  }
  download(
    new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
    'config.json',
  );
  notice('Zapisano projekt do pliku. Możesz go później wczytać razem z własnymi ozdobami.');
});
getElement('#import-button').addEventListener('click', () => getElement('#import-file').click());
getElement('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('Plik projektu może mieć najwyżej 10 MB.');
    const candidate = parseProject(JSON.parse(await file.text()));
    const layout = calculateLayout(candidate),
      images = await loadImages(candidate);
    renderSheet(candidate, layout, images);
    project = candidate;
    resetEditor();
    notice('Projekt został wczytany.');
  } catch (error) {
    notice(`Nie udało się wczytać projektu: ${error.message}`, true);
  }
});

getElement('#download-png').addEventListener('click', async () => {
  const preview = currentPreview;
  if (!preview || exportInProgress) return;
  try {
    const label = preview.layout.labels[selectedIndex];
    const canvas = renderLabel(preview.project, label, preview.images);
    const png = await pngWithDpi(canvas, preview.project.dpi);
    const name = label.text
      .replaceAll('\n', '-')
      .replace(/[^\p{L}\p{N}-]/gu, '-')
      .slice(0, 60);
    download(png, `${name || 'okrag'}-${preview.project.diameterMm}mm.png`);
  } catch (error) {
    notice(error.message, true);
  }
});

getElement('#download-pdf').addEventListener('click', async () => {
  const preview = currentPreview;
  if (
    !preview ||
    exportInProgress ||
    !getElement('#approve').checked ||
    projectKey(project) !== preview.key
  )
    return;
  exportInProgress = true;
  editor.inert = true;
  for (const selector of [
    '#download-pdf',
    '#download-png',
    '#save-project',
    '#import-button',
    '#approve',
  ])
    getElement(selector).disabled = true;
  try {
    const blob = await makePdf(preview.project, preview.layout, preview.images, (done, total) => {
      getElement('#export-status').textContent = `Przygotowuję PDF: ${done} z ${total} kół…`;
    });
    download(blob, `okregi-${preview.project.diameterMm}mm-A4.pdf`);
    getElement('#export-status').textContent =
      `Gotowe. ${circles(preview.layout.labels.length)} na jednej stronie A4.`;
  } catch (error) {
    notice(error.message, true);
    getElement('#export-status').textContent = '';
  } finally {
    exportInProgress = false;
    editor.inert = false;
    for (const selector of ['#download-png', '#save-project', '#import-button', '#approve'])
      getElement(selector).disabled = false;
    getElement('#download-pdf').disabled = !getElement('#approve').checked || !currentPreview;
  }
});

async function init() {
  try {
    const response = await fetch('./config.json');
    if (!response.ok)
      throw new Error('Nie można pobrać config.json. Uruchom aplikację przez serwer HTTP.');
    defaultConfig = await response.json();
    await document.fonts.load('700 20px LabelFont');
    if (!document.fonts.check('700 20px LabelFont'))
      throw new Error('Nie można wczytać czcionki etykiet. Odśwież stronę.');
    const saved = loadSession(browserStorage, storageKey, parseProject(defaultConfig));
    project = saved.project;
    syncFields();
    renderRows();
    restoreUiState(saved.ui);
    if (saved.error) notice(saved.error, true);
    getElement('#storage-status').textContent = !browserStorage
      ? 'Zapis w przeglądarce jest niedostępny. Użyj przycisku „Zapisz do pliku”.'
      : saved.restored
        ? 'Przywrócono Twoje ostatnie ustawienia. Kolejne zmiany zapisują się automatycznie.'
        : 'Ustawienia zapisują się automatycznie w tej przeglądarce.';
    getElement('#storage-status').classList.toggle('error', !browserStorage);
    await updatePreview();
  } catch (error) {
    getElement('#loading').hidden = true;
    getElement('#preview-error').hidden = false;
    getElement('#preview-error').textContent = error.message;
    notice('Aplikacja nie mogła się uruchomić. Sprawdź połączenie lub odśwież stronę.', true);
  }
}
init();

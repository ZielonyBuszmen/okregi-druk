import { parseProject, calculateLayout, fitColumns, resizeDiameter, projectKey } from './model.js';
import {
  renderLabel,
  renderSheet,
  validateLabels,
  drawDecoration,
  loadImages,
} from './renderer.js';
import { download, pngWithDpi, makePdf } from './export.js';
import { loadSession, saveSession } from './storage.js';
import { DECORATION_CHOICES } from './decorations.js';
import { canAutoFit, autoFitProject } from './autofit.js';

const getElement = (selector) => document.querySelector(selector);
const editor = getElement('#editor');
const storageKey = `okregi-project-v1:${location.pathname}`;
// Ustawienia są osobne dla każdej aplikacji w danym katalogu GitHub Pages.
const browserStorage = getBrowserStorage();
let project,
  defaultConfig,
  currentPreview = null,
  selectedIndex = 0,
  selectedPage = 0,
  view = 'label',
  generation = 0,
  previewTimer,
  exportInProgress = false;
const invalidFields = new Set();
const invalidInputValues = new Map();
const decorationSuggestions = new WeakMap();

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
    selectedPage,
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
  selectedPage = ui.selectedPage;
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
    if (input && input.type !== 'range') {
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

function pageCountText(count) {
  if (count === 1) return '1 strona A4';
  const few = [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100);
  return `${count} ${few ? 'strony' : 'stron'} A4`;
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
  syncSliders(true);
  updateOrnamentControls();
}

function syncSliders(configure = false) {
  const diameter = project.diameterMm;
  const limits = {
    'style.fontMm': [0.1, diameter * 0.8],
    'style.ringFontMm': [
      0.1,
      Math.max(0.1, (diameter / 2 - project.style.borderMm - project.style.textRadiusMm) * 2 - 0.1),
    ],
    'style.decorationMm': [0.1, diameter * 0.75],
    'style.decorationOffsetY': [-project.style.innerRadiusMm, project.style.innerRadiusMm],
    'style.textOffsetY': [-project.style.innerRadiusMm, project.style.innerRadiusMm],
    'style.lineSpacingMm': [0, Math.min(20, diameter / 3)],
  };
  for (const input of editor.querySelectorAll('input[type=range][data-field]')) {
    const value = byPath(project, input.dataset.field);
    if (configure) {
      const [min, max] = limits[input.dataset.field];
      const step = Number(input.step);
      // Importowane ustawienia pozostają widoczne, także gdy wymagają korekty.
      input.min = Number((Math.floor(Math.min(min, value) / step) * step).toFixed(3));
      input.max = Number((Math.ceil(Math.max(max, value) / step) * step).toFixed(3));
      input.value = value;
    }
    const label = `${value.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} mm`;
    getElement(`#${input.id}-value`).textContent = label;
    input.setAttribute('aria-valuetext', label);
  }
}

function updateOrnamentControls() {
  const visible = project.mode === 'text' && project.rows.some((row) => row.decoration !== 'none');
  getElement('#ornament-controls').hidden = !visible;
  getElement('#accent-color-field').hidden = !visible;
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

function suggestedDecorations(row) {
  const selected = row.decoration === 'none' ? null : row.decoration;
  const previous = decorationSuggestions.get(row);
  if (previous?.selected === selected) return previous.choices;
  const available = DECORATION_CHOICES.filter(({ id }) => id !== 'none' && id !== selected).map(
    ({ id }) => id,
  );
  const choices = selected ? ['none', selected] : ['none'];
  while (choices.length < 3) {
    const index = Math.floor(Math.random() * available.length);
    choices.push(available.splice(index, 1)[0]);
  }
  // Odrysowanie formularza nie zmienia propozycji. Losujemy je po wczytaniu
  // projektu albo zmianie wybranej ozdoby, bez modyfikowania ustawień nadruku.
  decorationSuggestions.set(row, { selected, choices });
  return choices;
}

function renderDecorationChoices(card, row) {
  const quickChoices = suggestedDecorations(row);
  const allChoices =
    row.image || row.decoration === 'custom'
      ? [...DECORATION_CHOICES, { id: 'custom', title: 'Własny obraz' }]
      : DECORATION_CHOICES;
  const quickGroup = card.querySelector('.quick-decorations');
  const extraGroup = card.querySelector('.extra-decorations');
  quickGroup.replaceChildren();
  extraGroup.replaceChildren();
  const ordered = [
    ...quickChoices.map((id) => allChoices.find((choice) => choice.id === id)),
    ...allChoices.filter(({ id }) => !quickChoices.includes(id)),
  ];
  ordered.forEach(({ id, title }, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'decoration-choice';
    button.dataset.decoration = id;
    button.setAttribute('aria-pressed', String(row.decoration === id));
    button.classList.toggle('active', row.decoration === id);
    const picture = document.createElement(id === 'custom' && row.image ? 'img' : 'canvas');
    picture.setAttribute('aria-hidden', 'true');
    if (id === 'custom' && row.image) {
      picture.src = row.image;
      picture.alt = '';
    } else thumbnail(picture, id === 'custom' ? 'none' : id);
    button.append(picture, document.createTextNode(title));
    button.addEventListener('click', () => {
      row.decoration = id;
      renderDecorationChoices(card, row);
      invalidate();
      card.querySelector(`[data-decoration="${id}"]`).focus({ preventScroll: true });
    });
    (index < 3 ? quickGroup : extraGroup).append(button);
  });
  card.querySelector('.more-decorations > summary').textContent =
    `Więcej ozdób (${allChoices.length - 3})`;
  const status = card.querySelector('.custom-status');
  status.hidden = row.decoration !== 'custom';
  status.textContent =
    row.decoration === 'custom' ? `Wybrany obraz: ${row.imageName || 'własna ozdoba'}` : '';
  updateOrnamentControls();
}

function renderRows() {
  const openGalleries = new Set(
    [...getElement('#text-rows').querySelectorAll('details[open]')].map((item) => item.id),
  );
  getElement('#text-rows').replaceChildren();
  project.rows.forEach((row, index) => {
    const card = document.createElement('div');
    card.className = 'text-row';
    card.dataset.patternIndex = index;
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
          <div class="decoration-options quick-decorations" role="group" aria-label="Wybierz ozdobę"></div>
          <details class="more-decorations">
            <summary>Więcej ozdób</summary>
            <div class="decoration-options extra-decorations" role="group" aria-label="Pozostałe ozdoby"></div>
          </details>
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
    const gallery = card.querySelector('.more-decorations');
    gallery.id = `ornaments-row-${index}`;
    gallery.open = openGalleries.has(gallery.id);
    renderDecorationChoices(card, row);
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
        if (project.rows[index] !== row) return;
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
    getElement('#text-rows').append(card);
  });
}

function selectRow(index) {
  if (project.mode !== 'text') return;
  selectedIndex = project.rows.slice(0, index).reduce((count, row) => count + row.copies, 0);
  view = 'label';
  if (currentPreview && currentPreview.layout.labels[selectedIndex]?.key === `text-${index}`) {
    getElement('#preview-select').value = selectedIndex;
    displayPreview();
  }
  persistSession();
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
  selectRow(Math.min(removedIndex, project.rows.length - 1));
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
      ? `Podgląd strony ${selectedPage + 1} z ${currentPreview.layout.pages.length} · A4`
      : `Podgląd: ${currentPreview.layout.labels[selectedIndex].text.replaceAll('\n', ' ')}`,
  );
}

function displayPreview() {
  if (!currentPreview) return;
  const { layout } = currentPreview;
  selectedIndex = Math.max(0, Math.min(selectedIndex, layout.labels.length - 1));
  selectedPage = Math.max(0, Math.min(selectedPage, layout.pages.length - 1));
  if (view === 'label') selectedPage = layout.placements[selectedIndex].pageIndex;
  else if (layout.placements[selectedIndex].pageIndex !== selectedPage)
    selectedIndex = layout.pages[selectedPage].placements[0].index;
  // Pamiętamy tylko aktualną kartkę, także przy projektach z setkami stron.
  if (view === 'sheet' && currentPreview.sheetPage !== selectedPage) {
    currentPreview.sheet = renderSheet(
      currentPreview.project,
      layout.pages[selectedPage],
      currentPreview.images,
    );
    currentPreview.sheetPage = selectedPage;
  }
  getElement('#preview-select').value = selectedIndex;
  getElement('#page-navigation').hidden = view !== 'sheet' || layout.pages.length === 1;
  getElement('#page-counter').textContent = `Strona ${selectedPage + 1} z ${layout.pages.length}`;
  getElement('#previous-page').disabled = selectedPage === 0;
  getElement('#next-page').disabled = selectedPage === layout.pages.length - 1;
  getElement('#view-sheet').textContent = layout.pages.length > 1 ? 'Strony A4' : 'Cała kartka A4';
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

function updateDownloadButtons() {
  getElement('#download-png').disabled = exportInProgress || !currentPreview;
  getElement('#download-pdf').disabled = exportInProgress;
}

function invalidate() {
  generation++;
  currentPreview = null;
  updateDownloadButtons();
  getElement('#loading').hidden = false;
  getElement('#export-status').textContent = '';
  getElement('#auto-fix').hidden = true;
  getElement('#previous-page').disabled = true;
  getElement('#next-page').disabled = true;
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
    validateLabels(snapshot, layout.labels, images);
    if (id !== generation) return;
    currentPreview = {
      project: snapshot,
      key: projectKey(snapshot),
      layout,
      images,
      sheet: null,
      sheetPage: -1,
    };
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
      `${circles(layout.labels.length)} · ${pageCountText(layout.pages.length)}`;
    getElement('#preview-error').hidden = true;
    getElement('#auto-fix').hidden = true;
    getElement('#preview-stage').classList.remove('invalid');
  } catch (error) {
    if (id !== generation) return;
    currentPreview = null;
    getElement('#preview-error').hidden = false;
    getElement('#preview-error-text').textContent = error.message;
    getElement('#auto-fix').hidden = !canAutoFit(error, project);
    getElement('#preview-stage').classList.add('invalid');
    getElement('#page-navigation').hidden = true;
  } finally {
    if (id === generation) {
      getElement('#loading').hidden = true;
      updateDownloadButtons();
    }
  }
}

function resetEditor() {
  invalidFields.clear();
  invalidInputValues.clear();
  selectedIndex = 0;
  selectedPage = 0;
  syncFields();
  renderRows();
  invalidate();
}

editor.addEventListener('submit', (event) => event.preventDefault());
// Zachowaj wybór wzoru także przy klikaniu ozdób, wpisywaniu i nawigacji Tab.
for (const eventName of ['click', 'focusin']) {
  editor.addEventListener(
    eventName,
    (event) => {
      const card = event.target.closest('[data-pattern-index]');
      if (card) selectRow(Number(card.dataset.patternIndex));
    },
    true,
  );
}
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
    selectRow(index);
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
    const resized = resizeDiameter(project, value);
    // Średnica nie zmienia wzorów. Zachowaj ich wybory i obsługę kafelków.
    resized.rows = project.rows;
    project = resized;
    syncSliders(true);
    project.layout.columns = fitColumns(project);
    getElement('#columns').value = project.layout.columns;
  } else setPath(project, field, value);
  if (field === 'style.color' || field === 'style.accent') renderRows();
  syncSliders();
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
  selectRow(project.rows.length - 1);
  invalidate();
});
getElement('#fit-columns').addEventListener('click', () => {
  project.layout.columns = fitColumns(project);
  getElement('#columns').value = project.layout.columns;
  invalidFields.delete('layout.columns');
  invalidate();
});
getElement('#auto-fix').addEventListener('click', async () => {
  const button = getElement('#auto-fix');
  const revision = generation;
  button.disabled = true;
  try {
    const snapshot = structuredClone(project);
    const images = await loadImages(snapshot);
    if (revision !== generation) return;
    const fitted = autoFitProject(snapshot, images);
    fitted.rows = project.rows;
    project = fitted;
    syncFields();
    renderRows();
    invalidate();
    clearTimeout(previewTimer);
    await updatePreview();
    notice(
      'Dopasowano projekt. Sprawdź podgląd. Średnica, napisy i liczba kół pozostały takie same.',
    );
  } catch (error) {
    notice(error.message, true);
  } finally {
    button.disabled = false;
  }
});
getElement('#preview-select').addEventListener('change', (event) => {
  selectedIndex = Number(event.target.value);
  if (currentPreview) selectedPage = currentPreview.layout.placements[selectedIndex].pageIndex;
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
function changePage(offset) {
  if (!currentPreview) return;
  const pages = currentPreview.layout.pages;
  selectedPage = Math.max(0, Math.min(selectedPage + offset, pages.length - 1));
  selectedIndex = pages[selectedPage].placements[0].index;
  displayPreview();
  persistSession();
}
getElement('#previous-page').addEventListener('click', () => changePage(-1));
getElement('#next-page').addEventListener('click', () => changePage(1));
editor.addEventListener('toggle', () => persistSession(), true);

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
getElement('#reset-project').addEventListener('click', () => {
  if (!project || exportInProgress) return;
  const dialog = getElement('#reset-dialog');
  dialog.returnValue = 'cancel';
  dialog.showModal();
});
getElement('#reset-dialog').addEventListener('close', () => {
  if (getElement('#reset-dialog').returnValue !== 'reset') return;
  project = parseProject(defaultConfig);
  view = 'label';
  for (const section of editor.querySelectorAll('details[open]')) section.open = false;
  resetEditor();
  notice('Przywrócono ustawienia początkowe.');
});
// Okno czekania zamyka się po zakończeniu eksportu, również po błędzie.
getElement('#pdf-progress').addEventListener('cancel', (event) => event.preventDefault());
getElement('#import-button').addEventListener('click', () => getElement('#import-file').click());
getElement('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  const previousProject = project;
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('Plik projektu może mieć najwyżej 10 MB.');
    const candidate = parseProject(JSON.parse(await file.text()));
    const layout = calculateLayout(candidate),
      images = await loadImages(candidate);
    validateLabels(candidate, layout.labels, images);
    if (project !== previousProject) return;
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
  if (exportInProgress) return;
  if (!project) {
    notice('Ustawienia jeszcze się wczytują. Spróbuj za chwilę.', true);
    return;
  }
  notice('');
  exportInProgress = true;
  editor.inert = true;
  updateDownloadButtons();
  for (const selector of ['#save-project', '#import-button', '#reset-project'])
    getElement(selector).disabled = true;
  try {
    getElement('#pdf-progress-status').textContent = 'Przygotowuję PDF…';
    getElement('#pdf-progress').showModal();
    // Oddaj przeglądarce czas na narysowanie okna przed pracą renderera.
    await new Promise((resolve) => setTimeout(resolve, 30));
    // Kliknięcie działa także tuż po wpisaniu wartości, bez czekania na podgląd.
    clearTimeout(previewTimer);
    if (!currentPreview || projectKey(project) !== currentPreview.key) await updatePreview();
    const preview = currentPreview;
    if (!preview || projectKey(project) !== preview.key) {
      notice(`Nie można przygotować PDF. ${getElement('#preview-error-text').textContent}`, true);
      return;
    }
    const blob = await makePdf(preview.project, preview.layout, preview.images, (done, total) => {
      getElement('#export-status').textContent = `Przygotowuję PDF: ${done} z ${total} kół…`;
      getElement('#pdf-progress-status').textContent = `Przygotowuję PDF: ${done} z ${total} kół…`;
    });
    download(blob, `okregi-${preview.project.diameterMm}mm-A4.pdf`);
    getElement('#export-status').textContent =
      `Gotowe. ${circles(preview.layout.labels.length)} · ${pageCountText(preview.layout.pages.length)}.`;
  } catch (error) {
    notice(error.message, true);
    getElement('#export-status').textContent = '';
  } finally {
    exportInProgress = false;
    editor.inert = false;
    for (const selector of ['#save-project', '#import-button', '#reset-project'])
      getElement(selector).disabled = false;
    updateDownloadButtons();
    if (getElement('#pdf-progress').open) getElement('#pdf-progress').close();
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
    getElement('#reset-project').disabled = false;
  } catch (error) {
    getElement('#loading').hidden = true;
    getElement('#preview-error').hidden = false;
    getElement('#preview-error-text').textContent = error.message;
    notice('Aplikacja nie mogła się uruchomić. Sprawdź połączenie lub odśwież stronę.', true);
  }
}
init();

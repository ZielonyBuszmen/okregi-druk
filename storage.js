import { parseDraftProject } from './model.js';

function readUiState(value = {}) {
  const rawInputs = {};
  for (const [name, text] of Object.entries(value.rawInputs || {})) {
    if (typeof text === 'string' && text.length <= 100 && /^[\w.-]+$/.test(name)) {
      rawInputs[name] = text;
    }
  }
  const openSections = Array.isArray(value.openSections)
    ? value.openSections.filter((name) => typeof name === 'string' && /^[\w-]+$/.test(name))
    : null;
  return {
    view: value.view === 'sheet' ? 'sheet' : 'label',
    selectedIndex:
      Number.isInteger(value.selectedIndex) && value.selectedIndex >= 0 ? value.selectedIndex : 0,
    rawInputs,
    openSections,
  };
}

export function loadSession(storage, key, defaultProject) {
  const fallback = {
    project: structuredClone(defaultProject),
    ui: readUiState(),
    restored: false,
    error: null,
  };
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    // Wcześniejsza wersja zapisywała bezpośrednio sam projekt.
    const isSession = saved.sessionVersion === 1;
    return {
      project: parseDraftProject(isSession ? saved.project : saved),
      ui: readUiState(isSession ? saved.ui : {}),
      restored: true,
      error: null,
    };
  } catch {
    return {
      ...fallback,
      error: 'Nie udało się odczytać ostatniego zapisu. Wczytano ustawienia początkowe.',
    };
  }
}

export function saveSession(storage, key, project, ui) {
  try {
    const saved = {
      sessionVersion: 1,
      project: parseDraftProject(project),
      ui: readUiState(ui),
    };
    storage.setItem(key, JSON.stringify(saved));
    return { saved: true, error: null };
  } catch {
    return {
      saved: false,
      error:
        'Nie udało się zapisać zmian w przeglądarce. Zapisz projekt do pliku przyciskiem u góry strony.',
    };
  }
}

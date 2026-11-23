import { DECORATION_CHOICES } from './decorations.js';

export const PAGE = Object.freeze({ width: 210, height: 297 });
export const DECORATIONS = [...DECORATION_CHOICES.map(({ id }) => id), 'custom'];

// Tylko błędy dopasowania mają bezpieczną korektę rozmiaru lub rozmieszczenia.
export class FitError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FitError';
    this.code = code;
  }
}

const STYLE_NUMBERS = [
  'fontMm',
  'ringFontMm',
  'textRadiusMm',
  'innerRadiusMm',
  'innerWidthMm',
  'borderMm',
  'topSpan',
  'bottomSpan',
  'lineSpacingMm',
  'textOffsetY',
  'decorationMm',
  'decorationOffsetY',
  'rodsScale',
];

// Zapis roboczy może mieć np. zbyt duży tekst. Sprawdzamy jego strukturę,
// a dopasowanie do koła dopiero podczas przygotowania podglądu.
export function parseDraftProject(data) {
  const project = structuredClone(data);
  if (!project || project.version !== 1 || !project.style || !project.layout) {
    throw new Error('Nieprawidłowy zapis projektu.');
  }
  const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  if (
    !['text', 'numbers'].includes(project.mode) ||
    typeof project.top !== 'string' ||
    typeof project.bottom !== 'string'
  ) {
    throw new Error('Nieprawidłowe napisy lub tryb projektu.');
  }
  if (
    !['diameterMm', 'dpi', 'start', 'end'].every((key) => isNumber(project[key])) ||
    !STYLE_NUMBERS.every((key) => isNumber(project.style[key])) ||
    !['columns', 'gapX', 'gapY', 'margin'].every((key) => isNumber(project.layout[key])) ||
    typeof project.style.symbols !== 'boolean'
  ) {
    throw new Error('Nieprawidłowe ustawienia liczbowe projektu.');
  }
  if (!['color', 'accent'].every((key) => /^#[\da-f]{6}$/i.test(project.style[key]))) {
    throw new Error('Nieprawidłowy kolor projektu.');
  }
  if (!Array.isArray(project.rows) || project.rows.length < 1 || project.rows.length > 30) {
    throw new Error('Nieprawidłowa lista wzorów.');
  }
  for (const row of project.rows) {
    if (
      !row ||
      typeof row.text !== 'string' ||
      !isNumber(row.copies) ||
      !DECORATIONS.includes(row.decoration)
    ) {
      throw new Error('Nieprawidłowy wzór w zapisanym projekcie.');
    }
    if (
      row.image != null &&
      (typeof row.image !== 'string' ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(row.image) ||
        row.image.length > 2_800_000)
    ) {
      throw new Error('Nieprawidłowy obraz w zapisanym projekcie.');
    }
  }
  return project;
}

function number(value, name, min, max, integer = false) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${name}: wpisz ${integer ? 'liczbę całkowitą' : 'liczbę'} od ${min} do ${max}.`,
    );
  }
}

export function validateProject(project) {
  if (!project || project.version !== 1 || !project.style || !project.layout)
    throw new Error('Ten plik nie jest projektem generatora okręgów.');
  if (!['numbers', 'text'].includes(project.mode)) throw new Error('Wybierz numerację lub tekst.');
  for (const value of [project.top, project.bottom]) {
    if (typeof value !== 'string' || value.length > 100 || /[\r\n]/.test(value))
      throw new Error('Napisy wokół koła mogą mieć do 100 znaków i jeden wiersz.');
  }
  number(project.diameterMm, 'Średnica (mm)', 8, 120);
  number(project.dpi, 'DPI', 150, 600, true);
  if (project.mode === 'numbers') {
    number(project.start, 'Numer początkowy', 0, 99999, true);
    number(project.end, 'Numer końcowy', project.start, 99999, true);
  }
  if (!Array.isArray(project.rows) || !project.rows.length || project.rows.length > 30)
    throw new Error('Dodaj od 1 do 30 wzorów tekstowych.');
  for (const row of project.rows) {
    if (
      typeof row.text !== 'string' ||
      row.text.length > 200 ||
      (project.mode === 'text' && !row.text.trim())
    )
      throw new Error('Wpisz tekst w środku każdego wzoru (do 200 znaków).');
    if (project.mode === 'text') number(row.copies, 'Liczba kopii', 1, 100, true);
    if (!DECORATIONS.includes(row.decoration)) throw new Error('Nieznana ozdoba.');
    if (
      row.decoration === 'custom' &&
      (!row.image ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(row.image) ||
        row.image.length > 2_800_000)
    )
      throw new Error('Dodaj własny obraz PNG, JPG lub WEBP o rozmiarze do 2 MB.');
  }
  number(project.layout.columns, 'Kolumny', 1, 30, true);
  number(project.layout.margin, 'Margines (mm)', 0, 70);
  number(project.layout.gapX, 'Odstęp poziomy (mm)', 0, 30);
  number(project.layout.gapY, 'Odstęp pionowy (mm)', 0, 30);
  for (const key of ['color', 'accent'])
    if (!/^#[\da-f]{6}$/i.test(project.style[key])) throw new Error('Wybierz prawidłowy kolor.');
  for (const key of ['fontMm', 'ringFontMm', 'textRadiusMm', 'innerRadiusMm', 'decorationMm'])
    number(project.style[key], 'Rozmiar tekstu lub ozdoby (mm)', 0.1, 120);
  for (const key of ['borderMm', 'innerWidthMm', 'lineSpacingMm'])
    number(project.style[key], 'Grubość lub odstęp (mm)', 0, 20);
  for (const key of ['textOffsetY', 'decorationOffsetY'])
    number(project.style[key], 'Przesunięcie (mm)', -60, 60);
  number(project.style.rodsScale, 'Rozmiar wędek', 0.2, 4);
  for (const key of ['topSpan', 'bottomSpan'])
    number(project.style[key], 'Długość łuku (°)', 1, 180);
  if (typeof project.style.symbols !== 'boolean')
    throw new Error('Nieprawidłowe ustawienie symboli bocznych.');
  if (
    project.style.borderMm >= project.diameterMm / 2 ||
    project.style.innerRadiusMm >= project.diameterMm / 2
  )
    throw new Error('Obwódka i łuki muszą mieścić się wewnątrz koła.');
  if (
    project.style.textRadiusMm + project.style.ringFontMm / 2 >=
    project.diameterMm / 2 - project.style.borderMm
  )
    throw new FitError(
      'ring-bounds',
      'Napis na obwodzie wychodzi poza obwódkę. Zmniejsz jego rozmiar.',
    );
  if (labelCount(project) > 500) throw new Error('Jeden projekt może zawierać najwyżej 500 kół.');
  return project;
}

export function labelCount(project) {
  return project.mode === 'numbers'
    ? project.end - project.start + 1
    : project.rows.reduce((sum, row) => sum + row.copies, 0);
}

export function expandLabels(project) {
  validateProject(project);
  if (project.mode === 'numbers')
    return Array.from({ length: labelCount(project) }, (_, i) => ({
      text: String(project.start + i),
      decoration: 'none',
      image: null,
      key: `number-${project.start + i}`,
    }));
  return project.rows.flatMap((row, i) =>
    Array.from({ length: row.copies }, () => ({ ...row, key: `text-${i}` })),
  );
}

export function fitColumns(project) {
  return Math.max(
    1,
    Math.min(
      labelCount(project),
      Math.floor(
        (PAGE.width - project.layout.margin * 2 + project.layout.gapX) /
          (project.diameterMm + project.layout.gapX),
      ),
    ),
  );
}

export function calculateLayout(project) {
  const labels = expandLabels(project);
  const cols = Math.min(project.layout.columns, labels.length);
  const rows = Math.ceil(labels.length / cols);
  const width = cols * project.diameterMm + (cols - 1) * project.layout.gapX;
  const height = rows * project.diameterMm + (rows - 1) * project.layout.gapY;
  const availableWidth = PAGE.width - 2 * project.layout.margin;
  const availableHeight = PAGE.height - 2 * project.layout.margin;
  if (width > availableWidth + 1e-7 || height > availableHeight + 1e-7) {
    throw new FitError(
      'page-layout',
      `Układ ${Math.round(width)} × ${Math.round(height)} mm nie mieści się na A4. Zmień kolumny, odstępy lub liczbę kół. Średnica pozostaje ${project.diameterMm} mm.`,
    );
  }
  const top = project.layout.margin + (availableHeight - height) / 2;
  const placements = labels.map((label, i) => {
    const row = Math.floor(i / cols);
    const rowCount = Math.min(cols, labels.length - row * cols);
    const rowWidth = rowCount * project.diameterMm + (rowCount - 1) * project.layout.gapX;
    return {
      label,
      index: i,
      x: (PAGE.width - rowWidth) / 2 + (i % cols) * (project.diameterMm + project.layout.gapX),
      y: top + row * (project.diameterMm + project.layout.gapY),
      diameterMm: project.diameterMm,
    };
  });
  return { labels, placements, columns: cols, rows, width, height };
}

export function resizeDiameter(project, diameter) {
  const copy = structuredClone(project);
  const ratio = diameter / copy.diameterMm;
  for (const key of [
    'fontMm',
    'ringFontMm',
    'textRadiusMm',
    'innerRadiusMm',
    'innerWidthMm',
    'borderMm',
    'lineSpacingMm',
    'textOffsetY',
    'decorationMm',
    'decorationOffsetY',
  ])
    copy.style[key] *= ratio;
  copy.diameterMm = diameter;
  return copy;
}

export function projectKey(project) {
  return JSON.stringify(project);
}

export function parseProject(data) {
  return validateProject(parseDraftProject(data));
}

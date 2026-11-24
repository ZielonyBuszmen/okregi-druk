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
  // Starsze pliki i localStorage przechowywały ręczne kąty obu napisów.
  // Nowy rozstaw wyliczamy z tekstu, zachowując pozostałe ustawienia projektu.
  project.style.ringSpacing ??= 'medium';
  delete project.style.topSpan;
  delete project.style.bottomSpan;
  if (!['small', 'medium', 'large'].includes(project.style.ringSpacing))
    throw new Error('Wybierz mały, średni lub duży rozstaw napisów.');
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
  if (!['small', 'medium', 'large'].includes(project.style.ringSpacing))
    throw new Error('Wybierz mały, średni lub duży rozstaw napisów.');
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
        (PAGE.width - project.layout.margin * 2 + project.layout.gapX + 1e-7) /
          (project.diameterMm + project.layout.gapX),
      ),
    ),
  );
}

export function calculateLayout(project) {
  const labels = expandLabels(project);
  const availableWidth = PAGE.width - 2 * project.layout.margin;
  const availableHeight = PAGE.height - 2 * project.layout.margin;
  const diameter = project.diameterMm;
  if (diameter > availableWidth + 1e-7 || diameter > availableHeight + 1e-7) {
    throw new FitError(
      'page-layout',
      `Koło o średnicy ${diameter} mm nie mieści się na A4 z wybranymi marginesami. Zmniejsz marginesy.`,
    );
  }
  // Wybrane kolumny są maksimum. Każde koło musi zmieścić się w całości.
  const columns = Math.min(project.layout.columns, fitColumns(project), labels.length);
  const rowsPerPage = Math.floor(
    (availableHeight + project.layout.gapY + 1e-7) / (diameter + project.layout.gapY),
  );
  const capacity = columns * rowsPerPage;
  const pages = [];
  for (let start = 0; start < labels.length; start += capacity) {
    const pageLabels = labels.slice(start, start + capacity);
    const pageColumns = Math.min(columns, pageLabels.length);
    const rows = Math.ceil(pageLabels.length / pageColumns);
    const width = pageColumns * diameter + (pageColumns - 1) * project.layout.gapX;
    const height = rows * diameter + (rows - 1) * project.layout.gapY;
    const top = (PAGE.height - height) / 2;
    const pageIndex = pages.length;
    const placements = pageLabels.map((label, index) => {
      const row = Math.floor(index / pageColumns);
      const rowCount = Math.min(pageColumns, pageLabels.length - row * pageColumns);
      const rowWidth = rowCount * diameter + (rowCount - 1) * project.layout.gapX;
      return {
        label,
        index: start + index,
        pageIndex,
        x: (PAGE.width - rowWidth) / 2 + (index % pageColumns) * (diameter + project.layout.gapX),
        y: top + row * (diameter + project.layout.gapY),
        diameterMm: diameter,
      };
    });
    pages.push({
      index: pageIndex,
      labels: pageLabels,
      placements,
      columns: pageColumns,
      rows,
      width,
      height,
    });
  }
  return {
    labels,
    placements: pages.flatMap((page) => page.placements),
    pages,
    columns,
    rows: pages[0].rows,
    width: pages[0].width,
    height: pages[0].height,
  };
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

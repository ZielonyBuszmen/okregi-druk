const FONT = 'LabelFont';
const TAU = Math.PI * 2;
const rad = (degrees) => (degrees * Math.PI) / 180;

let measurementContext;

function getTextMeasurements(text, fontMm) {
  // Pomiary fontu o rozmiarze kilku pikseli są zaokrąglane przez przeglądarkę.
  // Mierzymy większe litery i wracamy do mm, bez zmieniania rozmiaru nadruku.
  const measurementScale = 100;
  measurementContext ??= document.createElement('canvas').getContext('2d');
  measurementContext.font = `700 ${fontMm * measurementScale}px ${FONT}`;
  const measured = measurementContext.measureText(text);
  return Object.fromEntries(
    [
      'width',
      'actualBoundingBoxLeft',
      'actualBoundingBoxRight',
      'actualBoundingBoxAscent',
      'actualBoundingBoxDescent',
    ].map((name) => [name, measured[name] / measurementScale]),
  );
}

function ellipse(ctx, x0, y0, x1, y1, fill, stroke, width = 0.13) {
  ctx.beginPath();
  ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
function line(ctx, points, color, width = 0.13) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}
function polygon(ctx, points, color) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
function centeredText(ctx, text, x, y, fontMm) {
  const m = getTextMeasurements(text, fontMm);
  ctx.fillText(
    text,
    x + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2,
    y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2,
  );
}

export function drawDecoration(ctx, kind, { color, accent, rodsScale = 1.8 }) {
  const rgb = accent.match(/\w\w/g).map((n) => parseInt(n, 16));
  const light = `rgb(${rgb.map((v) => Math.round(v / 2 + 127.5)).join(',')})`;
  if (kind === 'coins') {
    for (const [x, count] of [
      [-3.2, 3],
      [3.1, 4],
    ]) {
      for (let level = 0; level < count; level++) {
        const y = 1.3 - level * 0.8;
        ctx.fillStyle = accent;
        ctx.fillRect(x - 2, y, 4, 0.7);
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.13;
        ctx.strokeRect(x - 2, y, 4, 0.7);
        ellipse(ctx, x - 2, y + 0.1, x + 2, y + 1.1, accent, color);
        ellipse(ctx, x - 2, y - 0.5, x + 2, y + 0.5, light, color);
      }
    }
    ellipse(ctx, -2.4, -2.4, 2.4, 2.4, accent, color);
    ellipse(ctx, -1.95, -1.95, 1.95, 1.95, null, color);
    ctx.font = `700 1.65px ${FONT}`;
    ctx.fillStyle = color;
    centeredText(ctx, 'zł', 0, 0, 1.65);
  } else if (kind === 'fishing') {
    for (const side of [-1, 1]) {
      line(
        ctx,
        [
          [0.4, 2.6],
          [2.6, 2.2],
          [4.3, 1.1],
          [5.1, -0.5],
          [5, -2],
        ].map(([x, y]) => [side * x, y]),
        accent,
      );
      for (const [x, y, angle] of [
        [1.7, 2.45, 25],
        [3.2, 1.9, 5],
        [4.4, 0.8, -25],
        [5, -0.6, -65],
        [5, -1.8, -95],
      ]) {
        const dx = Math.cos(rad(angle)),
          dy = Math.sin(rad(angle));
        for (const flip of [-1, 1])
          polygon(
            ctx,
            [
              [x, y],
              [x + 0.6 * dx - flip * 0.35 * dy, y + 0.6 * dy + flip * 0.35 * dx],
              [x + 1.25 * dx, y + 1.25 * dy],
            ].map(([px, py]) => [side * px, py]),
            accent,
          );
      }
    }
    ctx.save();
    ctx.scale(rodsScale, rodsScale);
    for (const side of [-1, 1]) {
      line(
        ctx,
        [
          [side * -2.5, 2],
          [side * -1.3, 0.8],
        ],
        color,
        0.38,
      );
      line(
        ctx,
        [
          [side * -2.5, 2],
          [side * 2.8, -2.5],
        ],
        color,
      );
      const x = side * -1.45;
      ellipse(ctx, x - 0.45, 0.6, x + 0.45, 1.5, light, color);
      const tip = side * 2.8;
      line(
        ctx,
        [
          [tip, -2.5],
          [tip, -0.2],
        ],
        color,
        0.07,
      );
      ctx.beginPath();
      ctx.ellipse(tip, -0.15, 0.3, 0.35, 0, 0, Math.PI);
      ctx.lineWidth = 0.13;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function ensureRectFits(x0, y0, x1, y1, center, radius, message) {
  if (
    [x0, x1].some((x) => [y0, y1].some((y) => Math.hypot(x - center, y - center) > radius + 0.02))
  )
    throw new Error(message);
}

function curvedText(ctx, text, radius, span, center, bottom, fontMm, color) {
  if (!text) return;
  ctx.font = `700 ${fontMm}px ${FONT}`;
  ctx.fillStyle = color;
  const chars = Array.from(text),
    widths = chars.map((char) => getTextMeasurements(char, fontMm).width);
  const length = rad(span) * radius;
  const tracking =
    chars.length > 1 ? (length - widths.reduce((a, b) => a + b, 0)) / (chars.length - 1) : 0;
  if (widths.reduce((a, b) => a + b, 0) > length + 0.01)
    throw new Error(
      `Napis „${text}” nie mieści się na łuku. Zmniejsz rozmiar liter lub zwiększ długość łuku.`,
    );
  let cursor = chars.length === 1 ? -widths[0] / 2 : -length / 2;
  chars.forEach((char, i) => {
    const delta = (cursor + widths[i] / 2) / radius;
    const angle = bottom ? Math.PI / 2 - delta : -Math.PI / 2 + delta;
    ctx.save();
    ctx.translate(center + radius * Math.cos(angle), center + radius * Math.sin(angle));
    ctx.rotate(bottom ? angle - Math.PI / 2 : angle + Math.PI / 2);
    centeredText(ctx, char, 0, 0, fontMm);
    ctx.restore();
    cursor += widths[i] + tracking;
  });
}

function symbols(ctx, diameter, color) {
  ctx.save();
  ctx.scale(diameter / 30, diameter / 30);
  ellipse(ctx, 2.55, 9, 3.8, 12, null, color, 0.1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.1;
  ctx.strokeRect(2.55, 9.85, 1.25, 1.7);
  for (const x of [2.85, 3.18, 3.5])
    line(
      ctx,
      [
        [x, 9.85],
        [x, 11.55],
      ],
      color,
      0.1,
    );
  for (const y of [10.25, 10.7, 11.15])
    line(
      ctx,
      [
        [2.55, y],
        [3.8, y],
      ],
      color,
      0.1,
    );
  ellipse(ctx, 2.82, 11.7, 3.53, 13, color);
  line(
    ctx,
    [
      [26.82, 9],
      [26.82, 12.9],
    ],
    color,
    0.1,
  );
  ellipse(ctx, 26.16, 10, 27.48, 12, color);
  ctx.restore();
}

export async function loadImages(project) {
  const map = new Map();
  for (const row of project.rows) {
    if (row.decoration !== 'custom' || !row.image || map.has(row.image)) continue;
    const image = new Image();
    image.src = row.image;
    try {
      await image.decode();
    } catch {
      throw new Error('Nie można odczytać własnego obrazka. Wybierz inny PNG, JPG lub WEBP.');
    }
    if (image.naturalWidth > 8192 || image.naturalHeight > 8192)
      throw new Error('Obraz może mieć najwyżej 8192 × 8192 pikseli.');
    map.set(row.image, image);
  }
  return map;
}

export function renderLabel(project, label, images = new Map(), dpi = project.dpi) {
  // Rysujemy w milimetrach. Dopiero transformacja Canvas zamienia je na piksele,
  // dzięki czemu podgląd, PNG i PDF zachowują te same proporcje.
  const diameterMm = project.diameterMm,
    style = project.style,
    center = diameterMm / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round((diameterMm / 25.4) * dpi);
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width / diameterMm, canvas.height / diameterMm);
  ctx.beginPath();
  ctx.arc(center, center, center, 0, TAU);
  ctx.clip();
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, diameterMm, diameterMm);
  curvedText(
    ctx,
    project.top,
    style.textRadiusMm,
    style.topSpan,
    center,
    false,
    style.ringFontMm,
    style.color,
  );
  curvedText(
    ctx,
    project.bottom,
    style.textRadiusMm,
    style.bottomSpan,
    center,
    true,
    style.ringFontMm,
    style.color,
  );
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.innerWidthMm;
  if (style.innerWidthMm > 0)
    for (const [start, end] of [
      [213, 327],
      [0, 180],
    ]) {
      ctx.beginPath();
      ctx.arc(center, center, style.innerRadiusMm, rad(start), rad(end));
      ctx.stroke();
    }
  if (style.symbols) symbols(ctx, diameterMm, style.color);
  if (label.decoration !== 'none') {
    const size = style.decorationMm,
      y = center + style.decorationOffsetY;
    let halfW = (5.3 * size) / 12,
      halfH = (2.5 * size) / 12;
    if (label.decoration === 'fishing') {
      halfW = (Math.max(6.25, 3.1 * style.rodsScale) * size) / 12;
      halfH = (Math.max(3, 2.5 * style.rodsScale) * size) / 12;
    }
    if (label.decoration === 'custom') {
      const image = images.get(label.image);
      if (!image) throw new Error('Dodaj obraz ozdoby.');
      const ratio = Math.min(size / image.naturalWidth, size / image.naturalHeight);
      halfW = (image.naturalWidth * ratio) / 2;
      halfH = (image.naturalHeight * ratio) / 2;
      ensureRectFits(
        center - halfW,
        y - halfH,
        center + halfW,
        y + halfH,
        center,
        style.innerRadiusMm,
        'Własny obraz nie mieści się w środku. Zmniejsz ozdobę lub zmień jej przesunięcie.',
      );
      ctx.drawImage(image, center - halfW, y - halfH, halfW * 2, halfH * 2);
    } else {
      ensureRectFits(
        center - halfW,
        y - halfH,
        center + halfW,
        y + halfH,
        center,
        style.innerRadiusMm,
        'Ozdoba wychodzi poza wewnętrzny łuk. Zmniejsz jej rozmiar lub przesuń ją bliżej środka.',
      );
      ctx.save();
      ctx.translate(center, y);
      ctx.scale(size / 12, size / 12);
      drawDecoration(ctx, label.decoration, style);
      ctx.restore();
    }
  }
  const lines = label.text.split('\n');
  if (lines.length > 8) throw new Error('Napis w środku może mieć do 8 wierszy.');
  ctx.font = `700 ${style.fontMm}px ${FONT}`;
  ctx.fillStyle = style.color;
  const measures = lines.map((text) => getTextMeasurements(text, style.fontMm));
  const ascent = Math.max(...measures.map((m) => m.actualBoundingBoxAscent));
  const descent = Math.max(...measures.map((m) => m.actualBoundingBoxDescent));
  const step = style.fontMm + style.lineSpacingMm;
  const firstBaseline =
    center + style.textOffsetY - ((lines.length - 1) * step + ascent + descent) / 2 + ascent;
  lines.forEach((text, i) => {
    if (!text.trim()) return;
    const m = measures[i],
      y = firstBaseline + i * step;
    const x = center + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
    ensureRectFits(
      x - m.actualBoundingBoxLeft,
      y - m.actualBoundingBoxAscent,
      x + m.actualBoundingBoxRight,
      y + m.actualBoundingBoxDescent,
      center,
      style.innerRadiusMm - 0.1,
      `Tekst „${label.text.replaceAll('\n', ' ')}” nie mieści się w środku koła. Zmniejsz czcionkę lub dodaj nowy wiersz.`,
    );
    ctx.fillText(text, x, y);
  });
  if (style.borderMm > 0) {
    ctx.beginPath();
    ctx.arc(center, center, center - style.borderMm / 2, 0, TAU);
    ctx.lineWidth = style.borderMm;
    ctx.strokeStyle = style.color;
    ctx.stroke();
  }
  return canvas;
}

export function renderSheet(project, layout, images, dpi = 105) {
  const canvas = document.createElement('canvas');
  const ppm = dpi / 25.4;
  canvas.width = Math.round(210 * ppm);
  canvas.height = Math.round(297 * ppm);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cache = new Map();
  for (const item of layout.placements) {
    if (!cache.has(item.label.key))
      cache.set(item.label.key, renderLabel(project, item.label, images, Math.max(150, dpi)));
    ctx.drawImage(
      cache.get(item.label.key),
      item.x * ppm,
      item.y * ppm,
      project.diameterMm * ppm,
      project.diameterMm * ppm,
    );
  }
  return canvas;
}

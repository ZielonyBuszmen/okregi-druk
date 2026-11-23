import { renderLabel } from './renderer.js';

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function pngWithDpi(canvas, dpi) {
  const png = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Nie udało się zapisać PNG.'))),
      'image/png',
    ),
  );
  const bytes = new Uint8Array(await png.arrayBuffer());
  const chunk = new Uint8Array(21),
    view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);
  view.setUint32(8, Math.round(dpi / 0.0254));
  view.setUint32(12, Math.round(dpi / 0.0254));
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const parts = [bytes.subarray(0, 33), chunk];
  // Usuń istniejące pHYs, aby PNG zawierał dokładnie jedną informację o DPI.
  for (let offset = 33; offset < bytes.length; ) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type !== 'pHYs') parts.push(bytes.subarray(offset, offset + length + 12));
    offset += length + 12;
  }
  return new Blob(parts, { type: 'image/png' });
}

export async function makePdf(project, layout, images, onProgress = () => {}) {
  if (!globalThis.jspdf?.jsPDF)
    throw new Error('Biblioteka PDF nie jest dostępna. Odśwież aplikację.');
  const pdf = new globalThis.jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [210, 297],
    compress: true,
    precision: 8,
  });
  pdf.setProperties({ title: `Okregi ${project.diameterMm} mm - A4`, creator: 'Okręgi' });
  pdf.viewerPreferences({ PrintScaling: 'None' });
  const rendered = new Map();
  for (const [i, item] of layout.placements.entries()) {
    if (!rendered.has(item.label.key)) {
      const canvas = renderLabel(project, item.label, images);
      rendered.set(item.label.key, canvas.toDataURL('image/png'));
    }
    pdf.addImage(
      rendered.get(item.label.key),
      'PNG',
      item.x,
      item.y,
      project.diameterMm,
      project.diameterMm,
      item.label.key,
      'FAST',
    );
    onProgress(i + 1, layout.placements.length);
    if (i % 4 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return pdf.output('blob');
}

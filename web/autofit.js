import { calculateLayout, FitError, labelCount, PAGE } from './model.js';
import { renderLabel } from './renderer.js';

function fittingLayout(project) {
  const count = labelCount(project);
  const width = PAGE.width - project.layout.margin * 2;
  const height = PAGE.height - project.layout.margin * 2;
  const diameter = project.diameterMm;
  for (let columns = Math.min(count, 30, Math.floor(width / diameter)); columns >= 1; columns--) {
    const rows = Math.ceil(count / columns);
    if (rows * diameter > height) continue;
    return {
      ...project.layout,
      columns,
      gapX:
        columns > 1
          ? Math.min(project.layout.gapX, (width - columns * diameter) / (columns - 1))
          : project.layout.gapX,
      gapY:
        rows > 1
          ? Math.min(project.layout.gapY, (height - rows * diameter) / (rows - 1))
          : project.layout.gapY,
    };
  }
  return null;
}

export function canAutoFit(error, project) {
  return (
    error instanceof FitError && (error.code !== 'page-layout' || fittingLayout(project) !== null)
  );
}

const smaller = (value) => Math.max(0.1, value * 0.92);

// Korekta następuje tylko po kliknięciu. Sprawdzamy każdy wzór wspólnym
// rendererem, a oryginalne ustawienia zmieniamy dopiero po pełnym powodzeniu.
export function autoFitProject(project, images) {
  const candidate = structuredClone(project);
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const layout = calculateLayout(candidate);
      const checked = new Set();
      for (const label of layout.labels) {
        if (checked.has(label.key)) continue;
        renderLabel(candidate, label, images, 72);
        checked.add(label.key);
      }
      return candidate;
    } catch (error) {
      if (!canAutoFit(error, candidate)) throw error;
      const style = candidate.style;
      switch (error.code) {
        case 'page-layout':
          candidate.layout = fittingLayout(candidate);
          break;
        case 'ring-bounds':
          style.ringFontMm = smaller(style.ringFontMm);
          style.textRadiusMm = Math.min(
            style.textRadiusMm,
            candidate.diameterMm / 2 - style.borderMm - style.ringFontMm / 2 - 0.1,
          );
          break;
        case 'arc-text':
          style.ringFontMm = smaller(style.ringFontMm);
          break;
        case 'center-text':
          style.fontMm = smaller(style.fontMm);
          style.lineSpacingMm *= 0.92;
          style.textOffsetY = Math.max(
            -style.innerRadiusMm / 2,
            Math.min(style.innerRadiusMm / 2, style.textOffsetY),
          );
          break;
        case 'decoration':
          style.decorationMm = smaller(style.decorationMm);
          style.decorationOffsetY = Math.max(
            -style.innerRadiusMm * 0.65,
            Math.min(style.innerRadiusMm * 0.65, style.decorationOffsetY),
          );
          break;
      }
    }
  }
  throw new Error('Nie udało się dopasować projektu. Skróć napisy lub popraw ustawienia ręcznie.');
}

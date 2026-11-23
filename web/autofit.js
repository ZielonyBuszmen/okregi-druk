import { calculateLayout, FitError, fitColumns, PAGE } from './model.js';
import { validateLabels, minimumArcSpan } from './renderer.js';

function fittingLayout(project) {
  const margin = Math.min(
    project.layout.margin,
    (PAGE.width - project.diameterMm) / 2,
    (PAGE.height - project.diameterMm) / 2,
  );
  if (margin < 0) return null;
  const candidate = { ...project, layout: { ...project.layout, margin } };
  return { ...candidate.layout, columns: fitColumns(candidate) };
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
      validateLabels(candidate, layout.labels, images);
      return candidate;
    } catch (error) {
      if (!canAutoFit(error, candidate)) throw error;
      const style = candidate.style;
      switch (error.code) {
        case 'page-layout':
          candidate.layout = fittingLayout(candidate);
          break;
        case 'ring-bounds': {
          const outerRadius = candidate.diameterMm / 2 - style.borderMm;
          if (style.textRadiusMm >= outerRadius - 0.1)
            style.textRadiusMm = Math.max(
              0.1,
              Math.min(outerRadius * 0.85, (style.innerRadiusMm + outerRadius) / 2),
            );
          style.ringFontMm = Math.max(
            0.1,
            Math.min(smaller(style.ringFontMm), (outerRadius - style.textRadiusMm) * 2 - 0.1),
          );
          break;
        }
        case 'arc-text': {
          // Najpierw zachowaj czytelne litery, wydłużając tylko za krótki łuk.
          let expanded = false;
          for (const [text, field] of [
            [candidate.top, 'topSpan'],
            [candidate.bottom, 'bottomSpan'],
          ]) {
            const required = Math.min(
              180,
              Math.ceil(minimumArcSpan(text, style.ringFontMm, style.textRadiusMm)),
            );
            if (required > style[field]) {
              style[field] = required;
              expanded = true;
            }
          }
          if (!expanded) style.ringFontMm = smaller(style.ringFontMm);
          break;
        }
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

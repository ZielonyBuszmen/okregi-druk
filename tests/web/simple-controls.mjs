import assert from 'node:assert/strict';
import path from 'node:path';
import { archivePreview } from './preview-history.mjs';

export async function checkSimpleControls(page, root) {
  const valid = () => page.waitForFunction(() => !document.querySelector('#download-png').disabled);
  const saved = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem(`okregi-project-v1:${location.pathname}`)).project,
    );
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await valid();
  await page.locator('#appearance-options > summary').click();
  assert.equal(await page.locator('#top-span, #bottom-span, #rod-size').count(), 0);
  assert.equal(await page.locator('#ornament-controls').isHidden(), true);
  await page.locator('[name=mode][value=text]').check();
  await valid();
  assert.equal(await page.locator('#ornament-controls').isVisible(), true);
  for (const row of await page.locator('.text-row').all()) {
    assert.equal(await row.locator('.quick-decorations button').count(), 3);
    assert.equal(
      await row.locator('.quick-decorations button').first().getAttribute('data-decoration'),
      'none',
    );
    await row.locator('.quick-decorations [data-decoration=none]').click();
    await valid();
  }
  assert.equal(await page.locator('#ornament-controls').isHidden(), true);
  const firstRow = page.locator('.text-row').first();
  await firstRow.locator('.more-decorations > summary').click();
  await firstRow.locator('[data-decoration=fishing]').click();
  await valid();
  await firstRow.locator('.more-decorations > summary').click();
  assert.equal(await page.locator('#ornament-controls').isVisible(), true);

  for (const [id, field] of [
    ['center-size', 'fontMm'],
    ['ring-size', 'ringFontMm'],
    ['decoration-size', 'decorationMm'],
    ['decoration-y', 'decorationOffsetY'],
    ['text-y', 'textOffsetY'],
  ]) {
    const slider = page.locator(`#${id}`);
    assert.equal(await slider.getAttribute('type'), 'range');
    const previous = (await saved()).style[field];
    await slider.focus();
    await slider.press('ArrowRight');
    await valid();
    const current = (await saved()).style[field];
    assert(current > previous, `Strzałka zmienia ${id}`);
    assert.equal(
      await page.locator(`#${id}-value`).textContent(),
      `${current.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} mm`,
    );
  }

  const previews = new Set();
  for (const spacing of ['small', 'medium', 'large']) {
    await page.locator('#ring-spacing').selectOption(spacing);
    await valid();
    assert.equal((await saved()).style.ringSpacing, spacing);
    previews.add(await page.locator('#preview-canvas').evaluate((canvas) => canvas.toDataURL()));
  }
  assert.equal(previews.size, 3, 'Każdy rozstaw zmienia rzeczywisty nadruk');
  await page.locator('#ring-spacing').selectOption('medium');
  await valid();
  const fontBefore = (await saved()).style.ringFontMm;
  await page.locator('#top-text').fill('KOŁO');
  await valid();
  await page.locator('#top-text').fill('KLUB WĘDKARSKI');
  await valid();
  assert.equal(
    (await saved()).style.ringFontMm,
    fontBefore,
    'Dłuższy napis dopasowuje odstępy bez zmiany wybranej czcionki',
  );
  const beforeReload = await saved();
  await page.reload();
  await valid();
  assert.deepEqual(await saved(), beforeReload);
  assert.equal(await page.locator('#ring-spacing').inputValue(), 'medium');

  // Starsze zapisane kąty i puste pole liczbowe nie blokują nowego interfejsu.
  await page.evaluate(() => {
    const key = `okregi-project-v1:${location.pathname}`;
    const state = JSON.parse(localStorage.getItem(key));
    delete state.project.style.ringSpacing;
    state.project.style.topSpan = 35;
    state.project.style.bottomSpan = 35;
    state.ui.rawInputs['style.fontMm'] = '';
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await valid();
  assert.equal(await page.locator('#ring-spacing').inputValue(), 'medium');
  assert.equal((await saved()).style.fontMm, beforeReload.style.fontMm);
  await page.locator('#ring-spacing').selectOption('medium');
  await valid();
  assert.equal('topSpan' in (await saved()).style, false);
  await page
    .locator('#appearance-options')
    .screenshot({ path: path.join(root, 'output/web-controls-preview.png') });
  await archivePreview(root, 'web-controls-preview', await saved());
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('#decoration-y').focus();
  await page.locator('#decoration-y').press('ArrowRight');
  await valid();
  await page
    .locator('#appearance-options')
    .screenshot({ path: path.join(root, 'output/web-controls-mobile.png') });
  await archivePreview(root, 'web-controls-mobile', await saved());
  await page.setViewportSize({ width: 1366, height: 768 });
  console.log(
    'Suwaki OK: klawiatura, odczyt wartości, widoczność ozdób, 3 rozstawy, automatyczne dopasowanie i starsze zapisy.',
  );
}

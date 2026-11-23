import assert from 'node:assert/strict';
import path from 'node:path';
import { archivePreview } from './preview-history.mjs';

export async function checkPagination(page, root, { saveDownload, exportPdf }) {
  const valid = () => page.waitForFunction(() => !document.querySelector('#download-png').disabled);
  const saved = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem(`okregi-project-v1:${location.pathname}`)));
  const fresh = async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await valid();
  };
  await fresh();
  await page.locator('#diameter').fill('40');
  await valid();
  await page.locator('#end-number').fill('65');
  await valid();
  assert.match(await page.locator('#count-label').textContent(), /65 kół.*3 strony A4/);
  await page.locator('#view-sheet').click();
  assert.equal(await page.locator('#page-counter').textContent(), 'Strona 1 z 3');
  assert.equal(await page.locator('#previous-page').isDisabled(), true);
  await page
    .locator('.preview-card')
    .screenshot({ path: path.join(root, 'output/web-multipage-1.png') });
  await archivePreview(root, 'web-multipage-1', (await saved()).project, { selectedPage: 0 });
  await page.locator('#next-page').click();
  assert.equal(await page.locator('#preview-select').inputValue(), '24');
  assert.equal(await page.locator('#page-counter').textContent(), 'Strona 2 z 3');
  await page.locator('#next-page').click();
  assert.equal(await page.locator('#preview-select').inputValue(), '48');
  assert.equal(await page.locator('#page-counter').textContent(), 'Strona 3 z 3');
  assert.equal(await page.locator('#next-page').isDisabled(), true);
  await page
    .locator('.preview-card')
    .screenshot({ path: path.join(root, 'output/web-multipage-3.png') });
  await archivePreview(root, 'web-multipage-3', (await saved()).project, { selectedPage: 2 });
  await page.reload();
  await valid();
  assert.equal(await page.locator('#page-counter').textContent(), 'Strona 3 z 3');
  assert.equal(await page.locator('#view-sheet').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  await page.locator('#previous-page').click();
  assert.equal(await page.locator('#page-counter').textContent(), 'Strona 2 z 3');
  for (const [index, name] of [
    [0, 'first'],
    [23, '24'],
    [24, '25'],
    [64, 'last'],
  ]) {
    await page.locator('#preview-select').selectOption({ value: String(index) });
    assert.equal(await page.locator('#preview-select').inputValue(), String(index));
    assert.equal(
      await page.locator('#preview-select option:checked').textContent(),
      String(index + 1),
    );
    assert.match(
      await page.locator('#preview-canvas').getAttribute('aria-label'),
      /Podgląd strony/,
    );
    await saveDownload('#download-png', `numbers40-${name}.png`);
  }
  await exportPdf('multipage-numbers-test.pdf');
  await page.locator('#end-number').fill('48');
  await valid();
  assert.equal(await page.locator('#page-counter').textContent(), 'Strona 2 z 2');
  assert.equal(await page.locator('#next-page').isDisabled(), true);
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  await page.locator('#end-number').fill('24');
  await valid();
  assert.equal(await page.locator('#page-navigation').isHidden(), true);
  assert.equal(await page.locator('#preview-select option').count(), 24);

  await fresh();
  await page.locator('[name=mode][value=text]').check();
  await valid();
  await page.locator('[data-row-field=copies]').first().fill('13');
  await valid();
  await page.locator('.text-row textarea').nth(1).click();
  assert.equal(await page.locator('#preview-select').inputValue(), '13');
  await page.locator('#view-sheet').click();
  assert.equal(await page.locator('#page-counter').textContent(), 'Strona 2 z 2');
  await exportPdf('multipage-copies-test.pdf');
  await page.locator('.text-row textarea').nth(1).fill('ZBYT DŁUGI TEKST W DRUGIM WZORZE');
  await page.waitForFunction(() => !document.querySelector('#auto-fix').hidden);
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  const unexpectedDownloads = [];
  const collectDownload = (download) => unexpectedDownloads.push(download);
  page.on('download', collectDownload);
  await page.locator('#download-pdf').click();
  await page.waitForFunction(() =>
    document.querySelector('#notice').textContent.startsWith('Nie można przygotować PDF.'),
  );
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  assert.equal(unexpectedDownloads.length, 0, 'Błędny projekt nie eksportuje poprzednich ustawień');
  page.off('download', collectDownload);
  await page.locator('#auto-fix').click();
  await valid();
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);

  // Nawigacja stron pozostaje czytelna i działa na najmniejszym ekranie.
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator('#view-sheet').click();
  await page.locator('#previous-page').click();
  assert.equal(await page.locator('#page-counter').textContent(), 'Strona 1 z 2');
  await page.locator('#next-page').click();
  assert.equal(await page.locator('#page-counter').textContent(), 'Strona 2 z 2');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page
    .locator('.preview-card')
    .screenshot({ path: path.join(root, 'output/web-multipage-mobile.png') });
  await archivePreview(root, 'web-multipage-mobile', (await saved()).project, { selectedPage: 1 });
  await page.setViewportSize({ width: 1366, height: 768 });
  console.log(
    'Strony OK: podział numerów i kopii, nawigacja, zapis wybranej strony, brak pustych stron i układ telefonu.',
  );
}

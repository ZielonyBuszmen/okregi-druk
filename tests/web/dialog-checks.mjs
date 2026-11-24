import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { archivePreview } from './preview-history.mjs';

export async function checkDialogs(page, root, artifacts) {
  const valid = () => page.waitForFunction(() => !document.querySelector('#download-png').disabled);
  const readSession = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem(`okregi-project-v1:${location.pathname}`)));
  const rawSession = () =>
    page.evaluate(() => localStorage.getItem(`okregi-project-v1:${location.pathname}`));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await valid();
  await page.locator('#top-text').fill('MOJE KOŁO');
  await page.locator('[name=mode][value=text]').check();
  await valid();
  await page
    .locator('.text-row input[type=file]')
    .first()
    .setInputFiles(path.join(artifacts, 'own.png'));
  await page.waitForFunction(() =>
    document.querySelector('.custom-status').textContent.includes('own.png'),
  );
  await page.locator('[data-row-field=copies]').first().fill('25');
  await page.locator('#diameter').fill('40');
  await valid();
  await page.locator('#appearance-options > summary').click();
  await page.locator('#ring-spacing').selectOption('large');
  await valid();
  await page.locator('#view-sheet').click();
  await page.locator('#next-page').click();
  await page.evaluate(() => localStorage.setItem('reset-test-unrelated', 'keep'));
  await page.locator('#diameter').fill('');
  await page.waitForFunction(() => !document.querySelector('#preview-error').hidden);
  const original = await rawSession();

  await page.locator('#reset-project').click();
  await page.locator('#reset-dialog').waitFor({ state: 'visible' });
  assert.equal(
    await page.locator('#reset-cancel').evaluate((button) => button === document.activeElement),
    true,
  );
  await page.screenshot({ path: path.join(root, 'output/web-reset-dialog.png') });
  const beforeReset = await readSession();
  await archivePreview(root, 'web-reset-dialog', beforeReset.project, beforeReset.ui);
  await page.locator('#reset-cancel').click();
  await page.locator('#reset-dialog').waitFor({ state: 'hidden' });
  assert.equal(await rawSession(), original, 'Anulowanie zachowuje również niekompletne pola');
  assert.equal(await page.locator('#diameter').inputValue(), '');
  await page.locator('#reset-project').click();
  await page.keyboard.press('Escape');
  await page.locator('#reset-dialog').waitFor({ state: 'hidden' });
  assert.equal(await rawSession(), original);

  await page.locator('#reset-project').click();
  await page.locator('#reset-confirm').click();
  await page.waitForFunction(() => document.querySelector('#top-text').value === 'KOMOROWO');
  await valid();
  const defaults = JSON.parse(await readFile(path.join(root, 'config.json')));
  const reset = await readSession();
  assert.deepEqual(reset.project, defaults);
  assert.deepEqual(reset.ui.rawInputs, {});
  assert.deepEqual(reset.ui.openSections, []);
  assert.equal(reset.ui.selectedIndex, 0);
  assert.equal(reset.ui.selectedPage, 0);
  assert.equal(reset.ui.view, 'label');
  assert.equal(await page.evaluate(() => localStorage.getItem('reset-test-unrelated')), 'keep');
  await page.reload();
  await valid();
  assert.deepEqual((await readSession()).project, defaults);
  // Escape po poprzednim potwierdzeniu nie może użyć starego wyniku dialogu.
  await page.locator('#top-text').fill('PO RESECIE');
  await valid();
  const edited = await rawSession();
  await page.locator('#reset-project').click();
  await page.keyboard.press('Escape');
  await page.locator('#reset-dialog').waitFor({ state: 'hidden' });
  assert.equal(await rawSession(), edited);
  await page.locator('#reset-project').click();
  await page.locator('#reset-confirm').click();
  await page.waitForFunction(() => document.querySelector('#top-text').value === 'KOMOROWO');
  await valid();

  // Wstrzymaj tylko końcowy etap biblioteki, aby niezależnie od szybkości
  // komputera obejrzeć popup. Pobierany plik nadal tworzy prawdziwy jsPDF.
  await page.evaluate(() => {
    window.actualPdfConstructor = globalThis.jspdf.jsPDF;
    globalThis.jspdf.jsPDF = function (...args) {
      const pdf = new window.actualPdfConstructor(...args);
      const output = pdf.output.bind(pdf);
      pdf.output = (...options) =>
        new Promise((resolve) => {
          window.finishTestPdf = () => resolve(output(...options));
        });
      return pdf;
    };
  });
  try {
    const pendingDownload = page.waitForEvent('download');
    pendingDownload.catch(() => {});
    await page.locator('#download-pdf').click();
    await page.waitForFunction(() => typeof window.finishTestPdf === 'function');
    assert.equal(await page.locator('#pdf-progress').isVisible(), true);
    assert.equal(await page.locator('#reset-project').isDisabled(), true);
    assert.equal(await page.locator('#download-pdf').isDisabled(), true);
    assert.equal(
      await page
        .locator('.progress-spinner')
        .evaluate((node) => getComputedStyle(node).animationName),
      'progress-spin',
    );
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#pdf-progress').isVisible(), true);
    await page
      .locator('#pdf-progress')
      .screenshot({ path: path.join(root, 'output/web-pdf-progress.png') });
    await archivePreview(root, 'web-pdf-progress', (await readSession()).project);
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page
      .locator('#pdf-progress')
      .screenshot({ path: path.join(root, 'output/web-pdf-progress-mobile.png') });
    await archivePreview(root, 'web-pdf-progress-mobile', (await readSession()).project);
    await page.evaluate(() => window.finishTestPdf());
    const download = await pendingDownload;
    await download.saveAs(path.join(artifacts, 'pdf-progress-test.pdf'));
    await page.locator('#pdf-progress').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#download-pdf').isDisabled(), false);
    assert.equal(await page.locator('#reset-project').isDisabled(), false);
    const document = await PDFDocument.load(
      await readFile(path.join(artifacts, 'pdf-progress-test.pdf')),
    );
    assert.equal(document.getPageCount(), 1);
  } finally {
    await page.evaluate(() => {
      globalThis.jspdf.jsPDF = window.actualPdfConstructor;
      window.finishTestPdf?.();
      delete window.actualPdfConstructor;
      delete window.finishTestPdf;
    });
    await page.setViewportSize({ width: 1366, height: 768 });
  }

  await page.locator('#diameter').fill('');
  await page.locator('#download-pdf').click();
  await page.waitForFunction(() =>
    document.querySelector('#notice').textContent.startsWith('Nie można przygotować PDF.'),
  );
  assert.equal(await page.locator('#pdf-progress').isHidden(), true, 'Błąd również zamyka popup');
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  assert.equal(await page.locator('#reset-project').isDisabled(), false);
  await page.locator('#diameter').fill('37');
  await valid();
  console.log(
    'Okna OK: anulowanie i reset zapisu, Escape, spinner podczas PDF oraz zamknięcie po sukcesie i błędzie.',
  );
}

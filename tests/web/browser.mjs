import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from '../../tools/serve-web.mjs';
import { checkEditorImprovements } from './editor-checks.mjs';
import { archivePreview } from './preview-history.mjs';
import { checkPagination } from './pagination-checks.mjs';
import { checkSimpleControls } from './simple-controls.mjs';
import { checkDialogs } from './dialog-checks.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = process.env.OKREGI_TEST_ARTIFACTS || '/tmp/okregi-web-tests';
await mkdir(artifacts, { recursive: true });
await mkdir(path.join(root, 'output'), { recursive: true });
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const errors = [],
  externalRequests = [];
let page;
async function valid() {
  await page.waitForFunction(() => !document.querySelector('#download-png').disabled, null, {
    timeout: 15000,
  });
}
async function saveDownload(button, name) {
  const pending = page.waitForEvent('download');
  await page.locator(button).click();
  const download = await pending;
  await download.saveAs(path.join(artifacts, name));
}
async function exportPdf(name) {
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  await saveDownload('#download-pdf', name);
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
}

async function resetRoles() {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await valid();
  await page.locator('[name=mode][value=text]').check();
  await valid();
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  context.on('request', (request) => {
    if (!request.url().startsWith(url) && !request.url().startsWith('data:'))
      externalRequests.push(request.url());
  });
  page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await valid();
  await page.evaluate(() => document.fonts.ready);
  assert.ok(
    await page
      .locator('body')
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize) >= 18),
  );
  assert.ok(
    await page
      .locator('#top-text')
      .evaluate(
        (element) =>
          parseFloat(getComputedStyle(element).fontSize) >= 18 &&
          element.getBoundingClientRect().height >= 48,
      ),
  );
  assert.equal(await page.locator('[name=mode][value=numbers]').isChecked(), true);
  assert.equal(await page.locator('#preview-select option').count(), 30);
  assert.equal(await page.locator('#preset-roles').count(), 0);
  assert.equal(await page.locator('#approve').count(), 0);
  await page.locator('[name=mode][value=text]').check();
  await valid();
  assert.equal(await page.locator('#preview-select option').count(), 4);
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  assert.equal(await page.locator('#top-text').inputValue(), 'KOMOROWO');
  assert.equal(await page.locator('#diameter').inputValue(), '37');
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector('#preview-canvas').getContext('2d').getImageData(0, 0, 1, 1).data[3],
    ),
    0,
  );
  await saveDownload('#download-png', 'prezes.png');
  await page.locator('#preview-select').selectOption('2');
  await saveDownload('#download-png', 'skarbnik.png');
  await page.locator('#preview-select').selectOption('0');
  await page.screenshot({ path: path.join(root, 'output/web-preview.png'), fullPage: true });
  await page.locator('#view-sheet').click();
  await page.screenshot({ path: path.join(root, 'output/web-preview-a4.png'), fullPage: true });
  await exportPdf('roles-test.pdf');
  await page.locator('#top-text').fill('NOWY NAPIS');
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  await valid();
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);

  await page.locator('[name=mode][value=numbers]').check();
  await valid();
  assert.equal(await page.locator('#preview-select option').count(), 30);
  await page.locator('#top-text').fill('KOMOROWO');
  await valid();
  await exportPdf('numbers-test.pdf');
  await page.locator('#diameter').fill('40');
  await valid();
  assert.match(await page.locator('#count-label').textContent(), /2 strony A4/);
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  await page.locator('#end-number').fill('15');
  // Pobierz od razu po zmianie: PDF ma zawierać 15, a nie poprzednie 30 kół.
  await exportPdf('diameter40-test.pdf');
  await valid();
  assert.equal(await page.locator('#preview-select option').count(), 15);

  await resetRoles();
  await page.locator('#view-label').click();
  const imageData = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b78a26';
    ctx.fillRect(0, 0, 128, 64);
    return c.toDataURL().split(',')[1];
  });
  await writeFile(path.join(artifacts, 'own.png'), Buffer.from(imageData, 'base64'));
  const chooserPending = page.waitForEvent('filechooser');
  await page.locator('.upload-control').first().focus();
  await page.locator('.upload-control').first().press('Enter');
  const chooser = await chooserPending;
  await chooser.setFiles(path.join(artifacts, 'own.png'));
  await valid();
  await page.waitForFunction(() =>
    document.querySelector('.custom-status').textContent.includes('own.png'),
  );
  await saveDownload('#download-png', 'custom.png');

  // Zamykamy kartę i wracamy do projektu, bez wczytywania pliku JSON.
  await page.locator('#top-text').fill('MOJE KOŁO');
  await page.locator('[data-row-field=copies]').first().fill('3');
  await page.locator('#diameter').fill('40');
  await valid();
  await page.locator('#appearance-options > summary').click();
  await page.locator('#layout-options > summary').click();
  await page.locator('#preview-select').selectOption('3');
  await page.locator('#view-sheet').click();
  await page.close();
  page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await valid();
  assert.equal(await page.locator('#top-text').inputValue(), 'MOJE KOŁO');
  assert.equal(await page.locator('#diameter').inputValue(), '40');
  assert.equal(await page.locator('[data-row-field=copies]').first().inputValue(), '3');
  assert.equal(await page.locator('#preview-select').inputValue(), '3');
  assert.equal(await page.locator('#view-sheet').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#appearance-options').getAttribute('open'), '');
  assert.equal(await page.locator('#layout-options').getAttribute('open'), '');
  assert.match(await page.locator('.custom-status').first().textContent(), /own.png/);
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  await saveDownload('#save-project', 'project.json');
  const saved = JSON.parse(await readFile(path.join(artifacts, 'project.json')));
  assert.equal(saved.rows[0].decoration, 'custom');
  assert.match(saved.rows[0].image, /^data:image\/png/);
  await page.locator('#top-text').fill('ZMIENIONY');
  await valid();
  await page.locator('#import-file').setInputFiles(path.join(artifacts, 'project.json'));
  await valid();
  await page.waitForFunction(() => document.querySelector('#top-text').value === 'MOJE KOŁO');
  assert.equal(await page.locator('.text-row textarea').nth(1).inputValue(), 'SKARBNIK\nKOŁA');
  await writeFile(path.join(artifacts, 'invalid.json'), '{"version":99}');
  await page.locator('#import-file').setInputFiles(path.join(artifacts, 'invalid.json'));
  await page.waitForFunction(() => document.querySelector('#notice').classList.contains('error'));
  assert.equal(await page.locator('#top-text').inputValue(), 'MOJE KOŁO');
  await resetRoles();
  await page.locator('#add-row').click();
  await valid();
  await page.locator('[data-row-field=copies]').last().fill('');
  assert.equal(await page.locator('#download-png').isDisabled(), true);
  await page.locator('.remove-row').last().click();
  await valid();
  assert.equal(await page.locator('#preview-select option').count(), 4);

  // Nawet niekompletny tekst i puste pole liczbowe wracają po odświeżeniu.
  await page.locator('.text-row textarea').first().fill('');
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#preview-error').hidden);
  assert.equal(await page.locator('.text-row textarea').first().inputValue(), '');
  await page.locator('.text-row textarea').first().fill('PREZES');
  await valid();
  await page.locator('#diameter').fill('');
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#preview-error').hidden);
  assert.equal(await page.locator('#diameter').inputValue(), '');
  await page.locator('#diameter').fill('37');
  await valid();
  await resetRoles();
  await page.reload();
  await valid();
  assert.equal(await page.locator('#preview-select option').count(), 4);
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  await checkEditorImprovements(page, root, artifacts);
  await checkSimpleControls(page, root);
  await checkPagination(page, root, { saveDownload, exportPdf });
  await checkDialogs(page, root, artifacts);
  await resetRoles();
  await page.locator('#view-label').click();
  await page.locator('#appearance-options').evaluate((section) => (section.open = false));
  await page.locator('#layout-options').evaluate((section) => (section.open = false));
  await page.evaluate(() => scrollTo(0, 0));
  await page.setViewportSize({ width: 1366, height: 768 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(root, 'output/web-preview.png') });
  await page.screenshot({ path: path.join(root, 'output/web-preview-full.png'), fullPage: true });

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const phone = await mobile.newPage();
  phone.on('pageerror', (error) => errors.push(error.message));
  await phone.goto(url);
  await phone.waitForFunction(() => !document.querySelector('#download-png').disabled);
  assert.equal(
    await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  await phone.screenshot({
    path: path.join(root, 'output/web-preview-mobile.png'),
  });
  await phone.screenshot({
    path: path.join(root, 'output/web-preview-mobile-full.png'),
    fullPage: true,
  });
  await phone.locator('[name=mode][value=text]').check();
  await phone.waitForFunction(() => !document.querySelector('#download-png').disabled);
  const mobileGallery = phone.locator('.text-row').nth(1);
  await mobileGallery.locator('.more-decorations > summary').click();
  await mobileGallery.locator('[data-decoration=captain-duck]').click();
  await phone.waitForFunction(() => !document.querySelector('#download-png').disabled);
  assert.equal(await phone.locator('#preview-select').inputValue(), '2');
  await mobileGallery.screenshot({ path: path.join(root, 'output/web-gallery-mobile.png') });
  const gallerySettings = await phone.evaluate(
    () => JSON.parse(localStorage.getItem(`okregi-project-v1:${location.pathname}`)).project,
  );
  await archivePreview(root, 'web-gallery-mobile', gallerySettings);
  await phone.setViewportSize({ width: 320, height: 740 });
  assert.equal(
    await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  await phone.locator('#top-text').fill('BARDZO DŁUGI NAPIS DLA KOŁA WĘDKARSKIEGO');
  await phone.waitForFunction(() => !document.querySelector('#auto-fix').hidden);
  assert.equal(await phone.locator('#preview-error #auto-fix').count(), 1);
  await phone
    .locator('#preview-error')
    .screenshot({ path: path.join(root, 'output/web-error-mobile.png') });
  const errorSettings = await phone.evaluate(
    () => JSON.parse(localStorage.getItem(`okregi-project-v1:${location.pathname}`)).project,
  );
  await archivePreview(root, 'web-error-mobile', errorSettings);
  await phone.locator('#auto-fix').click();
  await phone.waitForFunction(() => !document.querySelector('#download-png').disabled);
  assert.equal(await phone.locator('#diameter').inputValue(), '37');
  assert.equal(await phone.locator('#download-pdf').isDisabled(), false);
  await mobile.close();

  const settings = await page.evaluate(
    () => JSON.parse(localStorage.getItem(`okregi-project-v1:${location.pathname}`)).project,
  );
  for (const name of ['web-preview', 'web-preview-a4', 'web-preview-mobile']) {
    const previewSettings =
      name === 'web-preview-mobile'
        ? JSON.parse(await readFile(path.join(root, 'config.json')))
        : settings;
    await archivePreview(root, name, previewSettings);
  }

  const prefixServer = createServer(root);
  await new Promise((resolve) => prefixServer.listen(0, '127.0.0.1', resolve));
  try {
    const subPage = await browser.newPage();
    await subPage.goto(`http://127.0.0.1:${prefixServer.address().port}/dist/`);
    await subPage.waitForFunction(() => !document.querySelector('#download-png').disabled);
    assert.equal(await subPage.locator('#top-text').inputValue(), 'KOMOROWO');
    await subPage.close();
  } finally {
    await new Promise((resolve) => prefixServer.close(resolve));
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  await rm(path.join(root, 'output/web-error.png'), { force: true });
  console.log(
    'Przeglądarka OK: tekst i numery, własny obraz, PNG, testowe PDF-y, zapis/wczytanie, PDF bez zatwierdzania, A4, mobile i ścieżka GitHub Pages.',
  );
} catch (error) {
  if (page)
    await page.screenshot({ path: path.join(root, 'output/web-error.png'), fullPage: true });
  console.error('Błędy przeglądarki:', errors);
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

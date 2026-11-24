import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { archivePreview } from './preview-history.mjs';
import { DECORATION_CHOICES } from '../../web/decorations.js';

export async function checkEditorImprovements(page, root, artifacts) {
  const valid = () => page.waitForFunction(() => !document.querySelector('#download-png').disabled);
  const savedProject = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem(`okregi-project-v1:${location.pathname}`)).project,
    );
  const fresh = async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await valid();
  };
  await fresh();
  assert.equal(await page.locator('[name=mode][value=numbers]').isChecked(), true);
  await page.locator('[name=mode][value=text]').check();
  await valid();
  assert.equal(await page.locator('.text-row textarea').nth(0).inputValue(), 'PREZES');
  assert.equal(await page.locator('.text-row textarea').nth(1).inputValue(), 'SKARBNIK\nKOŁA');
  const quickKinds = (row) =>
    row
      .locator('.quick-decorations button')
      .evaluateAll((buttons) => buttons.map((button) => button.dataset.decoration));
  const firstRow = page.locator('.text-row').first();
  const initialSuggestions = await quickKinds(firstRow);
  assert.equal(initialSuggestions.length, 2);
  assert.equal(initialSuggestions[0], 'fishing');
  assert.equal(new Set(initialSuggestions).size, 2);
  assert(!initialSuggestions.includes('none'));
  // Zmiana koloru odrysowuje kafelki, ale nie losuje ich ponownie.
  await page.locator('#ink-color').evaluate((input) => {
    input.value = '#100864';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await valid();
  assert.deepEqual(await quickKinds(firstRow), initialSuggestions);
  await page.locator('#ink-color').evaluate((input) => {
    input.value = '#100863';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await valid();
  await page.locator('#diameter').fill('40');
  await valid();
  assert.deepEqual(await quickKinds(firstRow), initialSuggestions);
  const suggestedKind = (await quickKinds(firstRow))[1];
  await firstRow.locator('.quick-decorations button').nth(1).click();
  await valid();
  assert.equal((await savedProject()).rows[0].decoration, suggestedKind);
  await firstRow.locator('.more-decorations > summary').click();
  await firstRow.locator('[data-decoration=fishing]').click();
  await valid();
  await page.locator('.text-row textarea').nth(1).click();
  assert.equal(await page.locator('#preview-select').inputValue(), '2');
  assert.match(await page.locator('#preview-canvas').getAttribute('aria-label'), /SKARBNIK KOŁA/);
  await page.locator('[data-row-field=copies]').first().fill('3');
  await valid();
  await page.locator('#view-sheet').click();
  await page.locator('.text-row textarea').nth(1).focus();
  assert.equal(await page.locator('#preview-select').inputValue(), '3');
  assert.equal(await page.locator('#view-label').getAttribute('aria-pressed'), 'true');

  const gallery = page.locator('.text-row').nth(1);
  await gallery.locator('.more-decorations > summary').click();
  assert.equal(await gallery.locator('.decoration-choice').count(), 13);
  const kinds = DECORATION_CHOICES.slice(3).map(({ id }) => id);
  assert.equal(kinds.length, 10);
  const images = new Set();
  for (const kind of kinds) {
    await gallery.locator(`[data-decoration="${kind}"]`).click();
    await valid();
    assert.equal(await page.locator('#preview-select').inputValue(), '3');
    assert.equal((await quickKinds(gallery))[0], kind);
    assert.equal((await quickKinds(gallery)).length, 2);
    assert.equal(
      await gallery.locator(`[data-decoration="${kind}"]`).getAttribute('aria-pressed'),
      'true',
    );
    images.add(await page.locator('#preview-canvas').evaluate((canvas) => canvas.toDataURL()));
  }
  assert.equal(images.size, 10, 'Każda ozdoba ma inny rysunek');
  await page.reload();
  await valid();
  assert.equal(await page.locator('#preview-select').inputValue(), '3');
  assert.equal((await savedProject()).rows[1].decoration, 'hope-bucket');
  assert.equal(
    await page.locator('.text-row').nth(1).locator('.more-decorations').getAttribute('open'),
    '',
  );
  await gallery.locator('.more-decorations > summary').click();
  await page.reload();
  await valid();
  assert.equal(await gallery.locator('.more-decorations').getAttribute('open'), null);
  assert.equal((await quickKinds(gallery))[0], 'hope-bucket');
  assert.equal(new Set(await quickKinds(gallery)).size, 2);
  await page
    .locator('.text-row')
    .nth(1)
    .locator('input[type=file]')
    .setInputFiles(path.join(artifacts, 'own.png'));
  await page.waitForFunction(() =>
    document.querySelectorAll('.custom-status')[1].textContent.includes('own.png'),
  );
  await valid();
  assert.equal(await page.locator('#preview-select').inputValue(), '3');
  assert.equal((await quickKinds(gallery))[0], 'custom');
  assert.match(
    await gallery.locator('.quick-decorations img').getAttribute('src'),
    /^data:image\/png/,
  );
  await page.reload();
  await valid();
  assert.equal((await quickKinds(gallery))[0], 'custom');
  assert.equal(await gallery.locator('.more-decorations').getAttribute('open'), null);
  await page.locator('#add-row').click();
  await valid();
  assert.equal(await page.locator('#preview-select').inputValue(), '5');
  const emptySuggestions = await quickKinds(page.locator('.text-row').last());
  assert.equal(emptySuggestions.length, 2);
  assert.equal(new Set(emptySuggestions).size, 2);
  assert(!emptySuggestions.includes('none'));
  assert.equal((await savedProject()).rows.at(-1).decoration, 'none');
  await page.locator('.remove-row').last().click();
  await valid();
  await page.locator('.remove-row').first().click();
  await valid();
  assert.equal(await page.locator('#preview-select').inputValue(), '0');
  assert.match(await page.locator('#preview-canvas').getAttribute('aria-label'), /SKARBNIK/);

  await fresh();
  await page.locator('#appearance-options').evaluate((section) => {
    section.open = true;
  });
  await page.locator('#top-span').fill('35');
  await page.waitForFunction(() => !document.querySelector('#auto-fix').hidden);
  assert.match(
    await page.locator('#preview-error').textContent(),
    /KOMOROWO.*nie mieści się na łuku/,
  );
  const errorGeometry = await page.locator('#auto-fix').evaluate((button) => {
    const frame = document.querySelector('#preview-error');
    const parent = frame.getBoundingClientRect();
    const text = document.querySelector('#preview-error-text').getBoundingClientRect();
    const bounds = button.getBoundingClientRect();
    return {
      inside:
        frame.contains(button) &&
        bounds.left >= parent.left &&
        bounds.right <= parent.right &&
        bounds.bottom <= parent.bottom,
      gap: bounds.top - text.bottom,
    };
  });
  assert.equal(errorGeometry.inside, true);
  assert(errorGeometry.gap >= 0 && errorGeometry.gap <= 20);
  await page.screenshot({
    path: path.join(root, 'output/web-auto-fix-preview.png'),
    fullPage: true,
  });
  const before = await savedProject();
  await archivePreview(root, 'web-auto-fix-preview', before);
  await page.locator('#auto-fix').click();
  await valid();
  const after = await savedProject();
  assert.equal(after.style.ringFontMm, before.style.ringFontMm);
  assert(after.style.topSpan > before.style.topSpan);
  assert.equal(after.style.bottomSpan, before.style.bottomSpan);
  assert.equal(after.style.textRadiusMm, before.style.textRadiusMm);
  assert.equal(after.diameterMm, before.diameterMm);
  assert.equal(after.top, before.top);
  assert.equal(after.bottom, before.bottom);
  assert.equal(after.end, before.end);
  assert.deepEqual(after.rows, before.rows);
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  await page.reload();
  await valid();
  assert.equal((await savedProject()).style.ringFontMm, after.style.ringFontMm);
  await page.locator('#top-text').fill('W'.repeat(80));
  await page.waitForFunction(() => !document.querySelector('#auto-fix').hidden);
  await page.locator('#auto-fix').click();
  await valid();
  const longTitle = await savedProject();
  assert.equal(longTitle.top, 'W'.repeat(80));
  assert.equal(longTitle.style.topSpan, 180);
  assert(longTitle.style.ringFontMm < before.style.ringFontMm);

  // Nadmiar kół przechodzi na kolejne strony bez zmiany ustawień.
  await fresh();
  await page.locator('#end-number').fill('31');
  await valid();
  assert.equal((await savedProject()).end, 31);
  assert.equal((await savedProject()).diameterMm, 37);
  assert.equal(await page.locator('#preview-select option').count(), 31);
  assert.equal((await savedProject()).layout.gapY, 4);
  assert.match(await page.locator('#count-label').textContent(), /2 strony A4/);
  await page.locator('#diameter').fill('40');
  await valid();
  assert.match(await page.locator('#count-label').textContent(), /2 strony A4/);
  await page.locator('#end-number').fill('15');
  await valid();

  await fresh();
  await page.locator('[name=mode][value=text]').check();
  await valid();
  await page.locator('.text-row textarea').nth(1).fill('BARDZO DŁUGI TEKST W ŚRODKU');
  await page.waitForFunction(() => !document.querySelector('#auto-fix').hidden);
  await page.locator('#auto-fix').click();
  await valid();
  assert.equal((await savedProject()).rows[1].text, 'BARDZO DŁUGI TEKST W ŚRODKU');
  assert.equal((await savedProject()).diameterMm, 37);
  assert.equal(await page.locator('#preview-select').inputValue(), '2');
  await page.locator('#appearance-options').evaluate((section) => {
    section.open = true;
  });
  await page.locator('#decoration-options').evaluate((section) => {
    section.open = true;
  });
  await page.locator('#decoration-size').fill('60');
  await page.waitForFunction(() => !document.querySelector('#auto-fix').hidden);
  await page.locator('#auto-fix').click();
  await valid();
  assert((await savedProject()).style.decorationMm < 60);
  await page.locator('#ring-size').fill('12');
  const radiusBeforeCorrection = (await savedProject()).style.textRadiusMm;
  await page.waitForFunction(() => !document.querySelector('#auto-fix').hidden);
  await page.locator('#auto-fix').click();
  await valid();
  assert.equal((await savedProject()).style.textRadiusMm, radiusBeforeCorrection);
  assert.equal(await page.locator('#download-pdf').isDisabled(), false);
  await page.locator('.text-row textarea').first().fill('');
  await page.waitForFunction(() => !document.querySelector('#preview-error').hidden);
  assert.equal(
    await page.locator('#auto-fix').isHidden(),
    true,
    'Program nie wymyśla pustej treści za użytkownika',
  );

  const contactSheet = await page.evaluate(async () => {
    const { DECORATION_CHOICES } = await import('./decorations.js');
    const { renderLabel } = await import('./renderer.js');
    const project = await (await fetch('./config.json')).json();
    project.mode = 'text';
    project.style.fontMm = 4.2;
    project.style.textOffsetY = 2;
    project.rows = DECORATION_CHOICES.slice(3).map(({ id }) => ({
      text: 'WĘDKARZ',
      copies: 1,
      decoration: id,
      image: null,
    }));
    const canvas = document.createElement('canvas');
    canvas.width = 1100;
    canvas.height = 490;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    DECORATION_CHOICES.slice(3).forEach(({ id, title }, index) => {
      const image = renderLabel(project, { text: 'WĘDKARZ', decoration: id });
      const x = (index % 5) * 220;
      const y = Math.floor(index / 5) * 245;
      ctx.drawImage(image, x + 20, y + 10, 180, 180);
      ctx.fillStyle = '#100863';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      const words = title.split(' ');
      ctx.fillText(words.slice(0, 2).join(' '), x + 110, y + 214);
      if (words.length > 2) ctx.fillText(words.slice(2).join(' '), x + 110, y + 236);
    });
    return { image: canvas.toDataURL().split(',')[1], project };
  });
  await writeFile(
    path.join(root, 'output/web-ozdoby.png'),
    Buffer.from(contactSheet.image, 'base64'),
  );
  await archivePreview(root, 'web-ozdoby', contactSheet.project);
  console.log(
    'Edytor OK: wybór wzoru, 10 ozdób, zapis oraz korekta łuków, tekstu, obrazu i układu bez zmiany średnicy.',
  );
}

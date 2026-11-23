import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calculateLayout,
  expandLabels,
  resizeDiameter,
  fitColumns,
  parseProject,
} from '../../web/model.js';

const config = JSON.parse(await readFile(new URL('../../config.json', import.meta.url)));
const project = () =>
  parseProject({
    ...config,
    mode: 'text',
    layout: { ...config.layout, columns: 2, gapX: 4 },
    style: { ...config.style, fontMm: 4.2, textOffsetY: 2 },
  });

test('Nowy projekt zaczyna od numerów 1–30 i średnicy 37 mm', () => {
  const layout = calculateLayout(parseProject(config));
  assert.equal(config.mode, 'numbers');
  assert.equal(layout.labels.length, 30);
  assert.equal(layout.labels[0].text, '1');
  assert.equal(layout.labels.at(-1).text, '30');
  assert(layout.placements.every(({ diameterMm }) => diameterMm === 37));
});

test('Ustawienia początkowe zachowują cztery etykiety i dwa rodzaje ozdób', () => {
  const p = project(),
    layout = calculateLayout(p);
  assert.equal(layout.labels.length, 4);
  assert.deepEqual(
    layout.labels.map((l) => l.text),
    ['PREZES', 'PREZES', 'SKARBNIK\nKOŁA', 'SKARBNIK\nKOŁA'],
  );
  assert.deepEqual(
    layout.labels.map((l) => l.decoration),
    ['fishing', 'fishing', 'coins', 'coins'],
  );
  assert.equal(p.diameterMm, 37);
  assert.deepEqual(
    layout.placements.map((l) => l.diameterMm),
    [37, 37, 37, 37],
  );
  assert.equal(layout.labels[0].key, layout.labels[1].key);
});

test('Numeracja 1–30 mieści się na A4, przy zachowaniu średnicy 37 mm', () => {
  const p = project();
  p.mode = 'numbers';
  p.start = 1;
  p.end = 30;
  p.layout.columns = 5;
  p.layout.gapX = 1;
  const layout = calculateLayout(p);
  assert.deepEqual(
    layout.labels.map((l) => l.text),
    Array.from({ length: 30 }, (_, i) => String(i + 1)),
  );
  assert.equal(layout.width, 189);
  assert.equal(layout.height, 242);
  assert.equal(layout.placements[0].x, 10.5);
  assert.equal(layout.placements[0].y, 27.5);
  assert.equal(layout.rows, 6);
});

test('Układ, który się nie mieści, zgłasza błąd zamiast dodawać strony', () => {
  const p = project();
  p.mode = 'numbers';
  p.start = 1;
  p.end = 30;
  p.diameterMm = 40;
  p.layout.columns = 4;
  p.layout.gapX = 1;
  assert.throws(() => calculateLayout(p), /nie mieści się na A4/);
  assert.equal(p.diameterMm, 40);
});

test('Średnica zmienia proporcje grafiki, niezależnie od układu strony', () => {
  const p = project(),
    larger = resizeDiameter(p, 40);
  assert.equal(larger.diameterMm, 40);
  assert.equal(p.diameterMm, 37);
  assert.equal(larger.style.fontMm / p.style.fontMm, 40 / 37);
  assert.equal(larger.style.rodsScale, p.style.rodsScale);
});

test('Niepełny rząd pozostaje wyśrodkowany', () => {
  const p = project();
  p.rows = [{ text: 'TEST', copies: 3, decoration: 'none', image: null }];
  const { placements } = calculateLayout(p);
  assert.equal(placements[2].x + p.diameterMm / 2, 105);
});

test('Odrzucenie błędnych numerów, pustych napisów, liczby kopii i obrazów', () => {
  const a = project();
  a.mode = 'numbers';
  a.start = 5;
  a.end = 3;
  assert.throws(() => expandLabels(a));
  const b = project();
  b.rows[0].text = ' ';
  assert.throws(() => expandLabels(b));
  const c = project();
  c.rows[0].copies = 1.5;
  assert.throws(() => expandLabels(c));
  const d = project();
  d.rows[0].decoration = 'custom';
  d.rows[0].image = 'https://example.com/image.png';
  assert.throws(() => expandLabels(d));
  const e = project();
  e.rows[0].decoration = 'custom';
  e.rows[0].image = 'data:image/svg+xml;base64,PHN2Zz4=';
  assert.throws(() => expandLabels(e));
});

test('Projekt i własny obraz przechodzą przez zapis JSON bez utraty polskich liter', () => {
  const p = project();
  p.rows[1].text = 'SKARBNIK\nKOŁA';
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))), p);
  assert.throws(() => parseProject({ version: 100 }));
});

test('Dobór kolumn pozostawia dokładną średnicę i uwzględnia marginesy', () => {
  const p = project();
  p.mode = 'numbers';
  p.start = 1;
  p.end = 30;
  p.layout.gapX = 1;
  assert.equal(fitColumns(p), 5);
  p.diameterMm = 40;
  assert.equal(fitColumns(p), 4);
});

test('Import numeracji od zera zachowuje zero', () => {
  const p = parseProject({ ...config, mode: 'numbers', start: 0, end: 2 });
  assert.equal(p.start, 0);
  assert.deepEqual(
    expandLabels(p).map((label) => label.text),
    ['0', '1', '2'],
  );
});

test('Edycja projektu i presetu nie zmienia ustawień początkowych', () => {
  const p = project();
  p.top = 'NOWY';
  p.rows[0].text = 'INNY';
  assert.equal(config.top, 'KOMOROWO');
  assert.equal(config.rows[0].text, 'PREZES');
  assert.equal(project().rows[0].text, 'PREZES');
});

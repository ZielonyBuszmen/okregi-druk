import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, PDFName, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { PNG } from 'pngjs';

const artifacts = process.env.OKREGI_TEST_ARTIFACTS || '/tmp/okregi-web-tests';
const mm = 72 / 25.4;

function imagePixels(stream) {
  const width = stream.dict.lookup(PDFName.of('Width')).asNumber();
  const height = stream.dict.lookup(PDFName.of('Height')).asNumber();
  const space = stream.dict.lookup(PDFName.of('ColorSpace')).toString();
  assert.ok(
    ['/DeviceRGB', '/DeviceGray'].includes(space),
    'Obsługiwane przestrzenie testowych obrazów',
  );
  assert.equal(stream.dict.lookup(PDFName.of('BitsPerComponent')).asNumber(), 8);
  const channels = space === '/DeviceRGB' ? 3 : 1;
  const bytes = decodePDFRawStream(stream).decode();
  const params = stream.dict.lookup(PDFName.of('DecodeParms'));
  const predictor = params?.lookup(PDFName.of('Predictor'))?.asNumber() || 1;
  const stride = width * channels;
  if (predictor === 1) {
    assert.equal(bytes.length, stride * height);
    return bytes;
  }
  assert.ok(predictor >= 10 && predictor <= 15, 'Predyktor PNG');
  assert.equal(bytes.length, (stride + 1) * height);
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const input = y * (stride + 1),
      output = y * stride,
      filter = bytes[input];
    assert.ok(filter <= 4, 'Filtr PNG');
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[output + x - channels] : 0;
      const up = y ? pixels[output + x - stride] : 0;
      const upperLeft = y && x >= channels ? pixels[output + x - stride - channels] : 0;
      let prediction = 0;
      if (filter === 1) prediction = left;
      if (filter === 2) prediction = up;
      if (filter === 3) prediction = Math.floor((left + up) / 2);
      if (filter === 4) {
        const p = left + up - upperLeft;
        const a = Math.abs(p - left),
          b = Math.abs(p - up),
          c = Math.abs(p - upperLeft);
        prediction = a <= b && a <= c ? left : b <= c ? up : upperLeft;
      }
      pixels[output + x] = (bytes[input + 1 + x] + prediction) & 255;
    }
  }
  return pixels;
}

function dpiFromPng(bytes) {
  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'pHYs') {
      assert.equal(bytes[offset + 16], 1, 'Jednostka gęstości PNG: metr');
      return [bytes.readUInt32BE(offset + 8) * 0.0254, bytes.readUInt32BE(offset + 12) * 0.0254];
    }
    offset += length + 12;
  }
  assert.fail('Brak metadanych DPI w PNG');
}

function verifyPage(doc, page, count, diameter) {
  assert.ok(Math.abs(page.getWidth() / mm - 210) < 0.001, 'Szerokość A4');
  assert.ok(Math.abs(page.getHeight() / mm - 297) < 0.001, 'Wysokość A4');
  const contents = page.node.Contents();
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => doc.context.lookup(ref))
      : [contents];
  const content = streams
    .map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1'))
    .join('\n');
  const draws = [...content.matchAll(/(\/I\d+)\s+Do\b/g)].map((match) => match[1]);
  const transforms = [
    ...content.matchAll(
      /([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+cm\b/g,
    ),
  ]
    .map((match) => match.slice(1).map(Number))
    .filter(
      (values) =>
        Math.abs(values[0] / mm - diameter) < 0.001 && Math.abs(values[3] / mm - diameter) < 0.001,
    );
  assert.equal(draws.length, count, 'Liczba kół na stronie');
  assert.equal(transforms.length, count, 'Każde koło ma wybraną średnicę');
  for (const values of transforms) {
    const x = values[4] / mm;
    const y = values[5] / mm;
    assert(x >= 10 - 0.001 && x + diameter <= 200 + 0.001, 'Marginesy poziome');
    assert(y >= 10 - 0.001 && y + diameter <= 287 + 0.001, 'Marginesy pionowe');
  }
  return draws;
}

async function comparePng(page, imageName, pngName) {
  const objects = page.node.Resources().lookup(PDFName.of('XObject'));
  const bytes = await readFile(path.join(artifacts, pngName));
  const expected = PNG.sync.read(bytes);
  assert.ok(dpiFromPng(bytes).every((value) => Math.abs(value - 600) < 0.1));
  const rgb = new Uint8Array(expected.width * expected.height * 3),
    alpha = new Uint8Array(expected.width * expected.height);
  for (let i = 0; i < alpha.length; i++) {
    rgb.set(expected.data.subarray(i * 4, i * 4 + 3), i * 3);
    alpha[i] = expected.data[i * 4 + 3];
  }
  const image = objects.lookup(PDFName.of(imageName.slice(1)));
  assert.equal(Buffer.compare(Buffer.from(imagePixels(image)), rgb), 0, `Piksele RGB: ${pngName}`);
  assert.equal(
    Buffer.compare(Buffer.from(imagePixels(image.dict.lookup(PDFName.of('SMask')))), alpha),
    0,
    `Maska alfa: ${pngName}`,
  );
}

for (const [name, counts, diameter] of [
  ['roles-test.pdf', [4], 37],
  ['numbers-test.pdf', [30], 37],
  ['diameter40-test.pdf', [15], 40],
  ['multipage-numbers-test.pdf', [24, 24, 17], 40],
  ['multipage-copies-test.pdf', [12, 3], 37],
]) {
  const doc = await PDFDocument.load(await readFile(path.join(artifacts, name)));
  assert.equal(doc.getPageCount(), counts.length, name);
  const preferences = doc.catalog.lookup(PDFName.of('ViewerPreferences'));
  assert.equal(preferences.lookup(PDFName.of('PrintScaling')).toString(), '/None');
  const pages = doc.getPages();
  const draws = pages.map((page, index) => verifyPage(doc, page, counts[index], diameter));
  if (name === 'roles-test.pdf') {
    assert.equal(draws[0][0], draws[0][1]);
    assert.equal(draws[0][2], draws[0][3]);
    assert.notEqual(draws[0][0], draws[0][2]);
    await comparePng(pages[0], draws[0][0], 'prezes.png');
    await comparePng(pages[0], draws[0][2], 'skarbnik.png');
  }
  if (name === 'multipage-numbers-test.pdf') {
    assert.equal(new Set(draws.flat()).size, 65, 'Wszystkie numery są różne');
    for (const [pageIndex, labelIndex, file] of [
      [0, 0, 'first'],
      [0, 23, '24'],
      [1, 0, '25'],
      [2, 16, 'last'],
    ])
      await comparePng(pages[pageIndex], draws[pageIndex][labelIndex], `numbers40-${file}.png`);
  }
  if (name === 'multipage-copies-test.pdf') {
    assert(
      draws[0].every((image) => image === draws[0][0]),
      'Pierwsze 12 kopii jest identyczne',
    );
    assert.equal(draws[1][0], draws[0][0], 'Trzynasta kopia przechodzi na kolejną stronę');
    assert.equal(draws[1][1], draws[1][2]);
    assert.notEqual(draws[1][0], draws[1][1]);
    await comparePng(pages[1], draws[1][0], 'prezes.png');
    await comparePng(pages[1], draws[1][1], 'skarbnik.png');
  }
  console.log(
    `${name}: ${counts.length} stron A4, koła na stronach ${counts.join(' + ')}, średnica ${diameter} mm, druk 100%.`,
  );
}

for (const name of ['prezes.png', 'skarbnik.png', 'custom.png']) {
  const bytes = await readFile(path.join(artifacts, name)),
    image = PNG.sync.read(bytes);
  assert.equal(image.width, 874);
  assert.equal(image.height, 874);
  assert.ok(dpiFromPng(bytes).every((value) => Math.abs(value - 600) < 0.1));
  assert.equal(image.data[3], 0);
}
console.log('PNG: 874 × 874 px, 600 DPI, przezroczyste narożniki. Piksele PNG i PDF zgodne.');

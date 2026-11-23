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

for (const [name, count, diameter] of [
  ['roles-test.pdf', 4, 37],
  ['numbers-test.pdf', 30, 37],
  ['diameter40-test.pdf', 15, 40],
]) {
  const doc = await PDFDocument.load(await readFile(path.join(artifacts, name)));
  assert.equal(doc.getPageCount(), 1, name);
  const page = doc.getPages()[0];
  assert.ok(Math.abs(page.getWidth() / mm - 210) < 0.001, 'Szerokość A4');
  assert.ok(Math.abs(page.getHeight() / mm - 297) < 0.001, 'Wysokość A4');
  const preferences = doc.catalog.lookup(PDFName.of('ViewerPreferences'));
  assert.equal(preferences.lookup(PDFName.of('PrintScaling')).toString(), '/None');
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
  assert.equal(draws.length, count, name);
  assert.equal(transforms.length, count, name);
  if (name === 'roles-test.pdf') {
    assert.equal(draws[0], draws[1]);
    assert.equal(draws[2], draws[3]);
    assert.notEqual(draws[0], draws[2]);
    const objects = page.node.Resources().lookup(PDFName.of('XObject'));
    for (const [imageName, pngName] of [
      [draws[0], 'prezes.png'],
      [draws[2], 'skarbnik.png'],
    ]) {
      const expected = PNG.sync.read(await readFile(path.join(artifacts, pngName)));
      const rgb = new Uint8Array(expected.width * expected.height * 3),
        alpha = new Uint8Array(expected.width * expected.height);
      for (let i = 0; i < alpha.length; i++) {
        rgb.set(expected.data.subarray(i * 4, i * 4 + 3), i * 3);
        alpha[i] = expected.data[i * 4 + 3];
      }
      const image = objects.lookup(PDFName.of(imageName.slice(1)));
      assert.equal(
        Buffer.compare(Buffer.from(imagePixels(image)), rgb),
        0,
        `Piksele RGB: ${pngName}`,
      );
      assert.equal(
        Buffer.compare(Buffer.from(imagePixels(image.dict.lookup(PDFName.of('SMask')))), alpha),
        0,
        `Maska alfa: ${pngName}`,
      );
    }
  }
  console.log(`${name}: A4, liczba kół ${count}, średnica ${diameter} mm, druk 100%.`);
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

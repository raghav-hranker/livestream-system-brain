const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const checkout = process.env.VIDYAGRAM_CHECKOUT || process.cwd();
const load = createRequire(path.join(checkout, 'package.json'));
const { verifyPdfBytes } = load(path.join(checkout, 'src/services/apx/apxCatalogPdfImportRun'));
const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n44\n%%EOF\n');
const src = { encrypted: true, key: 'example', version: '1' };
test('complete plaintext flagged encrypted is preserved byte-for-byte', () => {
  assert.deepEqual(verifyPdfBytes(pdf, src), pdf);
});
test('actual version-1 scrambled bytes still decrypt', () => {
  const scrambled = Buffer.from(pdf);
  for (let i = 0; i < 28; i++) scrambled[i] ^= i < src.key.length ? src.key.charCodeAt(i) : i;
  assert.deepEqual(verifyPdfBytes(scrambled, src), pdf);
});
test('a PDF header alone cannot bypass decryption validation', () => {
  assert.throws(() => verifyPdfBytes(Buffer.from('%PDF-1.7\ntruncated'), src));
});

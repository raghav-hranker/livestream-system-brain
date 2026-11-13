const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { decodeLink, matchingLink, resolveStudentLink } = require('./vidyagram-student-pdf.cjs');
const raw = 'https://appx-content-v2.classx.co.in/paid_course4/notes.pdf';
const signed = 'https://static-db-v2.appx.co.in/paid_course4/notes.pdf?Signature=test';
class SessionLost extends Error {}
class SignerThrottled extends Error {}
class PdfFetchError extends Error {}
const args = (response, field = 'pdf_link') => ({ raw, source: { apxCourseId: '103', rowId: '12', field }, token: { token: 'private', apxUserId: '123' }, row: { ytFlag: 1 },
  request: async () => response, SessionLost, SignerThrottled, PdfFetchError });
test('decodes the public viewer AES link format', () => {
  const c = crypto.createCipheriv('aes-128-cbc', Buffer.from('638udh3829162018'), Buffer.from('fedcba9876543210'));
  assert.equal(decodeLink(Buffer.concat([c.update(signed), c.final()]).toString('base64')), signed);
});
test('rejects the same filename in another path, arbitrary hosts and placeholders', () => {
  for (const url of ['https://static-db-v2.appx.co.in/another/notes.pdf', 'https://other.example/paid_course4/notes.pdf', 'https://pdflink.com']) {
    assert.throws(() => matchingLink(raw, [url]), /does not match/);
  }
  assert.equal(matchingLink(raw, [signed]), signed);
});
test('requires student entitlement and exact returned row', async () => {
  for (const data of [{ id: '12', is_purchased: '0', pdf_link: signed }, { id: '13', is_purchased: '1', pdf_link: signed }]) {
    await assert.rejects(resolveStudentLink(args({ status: 200, data: { status: 200, data } })), PdfFetchError);
  }
});
test('maps expired sessions and throttling to the importer stop/backoff controls', async () => {
  await assert.rejects(resolveStudentLink(args({ status: 401, data: {} })), SessionLost);
  await assert.rejects(resolveStudentLink(args({ status: 429, data: {} })), SignerThrottled);
});
test('standalone files select matching file_link and send the matching student identity', async () => {
  const a = args(null, 'link');
  a.request = async ({ params, headers }) => {
    assert.equal(params.video_id, '12'); assert.equal(params.ytflag, '1');
    assert.equal(headers.Authorization, 'private'); assert.equal(headers['User-ID'], '123');
    return { status: 200, data: { status: 200, data: { id: '12', is_purchased: '1', file_link: signed } } };
  };
  assert.equal(await resolveStudentLink(a), signed);
});
test('second notes never fall back to a different PDF slot', async () => {
  await assert.rejects(resolveStudentLink(args({ status: 200, data: { status: 200, data: { id: '12', is_purchased: '1', pdf_link: signed } } }, 'pdf_link2')), PdfFetchError);
});

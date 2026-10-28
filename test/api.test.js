const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.AI_PROVIDER = 'mock';
process.env.RATE_LIMIT_MAX = '1000';

const app = require('../api/index.js');
const { toDataUrl } = require('../services/imageService');

let server;
let base;

before(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const post = (body, raw = false) =>
    fetch(`${base}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw ? body : JSON.stringify(body),
    });

test('health reports ok', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'ok');
});

test('unknown routes 404', async () => {
    assert.equal((await fetch(`${base}/nope`)).status, 404);
});

test('requires content or a manual caption', async () => {
    assert.equal((await post({ platforms: ['x'] })).status, 400);
});

test('rejects unsupported and non-string platforms', async () => {
    assert.equal((await post({ content: 'hi', platforms: ['myspace'] })).status, 400);
    assert.equal((await post({ content: 'hi', platforms: [1] })).status, 400);
    assert.equal((await post({ content: 'hi', platforms: [] })).status, 400);
});

test('rejects non-string fields with 400 instead of crashing', async () => {
    const res = await post({ content: 123, platforms: ['x'] });
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /content/);
});

test('malformed JSON is a 400', async () => {
    assert.equal((await post('{not json', true)).status, 400);
});

test('generates once per platform in mock mode', async () => {
    const res = await post({ content: 'launch day', platforms: ['x', 'X', 'linkedin'] });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), ['linkedin', 'x']);
    assert.ok(body.x.caption);
    assert.ok(body.x.image);
});

test('toDataUrl restores the mime type from base64 magic bytes', () => {
    assert.equal(toDataUrl('/9j/abc'), 'data:image/jpeg;base64,/9j/abc');
    assert.equal(toDataUrl('iVBORabc'), 'data:image/png;base64,iVBORabc');
    assert.equal(toDataUrl('data:image/gif;base64,x'), 'data:image/gif;base64,x');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

// These cases are all rejected before any call to Anthropic, so no network is used.
process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
const { default: handler, config } = await import('../../netlify/functions/chat.mjs');

const URL_ = 'https://pillar.example/api/chat';
const post = (body, headers = {}) =>
  new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });

test('is mounted at /api/chat with a rate limit', () => {
  assert.equal(config.path, '/api/chat');
  assert.ok(config.rateLimit.windowLimit > 0);
});

test('rejects non-POST requests', async () => {
  const res = await handler(new Request(URL_));
  assert.equal(res.status, 405);
});

test('rejects calls from other websites', async () => {
  const res = await handler(post('{}', { origin: 'https://evil.example' }));
  assert.equal(res.status, 403);
});

test('rejects invalid JSON', async () => {
  const res = await handler(post('not json'));
  assert.equal(res.status, 400);
});

test('rejects bad conversations with a 400 and a message', async () => {
  const res = await handler(post(JSON.stringify({ messages: [{ role: 'system', content: 'x' }] })));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /malformed/);
});

test('explains when the API key is not configured', async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const res = await handler(post(JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] })));
    assert.equal(res.status, 500);
    assert.match((await res.json()).error, /not configured/);
  } finally {
    process.env.ANTHROPIC_API_KEY = saved;
  }
});

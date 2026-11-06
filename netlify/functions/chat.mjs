// Netlify Function: POST /api/chat
// The Anthropic API key lives only in the server environment (ANTHROPIC_API_KEY);
// the browser never sees it.
import Anthropic from '@anthropic-ai/sdk';
import { getReply, ChatInputError } from '../../lib/chat-core.mjs';

const client = new Anthropic({ maxRetries: 1, timeout: 30_000 });

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, { error: 'The assistant is not configured yet. You can email Pillarcontractors@gmail.com.' });
  }

  // Only accept calls from this site's own pages.
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) {
    return json(403, { error: 'Forbidden' });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  try {
    const reply = await getReply(client, body?.messages);
    return json(200, { reply });
  } catch (err) {
    if (err instanceof ChatInputError) return json(400, { error: err.message });
    if (err instanceof Anthropic.RateLimitError) {
      return json(503, { error: 'The assistant is busy right now. Please try again in a minute.' });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic key missing or invalid');
      return json(500, { error: 'The assistant is not configured yet.' });
    }
    console.error('chat error', err);
    return json(502, { error: 'The assistant is unavailable right now.' });
  }
};

export const config = {
  path: '/api/chat',
  // Netlify edge rate limit: at most 10 messages per IP per minute.
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

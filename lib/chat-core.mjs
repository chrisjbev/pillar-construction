// Shared chat logic for the Pillar Construction assistant.
// Kept separate from the Netlify handler so it can be unit-tested
// with a fake Anthropic client and no network access.

export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

// Abuse limits: keep requests small so one visitor can't run up the bill.
export const LIMITS = {
  maxMessages: 20,        // turns of history accepted per request
  maxCharsPerMessage: 1000,
  maxTotalChars: 8000,
  maxOutputTokens: 4000,  // includes thinking; replies are asked to be short
};

export const SYSTEM_PROMPT = `You are a friendly assistant on the website of Pillar Construction, a family-owned home remodeling and drywall company in New Jersey. Help visitors learn about the company and guide them toward requesting a free quote.

Company facts (the only facts you may state):
- Started as a family drywall business in the early 1980s; Pillar Construction was formed in 1993.
- Incorporated in 2000 as Pillar Drywall, Inc., still trading as Pillar Construction.
- Has worked in 13+ counties across New Jersey.
- Around 2008 expanded from drywall into full home remodeling.
- Services: drywall installation and finishing, kitchen remodeling, bathroom renovations, flooring (hardwood, tile), decks and stairs, living/dining rooms and hallways. Residential, commercial and industrial projects.
- Clients praise their patience, cleanliness, punctuality, and being upfront about cost and timelines.
- Email: Pillarcontractors@gmail.com

Site pages you can point to by file name: home.html, portfolio.html, ourservices.html, clienttestimonials.html, aboutus.html, contactus.html.

Rules:
- Reply in plain text, 2-4 short sentences. To link a page, write it as [link text](page.html) using only the pages listed above.
- Never quote prices, timelines, license numbers or anything not listed above; for those, invite the visitor to request a free quote on contactus.html.
- If a question is unrelated to the company or home construction, politely steer back.
- Latency-sensitive; begin your visible answer immediately.`;

export class ChatInputError extends Error {}

/** Validate and normalise the visitor's conversation. Throws ChatInputError. */
export function validateMessages(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new ChatInputError('messages must be a non-empty array');
  }
  if (input.length > LIMITS.maxMessages) {
    throw new ChatInputError('conversation is too long; please refresh to start over');
  }
  let total = 0;
  const messages = input.map((m, i) => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      throw new ChatInputError(`message ${i} is malformed`);
    }
    const content = m.content.trim();
    if (!content) throw new ChatInputError(`message ${i} is empty`);
    if (content.length > LIMITS.maxCharsPerMessage) {
      throw new ChatInputError(`message ${i} is too long`);
    }
    total += content.length;
    // Roles must alternate, starting and ending with the visitor.
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (m.role !== expected) throw new ChatInputError('messages must alternate user/assistant');
    return { role: m.role, content };
  });
  if (messages[messages.length - 1].role !== 'user') {
    throw new ChatInputError('last message must be from the user');
  }
  if (total > LIMITS.maxTotalChars) {
    throw new ChatInputError('conversation is too long; please refresh to start over');
  }
  return messages;
}

const FALLBACK_REPLY =
  "Sorry, I can't help with that one. For anything about your project, the team is happy to talk: [request a free quote](contactus.html).";

/** Ask Claude for the next reply. `client` is an Anthropic SDK client (or a test double). */
export async function getReply(client, rawMessages) {
  const messages = validateMessages(rawMessages);

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: LIMITS.maxOutputTokens,
    output_config: { effort: 'low' },
    // If a safety classifier declines, let the API retry on its recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages,
  });

  if (response.stop_reason === 'refusal') return FALLBACK_REPLY;

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  return text || FALLBACK_REPLY;
}

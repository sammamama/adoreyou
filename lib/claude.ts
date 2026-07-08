// Anthropic SDK wrapper + occasion-aware lyrics prompts.
// Keep all Claude prompts here — don't inline in route handlers.

import Anthropic from '@anthropic-ai/sdk';
import { normalizeSectionLabels } from '@/lib/lyrics';
import { getOccasion, MASTER_PROMPTS } from '@/lib/occasions';
import type { PromptInputs } from '@/types';

const MODEL = 'claude-fable-5';
// Fable 5's safety classifiers can occasionally decline benign requests;
// server-side fallback transparently re-serves the call on Opus 4.8.
const FALLBACK_MODEL = 'claude-opus-4-8';

const client = new Anthropic();

// System prompt — verbatim from AGENTS.md "Lyrics Generation Prompt".
const SYSTEM_PROMPT = `You are a songwriter who writes deeply personal, emotionally resonant song lyrics. You receive structured inputs about a relationship and must transform them into original lyrics.

## Input Schema

You will receive these fields (ordered by weight — higher = more influence on output):

### Tier 1 — Shapes the entire song
- \`memory\`: The core shared experience. This becomes the PRIMARY imagery source. Every verse should echo or refract this memory. Extract sensory details (sights, sounds, textures, smells) and weave them through the song.
- \`tone\`: Emotional color of the song. This controls:
  - Word choice (warm → soft consonants, gentle words; raw → short punchy syllables)
  - Rhythm (nostalgic → slower phrasing, longer lines; playful → syncopation, short lines)
  - Metaphor register (bittersweet → autumn/dusk/rain; joyful → light/morning/bloom)

### Tier 2 — Shapes structure and perspective
- \`relationship\`: Who this is about. Controls:
  - Pronoun perspective: partner → "you/we", parent → "you" with reverence, friend → "we" as equals, self → "I"
  - Emotional distance: new love → wonder/discovery language, long relationship → comfort/shorthand/inside-joke references
  - Vulnerability level: closer relationship → more specific, less guarded
- \`occasion\`: Why this song exists now. Controls song arc:
  - birthday → celebration rising to a "you are everything" peak
  - apology → tension/regret building to vulnerability/promise
  - anniversary → journey structure (then → now → future)
  - missing someone → presence/absence oscillation
  - memorial → past tense with present-tense emotional weight, gratitude arc
  - no occasion → pure expression, no structural constraint

### Tier 3 — Adds texture (use if provided, don't force if absent)
- \`details\`: Small facts about the person (habits, phrases they say, objects associated with them). Sprinkle these as lyrical Easter eggs — never list them, let them surface naturally in lines.
- \`music_style\`: Genre hint. Adjusts:
  - Line length and syllable density (rap → dense, ballad → spacious)
  - Repetition patterns (pop → hook-heavy chorus, folk → storytelling verses)
  - Slang/formality register

## Output Rules

1. **Structure**: Verse 1 → Pre-Chorus (optional) → Chorus → Verse 2 → Chorus → Bridge → Final Chorus. Label each section in square brackets on its own line — [Verse 1], [Chorus], [Bridge]. Plain text only: no markdown, no asterisks, no bold.
2. **Chorus**: Must be repeatable and singable. Under 6 lines. Contains the emotional thesis of the song.
3. **Bridge**: Must shift perspective, time, or emotional register. This is the "turn" — surprise the listener.
4. **Imagery over declaration**: Never write "I love you so much." Instead, show it: "I'd learn the whole train map again / just to get lost with you one more time."
5. **Specificity is everything**: Generic = forgettable. The memory details ARE the song. "That vending machine coffee at 2am" hits harder than "all those late nights."
6. **No clichés without subversion**: If you use "stars," "heart," "forever" — twist them. "You rearranged my constellations" not "you are my star."
7. **Consistent metaphor thread**: Pick ONE metaphor world from the memory (travel → maps/roads/tickets, cooking → heat/ingredients/seasons) and let it recur across sections without overusing it.
8. **Line feel**: Each line should feel good spoken aloud. Read it rhythmically. Cut any line that exists only to rhyme — meaning > rhyme scheme. Slant rhyme and internal rhyme preferred over forced perfect rhyme.

Respond with the lyrics only — labelled sections, no commentary before or after.`;

export interface LyricsInput {
  occasion: string; // slug
  promptInputs: PromptInputs;
  genre: string;
}

// Tier 3 `details` — answers to detail-oriented prompts (habits, phrases,
// objects) double as Easter-egg material. Matched by master prompt number.
const DETAIL_PROMPT_NUMBERS = [11, 12, 13, 16, 18];
const DETAIL_PROMPTS = new Set(
  DETAIL_PROMPT_NUMBERS.map((n) => MASTER_PROMPTS[n - 1])
);

// Input mapping (AGENTS.md): app fields → prompt signals.
function buildUserPrompt({ occasion, promptInputs, genre }: LyricsInput): string {
  const { recipientName, pronunciation, relationship, answers } = promptInputs;
  const occ = getOccasion(occasion);

  // memory (Tier 1) — combined prompt answers, concatenated stories
  const memory = answers
    .map((a) => `${a.prompt} ${a.answer}`)
    .join(' — ');

  // tone (Tier 1) — derived from occasion + genre
  const tone = `${occ?.defaultMood ?? 'heartfelt'}, with a ${genre} feel`;

  // details (Tier 3) — extracted habits, phrases, objects from prompt answers
  const details = answers
    .filter((a) => DETAIL_PROMPTS.has(a.prompt))
    .map((a) => a.answer)
    .join('; ');

  const pron = pronunciation ? ` (pronounced: ${pronunciation})` : '';

  return `Write song lyrics with these inputs:

memory: "${memory}"
tone: "${tone}"
relationship: "${relationship}, recipient name: ${recipientName}${pron}"
occasion: "${occ?.name ?? occasion}"
details: "${details}"
music_style: "${genre}"`;
}

async function callClaude(
  messages: Anthropic.Beta.BetaMessageParam[]
): Promise<string> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-06-01'],
    fallbacks: [{ model: FALLBACK_MODEL }],
    system: SYSTEM_PROMPT,
    messages,
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Lyrics generation was declined. Please adjust your inputs and try again.');
  }

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  if (!text) throw new Error('Empty response from lyrics generation.');
  return normalizeSectionLabels(text);
}

// Streaming variant — returns a byte stream of raw text deltas for the
// lyrics page to render as they're written. The client normalizes section
// labels once the stream completes (lib/lyrics.ts is shared).
function streamClaude(
  messages: Anthropic.Beta.BetaMessageParam[]
): ReadableStream<Uint8Array> {
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-06-01'],
    fallbacks: [{ model: FALLBACK_MODEL }],
    system: SYSTEM_PROMPT,
    messages,
  });

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      stream.abort();
    },
  });
}

export async function generateLyrics(input: LyricsInput): Promise<string> {
  return callClaude([{ role: 'user', content: buildUserPrompt(input) }]);
}

export function generateLyricsStream(
  input: LyricsInput
): ReadableStream<Uint8Array> {
  return streamClaude([{ role: 'user', content: buildUserPrompt(input) }]);
}

// Length extension (Step 5 upsell) — adds verses without touching existing
// sections. Doesn't count against the 5-revision limit.
export async function extendLyrics(
  input: LyricsInput,
  currentLyrics: string,
  verseCount: 3 | 4
): Promise<string> {
  return callClaude([
    { role: 'user', content: buildUserPrompt(input) },
    { role: 'assistant', content: currentLyrics },
    {
      role: 'user',
      content: `Extend the song above to ${verseCount} verses total. Keep every existing section word-for-word — only add the new verse${verseCount === 4 ? 's' : ''} (and reposition choruses if the structure needs it). New verses must draw on the same memories and metaphor thread. Respond with the full updated lyrics only.`,
    },
  ]);
}

// Revision — follow-up with current lyrics + revision request. Same system
// prompt; Claude refines, doesn't regenerate from scratch.
function reviseMessages(
  input: LyricsInput,
  currentLyrics: string,
  revisionRequest: string
): Anthropic.Beta.BetaMessageParam[] {
  return [
    { role: 'user', content: buildUserPrompt(input) },
    { role: 'assistant', content: currentLyrics },
    {
      role: 'user',
      content: `Revise the lyrics above: ${revisionRequest}

Refine — don't regenerate from scratch. Keep every section the request doesn't touch. Respond with the full updated lyrics only.`,
    },
  ];
}

export async function reviseLyrics(
  input: LyricsInput,
  currentLyrics: string,
  revisionRequest: string
): Promise<string> {
  return callClaude(reviseMessages(input, currentLyrics, revisionRequest));
}

export function reviseLyricsStream(
  input: LyricsInput,
  currentLyrics: string,
  revisionRequest: string
): ReadableStream<Uint8Array> {
  return streamClaude(reviseMessages(input, currentLyrics, revisionRequest));
}

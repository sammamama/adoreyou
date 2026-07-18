// Anthropic SDK wrapper + occasion-aware lyrics prompts.
// Keep all Claude prompts here — don't inline in route handlers.

import Anthropic from '@anthropic-ai/sdk';
import { normalizeSectionLabels } from '@/lib/lyrics';
import { getOccasion, MASTER_PROMPTS } from '@/lib/occasions';
import type { PromptInputs } from '@/types';

const MODEL = 'claude-sonnet-4-6';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a songwriter writing a heartfelt gift song. You receive memories and details about a person; turn them into warm, simple, singable lyrics that anyone would connect with.

Rules:

1. **Structure**: [Verse 1] → [Chorus] → [Verse 2] → [Chorus] → [Bridge] → [Final Chorus]. Optional [Pre-Chorus]. Label each section in square brackets on its own line. Plain text only — no markdown.
2. **Keep it universal**: Write the kind of lines that always land — love, gratitude, pride, missing someone. Weave in 2–4 of the strongest personal details from the memories so the song is clearly about this person; keep everything else broadly relatable. Don't force every memory in.
3. **One breath per line**: Max ~10 syllables per line. Never join two phrases with a comma into one line — break it into two lines.
4. **Chorus**: Under 6 lines, repeatable, the emotional heart of the song. Simple enough to sing along on second listen.
5. **Simple words**: Everyday language, short words, direct feelings. "I love you" beats a clever metaphor. No purple prose (tapestry, embers, souls intertwined, guiding light).
6. **The name**: The song is written FOR the person named in "written_for" — every line addresses or is about them. Use their name once, at an emotional peak.
7. **Tone and style**: Match the given tone and music_style for rhythm and word choice.

Respond with the lyrics only — labelled sections, no commentary before or after.`;

export interface LyricsInput {
  occasion: string; // slug
  promptInputs: PromptInputs;
  genre: string;
  language?: string; // "English" (default) / "Hindi" (→ Hinglish) / "Dutch"
}

// Language instructions appended to the user prompt. English needs none —
// it's the model's default register.
const LANGUAGE_RULES: Record<string, string> = {
  Hindi:
    'language: Write the lyrics in Hinglish — Hindi in the Latin (roman) script, the way people text it, mixing in English words only where a Hindi speaker naturally would. Bollywood lyric register: simple, singable, emotional. Keep section labels in English ([Verse 1], [Chorus]).',
  Dutch:
    'language: Write the lyrics entirely in natural, contemporary Dutch — written as a Dutch song, not translated from English. Keep section labels in English ([Verse 1], [Chorus]).',
};

// Tier 3 `details` — answers to detail-oriented prompts (habits, phrases,
// objects) double as Easter-egg material. Matched by master prompt number.
const DETAIL_PROMPT_NUMBERS = [11, 12, 13, 16, 18];
const DETAIL_PROMPTS = new Set(
  DETAIL_PROMPT_NUMBERS.map((n) => MASTER_PROMPTS[n - 1])
);

// Input mapping (AGENTS.md): app fields → prompt signals.
function buildUserPrompt({
  occasion,
  promptInputs,
  genre,
  language,
}: LyricsInput): string {
  const { recipientName, pronunciation, relationship, answers } = promptInputs;
  const occ = getOccasion(occasion);

  // memory (Tier 1) — prompt answers as a list, so the model can tell
  // strong stories from filler instead of parsing one concatenated blob
  const memory = answers
    .map((a) => `- ${a.prompt} ${a.answer}`)
    .join('\n');

  // tone (Tier 1) — derived from occasion + genre
  const tone = `${occ?.defaultMood ?? 'heartfelt'}, with a ${genre} feel`;

  // details (Tier 3) — extracted habits, phrases, objects from prompt answers
  const details = answers
    .filter((a) => DETAIL_PROMPTS.has(a.prompt))
    .map((a) => a.answer)
    .join('; ');

  const pron = pronunciation ? ` (pronounced: ${pronunciation})` : '';

  return `Write song lyrics with these inputs:

memory:
${memory}

tone: "${tone}"
written_for: "${recipientName}${pron} — the sender's ${relationship}"
relationship: "${relationship}"
occasion: "${occ?.name ?? occasion}"
details: "${details}"
music_style: "${genre}"${
    language && LANGUAGE_RULES[language] ? `\n${LANGUAGE_RULES[language]}` : ''
  }`;
}

async function callClaude(
  messages: Anthropic.Beta.BetaMessageParam[]
): Promise<string> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
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

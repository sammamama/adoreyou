// Anthropic SDK wrapper + occasion-aware lyrics prompts.
// Keep all Claude prompts here — don't inline in route handlers.

import Anthropic from '@anthropic-ai/sdk';
import { normalizeSectionLabels } from '@/lib/lyrics';
import { getOccasion, MASTER_PROMPTS } from '@/lib/occasions';
import type { PromptInputs } from '@/types';

const MODEL = 'claude-sonnet-4-6';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a songwriter who writes deeply personal, emotionally resonant song lyrics. You receive structured inputs about a relationship and must transform them into original lyrics.

## Input Schema

You will receive these fields (ordered by weight — higher = more influence on output):

### Tier 1 — The song IS this material
- \`memory\`: The sender's own stories, as a list, in their own words. This is the entire substance of the song — center every section on it. Find the one or two strongest stories and build the song around them; weaker ones contribute single lines or nothing. Extract sensory details (sights, sounds, textures, smells) and weave them through. Prefer the sender's exact phrasing over your paraphrase — their plain words carry more weight than anything you invent.
- \`tone\`: Emotional color of the song. This controls:
  - Word choice (warm → soft consonants, gentle words; raw → short punchy syllables)
  - Rhythm (nostalgic → slower phrasing, longer lines; playful → syncopation, short lines)
  - Tone does NOT control imagery. All imagery comes from the memory itself — never from stock associations with a mood.

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
- \`details\`: Small facts about the person (habits, phrases they say, objects associated with them). If the sender quotes something the person actually says — a catchphrase, a pet name, a private joke — put it in the song verbatim; nothing lands harder than their own words sung back. Never list details; let them surface naturally in lines.
- \`music_style\`: Genre hint. Adjusts:
  - Line length and syllable density (rap → dense, ballad → spacious)
  - Repetition patterns (pop → hook-heavy chorus, folk → storytelling verses)
  - Slang/formality register

## Output Rules

1. **Structure**: Verse 1 → Pre-Chorus (optional) → Chorus → Verse 2 → Chorus → Bridge → Final Chorus. Label each section in square brackets on its own line — [Verse 1], [Chorus], [Bridge]. Plain text only: no markdown, no asterisks, no bold.
2. **Chorus**: Must be repeatable and singable. Under 6 lines. Contains the emotional thesis of the song.
3. **Bridge**: Must shift perspective, time, or emotional register. This is the "turn" — surprise the listener.
4. **Rhyme scheme**: Verses rhyme ABAB. Shift the scheme in the chorus and bridge (AABB or ABCB) so the section change is felt in the rhyme. Slant rhyme and internal rhyme preferred over forced perfect rhyme — and never bend a line's meaning to land a rhyme. Meaning beats rhyme, always.
5. **Plain beats ornate**: Avoiding cliché does NOT mean reaching for complicated words. If something can be said simply and directly, say it simply and directly. The most devastating line in the song should be the plainest one. Understatement over sentimentality.
6. **Imagery over declaration**: Prefer to show it through a specific moment from the memory. if something is not explictly mention it is allowed to user generic stuff like "I love you so much"
7. **Specificity is everything**: Generic = forgettable. The small real details from the memory ARE the song — a named street, an exact time, the actual food, the real weather.
8. **Banned words and phrases**: tapestry, embers, whisper/whispered, echoes, souls intertwined, journey, through it all, every step of the way, shadows and light, come what may, heart of gold, guiding light, guiding star, chapter of our lives, dance in the rain. If tempted by "stars," "heart," or "forever" — twist them into something only this sender and recipient would recognize, or cut them.
9. **Metaphor thread**: At most ONE metaphor world, drawn from the memory itself, recurring lightly across sections. If the memories are strong enough on their own, skip metaphor entirely — a plain retelling of a real moment often hits hardest.
10. **The name**: Use the recipient's name at most once, at the emotional peak — or not at all. The song must be unmistakably about them even without the name.
11. **Never reuse examples**: Do not reuse any example image, line, or phrase from these instructions in the lyrics. Every image must come from this sender's memory.
12. **Line feel**: Each line should feel good spoken aloud. Read it rhythmically. Cut any line that exists only to rhyme.

Before finalizing: delete or rewrite any line that could appear in a song about somebody else. Every section must contain at least one detail that could only be about this person.

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

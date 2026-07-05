// Single source of truth for occasions: master prompt pool, per-occasion
// curation, themes (gift reveal + mesh card tints), and default moods.

import type { Occasion, OccasionSlug } from '@/types';

// Master prompt pool — 18 prompts. Per-occasion curation below maps by
// 1-based prompt number (matches AGENTS.md table).
export const MASTER_PROMPTS: readonly string[] = [
  /* 1 */ "The last time they made you laugh until it hurt...",
  /* 2 */ "Nobody knows this about them, but...",
  /* 3 */ "The most 'them' thing they've ever done...",
  /* 4 */ "A small thing they do that means everything...",
  /* 5 */ "They don't know you noticed, but...",
  /* 6 */ "The inside joke that will never not be funny...",
  /* 7 */ "You knew they loved you when...",
  /* 8 */ "The moment with them you'd relive on loop...",
  /* 9 */ "The thing they taught you without realizing...",
  /* 10 */ "The version of yourself you are around them...",
  /* 11 */ "Their most annoying habit that you secretly love...",
  /* 12 */ "The thing you always say to each other...",
  /* 13 */ "They light up when someone mentions...",
  /* 14 */ "The thing you hope they never stop doing...",
  /* 15 */ "If you had 10 seconds on a billboard, you'd tell them...",
  /* 16 */ "The meal, place, or smell that is just... them...",
  /* 17 */ "They'd be embarrassed if they knew you remembered this...",
  /* 18 */ "If they had a catchphrase, it'd be...",
];

// 1-based prompt numbers from MASTER_PROMPTS, 10 per occasion.
const PROMPT_CURATION: Record<OccasionSlug, number[]> = {
  birthday: [1, 2, 3, 6, 8, 11, 13, 14, 17, 18],
  wedding: [4, 5, 7, 8, 10, 11, 12, 14, 16, 17],
  anniversary: [4, 5, 7, 8, 11, 12, 14, 16, 17, 18],
  'fathers-day': [1, 2, 5, 7, 9, 13, 14, 16, 17, 18],
  'mothers-day': [2, 4, 5, 7, 8, 9, 13, 14, 16, 17],
  graduation: [1, 2, 3, 7, 8, 9, 10, 14, 15, 17],
  memorial: [2, 4, 5, 8, 9, 10, 12, 14, 16, 18],
  friendship: [1, 3, 6, 8, 10, 11, 12, 13, 15, 17],
  'thank-you': [2, 3, 4, 5, 7, 9, 10, 14, 15, 16],
};

function promptsFor(slug: OccasionSlug): string[] {
  return PROMPT_CURATION[slug].map((n) => MASTER_PROMPTS[n - 1]);
}

// theme.colors = 4-color mesh gradient set (tint of the base
// #000000/#126bab/#f75092/#9f50d3 palette); theme.accent = occasion accent
// used on the gift reveal page.
export const OCCASIONS: Occasion[] = [
  {
    slug: 'birthday',
    name: 'Birthday',
    description: 'Turn their day into a song they’ll replay every year.',
    prompts: promptsFor('birthday'),
    theme: {
      colors: ['#000000', '#f59e0b', '#f75092', '#9f50d3'],
      accent: '#F59E0B',
    },
    defaultMood: 'joyful',
  },
  {
    slug: 'wedding',
    name: 'Wedding',
    description: 'A first dance written from your own story.',
    prompts: promptsFor('wedding'),
    theme: {
      colors: ['#1c1917', '#e8b4b8', '#f75092', '#c084fc'],
      accent: '#E11D48',
    },
    defaultMood: 'romantic',
  },
  {
    slug: 'anniversary',
    name: 'Anniversary',
    description: 'Every year together, sung back to them.',
    prompts: promptsFor('anniversary'),
    theme: {
      colors: ['#000000', '#9f1239', '#f75092', '#9f50d3'],
      accent: '#BE123C',
    },
    defaultMood: 'nostalgic',
  },
  {
    slug: 'fathers-day',
    name: "Father's Day",
    description: 'Everything he taught you, in three minutes.',
    prompts: promptsFor('fathers-day'),
    theme: {
      colors: ['#000000', '#126bab', '#0d9488', '#475569'],
      accent: '#126BAB',
    },
    defaultMood: 'warm',
  },
  {
    slug: 'mothers-day',
    name: "Mother's Day",
    description: 'She’s heard every song — never one about her.',
    prompts: promptsFor('mothers-day'),
    theme: {
      colors: ['#1c1917', '#f472b6', '#f75092', '#c084fc'],
      accent: '#DB2777',
    },
    defaultMood: 'tender',
  },
  {
    slug: 'graduation',
    name: 'Graduation',
    description: 'An anthem for everything they worked for.',
    prompts: promptsFor('graduation'),
    theme: {
      colors: ['#000000', '#126bab', '#f59e0b', '#9f50d3'],
      accent: '#D97706',
    },
    defaultMood: 'triumphant',
  },
  {
    slug: 'memorial',
    name: 'In Memory',
    description: 'A gentle way to keep their song playing.',
    prompts: promptsFor('memorial'),
    theme: {
      colors: ['#000000', '#334155', '#64748b', '#7c8db5'],
      accent: '#64748B',
    },
    defaultMood: 'bittersweet',
  },
  {
    slug: 'friendship',
    name: 'Friendship',
    description: 'For the friend who deserves more than a text.',
    prompts: promptsFor('friendship'),
    theme: {
      colors: ['#1c1917', '#fb923c', '#f75092', '#9f50d3'],
      accent: '#EA580C',
    },
    defaultMood: 'playful',
  },
  {
    slug: 'thank-you',
    name: 'Thank You',
    description: 'Say what a card never could.',
    prompts: promptsFor('thank-you'),
    theme: {
      colors: ['#000000', '#0d9488', '#f75092', '#fb923c'],
      accent: '#0D9488',
    },
    defaultMood: 'heartfelt',
  },
];

export function getOccasion(slug: string): Occasion | undefined {
  return OCCASIONS.find((o) => o.slug === slug);
}

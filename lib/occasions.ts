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
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_131838_751e9bb9-f878-444b-a6d8-450bce199326.mp4',
    posterUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_131745_b282f608-64db-460b-bce0-632257c64aa0_min.webp',
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
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_132146_86d966fc-25ab-49f1-aff4-8eeb0240a6c4.mp4',
    posterUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_132108_a1a32918-f7ca-4e2f-a1d5-c182dae155f7_min.webp',
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
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_132403_d60ea5d7-0302-4361-bad0-f5b0eb55afd2.mp4',
    posterUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_132316_04710536-dec1-42f6-9361-b008921abb93_min.webp',
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
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_132608_f56478e4-b64c-47e0-a75e-7ca8779a6a05.mp4',
    posterUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_132530_aab8dd39-432c-4708-8f73-28d6d32c21e1_min.webp',
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
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_130757_ae67939d-f1ff-4cba-a16f-136f3db7aaa3.mp4',
    posterUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_130549_76639eb7-c061-4ba8-9a29-cfead752d842_min.webp',
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
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_135450_45ea2740-cd16-42a2-b999-d065b00ef95a.mp4',
    posterUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_135400_2e6cf29b-d82c-49ee-b3c8-eb29de399511_min.webp',
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
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_133122_65481498-6c8c-49bb-9a6a-7881aec81e8e.mp4',
    posterUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_133043_8f1042b2-e1df-460f-848b-627607e7fa72_min.webp',
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
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_133419_3ea4dbaf-56a9-46b9-a161-88f7eb37d85d.mp4',
    posterUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_133338_84837369-8ca7-4d6d-bf00-709f15418ad7_min.webp',
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
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_133648_590f12b2-5750-437c-8005-c38939d47d61.mp4',
    posterUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S/hf_20260708_133605_b37ab580-6142-4f71-8afe-e529c9960719_min.webp',
  },
];

export function getOccasion(slug: string): Occasion | undefined {
  return OCCASIONS.find((o) => o.slug === slug);
}

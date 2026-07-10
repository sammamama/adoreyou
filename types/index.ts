// Shared types across app, API routes, and lib

export type SongStatus = 'generating' | 'preview' | 'paid' | 'done' | 'failed';

export type TrackKind = 'original' | 'regen';

// Stored in songs.tracks (Json column)
export interface Track {
  sunoTrackId: string;
  audioUrl: string; // full audio — server-side only until paid
  storageKey?: string; // S3 key once archived (Suno CDN expires ~1 week)
  genre: string;
  kind: TrackKind;
  unlocked: boolean;
}

export type OccasionSlug =
  | 'birthday'
  | 'wedding'
  | 'anniversary'
  | 'fathers-day'
  | 'mothers-day'
  | 'graduation'
  | 'memorial'
  | 'friendship'
  | 'thank-you';

export interface OccasionTheme {
  colors: string[];
  accent: string;
}

export interface Occasion {
  slug: OccasionSlug;
  name: string;
  description: string; // one-line pitch on landing page
  prompts: string[]; // curated guided questions (10 per occasion)
  theme: OccasionTheme; // gift reveal styling
  defaultMood: string;
  videoUrl?: string; // landing card background video (replaces mesh gradient)
  posterUrl?: string; // still frame shown before video loads / on mobile
}

// Stored in songs.upsells (Json column)
export interface Upsells {
  songLength: 2 | 3 | 4; // verses; 2 = included in base
  keepEveryVersion: boolean; // unlock ALL tracks generated for this song
  regenGenre?: string; // set if Regenerate in New Genre purchased
  regenPending?: boolean; // regen render in flight — song stays `paid` until it resolves
  regenPickPending?: boolean; // regen pair landed — waiting on the final pick from all versions
  regenRefunded?: boolean; // regen line item auto-refunded after a failed render (decision #6)
}

// Stored in songs.promptInputs (Json column)
export interface PromptInputs {
  recipientName: string;
  pronunciation?: string;
  relationship: string;
  answers: { prompt: string; answer: string }[]; // at least 4
}

// Stored in songs.styleInputs (Json column)
export interface StyleInputs {
  genre: string;
  mood?: string;
  tempo?: string;
  voice?: string; // vocal preference, e.g. "female" / "male"
}

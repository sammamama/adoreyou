// Zustand draft store — survives refresh via localStorage (persist).
// Cleared after successful payment via clearDraft().

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PromptAnswer {
  prompt: string;
  answer: string;
}

interface Draft {
  occasion: string | null;
  recipientName: string;
  pronunciation: string;
  relationship: string;
  promptAnswers: PromptAnswer[];
  genre: string;
  mood: string;
  tempo: string;
  voice: string;
  language: string;
  lyrics: string;
  // Full generations spent (max 3, mirrors the server cap) — erasing the
  // canvas re-arms Generate but each use burns an attempt.
  generationsUsed: number;
  // Last server-generated version — restore path once attempts run out.
  generatedLyrics: string;
  revisionsUsed: number; // AI revisions spent (max 5) — direct edits are free
  verseCount: 2 | 3 | 4;
  songId: string | null;
  // Preview step (Step 6) — track index picked + preview upsells
  selectedTrackId: number | null;
  keepEveryVersion: boolean;
  regenGenre: string | null;
}

interface DraftStore extends Draft {
  update: (patch: Partial<Draft>) => void;
  // Empty answer removes the entry
  setPromptAnswer: (prompt: string, answer: string) => void;
  clearDraft: () => void;
}

const emptyDraft: Draft = {
  occasion: null,
  recipientName: '',
  pronunciation: '',
  relationship: '',
  promptAnswers: [],
  genre: '',
  mood: '',
  tempo: '',
  voice: '',
  language: 'English',
  lyrics: '',
  generationsUsed: 0,
  generatedLyrics: '',
  revisionsUsed: 0,
  verseCount: 2,
  songId: null,
  selectedTrackId: null,
  keepEveryVersion: false,
  regenGenre: null,
};

export const useDraftStore = create<DraftStore>()(
  persist(
    (set) => ({
      ...emptyDraft,
      update: (patch) => set(patch),
      setPromptAnswer: (prompt, answer) =>
        set((state) => {
          const rest = state.promptAnswers.filter((a) => a.prompt !== prompt);
          return {
            promptAnswers: answer.trim()
              ? [...rest, { prompt, answer }]
              : rest,
          };
        }),
      clearDraft: () => set(emptyDraft),
    }),
    { name: 'adoreyou-draft' }
  )
);

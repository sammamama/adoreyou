import type { Metadata } from 'next';

// Song pages are private post-purchase views — keep them out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SongLayout({ children }: { children: React.ReactNode }) {
  return children;
}

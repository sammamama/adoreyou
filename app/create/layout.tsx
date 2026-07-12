import type { Metadata } from 'next';

// The create funnel is thin, stateful UI — keep it out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}

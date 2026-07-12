'use client';

// Floating glassmorphic navbar (landing page) — frosted pill fixed over the
// blush page. Links to landing sections + the dashboard, accent CTA. The
// page under it adds top padding since the bar takes no layout space.

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import Wordmark from '@/components/Wordmark';

const ease = [0.22, 1, 0.36, 1] as const;

const LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/my-songs', label: 'Your songs' },
];

export default function Navbar() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);

  return (
    <motion.nav
      initial={
        reduced ? { opacity: 0 } : { opacity: 0, y: -16, filter: 'blur(10px)' }
      }
      animate={
        reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }
      }
      transition={{ duration: 0.6, ease }}
      className="fixed inset-x-0 top-4 z-50 px-4"
    >
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 rounded-full border border-white/60 bg-white/55 py-2 pl-6 pr-2 shadow-[0_8px_32px_rgba(28,25,23,0.08)] backdrop-blur-xl">
        <Wordmark className="text-xl" />

        <div className="hidden items-center gap-6 text-sm text-ink/70 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors duration-200 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/#occasions"
            className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Create the Song
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink/70 transition-colors duration-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              {open ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, y: -8, filter: 'blur(10px)' }
            }
            animate={
              reduced
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: 'blur(0px)' }
            }
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, y: -8, filter: 'blur(10px)' }
            }
            transition={{ duration: 0.3, ease }}
            className="mx-auto mt-2 w-full max-w-4xl rounded-3xl border border-white/60 bg-white/55 p-2 shadow-[0_8px_32px_rgba(28,25,23,0.08)] backdrop-blur-xl sm:hidden"
          >
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm text-ink/70 transition-colors duration-200 hover:bg-white/60 hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

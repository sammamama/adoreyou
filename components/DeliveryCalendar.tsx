'use client';

// "Pick the moment" calendar for scheduled gift delivery. A dark panel on
// the light modal — the site is light-only, dark lives inside cards (see
// AGENTS.md Design System). Value in/out is the datetime-local shape
// "YYYY-MM-DDTHH:mm" (local time), so GiftModal's validation and
// new Date(deliverAt) parsing stay unchanged.

import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function DeliveryCalendar({
  value,
  onChange,
}: {
  value: string; // '' or 'YYYY-MM-DDTHH:mm'
  onChange: (value: string) => void;
}) {
  const reduced = useReducedMotion();

  const [selectedDay, timeFromValue] = value ? value.split('T') : ['', ''];
  // Time survives before a day is picked (and if the value is cleared).
  const [time, setTime] = useState(timeFromValue || '09:00');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDay ? new Date(`${selectedDay}T00:00`) : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0
  ).getDate();
  const leadingBlanks = viewMonth.getDay();
  const atCurrentMonth =
    viewMonth.getFullYear() === today.getFullYear() &&
    viewMonth.getMonth() === today.getMonth();

  const moveMonth = (delta: number) =>
    setViewMonth(
      (m) => new Date(m.getFullYear(), m.getMonth() + delta, 1)
    );

  const pickDay = (day: number) => {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    onChange(`${dateKey(d)}T${time}`);
  };

  const pickTime = (t: string) => {
    setTime(t);
    if (selectedDay && t) onChange(`${selectedDay}T${t}`);
  };

  const selected = value ? new Date(value) : null;
  const selectedInPast = selected !== null && selected.getTime() <= Date.now();

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl bg-ink p-5 text-white"
    >
      {/* Month header */}
      <div className="flex items-center justify-between">
        <p className="font-serif text-xl">
          {viewMonth.toLocaleString(undefined, { month: 'long' })}{' '}
          <span className="italic text-accent">{viewMonth.getFullYear()}</span>
        </p>
        <div className="flex gap-1.5">
          {([-1, 1] as const).map((delta) => (
            <button
              key={delta}
              type="button"
              disabled={delta === -1 && atCurrentMonth}
              onClick={() => moveMonth(delta)}
              aria-label={delta === -1 ? 'Previous month' : 'Next month'}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors duration-200 hover:border-white/50 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/15"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-3.5 w-3.5 ${delta === -1 ? '' : 'rotate-180'}`}
                aria-hidden
              >
                <path d="M10 3 5 8l5 5" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Weekday row + day grid */}
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span
            key={i}
            className="text-[11px] font-medium uppercase tracking-wider text-white/35"
            aria-hidden
          >
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const d = new Date(
            viewMonth.getFullYear(),
            viewMonth.getMonth(),
            day
          );
          const past = d.getTime() < today.getTime();
          const isToday = d.getTime() === today.getTime();
          const isSelected = selectedDay === dateKey(d);
          return (
            <button
              key={day}
              type="button"
              disabled={past}
              onClick={() => pickDay(day)}
              aria-pressed={isSelected}
              aria-label={d.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-accent ${
                isSelected
                  ? 'bg-accent font-medium text-white'
                  : past
                    ? 'cursor-not-allowed text-white/20'
                    : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {day}
              {isToday && !isSelected && (
                <span
                  aria-hidden
                  className="absolute bottom-1 h-1 w-1 rounded-full bg-accent"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Time */}
      <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
        <label htmlFor="gift-deliver-time" className="text-sm text-white/60">
          at
        </label>
        <input
          id="gift-deliver-time"
          type="time"
          value={time}
          onChange={(e) => pickTime(e.target.value)}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors duration-200 [color-scheme:dark] focus:border-accent"
        />
      </div>

      {/* Chosen moment, spelled out */}
      <p className="mt-4 text-sm text-white/50">
        {selected ? (
          selectedInPast ? (
            'That moment has already passed — pick one ahead.'
          ) : (
            <>
              Unwraps{' '}
              <span className="font-serif italic text-white">
                {selected.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                at{' '}
                {selected.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </>
          )
        ) : (
          'Choose the day it should arrive.'
        )}
      </p>
    </motion.div>
  );
}

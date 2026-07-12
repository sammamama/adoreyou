import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Privacy policy — AdoreYou',
  description:
    'What AdoreYou collects, why, who we share it with, and how to get your data deleted.',
};

const SECTIONS = [
  {
    title: 'What we collect',
    body: (
      <>
        <p>When you create a song, we collect:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Your email address</strong> — captured at checkout and used
            to send you your song and let you sign back in.
          </li>
          <li>
            <strong>Your answers to the guided prompts</strong> — the memories,
            stories, and details you share about the person the song is for,
            plus your style choices (genre, mood, tempo) and the lyrics we
            generate from them.
          </li>
          <li>
            <strong>Payment details</strong> — handled entirely by Stripe. We
            never see or store your card number; we only record what was
            purchased and the amount.
          </li>
        </ul>
        <p className="mt-3">When you send a song as a gift, we also collect:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>The recipient&rsquo;s name and (optionally) email</strong> —
            used only to deliver the gift.
          </li>
          <li>
            <strong>Your name and personal message</strong> — shown on the
            reveal page.
          </li>
          <li>
            <strong>An optional photo and voice message</strong> — if you add
            them to the reveal page.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Why we collect it',
    body: (
      <p>
        Everything above exists for one reason: to make your song and deliver
        it. Your prompt answers become lyrics, your email gets you your song
        and lets you sign in without a password, and the recipient&rsquo;s
        details are used once — to deliver their gift. We don&rsquo;t use your
        data for advertising, we don&rsquo;t build profiles, and we never sell
        it to anyone.
      </p>
    ),
  },
  {
    title: 'Who we share it with',
    body: (
      <>
        <p>
          We use a small number of services to run AdoreYou. Your data touches
          only these:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Stripe</strong> — payment processing. Your card details go
            directly to Stripe, never to us.
          </li>
          <li>
            <strong>Suno</strong> — music generation. Your prompt answers and
            the finished lyrics are sent to Suno to create the song audio.
          </li>
          <li>
            <strong>Resend</strong> — email delivery for sign-in codes, your
            song, and gift notifications.
          </li>
          <li>
            <strong>Amazon Web Services</strong> — storage for song audio and
            any photos or voice messages you attach to a gift.
          </li>
          <li>
            <strong>Neon</strong> — our database host.
          </li>
        </ul>
        <p className="mt-3">
          Each of these processes your data only to provide their service to
          us. We share nothing with advertisers, data brokers, or anyone else.
        </p>
      </>
    ),
  },
  {
    title: 'If someone made a song about you',
    body: (
      <p>
        Gift senders give us your name (and sometimes your email) so we can
        deliver their gift to you. That&rsquo;s the only thing we use it for —
        you will never receive marketing from us, and we never add your email
        to any list. If you&rsquo;d like the song, your details, or both
        removed entirely, email us at{' '}
        <a
          href="mailto:hello@adoreyou.app"
          className="underline underline-offset-4 text-accent"
        >
          hello@adoreyou.app
        </a>{' '}
        and we&rsquo;ll delete them.
      </p>
    ),
  },
  {
    title: 'How long we keep it',
    body: (
      <p>
        We keep your songs, gifts, and attached photos or voice messages so
        that you and your recipients can return to them — a gift page
        shouldn&rsquo;t vanish. If you want anything deleted sooner, email us
        and we&rsquo;ll remove it, including the stored audio and media files.
      </p>
    ),
  },
  {
    title: 'Your rights',
    body: (
      <p>
        You can ask us at any time to show you what data we hold about you, to
        correct it, or to delete it — including everything held by the
        services listed above. Email{' '}
        <a
          href="mailto:hello@adoreyou.app"
          className="underline underline-offset-4 text-accent"
        >
          hello@adoreyou.app
        </a>{' '}
        and we&rsquo;ll handle it within 30 days. Depending on where you live
        (for example the EU, UK, or California), these rights are also
        guaranteed to you by law.
      </p>
    ),
  },
  {
    title: 'Cookies',
    body: (
      <p>
        We use only the cookies needed to keep you signed in. No analytics
        cookies, no tracking pixels, no third-party advertising cookies.
      </p>
    ),
  },
  {
    title: 'Children',
    body: (
      <p>
        AdoreYou is not directed at children under 13, and we don&rsquo;t
        knowingly collect their data. If you believe a child has used the
        service, contact us and we&rsquo;ll delete the account and its data.
      </p>
    ),
  },
  {
    title: 'Changes to this policy',
    body: (
      <p>
        If we change how we handle your data, we&rsquo;ll update this page and
        revise the date below. Meaningful changes — like adding a new service
        that receives your data — will be called out, not buried.
      </p>
    ),
  },
  {
    title: 'Contact',
    body: (
      <p>
        Questions, requests, or concerns:{' '}
        <a
          href="mailto:hello@adoreyou.app"
          className="underline underline-offset-4 text-accent"
        >
          hello@adoreyou.app
        </a>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-28 pb-24 sm:pt-32">
        <h1 className="font-serif text-4xl sm:text-5xl">
          Privacy <span className="italic text-accent">policy</span>
        </h1>
        <p className="mt-4 text-sm text-ink/40">Last updated: July 12, 2026</p>
        <p className="mt-6 leading-relaxed text-ink/60">
          AdoreYou turns your memories into songs. That means you trust us with
          personal things — stories about people you love, their names, your
          voice. This page explains exactly what we collect, why, and how to
          get it removed. No legalese where plain words will do.
        </p>

        <div className="mt-12 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-serif text-2xl">{section.title}</h2>
              <div className="mt-3 text-sm leading-relaxed text-ink/60">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

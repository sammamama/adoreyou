import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Terms of service — AdoreYou',
  description:
    'The terms governing your use of AdoreYou: licensing, refunds, acceptable use, and liability.',
  alternates: { canonical: '/terms' },
};

const SECTIONS = [
  {
    title: '1. Agreement',
    body: (
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) constitute a binding
        agreement between you and AdoreYou (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) governing your access to and use of adoreyou.app
        (the &ldquo;Service&rdquo;). By using the Service you accept these
        Terms. If you do not accept them, do not use the Service.
      </p>
    ),
  },
  {
    title: '2. The Service',
    body: (
      <p>
        The Service generates original songs from user-supplied inputs using
        third-party generative AI infrastructure. Output is probabilistic and
        non-deterministic; we do not warrant that any generation will meet
        your expectations of quality, accuracy, or fitness for a particular
        purpose. You are able to preview generated tracks prior to purchase,
        and your purchase decision is made on the basis of that preview.
      </p>
    ),
  },
  {
    title: '3. License and ownership',
    body: (
      <>
        <p>
          Upon payment, we grant you a worldwide, perpetual, non-exclusive,
          royalty-free license to use, reproduce, and distribute your
          purchased song for personal, non-commercial purposes, including
          gifting, sharing, and public posting attributed to yourself.
          Commercial exploitation (synchronization, monetized distribution,
          resale, streaming-platform release) is not licensed.
        </p>
        <p className="mt-3">
          You acknowledge that AI-generated audio may not constitute
          copyrightable subject matter in some jurisdictions, and that no
          assignment of copyright is made or implied. Rights in the underlying
          generation models remain with their respective providers.
        </p>
        <p className="mt-3">
          You retain all rights in the inputs you supply (prompt answers,
          photos, voice recordings, personal messages) and grant us a limited
          license to process them solely to provide the Service.
        </p>
      </>
    ),
  },
  {
    title: '4. Payments and refunds',
    body: (
      <>
        <p>
          Payment is processed by Stripe. All prices are as displayed at
          checkout. Because songs are digital goods generated and delivered on
          demand, and because you preview tracks before paying,{' '}
          <strong>all sales are final once a purchased track is unlocked</strong>
          , subject to the following exceptions:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            If generation fails and no usable track is delivered, we will
            regenerate at no cost or issue a full refund, at your election.
          </li>
          <li>
            If you are charged but the purchased track is never unlocked, we
            will issue a full refund.
          </li>
        </ul>
        <p className="mt-3">
          Refund requests must be submitted to hello@adoreyou.app within 14
          days of purchase. Nothing in this section limits non-waivable
          statutory consumer rights in your jurisdiction.
        </p>
      </>
    ),
  },
  {
    title: '5. Acceptable use',
    body: (
      <>
        <p>You must not use the Service to:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            create content that harasses, defames, threatens, or intentionally
            humiliates any person;
          </li>
          <li>
            impersonate any person or misrepresent a song&rsquo;s origin;
          </li>
          <li>
            upload photos, recordings, or personal data of a third party
            without lawful basis to do so;
          </li>
          <li>
            infringe any third party&rsquo;s intellectual property, privacy,
            or publicity rights;
          </li>
          <li>
            circumvent access controls, probe or disrupt the Service, or
            access it by automated means except as permitted.
          </li>
        </ul>
        <p className="mt-3">
          We may remove content and suspend or terminate access for violation
          of this section, without refund where the violation is material.
        </p>
      </>
    ),
  },
  {
    title: '6. Gift recipients',
    body: (
      <p>
        Where you supply a recipient&rsquo;s name, email address, or likeness,
        you represent that you are lawfully entitled to do so and that the
        disclosure will not violate the recipient&rsquo;s rights. Recipient
        data is processed as described in our Privacy Policy. You indemnify us
        against claims arising from your breach of this representation.
      </p>
    ),
  },
  {
    title: '7. Third-party dependencies',
    body: (
      <p>
        The Service depends on third-party providers (including music
        generation, payment, email, and storage infrastructure). We are not
        liable for degradation or unavailability attributable to such
        providers, though Section 4 remedies apply where a paid deliverable is
        not delivered.
      </p>
    ),
  },
  {
    title: '8. Disclaimer and limitation of liability',
    body: (
      <>
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT.
        </p>
        <p className="mt-3">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR AGGREGATE LIABILITY
          ARISING OUT OF OR RELATING TO THE SERVICE SHALL NOT EXCEED THE
          AMOUNTS YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE
          CLAIM. WE SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF DATA OR GOODWILL.
        </p>
        <p className="mt-3">
          Nothing in these Terms excludes liability that cannot be excluded
          under applicable law.
        </p>
      </>
    ),
  },
  {
    title: '9. Termination',
    body: (
      <p>
        We may suspend or terminate your access for material breach of these
        Terms. Sections 3, 5, 6, 8, and 10 survive termination. You may stop
        using the Service at any time and may request deletion of your data
        per the Privacy Policy.
      </p>
    ),
  },
  {
    title: '10. Governing law',
    body: (
      <p>
        These Terms are governed by the laws of India, without regard to
        conflict-of-laws principles. Courts of competent jurisdiction in India
        shall have exclusive jurisdiction, subject to any mandatory consumer
        forum rights in your place of residence.
      </p>
    ),
  },
  {
    title: '11. Changes',
    body: (
      <p>
        We may amend these Terms prospectively. Material changes will be
        indicated by revising the date below; continued use after the
        effective date constitutes acceptance. Purchases completed before an
        amendment remain governed by the Terms in effect at the time of
        purchase.
      </p>
    ),
  },
  {
    title: '12. Contact',
    body: (
      <p>
        <a
          href="mailto:hello@adoreyou.app"
          className="underline underline-offset-4 text-accent"
        >
          hello@adoreyou.app
        </a>
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-28 pb-24 sm:pt-32">
        <h1 className="font-serif text-4xl sm:text-5xl">
          Terms of <span className="italic text-accent">service</span>
        </h1>
        <p className="mt-4 text-sm text-ink/40">Last updated: July 12, 2026</p>

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

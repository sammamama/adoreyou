import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PromptForm from '@/components/PromptForm';
import { getOccasion, OCCASIONS } from '@/lib/occasions';

export function generateStaticParams() {
  return OCCASIONS.map((o) => ({ occasion: o.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ occasion: string }>;
}): Promise<Metadata> {
  const { occasion: slug } = await params;
  const occasion = getOccasion(slug);
  if (!occasion) return {};

  const title = `${occasion.name} Song Gift — AdoreYou`;
  const description = `${occasion.description} An original song made from your memories — the perfect ${occasion.name.toLowerCase()} gift, starting at $20.`;

  return {
    title,
    description,
    alternates: { canonical: `/create/${slug}` },
  };
}

export default async function CreateOccasionPage({
  params,
}: {
  params: Promise<{ occasion: string }>;
}) {
  const { occasion: slug } = await params;
  const occasion = getOccasion(slug);
  if (!occasion) notFound();

  return <PromptForm occasion={occasion} />;
}

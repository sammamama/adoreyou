import { notFound } from 'next/navigation';
import PromptForm from '@/components/PromptForm';
import { getOccasion, OCCASIONS } from '@/lib/occasions';

export function generateStaticParams() {
  return OCCASIONS.map((o) => ({ occasion: o.slug }));
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

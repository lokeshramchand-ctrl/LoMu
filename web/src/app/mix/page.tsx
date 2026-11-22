'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRecs } from '@/lib/api';
import { Collection, PageError, PageSkeleton } from '@/components/Collection';
import type { Track } from '@/lib/types';

/** One of the generated mixes (On Repeat and the others) as an album-style page. */
function Mix() {
  const name = useSearchParams().get('name') ?? '';
  const { data, isLoading, error, refetch } = useRecs();
  if (isLoading) return <PageSkeleton />;
  if (error) return <PageError error={error} retry={() => refetch()} />;
  const shelf = data?.find((s) => s.title === name);
  const tracks = (shelf?.items.filter((i): i is Track => i.kind === 'song') ?? []) as Track[];
  return (
    <Collection
      kind="Mix"
      title={shelf?.title ?? (name || 'Mix')}
      thumb={tracks[0]?.thumb}
      eyebrow="Made for you"
      meta={shelf?.subtitle}
      tracks={tracks}
      source={`mix:${name}`}
      empty={<p className="muted">This mix is empty right now. It fills up as you listen.</p>}
    />
  );
}

export default function MixPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Mix />
    </Suspense>
  );
}

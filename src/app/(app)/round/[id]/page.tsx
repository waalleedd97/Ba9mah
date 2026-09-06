import { notFound } from 'next/navigation';
import { RatingFlow } from '@/components/RatingFlow';
import { findSavedByPost, getRound, listImagesForPost, listPostsByRound } from '@/lib/db/repo';
import { requireOnboarded } from '@/lib/guards';
import { getAppStats } from '@/lib/stats';
import type { PostWithImages } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  requireOnboarded();
  const { id } = await params;
  const round = getRound(Number(id));
  if (!round) notFound();
  const posts: PostWithImages[] = listPostsByRound(round.id).map((p) => ({
    ...p,
    images: listImagesForPost(p.id),
    savedId: findSavedByPost(p.id)?.id ?? null,
  }));
  return <RatingFlow round={round} initialPosts={posts} stats={getAppStats()} />;
}

import { handle, ok } from '@/lib/api';
import { getAppStats } from '@/lib/stats';
import { isLearning } from '@/lib/ai/learn';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ok({ stats: getAppStats(), learning: isLearning() }));

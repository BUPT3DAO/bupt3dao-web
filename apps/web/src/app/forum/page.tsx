import { ForumClient } from './forum-client';

import { getServerApi } from '@/lib/server-api';
import type { PageResult, PostSummary } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ForumPage() {
  const initialData = await getServerApi<PageResult<PostSummary>>(
    '/posts?limit=20&offset=0&q=&topic=',
  );
  return <ForumClient initialData={initialData} />;
}

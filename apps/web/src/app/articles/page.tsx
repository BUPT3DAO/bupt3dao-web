import { ArticlesClient } from './articles-client';

import { getServerApi } from '@/lib/server-api';
import type { ArticleSummary, PageResult } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ArticlesPage() {
  const initialData = await getServerApi<PageResult<ArticleSummary>>(
    '/articles?limit=10&offset=0',
  );
  return <ArticlesClient initialData={initialData} />;
}

import { MembersClient } from './members-client';

import { getServerApi } from '@/lib/server-api';
import type { Member, PageResult } from '@/types';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const initialData = await getServerApi<PageResult<Member>>('/members?limit=12&offset=0&q=');
  return <MembersClient initialData={initialData} />;
}

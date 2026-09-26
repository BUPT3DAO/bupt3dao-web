import type { NextRequest } from 'next/server';

import { proxyToApi } from '@/lib/proxy';

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const response = await proxyToApi(request, ['uploads', ...path]);
  const contentType = response.headers.get('content-type') ?? '';

  if (response.status === 200 && contentType.startsWith('image/')) {
    response.headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  }

  return response;
}

export const GET = handler;
export const HEAD = handler;

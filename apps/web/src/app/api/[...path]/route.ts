import type { NextRequest } from 'next/server';

import { proxyToApi } from '@/lib/proxy';

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToApi(request, ['api', ...path]);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;

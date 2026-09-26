import { NextResponse, type NextRequest } from 'next/server';

// 转发后这些头部不再成立（长度/编码会变），必须剔除
const DROPPED_RESPONSE_HEADERS = [
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
];
const DROPPED_REQUEST_HEADERS = [
  'connection',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'accept-encoding',
];

const MAX_API_REQUEST_BYTES = 8 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;

async function readBodyWithinLimit(request: NextRequest): Promise<ArrayBuffer | null> {
  const declaredSize = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_API_REQUEST_BYTES) return null;
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_API_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

/**
 * 把同源请求转发给后端 API。
 *
 * 浏览器只访问本站的 /api 与 /uploads，由服务端在运行时读取 API_PROXY_TARGET 转发，
 * 因此前端构建产物不绑定后端地址，也不需要处理跨域。
 */
export async function proxyToApi(
  request: NextRequest,
  segments: string[],
): Promise<NextResponse> {
  if (
    segments.some(
      (segment) =>
        !segment || segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\'),
    )
  ) {
    return NextResponse.json({ detail: '请求路径不合法' }, { status: 400 });
  }

  const target = (process.env.API_PROXY_TARGET ?? 'http://localhost:8000').replace(/\/+$/, '');
  const { search } = new URL(request.url);
  const destination = `${target}/${segments.map((segment) => encodeURIComponent(segment)).join('/')}${search}`;

  const headers = new Headers(request.headers);
  // 删除逐跳头及失效的长度/编码信息，避免把客户端连接状态转发给上游。
  const connectionHeaders = headers.get('connection')?.split(',') ?? [];
  for (const name of DROPPED_REQUEST_HEADERS) headers.delete(name);
  for (const name of connectionHeaders) {
    if (name.trim()) headers.delete(name.trim());
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let body: ArrayBuffer | null | undefined;
  try {
    body = hasBody ? await readBodyWithinLimit(request) : undefined;
  } catch {
    return NextResponse.json({ detail: '读取请求内容失败，请重试' }, { status: 400 });
  }
  if (body === null) {
    return NextResponse.json({ detail: '请求内容不能超过 8 MB' }, { status: 413 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(destination, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json(
      { detail: timedOut ? '后端响应超时，请稍后重试' : '后端服务暂不可用，请稍后重试' },
      { status: timedOut ? 504 : 502 },
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) {
    responseHeaders.delete(name);
  }

  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status, headers: responseHeaders });
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

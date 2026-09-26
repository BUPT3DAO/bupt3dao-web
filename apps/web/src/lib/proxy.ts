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

const MAX_API_REQUEST_BYTES = 8 * 1024 * 1024;

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
  const target = (process.env.API_PROXY_TARGET ?? 'http://localhost:8000').replace(/\/+$/, '');
  const { search } = new URL(request.url);
  const destination = `${target}/${segments.join('/')}${search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  // 重新构造请求体后由 fetch 生成准确长度，避免转发客户端伪造的 Content-Length。
  headers.delete('content-length');
  // 让后端直接返回未压缩内容，避免 Next 二次编码
  headers.delete('accept-encoding');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await readBodyWithinLimit(request) : undefined;
  if (body === null) {
    return NextResponse.json({ detail: '请求内容不能超过 8 MB' }, { status: 413 });
  }
  const upstream = await fetch(destination, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
    cache: 'no-store',
  });

  const responseHeaders = new Headers(upstream.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) {
    responseHeaders.delete(name);
  }

  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status, headers: responseHeaders });
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

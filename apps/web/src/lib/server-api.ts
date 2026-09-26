import 'server-only';

/** 服务端组件使用内部 API 地址取公开数据，让主要内容在 HTML 首次响应时就存在。 */
export async function getServerApi<T>(path: string): Promise<T | null> {
  const target = (process.env.API_PROXY_TARGET ?? 'http://localhost:8000').replace(/\/+$/, '');
  try {
    const response = await fetch(`${target}/api${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

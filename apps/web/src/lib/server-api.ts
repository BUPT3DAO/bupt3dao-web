import 'server-only';

const PUBLIC_DATA_REVALIDATE_SECONDS = 30;

/** 服务端组件使用内部 API 地址取公开数据，让主要内容在 HTML 首次响应时就存在。 */
export async function getServerApi<T>(path: string): Promise<T | null> {
  const target = (process.env.API_PROXY_TARGET ?? 'http://localhost:8000').replace(/\/+$/, '');
  try {
    const response = await fetch(`${target}/api${path}`, {
      // SSR 首屏只读取无需鉴权的公开 GET 接口；短缓存降低重复 API 往返，
      // 同时限制公告、帖子和资料的最大陈旧时间。
      next: { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

import type { MetadataRoute } from 'next';

import { getServerApi } from '@/lib/server-api';
import type { ArticleSummary, Member, PageResult, PostSummary } from '@/types';

const SITE_ORIGIN = 'https://bupt3dao.club';
const PAGE_SIZE = 100;
// Sitemap 协议上限为 50,000 条；每条内容最多再贡献一个作者主页。
const MAX_ITEMS_PER_KIND = Math.floor((50_000 - 5) / 6);
const FETCH_CONCURRENCY = 4;

async function getAllItems<T>(pathForOffset: (offset: number) => string): Promise<T[]> {
  const firstPage = await getServerApi<PageResult<T>>(pathForOffset(0));
  if (!firstPage) return [];

  const itemLimit = Math.min(firstPage.total, MAX_ITEMS_PER_KIND);
  const pages: Array<PageResult<T> | null> = [firstPage];
  const offsets = Array.from(
    { length: Math.max(0, Math.ceil(itemLimit / PAGE_SIZE) - 1) },
    (_, index) => (index + 1) * PAGE_SIZE,
  );

  for (let index = 0; index < offsets.length; index += FETCH_CONCURRENCY) {
    const batch = offsets.slice(index, index + FETCH_CONCURRENCY);
    pages.push(
      ...(await Promise.all(
        batch.map((offset) => getServerApi<PageResult<T>>(pathForOffset(offset))),
      )),
    );
  }

  return pages.flatMap((page) => page?.items ?? []).slice(0, itemLimit);
}

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, articles, members] = await Promise.all([
    getAllItems<PostSummary>((offset) => `/posts?offset=${offset}&limit=${PAGE_SIZE}`),
    getAllItems<ArticleSummary>((offset) => `/articles?offset=${offset}&limit=${PAGE_SIZE}`),
    getAllItems<Member>((offset) => `/members?offset=${offset}&limit=${PAGE_SIZE}`),
  ]);

  const staticEntries: MetadataRoute.Sitemap = ['/', '/forum', '/articles', '/members', '/guide'].map(
    (path) => ({ url: new URL(path, SITE_ORIGIN).toString() }),
  );
  const profileDates = new Map<string, string>();
  for (const member of members) profileDates.set(member.user.address, member.user.created_at);
  const profileAddresses = new Set<string>([
    ...members.map((member) => member.user.address),
    ...posts.map((post) => post.author.address),
    ...articles.map((article) => article.author.address),
  ]);

  return [
    ...staticEntries,
    ...posts.map((post) => ({
      url: new URL(`/forum/${post.id}`, SITE_ORIGIN).toString(),
      lastModified: post.created_at,
    })),
    ...articles.map((article) => ({
      url: new URL(`/articles/${article.id}`, SITE_ORIGIN).toString(),
      lastModified: article.updated_at,
    })),
    ...Array.from(profileAddresses, (address) => {
      const joinedAt = profileDates.get(address);
      return {
        url: new URL(`/u/${encodeURIComponent(address)}`, SITE_ORIGIN).toString(),
        ...(joinedAt ? { lastModified: joinedAt } : {}),
      };
    }),
  ];
}

import type { Metadata } from 'next';
import { cache } from 'react';

import { ArticleDetailClient } from './article-client';

import { getServerApi } from '@/lib/server-api';
import type { Article } from '@/types';

type ArticlePageProps = { params: Promise<{ id: string }> };

const getArticle = cache((id: number) => getServerApi<Article>(`/articles/${id}`));

export const dynamic = 'force-dynamic';

function articleDescription(content: string): string {
  return content
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return { title: '文章不存在' };

  const article = await getArticle(id);
  if (!article) return { title: '社区文章' };

  const description = articleDescription(article.content);
  return {
    title: article.title,
    description,
    openGraph: {
      type: 'article',
      title: article.title,
      description,
      publishedTime: article.created_at,
      modifiedTime: article.updated_at,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const initialArticle = Number.isInteger(id) && id > 0 ? await getArticle(id) : null;
  return <ArticleDetailClient articleId={id} initialArticle={initialArticle} />;
}

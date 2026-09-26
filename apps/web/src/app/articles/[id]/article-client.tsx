'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { UserIdentity } from '@/components/user-identity';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Article } from '@/types';

export function ArticleDetailClient({
  articleId,
  initialArticle,
}: {
  articleId: number;
  initialArticle: Article | null;
}) {
  const router = useRouter();
  const { user } = useWallet();

  const [article, setArticle] = useState<Article | null>(initialArticle);
  const [loading, setLoading] = useState(initialArticle === null);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (initialArticle) return;
    if (!Number.isInteger(articleId) || articleId <= 0) {
      setError('文章地址不正确。');
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .getArticle(articleId, controller.signal)
      .then((data) => {
        if (!cancelled) setArticle(data);
      })
      .catch((cause) => {
        if (!cancelled) {
          setArticle(null);
          setError(cause instanceof ApiError ? cause.message : '文章加载失败，请稍后重试。');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [articleId, initialArticle]);

  const isAuthor = Boolean(user && article && user.address === article.author.address);
  const canDelete = Boolean(user && article && (isAuthor || user.is_admin));
  const edited =
    article !== null &&
    new Date(article.updated_at).getTime() - new Date(article.created_at).getTime() > 1000;

  async function handleDelete() {
    if (!article) return;
    if (!window.confirm('确定要删除这篇文章吗？删除后无法恢复。')) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteArticle(article.id);
      router.push('/articles');
    } catch (cause) {
      setDeleteError(cause instanceof ApiError ? cause.message : '删除失败，请稍后重试。');
      setDeleting(false);
    }
  }

  return (
    <div className="article-page">
      <Link href="/articles" className="back-link">
        <Icon name="back" size={17} />
        返回文章墙
      </Link>

      {loading && (
        <div className="card loading-card" role="status">
          <div className="skeleton" />
          <div className="skeleton" />
          <p className="muted">正在加载文章…</p>
        </div>
      )}

      {!loading && error && (
        <div className="inline-notice" role="alert">
          <span>{error}</span>
          <Link href="/articles" className="text-link">
            返回文章墙 <Icon name="arrow" size={16} />
          </Link>
        </div>
      )}

      {!loading && article && (
        <article className="card article-detail">
          <div className="article-detail-head">
            <div className="article-card-top">
              {article.is_pinned && (
                <span className="article-pin-badge">
                  <Icon name="pin" size={12} />
                  置顶
                </span>
              )}
              <span>发布于 {formatDate(article.created_at)}</span>
              {edited && (
                <span>· 更新于 {formatDate(article.updated_at)}</span>
              )}
            </div>
            <h1>{article.title}</h1>
            <div className="article-card-foot">
              <UserIdentity user={article.author} size={30} />
              {canDelete && (
                <div className="article-detail-actions">
                  {isAuthor && (
                    <Link className="btn btn-ghost btn-sm" href={`/articles/${article.id}/edit`}>
                      <Icon name="edit" size={15} />
                      编辑
                    </Link>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                  >
                    <Icon name="trash" size={15} />
                    {deleting ? '删除中…' : '删除'}
                  </button>
                </div>
              )}
            </div>
          </div>
          {deleteError && (
            <div className="inline-notice" role="alert">
              {deleteError}
            </div>
          )}
          <Markdown source={article.content} />
        </article>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/icon';
import { UserIdentity } from '@/components/user-identity';
import { useWallet } from '@/components/wallet-provider';
import { api } from '@/lib/api';
import { formatDate, relativeTime } from '@/lib/format';
import type { ArticleSummary, PageResult } from '@/types';

const PAGE_SIZE = 10;

export function ArticlesClient({
  initialData,
}: {
  initialData: PageResult<ArticleSummary> | null;
}) {
  const { user } = useWallet();
  const [items, setItems] = useState<ArticleSummary[]>(initialData?.items ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(initialData === null);
  const [error, setError] = useState('');
  const initialLoad = useRef(true);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      if (initialData) return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .listArticles(page * PAGE_SIZE, PAGE_SIZE, controller.signal)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) setError('文章墙加载失败，请稍后重试。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [initialData, page, version]);

  return (
    <div className="articles-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">WRITING FROM THE COMMUNITY</span>
          <h1>
            文章墙<span className="heading-dot">.</span>
          </h1>
          <p>把值得沉淀的思考写下来，让更多人读到。</p>
        </div>
        <Icon name="book" size={30} />
      </div>

      <div className="feed-toolbar">
        <h2>
          全部文章 <span className="count-badge">{total}</span>
        </h2>
        {user ? (
          <Link className="btn btn-primary btn-sm" href="/articles/new">
            <Icon name="plus" size={15} />
            写文章
          </Link>
        ) : (
          <span className="muted">连接钱包后即可发布文章</span>
        )}
      </div>

      {error && (
        <div className="inline-notice" role="alert">
          <span>{error}</span>
          <button className="text-link" onClick={() => setVersion((n) => n + 1)}>
            重试
          </button>
        </div>
      )}

      {loading ? (
        <div className="card loading-card" role="status">
          <div className="skeleton" />
          <div className="skeleton" />
          <span className="visually-hidden">正在加载文章</span>
        </div>
      ) : items.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-art">
            <Icon name="book" size={28} />
          </div>
          <h3>这里还是一片空白</h3>
          <p>成为第一个在这里留下文字的人，把想法写下来分享给社区。</p>
          {user && (
            <Link className="btn btn-primary" href="/articles/new">
              写第一篇文章 <Icon name="arrow" size={16} />
            </Link>
          )}
        </div>
      ) : (
        <div className="article-list">
          {items.map((article) => (
            <article className="card article-card" key={article.id}>
              <div className="article-card-top">
                {article.is_pinned && (
                  <span className="article-pin-badge">
                    <Icon name="pin" size={12} />
                    置顶
                  </span>
                )}
                <span>{formatDate(article.created_at)}</span>
              </div>
              <h3>
                <Link href={`/articles/${article.id}`}>{article.title}</Link>
              </h3>
              {article.excerpt && <p className="article-excerpt">{article.excerpt}</p>}
              <div className="article-card-foot">
                <UserIdentity user={article.author} size={26} />
                <span suppressHydrationWarning>
                  <Icon name="clock" size={13} /> {relativeTime(article.created_at)}
                </span>
                <Link className="article-read" href={`/articles/${article.id}`}>
                  阅读全文 <Icon name="arrow" size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="pagination">
          <button
            className="btn btn-ghost btn-sm"
            disabled={page === 0 || loading}
            onClick={() => setPage((n) => n - 1)}
          >
            上一页
          </button>
          <span>
            第 {page + 1} / {Math.ceil(total / PAGE_SIZE)} 页
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={(page + 1) * PAGE_SIZE >= total || loading}
            onClick={() => setPage((n) => n + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

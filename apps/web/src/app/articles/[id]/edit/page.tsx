'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ArticleEditor } from '@/components/article-editor';
import { Icon } from '@/components/icon';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import type { Article } from '@/types';

export default function EditArticlePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id ?? '');
  const router = useRouter();
  const { user, status } = useWallet();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) {
      setError('文章地址不正确。');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getArticle(id)
      .then((data) => {
        if (!cancelled) setArticle(data);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : '文章加载失败，请稍后重试。');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isAuthor = Boolean(user && article && user.address === article.author.address);

  return (
    <div className="article-page">
      <Link href={`/articles/${id}`} className="back-link">
        <Icon name="back" size={17} />
        返回文章
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">REFINE YOUR WORDS</span>
          <h1>
            编辑文章<span className="heading-dot">.</span>
          </h1>
          <p>只有作者本人可以修改内容。</p>
        </div>
        <Icon name="edit" size={30} />
      </div>

      {(loading || status === 'loading') && (
        <div className="card loading-card" role="status">
          <div className="skeleton" />
          <p className="muted">正在加载文章…</p>
        </div>
      )}

      {!loading && status !== 'loading' && (error || !article) && (
        <div className="inline-notice" role="alert">
          <span>{error || '文章不存在或已被删除。'}</span>
          <Link href="/articles" className="text-link">
            返回文章墙 <Icon name="arrow" size={16} />
          </Link>
        </div>
      )}

      {!loading && status !== 'loading' && article && !user && (
        <div className="inline-notice" role="alert">
          <span>请先连接钱包登录，再编辑这篇文章。</span>
        </div>
      )}

      {!loading && status !== 'loading' && article && user && !isAuthor && (
        <div className="inline-notice" role="alert">
          <span>只有作者本人可以编辑这篇文章。</span>
          <Link href={`/articles/${article.id}`} className="text-link">
            查看文章 <Icon name="arrow" size={16} />
          </Link>
        </div>
      )}

      {!loading && article && isAuthor && (
        <ArticleEditor
          initial={{ title: article.title, content: article.content }}
          submitLabel="保存修改"
          onSubmit={async (payload) => {
            await api.updateArticle(article.id, payload);
            router.push(`/articles/${article.id}`);
          }}
        />
      )}
    </div>
  );
}

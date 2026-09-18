'use client';

import { useState } from 'react';

import { Icon } from '@/components/icon';
import { api } from '@/lib/api';
import { displayName, relativeTime } from '@/lib/format';
import type { ArticleSummary } from '@/types';

interface AdminArticleRowProps {
  article: ArticleSummary;
  /** 置顶文章的顺序号（从 1 起），未置顶为 null */
  position: number | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChanged: (message: string) => void;
}

export function AdminArticleRow({
  article,
  position,
  canMoveUp,
  canMoveDown,
  onChanged,
}: AdminArticleRowProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  async function togglePin() {
    await run(
      () => api.pinArticle(article.id, !article.is_pinned),
      article.is_pinned ? '已取消置顶' : '已设为置顶',
    );
  }

  async function remove() {
    if (!window.confirm(`确定删除《${article.title}》吗？删除后无法恢复。`)) return;
    await run(() => api.deleteArticle(article.id), '文章已删除');
  }

  return (
    <div className="card admin-article-row">
      <span className="admin-article-order">{position ?? '—'}</span>
      <div className="admin-article-main">
        <h3>
          {article.is_pinned && <Icon name="pin" size={13} />} {article.title}
        </h3>
        <p>
          {displayName(article.author)} · {relativeTime(article.created_at)}
        </p>
        {error && <p className="error-text">{error}</p>}
      </div>
      <div className="admin-article-actions">
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void togglePin()}>
          <Icon name="pin" size={14} />
          {article.is_pinned ? '取消置顶' : '置顶'}
        </button>
        {article.is_pinned && (
          <>
            <button
              className="icon-btn"
              aria-label="上移一位"
              disabled={busy || !canMoveUp}
              onClick={() => void run(() => api.moveArticle(article.id, 'up'), '顺序已调整')}
            >
              <Icon name="up" size={16} />
            </button>
            <button
              className="icon-btn"
              aria-label="下移一位"
              disabled={busy || !canMoveDown}
              onClick={() => void run(() => api.moveArticle(article.id, 'down'), '顺序已调整')}
            >
              <Icon name="down" size={16} />
            </button>
          </>
        )}
        <a
          className="icon-btn"
          href={`/articles/${article.id}`}
          target="_blank"
          rel="noreferrer"
          aria-label="查看文章"
        >
          <Icon name="upRight" size={16} />
        </a>
        <button className="icon-btn" aria-label="删除文章" disabled={busy} onClick={() => void remove()}>
          <Icon name="trash" size={16} />
        </button>
      </div>
    </div>
  );
}

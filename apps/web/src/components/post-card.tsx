'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '@/components/icon';
import { UserIdentity } from '@/components/user-identity';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import type { PostSummary } from '@/types';

interface PostCardProps {
  post: PostSummary;
  onDeleted?: (id: number) => void;
}

/** 贴吧风格的帖子列表行：板块 + 标题 + 摘要 + 作者 + 评论数。 */
export function PostCard({ post, onDeleted }: PostCardProps) {
  const { user } = useWallet();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const canDelete = user?.address === post.author.address || Boolean(user?.is_admin);

  async function handleDelete() {
    if (removing) return;
    setRemoving(true);
    setError(null);
    try {
      await api.deletePost(post.id);
      onDeleted?.(post.id);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '删除失败，请稍后重试');
      setRemoving(false);
    }
  }

  return (
    <article className="post-row" id={`post-${post.id}`}>
      <span className={post.topic ? 'post-row-topic' : 'post-row-topic muted'}>
        {post.topic || '综合'}
      </span>

      <div className="post-row-body">
        <h3>
          <Link href={`/forum/${post.id}`}>{post.title}</Link>
        </h3>
        {post.excerpt && <p className="post-row-excerpt">{post.excerpt}</p>}
        <div className="post-row-foot">
          <UserIdentity user={post.author} size={26} />
          <time className="muted" dateTime={post.created_at} suppressHydrationWarning>
            {relativeTime(post.created_at)}
          </time>
          {error && (
            <span className="error-text" role="alert">
              {error}
            </span>
          )}
        </div>
      </div>

      <div className="post-row-stats">
        <span className="post-row-count">
          <Icon name="message" size={14} />
          {post.comment_count}
        </span>
        {canDelete && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setConfirming(!confirming)}
            disabled={removing}
          >
            {removing ? '删除中…' : '删除'}
          </button>
        )}
      </div>

      {confirming && (
        <div className="delete-confirm post-row-confirm" role="alert">
          <span>删除后无法恢复，确定删除？</span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={removing}
            onClick={() => setConfirming(false)}
          >
            取消
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={removing}
            onClick={() => void handleDelete()}
          >
            {removing ? '删除中…' : '确认删除'}
          </button>
        </div>
      )}
    </article>
  );
}

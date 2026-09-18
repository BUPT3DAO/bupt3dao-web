'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Avatar } from '@/components/avatar';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import { displayName, relativeTime, shortAddress } from '@/lib/format';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
  onDeleted?: (id: number) => void;
}

export function PostCard({ post, onDeleted }: PostCardProps) {
  const { user } = useWallet();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMine = user?.address === post.author.address;

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
    <article className="card post">
      <header className="post-head">
        <Link className="post-author" href={`/u/${post.author.address}`}>
          <Avatar
            address={post.author.address}
            nickname={post.author.nickname}
            src={post.author.avatar_url}
            size={40}
          />
          <span className="post-author-text">
            <strong>{displayName(post.author)}</strong>
            <span className="muted mono">{shortAddress(post.author.address)}</span>
          </span>
        </Link>

        <div className="post-head-right">
          <time className="muted" dateTime={post.created_at}>
            {relativeTime(post.created_at)}
          </time>
          {isMine && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void handleDelete()}
              disabled={removing}
            >
              {removing ? '删除中…' : '删除'}
            </button>
          )}
        </div>
      </header>

      <p className="post-content">{post.content}</p>
      {error && <p className="error-text">{error}</p>}
    </article>
  );
}

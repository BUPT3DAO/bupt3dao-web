'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
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
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
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

  async function copyPost() {
    try {
      await navigator.clipboard.writeText(post.content);
      setCopied(true);
    } catch {
      setError('无法访问剪贴板，请选中正文手动复制。');
    }
  }

  const content =
    !expanded && post.content.length > 500 ? `${post.content.slice(0, 500)}…` : post.content;

  return (
    <article className="card post" id={`post-${post.id}`}>
      <header className="post-head">
        <Link className="post-author" href={`/u/${post.author.address}`}>
          <Avatar
            address={post.author.address}
            nickname={post.author.nickname}
            src={post.author.avatar_url}
            size={40}
          />
          <span className="post-author-text">
            <strong>
              {displayName(post.author)} <span className="member-badge">成员</span>
            </strong>
            <span className="muted mono">{shortAddress(post.author.address)}</span>
          </span>
        </Link>

        <div className="post-head-right">
          <time className="muted" dateTime={post.created_at}>
            {relativeTime(post.created_at)}
          </time>
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
      </header>

      <p className="post-content">
        {content.split(/(#[\p{L}\p{N}_]+)/gu).map((part, index) =>
          part.startsWith('#') ? (
            <span className="post-tag" key={index}>
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </p>
      {post.content.length > 500 && (
        <button className="text-link expand-post" onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起全文' : '展开全文'}
        </button>
      )}
      <footer className="post-footer">
        <Link href={`/u/${post.author.address}`} className="post-profile-link">
          认识这位伙伴 <Icon name="upRight" size={14} />
        </Link>
        <button className="copy-button" onClick={() => void copyPost()}>
          <Icon name={copied ? 'check' : 'link'} size={15} />
          {copied ? '已复制' : '复制内容'}
        </button>
      </footer>
      {confirming && (
        <div className="delete-confirm" role="alert">
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
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

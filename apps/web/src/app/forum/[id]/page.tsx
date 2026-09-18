'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CommentThread } from '@/components/comment-thread';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { UserIdentity } from '@/components/user-identity';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import type { Comment, Post } from '@/types';

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useWallet();
  const postId = Number(params?.id);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(postId) || postId <= 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.getPost(postId), api.listComments(postId)])
      .then(([detail, thread]) => {
        if (cancelled) return;
        setPost(detail);
        setComments(thread.items);
        setCommentTotal(thread.total);
      })
      .catch((cause) => {
        if (cancelled) return;
        setPost(null);
        setError(cause instanceof ApiError ? cause.message : '帖子加载失败，请稍后重试');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function removePost() {
    if (!post || !window.confirm('删除后无法恢复，确定删除这个帖子？')) return;
    setRemoving(true);
    try {
      await api.deletePost(post.id);
      router.push('/forum');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '删除失败，请稍后重试');
      setRemoving(false);
    }
  }

  const canDelete = Boolean(post && user && (user.address === post.author.address || user.is_admin));

  return (
    <div className="post-detail-layout">
      <div className="forum-main post-detail">
        <Link href="/forum" className="back-link">
          <Icon name="back" size={17} />
          返回论坛
        </Link>

        {loading && (
          <div className="card loading-card" role="status">
            <div className="skeleton" />
            <div className="skeleton" />
            <span className="visually-hidden">正在加载帖子</span>
          </div>
        )}

        {error && (
          <div className="inline-notice" role="alert">
            <span>{error}</span>
            <Link href="/forum" className="text-link">
              返回论坛 <Icon name="arrow" size={16} />
            </Link>
          </div>
        )}

        {!loading && post && (
          <>
            <article className="card post-detail-card">
              <div className="post-detail-head">
                <span className={post.topic ? 'post-row-topic' : 'post-row-topic muted'}>
                  {post.topic || '综合'}
                </span>
                <h1>{post.title}</h1>
                <div className="post-detail-meta">
                  <UserIdentity user={post.author} size={40} placement="bottom" />
                  <time className="muted" dateTime={post.created_at}>
                    {relativeTime(post.created_at)}
                  </time>
                  <span className="post-detail-stat">
                    <Icon name="message" size={14} />
                    {commentTotal} 条评论
                  </span>
                  {canDelete && (
                    <button
                      className="btn btn-ghost btn-sm post-detail-delete"
                      disabled={removing}
                      onClick={() => void removePost()}
                    >
                      {removing ? '删除中…' : '删除帖子'}
                    </button>
                  )}
                </div>
              </div>
              <Markdown source={post.content} className="post-detail-content" />
            </article>

            <CommentThread
              key={post.id}
              postId={post.id}
              initial={comments}
              initialTotal={commentTotal}
            />
          </>
        )}
      </div>
    </div>
  );
}

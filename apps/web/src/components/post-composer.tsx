'use client';

import { useState, type FormEvent } from 'react';

import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import type { Post } from '@/types';

const MAX_LENGTH = 2000;

export function PostComposer({ onPosted }: { onPosted: (post: Post) => void }) {
  const { status, hasProvider, connect } = useWallet();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'authenticated') {
    return (
      <section className="card composer">
        <p className="composer-hint">连接小狐狸钱包后即可发帖</p>
        <div className="composer-actions">
          <button
            className="btn btn-primary"
            onClick={() => void connect()}
            disabled={status === 'connecting' || status === 'loading'}
          >
            {status === 'connecting' ? '等待钱包确认…' : '连接钱包'}
          </button>
          {status === 'anonymous' && !hasProvider && <span className="hint">未检测到 MetaMask</span>}
        </div>
      </section>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const post = await api.createPost(trimmed);
      setContent('');
      onPosted(post);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '发布失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card composer">
      <form onSubmit={handleSubmit}>
        <textarea
          className="textarea"
          value={content}
          maxLength={MAX_LENGTH}
          placeholder="说点什么…"
          onChange={(event) => setContent(event.target.value)}
        />
        <div className="composer-actions">
          <span className="muted">
            {content.length}/{MAX_LENGTH}
          </span>
          <button className="btn btn-primary" type="submit" disabled={submitting || !content.trim()}>
            {submitting ? '发布中…' : '发布'}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </form>
    </section>
  );
}

'use client';

import { useRef, useState, type FormEvent } from 'react';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import type { Post } from '@/types';

const MAX_LENGTH = 2000;

export function PostComposer({ onPosted }: { onPosted: (post: Post) => void }) {
  const { status, user, connect } = useWallet();
  const [content, setContent] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addTopic(topic: string) {
    setContent((current) =>
      `${current}${current && !current.endsWith(' ') ? ' ' : ''}#${topic} `.slice(0, MAX_LENGTH),
    );
    inputRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== 'authenticated') {
      void connect();
      return;
    }
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
    <section className="card composer" id="composer" aria-label="发布想法">
      <form onSubmit={handleSubmit}>
        <div className="composer-body">
          {user ? (
            <Avatar
              address={user.address}
              nickname={user.nickname}
              src={user.avatar_url}
              size={42}
            />
          ) : (
            <span className="guest-avatar">
              <Icon name="edit" size={21} />
            </span>
          )}
          <div className="composer-input">
            <label htmlFor="post-content">
              {user ? '今天，有什么新想法？' : '每一个想法，都有回响。'}
            </label>
            <textarea
              id="post-content"
              ref={inputRef}
              className="textarea"
              value={content}
              maxLength={MAX_LENGTH}
              placeholder="分享你的发现、灵感，或正在构建的项目…"
              onChange={(event) => setContent(event.target.value)}
              disabled={submitting}
            />
          </div>
        </div>
        <div className="composer-actions">
          <div className="composer-topics" aria-label="添加话题">
            {['技术交流', '项目共建', '校园日常'].map((name) => (
              <button type="button" key={name} onClick={() => addTopic(name)} disabled={submitting}>
                <span>#</span> {name}
              </button>
            ))}
          </div>
          {content.length > 0 && (
            <span className="character-count">
              {content.length}/{MAX_LENGTH}
            </span>
          )}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={
              submitting ||
              status === 'loading' ||
              status === 'connecting' ||
              (status === 'authenticated' && !content.trim())
            }
          >
            {submitting
              ? '发布中…'
              : status === 'connecting'
                ? '等待签名…'
                : user
                  ? '发布想法'
                  : '连接钱包发帖'}
            <Icon name={user ? 'arrow' : 'wallet'} size={16} />
          </button>
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </form>
      {!user && (
        <div className="composer-security">
          <Icon name="shield" size={13} />
          仅需 MetaMask 签名登录，无需交易或 Gas 费
        </div>
      )}
    </section>
  );
}

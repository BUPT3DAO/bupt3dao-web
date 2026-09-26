'use client';

import { useRef, useState, type FormEvent } from 'react';

import { Icon } from '@/components/icon';
import { InsertImageButton } from '@/components/insert-image-button';
import { Markdown } from '@/components/markdown';
import { UserIdentity } from '@/components/user-identity';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import type { Comment } from '@/types';

/** 一级评论 → 回复 → 回复的回复，到此为止 */
export const MAX_COMMENT_DEPTH = 3;
const CONTENT_MAX = 2000;

interface CommentThreadProps {
  postId: number;
  initial: Comment[];
  initialTotal: number;
}

export function CommentThread({ postId, initial, initialTotal }: CommentThreadProps) {
  const { user, status, connect } = useWallet();
  const [comments, setComments] = useState<Comment[]>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const data = await api.listComments(postId);
    setComments(data.items);
    setTotal(data.total);
  }

  async function publish(content: string, parentId?: number) {
    if (status !== 'authenticated') {
      void connect();
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createComment(postId, content, parentId);
      await refresh();
      setReplyTo(null);
      return true;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '评论发布失败，请稍后重试');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: number) {
    if (!window.confirm('删除后无法恢复，确定删除这条评论？')) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteComment(postId, commentId);
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '删除失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  function renderComment(comment: Comment) {
    const canDelete = user?.address === comment.author.address || Boolean(user?.is_admin);
    const canReply = status === 'authenticated' && comment.depth < MAX_COMMENT_DEPTH;
    return (
      <div
        className={`comment comment-depth-${comment.depth}`}
        id={`comment-${comment.id}`}
        key={comment.id}
      >
        <div className="comment-head">
          <UserIdentity user={comment.author} size={30} placement="bottom" />
          <time className="muted" dateTime={comment.created_at} suppressHydrationWarning>
            {relativeTime(comment.created_at)}
          </time>
          <div className="comment-actions">
            {canReply && (
              <button
                className="text-link"
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              >
                <Icon name="reply" size={13} />
                回复
              </button>
            )}
            {canDelete && (
              <button
                className="text-link danger"
                disabled={busy}
                onClick={() => void remove(comment.id)}
              >
                删除
              </button>
            )}
          </div>
        </div>
        <Markdown source={comment.content} className="comment-body" />
        {replyTo === comment.id && (
          <CommentForm
            autoFocus
            submitting={busy}
            placeholder={`回复 ${comment.author.nickname.trim() || '这条评论'}…`}
            submitLabel="发布回复"
            onCancel={() => setReplyTo(null)}
            onSubmit={(text) => publish(text, comment.id)}
          />
        )}
        {comment.replies.length > 0 && (
          <div className="comment-replies">{comment.replies.map(renderComment)}</div>
        )}
      </div>
    );
  }

  return (
    <section className="comment-section" aria-label="帖子评论">
      <div className="feed-toolbar">
        <h2>
          全部评论 <span className="count-badge">{total}</span>
        </h2>
        <span className="sort-label">
          <Icon name="message" size={14} />
          共 {total} 条 · 最多三层
        </span>
      </div>

      {status === 'authenticated' ? (
        <CommentForm
          submitting={busy}
          placeholder="写下你的评论，支持 Markdown 与插图…"
          submitLabel="发表评论"
          onSubmit={(text) => publish(text)}
        />
      ) : (
        <div className="comment-gate">
          <Icon name="wallet" size={17} />
          <span>登录后即可参与讨论</span>
          <button
            className="btn btn-primary btn-sm"
            disabled={status === 'loading' || status === 'connecting'}
            onClick={() => void connect()}
          >
            {status === 'connecting' ? '等待签名…' : '连接钱包'}
          </button>
        </div>
      )}

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {comments.length === 0 ? (
        <p className="muted comment-empty">还没有人发言，来做第一个吧。</p>
      ) : (
        <div className="comment-list">{comments.map(renderComment)}</div>
      )}
    </section>
  );
}

interface CommentFormProps {
  onSubmit: (content: string) => Promise<boolean>;
  submitting: boolean;
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}

function CommentForm({
  onSubmit,
  submitting,
  placeholder,
  submitLabel,
  autoFocus,
  onCancel,
}: CommentFormProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function insertImage(markdown: string) {
    const next = `${value}${value && !value.endsWith('\n') ? '\n' : ''}${markdown}`;
    if (next.length > CONTENT_MAX) {
      setError('评论太长，放不下这张图片的引用。');
      return;
    }
    setValue(next);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = value.trim();
    if (!text || submitting) return;
    setError(null);
    const ok = await onSubmit(text);
    if (ok) setValue('');
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        className="textarea"
        value={value}
        maxLength={CONTENT_MAX}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={submitting}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="comment-form-actions">
        <InsertImageButton onInserted={insertImage} onError={setError} disabled={submitting} />
        <span className="character-count">
          {value.length}/{CONTENT_MAX}
        </span>
        {onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            取消
          </button>
        )}
        <button className="btn btn-primary btn-sm" type="submit" disabled={submitting || !value.trim()}>
          {submitting ? '提交中…' : submitLabel}
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { InsertImageButton } from '@/components/insert-image-button';
import { Markdown } from '@/components/markdown';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import type { Post } from '@/types';

const TITLE_MAX = 140;
const CONTENT_MAX = 2000;
const TOPICS = ['技术交流', '项目共建', '校园日常'];

export function PostComposer({ onPosted }: { onPosted: (post: Post) => void }) {
  const { status, user, connect } = useWallet();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // 侧边栏、个人主页等处用 /forum#composer 指向发帖框，落到这个锚点时直接展开
  useEffect(() => {
    const expandFromHash = () => {
      if (window.location.hash === '#composer') setExpanded(true);
    };
    expandFromHash();
    window.addEventListener('hashchange', expandFromHash);
    return () => window.removeEventListener('hashchange', expandFromHash);
  }, []);

  useEffect(() => {
    if (expanded) titleRef.current?.focus();
  }, [expanded]);

  function insertImage(markdown: string) {
    const next = `${content}${content && !content.endsWith('\n') ? '\n' : ''}${markdown}`;
    if (next.length > CONTENT_MAX) {
      setError('正文太长，放不下这张图片的引用，先精简一下再试。');
      return;
    }
    setContent(next);
    requestAnimationFrame(() => contentRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== 'authenticated') {
      void connect();
      return;
    }
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle || !cleanContent || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const post = await api.createPost({ title: cleanTitle, topic, content: cleanContent });
      setTitle('');
      setTopic('');
      setContent('');
      setPreview(false);
      setExpanded(false);
      onPosted(post);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '发布失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  // 默认只露一条触发栏，先让访客看到最新帖子，想发帖再展开表单
  if (!expanded) {
    return (
      <section className="card composer-collapsed" id="composer" aria-label="发布新帖">
        <button type="button" className="composer-open" onClick={() => setExpanded(true)}>
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
          <span className="composer-open-text">
            {user ? '分享你的想法，和大家聊两句…' : '登录后即可发帖'}
          </span>
          <span className="btn btn-primary btn-sm composer-open-action">
            {user ? '发个新帖' : '连接钱包'}
            <Icon name={user ? 'edit' : 'wallet'} size={14} />
          </span>
        </button>
      </section>
    );
  }

  return (
    <section className="card composer post-composer" id="composer" aria-label="发布新帖">
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
            <div className="composer-input-head">
              <label htmlFor="post-title">{user ? '开个新帖，聊聊你的想法' : '登录后即可发帖'}</label>
              <button
                type="button"
                className="composer-collapse"
                onClick={() => setExpanded(false)}
              >
                <Icon name="close" size={13} />
                收起
              </button>
            </div>
            <input
              id="post-title"
              ref={titleRef}
              className="input composer-title"
              value={title}
              maxLength={TITLE_MAX}
              placeholder="标题：一句话说清楚你想聊什么"
              onChange={(event) => setTitle(event.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="composer-sections" role="group" aria-label="选择板块">
          {TOPICS.map((name) => (
            <button
              type="button"
              key={name}
              className={topic === name ? 'active' : ''}
              aria-pressed={topic === name}
              onClick={() => setTopic(topic === name ? '' : name)}
              disabled={submitting}
            >
              <Icon name="hash" size={12} />
              {name}
            </button>
          ))}
        </div>

        {preview ? (
          <div className="composer-preview">
            <Markdown source={content} />
          </div>
        ) : (
          <textarea
            id="post-content"
            ref={contentRef}
            className="textarea composer-content"
            aria-label="帖子正文（支持 Markdown）"
            value={content}
            maxLength={CONTENT_MAX}
            placeholder={
              '正文支持 Markdown：**加粗**、- 列表、> 引用、`代码`、[链接](https://example.com)，也可以直接插入图片。'
            }
            onChange={(event) => setContent(event.target.value)}
            disabled={submitting}
          />
        )}

        <div className="composer-toolbar">
          <InsertImageButton onInserted={insertImage} onError={setError} disabled={submitting} />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={submitting || !content.trim()}
            onClick={() => setPreview((current) => !current)}
          >
            <Icon name={preview ? 'edit' : 'book'} size={15} />
            {preview ? '继续编辑' : '预览'}
          </button>
          <span className="character-count">
            {content.length}/{CONTENT_MAX}
          </span>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={
              submitting ||
              status === 'loading' ||
              status === 'connecting' ||
              (status === 'authenticated' && (!title.trim() || !content.trim()))
            }
          >
            {submitting
              ? '发布中…'
              : status === 'connecting'
                ? '等待签名…'
                : user
                  ? '发布帖子'
                  : '连接钱包发帖'}
            <Icon name={user ? 'send' : 'wallet'} size={16} />
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
          仅需钱包签名登录，无需交易或 Gas 费
        </div>
      )}
    </section>
  );
}

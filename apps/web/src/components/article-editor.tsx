'use client';

import { useState, type FormEvent } from 'react';

import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { ApiError } from '@/lib/api';
import type { ArticlePayload } from '@/types';

const TITLE_MAX = 140;
const CONTENT_MAX = 20000;

interface ArticleEditorProps {
  initial?: ArticlePayload;
  submitLabel: string;
  onSubmit: (payload: ArticlePayload) => Promise<void>;
}

export function ArticleEditor({ initial, submitLabel, onSubmit }: ArticleEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!title.trim() || !content.trim()) {
      setError('标题和正文都不能为空。');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), content: content.trim() });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card article-editor" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="article-title">
          标题
          <span>
            {title.length}/{TITLE_MAX}
          </span>
        </label>
        <input
          id="article-title"
          className="input"
          value={title}
          maxLength={TITLE_MAX}
          placeholder="给这篇文章起个名字"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="article-content">
          正文 <span>支持 Markdown</span>
        </label>
        <div className="editor-toolbar">
          <div className="editor-seg">
            <button
              type="button"
              className={mode === 'write' ? 'active' : ''}
              aria-pressed={mode === 'write'}
              onClick={() => setMode('write')}
            >
              编辑
            </button>
            <button
              type="button"
              className={mode === 'preview' ? 'active' : ''}
              aria-pressed={mode === 'preview'}
              onClick={() => setMode('preview')}
            >
              预览
            </button>
          </div>
          <span className="editor-count">
            {content.length}/{CONTENT_MAX}
          </span>
        </div>
        {mode === 'write' ? (
          <textarea
            id="article-content"
            className="textarea"
            value={content}
            maxLength={CONTENT_MAX}
            placeholder={'## 小标题\n\n正文支持 **加粗**、- 列表、> 引用、`代码` 和 [链接](https://example.com)。'}
            onChange={(event) => setContent(event.target.value)}
          />
        ) : (
          <div className="editor-preview">
            {content.trim() ? (
              <Markdown source={content} />
            ) : (
              <span className="link-editor-empty">还没有内容，切回「编辑」开始写。</span>
            )}
          </div>
        )}
      </div>

      <div className="composer-actions">
        <span className="hint">
          <Icon name="shield" size={14} />
          发布后所有社区成员都可以阅读
        </span>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? '保存中…' : submitLabel}
          <Icon name="check" size={16} />
        </button>
      </div>
      {error && (
        <div className="inline-notice" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}

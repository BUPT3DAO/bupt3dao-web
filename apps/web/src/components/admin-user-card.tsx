'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { displayName, userMetaLine } from '@/lib/format';
import type { AdminUser, MemberDetails } from '@/types';

/** 与后端 MemberUpdate.introduction 的 max_length 保持一致 */
const INTRO_MAX = 500;

export function AdminUserCard({
  user,
  onChanged,
}: {
  user: AdminUser;
  onChanged: (message: string) => void;
}) {
  const [editor, setEditor] = useState<'ban' | 'feature' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [details, setDetails] = useState<MemberDetails>({
    title: user.featured?.title ?? '',
    cohort: user.featured?.cohort ?? '',
    introduction: user.featured?.introduction ?? user.bio,
    sort_order: user.featured?.sort_order ?? 0,
  });
  async function run(action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请重试。');
    } finally {
      setBusy(false);
    }
  }
  function saveFeature(event: FormEvent) {
    event.preventDefault();
    void run(() => api.featureMember(user.address, details), '校友墙展示已保存');
  }
  function changeBan(event: FormEvent) {
    event.preventDefault();
    void run(
      () => api.banUser(user.address, !user.is_banned, reason),
      user.is_banned ? '用户已解除封禁' : '用户已封禁，公开内容已隐藏',
    );
  }
  return (
    <article className="card admin-user-card">
      <div className="admin-user-summary">
        <Avatar address={user.address} nickname={user.nickname} src={user.avatar_url} size={44} />
        <div className="admin-user-identity">
          <Link href={`/u/${user.address}`}>{displayName(user)}</Link>
          {userMetaLine(user) && <span className="admin-user-detail">{userMetaLine(user)}</span>}
          <span className="mono">{user.address}</span>
        </div>
        <div className="admin-badges">
          {user.is_admin && <span>管理员</span>}
          {user.is_banned ? <span className="badge-danger">已封禁</span> : <span>正常</span>}
          {user.featured && <span>已上墙</span>}
        </div>
      </div>
      <div className="admin-user-meta">
        <span>{user.post_count} 篇帖子</span>
        <span>{new Date(user.created_at).toLocaleDateString('zh-CN')} 加入</span>
      </div>
      {user.is_banned && (
        <p className="ban-reason">
          封禁原因：{user.ban_reason || '未填写'}。帖子、主页及校友墙展示在封禁期间隐藏。
        </p>
      )}
      <div className="admin-user-actions">
        <button
          className="btn btn-ghost btn-sm"
          disabled={busy || user.is_banned}
          onClick={() => {
            setEditor(editor === 'feature' ? null : 'feature');
            setRemoveConfirm(false);
          }}
        >
          <Icon name="edit" size={14} />
          {user.featured ? '编辑校友展示' : '添加到校友墙'}
        </button>
        {user.featured && (
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              setRemoveConfirm(!removeConfirm);
              setEditor(null);
            }}
          >
            从校友墙移除
          </button>
        )}
        {!user.is_admin && (
          <button
            className={`btn btn-sm ${user.is_banned ? 'btn-ghost' : 'btn-danger'}`}
            disabled={busy}
            onClick={() => {
              setEditor(editor === 'ban' ? null : 'ban');
              setRemoveConfirm(false);
            }}
          >
            {user.is_banned ? '解除封禁' : '封禁用户'}
          </button>
        )}
      </div>
      {removeConfirm && (
        <div className="delete-confirm" role="alert">
          <span>只移除校友墙展示，不删除账号或帖子。</span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => setRemoveConfirm(false)}
          >
            取消
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={() => void run(() => api.unfeatureMember(user.address), '已移除校友墙展示')}
          >
            确认移除
          </button>
        </div>
      )}
      {editor === 'ban' && (
        <form className="admin-inline-form" onSubmit={changeBan}>
          <h3>{user.is_banned ? '确认解除封禁？' : '确认封禁这位用户？'}</h3>
          <p>
            {user.is_banned
              ? '解除后，用户可以重新登录，原有内容和校友展示恢复可见。'
              : '账号已有登录令牌也将无法继续操作。此操作不会删除账号，可随时解除。'}
          </p>
          {!user.is_banned && (
            <label className="field">
              封禁原因（仅管理员可见）
              <textarea
                className="textarea"
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <div className="form-buttons">
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={busy}
              onClick={() => setEditor(null)}
            >
              取消
            </button>
            <button className="btn btn-danger btn-sm" disabled={busy} type="submit">
              {busy ? '处理中…' : user.is_banned ? '确认解封' : '确认封禁'}
            </button>
          </div>
        </form>
      )}
      {editor === 'feature' && (
        <form className="admin-inline-form" onSubmit={saveFeature}>
          <h3>校友墙展示信息</h3>
          <p>头像和昵称跟随个人资料；下列介绍由管理员维护。排序数字越小，展示越靠前。</p>
          <label className="field">
            身份 / 头衔
            <input
              className="input"
              required
              maxLength={80}
              value={details.title}
              onChange={(e) => setDetails({ ...details, title: e.target.value })}
              placeholder="例如：2022 届校友 · 开源开发者"
            />
          </label>
          <div className="admin-form-grid">
            <label className="field">
              届别 / 任期
              <input
                className="input"
                maxLength={40}
                value={details.cohort}
                onChange={(e) => setDetails({ ...details, cohort: e.target.value })}
                placeholder="例如：2022 届"
              />
            </label>
            <label className="field">
              展示顺序
              <input
                className="input"
                type="number"
                min={0}
                max={10000}
                required
                value={details.sort_order}
                onChange={(e) => setDetails({ ...details, sort_order: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="field">
            展示介绍 <span className="muted">支持 Markdown</span>
            <textarea
              className="textarea"
              maxLength={INTRO_MAX}
              value={details.introduction}
              onChange={(e) => setDetails({ ...details, introduction: e.target.value })}
              placeholder={
                '介绍这位校友的经历、贡献与研究方向。\n支持 Markdown：**加粗**、[链接](https://example.com)、- 列表、> 引用'
              }
            />
            <span className="muted">
              Markdown · {details.introduction.length}/{INTRO_MAX}
            </span>
          </label>
          {details.introduction.trim() && (
            <div className="admin-form-preview">
              <span className="eyebrow">PREVIEW</span>
              <Markdown source={details.introduction} />
            </div>
          )}
          <div className="form-buttons">
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={busy}
              onClick={() => setEditor(null)}
            >
              取消
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !details.title.trim()}
              type="submit"
            >
              {busy ? '保存中…' : '保存展示'}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </article>
  );
}

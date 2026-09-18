'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

import { Avatar } from '@/components/avatar';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';

const NICKNAME_MAX = 32;
const BIO_MAX = 500;

export default function SettingsPage() {
  const { status, user, error: walletError, connect, applyUser } = useWallet();
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [syncedAddress, setSyncedAddress] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 登录用户变化（首次加载或换账户）时，把表单同步成服务端的值
    if (user && user.address !== syncedAddress) {
      setNickname(user.nickname);
      setBio(user.bio);
      setSyncedAddress(user.address);
    }
  }, [user, syncedAddress]);

  if (status !== 'authenticated' || !user) {
    return (
      <section className="card">
        <h1>编辑资料</h1>
        <p className="muted">需要先用小狐狸钱包登录。</p>
        <button
          className="btn btn-primary"
          onClick={() => void connect()}
          disabled={status === 'loading' || status === 'connecting'}
        >
          {status === 'connecting' ? '等待钱包确认…' : '连接钱包'}
        </button>
        {walletError && <p className="error-text">{walletError}</p>}
      </section>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await api.updateProfile({ nickname: nickname.trim(), bio: bio.trim() });
      applyUser(updated);
      setNickname(updated.nickname);
      setBio(updated.bio);
      setMessage('资料已保存');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await api.uploadAvatar(file);
      applyUser(updated);
      setMessage('头像已更新');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '头像上传失败');
    } finally {
      setUploading(false);
      // 清空以便重新选择同一个文件
      input.value = '';
    }
  }

  return (
    <div className="stack">
      <h1>编辑资料</h1>

      <section className="card avatar-editor">
        <Avatar address={user.address} nickname={nickname} src={user.avatar_url} size={96} />
        <div>
          <label className="btn btn-ghost" htmlFor="avatar-input">
            {uploading ? '上传中…' : '更换头像'}
          </label>
          <input
            id="avatar-input"
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleAvatarChange}
            disabled={uploading}
          />
          <p className="hint">支持 PNG / JPEG / WebP / GIF，不超过 2 MB。</p>
          <p className="muted mono">{user.address}</p>
        </div>
      </section>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="nickname">昵称</label>
          <input
            id="nickname"
            className="input"
            value={nickname}
            maxLength={NICKNAME_MAX}
            placeholder="还没想好叫什么"
            onChange={(event) => setNickname(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="bio">自我介绍</label>
          <textarea
            id="bio"
            className="textarea"
            value={bio}
            maxLength={BIO_MAX}
            placeholder="介绍一下你自己，比如研究方向、在做的项目…"
            onChange={(event) => setBio(event.target.value)}
          />
          <span className="muted">
            {bio.length}/{BIO_MAX}
          </span>
        </div>

        <div className="composer-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
          {message && <span className="success-text">{message}</span>}
          {error && <span className="error-text">{error}</span>}
        </div>
      </form>
    </div>
  );
}

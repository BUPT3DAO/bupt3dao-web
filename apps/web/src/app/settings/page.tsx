'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
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
      <div className="settings-page">
        <Link href="/" className="back-link">
          <Icon name="back" size={17} />
          返回社区广场
        </Link>
        <div className="page-heading">
          <div>
            <span className="eyebrow">MAKE IT YOURS</span>
            <h1>
              让社区认识你<span className="heading-dot">.</span>
            </h1>
            <p>你的故事，从一张独特的名片开始。</p>
          </div>
        </div>
        <section className="card wallet-gate">
          <div className="gate-art" aria-hidden="true">
            <span />
            <Icon name="wallet" size={38} />
            <span />
          </div>
          <span className="eyebrow">YOUR WALLET. YOUR IDENTITY.</span>
          <h2>连接钱包，开启你的社区身份</h2>
          <p>
            不用注册，不用密码。
            <br />
            使用 MetaMask 签名登录，即可编辑头像、昵称和自我介绍。
          </p>
          <button
            className="btn btn-primary"
            onClick={() => void connect()}
            disabled={status === 'loading' || status === 'connecting'}
          >
            <Icon name="wallet" size={18} />
            {status === 'connecting'
              ? '等待钱包确认…'
              : status === 'loading'
                ? '恢复登录中…'
                : '连接 MetaMask'}
          </button>
          {walletError && (
            <p className="error-text" role="alert">
              {walletError}
            </p>
          )}
          <div className="gate-security">
            <span>
              <Icon name="shield" size={16} />
              无需 Gas 费
            </span>
            <span>
              <Icon name="check" size={16} />
              不发起交易
            </span>
            <span>
              <Icon name="user" size={16} />
              你掌握身份
            </span>
          </div>
        </section>
        <p className="settings-footnote">
          我们永远不会索取你的私钥或助记词。签名前，请确认当前站点的域名。
        </p>
      </div>
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
    if (
      file.size > 2 * 1024 * 1024 ||
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)
    ) {
      setError('请选择不超过 2 MB 的 PNG、JPEG、WebP 或 GIF 图片。');
      input.value = '';
      return;
    }

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
    <div className="settings-page">
      <Link className="back-link" href={`/u/${user.address}`}>
        <Icon name="back" size={17} />
        返回我的主页
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>
            编辑个人资料<span className="heading-dot">.</span>
          </h1>
          <p>用你的方式，介绍独一无二的自己。</p>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-form-column">
          <section className="card avatar-editor">
            <Avatar address={user.address} nickname={nickname} src={user.avatar_url} size={76} />
            <div>
              <h2>个人头像</h2>
              <label className="btn btn-ghost" htmlFor="avatar-input">
                {uploading ? '上传中…' : '更换头像'}
              </label>
              <input
                id="avatar-input"
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarChange}
                disabled={uploading || saving}
              />
              <p className="hint">支持 PNG / JPEG / WebP / GIF，不超过 2 MB。</p>
            </div>
          </section>

          <form className="card settings-form" onSubmit={handleSubmit}>
            <div className="form-section-heading">
              <h2>基本信息</h2>
              <span>展示在你的公开主页</span>
            </div>
            <div className="field">
              <label htmlFor="nickname">
                你的昵称{' '}
                <span>
                  {nickname.length}/{NICKNAME_MAX}
                </span>
              </label>
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
            <div className="field">
              <label htmlFor="wallet-address">
                钱包地址 <span>身份标识，不可修改</span>
              </label>
              <input id="wallet-address" className="input mono" value={user.address} readOnly />
            </div>

            <div className="composer-actions">
              <span className="hint">
                <Icon name="shield" size={14} />
                资料仅用于社区展示
              </span>
              <button className="btn btn-primary" type="submit" disabled={saving || uploading}>
                {saving ? '保存中…' : '保存更改'}
                <Icon name="check" size={16} />
              </button>
            </div>
          </form>
          {message && (
            <div className="success-notice" role="status">
              <Icon name="check" size={18} />
              {message}
            </div>
          )}
          {error && (
            <div className="inline-notice" role="alert">
              {error}
            </div>
          )}
        </div>
        <aside className="profile-preview">
          <span className="eyebrow">LIVE PREVIEW</span>
          <h2>你的社区名片</h2>
          <div className="preview-card">
            <div className="preview-cover">
              <Icon name="spark" size={28} />
            </div>
            <div className="preview-info">
              <Avatar address={user.address} nickname={nickname} src={user.avatar_url} size={64} />
              <h3>{nickname.trim() || '你的昵称'}</h3>
              <span className="mono muted">
                {user.address.slice(0, 6)}…{user.address.slice(-4)}
              </span>
              <p>{bio.trim() || '写下你的兴趣、正在做的事，或者一句喜欢的话。'}</p>
              <span className="preview-badge">
                <span className="status-dot" /> BUPT3DAO MEMBER
              </span>
            </div>
          </div>
          <p className="hint preview-hint">
            左侧修改会实时预览。点击「保存更改」后，伙伴们就能看到新的你。
          </p>
        </aside>
      </div>
    </div>
  );
}

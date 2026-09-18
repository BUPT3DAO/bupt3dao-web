'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import { cohortLabel } from '@/lib/format';
import type { ProfileLink } from '@/types';

const NICKNAME_MAX = 32;
const BIO_MAX = 2000;
const SCHOOL_MAX = 80;
const LABEL_MAX = 24;
const URL_MAX = 300;
const MAX_LINKS = 5;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export default function SettingsPage() {
  const { status, user, error: walletError, connect, applyUser } = useWallet();
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [cohort, setCohort] = useState('');
  const [school, setSchool] = useState('');
  const [major, setMajor] = useState('');
  const [university, setUniversity] = useState('');
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [syncedAddress, setSyncedAddress] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 登录用户变化（首次加载或换账户）时，把表单同步成服务端的值
    if (user && user.address !== syncedAddress) {
      setNickname(user.nickname);
      setBio(user.bio);
      setCohort(user.cohort);
      setSchool(user.school);
      setMajor(user.major);
      setUniversity(user.university);
      setLinks(user.links);
      setSyncedAddress(user.address);
    }
  }, [user, syncedAddress]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="settings-page">
        <Link href="/" className="back-link">
          <Icon name="back" size={17} />
          返回首页
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

  function updateLink(index: number, patch: Partial<ProfileLink>) {
    setLinks((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addLink() {
    setLinks((current) =>
      current.length >= MAX_LINKS ? current : [...current, { label: '', url: '' }],
    );
  }

  function removeLink(index: number) {
    setLinks((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const cleanCohort = cohort.trim();
    if (cleanCohort && !/^\d{4}$/.test(cleanCohort)) {
      setError('入学年份请填写 4 位年份，例如 2023。');
      return;
    }
    const filledLinks = links
      .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
      .filter((link) => link.url);
    if (filledLinks.some((link) => !/^https?:\/\/\S+$/i.test(link.url))) {
      setError('个人链接需要是以 http:// 或 https:// 开头的完整地址。');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateProfile({
        nickname: nickname.trim(),
        bio: bio.trim(),
        cohort: cleanCohort,
        school: school.trim(),
        major: major.trim(),
        university: university.trim(),
        links: filledLinks,
      });
      applyUser(updated);
      setNickname(updated.nickname);
      setBio(updated.bio);
      setCohort(updated.cohort);
      setSchool(updated.school);
      setMajor(updated.major);
      setUniversity(updated.university);
      setLinks(updated.links);
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
    if (file.size > 2 * 1024 * 1024 || !IMAGE_TYPES.includes(file.type)) {
      setError('请选择不超过 2 MB 的 PNG、JPEG、WebP 或 GIF 图片。');
      input.value = '';
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await api.uploadAvatar(file);
      applyUser(updated);
      setMessage('头像已更新');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '头像上传失败');
    } finally {
      setUploadingAvatar(false);
      // 清空以便重新选择同一个文件
      input.value = '';
    }
  }

  async function handleBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024 || !IMAGE_TYPES.includes(file.type)) {
      setError('请选择不超过 4 MB 的 PNG、JPEG、WebP 或 GIF 图片。');
      input.value = '';
      return;
    }

    setUploadingBanner(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await api.uploadBanner(file);
      applyUser(updated);
      setMessage('主页背景图已更新');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '背景图上传失败');
    } finally {
      setUploadingBanner(false);
      input.value = '';
    }
  }

  const busy = saving || uploadingAvatar || uploadingBanner;

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
                {uploadingAvatar ? '上传中…' : '更换头像'}
              </label>
              <input
                id="avatar-input"
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarChange}
                disabled={busy}
              />
              <p className="hint">支持 PNG / JPEG / WebP / GIF，不超过 2 MB。</p>
            </div>
          </section>

          <section className="card banner-editor">
            <div
              className="banner-preview"
              style={user.banner_url ? { backgroundImage: `url(${user.banner_url})` } : undefined}
            >
              {!user.banner_url && <Icon name="spark" size={24} />}
            </div>
            <div className="banner-editor-text">
              <h2>主页背景图</h2>
              <p className="hint">出现在你的个人主页顶部与悬浮名片里，建议用 3:1 的横图。</p>
              <label className="btn btn-ghost" htmlFor="banner-input">
                {uploadingBanner ? '上传中…' : user.banner_url ? '更换背景图' : '上传背景图'}
              </label>
              <input
                id="banner-input"
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleBannerChange}
                disabled={busy}
              />
              <p className="hint">支持 PNG / JPEG / WebP / GIF，不超过 4 MB。</p>
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
                placeholder={
                  '介绍一下你自己。\n支持 Markdown：**加粗**、[链接](https://example.com)、- 列表、> 引用、`代码`'
                }
                onChange={(event) => setBio(event.target.value)}
              />
              <span className="muted">
                Markdown · {bio.length}/{BIO_MAX}
              </span>
            </div>

            <div className="form-section-heading">
              <h2>校园信息</h2>
              <span>选填 · 展示在你的公开主页</span>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="cohort">
                  入学年份 <span>4 位年份</span>
                </label>
                <input
                  id="cohort"
                  className="input"
                  value={cohort}
                  maxLength={4}
                  inputMode="numeric"
                  placeholder="2023"
                  onChange={(event) => setCohort(event.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="field">
                <label htmlFor="school">学院</label>
                <input
                  id="school"
                  className="input"
                  value={school}
                  maxLength={SCHOOL_MAX}
                  placeholder="计算机学院"
                  onChange={(event) => setSchool(event.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="major">专业</label>
              <input
                id="major"
                className="input"
                value={major}
                maxLength={SCHOOL_MAX}
                placeholder="计算机科学与技术"
                onChange={(event) => setMajor(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="university">
                学校 <span>非北邮可填</span>
              </label>
              <input
                id="university"
                className="input"
                value={university}
                maxLength={SCHOOL_MAX}
                placeholder="北京邮电大学"
                onChange={(event) => setUniversity(event.target.value)}
              />
            </div>

            <div className="form-section-heading">
              <h2>个人链接</h2>
              <span>
                {links.length}/{MAX_LINKS} · 推特、项目官网等
              </span>
            </div>
            <div className="field">
              <div className="link-editor">
                {links.map((link, index) => (
                  <div className="link-editor-row" key={index}>
                    <input
                      className="input"
                      value={link.label}
                      maxLength={LABEL_MAX}
                      placeholder="名称（选填）"
                      aria-label={`第 ${index + 1} 个链接的名称`}
                      onChange={(event) => updateLink(index, { label: event.target.value })}
                    />
                    <input
                      className="input"
                      value={link.url}
                      maxLength={URL_MAX}
                      placeholder="https://example.com"
                      aria-label={`第 ${index + 1} 个链接的地址`}
                      onChange={(event) => updateLink(index, { url: event.target.value })}
                    />
                    <button
                      type="button"
                      className="link-editor-remove"
                      aria-label={`删除第 ${index + 1} 个链接`}
                      onClick={() => removeLink(index)}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                ))}
                {links.length === 0 && (
                  <span className="link-editor-empty">还没有链接，最多可以添加 5 个。</span>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm link-editor-add"
                  disabled={links.length >= MAX_LINKS}
                  onClick={addLink}
                >
                  <Icon name="plus" size={14} />
                  添加链接
                </button>
              </div>
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
              <button className="btn btn-primary" type="submit" disabled={busy}>
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
            <div
              className="preview-cover"
              style={user.banner_url ? { backgroundImage: `url(${user.banner_url})` } : undefined}
            >
              {!user.banner_url && <Icon name="spark" size={28} />}
            </div>
            <div className="preview-info">
              <Avatar address={user.address} nickname={nickname} src={user.avatar_url} size={64} />
              <h3>{nickname.trim() || '你的昵称'}</h3>
              <span className="mono muted">
                {user.address.slice(0, 6)}…{user.address.slice(-4)}
              </span>
              <div className="preview-meta">
                {[cohortLabel(cohort), school.trim(), major.trim(), university.trim()]
                  .filter(Boolean)
                  .join(' · ') || '还没有填写入学年份与院系'}
              </div>
              {bio.trim() ? (
                <Markdown source={bio} className="preview-bio" />
              ) : (
                <p>写下你的兴趣、正在做的事，或者一句喜欢的话。</p>
              )}
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

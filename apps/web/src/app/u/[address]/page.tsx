'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { PostCard } from '@/components/post-card';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import { cohortLabel, displayName, hostLabel } from '@/lib/format';
import type { PostSummary, UserProfile } from '@/types';

export default function ProfilePage() {
  const params = useParams<{ address: string }>();
  const address = params?.address ?? '';
  const { user } = useWallet();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [profileData, postData] = await Promise.all([
          api.getUser(address),
          api.listUserPosts(address),
        ]);
        if (cancelled) return;
        setProfile(profileData);
        setPosts(postData.items);
      } catch (cause) {
        if (cancelled) return;
        setProfile(null);
        setPosts([]);
        setError(cause instanceof ApiError ? cause.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const handleDeleted = useCallback((id: number) => {
    setPosts((current) => current.filter((item) => item.id !== id));
    setProfile((current) =>
      current ? { ...current, post_count: current.post_count - 1 } : current,
    );
  }, []);

  const isMe = Boolean(user && profile && user.address === profile.address);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setError('无法自动复制，请手动选择钱包地址。');
    }
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.listUserPosts(address, posts.length);
      setPosts((current) => [
        ...current,
        ...data.items.filter((p) => !current.some((item) => item.id === p.id)),
      ]);
    } catch {
      setError('加载更多动态失败，请重试。');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="profile-page">
      <Link href="/forum" className="back-link">
        <Icon name="back" size={17} />
        返回论坛
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PEOPLE BEHIND THE IDEAS</span>
          <h1>
            {isMe ? '我的主页' : '社区名片'}
            <span className="heading-dot">.</span>
          </h1>
          <p>每一个地址背后，都是一个独特的你。</p>
        </div>
        <Icon name="user" size={30} />
      </div>
      {loading && (
        <div className="card loading-card" role="status">
          <div className="skeleton" />
          <div className="skeleton" />
          <p className="muted">正在加载主页…</p>
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

      {!loading && profile && (
        // 左半是个人名片，右半是 TA 的动态流，窄屏下自动堆叠成上下两段
        <div className="profile-layout">
          <div className="profile-side">
            <section className="card profile-card">
              <div
                className="profile-cover"
                style={
                  profile.banner_url
                    ? { backgroundImage: `url(${profile.banner_url})` }
                    : undefined
                }
              >
                {profile.banner_url ? (
                  <span className="cover-scrim" aria-hidden="true" />
                ) : (
                  <>
                    <span className="eyebrow">BUPT3DAO / COMMUNITY MEMBER</span>
                    <div className="cover-orbits" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className="cover-motto">
                      Stay curious.
                      <br />
                      <em>Build together.</em>
                    </span>
                  </>
                )}
              </div>
              <div className="profile-main">
                <div className="profile-avatar-row">
                  <Avatar
                    address={profile.address}
                    nickname={profile.nickname}
                    src={profile.avatar_url}
                    size={96}
                  />
                  <span className="profile-member">
                    <span className="status-dot" /> WEB3 EXPLORER
                  </span>
                  {isMe && (
                    <Link className="btn btn-ghost" href="/settings">
                      <Icon name="edit" size={16} />
                      编辑资料
                    </Link>
                  )}
                </div>
                <div className="profile-info">
                  <h1>{displayName(profile)}</h1>
                  <button
                    className="address-copy mono"
                    onClick={() => void copyAddress()}
                    title="复制钱包地址"
                  >
                    {profile.address}
                    <Icon name={copied ? 'check' : 'link'} size={14} />
                    <span className="visually-hidden">{copied ? '已复制' : '复制钱包地址'}</span>
                  </button>
                  {(profile.cohort ||
                    profile.school ||
                    profile.major ||
                    profile.university) && (
                    <div className="profile-details">
                      {profile.cohort && (
                        <span className="profile-chip">
                          <Icon name="cap" size={14} />
                          <span>{cohortLabel(profile.cohort)}</span>
                        </span>
                      )}
                      {profile.school && (
                        <span className="profile-chip">
                          <Icon name="book" size={14} />
                          <span>{profile.school}</span>
                        </span>
                      )}
                      {profile.major && (
                        <span className="profile-chip">
                          <Icon name="code" size={14} />
                          <span>{profile.major}</span>
                        </span>
                      )}
                      {profile.university && (
                        <span className="profile-chip">
                          <Icon name="globe" size={14} />
                          <span>{profile.university}</span>
                        </span>
                      )}
                    </div>
                  )}
                  {profile.bio ? (
                    <Markdown source={profile.bio} className="profile-bio" />
                  ) : (
                    <p className="muted">这个人很低调，还没有写自我介绍。</p>
                  )}
                  {profile.links.length > 0 && (
                    <div className="profile-links">
                      {profile.links.map((link, index) => (
                        <a
                          key={`${link.url}-${index}`}
                          className="profile-link"
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={link.url}
                        >
                          <Icon name="link" size={15} />
                          <span>{link.label || hostLabel(link.url)}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="profile-meta">
                    <span>
                      <Icon name="message" size={16} />
                      <b>{profile.post_count}</b> 篇动态
                    </span>
                    <span>
                      <Icon name="clock" size={16} />
                      {new Date(profile.created_at).toLocaleDateString('zh-CN')} 加入
                    </span>
                    <span>
                      <Icon name="globe" size={16} />
                      BUPT3DAO 社区
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="profile-feed">
            <div className="feed-toolbar profile-feed-title">
              <h2>
                {isMe ? '我的动态' : 'TA 的动态'}{' '}
                <span className="count-badge">{profile.post_count}</span>
              </h2>
              <span className="sort-label">
                <Icon name="clock" size={14} />
                最新发布
              </span>
            </div>
            {posts.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-art">
                  <Icon name="edit" size={28} />
                </div>
                <h3>故事，才刚刚开始</h3>
                <p>
                  {isMe
                    ? '把第一个想法留在这里，让更多伙伴认识你。'
                    : '这位伙伴还没有发布动态，期待下一次分享。'}
                </p>
                {isMe && (
                  <Link className="btn btn-primary" href="/forum#composer">
                    发布第一条动态 <Icon name="arrow" size={16} />
                  </Link>
                )}
              </div>
            ) : (
              <div className="post-list">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
                ))}
              </div>
            )}
            {posts.length < profile.post_count && (
              <button
                className="btn btn-ghost load-more"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? '加载中…' : '加载更多动态'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

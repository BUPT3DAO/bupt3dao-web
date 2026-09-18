'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Avatar } from '@/components/avatar';
import { PostCard } from '@/components/post-card';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import { displayName } from '@/lib/format';
import type { Post, UserProfile } from '@/types';

export default function ProfilePage() {
  const params = useParams<{ address: string }>();
  const address = params?.address ?? '';
  const { user } = useWallet();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setProfile((current) => (current ? { ...current, post_count: current.post_count - 1 } : current));
  }, []);

  const isMe = Boolean(user && profile && user.address === profile.address);

  return (
    <div className="stack">
      {loading && <p className="muted">正在加载主页…</p>}
      {error && <p className="error-text">{error}</p>}

      {profile && (
        <>
          <section className="card profile-card">
            <Avatar
              address={profile.address}
              nickname={profile.nickname}
              src={profile.avatar_url}
              size={88}
            />
            <div className="profile-info">
              <h1>{displayName(profile)}</h1>
              <p className="muted mono">{profile.address}</p>
              {profile.bio ? (
                <p className="profile-bio">{profile.bio}</p>
              ) : (
                <p className="muted">这个人很低调，还没有写自我介绍。</p>
              )}
              <p className="muted">
                {profile.post_count} 篇帖子 · {new Date(profile.created_at).toLocaleDateString('zh-CN')}{' '}
                加入
              </p>
              {isMe && (
                <Link className="btn btn-ghost" href="/settings">
                  编辑资料
                </Link>
              )}
            </div>
          </section>

          <h2 className="section-title">TA 的帖子</h2>
          {posts.length === 0 ? (
            <p className="muted">还没有发过帖子。</p>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} onDeleted={handleDeleted} />)
          )}
        </>
      )}
    </div>
  );
}

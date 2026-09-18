'use client';

import { useCallback, useEffect, useState } from 'react';

import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { api } from '@/lib/api';
import type { Post } from '@/types';

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.listPosts();
        if (cancelled) return;
        setPosts(data.items);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : '帖子加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePosted = useCallback((post: Post) => {
    setPosts((current) => [post, ...current]);
  }, []);

  const handleDeleted = useCallback((id: number) => {
    setPosts((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <div className="stack">
      <section className="hero">
        <h1>BUPT3DAO 广场</h1>
        <p className="muted">用钱包登录，和协会里的伙伴聊技术、聊项目。</p>
      </section>

      <PostComposer onPosted={handlePosted} />

      {loading && <p className="muted">正在加载帖子…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <p className="muted">还没有人发帖，来抢第一条。</p>
      )}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
      ))}
    </div>
  );
}

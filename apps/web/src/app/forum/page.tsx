'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { api } from '@/lib/api';
import type { Post } from '@/types';

const topics = ['全部动态', '技术交流', '项目共建', '校园日常'];

export default function ForumPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('全部动态');
  const [version, setVersion] = useState(0);
  const paging = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .listPosts()
      .then((data) => {
        if (!cancelled) {
          setPosts(data.items);
          setTotal(data.total);
        }
      })
      .catch(() => {
        if (!cancelled) setError('动态加载失败，请重试。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function loadMore() {
    if (paging.current) return;
    paging.current = true;
    setLoadingMore(true);
    setError('');
    try {
      const data = await api.listPosts(posts.length);
      setPosts((current) => [
        ...current,
        ...data.items.filter((p) => !current.some((item) => item.id === p.id)),
      ]);
      setTotal(data.total);
    } catch {
      setError('加载更多失败，请重试。');
    } finally {
      paging.current = false;
      setLoadingMore(false);
    }
  }

  const onPosted = useCallback((post: Post) => {
    setPosts((current) => [post, ...current]);
    setTotal((current) => current + 1);
    setQuery('');
    setTopic('全部动态');
  }, []);
  const onDeleted = useCallback((id: number) => {
    setPosts((current) => current.filter((post) => post.id !== id));
    setTotal((current) => Math.max(0, current - 1));
  }, []);

  const visible = posts.filter((post) => {
    const text = `${post.content} ${post.author.nickname} ${post.author.address}`;
    const tags: string[] = post.content.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    return (
      text.toLowerCase().includes(query.trim().toLowerCase()) &&
      (topic === '全部动态' || tags.includes(`#${topic}`))
    );
  });

  return (
    <div className="forum-layout">
      <div className="forum-main">
        <div className="page-heading">
          <div>
            <span className="eyebrow">IDEAS START CONVERSATIONS</span>
            <h1>
              社区论坛<span className="heading-dot">.</span>
            </h1>
            <p>聊技术，找伙伴，记录每一次新的发现。</p>
          </div>
          <Link href="/guide" className="btn btn-ghost btn-sm">
            <Icon name="book" size={15} />
            发帖指南
          </Link>
        </div>
        <PostComposer onPosted={onPosted} />
        <section className="feed-section" id="feed" aria-label="论坛动态">
          <div className="feed-toolbar">
            <h2>
              最新讨论 <span className="count-badge">{total}</span>
            </h2>
            <span className="sort-label">
              <Icon name="clock" size={14} />
              按发布时间
            </span>
          </div>
          <div className="feed-controls">
            <div className="feed-tabs" aria-label="话题分类">
              {topics.map((name) => (
                <button
                  key={name}
                  className={topic === name ? 'active' : ''}
                  aria-pressed={topic === name}
                  onClick={() => setTopic(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <label className="search-field">
              <Icon name="search" size={16} />
              <input
                aria-label="搜索已加载动态"
                placeholder="搜索已加载动态"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button aria-label="清空搜索" onClick={() => setQuery('')}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </label>
          </div>
          {(query || topic !== '全部动态') && (
            <p className="filter-note">
              在已加载的 {posts.length} 条中找到 {visible.length} 条 · 话题按 #标签 筛选
            </p>
          )}
          {error && (
            <div role="alert" className="inline-notice">
              {error}
              <button className="text-link" onClick={() => setVersion((n) => n + 1)}>
                重新加载
              </button>
            </div>
          )}
          {loading ? (
            <div role="status" className="card loading-card">
              <div className="skeleton" />
              <div className="skeleton" />
              <span className="visually-hidden">加载论坛中</span>
            </div>
          ) : (
            <>
              {!error && visible.length === 0 && (
                <div className="card empty-state">
                  <div className="empty-art">
                    <Icon name="message" size={28} />
                  </div>
                  <h3>
                    {query || topic !== '全部动态' ? '暂时没有匹配的讨论' : '从你的第一个想法开始'}
                  </h3>
                  <p>分享一个问题、一段学习心得，或一个正在进行的项目。</p>
                  <a href="#composer" className="text-link">
                    写下你的想法 <Icon name="arrow" size={16} />
                  </a>
                </div>
              )}
              <div className="post-list">
                {visible.map((post) => (
                  <PostCard key={post.id} post={post} onDeleted={onDeleted} />
                ))}
              </div>
              {posts.length < total && (
                <button
                  className="btn btn-ghost load-more"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? '加载中…' : '加载更多讨论'}
                </button>
              )}
            </>
          )}
        </section>
      </div>
      <aside className="forum-aside">
        <span className="eyebrow">BE KIND. STAY CURIOUS.</span>
        <h2>
          好的社区，
          <br />
          由每个人共同维护。
        </h2>
        <p>尊重不同的声音，分享有价值的信息。不泄露私钥，不发布广告或人身攻击。</p>
        <Link href="/guide" className="text-link">
          阅读社区指南 <Icon name="arrow" size={16} />
        </Link>
        <div className="forum-aside-divider" />
        <Icon name="user" size={25} />
        <h3>想认识更多伙伴？</h3>
        <p>走进校友墙，看看社团共建者的故事。</p>
        <Link href="/members" className="text-link">
          认识我们的校友 <Icon name="upRight" size={16} />
        </Link>
      </aside>
    </div>
  );
}

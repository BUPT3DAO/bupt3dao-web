'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { Icon } from '@/components/icon';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { api } from '@/lib/api';
import type { PageResult, Post, PostSummary } from '@/types';

const PAGE_SIZE = 20;
const topics = ['全部', '技术交流', '项目共建', '校园日常'];

export function ForumClient({ initialData }: { initialData: PageResult<PostSummary> | null }) {
  const [posts, setPosts] = useState<PostSummary[]>(initialData?.items ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [loading, setLoading] = useState(initialData === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('全部');
  const [version, setVersion] = useState(0);
  const paging = useRef(false);
  const initialLoad = useRef(true);
  const requestVersion = useRef(0);
  const filterKey = JSON.stringify([query, topic]);
  const filterKeyRef = useRef(filterKey);
  filterKeyRef.current = filterKey;

  useEffect(() => {
    requestVersion.current += 1;
    if (initialLoad.current) {
      initialLoad.current = false;
      if (initialData) return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .listPosts({ q: query, topic: topic === '全部' ? '' : topic, limit: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        setPosts(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) setError('帖子加载失败，请重试。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialData, query, topic, version]);

  async function loadMore() {
    if (paging.current) return;
    const requestedVersion = requestVersion.current;
    const requestedFilter = filterKey;
    paging.current = true;
    setLoadingMore(true);
    setError('');
    try {
      const data = await api.listPosts({
        q: query,
        topic: topic === '全部' ? '' : topic,
        offset: posts.length,
        limit: PAGE_SIZE,
      });
      if (
        requestVersion.current !== requestedVersion ||
        filterKeyRef.current !== requestedFilter
      ) {
        return;
      }
      setPosts((current) => [
        ...current,
        ...data.items.filter((item) => !current.some((post) => post.id === item.id)),
      ]);
      setTotal(data.total);
    } catch {
      if (
        requestVersion.current === requestedVersion &&
        filterKeyRef.current === requestedFilter
      ) {
        setError('加载更多失败，请重试。');
      }
    } finally {
      paging.current = false;
      setLoadingMore(false);
    }
  }

  const onPosted = useCallback((post: Post) => {
    setPosts((current) => [post, ...current]);
    setTotal((current) => current + 1);
  }, []);
  const onDeleted = useCallback((id: number) => {
    setPosts((current) => current.filter((post) => post.id !== id));
    setTotal((current) => Math.max(0, current - 1));
  }, []);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
  }

  const filtered = query || topic !== '全部';

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
        <section className="feed-section" id="feed" aria-label="论坛帖子">
          <div className="feed-toolbar">
            <h2>
              最新帖子 <span className="count-badge">{total}</span>
            </h2>
            <span className="sort-label">
              <Icon name="clock" size={14} />
              按发布时间
            </span>
          </div>
          <div className="feed-controls">
            <div className="feed-tabs" aria-label="板块分类">
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
            <form className="search-field" onSubmit={submitSearch}>
              <Icon name="search" size={16} />
              <input
                aria-label="搜索帖子"
                placeholder="搜索标题、正文或作者"
                value={search}
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  aria-label="清空搜索"
                  onClick={() => {
                    setSearch('');
                    setQuery('');
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </form>
          </div>
          {filtered && (
            <p className="filter-note">
              找到 {total} 个相关帖子
              {topic !== '全部' && ` · 板块「${topic}」`}
              {query && ` · 关键词「${query}」`}
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
              {!error && posts.length === 0 && (
                <div className="card empty-state">
                  <div className="empty-art">
                    <Icon name="message" size={28} />
                  </div>
                  <h3>{filtered ? '暂时没有匹配的帖子' : '从你的第一个帖子开始'}</h3>
                  <p>分享一个问题、一段学习心得，或一个正在进行的项目。</p>
                  <a href="#composer" className="text-link">
                    写下你的想法 <Icon name="arrow" size={16} />
                  </a>
                </div>
              )}
              <div className="post-list">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} onDeleted={onDeleted} />
                ))}
              </div>
              {posts.length < total && (
                <button
                  className="btn btn-ghost load-more"
                  disabled={loading || loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? '加载中…' : '加载更多帖子'}
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

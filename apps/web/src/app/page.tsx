'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Icon, type IconName } from '@/components/icon';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { api } from '@/lib/api';
import type { Post } from '@/types';

const topics: { name: string; label: string; icon: IconName; match: RegExp; color: string }[] = [
  {
    name: '技术交流',
    label: 'TECH & IDEAS',
    icon: 'code',
    match: /技术|开发|合约|solidity|代码|研究|ethereum|web3/i,
    color: 'violet',
  },
  {
    name: '项目共建',
    label: 'BUILD TOGETHER',
    icon: 'spark',
    match: /项目|共建|组队|黑客松|hackathon|招募|开源/i,
    color: 'lavender',
  },
  {
    name: '校园日常',
    label: 'LIFE AT BUPT',
    icon: 'globe',
    match: /校园|日常|北邮|活动|分享|生活|随想/i,
    color: 'peach',
  },
];

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('全部动态');
  const [reload, setReload] = useState(0);
  const paging = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.listPosts();
        if (cancelled) return;
        setPosts(data.items);
        setTotal(data.total);
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
  }, [reload]);

  async function loadMore() {
    if (paging.current) return;
    paging.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await api.listPosts(posts.length);
      setPosts((current) => [
        ...current,
        ...data.items.filter((item) => !current.some((p) => p.id === item.id)),
      ]);
      setTotal(data.total);
    } catch {
      setError('暂时无法加载更多，请稍后重试。');
    } finally {
      setLoadingMore(false);
      paging.current = false;
    }
  }

  const handlePosted = useCallback((post: Post) => {
    setPosts((current) => [post, ...current]);
    setTotal((current) => current + 1);
    setQuery('');
    setTopic('全部动态');
  }, []);

  const handleDeleted = useCallback((id: number) => {
    setPosts((current) => current.filter((item) => item.id !== id));
    setTotal((current) => Math.max(0, current - 1));
  }, []);

  const matcher = topics.find((item) => item.name === topic)?.match;
  const visiblePosts = posts.filter((post) => {
    const text = `${post.content} ${post.author.nickname} ${post.author.address}`;
    const taggedTopics: string[] = post.content.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    const hasTopicTag = topics.some((item) => taggedTopics.includes(`#${item.name}`));
    const matchesTopic =
      !matcher || (hasTopicTag ? taggedTopics.includes(`#${topic}`) : matcher.test(post.content));
    return text.toLowerCase().includes(query.trim().toLowerCase()) && matchesTopic;
  });

  return (
    <div className="community-layout">
      <div className="feed-column">
        <div className="page-heading">
          <div>
            <span className="eyebrow">A PLACE FOR THE CURIOUS</span>
            <h1>
              社区广场<span className="heading-dot">.</span>
            </h1>
            <p>有趣的想法，值得在这里相遇。</p>
          </div>
          <span className="edition-label">
            BUPT × WEB3
            <br />
            <b>OPEN COMMUNITY</b>
          </span>
        </div>

        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-content">
            <span className="hero-tag">
              <span className="status-dot" /> 不止连接钱包，更连接彼此
            </span>
            <h2>
              连接想法，
              <br />
              共建<span>下一种可能。</span>
            </h2>
            <p>
              从北邮出发，探索 Web3 的无限边界。
              <br />
              在这里分享、协作，让每一个想法生长。
            </p>
            <a className="btn btn-soft" href="#composer">
              发布你的想法 <Icon name="upRight" size={18} />
            </a>
          </div>
          <div className="orbital-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="orbit-core">
              <span>3</span>
              <small>
                DECENTRALIZE
                <br />
                THE FUTURE
              </small>
            </div>
            <span className="orbit-node node-one" />
            <span className="orbit-node node-two" />
            <span className="orbit-star">✳</span>
            <span className="orbit-coordinate">39.96° N / 116.35° E</span>
          </div>
          <div className="hero-footnote">
            <span>IDEAS. PEOPLE. POSSIBILITIES.</span>
            <span>
              EST. BUPT <Icon name="globe" size={13} />
            </span>
          </div>
        </section>

        <section className="topic-grid" aria-label="按话题探索">
          {topics.map((item) => (
            <button
              key={item.name}
              className={`topic-card ${item.color} ${topic === item.name ? 'selected' : ''}`}
              aria-pressed={topic === item.name}
              onClick={() => {
                setTopic(topic === item.name ? '全部动态' : item.name);
                document
                  .getElementById('feed')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <span className="topic-icon">
                <Icon name={item.icon} />
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>{item.label}</small>
              </span>
              <Icon name="upRight" size={16} />
            </button>
          ))}
        </section>

        <PostComposer onPosted={handlePosted} />

        <section className="feed-section" id="feed" aria-label="社区动态">
          <div className="feed-toolbar">
            <h2>
              社区动态 <span className="count-badge">{loading ? '·' : total}</span>
            </h2>
            <span className="sort-label">
              <Icon name="clock" size={14} />
              最新发布
            </span>
          </div>
          <div className="feed-controls">
            <div className="feed-tabs" aria-label="动态分类">
              {['全部动态', ...topics.map((item) => item.name)].map((name) => (
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
              <Icon name="search" size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索已加载动态"
                aria-label="搜索已加载动态"
              />
              {query && (
                <button aria-label="清空搜索" onClick={() => setQuery('')}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </label>
          </div>
          {(query || matcher) && (
            <p className="filter-note">
              在已加载的 {posts.length} 条动态中找到 {visiblePosts.length} 条
              {matcher && ' · 优先匹配话题标签'}
            </p>
          )}
          {loading && (
            <div className="card loading-card" role="status" aria-label="正在加载动态">
              <div className="skeleton skeleton-avatar" />
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton short" />
              <span className="visually-hidden">正在加载动态</span>
            </div>
          )}
          {error && (
            <div className="inline-notice" role="alert">
              <span>{error}</span>
              <button
                className="text-link"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  setReload((n) => n + 1);
                }}
              >
                重新加载 <Icon name="arrow" size={15} />
              </button>
            </div>
          )}
          {!loading && !error && visiblePosts.length === 0 && (
            <div className="card empty-state">
              <div className="empty-art">
                <span />
                <Icon name={query || matcher ? 'search' : 'message'} size={28} />
                <span />
              </div>
              <span className="eyebrow">
                {query || matcher ? 'KEEP EXPLORING' : 'EVERY CONVERSATION STARTS SOMEWHERE'}
              </span>
              <h3>
                {query || matcher ? '换个关键词，也许会有新发现' : '下一个精彩的讨论，从你开始'}
              </h3>
              <p>
                {query || matcher
                  ? '试试其他话题，或加载更多社区动态。'
                  : '一个灵感、一个问题、一段学习心得，都值得被看见。'}
              </p>
              {query || matcher ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setQuery('');
                    setTopic('全部动态');
                  }}
                >
                  查看全部动态 <Icon name="arrow" size={16} />
                </button>
              ) : (
                <a className="text-link" href="#composer">
                  成为第一个分享的人 <Icon name="arrow" size={16} />
                </a>
              )}
            </div>
          )}
          <div className="post-list">
            {visiblePosts.map((post) => (
              <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
            ))}
          </div>
          {!loading && posts.length < total && (
            <button
              className="btn btn-ghost load-more"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? '加载中…' : '加载更多动态'}
              <Icon name="arrow" size={16} />
            </button>
          )}
          {!loading && !error && posts.length > 0 && posts.length >= total && (
            <p className="feed-end">
              <span />
              你已经看到了所有新鲜事
              <span />
            </p>
          )}
        </section>
        <footer className="content-footer">
          <span>保持好奇，保持连接。</span>
          <span>
            BUPT3DAO COMMUNITY <Icon name="spark" size={13} />
          </span>
        </footer>
      </div>

      <aside className="discovery-column" aria-label="社区指南与资源">
        <section className="about-card">
          <div className="section-kicker">
            <span>HELLO, BUILDERS</span>
            <Icon name="spark" size={18} />
          </div>
          <h2>
            一个开放的社区。
            <br />
            一群好奇的人。
          </h2>
          <p>
            这里是 BUPT3DAO，北邮人的 Web3
            聚集地。无论你是开发者、研究者，还是刚刚开始探索，都欢迎加入。
          </p>
          <div className="value-tags">
            <span>开放</span>
            <span>协作</span>
            <span>共建</span>
          </div>
          <div className="about-bottom">
            <span className="status-dot" /> Permissionless by nature.
          </div>
        </section>
        <section className="side-section" id="community-guide">
          <div className="side-section-heading">
            <h2>从这里开始</h2>
            <span className="tiny-label">GET STARTED</span>
          </div>
          <div className="guide-list">
            <details>
              <summary>
                <span className="step-number">01</span>
                <span>
                  连接你的身份<small>一个钱包，就是通行证</small>
                </span>
                <Icon name="chevron" size={15} />
              </summary>
              <p>
                点击「连接钱包」，使用 MetaMask 确认登录签名。登录不会发起链上交易，也不需要 Gas
                费。请核对签名中的站点域名。
              </p>
            </details>
            <details>
              <summary>
                <span className="step-number">02</span>
                <span>
                  让大家认识你<small>完善你的社区名片</small>
                </span>
                <Icon name="chevron" size={15} />
              </summary>
              <p>
                登录后，在编辑资料中上传头像、设置昵称，写下你的研究方向或兴趣。
                <Link href="/settings">前往编辑资料 →</Link>
              </p>
            </details>
            <details>
              <summary>
                <span className="step-number">03</span>
                <span>
                  开启第一次对话<small>分享，发现，找到同行者</small>
                </span>
                <Icon name="chevron" size={15} />
              </summary>
              <p>
                在广场分享想法或提出问题，也可以在正文添加 #技术交流、#项目共建 或
                #校园日常，方便伙伴发现你的动态。
              </p>
            </details>
          </div>
        </section>
        <section className="side-section">
          <div className="side-section-heading">
            <h2>探索 Web3</h2>
            <Icon name="upRight" size={17} />
          </div>
          <a className="resource-link" href="https://x.com/BUPT3DAO" target="_blank" rel="noopener noreferrer">
            <span className="resource-icon"><Icon name="x" /></span>
            <span><strong>@BUPT3DAO</strong><small>关注官方 X · 获取社区最新动态</small></span>
            <Icon name="upRight" size={15} />
          </a>
          <a
            className="resource-link"
            href="https://ethereum.org/zh/learn/"
            target="_blank"
            rel="noreferrer"
          >
            <span className="resource-icon">
              <Icon name="globe" />
            </span>
            <span>
              <strong>从以太坊开始</strong>
              <small>理解去中心化的世界</small>
            </span>
            <Icon name="upRight" size={15} />
          </a>
          <a
            className="resource-link"
            href="https://github.com/BUPT3DAO"
            target="_blank"
            rel="noreferrer"
          >
            <span className="resource-icon lilac">
              <Icon name="code" />
            </span>
            <span>
              <strong>代码，让想法发生</strong>
              <small>探索我们的开源项目</small>
            </span>
            <Icon name="upRight" size={15} />
          </a>
        </section>
        <div className="community-note">
          <Icon name="shield" size={20} />
          <p>
            自由表达，友善交流。
            <br />
            <span>保护私钥，不分享助记词，不轻信陌生链接。</span>
          </p>
        </div>
        <div className="right-footer">
          <a href="https://x.com/BUPT3DAO" target="_blank" rel="noopener noreferrer">@BUPT3DAO</a>
          <span>连接每一种可能 ↗</span>
        </div>
      </aside>
    </div>
  );
}

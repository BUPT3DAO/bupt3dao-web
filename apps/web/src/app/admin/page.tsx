'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { AdminUserCard } from '@/components/admin-user-card';
import { PostCard } from '@/components/post-card';
import { useWallet } from '@/components/wallet-provider';
import { api } from '@/lib/api';
import type { AdminUser, Post } from '@/types';

const tabs = ['用户管理', '帖子管理', '校友墙管理'] as const;
type Tab = (typeof tabs)[number];

export default function AdminPage() {
  const { user, status, connect } = useWallet();
  const [tab, setTab] = useState<Tab>('用户管理');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user?.is_admin) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    async function load() {
      try {
        if (tab === '帖子管理') {
          const data = await api.adminPosts(query, page * 12);
          if (!cancelled) {
            setPosts(data.items);
            setTotal(data.total);
          }
        } else {
          const data = await api.adminUsers(query, page * 12, tab === '校友墙管理');
          if (!cancelled) {
            setUsers(data.items);
            setTotal(data.total);
          }
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.address, user?.is_admin, tab, query, page, version]);

  function changed(message: string) {
    setNotice(message);
    setVersion((n) => n + 1);
  }
  function switchTab(value: Tab) {
    setTab(value);
    setPage(0);
    setSearch('');
    setQuery('');
    setNotice('');
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
    setPage(0);
  }

  if (!user?.is_admin)
    return (
      <div className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">COMMUNITY OPERATIONS</span>
            <h1>
              管理后台<span className="heading-dot">.</span>
            </h1>
          </div>
        </div>
        <section className="card empty-state">
          <div className="empty-art">
            <Icon name="shield" size={32} />
          </div>
          <h2>
            {status === 'loading'
              ? '正在检查登录状态'
              : user
                ? '当前钱包没有管理员权限'
                : '请使用管理员钱包登录'}
          </h2>
          <p>管理员由服务器上的钱包白名单授权。普通用户无法使用后台功能。</p>
          {!user && (
            <button
              className="btn btn-primary"
              disabled={status === 'loading' || status === 'connecting'}
              onClick={() => void connect()}
            >
              {status === 'connecting' ? '等待签名确认…' : '连接管理员钱包'}
            </button>
          )}
          <div className="gate-return">
            <Link href="/" className="text-link">
              返回首页 <Icon name="arrow" size={16} />
            </Link>
          </div>
        </section>
      </div>
    );

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">COMMUNITY OPERATIONS</span>
          <h1>
            管理后台<span className="heading-dot">.</span>
          </h1>
          <p>维护社区秩序，也让值得被看见的人被看见。</p>
        </div>
        <span className="admin-role">
          <Icon name="shield" size={16} />
          管理员
        </span>
      </div>
      <div className="admin-tabs" aria-label="管理功能">
        {tabs.map((name) => (
          <button
            key={name}
            className={tab === name ? 'active' : ''}
            aria-pressed={tab === name}
            onClick={() => switchTab(name)}
          >
            <Icon
              name={name === '用户管理' ? 'user' : name === '帖子管理' ? 'message' : 'spark'}
              size={18}
            />
            {name}
          </button>
        ))}
      </div>
      <div className="admin-context">
        <div>
          <h2>{tab}</h2>
          <p>
            {tab === '校友墙管理'
              ? '只列出已上墙成员。在「用户管理」中搜索并添加新校友；被封禁成员不会公开展示。'
              : tab === '帖子管理'
                ? '查看全部帖子（含被封禁用户的帖子）。删除操作不可撤销。'
                : '从已注册成员中选择。可按昵称或完整钱包地址查找；管理员账号不可在此封禁。'}
          </p>
        </div>
        {tab === '校友墙管理' && (
          <Link className="btn btn-ghost btn-sm" href="/members">
            查看公开校友墙 <Icon name="upRight" size={14} />
          </Link>
        )}
      </div>
      <form className="admin-search" onSubmit={submitSearch}>
        <label className="search-field">
          <Icon name="search" size={17} />
          <input
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="搜索管理内容"
            placeholder={tab === '帖子管理' ? '搜索正文、昵称或钱包地址' : '搜索昵称或钱包地址'}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-sm">
          搜索
        </button>
        <span className="muted">共 {total} 条</span>
      </form>
      {notice && (
        <div role="status" className="success-notice">
          <Icon name="check" size={17} />
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="inline-notice">
          {error}
          <button className="text-link" onClick={() => setVersion((n) => n + 1)}>
            重试
          </button>
        </div>
      )}
      {loading ? (
        <div role="status" className="card loading-card">
          <div className="skeleton" />
          <div className="skeleton" />
          <span className="visually-hidden">加载管理数据中</span>
        </div>
      ) : (
        !error && (
          <div className="admin-list">
            {tab === '帖子管理'
              ? posts.map((post) => (
                  <PostCard key={post.id} post={post} onDeleted={() => changed('帖子已删除')} />
                ))
              : users.map((item) => (
                  <AdminUserCard
                    key={`${item.address}-${version}`}
                    user={item}
                    onChanged={changed}
                  />
                ))}
            {(tab === '帖子管理' ? posts.length === 0 : users.length === 0) && (
              <div className="card empty-state">
                <h3>这里暂时没有记录</h3>
                <p>
                  {tab === '校友墙管理'
                    ? '前往用户管理，选择已注册校友并添加展示信息。'
                    : '试试其他搜索条件，或返回上一页。'}
                </p>
                {tab === '校友墙管理' && (
                  <button className="btn btn-primary" onClick={() => switchTab('用户管理')}>
                    从注册用户中添加
                  </button>
                )}
              </div>
            )}
          </div>
        )
      )}
      <div className="pagination">
        <button
          className="btn btn-ghost btn-sm"
          disabled={page === 0 || loading}
          onClick={() => setPage((n) => n - 1)}
        >
          上一页
        </button>
        <span>第 {page + 1} 页</span>
        <button
          className="btn btn-ghost btn-sm"
          disabled={(page + 1) * 12 >= total || loading}
          onClick={() => setPage((n) => n + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

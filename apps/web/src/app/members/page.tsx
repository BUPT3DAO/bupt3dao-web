'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { api } from '@/lib/api';
import { displayName, userMetaLine } from '@/lib/format';
import type { Member } from '@/types';

export default function MembersPage() {
  const [items, setItems] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .members(query, page * 12)
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch(() => {
        if (!cancelled) setError('校友墙加载失败，请稍后重试。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, page, version]);
  function searchMembers(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
    setPage(0);
  }
  return (
    <div className="members-page">
      <div className="members-intro">
        <span className="eyebrow">PEOPLE WHO MAKE IT POSSIBLE</span>
        <h1>
          相遇于北邮，
          <br />
          <span>各自精彩，一起生长。</span>
        </h1>
        <p>历届校友与社团共建者。认识他们的故事，也找到你的同路人。</p>
        <span className="members-orbit" aria-hidden="true">
          <Icon name="spark" size={64} />
        </span>
      </div>
      <div className="members-toolbar">
        <div>
          <h2>
            校友与共建者 <span className="count-badge">{total}</span>
          </h2>
          <p>由社团管理员精选展示</p>
        </div>
        <form onSubmit={searchMembers} className="directory-search">
          <label className="search-field">
            <Icon name="search" size={16} />
            <input
              aria-label="搜索校友"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="姓名、届别或研究方向"
              maxLength={100}
            />
          </label>
          <button className="btn btn-ghost btn-sm" type="submit">
            搜索
          </button>
        </form>
      </div>
      {error && (
        <div role="alert" className="inline-notice">
          {error}
          <button className="text-link" onClick={() => setVersion((n) => n + 1)}>
            重试
          </button>
        </div>
      )}
      {loading ? (
        <div className="card loading-card" role="status">
          <div className="skeleton" />
          <div className="skeleton" />
          <span className="visually-hidden">正在加载校友墙</span>
        </div>
      ) : (
        !error &&
        (items.length ? (
          <div className="member-grid">
            {items.map((member) => (
              <Link
                key={member.user.address}
                href={`/u/${member.user.address}`}
                className="member-card"
              >
                <div className="member-card-top">
                  <Avatar
                    address={member.user.address}
                    nickname={member.user.nickname}
                    src={member.user.avatar_url}
                    size={68}
                  />
                  <span>{member.cohort || '社团共建者'}</span>
                </div>
                <h3>{displayName(member.user)}</h3>
                {userMetaLine(member.user) && (
                  <p className="member-card-meta">{userMetaLine(member.user)}</p>
                )}
                <strong>{member.title}</strong>
                <p>{member.introduction || member.user.bio || '这位伙伴的故事，正在继续。'}</p>
                <div className="member-card-link">
                  查看个人主页 <Icon name="upRight" size={17} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card empty-state">
            <div className="empty-art">
              <Icon name="user" size={28} />
            </div>
            <h3>{query ? '暂时没有找到这位伙伴' : '留一面墙，给共同走过的人'}</h3>
            <p>
              {query
                ? '试试姓名、届别或其他关键词。'
                : '校友受邀注册后，由社团管理员完善介绍并展示在这里。'}
            </p>
            {query && (
              <button
                className="text-link"
                onClick={() => {
                  setQuery('');
                  setSearch('');
                  setPage(0);
                }}
              >
                查看全部校友
              </button>
            )}
          </div>
        ))
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

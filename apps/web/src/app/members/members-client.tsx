'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { displayName, userMetaLine } from '@/lib/format';
import type { Member, PageResult } from '@/types';

export function MembersClient({
  initialData,
}: {
  initialData: PageResult<Member> | null;
}) {
  const [items, setItems] = useState<Member[]>(initialData?.items ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(initialData === null);
  const [error, setError] = useState('');
  const initialLoad = useRef(true);
  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      if (initialData) return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .members(query, page * 12, controller.signal)
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
      controller.abort();
    };
  }, [initialData, query, page, version]);
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
              // 介绍里可能带 Markdown 链接，卡片不能再整体包一层 <a>，
              // 否则出现嵌套链接，服务端与客户端渲染结果会对不上
              <article className="member-card" key={member.user.address}>
                <Link className="member-card-top" href={`/u/${member.user.address}`}>
                  <Avatar
                    address={member.user.address}
                    nickname={member.user.nickname}
                    src={member.user.avatar_url}
                    size={68}
                  />
                  <span>{member.cohort || '社团共建者'}</span>
                </Link>
                <h3>
                  <Link href={`/u/${member.user.address}`}>{displayName(member.user)}</Link>
                </h3>
                {userMetaLine(member.user) && (
                  <p className="member-card-meta">{userMetaLine(member.user)}</p>
                )}
                <strong>{member.title}</strong>
                <Markdown
                  className="member-card-intro"
                  source={member.introduction || member.user.bio || '这位伙伴的故事，正在继续。'}
                />
                <Link className="member-card-link" href={`/u/${member.user.address}`}>
                  查看个人主页 <Icon name="upRight" size={17} />
                </Link>
              </article>
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

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { EventCard } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import type { CommunityEvent } from '@/types';

const PAGE_SIZE = 12;

export function EventsClient() {
  const { user, status, connect, logout } = useWallet();
  const [period, setPeriod] = useState<'upcoming' | 'past'>('upcoming');
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loadedAddress, setLoadedAddress] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setEvents([]);
    setTotal(0);
    setPage(0);
    setError('');
  }, [user?.address]);

  useEffect(() => {
    if (!user?.address) {
      setEvents([]);
      setTotal(0);
      setLoadedAddress(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    api.listEvents(period, page * PAGE_SIZE, PAGE_SIZE, controller.signal)
      .then((data) => {
        if (!active) return;
        setEvents(data.items);
        setTotal(data.total);
        setLoadedAddress(user.address);
      })
      .catch((cause) => {
        if (active && !controller.signal.aborted) {
          setEvents([]);
          setTotal(0);
          setLoadedAddress(null);
          if (cause instanceof ApiError && cause.status === 401) logout();
          setError(cause instanceof Error ? cause.message : '活动加载失败，请重试');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      controller.abort();
    };
  }, [user, period, page, version, logout]);

  if (status === 'loading') {
    return <div className="events-gate card" role="status">正在确认登录状态…</div>;
  }
  if (!user) {
    return (
      <section className="card events-gate">
        <div className="empty-art"><Icon name="calendar" size={32} /></div>
        <h2>连接钱包后查看社区活动</h2>
        <p>活动仅向已注册并登录的社区成员开放。首次登录会自动创建账号。</p>
        <button className="btn btn-primary" disabled={status === 'connecting'} onClick={() => void connect()}>{status === 'connecting' ? '等待签名确认…' : '连接钱包'}</button>
        <Link className="text-link" href="/guide">了解社区指南 <Icon name="arrow" size={15} /></Link>
      </section>
    );
  }

  return (
    <div className="events-content">
      <div className="events-toolbar">
        <div className="feed-tabs" aria-label="活动时间范围">
          <button className={period === 'upcoming' ? 'active' : ''} aria-pressed={period === 'upcoming'} onClick={() => { setPeriod('upcoming'); setPage(0); }}>即将开始</button>
          <button className={period === 'past' ? 'active' : ''} aria-pressed={period === 'past'} onClick={() => { setPeriod('past'); setPage(0); }}>往期活动</button>
        </div>
        <span className="muted">共 {loadedAddress === user.address ? total : 0} 场</span>
        <Link className="text-link" href="/events/mine">我的活动 <Icon name="arrow" size={15} /></Link>
      </div>
      {error && <div className="inline-notice" role="alert">{error}<button className="text-link" onClick={() => setVersion((n) => n + 1)}>重试</button></div>}
      {loading || loadedAddress !== user.address ? <div className="card loading-card"><div className="skeleton" /><div className="skeleton" /></div> : events.length ? (
        <div className="events-grid">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>
      ) : !error ? <div className="card empty-state"><div className="empty-art"><Icon name="calendar" size={30} /></div><h2>{period === 'past' ? '还没有往期活动' : '暂时没有已发布的活动'}</h2><p>有新活动时，会在这里更新。</p></div> : null}
      {total > PAGE_SIZE && <div className="pagination"><button className="btn btn-ghost btn-sm" disabled={page === 0 || loading} onClick={() => setPage((n) => n - 1)}>上一页</button><span>第 {page + 1} 页</span><button className="btn btn-ghost btn-sm" disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => setPage((n) => n + 1)}>下一页</button></div>}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { EventCard } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import type { CommunityEvent } from '@/types';

type Period = 'upcoming' | 'past' | 'all';
const PAGE_SIZE = 12;

export function MyEventsClient() {
  const { user, status, connect, logout } = useWallet();
  const address = user?.address ?? null;
  const [period, setPeriod] = useState<Period>('upcoming');
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
    setLoadedAddress(null);
  }, [address]);

  useEffect(() => {
    if (!address) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.myEvents(period, page * PAGE_SIZE, PAGE_SIZE, controller.signal)
      .then((data) => {
        if (!active) return;
        setEvents(data.items);
        setTotal(data.total);
        setLoadedAddress(address);
      })
      .catch((cause) => {
        if (!active || controller.signal.aborted) return;
        setEvents([]);
        setTotal(0);
        setLoadedAddress(null);
        if (cause instanceof ApiError && cause.status === 401) logout();
        setError('我的活动加载失败，请稍后重试。');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [address, period, page, version, logout]);

  if (status === 'loading') return <div className="events-gate card" role="status">正在确认登录状态…</div>;
  if (!user) return <section className="card events-gate"><div className="empty-art"><Icon name="calendar" size={32} /></div><h2>登录后管理关注活动</h2><p>连接钱包即可查看你的活动列表。</p><button className="btn btn-primary" disabled={status === 'connecting'} onClick={() => void connect()}>{status === 'connecting' ? '等待签名确认…' : '连接钱包'}</button></section>;

  return <div className="events-content">
    <div className="events-toolbar"><div className="feed-tabs" aria-label="活动时间范围">{(['upcoming', 'past', 'all'] as Period[]).map((item) => <button key={item} className={period === item ? 'active' : ''} aria-pressed={period === item} onClick={() => { setPeriod(item); setPage(0); }}>{item === 'upcoming' ? '即将开始' : item === 'past' ? '往期活动' : '全部关注'}</button>)}</div><span className="muted">共 {loadedAddress === address ? total : 0} 场</span></div>
    {error && <div className="inline-notice" role="alert">{error}<button className="text-link" onClick={() => setVersion((value) => value + 1)}>重试</button></div>}
    {loading || loadedAddress !== address ? <div className="card loading-card"><div className="skeleton" /><div className="skeleton" /></div> : events.length ? <div className="events-grid">{events.map((event) => <EventCard key={event.id} event={event} onFollowChange={(followed) => { if (!followed) setVersion((value) => value + 1); }} />)}</div> : !error ? <div className="card empty-state"><div className="empty-art"><Icon name="calendar" size={30} /></div><h2>{period === 'past' ? '还没有关注过往活动' : '还没有关注活动'}</h2><p>关注感兴趣的活动后，它们会出现在这里。</p><Link href="/events" className="text-link">浏览活动中心 <Icon name="arrow" size={15} /></Link></div> : null}
    {total > PAGE_SIZE && <div className="pagination"><button className="btn btn-ghost btn-sm" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>上一页</button><span>第 {page + 1} 页</span><button className="btn btn-ghost btn-sm" disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => setPage((value) => value + 1)}>下一页</button></div>}
  </div>;
}

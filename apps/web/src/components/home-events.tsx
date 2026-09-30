'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { EventCard } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import type { CommunityEvent } from '@/types';

export function HomeEvents() {
  const { user, status, connect, logout } = useWallet();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loadedAddress, setLoadedAddress] = useState<string | null>(null);
  useEffect(() => {
    setEvents([]);
    if (!user?.address) {
      setLoadedAddress(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    api.listEvents('upcoming', 0, 3, controller.signal)
      .then((data) => { if (active) { setEvents(data.items); setLoadedAddress(user.address); } })
      .catch((cause) => {
        if (!active) return;
        setEvents([]);
        setLoadedAddress(user.address);
        if (cause instanceof ApiError && cause.status === 401) logout();
      });
    return () => { active = false; controller.abort(); };
  }, [user, logout]);

  return (
    <section className="home-events" aria-labelledby="home-events-title">
      <div className="home-events-heading">
        <div><span className="eyebrow">MEET & BUILD</span><h2 id="home-events-title">社区活动</h2></div>
        <Link className="text-link" href="/events">活动中心 <Icon name="arrow" size={15} /></Link>
      </div>
      {!user ? (
        <div className="card home-events-gate">
          <span>活动仅面向登录成员开放。</span>
          <button className="text-link" disabled={status === 'loading' || status === 'connecting'} onClick={() => void connect()}>{status === 'loading' ? '确认登录状态…' : '连接钱包查看'} <Icon name="wallet" size={15} /></button>
        </div>
      ) : loadedAddress !== user.address ? <div className="card home-events-gate">正在加载活动…</div> : events.length ? <div className="events-grid home-events-grid">{events.map((event) => <EventCard key={event.id} event={event} />)}</div> : <div className="card home-events-gate">有新活动时，会在这里更新。</div>}
    </section>
  );
}

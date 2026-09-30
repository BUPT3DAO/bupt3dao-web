'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { eventDate } from '@/components/event-card';
import { EventFollowControl } from '@/components/event-follow-control';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import type { CommunityEvent } from '@/types';

export function EventDetailClient({ eventId }: { eventId: number }) {
  const { user, status, connect, logout } = useWallet();
  const [event, setEvent] = useState<CommunityEvent | null>(null);
  const [loadedAddress, setLoadedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [calendarBusy, setCalendarBusy] = useState(false);

  useEffect(() => {
    setEvent(null);
    setError('');
    if (!user?.address || !Number.isInteger(eventId) || eventId < 1) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    api.getEvent(eventId, controller.signal)
      .then((data) => { if (active) { setEvent(data); setLoadedAddress(user.address); } })
      .catch((cause) => {
        if (!active || controller.signal.aborted) return;
        setLoadedAddress(user.address);
        if (cause instanceof ApiError && cause.status === 401) logout();
        setError(cause instanceof ApiError && cause.status === 404 ? '活动不存在或已撤回。' : '活动加载失败，请稍后重试。');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [eventId, user, logout]);

  async function downloadCalendar() {
    if (!event || calendarBusy) return;
    setCalendarBusy(true);
    try {
      const blob = await api.downloadEventCalendar(event.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `bupt3dao-event-${event.id}.ics`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '日历下载失败');
    } finally {
      setCalendarBusy(false);
    }
  }

  if (status === 'loading') return <div className="events-gate card" role="status">正在确认登录状态…</div>;
  if (!user) return <section className="card events-gate"><div className="empty-art"><Icon name="calendar" size={32} /></div><h2>连接钱包后查看社区活动</h2><p>活动仅向已注册并登录的社区成员开放。</p><button className="btn btn-primary" disabled={status === 'connecting'} onClick={() => void connect()}>{status === 'connecting' ? '等待签名确认…' : '连接钱包'}</button></section>;
  if (loading || loadedAddress !== user.address) return <div className="card loading-card"><div className="skeleton" /><div className="skeleton" /></div>;
  if (!event) return <section className="card empty-state"><h2>{error || '活动不存在'}</h2><Link href="/events" className="text-link">返回活动中心 <Icon name="arrow" size={15} /></Link></section>;

  const stateLabel = event.event_state === 'cancelled' ? '活动已取消' : event.event_state === 'ended' ? '活动已结束' : event.event_state === 'ongoing' ? '活动进行中' : '即将开始';
  return (
    <article className="event-detail">
      <Link href="/events" className="text-link"><Icon name="back" size={16} />返回活动中心</Link>
      <header className="event-detail-heading">
        <span className={`event-state event-state-${event.event_state}`}>{stateLabel}</span>
        <h1>{event.title}<span className="heading-dot">.</span></h1>
        {event.summary && <p>{event.summary}</p>}
      </header>
      <div className="event-detail-layout">
        <section className="card event-detail-main">
          <h2>活动介绍</h2>
          <Markdown source={event.content} />
          {event.event_state === 'cancelled' && <div className="inline-notice"><strong>取消说明：</strong>{event.cancellation_reason}</div>}
          {event.materials && <section className="event-materials"><h2>活动资料与复盘</h2><Markdown source={event.materials} /></section>}
        </section>
        <aside className="card event-detail-aside">
          <h2>活动信息</h2>
          <dl>
            <div><dt>开始时间</dt><dd>{eventDate(event.starts_at)} <small>UTC+8</small></dd></div>
            <div><dt>结束时间</dt><dd>{eventDate(event.ends_at)} <small>UTC+8</small></dd></div>
            <div><dt>地点</dt><dd>{event.location}</dd></div>
            <div><dt>主办方</dt><dd>{event.organizer}</dd></div>
          </dl>
          {event.event_state === 'cancelled' ? <p className="event-closed-note">本次活动已取消。</p> : event.registration_open && event.registration_url ? <a className="btn btn-primary event-action" href={event.registration_url} target="_blank" rel="noopener noreferrer">前往外部报名 <Icon name="upRight" size={15} /></a> : event.registration_url ? <p className="event-closed-note">报名已截止。</p> : <p className="event-closed-note">本活动无需报名。</p>}
          {event.publication_status === 'published' && event.event_state !== 'cancelled' && <button className="btn btn-ghost event-action" disabled={calendarBusy} onClick={() => void downloadCalendar()}><Icon name="calendar" size={16} />{calendarBusy ? '正在下载…' : '添加到日历'}</button>}
          <p className="hint">请以官网页面的最新时间和安排为准。</p>
          <EventFollowControl event={event} />
        </aside>
      </div>
    </article>
  );
}
